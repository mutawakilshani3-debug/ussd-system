const { pool } = require('../config/db');
const { logActivity } = require('../utils/helpers');

async function listExams(req, res) {
  const [rows] = await pool.query(
    `SELECT e.*, c.course_code, c.course_name FROM examinations e
     JOIN courses c ON e.course_id = c.course_id ORDER BY e.exam_date ASC`
  );
  res.json({ success: true, data: rows });
}

async function addExam(req, res) {
  const { course_id, venue, exam_date, exam_time, instructions } = req.body;
  if (!course_id || !venue || !exam_date || !exam_time) {
    return res.status(400).json({ success: false, message: 'course_id, venue, exam_date and exam_time are required' });
  }

  // Venue conflict detection: same venue, same date, overlapping time (assume 2hr exam slots)
  const [conflicts] = await pool.query(
    `SELECT e.*, c.course_code FROM examinations e
     JOIN courses c ON e.course_id = c.course_id
     WHERE e.venue = ? AND e.exam_date = ? AND e.exam_time = ?`,
    [venue, exam_date, exam_time]
  );
  if (conflicts.length > 0) {
    return res.status(409).json({
      success: false,
      message: `Venue conflict: ${venue} is already booked for ${conflicts[0].course_code} at this date/time.`
    });
  }

  const [result] = await pool.query(
    `INSERT INTO examinations (course_id, venue, exam_date, exam_time, instructions) VALUES (?, ?, ?, ?, ?)`,
    [course_id, venue, exam_date, exam_time, instructions || null]
  );
  await logActivity(req.user.role, req.user.userId, 'EXAM_ADDED', `course ${course_id}`, req.ip);
  res.status(201).json({ success: true, data: { exam_id: result.insertId } });
}

async function updateExam(req, res) {
  const { venue, exam_date, exam_time, instructions } = req.body;
  const fields = [];
  const params = [];
  if (venue) { fields.push('venue = ?'); params.push(venue); }
  if (exam_date) { fields.push('exam_date = ?'); params.push(exam_date); }
  if (exam_time) { fields.push('exam_time = ?'); params.push(exam_time); }
  if (instructions !== undefined) { fields.push('instructions = ?'); params.push(instructions); }
  if (fields.length === 0) return res.status(400).json({ success: false, message: 'No fields to update' });
  params.push(req.params.id);
  await pool.query(`UPDATE examinations SET ${fields.join(', ')} WHERE exam_id = ?`, params);
  await logActivity(req.user.role, req.user.userId, 'EXAM_UPDATED', `ID ${req.params.id}`, req.ip);
  res.json({ success: true, message: 'Examination updated successfully' });
}

async function deleteExam(req, res) {
  await pool.query(`DELETE FROM examinations WHERE exam_id = ?`, [req.params.id]);
  res.json({ success: true, message: 'Examination deleted successfully' });
}

module.exports = { listExams, addExam, updateExam, deleteExam };
