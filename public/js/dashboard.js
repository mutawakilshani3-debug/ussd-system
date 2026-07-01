/* ============================================================
   CKT-UTAS USSD Academic Portal – Admin Dashboard JS
   ============================================================ */

// ─── State ───────────────────────────────────────────────────
let token = localStorage.getItem('jwt_token') || null;
let currentUser = null;
let currentSection = 'dashboard';
let selectedResultIds = new Set();
let simSessionId = null;
let simText = '';
let simPhoneNumber = '233241234567';
let currentReportSessionId = null;

// ─── Utilities ───────────────────────────────────────────────
const $ = id => document.getElementById(id);
const API = path => `/api${path}`;

async function apiFetch(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(API(path), { ...opts, headers });
  if (res.status === 401) { doLogout(); return null; }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
    throw new Error(err.message || 'Request failed');
  }
  return res.json();
}

function fmt(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' });
}
function fmtDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB');
}
function badge(text, type) {
  return `<span class="badge badge-${type}">${text}</span>`;
}
function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ─── Auth ─────────────────────────────────────────────────────
$('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = $('loginBtn');
  const errEl = $('loginError');
  errEl.style.display = 'none';
  btn.textContent = 'Logging in…';
  btn.disabled = true;
  try {
    const res = await fetch(API('/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: $('loginUsername').value.trim(), password: $('loginPassword').value })
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'Login failed');
    token = data.token;
    currentUser = data.user;
    localStorage.setItem('jwt_token', token);
    localStorage.setItem('jwt_user', JSON.stringify(currentUser));
    showApp();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.style.display = 'block';
  } finally {
    btn.textContent = 'Login';
    btn.disabled = false;
  }
});

function doLogout() {
  token = null;
  currentUser = null;
  localStorage.removeItem('jwt_token');
  localStorage.removeItem('jwt_user');
  $('appWrapper').style.display = 'none';
  $('loginScreen').style.display = 'flex';
  $('loginPassword').value = '';
}

$('logoutBtn').addEventListener('click', doLogout);

function showApp() {
  $('loginScreen').style.display = 'none';
  $('appWrapper').style.display = 'flex';
  const u = currentUser || JSON.parse(localStorage.getItem('jwt_user') || '{}');
  $('sidebarUser').textContent = `${u.fullName || u.username} (${u.role})`;
  $('topbarUser').textContent = u.fullName || u.username;
  navigateTo('dashboard');
}

// ─── Navigation ───────────────────────────────────────────────
document.querySelectorAll('.nav-item').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    navigateTo(link.dataset.section);
    if (window.innerWidth <= 768) $('sidebar').classList.remove('open');
  });
});

$('menuToggle').addEventListener('click', () => $('sidebar').classList.toggle('open'));

const sectionTitles = {
  dashboard: 'Dashboard', students: 'Students', courses: 'Courses',
  results: 'Results', exams: 'Examinations', attendance: 'Attendance',
  simulator: 'USSD Simulator', logs: 'Activity Logs'
};

function navigateTo(section) {
  currentSection = section;
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(l => l.classList.remove('active'));
  const secEl = $(`sec-${section}`);
  if (secEl) secEl.classList.add('active');
  const navEl = document.querySelector(`.nav-item[data-section="${section}"]`);
  if (navEl) navEl.classList.add('active');
  $('topbarTitle').textContent = sectionTitles[section] || section;
  loadSection(section);
}

async function loadSection(section) {
  try {
    switch (section) {
      case 'dashboard': loadDashboard(); break;
      case 'students': loadStudents(); break;
      case 'courses': loadCourses(); break;
      case 'results': loadResults(); loadCoursesIntoFilter(); break;
      case 'exams': loadExams(); break;
      case 'attendance': loadAttendanceCourses(); loadSessions(); break;
      case 'logs': loadLogs(); break;
    }
  } catch (err) { console.error('Section load error:', err); }
}

