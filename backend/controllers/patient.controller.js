const UserModel = require('../models/user.model');
const R = require('../utils/response.utils');
const { enrichPatientUser, getProfileCompleteness } = require('../utils/patient.utils');

const getProfile = async (req, res, next) => {
  try {
    const user = await UserModel.findById(req.user.id);
    if (!user) return R.notFound(res, 'Không tìm thấy thông tin người dùng');
    const enriched = enrichPatientUser(user);
    const { complete, missing, missing_fields } = getProfileCompleteness(user);
    return R.success(res, {
      user: enriched,
      profile_complete: complete,
      profile_missing: missing,
      profile_missing_fields: missing_fields
    });
  } catch (err) { next(err); }
};

const updateProfile = async (req, res, next) => {
  try {
    const { full_name, id_card, dob, gender, address } = req.body;
    const userId = req.user.id;

    if (id_card) {
      if (!/^\d{9}$|^\d{12}$/.test(id_card))
        return R.badRequest(res, 'CCCD/CMND không hợp lệ (9 hoặc 12 số)');

      if (await UserModel.isIdCardTaken(id_card, userId))
        return R.conflict(res, 'CCCD/CMND đã được đăng ký bởi tài khoản khác');
    }

    if (dob) {
      const dobDate = new Date(dob);
      if (isNaN(dobDate.getTime()))
        return R.badRequest(res, 'Ngày sinh không hợp lệ');
      if (dobDate >= new Date())
        return R.badRequest(res, 'Ngày sinh phải nhỏ hơn ngày hiện tại');
    }

    if (gender && !['male', 'female', 'other'].includes(gender))
      return R.badRequest(res, 'Giới tính không hợp lệ');

    const avatarPath = req.file ? `/uploads/avatars/${req.file.filename}` : undefined;

    const updated = await UserModel.updateProfile(userId, {
      full_name, id_card, dob, gender, address,
      ...(avatarPath && { avatar: avatarPath })
    });

    return R.success(res, { user: enrichPatientUser(updated) }, 'Cập nhật hồ sơ thành công');
  } catch (err) { next(err); }
};

const getAllPatients = async (req, res, next) => {
  try {
    const { search, status, limit = 20, offset = 0 } = req.query;
    const result = await UserModel.getAll({
      role: 'patient', status, search,
      limit: Number(limit), offset: Number(offset)
    });
    return R.success(res, result);
  } catch (err) { next(err); }
};

const getPatientById = async (req, res, next) => {
  try {
    const targetId = Number(req.params.id);
    const isOwner  = req.user.id === targetId;
    const isAdmin  = req.user.role === 'admin';
    const isDoctor = req.user.role === 'doctor';

    if (!isOwner && !isAdmin && !isDoctor)
      return R.forbidden(res, 'Bạn không có quyền xem thông tin này');

    const user = await UserModel.findById(targetId);
    if (!user || user.role !== 'patient')
      return R.notFound(res, 'Không tìm thấy bệnh nhân');

    return R.success(res, { user: enrichPatientUser(user) });
  } catch (err) { next(err); }
};

module.exports = { getProfile, updateProfile, getAllPatients, getPatientById };