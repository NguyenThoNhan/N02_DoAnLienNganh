const db = require('../config/db');
const { sqlLimitOffset } = require('../utils/pagination.utils');

const findByHealthRecord = async (healthRecordId) => {
  const [prescriptions] = await db.execute(
    `SELECT p.id, p.health_record_id, p.doctor_id, p.patient_id, p.note, p.total_price, p.created_at,
            u.full_name AS doctor_name, doc.title AS doctor_title
     FROM prescriptions p
     INNER JOIN doctors doc ON doc.id = p.doctor_id
     INNER JOIN users u     ON u.id   = doc.user_id
     WHERE p.health_record_id = ?`,
    [healthRecordId]
  );
  if (!prescriptions.length) return null;

  const [items] = await db.execute(
    `SELECT pi.id, pi.drug_id, pi.quantity, pi.unit_price, pi.subtotal, pi.dosage, pi.instruction,
            d.name AS drug_name, d.unit AS drug_unit, d.code AS drug_code, d.category AS drug_category
     FROM prescription_items pi
     INNER JOIN drugs d ON d.id = pi.drug_id
     WHERE pi.prescription_id = ?
     ORDER BY pi.id ASC`,
    [prescriptions[0].id]
  );

  return { ...prescriptions[0], items };
};

const findById = async (id) => {
  const [rows] = await db.execute(
    `SELECT p.id, p.health_record_id, p.doctor_id, p.patient_id, p.note, p.total_price, p.created_at,
            u.full_name AS doctor_name
     FROM prescriptions p
     INNER JOIN doctors doc ON doc.id = p.doctor_id
     INNER JOIN users u     ON u.id   = doc.user_id
     WHERE p.id = ?`,
    [id]
  );
  return rows[0] || null;
};

const createPrescription = async ({ health_record_id, doctor_id, patient_id, note }, items) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const totalPrice = items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);

    const [pResult] = await conn.execute(
      `INSERT INTO prescriptions (health_record_id, doctor_id, patient_id, note, total_price)
       VALUES (?, ?, ?, ?, ?)`,
      [health_record_id, doctor_id, patient_id, note || null, totalPrice]
    );
    const prescriptionId = pResult.insertId;

    for (const item of items) {
      const subtotal = item.unit_price * item.quantity;
      await conn.execute(
        `INSERT INTO prescription_items (prescription_id, drug_id, quantity, unit_price, subtotal, dosage, instruction)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [prescriptionId, item.drug_id, item.quantity, item.unit_price, subtotal, item.dosage || null, item.instruction || null]
      );

      await conn.execute(
        `UPDATE drugs SET stock = GREATEST(stock - ?, 0) WHERE id = ?`,
        [item.quantity, item.drug_id]
      );
    }

    await conn.execute(
      `UPDATE health_records hr
       INNER JOIN appointments a ON a.id = hr.appointment_id
       SET hr.total_drug_fee = ?,
           hr.total_amount   = a.consultation_fee + hr.total_lab_fee + ?
       WHERE hr.id = ?`,
      [totalPrice, totalPrice, health_record_id]
    );

    await conn.commit();
    return prescriptionId;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

const updatePrescription = async (id, { note }, items) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [[existing]] = await conn.execute(
      `SELECT health_record_id FROM prescriptions WHERE id = ?`, [id]
    );
    if (!existing) throw new Error('Prescription not found');

    const [oldItems] = await conn.execute(
      `SELECT drug_id, quantity FROM prescription_items WHERE prescription_id = ?`, [id]
    );
    for (const old of oldItems) {
      await conn.execute(
        `UPDATE drugs SET stock = stock + ? WHERE id = ?`, [old.quantity, old.drug_id]
      );
    }

    await conn.execute(`DELETE FROM prescription_items WHERE prescription_id = ?`, [id]);

    const totalPrice = items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);

    for (const item of items) {
      const subtotal = item.unit_price * item.quantity;
      await conn.execute(
        `INSERT INTO prescription_items (prescription_id, drug_id, quantity, unit_price, subtotal, dosage, instruction)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, item.drug_id, item.quantity, item.unit_price, subtotal, item.dosage || null, item.instruction || null]
      );
      await conn.execute(
        `UPDATE drugs SET stock = GREATEST(stock - ?, 0) WHERE id = ?`,
        [item.quantity, item.drug_id]
      );
    }

    await conn.execute(
      `UPDATE prescriptions SET note = ?, total_price = ? WHERE id = ?`,
      [note || null, totalPrice, id]
    );

    await conn.execute(
      `UPDATE health_records hr
       INNER JOIN appointments a ON a.id = hr.appointment_id
       SET hr.total_drug_fee = ?,
           hr.total_amount   = a.consultation_fee + hr.total_lab_fee + ?
       WHERE hr.id = ?`,
      [totalPrice, totalPrice, existing.health_record_id]
    );

    await conn.commit();
    return findByHealthRecord(existing.health_record_id);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

const getByPatient = async (patientId, { limit = 20, offset = 0 } = {}) => {
  const { clause } = sqlLimitOffset(limit, offset);
  const [rows] = await db.execute(
    `SELECT p.id, p.health_record_id, p.total_price, p.created_at,
            a.appointment_date, u_doc.full_name AS doctor_name, dep.name AS department_name
     FROM prescriptions p
     INNER JOIN health_records hr ON hr.id = p.health_record_id
     INNER JOIN appointments a    ON a.id  = hr.appointment_id
     INNER JOIN doctors doc       ON doc.id = p.doctor_id
     INNER JOIN users u_doc       ON u_doc.id = doc.user_id
     INNER JOIN departments dep   ON dep.id   = doc.department_id
     WHERE p.patient_id = ?
     ORDER BY p.created_at DESC
     ${clause}`,
    [patientId]
  );
  return rows;
};

module.exports = { findByHealthRecord, findById, createPrescription, updatePrescription, getByPatient };