// ─── DASHBOARD ────────────────────────────────────────────────
async function loadDashboard() {
  const data = await apiFetch('/dashboard/stats');
  if (!data) return;
  const s = data.data;
  $('statStudents').textContent = s.totalStudents;
  $('statCourses').textContent = s.totalCourses;
  $('statSessions').textContent = s.activeSessions;
  $('statAttToday').textContent = s.totalAttendanceToday;
  const tbody = $('recentLogsTbody');
  tbody.innerHTML = s.recentLogs.map(l => `
    <tr>
      <td>${badge(l.action, 'primary')}</td>
      <td>${escHtml(l.actor_type)} #${escHtml(l.actor_id)}</td>
      <td>${escHtml(l.details)}</td>
      <td>${fmt(l.created_at)}</td>
    </tr>`).join('');
}

// ─── STUDENTS ─────────────────────────────────────────────────
async function loadStudents(search = '') {
  const q = search ? `?search=${encodeURIComponent(search)}` : '';
  const data = await apiFetch(`/students${q}`);
  if (!data) return;
  $('studentsTbody').innerHTML = data.data.map(s => `
    <tr>
      <td>${escHtml(s.index_number)}</td>
      <td>${escHtml(s.full_name)}</td>
      <td>${escHtml(s.programme)}</td>
      <td>${escHtml(s.level)}</td>
      <td>${escHtml(s.phone_number)}</td>
      <td>${s.is_active ? badge('Active','success') : badge('Inactive','danger')}</td>
      <td>
        <button class="btn btn-sm btn-secondary" onclick="openEditStudent(${s.student_id})">Edit</button>
        <button class="btn btn-sm btn-danger" onclick="deleteStudent(${s.student_id},'${escHtml(s.full_name)}')">Del</button>
      </td>
    </tr>`).join('') || '<tr><td colspan="7" style="text-align:center;color:#64748b;">No students found</td></tr>';
}

$('btnStudentSearch').addEventListener('click', () => loadStudents($('studentSearch').value));
$('studentSearch').addEventListener('keydown', e => { if (e.key === 'Enter') loadStudents($('studentSearch').value); });

$('btnAddStudent').addEventListener('click', () => {
  openModal('Add Student', `
    <div class="form-group"><label>Index Number</label><input type="text" id="fs_index" placeholder="DIT/2024/001" /></div>
    <div class="form-group"><label>Full Name</label><input type="text" id="fs_name" /></div>
    <div class="form-group"><label>Phone Number</label><input type="text" id="fs_phone" placeholder="233XXXXXXXXX" /></div>
    <div class="form-group"><label>Programme</label><input type="text" id="fs_prog" /></div>
    <div class="form-group"><label>Level</label><input type="text" id="fs_level" placeholder="100, 200, 300…" /></div>
    <div class="form-group"><label>Department</label><input type="text" id="fs_dept" /></div>
    <div class="form-group"><label>PIN (4–6 digits)</label><input type="text" id="fs_pin" placeholder="e.g. 1234" /></div>
    <div id="modalErr" class="alert alert-error" style="display:none"></div>
  `, async () => {
    const body = { index_number: $('fs_index').value.trim(), full_name: $('fs_name').value.trim(),
      phone_number: $('fs_phone').value.trim(), programme: $('fs_prog').value.trim(),
      level: $('fs_level').value.trim(), department: $('fs_dept').value.trim(), pin: $('fs_pin').value.trim() };
    try {
      await apiFetch('/students', { method: 'POST', body: JSON.stringify(body) });
      closeModal(); loadStudents();
    } catch (err) { showModalErr(err.message); }
  });
});

