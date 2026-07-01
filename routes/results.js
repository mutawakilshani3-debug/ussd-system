const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/resultController');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate);

router.get('/', ctrl.listResults);
router.post('/', requireRole('admin', 'lecturer'), ctrl.uploadResult);
router.post('/bulk', requireRole('admin', 'lecturer'), ctrl.bulkUploadResults);
router.put('/:id', requireRole('admin', 'lecturer'), ctrl.updateResult);
router.post('/publish', requireRole('admin'), ctrl.publishResults);
router.delete('/:id', requireRole('admin'), ctrl.deleteResult);

module.exports = router;
