const mysql = require('mysql2/promise');
const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME } = require('./env');

const pool = mysql.createPool({
  host: DB_HOST,
  port: DB_PORT || 3306,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: '+07:00',
  charset: 'utf8mb4'
});

pool.getConnection()
  .then(conn => {
    console.log('✅ MySQL connected successfully to:', DB_NAME);
    conn.release();
  })
  .catch(err => {
    console.error('❌ MySQL connection failed:', err.message);
    process.exit(1);
  });

module.exports = pool;