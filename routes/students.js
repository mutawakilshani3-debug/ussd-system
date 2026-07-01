const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/studentController');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate);

router.get('/', ctrl.listStudents);
router.get('/:id', ctrl.getStudent);
router.post('/', requireRole('admin'), ctrl.addStudent);
router.put('/:id', requireRole('admin'), ctrl.updateStudent);
router.delete('/:id', requireRole('admin'), ctrl.deleteStudent);

module.exports = router;
