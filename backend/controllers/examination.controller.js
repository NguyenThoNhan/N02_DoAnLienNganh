const db                = require('../config/db');
const AppointmentModel  = require('../models/appointment.model');
const HealthRecordModel = require('../models/healthRecord.model');
const LabResultModel    = require('../models/labResult.model');
const PrescriptionModel = require('../models/prescription.model');
const DoctorModel       = require('../models/doctor.model');
const DrugModel         = require('../models/drug.model');
const R = require('../utils/response.utils');
const { buildInstructionSlip } = require('../utils/labGuide.utils');
const labAi = require('../ai/labAi');

const _getDoctorOrFail = async (userId, res) => {
  const doctor = await DoctorModel.findByUserId(userId);
  if (!doctor) { R.forbidden(res, 'Tài khoản không có hồ sơ bác sĩ'); return null; }
  return doctor;
};

const _getRecordAndVerifyDoctor = async (recordId, doctorId, res) => {
  const record = await HealthRecordModel.findById(recordId);
  if (!record) { R.notFound(res, 'Không tìm thấy sổ sức khỏe'); return null; }
  if (record.doctor_id !== doctorId) { R.forbidden(res, 'Bạn không phụ trách ca khám này'); return null; }
  return record;
};

// Lấy danh sách ca khám hôm nay của bác sĩ
const getTodayQueue = async (req, res, next) => {
  try {
    const doctor = await _getDoctorOrFail(req.user.id, res);
    if (!doctor) return;
    const appointments = await AppointmentModel.findTodayByDoctor(doctor.id);
    return R.success(res, { appointments });
  } catch (err) { next(err); }
};

// Lấy danh sách ca theo ngày (bác sĩ)
const getQueueByDate = async (req, res, next) => {
  try {
    const doctor = await _getDoctorOrFail(req.user.id, res);
    if (!doctor) return;
    const { date, status } = req.query;
    const appointments = await AppointmentModel.findByDoctor(doctor.id, { date, status });
    return R.success(res, { appointments });
  } catch (err) { next(err); }
};

// Bác sĩ tiếp nhận bệnh nhân → in_progress + tạo health_record
const acceptPatient = async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    const doctor = await _getDoctorOrFail(req.user.id, res);
    if (!doctor) { conn.release(); return; }

    const appointment = await AppointmentModel.findById(req.params.appointmentId);
    if (!appointment) { conn.release(); return R.notFound(res, 'Không tìm thấy lịch hẹn'); }
    if (appointment.doctor_id !== doctor.id) { conn.release(); return R.forbidden(res, 'Ca khám này không thuộc bác sĩ của bạn'); }
    if (!['pending', 'confirmed'].includes(appointment.status)) {
      conn.release();
      return R.badRequest(res, `Không thể tiếp nhận ca ở trạng thái "${appointment.status}"`);
    }

    await conn.beginTransaction();

    // Cập nhật trạng thái lịch hẹn → in_progress
    await AppointmentModel.updateStatus(appointment.id, 'in_progress', null, conn);

    // Tạo health_record nếu chưa tồn tại
    let record = await HealthRecordModel.findByAppointment(appointment.id);
    if (!record) {
      const recordId = await HealthRecordModel.create({
        appointment_id: appointment.id,
        patient_id:     appointment.patient_id,
        doctor_id:      doctor.id
      }, conn);
      record = await HealthRecordModel.findById(recordId);
    }

    await conn.commit();

    const updatedAppointment = await AppointmentModel.findById(appointment.id);
    return R.success(res, { appointment: updatedAppointment, health_record: record },
      'Đã tiếp nhận bệnh nhân. Ca khám bắt đầu');
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

// Cập nhật thông tin khám: triệu chứng, sinh hiệu, chẩn đoán
const updateExamination = async (req, res, next) => {
  try {
    const doctor = await _getDoctorOrFail(req.user.id, res);
    if (!doctor) return;

    const record = await _getRecordAndVerifyDoctor(req.params.recordId, doctor.id, res);
    if (!record) return;
    if (record.status === 'completed') return R.badRequest(res, 'Ca khám đã hoàn thành, không thể chỉnh sửa');

    const { symptoms, diagnosis, diagnosis_note, blood_pressure, heart_rate, temperature, weight, height, follow_up_date } = req.body;

    const updated = await HealthRecordModel.updateMedicalInfo(record.id, {
      symptoms, diagnosis, diagnosis_note,
      blood_pressure, heart_rate, temperature,
      weight, height, follow_up_date
    });
    return R.success(res, { health_record: updated }, 'Cập nhật thông tin khám thành công');
  } catch (err) { next(err); }
};

