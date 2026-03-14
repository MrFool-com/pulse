const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Resend } = require('resend');
const User = require('../models/User');

const resend = new Resend(process.env.RESEND_API_KEY);

// POST /api/pulse/auth/login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    // Admin + superadmin can always log in — they don't need isPulseApproved
    const isPrivileged = user.role === 'admin' || user.role === 'superadmin';
    if (!isPrivileged && !user.isPulseApproved) {
      return res.status(403).json({
        message: 'Access pending approval. Request access if you haven\'t already.',
        code: 'NOT_APPROVED',
      });
    }

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ token });
  } catch (err) {
    console.error('[auth/login]', err);
    res.status(500).json({ message: 'Server error.' });
  }
};


// POST /api/pulse/auth/request-access
// Anyone can submit — email + reason. Sends notification to admin.
exports.requestAccess = async (req, res) => {
  try {
    const { email, reason } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });

    // Don't leak whether the account exists or not
    if (!user) {
      return res.json({ message: 'If an account exists, your request has been submitted.' });
    }

    if (user.isPulseApproved) {
      return res.status(400).json({ message: 'This account already has access.' });
    }

    if (user.pulseRequestedAt) {
      const hoursSince = (Date.now() - new Date(user.pulseRequestedAt)) / 1000 / 3600;
      if (hoursSince < 24) {
        const hoursLeft = Math.ceil(24 - hoursSince);
        return res.status(400).json({
          message: `Request already submitted. Try again in ${hoursLeft} hour${hoursLeft !== 1 ? 's' : ''}.`
        });
      }
      // 24hrs passed — allow resubmit (reset old request)
    }

    // Save request to user doc
    user.pulseRequestReason = reason?.trim() || null;
    user.pulseRequestedAt   = new Date();
    await user.save();

    // Notify admin via email
    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail) {
      await resend.emails.send({
        from: process.env.ALERT_FROM_EMAIL || 'Pulse <alerts@pulse.spacego.online>',
        to: adminEmail,
        subject: `[Pulse] Access request from ${user.email}`,
        html: `
          <div style="font-family:monospace;background:#09090b;color:#fafafa;padding:32px;border-radius:8px;">
            <p style="font-size:16px;font-weight:600;margin:0 0 16px;">New Pulse Access Request</p>
            <p style="color:#a1a1aa;margin:0 0 8px;">Email: <span style="color:#fafafa;">${user.email}</span></p>
            <p style="color:#a1a1aa;margin:0 0 8px;">Reason: <span style="color:#fafafa;">${reason || 'Not provided'}</span></p>
            <p style="color:#a1a1aa;margin:0 0 24px;">Requested at: <span style="color:#fafafa;">${new Date().toUTCString()}</span></p>
            <a href="${process.env.APP_URL || 'https://pulse.spacego.online'}/admin"
               style="background:#6366f1;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:13px;">
              Review in Admin Panel →
            </a>
          </div>
        `,
      }).catch(e => console.error('[auth/request-access] Email failed:', e.message));
    }

    res.json({ message: 'Access request submitted. You\'ll be notified once approved.' });
  } catch (err) {
    console.error('[auth/request-access]', err);
    res.status(500).json({ message: 'Server error.' });
  }
};