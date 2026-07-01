-- =====================================================================
-- USSD-Based Student Result Checker and Secure Attendance Management
-- Database Schema (MySQL 8+)
-- =====================================================================

CREATE DATABASE IF NOT EXISTS ussd_result_attendance
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE ussd_result_attendance;

-- ---------------------------------------------------------------------
-- Admins / Lecturers (system users who access the dashboard)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(150) UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin','lecturer') NOT NULL DEFAULT 'lecturer',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- students
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS students (
  student_id INT AUTO_INCREMENT PRIMARY KEY,
  index_number VARCHAR(30) NOT NULL UNIQUE,
  full_name VARCHAR(150) NOT NULL,
  phone_number VARCHAR(20) NOT NULL UNIQUE,
  programme VARCHAR(150) NOT NULL,
  level VARCHAR(10) NOT NULL,
  department VARCHAR(150) NOT NULL,
  password_pin VARCHAR(255) NOT NULL, -- hashed PIN (bcrypt)
  pin_failed_attempts INT DEFAULT 0,
  pin_locked_until DATETIME NULL,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_phone (phone_number),
  INDEX idx_index_number (index_number)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- courses
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS courses (
  course_id INT AUTO_INCREMENT PRIMARY KEY,
  course_code VARCHAR(20) NOT NULL UNIQUE,
  course_name VARCHAR(200) NOT NULL,
  credit_hours INT DEFAULT 3,
  lecturer_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_course_lecturer FOREIGN KEY (lecturer_id) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Many-to-many: which students are enrolled in which course (needed for attendance/results scoping)
CREATE TABLE IF NOT EXISTS enrollments (
  enrollment_id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  course_id INT NOT NULL,
  academic_year VARCHAR(15) NOT NULL,
  semester VARCHAR(10) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_enrollment (student_id, course_id, academic_year, semester),
  CONSTRAINT fk_enroll_student FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
  CONSTRAINT fk_enroll_course FOREIGN KEY (course_id) REFERENCES courses(course_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- results
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS results (
  result_id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  course_id INT NOT NULL,
  grade VARCHAR(5) NOT NULL,
  grade_point DECIMAL(3,2) NOT NULL DEFAULT 0.00,
  semester VARCHAR(10) NOT NULL,
  academic_year VARCHAR(15) NOT NULL,
  is_published TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_result (student_id, course_id, semester, academic_year),
  CONSTRAINT fk_result_student FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
  CONSTRAINT fk_result_course FOREIGN KEY (course_id) REFERENCES courses(course_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- examinations
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS examinations (
  exam_id INT AUTO_INCREMENT PRIMARY KEY,
  course_id INT NOT NULL,
  venue VARCHAR(150) NOT NULL,
  exam_date DATE NOT NULL,
  exam_time TIME NOT NULL,
  instructions TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_exam_course FOREIGN KEY (course_id) REFERENCES courses(course_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- attendance_sessions
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attendance_sessions (
  session_id INT AUTO_INCREMENT PRIMARY KEY,
  course_id INT NOT NULL,
  attendance_code VARCHAR(20) NOT NULL,
  start_time DATETIME NOT NULL,
  end_time DATETIME NOT NULL,
  lecturer_id INT NOT NULL,
  status ENUM('active','closed','expired') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_session_course FOREIGN KEY (course_id) REFERENCES courses(course_id) ON DELETE CASCADE,
  CONSTRAINT fk_session_lecturer FOREIGN KEY (lecturer_id) REFERENCES users(user_id) ON DELETE CASCADE,
  INDEX idx_code (attendance_code),
  INDEX idx_status (status)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- attendance_records
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attendance_records (
  attendance_id INT AUTO_INCREMENT PRIMARY KEY,
  session_id INT NOT NULL,
  student_id INT NOT NULL,
  attendance_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  phone_number VARCHAR(20) NOT NULL,
  is_flagged TINYINT(1) DEFAULT 0,
  removed_by_lecturer TINYINT(1) DEFAULT 0,
  UNIQUE KEY uniq_attendance (session_id, student_id),
  CONSTRAINT fk_att_session FOREIGN KEY (session_id) REFERENCES attendance_sessions(session_id) ON DELETE CASCADE,
  CONSTRAINT fk_att_student FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- activity_logs (security / audit log of all attendance & access activity)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS activity_logs (
  log_id INT AUTO_INCREMENT PRIMARY KEY,
  actor_type ENUM('student','lecturer','admin','system') NOT NULL,
  actor_id VARCHAR(50),
  action VARCHAR(100) NOT NULL,
  details TEXT,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_action (action),
  INDEX idx_created (created_at)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- ussd_sessions (tracks in-progress USSD navigation state per sessionId)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ussd_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id VARCHAR(100) NOT NULL UNIQUE,
  phone_number VARCHAR(20) NOT NULL,
  current_level VARCHAR(50) DEFAULT 'main_menu',
  student_id INT NULL,
  temp_data JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;