// Chỉ định xét nghiệm
const orderLabTests = async (req, res, next) => {
  try {
    const doctor = await _getDoctorOrFail(req.user.id, res);
    if (!doctor) return;

    const record = await _getRecordAndVerifyDoctor(req.params.recordId, doctor.id, res);
    if (!record) return;
    if (record.status === 'completed') return R.badRequest(res, 'Ca khám đã hoàn thành');

    const { test_ids } = req.body;
    if (!Array.isArray(test_ids) || test_ids.length === 0)
      return R.badRequest(res, 'Vui lòng chọn ít nhất một loại xét nghiệm');

    const inserted = await LabResultModel.orderTests(record.id, req.user.id, test_ids);
    if (!inserted.length)
      return R.badRequest(res, 'Không chỉ định được xét nghiệm nào (kiểm tra danh mục XN)');

    const doctorProfile = await DoctorModel.findByUserId(req.user.id);
    let appt = null;
    if (record.appointment_id) {
      appt = await AppointmentModel.findById(record.appointment_id);
    }
    const queueNumber = appt?.id ? ((appt.id % 80) + 1) : ((record.id % 80) + 1);
    const instruction_slip = buildInstructionSlip({
      record,
      appointment: appt,
      orderedTests: inserted,
      doctor: doctorProfile,
      queueNumber
    });

    const labResults = await LabResultModel.getByRecordId(record.id);
    const totals     = await HealthRecordModel.recalculateTotals(record.id);

    return R.created(res, {
      lab_results: labResults,
      totals,
      ordered_count: inserted.length,
      instruction_slip
    }, `Đã chỉ định ${inserted.length} xét nghiệm. In phiếu hướng dẫn cho bệnh nhân.`);
  } catch (err) { next(err); }
};

// Upload ảnh kết quả xét nghiệm
const uploadLabResult = async (req, res, next) => {
  try {
    const doctor = await _getDoctorOrFail(req.user.id, res);
    if (!doctor) return;

    const labResult = await LabResultModel.findById(req.params.labResultId);
    if (!labResult) return R.notFound(res, 'Không tìm thấy kết quả xét nghiệm');

    const record = await HealthRecordModel.findById(labResult.health_record_id);
    if (!record || record.doctor_id !== doctor.id) return R.forbidden(res, 'Bạn không có quyền cập nhật kết quả này');

    const { result_text } = req.body;
    const result_image = req.file ? `/uploads/lab-results/${req.file.filename}` : undefined;

    if (!result_text && !result_image)
      return R.badRequest(res, 'Vui lòng cung cấp kết quả văn bản hoặc ảnh');

    const updated = await LabResultModel.uploadResult(labResult.id, { result_text, result_image });
    await HealthRecordModel.recalculateTotals(record.id);
    return R.success(res, { lab_result: updated }, 'Cập nhật kết quả xét nghiệm thành công');
  } catch (err) { next(err); }
};

// Lấy danh sách xét nghiệm của 1 ca khám
const getLabResults = async (req, res, next) => {
  try {
    const doctor = await _getDoctorOrFail(req.user.id, res);
    if (!doctor) return;

    const record = await _getRecordAndVerifyDoctor(req.params.recordId, doctor.id, res);
    if (!record) return;

    const labResults  = await LabResultModel.getByRecordId(record.id);
    const allTests    = await LabResultModel.getAllTests();
    return R.success(res, { lab_results: labResults, available_tests: allTests });
  } catch (err) { next(err); }
};

// Kê đơn thuốc
const savePrescription = async (req, res, next) => {
  try {
    const doctor = await _getDoctorOrFail(req.user.id, res);
    if (!doctor) return;

    const record = await _getRecordAndVerifyDoctor(req.params.recordId, doctor.id, res);
    if (!record) return;
    if (record.status === 'completed') return R.badRequest(res, 'Ca khám đã hoàn thành, không thể thay đổi đơn thuốc');

    const { note, items } = req.body;
    if (!Array.isArray(items) || items.length === 0)
      return R.badRequest(res, 'Đơn thuốc phải có ít nhất một loại thuốc');

    for (const [i, item] of items.entries()) {
      if (!item.drug_id)    return R.badRequest(res, `Thuốc thứ ${i + 1} thiếu drug_id`);
      if (!item.quantity || item.quantity < 1) return R.badRequest(res, `Số lượng thuốc thứ ${i + 1} không hợp lệ`);
      if (!item.unit_price || item.unit_price < 0) return R.badRequest(res, `Đơn giá thuốc thứ ${i + 1} không hợp lệ`);

      const drug = await DrugModel.findById(item.drug_id);
      if (!drug || drug.status !== 'active') return R.badRequest(res, `Thuốc ID ${item.drug_id} không tồn tại hoặc đã ngừng sử dụng`);
      if (drug.stock < item.quantity) return R.badRequest(res, `Thuốc "${drug.name}" không đủ tồn kho (còn ${drug.stock} ${drug.unit})`);
    }

    const existing = await PrescriptionModel.findByHealthRecord(record.id);
    let prescriptionId;
    if (existing) {
      await PrescriptionModel.updatePrescription(existing.id, { note }, items);
      prescriptionId = existing.id;
    } else {
      prescriptionId = await PrescriptionModel.createPrescription(
        { health_record_id: record.id, doctor_id: doctor.id, patient_id: record.patient_id, note },
        items
      );
    }

    const prescription = await PrescriptionModel.findByHealthRecord(record.id);
    const totals       = await HealthRecordModel.recalculateTotals(record.id);
    return R.success(res, { prescription, totals }, existing ? 'Cập nhật đơn thuốc thành công' : 'Kê đơn thuốc thành công');
  } catch (err) { next(err); }
};

