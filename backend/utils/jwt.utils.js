const jwt = require('jsonwebtoken');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config/env');

const signToken = (payload) => jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

const verifyToken = (token) => {
  try {
    return { valid: true, decoded: jwt.verify(token, JWT_SECRET) };
  } catch (err) {
    return { valid: false, error: err.message };
  }
};

module.exports = { signToken, verifyToken };