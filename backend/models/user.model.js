const db = require('../config/db');
const { sqlLimitOffset } = require('../utils/pagination.utils');

const SAFE_FIELDS = 'id, full_name, phone, role, id_card, dob, gender, address, avatar, status, created_at, updated_at';

const findById = async (id) => {
  const [rows] = await db.execute(
    `SELECT ${SAFE_FIELDS} FROM users WHERE id = ?`, [id]
  );
  return rows[0] || null;
};

const findPasswordById = async (id) => {
  const [rows] = await db.execute('SELECT password FROM users WHERE id = ? LIMIT 1', [id]);
  return rows[0]?.password ?? null;
};

const findByPhone = async (phone, includePassword = false) => {
  const fields = includePassword ? `${SAFE_FIELDS}, password` : SAFE_FIELDS;
  const [rows] = await db.execute(
    `SELECT ${fields} FROM users WHERE phone = ?`, [phone]
  );
  return rows[0] || null;
};

const create = async ({ full_name, phone, password, role = 'patient' }) => {
  const [result] = await db.execute(
    `INSERT INTO users (full_name, phone, password, role) VALUES (?, ?, ?, ?)`,
    [full_name, phone, password, role]
  );
  return findById(result.insertId);
};

const updateProfile = async (id, { full_name, id_card, dob, gender, address, avatar }) => {
  const fields = [];
  const values = [];

  if (full_name !== undefined) { fields.push('full_name = ?'); values.push(full_name); }
  if (id_card   !== undefined) { fields.push('id_card = ?');   values.push(id_card); }
  if (dob       !== undefined) { fields.push('dob = ?');       values.push(dob); }
  if (gender    !== undefined) { fields.push('gender = ?');    values.push(gender); }
  if (address   !== undefined) { fields.push('address = ?');   values.push(address); }
  if (avatar    !== undefined) { fields.push('avatar = ?');    values.push(avatar); }

  if (fields.length === 0) return findById(id);

  values.push(id);
  await db.execute(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
  return findById(id);
};

const updatePassword = async (id, hashedPassword) => {
  await db.execute(`UPDATE users SET password = ? WHERE id = ?`, [hashedPassword, id]);
};

const updateStatus = async (id, status) => {
  await db.execute(`UPDATE users SET status = ? WHERE id = ?`, [status, id]);
};

const isPhoneTaken = async (phone, excludeId = null) => {
  const sql = excludeId
    ? `SELECT id FROM users WHERE phone = ? AND id != ?`
    : `SELECT id FROM users WHERE phone = ?`;
  const params = excludeId ? [phone, excludeId] : [phone];
  const [rows] = await db.execute(sql, params);
  return rows.length > 0;
};

const isIdCardTaken = async (id_card, excludeId = null) => {
  const sql = excludeId
    ? `SELECT id FROM users WHERE id_card = ? AND id != ?`
    : `SELECT id FROM users WHERE id_card = ?`;
  const params = excludeId ? [id_card, excludeId] : [id_card];
  const [rows] = await db.execute(sql, params);
  return rows.length > 0;
};

const getAll = async ({ role, status, search, limit = 20, offset = 0 } = {}) => {
  const conditions = [];
  const values = [];

  if (role)   { conditions.push('role = ?');   values.push(role); }
  if (status) { conditions.push('status = ?'); values.push(status); }
  if (search) {
    conditions.push('(full_name LIKE ? OR phone LIKE ? OR id_card LIKE ?)');
    const like = `%${search}%`;
    values.push(like, like, like);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { clause } = sqlLimitOffset(limit, offset);
  const [rows] = await db.execute(
    `SELECT ${SAFE_FIELDS} FROM users ${where} ORDER BY created_at DESC ${clause}`,
    values
  );
  const [[{ total }]] = await db.execute(
    `SELECT COUNT(*) as total FROM users ${where}`, values
  );
  return { data: rows, total };
};

module.exports = {
  findById, findPasswordById, findByPhone, create, updateProfile, updatePassword,
  updateStatus, isPhoneTaken, isIdCardTaken, getAll
};
