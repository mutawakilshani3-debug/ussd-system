const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/attendanceController');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate);
router.use(requireRole('admin', 'lecturer'));

router.post('/sessions', ctrl.createSession);
router.put('/sessions/:id/close', ctrl.closeSession);
router.get('/sessions', ctrl.listSessions);
router.get('/sessions/:id/report', ctrl.getSessionReport);
router.get('/sessions/:id/export', ctrl.exportSessionReport);
router.put('/records/:id/remove', ctrl.removeAttendanceRecord);

module.exports = router;
