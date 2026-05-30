// routes/trips.js
const express  = require('express');
const router   = express.Router();
const Trip     = require('../models/Trip');
const { sendTravelLogBackup } = require('../services/emailService');

async function triggerBackup(action, username) {
  try {
    const all = await Trip.find({}).sort({ username: 1, travelDate: 1 });
    sendTravelLogBackup(all, action, username).catch(() => {});
  } catch (e) { console.error('[Backup]', e.message); }
}

// ── GET /api/trips ───────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { username, year, startDate, endDate } = req.query;
    const filter = {};
    if (username) filter.username = { $regex: `^${username.trim()}$`, $options: 'i' };
    if (year) {
      const y = parseInt(year, 10);
      filter.travelDate = {
        $gte: new Date(Date.UTC(y, 0, 1)),
        $lte: new Date(Date.UTC(y, 11, 31, 23, 59, 59, 999)),
      };
    }
    if (startDate && endDate) {
      filter.travelDate = {
        $gte: new Date(startDate + 'T00:00:00.000Z'),
        $lte: new Date(endDate   + 'T23:59:59.999Z'),
      };
    }
    const trips = await Trip.find(filter).sort({ username: 1, travelDate: 1 });
    res.json({ success: true, data: trips, count: trips.length });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// ── GET /api/trips/calculate-days ────────────────────────────────────────────
// Auto-calculates inUAEDays and suggests inIndiaDays for a trip being added/edited
// Query: username, travelDate, returnDate, tripId (optional, for edit mode)
router.get('/calculate-days', async (req, res) => {
  try {
    const { username, travelDate, returnDate, tripId } = req.query;
    const MS = 86400000;

    let inUAEDays = 0;
    let inIndiaDays = 0;

    // ── UAE days: returnDate - travelDate - 1 (confirmed formula) ────────────
    if (travelDate && returnDate) {
      const dep = new Date(travelDate);
      const ret = new Date(returnDate);
      inUAEDays = Math.max(0, Math.round((ret - dep) / MS) - 1);
    }

    // ── India days: find surrounding trips for this user to compute gap ───────
    // India days = gap between previous trip's returnDate and this travelDate
    // = nextTravelDate - prevReturnDate - 1 (exclude both endpoints)
    // This is a SUGGESTION — user can override.
    if (username && travelDate) {
      const filter = { username: { $regex: `^${username.trim()}$`, $options: 'i' } };
      if (tripId) filter._id = { $ne: tripId }; // exclude self in edit mode
      const allUserTrips = await Trip.find(filter).sort({ travelDate: 1 });
      
      const thisDate = new Date(travelDate);
      
      // Find the most recent trip that returned before this one's travelDate
      let prevTrip = null;
      for (const t of allUserTrips) {
        if (t.returnDate && new Date(t.returnDate) < thisDate) {
          prevTrip = t;
        }
      }

      if (prevTrip?.returnDate) {
        const prevReturn = new Date(prevTrip.returnDate);
        inIndiaDays = Math.max(0, Math.round((thisDate - prevReturn) / MS) - 1);
      }
    }

    // Row 1 special case: "IN UAE" (no travelDate) — inIndiaDays = 0, inUAEDays calculated from period start
    if (!travelDate && returnDate) {
      inUAEDays = 0;    // Will be manually entered for "In UAE" starting rows
      inIndiaDays = 0;
    }

    res.json({ success: true, data: { inUAEDays, inIndiaDays } });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// ── GET /api/trips/:id ───────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);
    if (!trip) return res.status(404).json({ success: false, error: 'Trip not found' });
    res.json({ success: true, data: trip });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// ── POST /api/trips ──────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const b = req.body;
    if (!b.username?.trim()) return res.status(400).json({ success: false, error: 'Username is required' });

    const trip = new Trip({
      username:     b.username.trim(),
      designation:  b.designation  || '',
      issueDate:    b.issueDate    ? new Date(b.issueDate)   : null,
      airline:      b.airline      || '',
      travelClass:  b.travelClass  || '',
      sector:       b.sector       || '',
      travelDate:   b.travelDate   ? new Date(b.travelDate)  : null,
      returnDate:   b.returnDate   ? new Date(b.returnDate)  : null,
      exitTime:     b.exitTime     || '',
      entryTime:    b.entryTime    || '',
      inIndiaDays:  Number(b.inIndiaDays)  || 0,
      inUAEDays:    Number(b.inUAEDays)    || 0,
      fare:         (b.fare != null && b.fare !== '') ? Number(b.fare) : null,
      fareCurrency: b.fareCurrency || 'AED',
      notes:        b.notes        || '',
      startingLocation: b.startingLocation || '', // 'IN_UAE' | 'IN_INDIA' | ''
    });

    await trip.save();
    res.status(201).json({ success: true, data: trip });
    triggerBackup('added', b.username.trim());
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// ── PUT /api/trips/:id ───────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);
    if (!trip) return res.status(404).json({ success: false, error: 'Trip not found' });
    const b = req.body;
    if (b.username !== undefined) trip.username    = b.username.trim();
    if (b.designation  !== undefined) trip.designation  = b.designation  || '';
    if (b.airline      !== undefined) trip.airline      = b.airline      || '';
    if (b.travelClass  !== undefined) trip.travelClass  = b.travelClass  || '';
    if (b.sector       !== undefined) trip.sector       = b.sector       || '';
    if (b.exitTime     !== undefined) trip.exitTime     = b.exitTime     || '';
    if (b.entryTime    !== undefined) trip.entryTime    = b.entryTime    || '';
    if (b.notes        !== undefined) trip.notes        = b.notes        || '';
    if (b.startingLocation !== undefined) trip.startingLocation = b.startingLocation || '';
    trip.issueDate    = b.issueDate   ? new Date(b.issueDate)   : null;
    trip.travelDate   = b.travelDate  ? new Date(b.travelDate)  : null;
    trip.returnDate   = b.returnDate  ? new Date(b.returnDate)  : null;
    trip.inIndiaDays  = Number(b.inIndiaDays)  || 0;
    trip.inUAEDays    = Number(b.inUAEDays)    || 0;
    trip.fare         = (b.fare != null && b.fare !== '') ? Number(b.fare) : null;
    trip.fareCurrency = b.fareCurrency || 'AED';
    await trip.save();
    res.json({ success: true, data: trip });
    triggerBackup('updated', trip.username);
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// ── DELETE /api/trips/:id ────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const trip = await Trip.findByIdAndDelete(req.params.id);
    if (!trip) return res.status(404).json({ success: false, error: 'Trip not found' });
    res.json({ success: true, message: 'Trip deleted' });
    triggerBackup('deleted', trip.username);
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

module.exports = router;