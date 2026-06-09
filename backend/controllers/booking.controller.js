const db                  = require('../config/db');
const AppointmentModel    = require('../models/appointment.model');
const HealthRecordModel   = require('../models/healthRecord.model');
const DoctorModel         = require('../models/doctor.model');
const ServiceModel        = require('../models/service.model');
const UserModel           = require('../models/user.model');
const { getProfileCompleteness } = require('../utils/patient.utils');
const { isValidDate, isValidTimeSlot, isFutureDate } = require('../utils/date.utils');
const { resolveDoctorId } = require('../utils/auth.utils');
const R = require('../utils/response.utils');

const VALID_SERVICE_TYPES = ['doctor', 'request', 'pgs', 'ths_cki', 'ts_ckii', 'request_24_7'];
const SUBJECT_LABELS = {
  doctor: 'Dịch vụ',
  request: 'Dịch vụ',
  pgs: 'Dịch vụ',
  ths_cki: 'Dịch vụ',
  ts_ckii: 'Dịch vụ',
  request_24_7: 'Dịch vụ'
};

const ROOM_BY_DEPARTMENT = {
  'Khoa Tim mạch': { room: 'P.TM109', floor: 'Tầng 1 - Nhà A2' },
  'Khoa Nội Tổng hợp': { room: 'P.NT201', floor: 'Tầng 2 - Nhà A2' },
  'Khoa Tiêu hóa': { room: 'P.TH205', floor: 'Tầng 2 - Nhà A2' },
  'Khoa Thần kinh': { room: 'P.TK110', floor: 'Tầng 1 - Nhà A3' },
  'Khoa Cơ xương khớp': { room: 'P.CX102', floor: 'Tầng 1 - Nhà A3' },
  'Khoa Hô hấp': { room: 'P.HH108', floor: 'Tầng 1 - Nhà A2' },
  'Khoa Nhi': { room: 'P.NHI301', floor: 'Tầng 3 - Nhà A2' },
  'Khoa Da liễu': { room: 'P.DL110', floor: 'Tầng 1 - Nhà A2' }
};

const formatPatientCode = (id) => String(2000000000 + (Number(id) || 0)).slice(0, 10);
const calcAge = (dob) => {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d)) return null;
  const t = new Date();
  let age = t.getFullYear() - d.getFullYear();
  const m = t.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && t.getDate() < d.getDate())) age -= 1;
  return age;
};

const buildBookingSlip = ({ appointment, patientUser }) => {
  const loc = ROOM_BY_DEPARTMENT[appointment.department_name] || { room: 'Phòng tiếp đón', floor: 'Tầng 1 - Nhà A1' };
  return {
    hospital_name: 'BỆNH VIỆN ĐA KHOA TECHCARE',
    hospital_branch: 'CƠ SỞ Y TẾ TECHCARE',
    department_name: appointment.department_name || 'Khoa khám bệnh',
    appointment_date: appointment.appointment_date,
    time_slot: appointment.time_slot,
    queue_number: ((appointment.id % 80) + 1),
    patient_code: formatPatientCode(appointment.patient_id),
    subject: SUBJECT_LABELS[appointment.service_type] || 'Dịch vụ',
    patient_name: patientUser.full_name,
    patient_gender: patientUser.gender,
    patient_age: calcAge(patientUser.dob),
    patient_id_card: patientUser.id_card,
    patient_address: patientUser.address,
    doctor_name: appointment.doctor_name,
    doctor_title: appointment.doctor_title,
    room: loc.room,
    floor: loc.floor
  };
};

