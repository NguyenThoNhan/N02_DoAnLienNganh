async function up(conn) {
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS appointments (
      id              INT AUTO_INCREMENT PRIMARY KEY,
      patient_id      INT           NOT NULL,
      doctor_id       INT           NOT NULL,
      service_type    ENUM('doctor','request','pgs','ths_cki','ts_ckii','request_24_7') NOT NULL DEFAULT 'doctor',
      appointment_date DATE          NOT NULL,
      time_slot       VARCHAR(10)   NOT NULL COMMENT 'Format: HH:MM e.g. 08:00',
      reason          TEXT          DEFAULT NULL,
      status          ENUM('pending','confirmed','in_progress','completed','cancelled') NOT NULL DEFAULT 'pending',
      consultation_fee DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      notes           TEXT          DEFAULT NULL,
      created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
      updated_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES users(id)    ON DELETE RESTRICT,
      FOREIGN KEY (doctor_id)  REFERENCES doctors(id)  ON DELETE RESTRICT,
      UNIQUE KEY uq_doctor_slot (doctor_id, appointment_date, time_slot),
      INDEX idx_patient_id       (patient_id),
      INDEX idx_doctor_id        (doctor_id),
      INDEX idx_appointment_date (appointment_date),
      INDEX idx_status           (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function down(conn) {
  await conn.execute('DROP TABLE IF EXISTS appointments');
}

module.exports = { up, down };