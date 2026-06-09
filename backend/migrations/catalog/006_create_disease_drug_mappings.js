async function up(conn) {
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS diseases (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      name        VARCHAR(150)  NOT NULL UNIQUE,
      icd_code    VARCHAR(20)   DEFAULT NULL,
      description TEXT          DEFAULT NULL,
      created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
      updated_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_icd_code (icd_code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS disease_drug_mappings (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      disease_id  INT NOT NULL,
      drug_id     INT NOT NULL,
      priority    TINYINT NOT NULL DEFAULT 1 COMMENT '1=primary, 2=secondary, 3=supplementary',
      note        VARCHAR(255) DEFAULT NULL,
      created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (disease_id) REFERENCES diseases(id) ON DELETE CASCADE,
      FOREIGN KEY (drug_id)    REFERENCES drugs(id)    ON DELETE CASCADE,
      UNIQUE KEY uq_disease_drug (disease_id, drug_id),
      INDEX idx_disease_id (disease_id),
      INDEX idx_drug_id    (drug_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function down(conn) {
  await conn.execute('DROP TABLE IF EXISTS disease_drug_mappings');
  await conn.execute('DROP TABLE IF EXISTS diseases');
}

module.exports = { up, down };