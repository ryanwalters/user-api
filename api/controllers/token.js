'use strict';

const Boom = require('boom');
const Config = require('../config');
const Joi = require('joi');
const Jwt = require('jsonwebtoken');
const Scopes = require('../constants').Scopes;
const UserModel = require('../models').User;
const Uuid = require('uuid');


// Token generation endpoints

module.exports = {

    // Generate access token from a refresh token

    access: {
        auth: {
            strategy: 'jwt-refresh',
            access: {
                scope: [Scopes.REFRESH]
            }
        },
        handler: (request, reply) => {

            const scope = [`${Scopes.USER}-${request.auth.credentials.sub}`];

            if (request.auth.credentials.scope.indexOf(Scopes.ADMIN) !== -1) {
                scope.push(Scopes.ADMIN);
            }

            return reply({
                accessToken: Jwt.sign({
                    scope: scope
                }, Config.get('/auth/jwt/secret'), {
                    expiresIn: 60 * 60,
                    issuer: Config.get('/auth/jwt/issuer'),
                    subject: request.auth.credentials.sub
                })
            });
        }
    },


    // Generate refresh token when user logs in

    refresh: {
        auth: false,
        handler: (request, reply) => {

            /**
             * Steps:
             * 1. lookup email
             * 2. if exists, validate password
             * 3. if valid, generate jti and update user
             * 4. return signed jwt
             */

            // todo: add facebook, gmail, linkedin strategies; 2. if isAuthenticated, continue to 3

            UserModel.findOne({
                where: {
                    email: request.payload.email,
                    active: true
                }
            })
                .then((user) => {

                    if (!user) {
                        return reply(Boom.unauthorized('User not found.'));
                    }

                    if (user.hasValidPassword(request.payload.password, user.password, user.salt)) {

                        const scope = [Scopes.REFRESH];

                        if (user.admin) {
                            scope.push(Scopes.ADMIN);
                        }

                        user.jti = Uuid.v1();

                        UserModel.update(user.dataValues, {
                            where: {
                                id: user.id,
                                active: true
                            }
                        })
                            .then((data) => {

                                if (data[0] !== 1) {
                                    return reply(Boom.badImplementation('Must update single row.', { rowsAffected: data[0] }));
                                }

                                return reply({
                                    refreshToken: Jwt.sign({
                                        jti: user.jti,
                                        scope: scope
                                    }, Config.get('/auth/jwt/secret'), {
                                        issuer: Config.get('/auth/jwt/issuer'),
                                        subject: user.id
                                    })
                                });
                            })
                            .catch((error) => reply(Boom.badImplementation(error.message)));
                    }

                    else {
                        return reply(Boom.unauthorized('Incorrect password.'));
                    }

                    return null; // Stops bluebird from complaining...
                })
                .catch((error) => reply(Boom.badImplementation(error.message)));
        },
        validate: {
            payload: {
                email: Joi.string().email().required(),
                password: Joi.string().required()
            }
        }
    },


    // Revoke token

    revoke: {
        handler: (request, reply) => {

            /**
             * Steps:
             * 1. look up user
             * 2. generate new jti
             * 3. update user with new jti
             * 4. return number of affected rows
             */

            UserModel.findOne({
                where: {
                    id: request.payload.userId
                }
            })
                .then((user) => {

                    if (!user) {
                        return reply(Boom.unauthorized('User not found.'));
                    }

                    user.jti = Uuid.v1();

                    UserModel.update(user.dataValues, {
                        where: {
                            id: user.id
                        }
                    })
                        .then((response) => reply({
                            rowsAffected: response[0]
                        }))
                        .catch((error) => reply(Boom.badImplementation(error.message)));

                    return null; // Stops bluebird from complaining...
                })
                .catch((error) => reply(Boom.badImplementation(error.message)));
        },
        validate: {
            payload: {
                userId: Joi.number().required()
            }
        }
    }
};