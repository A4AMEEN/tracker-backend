// services/emailService.js
// Uses nodemailer. Install: npm install nodemailer
// Set env vars: EMAIL_USER, EMAIL_PASS (Gmail App Password), EMAIL_FROM
// Or use any SMTP provider.

const nodemailer = require('nodemailer');

const BACKUP_TO = 'ameenomen15@gmail.com';

// Create transporter — configure via env vars
// For Gmail: enable 2FA and create an App Password
function createTransporter() {
  return nodemailer.createTransporter({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,   // your gmail e.g. yourapp@gmail.com
      pass: process.env.EMAIL_PASS,   // App Password (not your gmail password)
    },
  });
}

function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '—';
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${String(dt.getUTCDate()).padStart(2,'0')}-${months[dt.getUTCMonth()]}-${String(dt.getUTCFullYear()).slice(-2)}`;
}

function fmtNum(n) {
  return (n === null || n === undefined || n === 0) ? '' : String(n);
}

/**
 * Sends the full travel log backup email.
 * @param {Array} allTrips - All trip records sorted by username then travelDate
 * @param {string} triggerAction - 'added' | 'updated' | 'deleted'
 * @param {string} triggerUser - username of the person whose record changed
 */
async function sendTravelLogBackup(allTrips, triggerAction, triggerUser) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log('[Email] Skipping — EMAIL_USER / EMAIL_PASS not configured');
    return;
  }

  try {
    // Group trips by username, sorted by travelDate ASC within each person
    const byUser = {};
    for (const trip of allTrips) {
      const name = trip.username || 'Unknown';
      if (!byUser[name]) byUser[name] = [];
      byUser[name].push(trip);
    }
    // Sort usernames alphabetically
    const sortedNames = Object.keys(byUser).sort((a, b) => a.localeCompare(b));

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' });
    const timeStr = now.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' });

    // Build HTML
    let html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  body { font-family: Arial, sans-serif; font-size: 13px; color: #1a2340; background: #f5f6fa; margin: 0; padding: 20px; }
  .container { max-width: 960px; margin: 0 auto; background: #fff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.10); }
  .header { background: #0f2251; color: #fff; padding: 22px 28px; }
  .header h1 { margin: 0; font-size: 20px; font-weight: 700; }
  .header p  { margin: 6px 0 0; font-size: 13px; color: rgba(255,255,255,0.6); }
  .meta { background: #e8eef8; padding: 12px 28px; font-size: 12px; color: #4a5680; border-bottom: 1px solid #dde2ef; }
  .trigger { display: inline-block; padding: 2px 10px; border-radius: 12px; font-weight: 700; font-size: 11px; text-transform: uppercase; }
  .trigger.added   { background: #d0ede0; color: #00875a; }
  .trigger.updated { background: #e8eef8; color: #1a3a6b; }
  .trigger.deleted { background: #fceaea; color: #c0392b; }
  .person-section { padding: 20px 28px 0; }
  .person-title { font-size: 15px; font-weight: 700; color: #0f2251; margin: 0 0 12px; padding-bottom: 8px; border-bottom: 2px solid #c6923d; display: flex; align-items: center; gap: 10px; }
  .person-title .avatar { width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #2d5299, #1a3a6b); color: #fff; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 12px; }
  th { background: #0f2251; color: rgba(255,255,255,0.85); padding: 8px 9px; text-align: left; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.05em; white-space: nowrap; }
  td { padding: 7px 9px; border-bottom: 1px solid #eef0f6; vertical-align: middle; }
  tr:nth-child(even) td { background: #f8f9fc; }
  tr:hover td { background: #e8eef8; }
  .india-days { color: #138808; font-weight: 700; text-align: center; }
  .uae-days   { color: #1a3a8a; font-weight: 700; text-align: center; }
  .row-num    { color: #8892aa; font-weight: 600; text-align: center; width: 28px; }
  .subtotal { background: #c5d5f0 !important; font-weight: 700; color: #0f2251; }
  .subtotal td { background: #c5d5f0 !important; color: #0f2251; font-weight: 700; }
  .grand-total { background: #0f2251; }
  .grand-total td { background: #0f2251; color: #fff; font-weight: 700; padding: 10px 9px; font-size: 13px; }
  .grand-total .india-days, .grand-total .uae-days { color: #f0c97a; }
  .footer { padding: 16px 28px; background: #f5f6fa; font-size: 11px; color: #8892aa; border-top: 1px solid #dde2ef; }
  .center { text-align: center; }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>✈️ Travel Log Backup</h1>
    <p>Complete travel records — generated ${dateStr} at ${timeStr}</p>
  </div>
  <div class="meta">
    <span class="trigger ${triggerAction}">${triggerAction}</span>
    &nbsp; Record ${triggerAction} for <strong>${triggerUser}</strong> &nbsp;·&nbsp;
    Total records: <strong>${allTrips.length}</strong> &nbsp;·&nbsp;
    People: <strong>${sortedNames.length}</strong>
  </div>
`;

    let grandIndia = 0, grandUAE = 0, grandTotal = 0;

    for (const name of sortedNames) {
      const trips = byUser[name].sort((a, b) => {
        const da = a.travelDate ? new Date(a.travelDate).getTime() : 0;
        const db = b.travelDate ? new Date(b.travelDate).getTime() : 0;
        return da - db;
      });

      const personIndia = trips.reduce((s, t) => s + (t.inIndiaDays || 0), 0);
      const personUAE   = trips.reduce((s, t) => s + (t.inUAEDays || 0), 0);
      const personTotal = personIndia + personUAE;
      grandIndia += personIndia;
      grandUAE   += personUAE;
      grandTotal += personTotal;

      const initials = name.split(' ').map(w => w[0] || '').join('').toUpperCase().slice(0, 2);

      html += `
  <div class="person-section">
    <div class="person-title">
      <span class="avatar">${initials}</span>
      ${name}
      <span style="font-size:12px;font-weight:400;color:#4a5680;">${trips[0]?.designation || ''}</span>
    </div>
    <table>
      <thead>
        <tr>
          <th class="center">#</th>
          <th>Issue Date</th>
          <th>Airline</th>
          <th>Sector</th>
          <th>Class</th>
          <th>Travel Date</th>
          <th>Return Date</th>
          <th class="center">In India</th>
          <th class="center">In UAE/Abroad</th>
          <th>Exit Time</th>
          <th>Entry Time</th>
          <th>Remarks</th>
        </tr>
      </thead>
      <tbody>`;

      trips.forEach((t, i) => {
        html += `
        <tr>
          <td class="row-num">${i + 1}</td>
          <td>${fmtDate(t.issueDate)}</td>
          <td>${t.airline || '—'}</td>
          <td><strong>${t.sector || '—'}</strong></td>
          <td>${t.travelClass || '—'}</td>
          <td>${t.travelDate ? fmtDate(t.travelDate) : '<em style="color:#8892aa">In UAE</em>'}</td>
          <td>${fmtDate(t.returnDate)}</td>
          <td class="india-days">${fmtNum(t.inIndiaDays)}</td>
          <td class="uae-days">${fmtNum(t.inUAEDays)}</td>
          <td>${t.exitTime || '—'}</td>
          <td>${t.entryTime || '—'}</td>
          <td>${t.notes || '—'}</td>
        </tr>`;
      });

      html += `
        <tr class="subtotal">
          <td colspan="7" style="text-align:right;padding-right:12px;">Subtotal for ${name}</td>
          <td class="india-days">${personIndia}</td>
          <td class="uae-days">${personUAE}</td>
          <td colspan="3" style="text-align:center;color:#0f2251;">Total: ${personTotal} days</td>
        </tr>
      </tbody>
    </table>
  </div>`;
    }

    // Grand total
    html += `
  <div style="padding: 0 28px 24px;">
    <table>
      <tbody>
        <tr class="grand-total">
          <td colspan="7" style="text-align:right;padding-right:12px;">GRAND TOTAL — All Travellers</td>
          <td class="india-days">${grandIndia}</td>
          <td class="uae-days">${grandUAE}</td>
          <td colspan="3" style="text-align:center;">Total: ${grandTotal} days</td>
        </tr>
      </tbody>
    </table>
  </div>
  <div class="footer">
    This is an automated backup email from Travel Tracker. Generated on ${dateStr} at ${timeStr}.
    Do not reply to this email.
  </div>
</div>
</body>
</html>`;

    const transporter = createTransporter();
    await transporter.sendMail({
      from: `"Travel Tracker" <${process.env.EMAIL_USER}>`,
      to: BACKUP_TO,
      subject: `[Travel Tracker] Backup — ${triggerAction} by ${triggerUser} — ${dateStr}`,
      html,
    });

    console.log(`[Email] Backup sent to ${BACKUP_TO} — trigger: ${triggerAction} by ${triggerUser}`);
  } catch (err) {
    console.error('[Email] Failed to send backup:', err.message);
    // Do NOT throw — email failure should never break the main API response
  }
}

module.exports = { sendTravelLogBackup };