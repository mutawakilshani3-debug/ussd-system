const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/examController');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate);

router.get('/', ctrl.listExams);
router.post('/', requireRole('admin'), ctrl.addExam);
router.put('/:id', requireRole('admin'), ctrl.updateExam);
router.delete('/:id', requireRole('admin'), ctrl.deleteExam);

module.exports = router;
