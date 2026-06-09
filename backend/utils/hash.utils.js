const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

const hashPassword = (plainText) => bcrypt.hash(plainText, SALT_ROUNDS);

const comparePassword = (plainText, hashed) => bcrypt.compare(plainText, hashed);

module.exports = { hashPassword, comparePassword };
