const UserModel    = require('../models/user.model');
const DoctorModel  = require('../models/doctor.model');
const { hashPassword, comparePassword } = require('../utils/hash.utils');
const { signToken }  = require('../utils/jwt.utils');
const R = require('../utils/response.utils');
const { enrichPatientUser } = require('../utils/patient.utils');

const register = async (req, res, next) => {
  try {
    const { full_name, phone, password } = req.body;

    if (!full_name || !phone || !password)
      return R.badRequest(res, 'Vui lòng điền đầy đủ họ tên, số điện thoại và mật khẩu');

    if (!/^(0[35789][0-9]{8})$/.test(phone))
      return R.badRequest(res, 'Số điện thoại không hợp lệ');

    if (password.length < 6)
      return R.badRequest(res, 'Mật khẩu phải có ít nhất 6 ký tự');

    if (await UserModel.isPhoneTaken(phone))
      return R.conflict(res, 'Số điện thoại đã được đăng ký');

    const hashed = await hashPassword(password);
    const user   = await UserModel.create({ full_name, phone, password: hashed, role: 'patient' });

    const token = signToken({ id: user.id, role: user.role, name: user.full_name });
    return R.created(res, { token, user: enrichPatientUser(user) }, 'Đăng ký tài khoản thành công');
  } catch (err) { next(err); }
};

const login = async (req, res, next) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password)
      return R.badRequest(res, 'Vui lòng nhập số điện thoại và mật khẩu');

    const user = await UserModel.findByPhone(phone, true);
    if (!user)
      return R.unauthorized(res, 'Số điện thoại hoặc mật khẩu không đúng');

    if (user.status === 'banned')
      return R.forbidden(res, 'Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên');

    if (user.status === 'inactive')
      return R.forbidden(res, 'Tài khoản chưa được kích hoạt');

    const isMatch = await comparePassword(password, user.password);
    if (!isMatch)
      return R.unauthorized(res, 'Số điện thoại hoặc mật khẩu không đúng');

    const { password: _pw, ...safeUser } = user;
    const enrichedUser = enrichPatientUser(safeUser);

    let doctorInfo = null;
    if (user.role === 'doctor') {
      doctorInfo = await DoctorModel.findByUserId(user.id);
    }

    const tokenPayload = { id: user.id, role: user.role, name: user.full_name };
    if (doctorInfo) tokenPayload.doctor_id = doctorInfo.id;

    const token = signToken(tokenPayload);

    return R.success(res, {
      token,
      user: enrichedUser,
      doctor: doctorInfo
    }, 'Đăng nhập thành công');
  } catch (err) { next(err); }
};

const getMe = async (req, res, next) => {
  try {
    const user = await UserModel.findById(req.user.id);
    if (!user) return R.notFound(res, 'Không tìm thấy tài khoản');

    let doctorInfo = null;
    if (user.role === 'doctor') {
      doctorInfo = await DoctorModel.findByUserId(user.id);
    }

    const payload = { user: enrichPatientUser(user), doctor: doctorInfo };
    if (doctorInfo) payload.doctor_id = doctorInfo.id;

    return R.success(res, payload);
  } catch (err) { next(err); }
};

const changePassword = async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password)
      return R.badRequest(res, 'Vui lòng nhập mật khẩu hiện tại và mật khẩu mới');

    if (new_password.length < 6)
      return R.badRequest(res, 'Mật khẩu mới phải có ít nhất 6 ký tự');

    if (current_password === new_password)
      return R.badRequest(res, 'Mật khẩu mới phải khác mật khẩu hiện tại');

    const storedPassword = await UserModel.findPasswordById(req.user.id);
    if (!storedPassword) return R.notFound(res, 'Không tìm thấy tài khoản');

    const isMatch = await comparePassword(current_password, storedPassword);
    if (!isMatch)
      return R.badRequest(res, 'Mật khẩu hiện tại không đúng');

    const hashed = await hashPassword(new_password);
    await UserModel.updatePassword(req.user.id, hashed);

    return R.success(res, null, 'Đổi mật khẩu thành công');
  } catch (err) { next(err); }
};

module.exports = { register, login, getMe, changePassword };