const express = require('express');
const router = express.Router();
const Trip = require('../models/Trip');

// GET /api/trips (WITH FILTERS)
router.get('/', async (req, res) => {
  try {
    const {
      username,
      direction,
      year,
      month,
      startDate,
      endDate
    } = req.query;

    const filter = {};

    // ✅ USER FILTER (EXACT MATCH)
    if (username) {
      filter.username = { $regex: `^${username}$`, $options: 'i' };
    }

    // ✅ DIRECTION
    if (direction) {
      filter.direction = direction;
    }

    // ✅ YEAR FILTER
    if (year) {
      const start = new Date(`${year}-01-01`);
      const end = new Date(`${year}-12-31`);
      filter.departureDate = { $gte: start, $lte: end };
    }

    // ✅ MONTH FILTER (requires year)
    if (month && year) {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0);
      filter.departureDate = { $gte: start, $lte: end };
    }

    // ✅ DATE RANGE (PDF)
    if (startDate && endDate) {
      filter.departureDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const trips = await Trip.find(filter).sort({ departureDate: -1 });

    res.json({
      success: true,
      data: trips,
      count: trips.length
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST
router.post('/', async (req, res) => {
  try {
    const trip = new Trip(req.body);
    await trip.save();
    res.status(201).json({ success: true, data: trip });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// PUT
router.put('/:id', async (req, res) => {
  try {
    const updated = await Trip.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// DELETE
router.delete('/:id', async (req, res) => {
  try {
    await Trip.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Deleted' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;