'use strict';

const Joi = require('joi');
const Randomstring = require('randomstring');
const Scopes = require('../constants').Scopes;
const Status = require('../constants').Status;
const WFResponse = require('../response');
const UserModel = require('../models').User;
const Uuid = require('uuid');


// User endpoints

module.exports = {


    // Create user

    create: {
        auth: false,
        handler: (request, reply) => {

            const password = request.payload.password;
            const salt = Uuid.v1();

            request.payload.password = UserModel.hashPassword(password, salt);
            request.payload.salt = salt;

            UserModel.create(request.payload)
                .then((user) => {

                    const data = {
                        user: user.getSafeFields()
                    };

                    if (!request.payload.returnToken) {
                        return reply(new WFResponse(Status.OK, data));
                    }

                    request.server.inject({
                        method: 'POST',
                        url: '/v1/token/refresh',
                        payload: {
                            email: request.payload.email,
                            password: password
                        }
                    }, (res) => {

                        data.refreshToken = res.result.data.refreshToken;

                        request.server.inject({
                            method: 'POST',
                            url: '/v1/token/access',
                            headers: {
                                authorization: data.refreshToken
                            }
                        }, (res) => {

                            data.accessToken = res.result.data.accessToken;

                            return reply(new WFResponse(Status.OK, data));
                        });
                    });
                })
                .catch((error) => reply(new WFResponse(Status.ACCOUNT_CREATION_ERROR, null, error.errors)));
        },
        validate: {
            payload: Joi.object({
                username: Joi.string().alphanum().min(3).max(30).required(),
                email: Joi.string().email().required(),
                password: Joi.string().min(6).required(),
                displayName: Joi.string().min(3).max(30),
                returnToken: Joi.boolean().default(true)
            }).options({ abortEarly: false })
        }
    },


    // Get user

    read: {
        auth: {
            access: {
                scope: [Scopes.ADMIN, Scopes.USER_ID]
            }
        },
        handler: (request, reply) => {

            UserModel.findOne({
                where: {
                    id: request.params.id,
                    active: true
                }
            })
                .then((user) => {

                    if (!user) {
                        return reply(new WFResponse(Status.USER_NOT_FOUND));
                    }

                    return reply(new WFResponse(Status.OK, user.getSafeFields()));
                })
                .catch((error) => reply(new WFResponse(Status.SERVER_ERROR, null, error)));
        }
    },


    // Update user

    // todo: figure out what to do with this. sqlite3 does not support RETURNING * (model.js ln2554)

    update: {
        auth: {
            access: {
                scope: [Scopes.ADMIN, Scopes.USER_ID]
            }
        },
        handler: (request, reply) => {

            UserModel.update(request.payload, {
                where: {
                    id: request.params.id
                }/*,
                returning: true*/
            })
                .then((response) => {

                    if (response[0] === 0) {
                        return reply(new WFResponse(Status.USER_NOT_FOUND));
                    }

                    return reply(new WFResponse(Status.OK/*, response[1][0].getSafeFields()*/));
                })
                .catch((error) => reply(new WFResponse(Status.SERVER_ERROR, null, error)));
        },
        validate: {
            payload: Joi.object({
                username: Joi.string().alphanum().min(3).max(30),
                email: Joi.string().email(),
                displayName: Joi.string().min(3).max(30)
            }).options({ abortEarly: false })
        }
    },


    // Update password

    updatePassword: {
        auth: {
            access: {
                scope: [Scopes.ADMIN, Scopes.USER_ID]
            }
        },
        handler: (request, reply) => {

            /**
             * Steps:
             * 1. validate old password
             * 2. generate new salt
             * 3. hash new password
             * 4. update user with new salt and hash
             * 5. return status
             */

            UserModel.findOne({
                where: {
                    id: request.params.id
                }
            })
                .then((user) => {

                    if (!user) {
                        return reply(new WFResponse(Status.USER_NOT_FOUND));
                    }

                    if (!user.hasValidPassword(request.payload.password, user.password, user.salt)) {
                        return reply(new WFResponse(Status.PASSWORD_INCORRECT));
                    }

                    user.dataValues.salt = Uuid.v1();
                    user.dataValues.password = UserModel.hashPassword(request.payload.newPassword, user.salt);

                    UserModel.update(user.dataValues, {
                        where: {
                            id: user.id
                        }
                    })
                        .then(() => reply(new WFResponse(Status.OK)))
                        .catch((error) => reply(new WFResponse(Status.SERVER_ERROR, null, error)));

                    return null; // Stops bluebird from complaining...
                })
                .catch((error) => reply(new WFResponse(Status.SERVER_ERROR, null, error)));
        },
        validate: {
            payload: Joi.object({
                password: Joi.string().min(6).required(),
                newPassword: Joi.string().min(6).required().invalid(Joi.ref('password')).options({
                    language: {
                        any: {
                            invalid: 'cannot match "password"'
                        }
                    }
                }),
                confirmPassword: Joi.string().required().valid(Joi.ref('newPassword')).options({
                    language: {
                        any: {
                            allowOnly: 'must match "newPassword"'
                        }
                    }
                })
            }).options({ abortEarly: false })
        }
    },


    // Reset password

    resetPassword: {
        handler: (request, reply) => {

            /**
             * Steps
             * 1. generate new password and salt
             * 2. hash password
             * 3. update user with hashed password and salt
             * 4. email user with new randomly generated password // todo
             * 5. return rowsAffected
             */

            UserModel.findOne({
                where: {
                    id: request.payload.userId
                }
            })
                .then((user) => {

                    if (!user) {
                        return reply(new WFResponse(Status.USER_NOT_FOUND));
                    }

                    const password = Randomstring.generate();
                    const salt = Uuid.v1();

                    user.dataValues.password = UserModel.hashPassword(password, salt);
                    user.dataValues.salt = salt;

                    UserModel.update(user.dataValues, {
                        where: {
                            id: user.id
                        }
                    })
                        .then(() => {

                            // todo: email user with password

                            return reply(new WFResponse(Status.OK));
                        })
                        .catch((error) => reply(new WFResponse(Status.SERVER_ERROR, null, error)));

                    return null; // Stops bluebird from complaining...
                })
                .catch((error) => reply(new WFResponse(Status.SERVER_ERROR, null, error)));
        },
        validate: {
            payload: {
                userId: Joi.number().required()
            }
        }
    },


    // Delete user

    delete: {
        auth: {
            access: {
                scope: [Scopes.ADMIN, Scopes.USER_ID]
            }
        },
        handler: (request, reply) => {

            UserModel.destroy({
                where: {
                    id: request.params.id
                },
                limit: 1
            })
                .then((rowsAffected) => {

                    if (rowsAffected === 0) {
                        return reply(new WFResponse(Status.USER_NOT_FOUND));
                    }

                    return reply(new WFResponse(Status.OK));
                })
                .catch((error) => reply(new WFResponse(Status.SERVER_ERROR, null, error)));
        }
    }
};