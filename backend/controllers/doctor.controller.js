const DoctorModel  = require('../models/doctor.model');
const UserModel    = require('../models/user.model');
const { hashPassword } = require('../utils/hash.utils');
const R = require('../utils/response.utils');
const { isValidDate } = require('../utils/date.utils');

const VALID_TITLES = ['bs', 'ths_cki', 'ts_ckii', 'pgs', 'gs'];

const getAll = async (req, res, next) => {
  try {
    const { department_id, title, status, search, limit = 20, offset = 0 } = req.query;
    const result = await DoctorModel.findAll({
      department_id: department_id ? Number(department_id) : null,
      title,
      status: status === 'all' ? null : (status || 'active'),
      search,
      limit:  Number(limit),
      offset: Number(offset)
    });
    return R.success(res, result);
  } catch (err) { next(err); }
};

const getById = async (req, res, next) => {
  try {
    const doctor = await DoctorModel.getDoctorDetails(req.params.id);
    if (!doctor) return R.notFound(res, 'Không tìm thấy bác sĩ');
    return R.success(res, { doctor });
  } catch (err) { next(err); }
};

const getByDepartment = async (req, res, next) => {
  try {
    const doctors = await DoctorModel.findByDepartment(req.params.deptId, 'active');
    return R.success(res, { doctors });
  } catch (err) { next(err); }
};

const getByTitle = async (req, res, next) => {
  try {
    const { title } = req.params;
    if (!VALID_TITLES.includes(title))
      return R.badRequest(res, 'Cấp bậc bác sĩ không hợp lệ');

    const doctors = await DoctorModel.findByTitle(title, 'active');
    return R.success(res, { doctors });
  } catch (err) { next(err); }
};

