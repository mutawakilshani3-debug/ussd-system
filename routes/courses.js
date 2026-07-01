const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/courseController');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate);

router.get('/', ctrl.listCourses);
router.post('/', requireRole('admin'), ctrl.addCourse);
router.put('/:id', requireRole('admin'), ctrl.updateCourse);
router.delete('/:id', requireRole('admin'), ctrl.deleteCourse);
router.post('/enroll', requireRole('admin', 'lecturer'), ctrl.enrollStudent);

module.exports = router;
