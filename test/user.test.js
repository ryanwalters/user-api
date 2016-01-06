'use strict';

const _ = require('lodash');
const Code = require('code');
const Lab = require('lab');
const Status = require('../api/constants').Status;
const Models = require('../api/models');


// Test shortcuts

const lab = exports.lab = Lab.script();
const describe = lab.describe;
const it = lab.it;
const expect = Code.expect;
const before = lab.before;
const beforeEach = lab.beforeEach;

const server = require('../server');


// Declare internals

const internals = {
    user: {
        username: 'test',
        password: '123456',
        email: 'test@weddingfoundry.com',
        displayName: 'John Doe'
    }
};


// User tests

describe('/v1/user', () => {


    // Create user

    describe('POST - create user', () => {

        before((done) => {
            Models.sequelize.sync({ force: true }).then(() => {
                done();
            });
        });

        let options;

        beforeEach((done) => {

            options  = {
                method: 'POST',
                url: '/v1/user',
                payload: {}
            };

            done();
        });

        it('fails user creation when required fields are missing', (done) => {

            server.inject(options, (res) => {

                const result = res.result;

                expect(res.statusCode).to.equal(200);
                expect(result.statusCode).to.equal(Status.VALIDATION_ERROR.statusCode);
                expect(result.message).to.equal(Status.VALIDATION_ERROR.message);
                expect(result.data).to.be.empty();
                expect(result.errorDetails).to.be.an.array();
                expect(result.errorDetails).to.have.length(3);
                expect(result.errorDetails).to.deep.include({ path: 'username' });
                expect(result.errorDetails).to.deep.include({ path: 'password' });
                expect(result.errorDetails).to.deep.include({ path: 'email' });
                done();
            });
        });

        it('successfully creates user', (done) => {

            options.payload = internals.user;

            server.inject(options, (res) => {

                const result = res.result;

                expect(res.statusCode).to.equal(200);
                expect(result.statusCode).to.equal(Status.OK.statusCode);
                expect(result.message).to.equal(Status.OK.message);
                expect(result.data.username).to.equal(options.payload.username);
                expect(result.data.email).to.equal(options.payload.email);
                expect(result.data.displayName).to.equal(options.payload.displayName);
                done();
            });
        });

        it('fails when user exists', (done) => {

            options.payload = internals.user;

            server.inject(options, (res) => {

                const result = res.result;

                expect(res.statusCode).to.equal(200);
                expect(result.statusCode).to.equal(Status.ACCOUNT_CREATION_ERROR.statusCode);
                expect(result.message).to.equal(Status.ACCOUNT_CREATION_ERROR.message);
                expect(result.errorDetails).to.be.array();
                expect(result.errorDetails).to.deep.include({ type: 'unique violation' });
                expect(result.data).to.be.empty();
                done();
            });
        });
    });


    // Get user details

    describe('GET /{userId} - user details', () => {


        // Make user an admin and get an access token

        let accessToken;

        before((done) => {

            Models.User.update({ admin: true }, {
                where: {
                    id: 1
                }
            })
                .then(() => {

                    server.inject({ method: 'POST', url: '/v1/token/refresh',
                        payload: _.pick(internals.user, ['email', 'password'])
                    }, (res) => {

                        const refreshToken = res.result.refreshToken;

                        server.inject({ method: 'POST', url: '/v1/token/access',
                            headers: { authorization: refreshToken }
                        }, (res) => {

                            accessToken = res.result.accessToken;

                            done();
                        });
                    });
                });
        });


        // Set route options

        let options;

        beforeEach((done) => {

            options = {
                method: 'GET',
                url: '/v1/user/1',
                headers: {
                    authorization: accessToken
                }
            };

            done();
        });


        // Tests

        it('fails without JWT', (done) => {

            delete options.headers;

            server.inject(options, (res) => {

                expect(res.statusCode).to.equal(401);
                done();
            });
        });

        it('successfully retrieves user details', (done) => {

            server.inject(options, (res) => {

                const result = res.result;

                expect(res.statusCode).to.equal(200);
                expect(result.statusCode).to.equal(Status.OK.statusCode);
                expect(result.message).to.equal(Status.OK.message);
                expect(result.data).to.deep.equal(_.omit(internals.user, 'password'));
                done();
            });
        });

        it('fails when user does not exist', (done) => {

            options.url = '/v1/user/123';

            server.inject(options, (res) => {

                const result = res.result;

                expect(res.statusCode).to.equal(200);
                expect(result.statusCode).to.equal(Status.USER_NOT_FOUND.statusCode);
                expect(result.message).to.equal(Status.USER_NOT_FOUND.message);
                expect(result.data).to.be.empty();
                done();
            });
        });
    });
});