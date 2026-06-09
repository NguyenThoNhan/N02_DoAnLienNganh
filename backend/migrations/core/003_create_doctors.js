async function up(conn) {
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS doctors (
      id              INT AUTO_INCREMENT PRIMARY KEY,
      user_id         INT           NOT NULL UNIQUE,
      department_id   INT           NOT NULL,
      title           ENUM('bs','ths_cki','ts_ckii','pgs','gs') NOT NULL DEFAULT 'bs',
      specialization  VARCHAR(150)  DEFAULT NULL,
      bio             TEXT          DEFAULT NULL,
      experience_years INT          DEFAULT 0,
      consultation_fee DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      avatar          VARCHAR(255)  DEFAULT NULL,
      status          ENUM('active','inactive') NOT NULL DEFAULT 'active',
      created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
      updated_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id)       REFERENCES users(id)       ON DELETE CASCADE,
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT,
      INDEX idx_department (department_id),
      INDEX idx_title      (title),
      INDEX idx_status     (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function down(conn) {
  await conn.execute('DROP TABLE IF EXISTS doctors');
}

module.exports = { up, down };