const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');

/** Hash a plaintext value (PIN or password) */
async function hashValue(plain) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plain, salt);
}

/** Compare plaintext to hash */
async function compareValue(plain, hash) {
  return bcrypt.compare(plain, hash);
}

/** Generate a random attendance code, e.g. ATT-5482 */
function generateAttendanceCode() {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `ATT-${num}`;
}

/** Map a letter grade to a 4.0-scale grade point (CKT-UTAS style scale) */
const GRADE_POINTS = {
  'A': 4.00, 'B+': 3.50, 'B': 3.00, 'C+': 2.50,
  'C': 2.00, 'D+': 1.50, 'D': 1.00, 'E': 0.50, 'F': 0.00
};
function gradeToPoint(grade) {
  return GRADE_POINTS[grade.toUpperCase()] ?? 0.00;
}

/** Write an entry to the activity_logs table (never throws to caller) */
async function logActivity(actorType, actorId, action, details = '', ip = '') {
  try {
    await pool.query(
      `INSERT INTO activity_logs (actor_type, actor_id, action, details, ip_address) VALUES (?, ?, ?, ?, ?)`,
      [actorType, String(actorId || ''), action, details, ip]
    );
  } catch (err) {
    console.error('Failed to write activity log:', err.message);
  }
}

/** Normalize a phone number for comparison: strip spaces, leading +, leading 0 -> 233 */
function normalizePhone(phone) {
  if (!phone) return '';
  let p = phone.replace(/\s+/g, '').replace(/^\+/, '');
  if (p.startsWith('0')) p = '233' + p.slice(1);
  return p;
}

module.exports = {
  hashValue,
  compareValue,
  generateAttendanceCode,
  gradeToPoint,
  logActivity,
  normalizePhone
};
