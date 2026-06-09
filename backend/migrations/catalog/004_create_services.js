async function up(conn) {
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS service_prices (
      id            INT AUTO_INCREMENT PRIMARY KEY,
      service_type  ENUM('doctor','request','pgs','ths_cki','ts_ckii','request_24_7') NOT NULL,
      name          VARCHAR(150)  NOT NULL,
      description   TEXT          DEFAULT NULL,
      price         DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      status        ENUM('active','inactive') NOT NULL DEFAULT 'active',
      created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
      updated_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_service_type (service_type),
      INDEX idx_status       (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await conn.execute(`
    INSERT INTO service_prices (service_type, name, price) VALUES
    ('request',     'Khám yêu cầu',               200000),
    ('pgs',         'Khám theo Phó Giáo sư',       350000),
    ('ths_cki',     'Khám theo Thạc sĩ / BS CKI',  150000),
    ('ts_ckii',     'Khám theo Tiến sĩ / BS CKII', 250000),
    ('request_24_7','Khám yêu cầu 24/7',            300000)
  `);
}

async function down(conn) {
  await conn.execute('DROP TABLE IF EXISTS service_prices');
}

module.exports = { up, down };