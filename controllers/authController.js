const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
const { compareValue, logActivity } = require('../utils/helpers');
require('dotenv').config();

async function login(req, res) {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password are required' });
  }

  const [rows] = await pool.query(`SELECT * FROM users WHERE username = ? LIMIT 1`, [username]);
  if (rows.length === 0) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
  const user = rows[0];
  const valid = await compareValue(password, user.password_hash);
  if (!valid) {
    await logActivity('system', username, 'LOGIN_FAILED', 'Invalid password', req.ip);
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  const token = jwt.sign(
    { userId: user.user_id, username: user.username, role: user.role, fullName: user.full_name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );

  await logActivity(user.role, user.user_id, 'LOGIN_SUCCESS', '', req.ip);

  res.json({
    success: true,
    token,
    user: { id: user.user_id, username: user.username, fullName: user.full_name, role: user.role }
  });
}

async function me(req, res) {
  res.json({ success: true, user: req.user });
}

module.exports = { login, me };
