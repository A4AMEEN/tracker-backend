// routes/trips.js
const express = require('express');
const router  = express.Router();
const Trip    = require('../models/Trip');
const nodemailer = require('nodemailer');

// ── Email config ─────────────────────────────────────────────────────────────
const BACKUP_EMAIL = 'ameenomen15@gmail.com';

function createTransporter() {
  return nodemailer.createTransport({
    host:   process.env.EMAIL_HOST   || 'smtp.gmail.com',
    port:   parseInt(process.env.EMAIL_PORT || '587', 10),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });
}

async function getAllTripsByUser() {
  const allTrips = await Trip.find({}).sort({ username: 1, travelDate: 1, returnDate: 1 }).lean();
  const grouped  = {};
  for (const trip of allTrips) {
    const key = trip.username.trim();
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(trip);
  }
  const sortedKeys = Object.keys(grouped).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  return { grouped, sortedKeys };
}

function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return isNaN(dt) ? '—' : dt.toLocaleDateString('en-GB');
}

function buildEmailBody({ grouped, sortedKeys, action, changedTrip, username }) {
  const now = new Date().toLocaleString('en-AE', { timeZone: 'Asia/Dubai' });
  let totalTrips = 0;
  for (const k of sortedKeys) totalTrips += grouped[k].length;

  let html = `
  <div style="font-family:Arial,sans-serif;max-width:960px;margin:0 auto;color:#333">
    <h2 style="background:#1a365d;color:#fff;padding:16px 20px;border-radius:6px 6px 0 0;margin:0">✈️ Travel Log Backup</h2>
    <div style="background:#eaf0fb;padding:12px 20px;border-left:4px solid #2b6cb0;margin-bottom:20px">
      <strong>Action:</strong> ${action}<br>
      <strong>Triggered by:</strong> ${username || 'Unknown'}<br>
      <strong>Generated at:</strong> ${now} (Dubai time)<br>
      <strong>Total records:</strong> ${totalTrips} trips across ${sortedKeys.length} users
    </div>`;

  for (const name of sortedKeys) {
    const trips     = grouped[name];
    const inIndia   = trips.reduce((s, t) => s + (t.inIndiaDays || 0), 0);
    const inUAE     = trips.reduce((s, t) => s + (t.inUAEDays   || 0), 0);

    html += `
    <div style="margin-bottom:28px">
      <h3 style="background:#2d3748;color:#fff;padding:8px 16px;border-radius:4px;margin:0 0 4px 0">
        👤 ${name}
        <span style="font-size:13px;font-weight:normal;margin-left:12px;opacity:.8">
          ${trips.length} record${trips.length !== 1 ? 's' : ''} &nbsp;|&nbsp;
          🇮🇳 ${inIndia}d in India &nbsp;|&nbsp; 🇦🇪 ${inUAE}d in UAE
        </span>
      </h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr style="background:#f7fafc">
            <th style="padding:7px 10px;border:1px solid #e2e8f0">#</th>
            <th style="padding:7px 10px;border:1px solid #e2e8f0">Issue Date</th>
            <th style="padding:7px 10px;border:1px solid #e2e8f0">Sector</th>
            <th style="padding:7px 10px;border:1px solid #e2e8f0">Class</th>
            <th style="padding:7px 10px;border:1px solid #e2e8f0">Travel Date</th>
            <th style="padding:7px 10px;border:1px solid #e2e8f0">Return Date</th>
            <th style="padding:7px 10px;border:1px solid #e2e8f0">In India</th>
            <th style="padding:7px 10px;border:1px solid #e2e8f0">In UAE</th>
            <th style="padding:7px 10px;border:1px solid #e2e8f0">Exit Time</th>
            <th style="padding:7px 10px;border:1px solid #e2e8f0">Entry Time</th>
            <th style="padding:7px 10px;border:1px solid #e2e8f0">Notes</th>
          </tr>
        </thead>
        <tbody>`;

    trips.forEach((t, i) => {
      const isChanged = changedTrip && String(t._id) === String(changedTrip._id);
      const rowBg = isChanged ? '#fffbeb' : i % 2 === 0 ? '#fff' : '#f7fafc';
      const travelDisplay = t.travelDateText || fmtDate(t.travelDate);

      html += `
          <tr style="background:${rowBg}${isChanged ? ';font-weight:600' : ''}">
            <td style="padding:6px 10px;border:1px solid #e2e8f0">${i + 1}${isChanged ? ' ★' : ''}</td>
            <td style="padding:6px 10px;border:1px solid #e2e8f0">${fmtDate(t.issueDate)}</td>
            <td style="padding:6px 10px;border:1px solid #e2e8f0">${t.sector || '—'}</td>
            <td style="padding:6px 10px;border:1px solid #e2e8f0">${t.travelClass || '—'}</td>
            <td style="padding:6px 10px;border:1px solid #e2e8f0">${travelDisplay}</td>
            <td style="padding:6px 10px;border:1px solid #e2e8f0">${fmtDate(t.returnDate)}</td>
            <td style="padding:6px 10px;border:1px solid #e2e8f0">${t.inIndiaDays ?? 0}</td>
            <td style="padding:6px 10px;border:1px solid #e2e8f0">${t.inUAEDays ?? 0}</td>
            <td style="padding:6px 10px;border:1px solid #e2e8f0">${t.exitTime || '—'}</td>
            <td style="padding:6px 10px;border:1px solid #e2e8f0">${t.entryTime || '—'}</td>
            <td style="padding:6px 10px;border:1px solid #e2e8f0">${t.notes || ''}</td>
          </tr>`;
    });

    html += `</tbody></table></div>`;
  }

  html += `<p style="font-size:12px;color:#718096;margin-top:20px">
    Automated backup from Travel Tracker. ★ = record that triggered this email.
  </p></div>`;

  let text = `Travel Log Backup\nAction: ${action}\nGenerated: ${now}\n\n`;
  for (const name of sortedKeys) {
    text += `\n=== ${name} ===\n`;
    grouped[name].forEach((t, i) => {
      const td = t.travelDateText || fmtDate(t.travelDate);
      text += `  ${i+1}. ${t.sector||'—'}  Travel:${td}  Return:${fmtDate(t.returnDate)}  India:${t.inIndiaDays||0}  UAE:${t.inUAEDays||0}\n`;
    });
  }
  return { html, text };
}

