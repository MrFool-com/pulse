const { Resend } = require('resend');
const User = require('../models/User');

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.ALERT_FROM_EMAIL || 'Pulse Alerts <alerts@pulse.spacego.online>';

// Helper: get the email to send to
async function getAlertEmail(monitor) {
  if (monitor.alertEmail) return monitor.alertEmail;
  // Fall back to the user's account email
  const user = await User.findById(monitor.user).select('email').lean();
  return user?.email || null;
}

// Format duration since downtime started
function formatDuration(since) {
  const ms = Date.now() - new Date(since).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`;
}


// ── Down alert ────────────────────────────────────────────────────────────────
async function sendDownAlert(monitor) {
  const to = await getAlertEmail(monitor);
  if (!to) return;

  await resend.emails.send({
    from: FROM,
    to,
    subject: `🔴 ${monitor.name} is down`,
    html: buildDownHtml(monitor),
  });

  console.log(`[alerts] Down alert sent → ${to} for "${monitor.name}"`);
}


// ── Recovery alert ────────────────────────────────────────────────────────────
async function sendRecoveryAlert(monitor) {
  const to = await getAlertEmail(monitor);
  if (!to) return;

  const downFor = monitor.downtimeSince ? formatDuration(monitor.downtimeSince) : 'unknown';

  await resend.emails.send({
    from: FROM,
    to,
    subject: `✅ ${monitor.name} is back up`,
    html: buildRecoveryHtml(monitor, downFor),
  });

  console.log(`[alerts] Recovery alert sent → ${to} for "${monitor.name}"`);
}


// ── Email templates ───────────────────────────────────────────────────────────

function buildDownHtml(monitor) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#09090b;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#111114;border:1px solid rgba(255,255,255,0.06);border-radius:12px;overflow:hidden;">

        <!-- Header -->
        <tr>
          <td style="background:#f43f5e14;border-bottom:1px solid rgba(244,63,94,0.2);padding:20px 28px;">
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="width:8px;height:8px;background:#f43f5e;border-radius:50%;vertical-align:middle;"></td>
                <td style="padding-left:10px;font-size:13px;font-weight:600;color:#f43f5e;vertical-align:middle;letter-spacing:-0.01em;">Monitor Down</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:28px;">
            <p style="margin:0 0 6px;font-size:20px;font-weight:600;color:#fafafa;letter-spacing:-0.03em;">${monitor.name}</p>
            <p style="margin:0 0 24px;font-size:13px;color:#71717a;font-family:monospace;">${monitor.url}</p>

            <table width="100%" cellpadding="0" cellspacing="0" style="background:#0e0e11;border:1px solid rgba(255,255,255,0.06);border-radius:8px;margin-bottom:24px;">
              <tr>
                <td style="padding:14px 16px;border-bottom:1px solid rgba(255,255,255,0.04);">
                  <span style="font-size:11px;color:#52525b;text-transform:uppercase;letter-spacing:0.06em;">Status</span><br/>
                  <span style="font-size:13px;color:#f43f5e;font-weight:500;margin-top:4px;display:block;">● Down</span>
                </td>
                <td style="padding:14px 16px;border-bottom:1px solid rgba(255,255,255,0.04);">
                  <span style="font-size:11px;color:#52525b;text-transform:uppercase;letter-spacing:0.06em;">Detected at</span><br/>
                  <span style="font-size:13px;color:#a1a1aa;font-family:monospace;margin-top:4px;display:block;">${new Date().toUTCString()}</span>
                </td>
              </tr>
              ${monitor.lastStatusCode ? `
              <tr>
                <td colspan="2" style="padding:14px 16px;">
                  <span style="font-size:11px;color:#52525b;text-transform:uppercase;letter-spacing:0.06em;">Last Status Code</span><br/>
                  <span style="font-size:13px;color:#a1a1aa;font-family:monospace;margin-top:4px;display:block;">${monitor.lastStatusCode}</span>
                </td>
              </tr>` : ''}
            </table>

            <a href="https://pulse.spacego.online/dashboard" style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;padding:10px 20px;border-radius:7px;font-size:13px;font-weight:500;letter-spacing:-0.01em;">View Dashboard →</a>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:16px 28px;border-top:1px solid rgba(255,255,255,0.06);">
            <p style="margin:0;font-size:11px;color:#3f3f46;font-family:monospace;">Pulse · pulse.spacego.online</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}


function buildRecoveryHtml(monitor, downFor) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#09090b;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#111114;border:1px solid rgba(255,255,255,0.06);border-radius:12px;overflow:hidden;">

        <!-- Header -->
        <tr>
          <td style="background:#22c55e14;border-bottom:1px solid rgba(34,197,94,0.2);padding:20px 28px;">
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="width:8px;height:8px;background:#22c55e;border-radius:50%;vertical-align:middle;"></td>
                <td style="padding-left:10px;font-size:13px;font-weight:600;color:#22c55e;vertical-align:middle;letter-spacing:-0.01em;">Monitor Recovered</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:28px;">
            <p style="margin:0 0 6px;font-size:20px;font-weight:600;color:#fafafa;letter-spacing:-0.03em;">${monitor.name}</p>
            <p style="margin:0 0 24px;font-size:13px;color:#71717a;font-family:monospace;">${monitor.url}</p>

            <table width="100%" cellpadding="0" cellspacing="0" style="background:#0e0e11;border:1px solid rgba(255,255,255,0.06);border-radius:8px;margin-bottom:24px;">
              <tr>
                <td style="padding:14px 16px;border-bottom:1px solid rgba(255,255,255,0.04);">
                  <span style="font-size:11px;color:#52525b;text-transform:uppercase;letter-spacing:0.06em;">Status</span><br/>
                  <span style="font-size:13px;color:#22c55e;font-weight:500;margin-top:4px;display:block;">● Back Online</span>
                </td>
                <td style="padding:14px 16px;border-bottom:1px solid rgba(255,255,255,0.04);">
                  <span style="font-size:11px;color:#52525b;text-transform:uppercase;letter-spacing:0.06em;">Was down for</span><br/>
                  <span style="font-size:13px;color:#a1a1aa;font-family:monospace;margin-top:4px;display:block;">${downFor}</span>
                </td>
              </tr>
              <tr>
                <td colspan="2" style="padding:14px 16px;">
                  <span style="font-size:11px;color:#52525b;text-transform:uppercase;letter-spacing:0.06em;">Response time</span><br/>
                  <span style="font-size:13px;color:#a1a1aa;font-family:monospace;margin-top:4px;display:block;">${monitor.lastResponseTime ? monitor.lastResponseTime + 'ms' : '—'}</span>
                </td>
              </tr>
            </table>

            <a href="https://pulse.spacego.online/dashboard" style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;padding:10px 20px;border-radius:7px;font-size:13px;font-weight:500;letter-spacing:-0.01em;">View Dashboard →</a>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:16px 28px;border-top:1px solid rgba(255,255,255,0.06);">
            <p style="margin:0;font-size:11px;color:#3f3f46;font-family:monospace;">Pulse · pulse.spacego.online</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}


module.exports = { sendDownAlert, sendRecoveryAlert };