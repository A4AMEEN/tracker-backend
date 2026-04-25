const express = require('express');
const router = express.Router();
const Trip = require('../models/Trip');

// GET /api/trips (WITH FILTERS)
router.get('/', async (req, res) => {
  try {
    const { username, direction, year, month, startDate, endDate } = req.query;
    const filter = {};

    if (username)  filter.username  = { $regex: `^${username}$`, $options: 'i' };
    if (direction) filter.direction = direction;

    if (year && month) {
      filter.departureDate = {
        $gte: new Date(year, month - 1, 1),
        $lte: new Date(year, month, 0),
      };
    } else if (year) {
      filter.departureDate = {
        $gte: new Date(`${year}-01-01`),
        $lte: new Date(`${year}-12-31`),
      };
    }

    if (startDate && endDate) {
      filter.departureDate = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const trips = await Trip.find(filter).sort({ departureDate: -1 });
    res.json({ success: true, data: trips, count: trips.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST
router.post('/', async (req, res) => {
  try {
    const body = { ...req.body };
    body.daysCount = computeDaysCount(body);
    const trip = new Trip(body);
    await trip.save();
    res.status(201).json({ success: true, data: trip });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});
// PUT
router.put('/:id', async (req, res) => {
  try {
    const body = { ...req.body };
    body.daysCount = computeDaysCount(body);
    const updated = await Trip.findByIdAndUpdate(req.params.id, body, { new: true });
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// DELETE /api/trips/:id
router.delete('/:id', async (req, res) => {
  try {
    await Trip.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Deleted' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

function computeDaysCount({ direction, departureDate, returnDate }) {
  const MS_DAY = 86_400_000;
  const dep = new Date(departureDate);
  const ret = new Date(returnDate);
  const depUTC = Date.UTC(dep.getUTCFullYear(), dep.getUTCMonth(), dep.getUTCDate());
  const retUTC = Date.UTC(ret.getUTCFullYear(), ret.getUTCMonth(), ret.getUTCDate());

  if (direction === 'UAE_TO_INDIA') {
    // arrival day (dep) counts, departure day (ret) does NOT
    // so days = ret - dep  (not +1)
    const days = Math.round((retUTC - depUTC) / MS_DAY);
    return Math.max(1, days);
  } else {
    // INDIA_TO_UAE: dep day excluded from India, counts as UAE day 1
    // days abroad = ret - dep + 1
    const days = Math.round((retUTC - depUTC) / MS_DAY) + 1;
    return Math.max(1, days);
  }
}

module.exports = router;