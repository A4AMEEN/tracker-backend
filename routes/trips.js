const express = require('express');
const router = express.Router();
const Trip = require('../models/Trip');

// GET all trips with filters
router.get('/', async (req, res) => {
  try {
    const { direction, year, month, startDate, endDate, username } = req.query;
    const filter = {};

    if (direction && direction !== 'ALL') {
      filter.direction = direction;
    }

    if (username) {
      filter.username = { $regex: username, $options: 'i' };
    }

    if (year) {
      const y = parseInt(year);
      filter.departureDate = {
        $gte: new Date(`${y}-01-01`),
        $lte: new Date(`${y}-12-31`),
      };
    }

    if (month && year) {
      const y = parseInt(year);
      const m = parseInt(month) - 1;
      const start = new Date(y, m, 1);
      const end = new Date(y, m + 1, 0);
      filter.departureDate = { $gte: start, $lte: end };
    }

    if (startDate && endDate) {
      filter.departureDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const trips = await Trip.find(filter).sort({ departureDate: -1 });
    res.json({ success: true, data: trips, count: trips.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET single trip
router.get('/:id', async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);
    if (!trip) {
      return res.status(404).json({ success: false, error: 'Trip not found' });
    }
    res.json({ success: true, data: trip });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST create trip
router.post('/', async (req, res) => {
  try {
    const { username, designation, direction, departureDate, returnDate, notes } = req.body;

    if (!direction || !departureDate || !returnDate) {
      return res.status(400).json({
        success: false,
        error: 'Direction, departure date, and return date are required',
      });
    }

    if (new Date(returnDate) < new Date(departureDate)) {
      return res.status(400).json({
        success: false,
        error: 'Return date cannot be before departure date',
      });
    }

    const trip = new Trip({
      username: username || 'Sajeev PK',
      designation: designation || 'Managing Director',
      direction,
      departureDate: new Date(departureDate),
      returnDate: new Date(returnDate),
      notes: notes || '',
    });

    await trip.save();
    res.status(201).json({ success: true, data: trip });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT update trip
router.put('/:id', async (req, res) => {
  try {
    const { username, designation, direction, departureDate, returnDate, notes } = req.body;

    if (departureDate && returnDate && new Date(returnDate) < new Date(departureDate)) {
      return res.status(400).json({
        success: false,
        error: 'Return date cannot be before departure date',
      });
    }

    const trip = await Trip.findByIdAndUpdate(
      req.params.id,
      { username, designation, direction, departureDate, returnDate, notes },
      { new: true, runValidators: true }
    );

    if (!trip) {
      return res.status(404).json({ success: false, error: 'Trip not found' });
    }

    // Recalculate days manually since pre hook on findOneAndUpdate may need explicit trigger
    const msPerDay = 1000 * 60 * 60 * 24;
    const diff = Math.round((trip.returnDate - trip.departureDate) / msPerDay);
    trip.daysCount = diff + 1;
    await trip.save();

    res.json({ success: true, data: trip });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE trip
router.delete('/:id', async (req, res) => {
  try {
    const trip = await Trip.findByIdAndDelete(req.params.id);
    if (!trip) {
      return res.status(404).json({ success: false, error: 'Trip not found' });
    }
    res.json({ success: true, message: 'Trip deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
