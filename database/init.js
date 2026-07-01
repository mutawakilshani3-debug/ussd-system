/**
 * database/init.js
 * Run once: node database/init.js
 * Creates DB, runs schema.sql, seeds sample data, creates admin user.
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function init() {
  const config = {
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true
  };

  let conn;
  try {
    conn = await mysql.createConnection(config);
    console.log('✅ Connected to MySQL');

    // Run schema
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await conn.query(schema);
    console.log('✅ Schema applied (database + tables created)');

    // Hash default admin password
    const adminPass = process.env.ADMIN_PASSWORD || 'ChangeMe123!';
    const adminHash = await bcrypt.hash(adminPass, 10);

    // Upsert admin user
    await conn.query(
      `INSERT INTO ussd_result_attendance.users (username, full_name, email, password_hash, role)
       VALUES ('admin', 'System Administrator', 'admin@ckt-utas.edu.gh', ?, 'admin')
       ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)`,
      [adminHash]
    );
    console.log(`✅ Admin user created (username: admin, password: ${adminPass})`);

    // Upsert sample lecturer
    await conn.query(
      `INSERT INTO ussd_result_attendance.users (username, full_name, email, password_hash, role)
       VALUES ('jmensah', 'Mr. J. Mensah', 'jmensah@ckt-utas.edu.gh', ?, 'lecturer')
       ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)`,
      [adminHash]
    );
    console.log('✅ Sample lecturer created (username: jmensah, same password)');

    // Run seed
    const seed = fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf8');
    await conn.query(seed);
    console.log('✅ Seed data inserted (students, courses, results, exam)');

    console.log('\n========================================================');
    console.log(' Database initialization complete!');
    console.log(' Admin login → username: admin');
    console.log(`             → password: ${adminPass}`);
    console.log(' Sample student PIN: 1234');
    console.log(' Run: npm start');
    console.log('========================================================\n');
  } catch (err) {
    console.error('\n❌ Initialization failed:', err.message);
    if (err.code === 'ECONNREFUSED') {
      console.error('   MySQL is not running or host/port is wrong. Check .env DB_* settings.');
    }
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

init();
