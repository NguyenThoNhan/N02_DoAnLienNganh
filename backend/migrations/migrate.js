require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');

const DB_CONFIG = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  timezone: '+07:00',
  charset: 'utf8mb4'
};

const MIGRATION_GROUPS = ['core', 'catalog', 'operation', 'content'];

async function ensureMigrationsTable(conn) {
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function getExecutedMigrations(conn) {
  const [rows] = await conn.execute('SELECT filename FROM migrations');
  return rows.map(r => r.filename);
}

async function scanMigrationFiles() {
  const files = [];
  const baseDir = __dirname;

  for (const group of MIGRATION_GROUPS) {
    const groupDir = path.join(baseDir, group);
    if (!fs.existsSync(groupDir)) continue;

    const groupFiles = fs.readdirSync(groupDir)
      .filter(f => f.endsWith('.js') && /^\d{3}_/.test(f))
      .sort()
      .map(f => ({ filename: f, group, fullPath: path.join(groupDir, f) }));

    files.push(...groupFiles);
  }

  return files;
}

async function runUp() {
  const conn = await mysql.createConnection(DB_CONFIG);
  try {
    await ensureMigrationsTable(conn);
    const executed = await getExecutedMigrations(conn);
    const allFiles = await scanMigrationFiles();
    const pending = allFiles.filter(f => !executed.includes(f.filename));

    if (pending.length === 0) {
      console.log('✅ All migrations are up to date.');
      return;
    }

    for (const file of pending) {
      console.log(`⬆️  Running [${file.group}/${file.filename}]...`);
      const migration = require(file.fullPath);
      await migration.up(conn);
      await conn.execute('INSERT INTO migrations (filename) VALUES (?)', [file.filename]);
      console.log(`   ✅ Done: ${file.filename}`);
    }

    console.log(`\n🎉 Migration complete. ${pending.length} file(s) executed.`);
  } finally {
    await conn.end();
  }
}

async function runDown() {
  const conn = await mysql.createConnection(DB_CONFIG);
  try {
    await ensureMigrationsTable(conn);
    const executed = await getExecutedMigrations(conn);
    const allFiles = await scanMigrationFiles();
    const toRollback = allFiles
      .filter(f => executed.includes(f.filename))
      .reverse();

    if (toRollback.length === 0) {
      console.log('✅ Nothing to rollback.');
      return;
    }

    for (const file of toRollback) {
      console.log(`⬇️  Rolling back [${file.group}/${file.filename}]...`);
      const migration = require(file.fullPath);
      await migration.down(conn);
      await conn.execute('DELETE FROM migrations WHERE filename = ?', [file.filename]);
      console.log(`   ✅ Rolled back: ${file.filename}`);
    }

    console.log(`\n🎉 Rollback complete. ${toRollback.length} file(s) rolled back.`);
  } finally {
    await conn.end();
  }
}

const command = process.argv[2];
if (command === 'up') {
  runUp().catch(err => { console.error('❌ Migration error:', err.message); process.exit(1); });
} else if (command === 'down') {
  runDown().catch(err => { console.error('❌ Rollback error:', err.message); process.exit(1); });
} else {
  console.log('Usage: node migrate.js [up|down]');
  process.exit(1);
}