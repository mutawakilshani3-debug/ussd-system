const { pool } = require('../config/db');
const { hashValue, normalizePhone, logActivity } = require('../utils/helpers');

async function listStudents(req, res) {
  const { search } = req.query;
  let sql = `SELECT student_id, index_number, full_name, phone_number, programme, level, department, is_active, created_at FROM students`;
  const params = [];
  if (search) {
    sql += ` WHERE full_name LIKE ? OR index_number LIKE ? OR phone_number LIKE ?`;
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  sql += ` ORDER BY full_name ASC`;
  const [rows] = await pool.query(sql, params);
  res.json({ success: true, data: rows });
}

async function getStudent(req, res) {
  const [rows] = await pool.query(
    `SELECT student_id, index_number, full_name, phone_number, programme, level, department, is_active, created_at FROM students WHERE student_id = ?`,
    [req.params.id]
  );
  if (rows.length === 0) return res.status(404).json({ success: false, message: 'Student not found' });
  res.json({ success: true, data: rows[0] });
}

async function addStudent(req, res) {
  const { index_number, full_name, phone_number, programme, level, department, pin } = req.body;
  if (!index_number || !full_name || !phone_number || !programme || !level || !department || !pin) {
    return res.status(400).json({ success: false, message: 'All fields are required' });
  }
  const hashedPin = await hashValue(String(pin));
  try {
    const [result] = await pool.query(
      `INSERT INTO students (index_number, full_name, phone_number, programme, level, department, password_pin)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [index_number, full_name, normalizePhone(phone_number), programme, level, department, hashedPin]
    );
    await logActivity(req.user.role, req.user.userId, 'STUDENT_ADDED', index_number, req.ip);
    res.status(201).json({ success: true, data: { student_id: result.insertId } });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'A student with this index number or phone already exists' });
    }
    throw err;
  }
}

async function updateStudent(req, res) {
  const { full_name, phone_number, programme, level, department, is_active, pin } = req.body;
  const fields = [];
  const params = [];
  if (full_name) { fields.push('full_name = ?'); params.push(full_name); }
  if (phone_number) { fields.push('phone_number = ?'); params.push(normalizePhone(phone_number)); }
  if (programme) { fields.push('programme = ?'); params.push(programme); }
  if (level) { fields.push('level = ?'); params.push(level); }
  if (department) { fields.push('department = ?'); params.push(department); }
  if (is_active !== undefined) { fields.push('is_active = ?'); params.push(is_active ? 1 : 0); }
  if (pin) { fields.push('password_pin = ?'); params.push(await hashValue(String(pin))); }

  if (fields.length === 0) return res.status(400).json({ success: false, message: 'No fields to update' });

  params.push(req.params.id);
  await pool.query(`UPDATE students SET ${fields.join(', ')} WHERE student_id = ?`, params);
  await logActivity(req.user.role, req.user.userId, 'STUDENT_UPDATED', `ID ${req.params.id}`, req.ip);
  res.json({ success: true, message: 'Student updated successfully' });
}

async function deleteStudent(req, res) {
  await pool.query(`DELETE FROM students WHERE student_id = ?`, [req.params.id]);
  await logActivity(req.user.role, req.user.userId, 'STUDENT_DELETED', `ID ${req.params.id}`, req.ip);
  res.json({ success: true, message: 'Student deleted successfully' });
}

module.exports = { listStudents, getStudent, addStudent, updateStudent, deleteStudent };
