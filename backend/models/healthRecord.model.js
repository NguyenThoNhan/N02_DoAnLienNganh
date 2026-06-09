const db = require('../config/db');
const { sqlLimitOffset } = require('../utils/pagination.utils');

const RECORD_BASE_SELECT = `
  hr.id,
  hr.appointment_id,
  hr.patient_id,
  hr.doctor_id,
  hr.symptoms,
  hr.diagnosis,
  hr.diagnosis_note,
  hr.blood_pressure,
  hr.heart_rate,
  hr.temperature,
  hr.weight,
  hr.height,
  hr.total_lab_fee,
  hr.total_drug_fee,
  hr.total_amount,
  hr.payment_status,
  hr.payment_method,
  hr.paid_at,
  hr.status,
  hr.follow_up_date,
  hr.created_at,
  hr.updated_at,
  a.appointment_date,
  a.time_slot,
  a.service_type,
  a.consultation_fee,
  a.reason,
  u_patient.full_name  AS patient_name,
  u_patient.phone      AS patient_phone,
  u_patient.dob        AS patient_dob,
  u_patient.gender     AS patient_gender,
  u_patient.id_card    AS patient_id_card,
  u_patient.address    AS patient_address,
  u_doctor.full_name   AS doctor_name,
  doc.title            AS doctor_title,
  doc.specialization   AS doctor_specialization,
  dep.name             AS department_name
`;

const create = async ({ appointment_id, patient_id, doctor_id }, connection = null) => {
  const executor = connection || db;
  const [result] = await executor.execute(
    `INSERT INTO health_records (appointment_id, patient_id, doctor_id, status)
     VALUES (?, ?, ?, 'open')`,
    [appointment_id, patient_id, doctor_id]
  );
  return result.insertId;
};

const findById = async (id) => {
  const [rows] = await db.execute(
    `SELECT ${RECORD_BASE_SELECT}
     FROM health_records hr
     INNER JOIN appointments a     ON a.id  = hr.appointment_id
     INNER JOIN users u_patient    ON u_patient.id = hr.patient_id
     INNER JOIN doctors doc        ON doc.id       = hr.doctor_id
     INNER JOIN users u_doctor     ON u_doctor.id  = doc.user_id
     INNER JOIN departments dep    ON dep.id        = doc.department_id
     WHERE hr.id = ?`,
    [id]
  );
  return rows[0] || null;
};

const findByAppointment = async (appointmentId) => {
  const [rows] = await db.execute(
    `SELECT ${RECORD_BASE_SELECT}
     FROM health_records hr
     INNER JOIN appointments a     ON a.id  = hr.appointment_id
     INNER JOIN users u_patient    ON u_patient.id = hr.patient_id
     INNER JOIN doctors doc        ON doc.id       = hr.doctor_id
     INNER JOIN users u_doctor     ON u_doctor.id  = doc.user_id
     INNER JOIN departments dep    ON dep.id        = doc.department_id
     WHERE hr.appointment_id = ?`,
    [appointmentId]
  );
  return rows[0] || null;
};

const getHistoryByPatient = async (patientId, { limit = 20, offset = 0 } = {}) => {
  const { clause } = sqlLimitOffset(limit, offset);
  const [rows] = await db.execute(
    `SELECT ${RECORD_BASE_SELECT}
     FROM health_records hr
     INNER JOIN appointments a     ON a.id  = hr.appointment_id
     INNER JOIN users u_patient    ON u_patient.id = hr.patient_id
     INNER JOIN doctors doc        ON doc.id       = hr.doctor_id
     INNER JOIN users u_doctor     ON u_doctor.id  = doc.user_id
     INNER JOIN departments dep    ON dep.id        = doc.department_id
     WHERE hr.patient_id = ?
     ORDER BY a.appointment_date DESC, a.time_slot DESC
     ${clause}`,
    [patientId]
  );

  const [[{ total }]] = await db.execute(
    `SELECT COUNT(*) as total FROM health_records WHERE patient_id = ?`, [patientId]
  );

  return { data: rows, total };
};

