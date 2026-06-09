async function up(conn) {
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS drugs (
      id            INT AUTO_INCREMENT PRIMARY KEY,
      name          VARCHAR(150)  NOT NULL,
      code          VARCHAR(30)   NOT NULL UNIQUE,
      category      VARCHAR(100)  DEFAULT NULL,
      unit          VARCHAR(30)   NOT NULL DEFAULT 'viên',
      unit_price    DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      stock         INT           NOT NULL DEFAULT 0,
      description   TEXT          DEFAULT NULL,
      manufacturer  VARCHAR(150)  DEFAULT NULL,
      status        ENUM('active','inactive') NOT NULL DEFAULT 'active',
      created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
      updated_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_code     (code),
      INDEX idx_category (category),
      INDEX idx_status   (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function down(conn) {
  await conn.execute('DROP TABLE IF EXISTS drugs');
}

module.exports = { up, down };