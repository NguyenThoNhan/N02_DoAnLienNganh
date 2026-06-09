const { forbidden } = require('../utils/response.utils');

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) return forbidden(res, 'Chưa xác thực người dùng');
    if (!roles.includes(req.user.role)) {
      return forbidden(res, 'Bạn không có quyền thực hiện hành động này');
    }
    next();
  };
};

const isAdmin   = authorize('admin');
const isDoctor  = authorize('doctor');
const isPatient = authorize('patient');
const isDoctorOrAdmin = authorize('doctor', 'admin');

module.exports = { authorize, isAdmin, isDoctor, isPatient, isDoctorOrAdmin };
