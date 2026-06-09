const db = require('../config/db');
const { sqlLimitOffset } = require('../utils/pagination.utils');

const findAll = async ({ status, category, search, limit = 20, offset = 0 } = {}) => {
  const conditions = [];
  const values = [];

  if (status)   { conditions.push('status = ?');          values.push(status); }
  if (category) { conditions.push('category = ?');        values.push(category); }
  if (search)   {
    conditions.push('(name LIKE ? OR code LIKE ? OR category LIKE ?)');
    const like = `%${search}%`;
    values.push(like, like, like);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { clause } = sqlLimitOffset(limit, offset);
  const [rows] = await db.execute(
    `SELECT id, name, code, category, unit, unit_price, stock, description, manufacturer, status, created_at
     FROM drugs ${where}
     ORDER BY name ASC
     ${clause}`,
    values
  );
  const [[{ total }]] = await db.execute(
    `SELECT COUNT(*) as total FROM drugs ${where}`, values
  );
  return { data: rows, total };
};

const findById = async (id) => {
  const [rows] = await db.execute(
    `SELECT id, name, code, category, unit, unit_price, stock, description, manufacturer, status, created_at, updated_at
     FROM drugs WHERE id = ?`,
    [id]
  );
  return rows[0] || null;
};

const findByCode = async (code) => {
  const [rows] = await db.execute(
    `SELECT id, name, code, unit, unit_price, stock FROM drugs WHERE code = ?`, [code]
  );
  return rows[0] || null;
};

const create = async ({ name, code, category, unit, unit_price, stock, description, manufacturer }) => {
  const [result] = await db.execute(
    `INSERT INTO drugs (name, code, category, unit, unit_price, stock, description, manufacturer)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, code, category || null, unit || 'viên', unit_price, stock || 0, description || null, manufacturer || null]
  );
  return findById(result.insertId);
};

const update = async (id, { name, code, category, unit, unit_price, stock, description, manufacturer, status }) => {
  const fields = [];
  const values = [];

  if (name         !== undefined) { fields.push('name = ?');         values.push(name); }
  if (code         !== undefined) { fields.push('code = ?');         values.push(code); }
  if (category     !== undefined) { fields.push('category = ?');     values.push(category); }
  if (unit         !== undefined) { fields.push('unit = ?');         values.push(unit); }
  if (unit_price   !== undefined) { fields.push('unit_price = ?');   values.push(unit_price); }
  if (stock        !== undefined) { fields.push('stock = ?');        values.push(stock); }
  if (description  !== undefined) { fields.push('description = ?');  values.push(description); }
  if (manufacturer !== undefined) { fields.push('manufacturer = ?'); values.push(manufacturer); }
  if (status       !== undefined) { fields.push('status = ?');       values.push(status); }

  if (fields.length === 0) return findById(id);
  values.push(id);
  await db.execute(`UPDATE drugs SET ${fields.join(', ')} WHERE id = ?`, values);
  return findById(id);
};

const remove = async (id) => {
  const [[inUse]] = await db.execute(
    `SELECT COUNT(*) as cnt FROM prescription_items WHERE drug_id = ?`, [id]
  );
  if (inUse.cnt > 0) {
    await db.execute(`UPDATE drugs SET status = 'inactive' WHERE id = ?`, [id]);
    return { deleted: false, deactivated: true };
  }
  await db.execute(`DELETE FROM drugs WHERE id = ?`, [id]);
  return { deleted: true, deactivated: false };
};

const getSuggestedDrugs = async (diseaseName) => {
  const [rows] = await db.execute(
    `SELECT
       d.id, d.name, d.code, d.unit, d.unit_price, d.stock, d.category,
       ddm.priority, ddm.note AS mapping_note,
       dis.name AS disease_name, dis.icd_code
     FROM drugs d
     INNER JOIN disease_drug_mappings ddm ON ddm.drug_id    = d.id
     INNER JOIN diseases dis              ON dis.id          = ddm.disease_id
     WHERE dis.name LIKE ? AND d.status = 'active'
     ORDER BY ddm.priority ASC, d.name ASC`,
    [`%${diseaseName}%`]
  );
  return rows;
};

const getSuggestedByDiseaseId = async (diseaseId) => {
  const [rows] = await db.execute(
    `SELECT
       d.id, d.name, d.code, d.unit, d.unit_price, d.stock,
       ddm.priority, ddm.note AS mapping_note
     FROM drugs d
     INNER JOIN disease_drug_mappings ddm ON ddm.drug_id = d.id
     WHERE ddm.disease_id = ? AND d.status = 'active'
     ORDER BY ddm.priority ASC, d.name ASC`,
    [diseaseId]
  );
  return rows;
};

const getAllDiseases = async () => {
  const [rows] = await db.execute(
    `SELECT id, name, icd_code, description FROM diseases ORDER BY name ASC`
  );
  return rows;
};

const getDiseaseById = async (id) => {
  const [rows] = await db.execute(
    `SELECT id, name, icd_code, description FROM diseases WHERE id = ?`, [id]
  );
  return rows[0] || null;
};

const createDisease = async ({ name, icd_code, description }) => {
  const [result] = await db.execute(
    `INSERT INTO diseases (name, icd_code, description) VALUES (?, ?, ?)`,
    [name, icd_code || null, description || null]
  );
  return getDiseaseById(result.insertId);
};

const setDiseaseDrugMappings = async (diseaseId, mappings) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute(`DELETE FROM disease_drug_mappings WHERE disease_id = ?`, [diseaseId]);
    for (const m of mappings) {
      await conn.execute(
        `INSERT INTO disease_drug_mappings (disease_id, drug_id, priority, note) VALUES (?, ?, ?, ?)`,
        [diseaseId, m.drug_id, m.priority || 1, m.note || null]
      );
    }
    await conn.commit();
    return getSuggestedByDiseaseId(diseaseId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

const adjustStock = async (id, quantity) => {
  await db.execute(
    `UPDATE drugs SET stock = GREATEST(stock + ?, 0) WHERE id = ?`, [quantity, id]
  );
  return findById(id);
};

const isCodeTaken = async (code, excludeId = null) => {
  const sql = excludeId
    ? `SELECT id FROM drugs WHERE code = ? AND id != ?`
    : `SELECT id FROM drugs WHERE code = ?`;
  const [rows] = await db.execute(sql, excludeId ? [code, excludeId] : [code]);
  return rows.length > 0;
};

module.exports = {
  findAll, findById, findByCode, create, update, remove,
  getSuggestedDrugs, getSuggestedByDiseaseId,
  getAllDiseases, getDiseaseById, createDisease, setDiseaseDrugMappings,
  adjustStock, isCodeTaken
};