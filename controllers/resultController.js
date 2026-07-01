const { pool } = require('../config/db');
const { gradeToPoint, logActivity } = require('../utils/helpers');

async function listResults(req, res) {
  const { student_id, course_id, semester, academic_year } = req.query;
  let sql = `SELECT r.*, s.full_name, s.index_number, c.course_code, c.course_name
             FROM results r
             JOIN students s ON r.student_id = s.student_id
             JOIN courses c ON r.course_id = c.course_id WHERE 1=1`;
  const params = [];
  if (student_id) { sql += ` AND r.student_id = ?`; params.push(student_id); }
  if (course_id) { sql += ` AND r.course_id = ?`; params.push(course_id); }
  if (semester) { sql += ` AND r.semester = ?`; params.push(semester); }
  if (academic_year) { sql += ` AND r.academic_year = ?`; params.push(academic_year); }
  sql += ` ORDER BY r.created_at DESC`;
  const [rows] = await pool.query(sql, params);
  res.json({ success: true, data: rows });
}

async function uploadResult(req, res) {
  const { student_id, course_id, grade, semester, academic_year } = req.body;
  if (!student_id || !course_id || !grade || !semester || !academic_year) {
    return res.status(400).json({ success: false, message: 'All fields are required' });
  }
  const gradePoint = gradeToPoint(grade);
  try {
    const [result] = await pool.query(
      `INSERT INTO results (student_id, course_id, grade, grade_point, semester, academic_year, is_published)
       VALUES (?, ?, ?, ?, ?, ?, 0)
       ON DUPLICATE KEY UPDATE grade = VALUES(grade), grade_point = VALUES(grade_point)`,
      [student_id, course_id, grade.toUpperCase(), gradePoint, semester, academic_year]
    );
    await logActivity(req.user.role, req.user.userId, 'RESULT_UPLOADED', `student ${student_id}, course ${course_id}`, req.ip);
    res.status(201).json({ success: true, message: 'Result saved successfully', data: { result_id: result.insertId } });
  } catch (err) {
    throw err;
  }
}

/** Bulk upload via array of result objects (e.g. parsed from CSV on the frontend) */
async function bulkUploadResults(req, res) {
  const { results } = req.body;
  if (!Array.isArray(results) || results.length === 0) {
    return res.status(400).json({ success: false, message: 'results array is required' });
  }
  let inserted = 0;
  const errors = [];
  for (const r of results) {
    const { student_id, course_id, grade, semester, academic_year } = r;
    if (!student_id || !course_id || !grade || !semester || !academic_year) {
      errors.push({ row: r, error: 'Missing required fields' });
      continue;
    }
    try {
      await pool.query(
        `INSERT INTO results (student_id, course_id, grade, grade_point, semester, academic_year, is_published)
         VALUES (?, ?, ?, ?, ?, ?, 0)
         ON DUPLICATE KEY UPDATE grade = VALUES(grade), grade_point = VALUES(grade_point)`,
        [student_id, course_id, grade.toUpperCase(), gradeToPoint(grade), semester, academic_year]
      );
      inserted++;
    } catch (err) {
      errors.push({ row: r, error: err.message });
    }
  }
  await logActivity(req.user.role, req.user.userId, 'RESULTS_BULK_UPLOADED', `${inserted} rows`, req.ip);
  res.json({ success: true, message: `${inserted} result(s) saved`, errors });
}

async function updateResult(req, res) {
  const { grade } = req.body;
  if (!grade) return res.status(400).json({ success: false, message: 'grade is required' });
  await pool.query(
    `UPDATE results SET grade = ?, grade_point = ? WHERE result_id = ?`,
    [grade.toUpperCase(), gradeToPoint(grade), req.params.id]
  );
  await logActivity(req.user.role, req.user.userId, 'RESULT_UPDATED', `ID ${req.params.id}`, req.ip);
  res.json({ success: true, message: 'Result updated successfully' });
}

async function publishResults(req, res) {
  const { result_ids, course_id, semester, academic_year } = req.body;
  if (Array.isArray(result_ids) && result_ids.length > 0) {
    await pool.query(
      `UPDATE results SET is_published = 1 WHERE result_id IN (?)`,
      [result_ids]
    );
  } else if (course_id && semester && academic_year) {
    await pool.query(
      `UPDATE results SET is_published = 1 WHERE course_id = ? AND semester = ? AND academic_year = ?`,
      [course_id, semester, academic_year]
    );
  } else {
    return res.status(400).json({ success: false, message: 'Provide result_ids OR course_id+semester+academic_year' });
  }
  await logActivity(req.user.role, req.user.userId, 'RESULTS_PUBLISHED', JSON.stringify(req.body), req.ip);
  res.json({ success: true, message: 'Results published successfully' });
}

async function deleteResult(req, res) {
  await pool.query(`DELETE FROM results WHERE result_id = ?`, [req.params.id]);
  res.json({ success: true, message: 'Result deleted successfully' });
}

module.exports = { listResults, uploadResult, bulkUploadResults, updateResult, publishResults, deleteResult };
