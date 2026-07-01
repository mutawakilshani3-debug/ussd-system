const express = require('express');
const router = express.Router();
const { handleUssd } = require('../controllers/ussdController');
const { ussdLimiter } = require('../middleware/security');

// Africa's Talking POSTs application/x-www-form-urlencoded to this endpoint
router.post('/', ussdLimiter, handleUssd);

module.exports = router;
