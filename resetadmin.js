require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function reset() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  const hash = await bcrypt.hash('admin123', 10);
  await conn.query(
    `UPDATE users SET password_hash = ? WHERE username = 'admin'`,
    [hash]
  );
  console.log('✅ Password reset to: admin123');
  await conn.end();
}

reset();