// Gợi ý thuốc theo tên bệnh (dùng khi bác sĩ nhập chẩn đoán)
const getDrugSuggestions = async (req, res, next) => {
  try {
    const { disease_name } = req.query;
    if (!disease_name || disease_name.trim().length < 2)
      return R.badRequest(res, 'Vui lòng nhập tên bệnh để gợi ý thuốc');

    const drugs = await DrugModel.getSuggestedDrugs(disease_name.trim());
    return R.success(res, { drugs, keyword: disease_name });
  } catch (err) { next(err); }
};

// Demo: điền kết quả mẫu từ AI (heart.csv) cho XN chưa có kết quả
const fillDemoLabResults = async (req, res, next) => {
  try {
    const doctor = await _getDoctorOrFail(req.user.id, res);
    if (!doctor) return;

    const record = await _getRecordAndVerifyDoctor(req.params.recordId, doctor.id, res);
    if (!record) return;

    const trainInfo = labAi.ensureTrained();
    const analysis = labAi.predict(record, record);
    const aiInsight = labAi.buildInsight(analysis, record);

    const filled = await LabResultModel.applyDemoResults(
      record.id,
      doctor.department_code,
      (row) => labAi.buildResultText(row.test_code, row.test_name, analysis)
    );
    await HealthRecordModel.recalculateTotals(record.id);
    const labResults = await LabResultModel.getByRecordId(record.id);

    return R.success(res, {
      lab_results: labResults,
      demo_results_filled: filled,
      ai_insight: aiInsight,
      ai_model: trainInfo.meta || labAi.readMeta()
    }, filled ? `Đã điền ${filled} kết quả mẫu` : 'Không còn xét nghiệm chờ kết quả');
  } catch (err) { next(err); }
};

// Kết thúc ca khám → completed (sync cả appointments + health_records)
const finishExamination = async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    const doctor = await _getDoctorOrFail(req.user.id, res);
    if (!doctor) return;

    const record = await _getRecordAndVerifyDoctor(req.params.recordId, doctor.id, res);
    if (!record) return;
    if (record.status === 'completed') return R.badRequest(res, 'Ca khám đã hoàn thành trước đó');

    if (!record.diagnosis || !record.symptoms)
      return R.badRequest(res, 'Vui lòng nhập triệu chứng và chẩn đoán trước khi kết thúc ca khám');

    await HealthRecordModel.recalculateTotals(record.id);

    await conn.beginTransaction();
    await AppointmentModel.updateStatus(record.appointment_id, 'completed', null, conn);
    await HealthRecordModel.complete(record.id, conn);
    await conn.commit();

    const finalRecord = await HealthRecordModel.getDetailWithRelations(record.id);
    return R.success(res, { health_record: finalRecord }, 'Ca khám đã hoàn thành');
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

// Xem toàn bộ lịch sử bệnh lý của bệnh nhân (bác sĩ tra cứu khi tiếp nhận)
const getPatientHistory = async (req, res, next) => {
  try {
    const doctor = await _getDoctorOrFail(req.user.id, res);
    if (!doctor) return;

    const { patientId } = req.params;
    const { limit = 10, offset = 0 } = req.query;
    const result = await HealthRecordModel.getHistoryByPatient(patientId, { limit: Number(limit), offset: Number(offset) });
    return R.success(res, result);
  } catch (err) { next(err); }
};

module.exports = {
  getTodayQueue, getQueueByDate,
  acceptPatient, updateExamination,
  orderLabTests, uploadLabResult, getLabResults, fillDemoLabResults,
  savePrescription, getDrugSuggestions,
  finishExamination, getPatientHistory
};