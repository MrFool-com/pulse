const mongoose = require('mongoose');

// Points to the same 'users' collection as UserSphere.
// Pulse only reads for login + access control. Never writes profiles.

const userSchema = new mongoose.Schema(
  {
    email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role:     { type: String, default: 'user' }, // 'user' | 'admin'

    // ── Pulse access fields ───────────────────────────────────
    isPulseApproved: { type: Boolean, default: false },

    // Filled when user submits an access request
    pulseRequestReason: { type: String, default: null },
    pulseRequestedAt:   { type: Date,   default: null },

    // Set when admin approves or revokes
    pulseApprovedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);