async function openEditStudent(id) {
  const data = await apiFetch(`/students/${id}`);
  if (!data) return;
  const s = data.data;
  openModal('Edit Student', `
    <div class="form-group"><label>Full Name</label><input type="text" id="es_name" value="${escHtml(s.full_name)}" /></div>
    <div class="form-group"><label>Phone Number</label><input type="text" id="es_phone" value="${escHtml(s.phone_number)}" /></div>
    <div class="form-group"><label>Programme</label><input type="text" id="es_prog" value="${escHtml(s.programme)}" /></div>
    <div class="form-group"><label>Level</label><input type="text" id="es_level" value="${escHtml(s.level)}" /></div>
    <div class="form-group"><label>Department</label><input type="text" id="es_dept" value="${escHtml(s.department)}" /></div>
    <div class="form-group"><label>New PIN (leave blank to keep)</label><input type="text" id="es_pin" placeholder="Optional" /></div>
    <div class="form-group"><label>Status</label><select id="es_active"><option value="1" ${s.is_active ? 'selected' : ''}>Active</option><option value="0" ${!s.is_active ? 'selected' : ''}>Inactive</option></select></div>
    <div id="modalErr" class="alert alert-error" style="display:none"></div>
  `, async () => {
    const body = { full_name: $('es_name').value.trim(), phone_number: $('es_phone').value.trim(),
      programme: $('es_prog').value.trim(), level: $('es_level').value.trim(),
      department: $('es_dept').value.trim(), is_active: $('es_active').value === '1' };
    const pin = $('es_pin').value.trim();
    if (pin) body.pin = pin;
    try {
      await apiFetch(`/students/${id}`, { method: 'PUT', body: JSON.stringify(body) });
      closeModal(); loadStudents();
    } catch (err) { showModalErr(err.message); }
  });
}

async function deleteStudent(id, name) {
  if (!confirm(`Delete student "${name}"? This cannot be undone.`)) return;
  await apiFetch(`/students/${id}`, { method: 'DELETE' });
  loadStudents();
}

// ─── COURSES ──────────────────────────────────────────────────
async function loadCourses() {
  const data = await apiFetch('/courses');
  if (!data) return;
  $('coursesTbody').innerHTML = data.data.map(c => `
    <tr>
      <td>${escHtml(c.course_code)}</td>
      <td>${escHtml(c.course_name)}</td>
      <td>${c.credit_hours}</td>
      <td>${escHtml(c.lecturer_name || '—')}</td>
      <td>
        <button class="btn btn-sm btn-secondary" onclick="openEditCourse(${c.course_id},'${escHtml(c.course_name)}',${c.credit_hours})">Edit</button>
        <button class="btn btn-sm btn-danger" onclick="deleteCourse(${c.course_id},'${escHtml(c.course_code)}')">Del</button>
      </td>
    </tr>`).join('') || '<tr><td colspan="5" style="text-align:center;color:#64748b;">No courses found</td></tr>';
}

$('btnAddCourse').addEventListener('click', () => {
  openModal('Add Course', `
    <div class="form-group"><label>Course Code</label><input type="text" id="fc_code" placeholder="e.g. DIT 202" /></div>
    <div class="form-group"><label>Course Name</label><input type="text" id="fc_name" /></div>
    <div class="form-group"><label>Credit Hours</label><input type="number" id="fc_credits" value="3" min="1" /></div>
    <div id="modalErr" class="alert alert-error" style="display:none"></div>
  `, async () => {
    try {
      await apiFetch('/courses', { method: 'POST', body: JSON.stringify({
        course_code: $('fc_code').value.trim(), course_name: $('fc_name').value.trim(),
        credit_hours: parseInt($('fc_credits').value) || 3
      })});
      closeModal(); loadCourses();
    } catch (err) { showModalErr(err.message); }
  });
});

function openEditCourse(id, name, credits) {
  openModal('Edit Course', `
    <div class="form-group"><label>Course Name</label><input type="text" id="ec_name" value="${escHtml(name)}" /></div>
    <div class="form-group"><label>Credit Hours</label><input type="number" id="ec_credits" value="${credits}" min="1" /></div>
    <div id="modalErr" class="alert alert-error" style="display:none"></div>
  `, async () => {
    try {
      await apiFetch(`/courses/${id}`, { method: 'PUT', body: JSON.stringify({
        course_name: $('ec_name').value.trim(), credit_hours: parseInt($('ec_credits').value) || 3
      })});
      closeModal(); loadCourses();
    } catch (err) { showModalErr(err.message); }
  });
}