const getAvailableSlots = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { date } = req.query;

    if (!date) return R.badRequest(res, 'Vui lòng chọn ngày khám');
    if (!isValidDate(date)) return R.badRequest(res, 'Ngày khám không hợp lệ');

    const queryDate = new Date(date);
    const today     = new Date(); today.setHours(0, 0, 0, 0);
    if (queryDate < today) return R.badRequest(res, 'Không thể đặt lịch cho ngày đã qua');

    const dayOfWeek = queryDate.getDay();
    if (dayOfWeek === 0) return R.success(res, { slots: [], message: 'Chủ nhật bệnh viện không làm việc' });

    const ALL_SLOTS = [
      '07:30','08:00','08:30','09:00','09:30','10:00','10:30','11:00',
      '13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00'
    ];

    const doctor = await DoctorModel.findById(id);
    if (!doctor || doctor.status !== 'active')
      return R.notFound(res, 'Không tìm thấy bác sĩ');

    const bookedSlots = await DoctorModel.getBookedSlots(id, date);
    const slots = ALL_SLOTS.map(slot => ({
      time:      slot,
      available: !bookedSlots.includes(slot)
    }));

    return R.success(res, { doctor_id: Number(id), date, slots });
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  const conn = await require('../config/db').getConnection();
  try {
    const {
      full_name, phone, password, id_card, dob, gender,
      department_id, title, specialization, bio, experience_years, consultation_fee
    } = req.body;

    if (!full_name || !phone || !password || !department_id || !title)
      return R.badRequest(res, 'Thiếu thông tin bắt buộc: họ tên, SĐT, mật khẩu, khoa, cấp bậc');

    if (!VALID_TITLES.includes(title))
      return R.badRequest(res, 'Cấp bậc bác sĩ không hợp lệ');

    if (await UserModel.isPhoneTaken(phone))
      return R.conflict(res, 'Số điện thoại đã được đăng ký');

    if (id_card && await UserModel.isIdCardTaken(id_card))
      return R.conflict(res, 'CCCD đã được đăng ký');

    const hashed     = await hashPassword(password);
    const avatarPath = req.file ? `/uploads/avatars/${req.file.filename}` : null;

    await conn.beginTransaction();

    const [uResult] = await conn.execute(
      `INSERT INTO users (full_name, phone, password, role, id_card, dob, gender, avatar, status)
       VALUES (?, ?, ?, 'doctor', ?, ?, ?, ?, 'active')`,
      [full_name, phone, hashed, id_card || null, dob || null, gender || null, avatarPath]
    );
    const newUserId = uResult.insertId;

    const [dResult] = await conn.execute(
      `INSERT INTO doctors (user_id, department_id, title, specialization, bio, experience_years, consultation_fee, avatar)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [newUserId, Number(department_id), title, specialization || null, bio || null,
       Number(experience_years) || 0, Number(consultation_fee) || 0, avatarPath]
    );

    await conn.commit();

    const doctor = await DoctorModel.findById(dResult.insertId);
    return R.created(res, { doctor }, 'Thêm bác sĩ thành công');
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const doctor  = await DoctorModel.findById(id);
    if (!doctor) return R.notFound(res, 'Không tìm thấy bác sĩ');

    const { department_id, title, specialization, bio, experience_years, consultation_fee, status,
            full_name, id_card, dob, gender, address } = req.body;

    if (title && !VALID_TITLES.includes(title))
      return R.badRequest(res, 'Cấp bậc bác sĩ không hợp lệ');

    if (id_card && await UserModel.isIdCardTaken(id_card, doctor.user_id))
      return R.conflict(res, 'CCCD đã được đăng ký bởi tài khoản khác');

    const avatarPath = req.file ? `/uploads/avatars/${req.file.filename}` : undefined;

    await UserModel.updateProfile(doctor.user_id, {
      full_name, id_card, dob, gender, address,
      ...(avatarPath && { avatar: avatarPath })
    });

    const updated = await DoctorModel.update(id, {
      department_id: department_id ? Number(department_id) : undefined,
      title, specialization, bio,
      experience_years: experience_years !== undefined ? Number(experience_years) : undefined,
      consultation_fee: consultation_fee !== undefined ? Number(consultation_fee) : undefined,
      status,
      ...(avatarPath && { avatar: avatarPath })
    });

    return R.success(res, { doctor: updated }, 'Cập nhật thông tin bác sĩ thành công');
  } catch (err) { next(err); }
};

const getMyProfile = async (req, res, next) => {
  try {
    const doctor = await DoctorModel.findByUserId(req.user.id);
    if (!doctor) return R.notFound(res, 'Không tìm thấy hồ sơ bác sĩ');
    return R.success(res, { doctor });
  } catch (err) { next(err); }
};

const updateMyProfile = async (req, res, next) => {
  try {
    const doctor = await DoctorModel.findByUserId(req.user.id);
    if (!doctor) return R.notFound(res, 'Không tìm thấy hồ sơ bác sĩ');

    const { full_name, id_card, dob, gender, address, bio, specialization, experience_years, consultation_fee } = req.body;

    if (id_card && await UserModel.isIdCardTaken(id_card, doctor.user_id))
      return R.conflict(res, 'CCCD đã được đăng ký bởi tài khoản khác');

    const avatarPath = req.file ? `/uploads/avatars/${req.file.filename}` : undefined;

    await UserModel.updateProfile(doctor.user_id, {
      full_name, id_card, dob, gender, address,
      ...(avatarPath && { avatar: avatarPath })
    });

    const updated = await DoctorModel.update(doctor.id, {
      bio, specialization,
      experience_years: experience_years !== undefined ? Number(experience_years) : undefined,
      consultation_fee: consultation_fee !== undefined ? Number(consultation_fee) : undefined,
      ...(avatarPath && { avatar: avatarPath })
    });

    const fresh = await DoctorModel.findByUserId(req.user.id);
    return R.success(res, { doctor: fresh }, 'Cập nhật hồ sơ thành công');
  } catch (err) { next(err); }
};

module.exports = {
  getAll, getById, getByDepartment, getByTitle, getAvailableSlots,
  create, update, getMyProfile, updateMyProfile
};