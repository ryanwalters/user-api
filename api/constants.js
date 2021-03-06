'use strict';

module.exports = {

    // Scopes

    Scopes: Object.freeze({
        ADMIN: 'admin',
        REFRESH: 'refresh',
        USER: 'user',
        USER_ID: 'user-{params.id}'
    }),


    // Status codes

    Status: Object.freeze({

        OK: {
            statusCode: 0,
            message: 'Ok'
        },


        // Unauthorized

        UNAUTHORIZED: {
            statusCode: 40100,
            message: 'Unauthorized'
        },
        VALIDATION_ERROR: {
            statusCode: 40101,
            message: 'Validation error'
        },
        INVALID_TOKEN: {
            statusCode: 40102,
            message: 'Invalid token'
        },


        // Forbidden

        FORBIDDEN: {
            statusCode: 40300,
            message: 'Forbidden'
        },
        ACCOUNT_CREATION_ERROR: {
            statusCode: 40301,
            message: 'Account creation error'
        },
        PASSWORD_INCORRECT: {
            statusCode: 40302,
            message: 'Password incorrect'
        },
        USER_NOT_FOUND: {
            statusCode: 40303,
            message: 'User not found'
        },


        // Server error

        SERVER_ERROR: {
            statusCode: 50000,
            message: 'Server error'
        }
    })
};