async function sendBackupEmail({ action, changedTrip, username }) {
  try {
    const { grouped, sortedKeys } = await getAllTripsByUser();
    const { html, text } = buildEmailBody({ grouped, sortedKeys, action, changedTrip, username });
    const transporter = createTransporter();
    await transporter.verify();
    const now     = new Date().toLocaleString('en-AE', { timeZone: 'Asia/Dubai' });
    const subject = `[Travel Log Backup] ${action} — ${now}`;
    const info    = await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: BACKUP_EMAIL, subject, text, html,
    });
    console.log(`[EMAIL] ✅ Sent — ${info.messageId}`);
  } catch (err) {
    console.error(`[EMAIL] ❌ ${err.message}`);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function buildSortKey(trip) {
  // For ordering: use travelDate, fall back to returnDate
  if (trip.travelDate) return new Date(trip.travelDate).getTime();
  if (trip.returnDate) return new Date(trip.returnDate).getTime();
  return 0;
}

// ── GET /api/trips ────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { username, year, month, startDate, endDate } = req.query;
    const filter = {};

    if (username) filter.username = { $regex: `^${username}$`, $options: 'i' };

    // Date filter applies to returnDate (most reliable field)
    if (year && month) {
      filter.returnDate = {
        $gte: new Date(year, month - 1, 1),
        $lte: new Date(year, month, 0),
      };
    } else if (year) {
      filter.returnDate = {
        $gte: new Date(`${year}-01-01`),
        $lte: new Date(`${year}-12-31`),
      };
    }
    if (startDate && endDate) {
      filter.returnDate = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const trips = await Trip.find(filter).sort({ returnDate: 1, travelDate: 1 });
    res.json({ success: true, data: trips, count: trips.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/trips ───────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const body = sanitize(req.body);
    const trip = new Trip(body);
    await trip.save();
    res.status(201).json({ success: true, data: trip });
    sendBackupEmail({ action: `New record for ${trip.username} (${trip.sector || '—'})`, changedTrip: trip, username: trip.username });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ── PUT /api/trips/:id ────────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const body    = sanitize(req.body);
    const updated = await Trip.findByIdAndUpdate(req.params.id, body, { new: true });
    if (!updated) return res.status(404).json({ success: false, error: 'Trip not found' });
    res.json({ success: true, data: updated });
    sendBackupEmail({ action: `Record edited for ${updated.username} (${updated.sector || '—'})`, changedTrip: updated, username: updated.username });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ── DELETE /api/trips/:id ─────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Trip.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, error: 'Trip not found' });
    res.json({ success: true, message: 'Deleted' });
    sendBackupEmail({ action: `Record DELETED for ${deleted.username} (${deleted.sector || '—'})`, changedTrip: deleted, username: deleted.username });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ── Sanitize incoming body ────────────────────────────────────────────────────
function sanitize(body) {
  const out = {};

  out.username      = (body.username    || '').trim();
  out.designation   = (body.designation || '').trim();
  out.airline       = (body.airline     || '').trim();
  out.sector        = (body.sector      || '').trim();
  out.travelClass   = (body.travelClass || '').trim();
  out.exitTime      = (body.exitTime    || '').trim();
  out.entryTime     = (body.entryTime   || '').trim();
  out.notes         = (body.notes       || '').trim();

  // inIndiaDays / inUAEDays — always numeric, default 0
  out.inIndiaDays   = body.inIndiaDays !== undefined && body.inIndiaDays !== '' ? Number(body.inIndiaDays) : 0;
  out.inUAEDays     = body.inUAEDays   !== undefined && body.inUAEDays   !== '' ? Number(body.inUAEDays)   : 0;

  // issueDate
  out.issueDate     = body.issueDate  && String(body.issueDate).trim()  ? new Date(body.issueDate)  : null;
  out.returnDate    = body.returnDate && String(body.returnDate).trim() ? new Date(body.returnDate) : null;

  // travelDate vs travelDateText
  const tdText = (body.travelDateText || '').trim();
  const tdDate = (body.travelDate     || '');

  if (tdText === 'In UAE' || tdText === 'In India') {
    out.travelDateText = tdText;
    out.travelDate     = null;
  } else if (tdDate) {
    out.travelDate     = new Date(tdDate);
    out.travelDateText = null;
  } else {
    out.travelDate     = null;
    out.travelDateText = null;
  }

  return out;
}

module.exports = router;