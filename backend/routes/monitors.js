const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  getMonitors,
  getMonitor,
  createMonitor,
  updateMonitor,
  deleteMonitor,
  getStats,
} = require('../controllers/monitorController');

// All routes require auth
router.use(auth);

router.get('/', getMonitors);
router.post('/', createMonitor);
router.get('/:id', getMonitor);
router.patch('/:id', updateMonitor);
router.delete('/:id', deleteMonitor);
router.get('/:id/stats', getStats);

module.exports = router;