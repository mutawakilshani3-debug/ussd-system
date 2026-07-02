-- =====================================================================
-- Sample seed data for development / testing
-- Default student PIN for all seeded students: 1234
-- (PIN hash below corresponds to bcrypt hash of "1234")
-- Default admin password:Mutawakil  (also seeded via database/init.js)
-- =====================================================================

USE ussd_result_attendance;

-- Sample lecturer/admin users (password also seeded properly by init.js;
-- these rows are placeholders if you want to load schema+seed via SQL client directly)
INSERT INTO users (username, full_name, email, password_hash, role)
VALUES
  ('admin', 'System Administrator', 'admin@ckt-utas.edu.gh', '$2a$10$N9qo8uLOickgx2ZMRZoMy.MqkU2EZqfNZ.0nf5gUTpzlQzVS4lYAW', 'admin'),
  ('jmensah', 'Mr. J. Mensah', 'jmensah@ckt-utas.edu.gh', '$2a$10$N9qo8uLOickgx2ZMRZoMy.MqkU2EZqfNZ.0nf5gUTpzlQzVS4lYAW', 'lecturer')
ON DUPLICATE KEY UPDATE username = username;

-- Sample courses
INSERT INTO courses (course_code, course_name, credit_hours, lecturer_id)
VALUES
  ('DIT 202', 'Software Engineering', 3, 2),
  ('DIT 204', 'Database Management Systems', 3, 2),
  ('DMG 202', 'Digital Marketing Principles', 3, 2)
ON DUPLICATE KEY UPDATE course_code = course_code;

-- Sample students (PIN = 1234 hashed with bcrypt, see note above)
INSERT INTO students (index_number, full_name, phone_number, programme, level, department, password_pin)
VALUES
  ('DIT/2023/001', 'Mutawakil Abdul-Rahman', '233241234567', 'Information Technology', '200', 'Computer Science', '$2a$10$N9qo8uLOickgx2ZMRZoMy.MqkU2EZqfNZ.0nf5gUTpzlQzVS4lYAW'),
  ('DIT/2023/002', 'Ama Serwaa', '233207654321', 'Information Technology', '200', 'Computer Science', '$2a$10$N9qo8uLOickgx2ZMRZoMy.MqkU2EZqfNZ.0nf5gUTpzlQzVS4lYAW')
ON DUPLICATE KEY UPDATE index_number = index_number;

-- Enrollments
INSERT INTO enrollments (student_id, course_id, academic_year, semester)
VALUES
  (1, 1, '2024/2025', '1'), (1, 2, '2024/2025', '1'), (1, 3, '2024/2025', '1'),
  (2, 1, '2024/2025', '1'), (2, 2, '2024/2025', '1')
ON DUPLICATE KEY UPDATE academic_year = academic_year;

-- Sample results
INSERT INTO results (student_id, course_id, grade, grade_point, semester, academic_year, is_published)
VALUES
  (1, 1, 'A', 4.00, '1', '2024/2025', 1),
  (1, 2, 'B+', 3.50, '1', '2024/2025', 1),
  (1, 3, 'A', 4.00, '1', '2024/2025', 1)
ON DUPLICATE KEY UPDATE grade = VALUES(grade);

-- Sample examination
INSERT INTO examinations (course_id, venue, exam_date, exam_time, instructions)
VALUES
  (2, 'ICT LAB 2', '2025-08-15', '09:00:00', 'Bring student ID and writing materials.')
ON DUPLICATE KEY UPDATE venue = venue;