async function deleteCourse(id, code) {
  if (!confirm(`Delete course "${code}"?`)) return;
  await apiFetch(`/courses/${id}`, { method: 'DELETE' });
  loadCourses();
}

// ─── RESULTS ──────────────────────────────────────────────────
async function loadResults() {
  const courseId = $('filterResultCourse').value;
  const semester = $('filterResultSemester').value;
  const year = $('filterResultYear').value.trim();
  let q = new URLSearchParams();
  if (courseId) q.set('course_id', courseId);
  if (semester) q.set('semester', semester);
  if (year) q.set('academic_year', year);
  const data = await apiFetch(`/results?${q}`);
  if (!data) return;
  $('resultsTbody').innerHTML = data.data.map(r => `
    <tr>
      <td><input type="checkbox" class="result-cb" data-id="${r.result_id}" ${selectedResultIds.has(r.result_id) ? 'checked' : ''} /></td>
      <td>${escHtml(r.full_name)}</td>
      <td>${escHtml(r.index_number)}</td>
      <td>${escHtml(r.course_code)}</td>
      <td><strong>${escHtml(r.grade)}</strong></td>
      <td>${r.semester}</td>
      <td>${escHtml(r.academic_year)}</td>
      <td>${r.is_published ? badge('Yes','success') : badge('No','warning')}</td>
      <td>
        <button class="btn btn-sm btn-secondary" onclick="openEditResult(${r.result_id},'${escHtml(r.grade)}')">Edit</button>
        <button class="btn btn-sm btn-danger" onclick="deleteResult(${r.result_id})">Del</button>
      </td>
    </tr>`).join('') || '<tr><td colspan="9" style="text-align:center;color:#64748b;">No results found</td></tr>';

  document.querySelectorAll('.result-cb').forEach(cb => {
    cb.addEventListener('change', () => {
      const id = parseInt(cb.dataset.id);
      cb.checked ? selectedResultIds.add(id) : selectedResultIds.delete(id);
    });
  });
}

$('selectAllResults').addEventListener('change', function() {
  document.querySelectorAll('.result-cb').forEach(cb => {
    cb.checked = this.checked;
    const id = parseInt(cb.dataset.id);
    this.checked ? selectedResultIds.add(id) : selectedResultIds.delete(id);
  });
});

$('btnFilterResults').addEventListener('click', loadResults);

async function loadCoursesIntoFilter() {
  const data = await apiFetch('/courses');
  if (!data) return;
  const sel = $('filterResultCourse');
  const current = sel.value;
  sel.innerHTML = '<option value="">All Courses</option>' + data.data.map(c =>
    `<option value="${c.course_id}" ${current == c.course_id ? 'selected' : ''}>${escHtml(c.course_code)}</option>`).join('');
}

$('btnAddResult').addEventListener('click', async () => {
  const courses = (await apiFetch('/courses'))?.data || [];
  openModal('Add Result', `
    <div class="form-group"><label>Student ID or Index Number</label><input type="text" id="fr_student" placeholder="DIT/2023/001 or numeric ID" /></div>
    <div class="form-group"><label>Course</label>
      <select id="fr_course">${courses.map(c => `<option value="${c.course_id}">${escHtml(c.course_code)}</option>`).join('')}</select>
    </div>
    <div class="form-group"><label>Grade</label>
      <select id="fr_grade"><option>A</option><option>B+</option><option>B</option><option>C+</option><option>C</option><option>D+</option><option>D</option><option>E</option><option>F</option></select>
    </div>
    <div class="form-group"><label>Semester</label>
      <select id="fr_sem"><option value="1">1</option><option value="2">2</option></select>
    </div>
    <div class="form-group"><label>Academic Year</label><input type="text" id="fr_year" placeholder="2024/2025" value="2024/2025" /></div>
    <div id="modalErr" class="alert alert-error" style="display:none"></div>
  `, async () => {
    const studentInput = $('fr_student').value.trim();
    // Resolve student ID if index_number given
    let studentId = parseInt(studentInput);
    if (isNaN(studentId)) {
      const sd = await apiFetch(`/students?search=${encodeURIComponent(studentInput)}`);
      if (!sd || sd.data.length === 0) { showModalErr('Student not found'); return; }
      studentId = sd.data[0].student_id;
    }
    try {
      await apiFetch('/results', { method: 'POST', body: JSON.stringify({
        student_id: studentId, course_id: parseInt($('fr_course').value),
        grade: $('fr_grade').value, semester: $('fr_sem').value, academic_year: $('fr_year').value.trim()
      })});
      closeModal(); loadResults();
    } catch (err) { showModalErr(err.message); }
  });
});

