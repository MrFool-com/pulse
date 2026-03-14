const express = require('express');
const router = express.Router();
const { login, requestAccess } = require('../controllers/authController');

// POST /api/pulse/auth/login
router.post('/login', login);

// POST /api/pulse/auth/request-access
router.post('/request-access', requestAccess);

module.exports = router;