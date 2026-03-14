const cron = require('node-cron');
const axios = require('axios');
const Monitor = require('../models/Monitor');
const Ping = require('../models/Ping');
const { sendDownAlert, sendRecoveryAlert } = require('./alerts');

// Runs every minute and checks which monitors are due for a ping
function startPinger() {
  cron.schedule('* * * * *', async () => {
    const now = new Date();

    // Find all active monitors where it's time to ping:
    // lastCheckedAt is null (never pinged) OR
    // (now - lastCheckedAt) >= interval minutes
    const monitors = await Monitor.find({ isActive: true }).lean();

    const due = monitors.filter(m => {
      if (!m.lastCheckedAt) return true;
      const elapsed = (now - new Date(m.lastCheckedAt)) / 1000 / 60; // in minutes
      return elapsed >= m.interval;
    });

    if (!due.length) return;

    // Fire all due pings in parallel
    await Promise.allSettled(due.map(m => pingMonitor(m)));
  });

  console.log('[pinger] Cron started — checking every minute');
}


async function pingMonitor(monitor) {
  const start = Date.now();
  let pingData = {
    monitor: monitor._id,
    checkedAt: new Date(),
  };

  try {
    const response = await axios.get(monitor.url, {
      timeout: 10000,       // 10s timeout
      validateStatus: null, // don't throw on 4xx/5xx — we log those too
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Pulse-Monitor/1.0 (+https://pulse.spacego.online)',
      },
    });

    const responseTime = Date.now() - start;
    const isUp = response.status >= 200 && response.status < 400;

    pingData.status = isUp ? 'up' : 'down';
    pingData.statusCode = response.status;
    pingData.responseTime = responseTime;

  } catch (err) {
    // Network error, DNS failure, timeout, etc.
    pingData.status = 'down';
    pingData.statusCode = null;
    pingData.responseTime = null;
    pingData.error = err.message?.slice(0, 200) || 'Unknown error';
  }

  // Save ping log
  await Ping.create(pingData);

  // Fetch the live doc (not the lean snapshot) for comparison
  const liveMonitor = await Monitor.findById(monitor._id);
  if (!liveMonitor) return;

  const wasDown = liveMonitor.status === 'down';
  const isNowDown = pingData.status === 'down';

  // Update cached state on monitor
  liveMonitor.lastCheckedAt = pingData.checkedAt;
  liveMonitor.lastResponseTime = pingData.responseTime;
  liveMonitor.lastStatusCode = pingData.statusCode;
  liveMonitor.status = pingData.status;

  if (isNowDown && !wasDown) {
    // Just went down
    liveMonitor.downtimeSince = pingData.checkedAt;
    await liveMonitor.save();

    if (liveMonitor.alertOnDown) {
      await sendDownAlert(liveMonitor).catch(e =>
        console.error('[pinger] Down alert failed:', e.message)
      );
    }

  } else if (!isNowDown && wasDown) {
    // Just recovered
    liveMonitor.downtimeSince = null;
    await liveMonitor.save();

    if (liveMonitor.alertOnRecovery) {
      await sendRecoveryAlert(liveMonitor).catch(e =>
        console.error('[pinger] Recovery alert failed:', e.message)
      );
    }

  } else {
    await liveMonitor.save();
  }
}

module.exports = { startPinger };