function openEditResult(id, currentGrade) {
  openModal('Edit Result', `
    <div class="form-group"><label>Grade</label>
      <select id="er_grade">
        ${['A','B+','B','C+','C','D+','D','E','F'].map(g => `<option ${g === currentGrade ? 'selected' : ''}>${g}</option>`).join('')}
      </select>
    </div>
    <div id="modalErr" class="alert alert-error" style="display:none"></div>
  `, async () => {
    try {
      await apiFetch(`/results/${id}`, { method: 'PUT', body: JSON.stringify({ grade: $('er_grade').value }) });
      closeModal(); loadResults();
    } catch (err) { showModalErr(err.message); }
  });
}

$('btnPublishResults').addEventListener('click', async () => {
  if (selectedResultIds.size === 0) { alert('Select at least one result to publish.'); return; }
  if (!confirm(`Publish ${selectedResultIds.size} result(s)?`)) return;
  await apiFetch('/results/publish', { method: 'POST', body: JSON.stringify({ result_ids: [...selectedResultIds] }) });
  selectedResultIds.clear();
  loadResults();
});

async function deleteResult(id) {
  if (!confirm('Delete this result?')) return;
  await apiFetch(`/results/${id}`, { method: 'DELETE' });
  loadResults();
}

// ─── EXAMS ────────────────────────────────────────────────────
async function loadExams() {
  const data = await apiFetch('/exams');
  if (!data) return;
  $('examsTbody').innerHTML = data.data.map(e => `
    <tr>
      <td>${escHtml(e.course_code)} – ${escHtml(e.course_name)}</td>
      <td>${fmtDate(e.exam_date)}</td>
      <td>${e.exam_time}</td>
      <td>${escHtml(e.venue)}</td>
      <td>${escHtml(e.instructions || '—')}</td>
      <td>
        <button class="btn btn-sm btn-danger" onclick="deleteExam(${e.exam_id})">Del</button>
      </td>
    </tr>`).join('') || '<tr><td colspan="6" style="text-align:center;color:#64748b;">No exams scheduled</td></tr>';
}

$('btnAddExam').addEventListener('click', async () => {
  const courses = (await apiFetch('/courses'))?.data || [];
  openModal('Add Examination', `
    <div class="form-group"><label>Course</label>
      <select id="fe_course">${courses.map(c => `<option value="${c.course_id}">${escHtml(c.course_code)} – ${escHtml(c.course_name)}</option>`).join('')}</select>
    </div>
    <div class="form-group"><label>Venue</label><input type="text" id="fe_venue" placeholder="e.g. ICT LAB 2" /></div>
    <div class="form-group"><label>Date</label><input type="date" id="fe_date" /></div>
    <div class="form-group"><label>Time</label><input type="time" id="fe_time" /></div>
    <div class="form-group"><label>Instructions</label><textarea id="fe_instr" rows="3" placeholder="Optional…"></textarea></div>
    <div id="modalErr" class="alert alert-error" style="display:none"></div>
  `, async () => {
    try {
      await apiFetch('/exams', { method: 'POST', body: JSON.stringify({
        course_id: parseInt($('fe_course').value), venue: $('fe_venue').value.trim(),
        exam_date: $('fe_date').value, exam_time: $('fe_time').value,
        instructions: $('fe_instr').value.trim()
      })});
      closeModal(); loadExams();
    } catch (err) { showModalErr(err.message); }
  });
});

