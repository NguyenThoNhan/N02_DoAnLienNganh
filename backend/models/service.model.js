const db = require('../config/db');

const findAll = async (status = null) => {
  const where  = status ? 'WHERE status = ?' : '';
  const params = status ? [status] : [];
  const [rows] = await db.execute(
    `SELECT id, service_type, name, description, price, status, created_at, updated_at
     FROM service_prices ${where}
     ORDER BY price ASC`,
    params
  );
  return rows;
};

const findById = async (id) => {
  const [rows] = await db.execute(
    `SELECT id, service_type, name, description, price, status, created_at, updated_at
     FROM service_prices WHERE id = ?`,
    [id]
  );
  return rows[0] || null;
};

const getPriceByType = async (serviceType) => {
  const [rows] = await db.execute(
    `SELECT id, service_type, name, price FROM service_prices
     WHERE service_type = ? AND status = 'active'
     LIMIT 1`,
    [serviceType]
  );
  return rows[0] || null;
};

const create = async ({ service_type, name, description, price }) => {
  const [result] = await db.execute(
    `INSERT INTO service_prices (service_type, name, description, price) VALUES (?, ?, ?, ?)`,
    [service_type, name, description || null, price]
  );
  return findById(result.insertId);
};

const update = async (id, { service_type, name, description, price, status }) => {
  const fields = [];
  const values = [];

  if (service_type !== undefined) { fields.push('service_type = ?'); values.push(service_type); }
  if (name        !== undefined)  { fields.push('name = ?');        values.push(name); }
  if (description !== undefined)  { fields.push('description = ?'); values.push(description); }
  if (price       !== undefined)  { fields.push('price = ?');       values.push(price); }
  if (status      !== undefined)  { fields.push('status = ?');      values.push(status); }

  if (fields.length === 0) return findById(id);
  values.push(id);
  await db.execute(`UPDATE service_prices SET ${fields.join(', ')} WHERE id = ?`, values);
  return findById(id);
};

const remove = async (id) => {
  const [result] = await db.execute(`DELETE FROM service_prices WHERE id = ?`, [id]);
  return result.affectedRows > 0;
};

const getPriceMap = async () => {
  const [rows] = await db.execute(
    `SELECT service_type, price, name FROM service_prices WHERE status = 'active'`
  );
  return rows.reduce((map, row) => {
    map[row.service_type] = { price: row.price, name: row.name };
    return map;
  }, {});
};

module.exports = { findAll, findById, getPriceByType, create, update, remove, getPriceMap };
