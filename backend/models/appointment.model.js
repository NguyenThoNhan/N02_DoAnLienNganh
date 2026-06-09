const db = require('../config/db');
const { sqlLimitOffset } = require('../utils/pagination.utils');

const APPOINTMENT_BASE_SELECT = `
  a.id,
  a.patient_id,
  a.doctor_id,
  a.service_type,
  a.appointment_date,
  a.time_slot,
  a.reason,
  a.status,
  a.consultation_fee,
  a.notes,
  a.created_at,
  u_patient.full_name  AS patient_name,
  u_patient.phone      AS patient_phone,
  u_patient.dob        AS patient_dob,
  u_patient.gender     AS patient_gender,
  u_doctor.full_name   AS doctor_name,
  doc.title            AS doctor_title,
  doc.specialization   AS doctor_specialization,
  dep.name             AS department_name,
  hr.id                AS health_record_id
`;

const checkAvailability = async (doctorId, date, timeSlot) => {
  const [rows] = await db.execute(
    `SELECT id FROM appointments
     WHERE doctor_id = ? AND appointment_date = ? AND time_slot = ?
     AND status NOT IN ('cancelled')
     LIMIT 1`,
    [doctorId, date, timeSlot]
  );
  return rows.length === 0;
};

const create = async ({ patient_id, doctor_id, service_type, appointment_date, time_slot, reason, consultation_fee }, connection = null) => {
  const executor = connection || db;
  const [result] = await executor.execute(
    `INSERT INTO appointments (patient_id, doctor_id, service_type, appointment_date, time_slot, reason, consultation_fee, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [patient_id, doctor_id, service_type, appointment_date, time_slot, reason || null, consultation_fee]
  );
  return result.insertId;
};

const findById = async (id) => {
  const [rows] = await db.execute(
    `SELECT ${APPOINTMENT_BASE_SELECT}
     FROM appointments a
     INNER JOIN users u_patient    ON u_patient.id = a.patient_id
     INNER JOIN doctors doc        ON doc.id       = a.doctor_id
     INNER JOIN users u_doctor     ON u_doctor.id  = doc.user_id
     INNER JOIN departments dep    ON dep.id        = doc.department_id
     LEFT  JOIN health_records hr  ON hr.appointment_id = a.id
     WHERE a.id = ?`,
    [id]
  );
  return rows[0] || null;
};

const findByPatient = async (patientId, { status, limit = 20, offset = 0 } = {}) => {
  const conditions = ['a.patient_id = ?'];
  const values = [patientId];

  if (status) { conditions.push('a.status = ?'); values.push(status); }

  const { clause } = sqlLimitOffset(limit, offset);
  const [rows] = await db.execute(
    `SELECT ${APPOINTMENT_BASE_SELECT}
     FROM appointments a
     INNER JOIN users u_patient    ON u_patient.id = a.patient_id
     INNER JOIN doctors doc        ON doc.id       = a.doctor_id
     INNER JOIN users u_doctor     ON u_doctor.id  = doc.user_id
     INNER JOIN departments dep    ON dep.id        = doc.department_id
     LEFT  JOIN health_records hr  ON hr.appointment_id = a.id
     WHERE ${conditions.join(' AND ')}
     ORDER BY a.appointment_date DESC, a.time_slot DESC
     ${clause}`,
    values
  );
  return rows;
};

const findByDoctor = async (doctorId, { date, status, limit = 50, offset = 0 } = {}) => {
  const conditions = ['a.doctor_id = ?'];
  const values = [doctorId];

  if (date)   { conditions.push('a.appointment_date = ?'); values.push(date); }
  if (status) { conditions.push('a.status = ?');           values.push(status); }

  const { clause } = sqlLimitOffset(limit, offset, { max: 100 });
  const [rows] = await db.execute(
    `SELECT ${APPOINTMENT_BASE_SELECT}
     FROM appointments a
     INNER JOIN users u_patient    ON u_patient.id = a.patient_id
     INNER JOIN doctors doc        ON doc.id       = a.doctor_id
     INNER JOIN users u_doctor     ON u_doctor.id  = doc.user_id
     INNER JOIN departments dep    ON dep.id        = doc.department_id
     LEFT  JOIN health_records hr  ON hr.appointment_id = a.id
     WHERE ${conditions.join(' AND ')}
     ORDER BY a.appointment_date ASC, a.time_slot ASC
     ${clause}`,
    values
  );
  return rows;
};

const findTodayByDoctor = async (doctorId) => {
  const [rows] = await db.execute(
    `SELECT ${APPOINTMENT_BASE_SELECT}
     FROM appointments a
     INNER JOIN users u_patient    ON u_patient.id = a.patient_id
     INNER JOIN doctors doc        ON doc.id       = a.doctor_id
     INNER JOIN users u_doctor     ON u_doctor.id  = doc.user_id
     INNER JOIN departments dep    ON dep.id        = doc.department_id
     LEFT  JOIN health_records hr  ON hr.appointment_id = a.id
     WHERE a.doctor_id = ? AND a.appointment_date = CURDATE()
     AND a.status NOT IN ('cancelled')
     ORDER BY
       FIELD(a.status, 'in_progress', 'confirmed', 'pending', 'completed'),
       a.time_slot ASC`,
    [doctorId]
  );
  return rows;
};

const updateStatus = async (id, status, notes = null, connection = null) => {
  const executor = connection || db;
  const [result] = await executor.execute(
    `UPDATE appointments SET status = ?, notes = COALESCE(?, notes) WHERE id = ?`,
    [status, notes, id]
  );
  return result.affectedRows > 0;
};

const getAdminList = async ({ date_from, date_to, status, doctor_id, limit = 30, offset = 0 } = {}) => {
  const conditions = ['1=1'];
  const values = [];

  if (date_from) { conditions.push('a.appointment_date >= ?'); values.push(date_from); }
  if (date_to)   { conditions.push('a.appointment_date <= ?'); values.push(date_to); }
  if (status)    { conditions.push('a.status = ?');            values.push(status); }
  if (doctor_id) { conditions.push('a.doctor_id = ?');         values.push(doctor_id); }

  const where = `WHERE ${conditions.join(' AND ')}`;
  const { clause } = sqlLimitOffset(limit, offset);
  const [rows] = await db.execute(
    `SELECT ${APPOINTMENT_BASE_SELECT}
     FROM appointments a
     INNER JOIN users u_patient    ON u_patient.id = a.patient_id
     INNER JOIN doctors doc        ON doc.id       = a.doctor_id
     INNER JOIN users u_doctor     ON u_doctor.id  = doc.user_id
     INNER JOIN departments dep    ON dep.id        = doc.department_id
     LEFT  JOIN health_records hr  ON hr.appointment_id = a.id
     ${where}
     ORDER BY a.appointment_date DESC, a.time_slot ASC
     ${clause}`,
    values
  );

  const [[{ total }]] = await db.execute(
    `SELECT COUNT(*) as total FROM appointments a ${where}`, values
  );

  return { data: rows, total };
};

const getRevenueStats = async ({ group_by = 'day', date_from, date_to } = {}) => {
  const formatMap = { day: '%Y-%m-%d', month: '%Y-%m', year: '%Y' };
  const fmt = formatMap[group_by] || '%Y-%m-%d';
  const conditions = ["a.status = 'completed'"];
  const values = [];

  if (date_from) { conditions.push('a.appointment_date >= ?'); values.push(date_from); }
  if (date_to)   { conditions.push('a.appointment_date <= ?'); values.push(date_to); }

  const [rows] = await db.execute(
    `SELECT
       DATE_FORMAT(a.appointment_date, '${fmt}') AS period,
       COUNT(a.id)                               AS total_appointments,
       COALESCE(SUM(hr.total_amount), 0)         AS total_revenue,
       COALESCE(SUM(a.consultation_fee), 0)      AS consultation_revenue,
       COALESCE(SUM(hr.total_lab_fee), 0)        AS lab_revenue,
       COALESCE(SUM(hr.total_drug_fee), 0)       AS drug_revenue
     FROM appointments a
     LEFT JOIN health_records hr ON hr.appointment_id = a.id
     WHERE ${conditions.join(' AND ')}
     GROUP BY period
     ORDER BY period ASC`,
    values
  );
  return rows;
};

module.exports = {
  checkAvailability,
  create,
  findById,
  findByPatient,
  findByDoctor,
  findTodayByDoctor,
  updateStatus,
  getAdminList,
  getRevenueStats
};