const getDetailWithRelations = async (id) => {
  const record = await findById(id);
  if (!record) return null;

  const [labResults] = await db.execute(
    `SELECT
       lr.id,
       lr.status,
       lr.result_text,
       lr.result_image,
       lr.fee,
       lr.completed_at,
       lr.created_at,
       lt.name AS test_name,
       lt.code AS test_code,
       u.full_name AS ordered_by_name
     FROM lab_results lr
     INNER JOIN lab_tests lt ON lt.id = lr.lab_test_id
     INNER JOIN users u      ON u.id  = lr.ordered_by
     WHERE lr.health_record_id = ?
     ORDER BY lr.created_at ASC`,
    [id]
  );

  const [prescription] = await db.execute(
    `SELECT
       p.id,
       p.note,
       p.total_price,
       p.created_at,
       pi2.id          AS item_id,
       pi2.quantity,
       pi2.unit_price,
       pi2.subtotal,
       pi2.dosage,
       pi2.instruction,
       dr.name         AS drug_name,
       dr.unit         AS drug_unit,
       dr.code         AS drug_code
     FROM prescriptions p
     LEFT JOIN prescription_items pi2 ON pi2.prescription_id = p.id
     LEFT JOIN drugs dr               ON dr.id = pi2.drug_id
     WHERE p.health_record_id = ?`,
    [id]
  );

  let prescriptionData = null;
  if (prescription.length > 0) {
    const first = prescription[0];
    prescriptionData = {
      id: first.id,
      note: first.note,
      total_price: first.total_price,
      created_at: first.created_at,
      items: prescription
        .filter(r => r.item_id !== null)
        .map(r => ({
          id: r.item_id,
          drug_name: r.drug_name,
          drug_unit: r.drug_unit,
          drug_code: r.drug_code,
          quantity: r.quantity,
          unit_price: r.unit_price,
          subtotal: r.subtotal,
          dosage: r.dosage,
          instruction: r.instruction
        }))
    };
  }

  return { ...record, lab_results: labResults, prescription: prescriptionData };
};

const updateMedicalInfo = async (id, { symptoms, diagnosis, diagnosis_note, blood_pressure, heart_rate, temperature, weight, height, follow_up_date }) => {
  const fields = [];
  const values = [];

  if (symptoms        !== undefined) { fields.push('symptoms = ?');        values.push(symptoms); }
  if (diagnosis       !== undefined) { fields.push('diagnosis = ?');       values.push(diagnosis); }
  if (diagnosis_note  !== undefined) { fields.push('diagnosis_note = ?');  values.push(diagnosis_note); }
  if (blood_pressure  !== undefined) { fields.push('blood_pressure = ?');  values.push(blood_pressure); }
  if (heart_rate      !== undefined) { fields.push('heart_rate = ?');      values.push(heart_rate); }
  if (temperature     !== undefined) { fields.push('temperature = ?');     values.push(temperature); }
  if (weight          !== undefined) { fields.push('weight = ?');          values.push(weight); }
  if (height          !== undefined) { fields.push('height = ?');          values.push(height); }
  if (follow_up_date  !== undefined) { fields.push('follow_up_date = ?');  values.push(follow_up_date); }

  if (fields.length === 0) return findById(id);
  values.push(id);
  await db.execute(`UPDATE health_records SET ${fields.join(', ')} WHERE id = ?`, values);
  return findById(id);
};

const recalculateTotals = async (id, connection = null) => {
  const executor = connection || db;
  const [labRows] = await executor.execute(
    `SELECT COALESCE(SUM(fee), 0) AS total_lab FROM lab_results WHERE health_record_id = ?`, [id]
  );
  const [drugRows] = await executor.execute(
    `SELECT COALESCE(SUM(total_price), 0) AS total_drug FROM prescriptions WHERE health_record_id = ?`, [id]
  );
  const [apptRows] = await executor.execute(
    `SELECT a.consultation_fee FROM health_records hr
     INNER JOIN appointments a ON a.id = hr.appointment_id
     WHERE hr.id = ?`, [id]
  );

  const labFee  = parseFloat(labRows[0]?.total_lab)    || 0;
  const drugFee = parseFloat(drugRows[0]?.total_drug)  || 0;
  const consultFee = parseFloat(apptRows[0]?.consultation_fee) || 0;
  const total = labFee + drugFee + consultFee;

  await executor.execute(
    `UPDATE health_records SET total_lab_fee = ?, total_drug_fee = ?, total_amount = ? WHERE id = ?`,
    [labFee, drugFee, total, id]
  );
  return { total_lab_fee: labFee, total_drug_fee: drugFee, total_amount: total };
};

const updatePayment = async (id, { payment_status, payment_method }) => {
  const paid_at = payment_status === 'paid' ? new Date() : null;
  await db.execute(
    `UPDATE health_records SET payment_status = ?, payment_method = ?, paid_at = ? WHERE id = ?`,
    [payment_status, payment_method || null, paid_at, id]
  );
  return findById(id);
};

const complete = async (id, connection = null) => {
  const executor = connection || db;
  await executor.execute(
    `UPDATE health_records SET status = 'completed' WHERE id = ?`, [id]
  );
};

module.exports = {
  create,
  findById,
  findByAppointment,
  getHistoryByPatient,
  getDetailWithRelations,
  updateMedicalInfo,
  recalculateTotals,
  updatePayment,
  complete
};
