async function up(conn) {
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS health_records (
      id              INT AUTO_INCREMENT PRIMARY KEY,
      appointment_id  INT           NOT NULL UNIQUE,
      patient_id      INT           NOT NULL,
      doctor_id       INT           NOT NULL,
      symptoms        TEXT          DEFAULT NULL,
      diagnosis       TEXT          DEFAULT NULL,
      diagnosis_note  TEXT          DEFAULT NULL,
      blood_pressure  VARCHAR(20)   DEFAULT NULL,
      heart_rate      VARCHAR(10)   DEFAULT NULL,
      temperature     VARCHAR(10)   DEFAULT NULL,
      weight          DECIMAL(5,2)  DEFAULT NULL,
      height          DECIMAL(5,2)  DEFAULT NULL,
      total_lab_fee   DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      total_drug_fee  DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      total_amount    DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      payment_status  ENUM('unpaid','paid','waived') NOT NULL DEFAULT 'unpaid',
      payment_method  VARCHAR(50)   DEFAULT NULL,
      paid_at         TIMESTAMP     NULL DEFAULT NULL,
      status          ENUM('open','completed') NOT NULL DEFAULT 'open',
      follow_up_date  DATE          DEFAULT NULL,
      created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
      updated_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
      FOREIGN KEY (patient_id)     REFERENCES users(id)        ON DELETE RESTRICT,
      FOREIGN KEY (doctor_id)      REFERENCES doctors(id)      ON DELETE RESTRICT,
      INDEX idx_patient_id     (patient_id),
      INDEX idx_doctor_id      (doctor_id),
      INDEX idx_payment_status (payment_status),
      INDEX idx_status         (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function down(conn) {
  await conn.execute('DROP TABLE IF EXISTS health_records');
}

module.exports = { up, down };