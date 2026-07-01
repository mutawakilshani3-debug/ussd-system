const { pool } = require('../config/db');
const { logActivity } = require('../utils/helpers');

async function listCourses(req, res) {
  const [rows] = await pool.query(
    `SELECT c.*, u.full_name AS lecturer_name FROM courses c
     LEFT JOIN users u ON c.lecturer_id = u.user_id ORDER BY c.course_code ASC`
  );
  res.json({ success: true, data: rows });
}

async function addCourse(req, res) {
  const { course_code, course_name, credit_hours, lecturer_id } = req.body;
  if (!course_code || !course_name) {
    return res.status(400).json({ success: false, message: 'Course code and name are required' });
  }
  try {
    const [result] = await pool.query(
      `INSERT INTO courses (course_code, course_name, credit_hours, lecturer_id) VALUES (?, ?, ?, ?)`,
      [course_code, course_name, credit_hours || 3, lecturer_id || null]
    );
    await logActivity(req.user.role, req.user.userId, 'COURSE_ADDED', course_code, req.ip);
    res.status(201).json({ success: true, data: { course_id: result.insertId } });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Course code already exists' });
    }
    throw err;
  }
}

async function updateCourse(req, res) {
  const { course_name, credit_hours, lecturer_id } = req.body;
  const fields = [];
  const params = [];
  if (course_name) { fields.push('course_name = ?'); params.push(course_name); }
  if (credit_hours) { fields.push('credit_hours = ?'); params.push(credit_hours); }
  if (lecturer_id !== undefined) { fields.push('lecturer_id = ?'); params.push(lecturer_id || null); }
  if (fields.length === 0) return res.status(400).json({ success: false, message: 'No fields to update' });
  params.push(req.params.id);
  await pool.query(`UPDATE courses SET ${fields.join(', ')} WHERE course_id = ?`, params);
  await logActivity(req.user.role, req.user.userId, 'COURSE_UPDATED', `ID ${req.params.id}`, req.ip);
  res.json({ success: true, message: 'Course updated successfully' });
}

async function deleteCourse(req, res) {
  await pool.query(`DELETE FROM courses WHERE course_id = ?`, [req.params.id]);
  await logActivity(req.user.role, req.user.userId, 'COURSE_DELETED', `ID ${req.params.id}`, req.ip);
  res.json({ success: true, message: 'Course deleted successfully' });
}

async function enrollStudent(req, res) {
  const { student_id, course_id, academic_year, semester } = req.body;
  if (!student_id || !course_id || !academic_year || !semester) {
    return res.status(400).json({ success: false, message: 'student_id, course_id, academic_year and semester are required' });
  }
  try {
    await pool.query(
      `INSERT INTO enrollments (student_id, course_id, academic_year, semester) VALUES (?, ?, ?, ?)`,
      [student_id, course_id, academic_year, semester]
    );
    res.status(201).json({ success: true, message: 'Student enrolled successfully' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Student already enrolled in this course for this period' });
    }
    throw err;
  }
}

module.exports = { listCourses, addCourse, updateCourse, deleteCourse, enrollStudent };