async function deleteExam(id) {
  if (!confirm('Delete this exam?')) return;
  await apiFetch(`/exams/${id}`, { method: 'DELETE' });
  loadExams();
}

// ─── ATTENDANCE ───────────────────────────────────────────────
async function loadAttendanceCourses() {
  const data = await apiFetch('/courses');
  if (!data) return;
  const sel = $('attCourseSelect');
  sel.innerHTML = data.data.map(c => `<option value="${c.course_id}">${escHtml(c.course_code)} – ${escHtml(c.course_name)}</option>`).join('');
}

async function loadSessions() {
  const data = await apiFetch('/attendance/sessions');
  if (!data) return;
  $('sessionsTbody').innerHTML = data.data.map(s => {
    const statusBadge = s.status === 'active' ? badge('Active','success') : s.status === 'expired' ? badge('Expired','warning') : badge('Closed','muted');
    return `<tr>
      <td>${escHtml(s.course_code)}</td>
      <td><code>${escHtml(s.attendance_code)}</code></td>
      <td>${fmt(s.end_time)}</td>
      <td>${s.attendance_count}</td>
      <td>${statusBadge}</td>
      <td>
        <button class="btn btn-sm btn-secondary" onclick="viewReport(${s.session_id},'${escHtml(s.course_code)}')">Report</button>
        ${s.status === 'active' ? `<button class="btn btn-sm btn-danger" onclick="closeSession(${s.session_id})">Close</button>` : ''}
      </td>
    </tr>`;
  }).join('') || '<tr><td colspan="6" style="text-align:center;color:#64748b;">No sessions found</td></tr>';
}

$('btnCreateSession').addEventListener('click', async () => {
  const courseId = $('attCourseSelect').value;
  const window = parseInt($('attWindowMin').value) || 20;
  if (!courseId) { alert('Select a course first.'); return; }
  try {
    const data = await apiFetch('/attendance/sessions', {
      method: 'POST', body: JSON.stringify({ course_id: parseInt(courseId), window_minutes: window })
    });
    if (!data) return;
    const s = data.data;
    const box = $('sessionResult');
    box.innerHTML = `
      <div class="code">${s.attendance_code}</div>
      <div class="meta">Valid until ${fmt(s.end_time)} · Share this code with students in the classroom</div>
    `;
    box.style.display = 'block';
    loadSessions();
  } catch (err) { alert(err.message); }
});

async function closeSession(id) {
  if (!confirm('Close this attendance session?')) return;
  await apiFetch(`/attendance/sessions/${id}/close`, { method: 'PUT' });
  loadSessions();
}

async function viewReport(id, label) {
  currentReportSessionId = id;
  $('reportSessionLabel').textContent = label;
  const data = await apiFetch(`/attendance/sessions/${id}/report`);
  if (!data) return;
  $('reportTbody').innerHTML = data.data.map(r => `
    <tr>
      <td>${escHtml(r.index_number)}</td>
      <td>${escHtml(r.full_name)}</td>
      <td>${escHtml(r.phone_number)}</td>
      <td>${fmt(r.attendance_time)}</td>
      <td>${r.removed_by_lecturer ? badge('Removed','danger') : `<button class="btn btn-sm btn-danger" onclick="removeRecord(${r.attendance_id})">Remove</button>`}</td>
    </tr>`).join('') || '<tr><td colspan="5" style="text-align:center;color:#64748b;">No records</td></tr>';
  $('sessionReportWrap').style.display = 'block';
  $('sessionReportWrap').scrollIntoView({ behavior: 'smooth' });
}

async function removeRecord(id) {
  if (!confirm('Flag and remove this attendance record?')) return;
  await apiFetch(`/attendance/records/${id}/remove`, { method: 'PUT' });
  viewReport(currentReportSessionId, $('reportSessionLabel').textContent);
}

