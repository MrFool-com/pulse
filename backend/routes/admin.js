const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const {
  adminLogin,
  getUsers,
  approveUser,
  revokeUser,
  getStats,
} = require('../controllers/adminController');

// Public — admin login
router.post('/login', adminLogin);

// Protected — all routes below require admin JWT
router.use(adminAuth);

router.get('/stats',              getStats);
router.get('/users',              getUsers);
router.post('/users/:id/approve', approveUser);
router.post('/users/:id/revoke',  revokeUser);

module.exports = router;