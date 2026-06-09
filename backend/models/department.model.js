const db = require('../config/db');

const findAll = async (status = null) => {
  const where = status ? 'WHERE status = ?' : '';
  const params = status ? [status] : [];
  const [rows] = await db.execute(
    `SELECT id, name, code, description, status, created_at FROM departments ${where} ORDER BY name ASC`,
    params
  );
  return rows;
};

const findById = async (id) => {
  const [rows] = await db.execute(
    `SELECT id, name, code, description, status, created_at FROM departments WHERE id = ?`, [id]
  );
  return rows[0] || null;
};

const findByCode = async (code) => {
  const [rows] = await db.execute(
    `SELECT id, name, code FROM departments WHERE code = ?`, [code]
  );
  return rows[0] || null;
};

const create = async ({ name, code, description }) => {
  const [result] = await db.execute(
    `INSERT INTO departments (name, code, description) VALUES (?, ?, ?)`,
    [name, code, description || null]
  );
  return findById(result.insertId);
};

const update = async (id, { name, code, description, status }) => {
  const fields = [];
  const values = [];

  if (name        !== undefined) { fields.push('name = ?');        values.push(name); }
  if (code        !== undefined) { fields.push('code = ?');        values.push(code); }
  if (description !== undefined) { fields.push('description = ?'); values.push(description); }
  if (status      !== undefined) { fields.push('status = ?');      values.push(status); }

  if (fields.length === 0) return findById(id);
  values.push(id);
  await db.execute(`UPDATE departments SET ${fields.join(', ')} WHERE id = ?`, values);
  return findById(id);
};

const remove = async (id) => {
  const [result] = await db.execute(`DELETE FROM departments WHERE id = ?`, [id]);
  return result.affectedRows > 0;
};

const getDepartmentStats = async () => {
  const [rows] = await db.execute(`
    SELECT
      d.id,
      d.name,
      d.code,
      d.description,
      d.status,
      COUNT(CASE WHEN doc.status = 'active' THEN 1 END) AS active_doctors,
      COUNT(doc.id) AS total_doctors
    FROM departments d
    LEFT JOIN doctors doc ON doc.department_id = d.id
    WHERE d.status = 'active'
    GROUP BY d.id, d.name, d.code, d.description, d.status
    ORDER BY active_doctors DESC
  `);
  return rows;
};

const isNameTaken = async (name, excludeId = null) => {
  const sql = excludeId
    ? `SELECT id FROM departments WHERE name = ? AND id != ?`
    : `SELECT id FROM departments WHERE name = ?`;
  const params = excludeId ? [name, excludeId] : [name];
  const [rows] = await db.execute(sql, params);
  return rows.length > 0;
};

const isCodeTaken = async (code, excludeId = null) => {
  const sql = excludeId
    ? `SELECT id FROM departments WHERE code = ? AND id != ?`
    : `SELECT id FROM departments WHERE code = ?`;
  const params = excludeId ? [code, excludeId] : [code];
  const [rows] = await db.execute(sql, params);
  return rows.length > 0;
};

module.exports = { findAll, findById, findByCode, create, update, remove, getDepartmentStats, isNameTaken, isCodeTaken };