const createBooking = async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    const { doctor_id, service_type, appointment_date, time_slot, reason } = req.body;
    const patient_id = req.user.id;

    const patientUser = await UserModel.findById(patient_id);
    if (!patientUser) return R.notFound(res, 'Không tìm thấy tài khoản bệnh nhân');
    const { complete, missing } = getProfileCompleteness(patientUser);
    if (!complete) {
      return R.badRequest(
        res,
        `Vui lòng cập nhật đầy đủ hồ sơ cá nhân trước khi đặt lịch (thiếu: ${missing.join(', ')}).`
      );
    }

    // ── Validate input ──────────────────────────────────────────
    if (!doctor_id || !service_type || !appointment_date || !time_slot)
      return R.badRequest(res, 'Thiếu thông tin: bác sĩ, loại dịch vụ, ngày khám, khung giờ');

    if (!VALID_SERVICE_TYPES.includes(service_type))
      return R.badRequest(res, 'Loại dịch vụ không hợp lệ');

    if (!isValidDate(appointment_date))
      return R.badRequest(res, 'Ngày khám không hợp lệ');

    if (!isFutureDate(appointment_date))
      return R.badRequest(res, 'Ngày khám phải từ hôm nay trở đi');

    if (!isValidTimeSlot(time_slot))
      return R.badRequest(res, 'Khung giờ không hợp lệ (định dạng HH:MM)');

    const queryDate = new Date(appointment_date);
    if (queryDate.getDay() === 0)
      return R.badRequest(res, 'Bệnh viện không làm việc vào Chủ nhật');

    // ── Kiểm tra bác sĩ tồn tại & đang hoạt động ───────────────
    const doctor = await DoctorModel.findById(doctor_id);
    if (!doctor || doctor.status !== 'active')
      return R.notFound(res, 'Không tìm thấy bác sĩ hoặc bác sĩ đã ngừng nhận lịch');

    // ── Xác định phí khám ────────────────────────────────────────
    // service_type='doctor' → dùng consultation_fee của bác sĩ đó
    // service_type khác      → tra bảng service_prices
    let consultation_fee = 0;
    if (service_type === 'doctor') {
      consultation_fee = parseFloat(doctor.consultation_fee) || 0;
    } else {
      const servicePrice = await ServiceModel.getPriceByType(service_type);
      if (!servicePrice)
        return R.badRequest(res, 'Loại dịch vụ chưa được cấu hình giá. Vui lòng liên hệ bệnh viện');
      consultation_fee = parseFloat(servicePrice.price) || 0;
    }

    // ── Chống trùng lịch (Concurrency check) ────────────────────
    const isAvailable = await AppointmentModel.checkAvailability(doctor_id, appointment_date, time_slot);
    if (!isAvailable)
      return R.conflict(res, 'Khung giờ này đã có người đặt. Vui lòng chọn giờ khác');

    // ── Kiểm tra bệnh nhân không trùng lịch chính mình ──────────
    const myAppointments = await AppointmentModel.findByPatient(patient_id, {
      status: null, limit: 200, offset: 0
    });
    const selfConflict = myAppointments.some(
      a => a.appointment_date?.toString().slice(0,10) === appointment_date &&
           a.time_slot === time_slot &&
           !['cancelled'].includes(a.status)
    );
    if (selfConflict)
      return R.conflict(res, 'Bạn đã có lịch khám vào khung giờ này');

    // ── Transaction: tạo Appointment + HealthRecord ──────────────
    await conn.beginTransaction();

    const appointmentId = await AppointmentModel.create(
      { patient_id, doctor_id: Number(doctor_id), service_type, appointment_date, time_slot, reason, consultation_fee },
      conn
    );

    await HealthRecordModel.create(
      { appointment_id: appointmentId, patient_id, doctor_id: Number(doctor_id) },
      conn
    );

    await conn.commit();

    const appointment = await AppointmentModel.findById(appointmentId);
    const booking_slip = buildBookingSlip({ appointment, patientUser });
    return R.created(res, { appointment, booking_slip }, 'Đặt lịch khám thành công');

  } catch (err) {
    await conn.rollback();
    // Bắt lỗi duplicate key từ UNIQUE constraint (doctor_id, date, slot)
    if (err.code === 'ER_DUP_ENTRY')
      return R.conflict(res, 'Khung giờ này vừa được đặt bởi người khác. Vui lòng chọn giờ khác');
    next(err);
  } finally {
    conn.release();
  }
};

const getMyAppointments = async (req, res, next) => {
  try {
    const { status, limit = 20, offset = 0 } = req.query;
    const appointments = await AppointmentModel.findByPatient(req.user.id, {
      status,
      limit:  Number(limit),
      offset: Number(offset)
    });
    return R.success(res, { appointments });
  } catch (err) { next(err); }
};

