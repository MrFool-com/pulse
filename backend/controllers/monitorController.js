const Monitor = require('../models/Monitor');
const Ping = require('../models/Ping');

// ── Helpers ───────────────────────────────────────────────────────────────────

// Calculate uptime % over a time window
async function calcUptime(monitorId, since) {
  const pings = await Ping.find({
    monitor: monitorId,
    checkedAt: { $gte: since },
  }).select('status').lean();

  if (!pings.length) return null;
  const upCount = pings.filter(p => p.status === 'up').length;
  return Math.round((upCount / pings.length) * 10000) / 100; // e.g. 99.82
}

// Get last N pings for response time graph
async function getRecentPings(monitorId, limit = 24) {
  return Ping.find({ monitor: monitorId })
    .sort({ checkedAt: -1 })
    .limit(limit)
    .select('status responseTime checkedAt')
    .lean();
}


// ── Controllers ───────────────────────────────────────────────────────────────

// GET /api/pulse/monitors
exports.getMonitors = async (req, res) => {
  try {
    const monitors = await Monitor.find({ user: req.user.id, isActive: true })
      .sort({ createdAt: -1 })
      .lean();

    res.json({ monitors });
  } catch (err) {
    console.error('[monitors/get]', err);
    res.status(500).json({ message: 'Server error.' });
  }
};


// GET /api/pulse/monitors/:id
exports.getMonitor = async (req, res) => {
  try {
    const monitor = await Monitor.findOne({
      _id: req.params.id,
      user: req.user.id,
      isActive: true,
    }).lean();

    if (!monitor) return res.status(404).json({ message: 'Monitor not found.' });

    const now = Date.now();
    const [uptime24h, uptime7d, uptime30d, recentPings] = await Promise.all([
      calcUptime(monitor._id, new Date(now - 24 * 60 * 60 * 1000)),
      calcUptime(monitor._id, new Date(now - 7 * 24 * 60 * 60 * 1000)),
      calcUptime(monitor._id, new Date(now - 30 * 24 * 60 * 60 * 1000)),
      getRecentPings(monitor._id, 24),
    ]);

    res.json({
      monitor: {
        ...monitor,
        uptime: { h24: uptime24h, d7: uptime7d, d30: uptime30d },
        recentPings: recentPings.reverse(), // oldest first for graph
      },
    });
  } catch (err) {
    console.error('[monitors/getOne]', err);
    res.status(500).json({ message: 'Server error.' });
  }
};


// POST /api/pulse/monitors
exports.createMonitor = async (req, res) => {
  try {
    const { name, url, interval, alertEmail, alertOnDown, alertOnRecovery } = req.body;

    if (!name || !url) {
      return res.status(400).json({ message: 'Name and URL are required.' });
    }

    // Basic URL sanity check
    try { new URL(url); } catch {
      return res.status(400).json({ message: 'Invalid URL format.' });
    }

    const monitor = await Monitor.create({
      user: req.user.id,
      name: name.trim(),
      url: url.trim(),
      interval: Math.min(60, Math.max(1, parseInt(interval) || 5)),
      alertEmail: alertEmail?.trim() || null,
      alertOnDown: alertOnDown !== false,
      alertOnRecovery: alertOnRecovery !== false,
    });

    res.status(201).json({ monitor });
  } catch (err) {
    console.error('[monitors/create]', err);
    res.status(500).json({ message: 'Server error.' });
  }
};


// PATCH /api/pulse/monitors/:id
exports.updateMonitor = async (req, res) => {
  try {
    const { name, url, interval, alertEmail, alertOnDown, alertOnRecovery } = req.body;

    const monitor = await Monitor.findOne({
      _id: req.params.id,
      user: req.user.id,
      isActive: true,
    });

    if (!monitor) return res.status(404).json({ message: 'Monitor not found.' });

    if (url) {
      try { new URL(url); } catch {
        return res.status(400).json({ message: 'Invalid URL format.' });
      }
      monitor.url = url.trim();
    }

    if (name) monitor.name = name.trim();
    if (interval !== undefined) monitor.interval = Math.min(60, Math.max(1, parseInt(interval)));
    if (alertEmail !== undefined) monitor.alertEmail = alertEmail?.trim() || null;
    if (alertOnDown !== undefined) monitor.alertOnDown = alertOnDown;
    if (alertOnRecovery !== undefined) monitor.alertOnRecovery = alertOnRecovery;

    await monitor.save();
    res.json({ monitor });
  } catch (err) {
    console.error('[monitors/update]', err);
    res.status(500).json({ message: 'Server error.' });
  }
};


// DELETE /api/pulse/monitors/:id
exports.deleteMonitor = async (req, res) => {
  try {
    const monitor = await Monitor.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { isActive: false },
      { new: true }
    );

    if (!monitor) return res.status(404).json({ message: 'Monitor not found.' });

    res.json({ message: 'Monitor deleted.' });
  } catch (err) {
    console.error('[monitors/delete]', err);
    res.status(500).json({ message: 'Server error.' });
  }
};


// GET /api/pulse/monitors/:id/stats
// Standalone stats endpoint — called by the graph on the dashboard
exports.getStats = async (req, res) => {
  try {
    const monitor = await Monitor.findOne({
      _id: req.params.id,
      user: req.user.id,
    });
    if (!monitor) return res.status(404).json({ message: 'Monitor not found.' });

    const now = Date.now();
    const [uptime24h, uptime7d, uptime30d, recentPings] = await Promise.all([
      calcUptime(monitor._id, new Date(now - 24 * 60 * 60 * 1000)),
      calcUptime(monitor._id, new Date(now - 7 * 24 * 60 * 60 * 1000)),
      calcUptime(monitor._id, new Date(now - 30 * 24 * 60 * 60 * 1000)),
      getRecentPings(monitor._id, 24),
    ]);

    res.json({
      uptime: { h24: uptime24h, d7: uptime7d, d30: uptime30d },
      recentPings: recentPings.reverse(),
    });
  } catch (err) {
    console.error('[monitors/stats]', err);
    res.status(500).json({ message: 'Server error.' });
  }
};