const { pool } = require('../config/db');
const { generateAttendanceCode, logActivity } = require('../utils/helpers');
const { Parser } = require('json2csv');
require('dotenv').config();

/** Lecturer: Create Attendance Session + Generate Attendance Code + Set Expiry Time */
async function createSession(req, res) {
  const { course_id, duration_minutes, window_minutes } = req.body;
  if (!course_id) return res.status(400).json({ success: false, message: 'course_id is required' });

  const code = generateAttendanceCode();
  const start = new Date();
  const expiryMinutes = window_minutes || parseInt(process.env.ATTENDANCE_WINDOW_MINUTES) || 20;
  const end = new Date(start.getTime() + expiryMinutes * 60000);

  // Close any other active sessions for this course to avoid stale codes
  await pool.query(
    `UPDATE attendance_sessions SET status = 'closed' WHERE course_id = ? AND status = 'active'`,
    [course_id]
  );

  const [result] = await pool.query(
    `INSERT INTO attendance_sessions (course_id, attendance_code, start_time, end_time, lecturer_id, status)
     VALUES (?, ?, ?, ?, ?, 'active')`,
    [course_id, code, start, end, req.user.userId]
  );

  await logActivity(req.user.role, req.user.userId, 'ATTENDANCE_SESSION_CREATED', `course ${course_id}, code ${code}`, req.ip);

  res.status(201).json({
    success: true,
    data: {
      session_id: result.insertId,
      attendance_code: code,
      start_time: start,
      end_time: end,
      status: 'active'
    }
  });
}

/** Lecturer: Close Attendance Session manually */
async function closeSession(req, res) {
  await pool.query(`UPDATE attendance_sessions SET status = 'closed' WHERE session_id = ?`, [req.params.id]);
  await logActivity(req.user.role, req.user.userId, 'ATTENDANCE_SESSION_CLOSED', `session ${req.params.id}`, req.ip);
  res.json({ success: true, message: 'Attendance session closed' });
}

/** List all sessions, optionally filtered by course */
async function listSessions(req, res) {
  const { course_id, status } = req.query;
  let sql = `SELECT s.*, c.course_code, c.course_name,
             (SELECT COUNT(*) FROM attendance_records ar WHERE ar.session_id = s.session_id) AS attendance_count
             FROM attendance_sessions s JOIN courses c ON s.course_id = c.course_id WHERE 1=1`;
  const params = [];
  if (course_id) { sql += ` AND s.course_id = ?`; params.push(course_id); }
  if (status) { sql += ` AND s.status = ?`; params.push(status); }
  sql += ` ORDER BY s.start_time DESC`;
  const [rows] = await pool.query(sql, params);

  // Auto-expire sessions whose end_time has passed but status is still 'active'
  const now = new Date();
  for (const row of rows) {
    if (row.status === 'active' && new Date(row.end_time) < now) {
      row.status = 'expired';
      pool.query(`UPDATE attendance_sessions SET status = 'expired' WHERE session_id = ?`, [row.session_id]).catch(() => {});
    }
  }

  res.json({ success: true, data: rows });
}

/** View Attendance Report for a session */
async function getSessionReport(req, res) {
  const [records] = await pool.query(
    `SELECT ar.attendance_id, ar.attendance_time, ar.phone_number, ar.is_flagged, ar.removed_by_lecturer,
            s.student_id, s.index_number, s.full_name
     FROM attendance_records ar JOIN students s ON ar.student_id = s.student_id
     WHERE ar.session_id = ? ORDER BY ar.attendance_time ASC`,
    [req.params.id]
  );
  res.json({ success: true, data: records });
}

/** Export Attendance Report as CSV */
async function exportSessionReport(req, res) {
  const [records] = await pool.query(
    `SELECT s.index_number, s.full_name, ar.phone_number, ar.attendance_time
     FROM attendance_records ar JOIN students s ON ar.student_id = s.student_id
     WHERE ar.session_id = ? ORDER BY ar.attendance_time ASC`,
    [req.params.id]
  );
  const parser = new Parser({ fields: ['index_number', 'full_name', 'phone_number', 'attendance_time'] });
  const csv = parser.parse(records);
  res.header('Content-Type', 'text/csv');
  res.attachment(`attendance_session_${req.params.id}.csv`);
  res.send(csv);
}

/** Lecturer Approval: remove a fraudulent attendance entry */
async function removeAttendanceRecord(req, res) {
  await pool.query(
    `UPDATE attendance_records SET removed_by_lecturer = 1, is_flagged = 1 WHERE attendance_id = ?`,
    [req.params.id]
  );
  await logActivity(req.user.role, req.user.userId, 'ATTENDANCE_RECORD_REMOVED', `record ${req.params.id}`, req.ip);
  res.json({ success: true, message: 'Attendance record flagged and removed' });
}

module.exports = {
  createSession,
  closeSession,
  listSessions,
  getSessionReport,
  exportSessionReport,
  removeAttendanceRecord
};
