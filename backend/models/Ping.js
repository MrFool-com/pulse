const mongoose = require('mongoose');

const pingSchema = new mongoose.Schema(
  {
    monitor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Monitor',
      required: true,
      index: true,
    },

    // The result
    status: {
      type: String,
      enum: ['up', 'down'],
      required: true,
    },

    statusCode: { type: Number, default: null },   // HTTP status, null if request failed entirely
    responseTime: { type: Number, default: null }, // ms, null if timed out

    // Error message when the request itself failed (network error, timeout, etc.)
    error: { type: String, default: null },

    checkedAt: {
      type: Date,
      default: Date.now,
      // index created by TTL below — don't double-index
    },
  },
  {
    // Don't need updatedAt on ping logs — they're immutable records
    timestamps: { createdAt: 'checkedAt', updatedAt: false },
  }
);

// TTL index — MongoDB auto-deletes pings older than 90 days
// expireAfterSeconds: 7776000 = 90 days
// background:true so it doesn't block on startup
pingSchema.index({ checkedAt: 1 }, { expireAfterSeconds: 7776000, background: true });

// Compound index for fast per-monitor history queries
pingSchema.index({ monitor: 1, checkedAt: -1 });

module.exports = mongoose.model('Ping', pingSchema);