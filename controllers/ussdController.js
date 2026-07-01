const { pool } = require('../config/db');
const { compareValue, normalizePhone, logActivity } = require('../utils/helpers');

/**
 * In-memory session store for USSD navigation state.
 * Africa's Talking sends the full text history each request, so we mostly
 * derive state from `text`, but we cache the authenticated student per
 * sessionId here to avoid re-asking for PIN at every step within a session.
 */
const sessionCache = new Map(); // sessionId -> { studentId, attempts }

function clearSession(sessionId) {
  sessionCache.delete(sessionId);
}

/**
 * Main USSD handler. Africa's Talking POSTs:
 *   sessionId, serviceCode, phoneNumber, text
 * `text` accumulates each step's input separated by '*', e.g. "1*1234*1"
 */
async function handleUssd(req, res) {
  const { sessionId, phoneNumber, text } = req.body;
  const input = (text || '').trim();
  const steps = input === '' ? [] : input.split('*');
  const ip = req.ip;

  let response = '';

  try {
    if (steps.length === 0) {
      // Level 0: main menu
      response = `CON Welcome to CKT-UTAS Student Portal
1. Check Results
2. Attendance
3. Exam Information
4. Student Profile`;
      return res.send(response);
    }

    const mainChoice = steps[0];

    switch (mainChoice) {
      case '1':
        response = await handleResultsFlow(steps, phoneNumber, sessionId);
        break;
      case '2':
        response = await handleAttendanceFlow(steps, phoneNumber, sessionId, ip);
        break;
      case '3':
        response = await handleExamFlow(steps, phoneNumber, sessionId);
        break;
      case '4':
        response = await handleProfileFlow(steps, phoneNumber, sessionId);
        break;
      default:
        response = `END Invalid option selected. Please dial again.`;
    }
  } catch (err) {
    console.error('USSD handler error:', err);
    response = `END A system error occurred. Please try again later.`;
  }

  if (response.startsWith('END')) {
    clearSession(sessionId);
  }

  res.send(response);
}

/** Helper: authenticate a student by ID/PIN. Returns student row or null. */
async function authenticateStudent(studentIdentifier, pin) {
  const [rows] = await pool.query(
    `SELECT * FROM students WHERE (index_number = ? OR student_id = ?) AND is_active = 1 LIMIT 1`,
    [studentIdentifier, studentIdentifier]
  );
  if (rows.length === 0) return null;
  const student = rows[0];

  if (student.pin_locked_until && new Date(student.pin_locked_until) > new Date()) {
    return { locked: true };
  }

  const valid = await compareValue(pin, student.password_pin);
  if (!valid) {
    const attempts = (student.pin_failed_attempts || 0) + 1;
    const lockUntil = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;
    await pool.query(
      `UPDATE students SET pin_failed_attempts = ?, pin_locked_until = ? WHERE student_id = ?`,
      [attempts, lockUntil, student.student_id]
    );
    return null;
  }

  // reset failed attempts on success
  await pool.query(
    `UPDATE students SET pin_failed_attempts = 0, pin_locked_until = NULL WHERE student_id = ?`,
    [student.student_id]
  );
  return student;
}

/** MODULE 1: Check Results -> 1*<studentId>*<pin> */
async function handleResultsFlow(steps, phoneNumber, sessionId) {
  if (steps.length === 1) {
    return `CON Enter your Student ID / Index Number:`;
  }
  if (steps.length === 2) {
    return `CON Enter your PIN:`;
  }
  if (steps.length === 3) {
    const [, studentIdentifier, pin] = steps;
    const student = await authenticateStudent(studentIdentifier, pin);
    if (!student) {
      return `END Invalid Student ID or PIN.`;
    }
    if (student.locked) {
      return `END Account temporarily locked due to multiple failed PIN attempts. Try again later.`;
    }

    const [results] = await pool.query(
      `SELECT r.grade, r.grade_point, c.course_code
       FROM results r JOIN courses c ON r.course_id = c.course_id
       WHERE r.student_id = ? AND r.is_published = 1
       ORDER BY r.academic_year DESC, r.semester DESC`,
      [student.student_id]
    );

    if (results.length === 0) {
      return `END No published results found for your account yet.`;
    }

    let lines = results.map(r => `${r.course_code}: ${r.grade}`).join('\n');
    const totalPoints = results.reduce((sum, r) => sum + parseFloat(r.grade_point), 0);
    const cgpa = (totalPoints / results.length).toFixed(2);

    await logActivity('student', student.student_id, 'CHECK_RESULTS', `via ${phoneNumber}`);

    return `END Your Results:\n${lines}\nCGPA: ${cgpa}`;
  }
  return `END Session ended.`;
}

