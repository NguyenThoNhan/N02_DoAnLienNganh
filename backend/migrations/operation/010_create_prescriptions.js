async function up(conn) {
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS prescriptions (
      id              INT AUTO_INCREMENT PRIMARY KEY,
      health_record_id INT          NOT NULL UNIQUE,
      doctor_id       INT           NOT NULL,
      patient_id      INT           NOT NULL,
      note            TEXT          DEFAULT NULL,
      total_price     DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
      updated_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (health_record_id) REFERENCES health_records(id) ON DELETE CASCADE,
      FOREIGN KEY (doctor_id)        REFERENCES doctors(id)        ON DELETE RESTRICT,
      FOREIGN KEY (patient_id)       REFERENCES users(id)          ON DELETE RESTRICT,
      INDEX idx_doctor_id  (doctor_id),
      INDEX idx_patient_id (patient_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS prescription_items (
      id              INT AUTO_INCREMENT PRIMARY KEY,
      prescription_id INT           NOT NULL,
      drug_id         INT           NOT NULL,
      quantity        INT           NOT NULL DEFAULT 1,
      unit_price      DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      subtotal        DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      dosage          VARCHAR(100)  DEFAULT NULL COMMENT 'Liều dùng: 2 viên/ngày',
      instruction     TEXT          DEFAULT NULL COMMENT 'Lời dặn: Uống sau ăn',
      created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE CASCADE,
      FOREIGN KEY (drug_id)         REFERENCES drugs(id)          ON DELETE RESTRICT,
      INDEX idx_prescription_id (prescription_id),
      INDEX idx_drug_id         (drug_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function down(conn) {
  await conn.execute('DROP TABLE IF EXISTS prescription_items');
  await conn.execute('DROP TABLE IF EXISTS prescriptions');
}

module.exports = { up, down };