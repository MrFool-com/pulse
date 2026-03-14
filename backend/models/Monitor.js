const mongoose = require('mongoose');

const monitorSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    url: {
      type: String,
      required: true,
      trim: true,
    },

    // How often to ping, in minutes (1–60)
    interval: {
      type: Number,
      default: 5,
      min: 1,
      max: 60,
    },

    // Current live status — updated after every ping
    status: {
      type: String,
      enum: ['up', 'down', 'pending'],
      default: 'pending',
    },

    // Last ping details (cached so dashboard doesn't need a Ping lookup)
    lastCheckedAt: { type: Date, default: null },
    lastResponseTime: { type: Number, default: null }, // ms
    lastStatusCode: { type: Number, default: null },

    // When the current outage started (null if up)
    downtimeSince: { type: Date, default: null },

    // Alert preferences
    alertEmail: {
      type: String,
      trim: true,
      default: null, // null = use account email
    },

    alertOnDown: { type: Boolean, default: true },
    alertOnRecovery: { type: Boolean, default: true },

    // Soft delete / pause
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Monitor', monitorSchema);