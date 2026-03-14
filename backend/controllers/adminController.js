const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Monitor = require('../models/Monitor');

// ── Admin Login ───────────────────────────────────────────────────────────────
// POST /api/pulse/admin/login
// Same UserSphere credentials — but role must be 'admin'
exports.adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    if (user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access only.' });
    }

    // Issue admin token — same JWT_SECRET, role: 'admin' in payload
    const token = jwt.sign(
      { id: user._id, email: user.email, role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '8h' } // shorter expiry for admin sessions
    );

    res.json({ token });
  } catch (err) {
    console.error('[admin/login]', err);
    res.status(500).json({ message: 'Server error.' });
  }
};


// ── Get all users (with Pulse access status) ──────────────────────────────────
// GET /api/pulse/admin/users
exports.getUsers = async (req, res) => {
  try {
    const users = await User.find({ role: { $nin: ['admin', 'superadmin'] } })
      .select('email isPulseApproved pulseRequestReason pulseRequestedAt pulseApprovedAt createdAt')
      .sort({ pulseRequestedAt: -1, createdAt: -1 })
      .lean();

    // Attach monitor count per user
    const userIds = users.map(u => u._id);
    const monitorCounts = await Monitor.aggregate([
      { $match: { user: { $in: userIds }, isActive: true } },
      { $group: { _id: '$user', count: { $sum: 1 } } },
    ]);

    const countMap = {};
    monitorCounts.forEach(m => { countMap[m._id.toString()] = m.count; });

    const enriched = users.map(u => ({
      ...u,
      monitorCount: countMap[u._id.toString()] || 0,
    }));

    res.json({ users: enriched });
  } catch (err) {
    console.error('[admin/users]', err);
    res.status(500).json({ message: 'Server error.' });
  }
};


// ── Approve access ────────────────────────────────────────────────────────────
// POST /api/pulse/admin/users/:id/approve
exports.approveUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    if (user.role === 'admin' || user.role === 'superadmin') return res.status(400).json({ message: 'Cannot modify admin.' });

    user.isPulseApproved = true;
    user.pulseApprovedAt = new Date();
    await user.save();

    res.json({ message: `Access granted to ${user.email}` });
  } catch (err) {
    console.error('[admin/approve]', err);
    res.status(500).json({ message: 'Server error.' });
  }
};


// ── Revoke access ─────────────────────────────────────────────────────────────
// POST /api/pulse/admin/users/:id/revoke
exports.revokeUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    if (user.role === 'admin' || user.role === 'superadmin') return res.status(400).json({ message: 'Cannot modify admin.' });

    user.isPulseApproved    = false;
    user.pulseApprovedAt    = null;
    user.pulseRequestedAt   = null;
    user.pulseRequestReason = null;
    await user.save();

    // Soft-delete their monitors so they don't run while revoked
    await Monitor.updateMany({ user: user._id }, { isActive: false });

    res.json({ message: `Access revoked for ${user.email}` });
  } catch (err) {
    console.error('[admin/revoke]', err);
    res.status(500).json({ message: 'Server error.' });
  }
};


// ── Stats for admin dashboard header ─────────────────────────────────────────
// GET /api/pulse/admin/stats
exports.getStats = async (req, res) => {
  try {
    const [totalUsers, approvedUsers, pendingUsers, totalMonitors] = await Promise.all([
      User.countDocuments({ role: { $nin: ['admin', 'superadmin'] } }),
      User.countDocuments({ isPulseApproved: true, role: { $nin: ['admin', 'superadmin'] } }),
      User.countDocuments({ pulseRequestedAt: { $ne: null }, isPulseApproved: false, role: { $nin: ['admin', 'superadmin'] } }),
      Monitor.countDocuments({ isActive: true }),
    ]);

    res.json({ totalUsers, approvedUsers, pendingUsers, totalMonitors });
  } catch (err) {
    console.error('[admin/stats]', err);
    res.status(500).json({ message: 'Server error.' });
  }
};