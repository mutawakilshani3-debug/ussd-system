const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

const { testConnection } = require('./config/db');
const { apiLimiter, errorHandler } = require('./middleware/security');

const ussdRoutes = require('./routes/ussd');
const authRoutes = require('./routes/auth');
const studentRoutes = require('./routes/students');
const courseRoutes = require('./routes/courses');
const resultRoutes = require('./routes/results');
const examRoutes = require('./routes/exams');
const attendanceRoutes = require('./routes/attendance');
const dashboardRoutes = require('./routes/dashboard');

const app = express();
const PORT = process.env.PORT || 3000;

// Security & parsing middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Africa's Talking sends form-encoded data
app.use(morgan('dev'));

// Serve the admin dashboard frontend
app.use(express.static(path.join(__dirname, 'public')));

// API routes
app.use('/ussd', ussdRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/results', apiLimiter, resultRoutes);
app.use('/api/exams', apiLimiter, examRoutes);
app.use('/api/attendance', apiLimiter, attendanceRoutes);
app.use('/api/dashboard', apiLimiter, dashboardRoutes);

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'USSD Result & Attendance System API is running', time: new Date() });
});

// Fallback to admin dashboard index for any unmatched non-API route
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/ussd')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use(errorHandler);

app.listen(PORT, async () => {
  console.log(`\n========================================================`);
  console.log(` USSD Result & Attendance Management System`);
  console.log(` Server running on http://localhost:${PORT}`);
  console.log(` USSD endpoint:    http://localhost:${PORT}/ussd`);
  console.log(` Admin Dashboard:  http://localhost:${PORT}/`);
  console.log(`========================================================\n`);
  await testConnection();
});

module.exports = app;
