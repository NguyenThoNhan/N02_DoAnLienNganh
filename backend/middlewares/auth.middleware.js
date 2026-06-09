const { verifyToken } = require('../utils/jwt.utils');
const { unauthorized } = require('../utils/response.utils');

const authenticate = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return unauthorized(res, 'Không tìm thấy token xác thực');
  }

  const token = authHeader.split(' ')[1];
  const { valid, decoded, error } = verifyToken(token);

  if (!valid) {
    const message = error === 'jwt expired' ? 'Token đã hết hạn' : 'Token không hợp lệ';
    return unauthorized(res, message);
  }

  req.user = decoded;
  next();
};

const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  const token = authHeader.split(' ')[1];
  const { valid, decoded } = verifyToken(token);

  req.user = valid ? decoded : null;
  next();
};

module.exports = { authenticate, optionalAuth };