'use strict';

const _ = require('lodash');
const Crypto = require('crypto');


// Declare internals

const internals = {};

internals.hash = (password, salt) => Crypto.createHmac('sha256', salt).update(password).digest('hex');
internals.safeFields = ['displayName', 'email', 'username'];


// User Model

module.exports = internals.User = (sequelize, DataTypes) => {

    return sequelize.define('User', {
        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: DataTypes.INTEGER
        },
        username: {
            type: DataTypes.STRING,
            unique: true
        },
        email: {
            allowNull: false,
            type: DataTypes.STRING,
            unique: true
        },
        displayName: DataTypes.STRING,
        password: DataTypes.STRING,
        salt: DataTypes.UUID,
        jti: DataTypes.UUID,
        active: {
            allowNull: false,
            defaultValue: true,
            type: DataTypes.BOOLEAN
        },
        admin: {
            allowNull: false,
            defaultValue: false,
            type: DataTypes.BOOLEAN
        },
        createdAt: {
            allowNull: false,
            defaultValue: DataTypes.NOW,
            type: DataTypes.DATE
        },
        updatedAt: {
            allowNull: false,
            defaultValue: DataTypes.NOW,
            type: DataTypes.DATE
        }
    }, {
        classMethods: {
            hashPassword: internals.hash,
            safeFields: internals.safeFields
        },
        instanceMethods: {
            hasValidPassword: (password, hash, salt) => hash === internals.hash(password, salt),
            getSafeFields: function () { // Apparently sequelize doesn't fully support es6
                return _.pick(this, internals.safeFields);
            }
        }
    });
};