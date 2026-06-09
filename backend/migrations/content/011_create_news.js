async function up(conn) {
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS news (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      title       VARCHAR(255)  NOT NULL,
      slug        VARCHAR(255)  NOT NULL UNIQUE,
      summary     TEXT          DEFAULT NULL,
      content     LONGTEXT      NOT NULL,
      thumbnail   VARCHAR(255)  DEFAULT NULL,
      category    ENUM('news','event','announcement','health_tips') NOT NULL DEFAULT 'news',
      author_id   INT           NOT NULL,
      is_featured TINYINT(1)    NOT NULL DEFAULT 0,
      view_count  INT           NOT NULL DEFAULT 0,
      status      ENUM('draft','published','archived') NOT NULL DEFAULT 'draft',
      published_at TIMESTAMP    NULL DEFAULT NULL,
      created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
      updated_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE RESTRICT,
      INDEX idx_slug        (slug),
      INDEX idx_category    (category),
      INDEX idx_status      (status),
      INDEX idx_is_featured (is_featured),
      INDEX idx_published_at (published_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function down(conn) {
  await conn.execute('DROP TABLE IF EXISTS news');
}

module.exports = { up, down };