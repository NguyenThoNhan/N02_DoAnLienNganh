async function up(conn) {
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS lab_tests (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      name        VARCHAR(150)  NOT NULL,
      code        VARCHAR(30)   NOT NULL UNIQUE,
      price       DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      description TEXT          DEFAULT NULL,
      status      ENUM('active','inactive') NOT NULL DEFAULT 'active',
      created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_code   (code),
      INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await conn.execute(`
    INSERT INTO lab_tests (name, code, price) VALUES
    ('Xét nghiệm máu tổng quát',   'XN001', 150000),
    ('Xét nghiệm nước tiểu',        'XN002',  80000),
    ('Siêu âm ổ bụng',              'XN003', 200000),
    ('Chụp X-quang ngực',           'XN004', 180000),
    ('Điện tim (ECG)',               'XN005', 120000),
    ('Xét nghiệm chức năng gan',    'XN006', 250000),
    ('Xét nghiệm chức năng thận',   'XN007', 230000),
    ('Xét nghiệm đường huyết',      'XN008',  60000),
    ('Chụp CT scan',                'XN009', 800000),
    ('Xét nghiệm lipid máu',        'XN010', 180000)
  `);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS lab_results (
      id              INT AUTO_INCREMENT PRIMARY KEY,
      health_record_id INT          NOT NULL,
      lab_test_id     INT           NOT NULL,
      ordered_by      INT           NOT NULL COMMENT 'doctor user_id',
      result_text     TEXT          DEFAULT NULL,
      result_image    VARCHAR(255)  DEFAULT NULL,
      fee             DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      status          ENUM('ordered','sample_collected','processing','completed') NOT NULL DEFAULT 'ordered',
      completed_at    TIMESTAMP     NULL DEFAULT NULL,
      created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
      updated_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (health_record_id) REFERENCES health_records(id) ON DELETE CASCADE,
      FOREIGN KEY (lab_test_id)      REFERENCES lab_tests(id)      ON DELETE RESTRICT,
      FOREIGN KEY (ordered_by)       REFERENCES users(id)          ON DELETE RESTRICT,
      INDEX idx_health_record_id (health_record_id),
      INDEX idx_status           (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function down(conn) {
  await conn.execute('DROP TABLE IF EXISTS lab_results');
  await conn.execute('DROP TABLE IF EXISTS lab_tests');
}

module.exports = { up, down };