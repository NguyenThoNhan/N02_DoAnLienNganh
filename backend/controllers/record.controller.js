const HealthRecordModel = require('../models/healthRecord.model');
const AppointmentModel  = require('../models/appointment.model');
const DoctorModel       = require('../models/doctor.model');
const PaymentSession    = require('../services/paymentSession.service');
const { getPublicBaseUrl } = require('../utils/network.utils');
const { PORT } = require('../config/env');
const R = require('../utils/response.utils');

// Bệnh nhân xem lịch sử khám của chính mình
const getMyHistory = async (req, res, next) => {
  try {
    const { limit = 20, offset = 0 } = req.query;
    const result = await HealthRecordModel.getHistoryByPatient(
      req.user.id, { limit: Number(limit), offset: Number(offset) }
    );
    return R.success(res, result);
  } catch (err) { next(err); }
};

// Bác sĩ / Admin xem lịch sử khám của 1 bệnh nhân bất kỳ
const getPatientHistory = async (req, res, next) => {
  try {
    const { patientId } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    const result = await HealthRecordModel.getHistoryByPatient(
      Number(patientId), { limit: Number(limit), offset: Number(offset) }
    );
    return R.success(res, result);
  } catch (err) { next(err); }
};

// Chi tiết 1 sổ sức khỏe: chẩn đoán + đơn thuốc + kết quả xét nghiệm
const getRecordDetail = async (req, res, next) => {
  try {
    const { id } = req.params;
    const record = await HealthRecordModel.getDetailWithRelations(Number(id));
    if (!record) return R.notFound(res, 'Không tìm thấy sổ sức khỏe');

    // Kiểm tra quyền truy cập
    const isPatientOwner = req.user.role === 'patient'  && record.patient_id === req.user.id;
    const isAdmin        = req.user.role === 'admin';

    if (req.user.role === 'doctor') {
      const doctor = await DoctorModel.findByUserId(req.user.id);
      if (!doctor || doctor.id !== record.doctor_id)
        return R.forbidden(res, 'Bạn không phụ trách ca khám này');
    } else if (!isPatientOwner && !isAdmin) {
      return R.forbidden(res, 'Bạn không có quyền xem sổ sức khỏe này');
    }

    return R.success(res, { health_record: record });
  } catch (err) { next(err); }
};

// Lấy sổ sức khỏe theo appointment_id
const getRecordByAppointment = async (req, res, next) => {
  try {
    const { appointmentId } = req.params;
    const appointment = await AppointmentModel.findById(Number(appointmentId));
    if (!appointment) return R.notFound(res, 'Không tìm thấy lịch hẹn');

    const isPatientOwner = req.user.role === 'patient'  && appointment.patient_id === req.user.id;
    const isAdmin        = req.user.role === 'admin';

    if (req.user.role === 'doctor') {
      const doctor = await DoctorModel.findByUserId(req.user.id);
      if (!doctor || doctor.id !== appointment.doctor_id)
        return R.forbidden(res, 'Bạn không phụ trách ca khám này');
    } else if (!isPatientOwner && !isAdmin) {
      return R.forbidden(res, 'Bạn không có quyền xem thông tin này');
    }

    const record = await HealthRecordModel.findByAppointment(Number(appointmentId));
    if (!record) return R.notFound(res, 'Sổ sức khỏe chưa được tạo cho ca khám này');

    const detail = await HealthRecordModel.getDetailWithRelations(record.id);
    return R.success(res, { health_record: detail });
  } catch (err) { next(err); }
};

// Bệnh nhân cập nhật thanh toán (giả lập QR)
const updatePayment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const record = await HealthRecordModel.findById(Number(id));
    if (!record) return R.notFound(res, 'Không tìm thấy sổ sức khỏe');

    const isOwner = req.user.role === 'patient' && record.patient_id === req.user.id;
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) return R.forbidden(res, 'Bạn không có quyền thực hiện thanh toán này');

    if (record.payment_status === 'paid')
      return R.badRequest(res, 'Ca khám này đã được thanh toán trước đó');

    const { payment_method = 'qr_code' } = req.body;
    const updated = await HealthRecordModel.updatePayment(record.id, { payment_status: 'paid', payment_method });
    if (req.body?.pay_token) PaymentSession.markPaid(req.body.pay_token);
    return R.success(res, { health_record: updated }, 'Thanh toán thành công');
  } catch (err) { next(err); }
};

// Tạo dữ liệu QR thanh toán
const getPaymentQR = async (req, res, next) => {
  try {
    const { id } = req.params;
    const record = await HealthRecordModel.findById(Number(id));
    if (!record) return R.notFound(res, 'Không tìm thấy sổ sức khỏe');

    const isOwner = req.user.role === 'patient' && record.patient_id === req.user.id;
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) return R.forbidden(res, 'Bạn không có quyền xem thông tin thanh toán này');

    if (record.payment_status === 'paid')
      return R.success(res, { already_paid: true, payment_status: 'paid' }, 'Ca khám đã được thanh toán');

    const total = parseFloat(record.total_amount) || 0;
    const consultFee = parseFloat(record.consultation_fee) || 0;
    const description = `THANHTOAN HS${record.id}`.toUpperCase();

    const token = PaymentSession.create(record.id, record.patient_id);
    const baseUrl = getPublicBaseUrl(req, PORT);
    const mobilePayUrl = `${baseUrl}/pages/patient/pay-mobile.html?token=${token}`;

    const qrPayload = [
      '000201',
      '010212',
      '3854',
      `0010A000000727`,
      `01270006BIDV`,
      `01100314002888888`,
      '0208QRIBFTTA',
      `5303704`,
      `54${String(total).length.toString().padStart(2, '0')}${total}`,
      `5802VN`,
      `62${String(description.length + 4).padStart(2, '0')}08${String(description.length).padStart(2, '0')}${description}`,
      '6304'
    ].join('');

    const qrData = {
      bank_id: 'BIDV',
      account_no: '31410002888888',
      account_name: 'BENH VIEN DA KHOA TECHCARE',
      amount: total,
      description,
      record_id: record.id,
      total_amount: total,
      pay_token: token,
      mobile_pay_url: mobilePayUrl,
      lan_base_url: baseUrl,
      qr_image_url: `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(mobilePayUrl)}`,
      qr_payload: qrPayload,
      breakdown: {
        consultation_fee: consultFee,
        lab_fee: parseFloat(record.total_lab_fee) || 0,
        drug_fee: parseFloat(record.total_drug_fee) || 0
      }
    };

    return R.success(res, { qr_data: qrData, payment_status: record.payment_status });
  } catch (err) { next(err); }
};

const getPaymentStatus = async (req, res, next) => {
  try {
    const record = await HealthRecordModel.findById(Number(req.params.id));
    if (!record) return R.notFound(res, 'Không tìm thấy hồ sơ');

    const isOwner = req.user.role === 'patient' && record.patient_id === req.user.id;
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) return R.forbidden(res, 'Không có quyền');

    const sessionPaid = PaymentSession.isPaid(record.id);
    return R.success(res, {
      record_id: record.id,
      payment_status: record.payment_status,
      just_paid: sessionPaid && record.payment_status === 'paid'
    });
  } catch (err) { next(err); }
};

module.exports = {
  getMyHistory, getPatientHistory,
  getRecordDetail, getRecordByAppointment,
  updatePayment, getPaymentQR, getPaymentStatus
};