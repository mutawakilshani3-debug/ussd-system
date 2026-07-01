const { pool } = require('../config/db');

async function getStats(req, res) {
  const [[{ totalStudents }]] = await pool.query(`SELECT COUNT(*) AS totalStudents FROM students WHERE is_active = 1`);
  const [[{ totalCourses }]] = await pool.query(`SELECT COUNT(*) AS totalCourses FROM courses`);
  const [[{ activeSessions }]] = await pool.query(`SELECT COUNT(*) AS activeSessions FROM attendance_sessions WHERE status = 'active'`);
  const [[{ totalResults }]] = await pool.query(`SELECT COUNT(*) AS totalResults FROM results`);
  const [[{ totalAttendanceToday }]] = await pool.query(
    `SELECT COUNT(*) AS totalAttendanceToday FROM attendance_records WHERE DATE(attendance_time) = CURDATE()`
  );
  const [recentLogs] = await pool.query(
    `SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 10`
  );

  res.json({
    success: true,
    data: { totalStudents, totalCourses, activeSessions, totalResults, totalAttendanceToday, recentLogs }
  });
}

module.exports = { getStats };