const getAppointmentDetail = async (req, res, next) => {
  try {
    const appointment = await AppointmentModel.findById(req.params.id);
    if (!appointment) return R.notFound(res, 'Không tìm thấy lịch hẹn');

    // Chỉ cho phép chủ lịch, bác sĩ liên quan, hoặc admin xem
    const isPatientOwner = req.user.role === 'patient' && appointment.patient_id === req.user.id;
    const doctorId = await resolveDoctorId(req.user);
    const isDoctorOwner  = req.user.role === 'doctor' && doctorId === appointment.doctor_id;
    const isAdmin        = req.user.role === 'admin';

    if (!isPatientOwner && !isDoctorOwner && !isAdmin)
      return R.forbidden(res, 'Bạn không có quyền xem lịch hẹn này');

    return R.success(res, { appointment });
  } catch (err) { next(err); }
};

const cancelAppointment = async (req, res, next) => {
  try {
    const appointment = await AppointmentModel.findById(req.params.id);
    if (!appointment) return R.notFound(res, 'Không tìm thấy lịch hẹn');

    // Chỉ bệnh nhân chủ lịch hoặc admin mới được hủy
    const isOwner = req.user.role === 'patient' && appointment.patient_id === req.user.id;
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin)
      return R.forbidden(res, 'Bạn không có quyền hủy lịch hẹn này');

    if (['completed', 'cancelled'].includes(appointment.status))
      return R.badRequest(res, `Không thể hủy lịch hẹn ở trạng thái "${appointment.status}"`);

    if (appointment.status === 'in_progress')
      return R.badRequest(res, 'Không thể hủy lịch đang trong quá trình khám');

    // Kiểm tra trước giờ khám ít nhất 2 tiếng
    const appointmentDateTime = new Date(`${appointment.appointment_date}T${appointment.time_slot}:00`);
    const now = new Date();
    const diffHours = (appointmentDateTime - now) / (1000 * 60 * 60);
    if (req.user.role === 'patient' && diffHours < 2)
      return R.badRequest(res, 'Chỉ được hủy lịch trước giờ khám ít nhất 2 tiếng');

    const { reason } = req.body;
    await AppointmentModel.updateStatus(appointment.id, 'cancelled', reason || null);

    return R.success(res, null, 'Hủy lịch hẹn thành công');
  } catch (err) { next(err); }
};

const confirmAppointment = async (req, res, next) => {
  try {
    const appointment = await AppointmentModel.findById(req.params.id);
    if (!appointment) return R.notFound(res, 'Không tìm thấy lịch hẹn');

    if (appointment.status !== 'pending')
      return R.badRequest(res, 'Chỉ có thể xác nhận lịch hẹn ở trạng thái chờ');

    await AppointmentModel.updateStatus(appointment.id, 'confirmed');
    const updated = await AppointmentModel.findById(appointment.id);
    return R.success(res, { appointment: updated }, 'Xác nhận lịch hẹn thành công');
  } catch (err) { next(err); }
};

const getDoctorAppointments = async (req, res, next) => {
  try {
    const doctorId = await resolveDoctorId(req.user);
    if (!doctorId) return R.notFound(res, 'Không tìm thấy hồ sơ bác sĩ');

    const { date, status, limit = 50, offset = 0 } = req.query;
    const appointments = await AppointmentModel.findByDoctor(doctorId, {
      date, status,
      limit: Number(limit),
      offset: Number(offset)
    });
    return R.success(res, { appointments });
  } catch (err) { next(err); }
};

const getAdminList = async (req, res, next) => {
  try {
    const { date_from, date_to, status, doctor_id, limit = 30, offset = 0 } = req.query;
    const result = await AppointmentModel.getAdminList({
      date_from, date_to, status,
      doctor_id: doctor_id ? Number(doctor_id) : null,
      limit:  Number(limit),
      offset: Number(offset)
    });
    return R.success(res, result);
  } catch (err) { next(err); }
};

module.exports = {
  createBooking,
  getMyAppointments,
  getDoctorAppointments,
  getAppointmentDetail,
  cancelAppointment,
  confirmAppointment,
  getAdminList
};