/** MODULE 2: Attendance -> 2*<courseCode>*<attendanceCode> */
async function handleAttendanceFlow(steps, phoneNumber, sessionId, ip) {
  if (steps.length === 1) {
    return `CON Enter Course Code:`;
  }
  if (steps.length === 2) {
    return `CON Enter Attendance Code:`;
  }
  if (steps.length === 3) {
    const [, courseCode, attendanceCode] = steps;
    const normalizedPhone = normalizePhone(phoneNumber);

    // 1. Verify registered phone number belongs to a student
    const [students] = await pool.query(
      `SELECT * FROM students WHERE phone_number = ? AND is_active = 1 LIMIT 1`,
      [normalizedPhone]
    );
    if (students.length === 0) {
      await logActivity('student', normalizedPhone, 'ATTENDANCE_DENIED', 'Unregistered phone number', ip);
      return `END Attendance Denied. Phone number not registered to any student.`;
    }
    const student = students[0];

    // 2. Verify course exists
    const [courses] = await pool.query(
      `SELECT * FROM courses WHERE course_code = ? LIMIT 1`,
      [courseCode.trim()]
    );
    if (courses.length === 0) {
      return `END Invalid Course Code.`;
    }
    const course = courses[0];

    // 3. Verify there is an ACTIVE session matching course + code
    const [sessions] = await pool.query(
      `SELECT * FROM attendance_sessions
       WHERE course_id = ? AND attendance_code = ? AND status = 'active'
       ORDER BY session_id DESC LIMIT 1`,
      [course.course_id, attendanceCode.trim().toUpperCase()]
    );
    if (sessions.length === 0) {
      await logActivity('student', student.student_id, 'ATTENDANCE_DENIED', 'Invalid attendance code', ip);
      return `END Access Denied. Invalid Attendance Code.`;
    }
    const session = sessions[0];

    // 4. Verify time window (start_time <= now <= end_time)
    const now = new Date();
    if (now < new Date(session.start_time) || now > new Date(session.end_time)) {
      await logActivity('student', student.student_id, 'ATTENDANCE_DENIED', 'Outside attendance window', ip);
      return `END Attendance Session Closed. The attendance window has expired.`;
    }

    // 5. Verify student is enrolled in the course
    const [enrolled] = await pool.query(
      `SELECT * FROM enrollments WHERE student_id = ? AND course_id = ? LIMIT 1`,
      [student.student_id, course.course_id]
    );
    if (enrolled.length === 0) {
      await logActivity('student', student.student_id, 'ATTENDANCE_DENIED', 'Not enrolled in course', ip);
      return `END Access Denied. You are not enrolled in this course.`;
    }

    // 6. Prevent duplicate attendance (UNIQUE constraint also enforces this)
    const [existing] = await pool.query(
      `SELECT * FROM attendance_records WHERE session_id = ? AND student_id = ? LIMIT 1`,
      [session.session_id, student.student_id]
    );
    if (existing.length > 0) {
      return `END Attendance Already Recorded for this session.`;
    }

    // 7. Record attendance
    try {
      await pool.query(
        `INSERT INTO attendance_records (session_id, student_id, phone_number) VALUES (?, ?, ?)`,
        [session.session_id, student.student_id, normalizedPhone]
      );
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return `END Attendance Already Recorded for this session.`;
      }
      throw err;
    }

    await logActivity('student', student.student_id, 'ATTENDANCE_RECORDED', `Course: ${courseCode}`, ip);
    return `END Attendance Recorded for ${courseCode}. Thank you, ${student.full_name.split(' ')[0]}.`;
  }
  return `END Session ended.`;
}

/** MODULE 2 (alt view via Profile menu) — Exam Information -> 3*<courseCode> */
async function handleExamFlow(steps, phoneNumber, sessionId) {
  if (steps.length === 1) {
    return `CON Enter Course Code:`;
  }
  if (steps.length === 2) {
    const courseCode = steps[1].trim();
    const [rows] = await pool.query(
      `SELECT e.*, c.course_code FROM examinations e
       JOIN courses c ON e.course_id = c.course_id
       WHERE c.course_code = ? ORDER BY e.exam_date DESC LIMIT 1`,
      [courseCode]
    );
    if (rows.length === 0) {
      return `END No examination information found for ${courseCode}.`;
    }
    const exam = rows[0];
    const dateStr = new Date(exam.exam_date).toLocaleDateString('en-GB');
    return `END Exam Info - ${exam.course_code}
Date: ${dateStr}
Time: ${exam.exam_time}
Venue: ${exam.venue}`;
  }
  return `END Session ended.`;
}

/** MODULE 3: Student Profile -> 4*<studentId>*<pin> */
async function handleProfileFlow(steps, phoneNumber, sessionId) {
  if (steps.length === 1) {
    return `CON Enter your Student ID / Index Number:`;
  }
  if (steps.length === 2) {
    return `CON Enter your PIN:`;
  }
  if (steps.length === 3) {
    const [, studentIdentifier, pin] = steps;
    const student = await authenticateStudent(studentIdentifier, pin);
    if (!student) {
      return `END Invalid Student ID or PIN.`;
    }
    if (student.locked) {
      return `END Account temporarily locked due to multiple failed PIN attempts. Try again later.`;
    }
    return `END Student Profile
Name: ${student.full_name}
Index No: ${student.index_number}
Programme: ${student.programme}
Level: ${student.level}
Department: ${student.department}`;
  }
  return `END Session ended.`;
}

module.exports = { handleUssd };
