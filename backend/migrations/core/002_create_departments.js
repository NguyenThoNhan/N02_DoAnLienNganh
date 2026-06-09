async function up(conn) {
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS departments (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      name        VARCHAR(100)  NOT NULL UNIQUE,
      code        VARCHAR(20)   NOT NULL UNIQUE,
      description TEXT          DEFAULT NULL,
      status      ENUM('active','inactive') NOT NULL DEFAULT 'active',
      created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
      updated_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_code   (code),
      INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function down(conn) {
  await conn.execute('DROP TABLE IF EXISTS departments');
}

module.exports = { up, down };