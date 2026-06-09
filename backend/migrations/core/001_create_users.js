async function up(conn) {
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      full_name   VARCHAR(100)  NOT NULL,
      phone       VARCHAR(15)   NOT NULL UNIQUE,
      password    VARCHAR(255)  NOT NULL,
      role        ENUM('patient','doctor','admin') NOT NULL DEFAULT 'patient',
      id_card     VARCHAR(20)   DEFAULT NULL UNIQUE,
      dob         DATE          DEFAULT NULL,
      gender      ENUM('male','female','other') DEFAULT NULL,
      address     TEXT          DEFAULT NULL,
      avatar      VARCHAR(255)  DEFAULT NULL,
      status      ENUM('active','inactive','banned') NOT NULL DEFAULT 'active',
      created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
      updated_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_phone  (phone),
      INDEX idx_role   (role),
      INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function down(conn) {
  await conn.execute('DROP TABLE IF EXISTS users');
}

module.exports = { up, down };