$('btnExportCsv').addEventListener('click', () => {
  if (!currentReportSessionId) return;
  const a = document.createElement('a');
  a.href = API(`/attendance/sessions/${currentReportSessionId}/export`);
  a.click();
});

// ─── USSD SIMULATOR ───────────────────────────────────────────
function simLog(text, dir) {
  const log = $('simLog');
  const entry = document.createElement('div');
  entry.className = `sim-log-entry ${dir}`;
  entry.textContent = dir === 'out' ? `→ ${text}` : `← ${text}`;
  log.appendChild(entry);
  log.scrollTop = log.scrollHeight;
}

$('simDial').addEventListener('click', () => {
  simSessionId = 'SIM-' + Date.now();
  simText = '';
  simPhoneNumber = $('simPhone').value.trim() || '233241234567';
  $('simLog').innerHTML = '';
  $('simInput').value = '';
  simLog(`Dialling *419# from ${simPhoneNumber}`, 'in');
  sendUssd();
});

$('simSend').addEventListener('click', () => {
  if (!simSessionId) { $('simOutput').textContent = 'Dial *419# first.'; return; }
  const input = $('simInput').value.trim();
  if (!input) return;
  simText = simText === '' ? input : simText + '*' + input;
  simLog(input, 'in');
  $('simInput').value = '';
  sendUssd();
});

$('simEnd').addEventListener('click', () => {
  simSessionId = null;
  simText = '';
  $('simOutput').textContent = 'Session ended by user.';
  simLog('SESSION ENDED', 'in');
});

$('simInput').addEventListener('keydown', e => { if (e.key === 'Enter') $('simSend').click(); });

async function sendUssd() {
  try {
    const res = await fetch('/ussd', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        sessionId: simSessionId,
        serviceCode: '*419#',
        phoneNumber: simPhoneNumber,
        text: simText
      })
    });
    const text = await res.text();
    $('simOutput').textContent = text.replace(/^(CON|END)\s?/, '');
    simLog(text.substring(0, 80), 'out');
    if (text.startsWith('END')) {
      simSessionId = null;
      simText = '';
    }
  } catch (err) {
    $('simOutput').textContent = 'Error: ' + err.message;
  }
}

// ─── LOGS ─────────────────────────────────────────────────────
async function loadLogs() {
  const data = await apiFetch('/dashboard/stats');
  if (!data) return;
  const logs = data.data.recentLogs || [];
  $('logsTbody').innerHTML = logs.length === 0 ? '<tr><td colspan="6" style="text-align:center;color:#64748b;">No logs found</td></tr>' :
    logs.map(l => `<tr>
      <td>${fmt(l.created_at)}</td>
      <td>${escHtml(l.actor_id)}</td>
      <td>${badge(l.actor_type, 'primary')}</td>
      <td>${escHtml(l.action)}</td>
      <td>${escHtml(l.details)}</td>
      <td>${escHtml(l.ip_address)}</td>
    </tr>`).join('');
}

// ─── MODAL HELPERS ────────────────────────────────────────────
let modalSaveHandler = null;
function openModal(title, bodyHtml, onSave) {
  $('modalTitle').textContent = title;
  $('modalBody').innerHTML = bodyHtml;
  $('modal').style.display = 'flex';
  modalSaveHandler = onSave;
}
function closeModal() { $('modal').style.display = 'none'; }
function showModalErr(msg) {
  const el = $('modalErr');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
  else alert(msg);
}
$('modalClose').addEventListener('click', closeModal);
$('modalCancelBtn').addEventListener('click', closeModal);
$('modalSaveBtn').addEventListener('click', () => { if (modalSaveHandler) modalSaveHandler(); });
$('modal').addEventListener('click', e => { if (e.target === $('modal')) closeModal(); });

// ─── Init ─────────────────────────────────────────────────────
(function init() {
  const savedToken = localStorage.getItem('jwt_token');
  const savedUser = localStorage.getItem('jwt_user');
  if (savedToken && savedUser) {
    token = savedToken;
    currentUser = JSON.parse(savedUser);
    showApp();
  }
})();
