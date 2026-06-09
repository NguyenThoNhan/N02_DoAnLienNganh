const db = require('../config/db');
const { sqlLimitOffset } = require('../utils/pagination.utils');

const DOCTOR_BASE_SELECT = `
  doc.id,
  doc.user_id,
  doc.department_id,
  doc.title,
  doc.specialization,
  doc.bio,
  doc.experience_years,
  doc.consultation_fee,
  doc.avatar,
  doc.status,
  u.full_name,
  u.phone,
  u.gender,
  u.dob,
  d.name  AS department_name,
  d.code  AS department_code
`;

const findAll = async ({ status, department_id, title, search, limit = 20, offset = 0 } = {}) => {
  const conditions = ['1=1'];
  const values = [];

  if (status)        { conditions.push('doc.status = ?');        values.push(status); }
  if (department_id) { conditions.push('doc.department_id = ?'); values.push(department_id); }
  if (title)         { conditions.push('doc.title = ?');         values.push(title); }
  if (search) {
    conditions.push('(u.full_name LIKE ? OR doc.specialization LIKE ?)');
    const like = `%${search}%`;
    values.push(like, like);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;
  const { clause } = sqlLimitOffset(limit, offset);
  const [rows] = await db.execute(
    `SELECT ${DOCTOR_BASE_SELECT}
     FROM doctors doc
     INNER JOIN users u       ON u.id = doc.user_id
     INNER JOIN departments d ON d.id = doc.department_id
     ${where}
     ORDER BY doc.title ASC, u.full_name ASC
     ${clause}`,
    values
  );

  const [[{ total }]] = await db.execute(
    `SELECT COUNT(*) as total
     FROM doctors doc
     INNER JOIN users u ON u.id = doc.user_id
     ${where}`,
    values
  );

  return { data: rows, total };
};

const findById = async (id) => {
  const [rows] = await db.execute(
    `SELECT ${DOCTOR_BASE_SELECT}
     FROM doctors doc
     INNER JOIN users u       ON u.id = doc.user_id
     INNER JOIN departments d ON d.id = doc.department_id
     WHERE doc.id = ?`,
    [id]
  );
  return rows[0] || null;
};

const findByUserId = async (userId) => {
  const [rows] = await db.execute(
    `SELECT ${DOCTOR_BASE_SELECT}
     FROM doctors doc
     INNER JOIN users u       ON u.id = doc.user_id
     INNER JOIN departments d ON d.id = doc.department_id
     WHERE doc.user_id = ?`,
    [userId]
  );
  return rows[0] || null;
};

const findByDepartment = async (deptId, status = 'active') => {
  const [rows] = await db.execute(
    `SELECT ${DOCTOR_BASE_SELECT}
     FROM doctors doc
     INNER JOIN users u       ON u.id = doc.user_id
     INNER JOIN departments d ON d.id = doc.department_id
     WHERE doc.department_id = ? AND doc.status = ?
     ORDER BY doc.title ASC, u.full_name ASC`,
    [deptId, status]
  );
  return rows;
};

const getDoctorDetails = async (doctorId) => {
  const [rows] = await db.execute(
    `SELECT
       doc.id,
       doc.user_id,
       doc.title,
       doc.specialization,
       doc.bio,
       doc.experience_years,
       doc.consultation_fee,
       doc.avatar,
       doc.status,
       u.full_name,
       u.phone,
       u.gender,
       d.id   AS department_id,
       d.name AS department_name,
       d.code AS department_code,
       sp.price AS service_price,
       sp.name  AS service_name
     FROM doctors doc
     INNER JOIN users u       ON u.id  = doc.user_id
     INNER JOIN departments d ON d.id  = doc.department_id
     LEFT JOIN service_prices sp ON sp.service_type = doc.title AND sp.status = 'active'
     WHERE doc.id = ?`,
    [doctorId]
  );
  return rows[0] || null;
};

const findByTitle = async (title, status = 'active') => {
  const [rows] = await db.execute(
    `SELECT ${DOCTOR_BASE_SELECT}
     FROM doctors doc
     INNER JOIN users u       ON u.id = doc.user_id
     INNER JOIN departments d ON d.id = doc.department_id
     WHERE doc.title = ? AND doc.status = ?
     ORDER BY u.full_name ASC`,
    [title, status]
  );
  return rows;
};

const create = async ({ user_id, department_id, title, specialization, bio, experience_years, consultation_fee, avatar }) => {
  const [result] = await db.execute(
    `INSERT INTO doctors (user_id, department_id, title, specialization, bio, experience_years, consultation_fee, avatar)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [user_id, department_id, title, specialization || null, bio || null, experience_years || 0, consultation_fee || 0, avatar || null]
  );
  return findById(result.insertId);
};

const update = async (id, { department_id, title, specialization, bio, experience_years, consultation_fee, avatar, status }) => {
  const fields = [];
  const values = [];

  if (department_id    !== undefined) { fields.push('department_id = ?');    values.push(department_id); }
  if (title            !== undefined) { fields.push('title = ?');            values.push(title); }
  if (specialization   !== undefined) { fields.push('specialization = ?');   values.push(specialization); }
  if (bio              !== undefined) { fields.push('bio = ?');              values.push(bio); }
  if (experience_years !== undefined) { fields.push('experience_years = ?'); values.push(experience_years); }
  if (consultation_fee !== undefined) { fields.push('consultation_fee = ?'); values.push(consultation_fee); }
  if (avatar           !== undefined) { fields.push('avatar = ?');           values.push(avatar); }
  if (status           !== undefined) { fields.push('status = ?');           values.push(status); }

  if (fields.length === 0) return findById(id);
  values.push(id);
  await db.execute(`UPDATE doctors SET ${fields.join(', ')} WHERE id = ?`, values);
  return findById(id);
};

const getBookedSlots = async (doctorId, date) => {
  const [rows] = await db.execute(
    `SELECT time_slot FROM appointments
     WHERE doctor_id = ? AND appointment_date = ? AND status NOT IN ('cancelled')`,
    [doctorId, date]
  );
  return rows.map(r => r.time_slot);
};

module.exports = { findAll, findById, findByUserId, findByDepartment, getDoctorDetails, findByTitle, create, update, getBookedSlots };