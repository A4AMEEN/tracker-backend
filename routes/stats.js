// routes/stats.js
const express = require('express');
const router  = express.Router();
const Trip    = require('../models/Trip');

// ── GET /api/stats/summary ────────────────────────────────────────────────────
router.get('/summary', async (req, res) => {
  try {
    const { year, username } = req.query;

    // ── Build mongo filter ──────────────────────────────────────────────────
    const mongoFilter = {};

    if (username && username !== 'ALL') {
      mongoFilter.username = { $regex: `^${username}$`, $options: 'i' };
    }
    if (year && year !== 'ALL') {
      const y = parseInt(year, 10);
      // Filter by financial year: Apr 1 of y → Mar 31 of y+1
      // We use returnDate as the anchor field
      mongoFilter.returnDate = {
        $gte: new Date(Date.UTC(y,     3,  1)),   // Apr 1
        $lte: new Date(Date.UTC(y + 1, 2, 31, 23, 59, 59, 999)), // Mar 31
      };
    }

    const trips = await Trip.find(mongoFilter).sort({ returnDate: 1, travelDate: 1 }).lean();

    // ── Aggregate ───────────────────────────────────────────────────────────
    let daysInIndia = 0;
    let daysInUAE   = 0;
    let totalTrips  = trips.length;

    const monthlyMap = {};
    const yearlyMap  = {};

    for (const trip of trips) {
      const india = trip.inIndiaDays || 0;
      const uae   = trip.inUAEDays   || 0;

      daysInIndia += india;
      daysInUAE   += uae;

      // Use returnDate for bucketing (most records have it; fallback to travelDate)
      const anchor = trip.returnDate || trip.travelDate;
      if (!anchor) continue;

      const d        = new Date(anchor);
      const yearKey  = d.getUTCFullYear().toString();
      const monthKey = `${yearKey}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;

      if (!yearlyMap[yearKey])   yearlyMap[yearKey]   = { india: 0, uae: 0, trips: 0 };
      if (!monthlyMap[monthKey]) monthlyMap[monthKey] = { india: 0, uae: 0, trips: 0 };

      yearlyMap[yearKey].india   += india;
      yearlyMap[yearKey].uae     += uae;
      yearlyMap[yearKey].trips   += 1;

      monthlyMap[monthKey].india += india;
      monthlyMap[monthKey].uae   += uae;
      monthlyMap[monthKey].trips += 1;
    }

    // ── Available years / usernames (from ALL trips, not filtered) ──────────
    const allTrips = await Trip.find({}, { returnDate: 1, travelDate: 1, username: 1 }).lean();

    const availableYears = [...new Set(
      allTrips
        .map(t => t.returnDate || t.travelDate)
        .filter(Boolean)
        .map(d => new Date(d).getUTCFullYear())
    )].sort((a, b) => b - a);

    // Financial years: April of year N → March of year N+1
    const availableFinancialYears = [...new Set(
      allTrips
        .map(t => t.returnDate || t.travelDate)
        .filter(Boolean)
        .map(d => {
          const dt = new Date(d);
          const y  = dt.getUTCMonth() >= 3 ? dt.getUTCFullYear() : dt.getUTCFullYear() - 1;
          return `${y}-${String((y + 1) % 100).padStart(2, '0')}`;
        })
    )].sort((a, b) => b.localeCompare(a));

    const availableUsernames = (await Trip.distinct('username')).sort();

    res.json({
      success: true,
      data: {
        daysInIndia,
        daysInUAE,
        totalDays:   daysInIndia + daysInUAE,
        totalTrips,
        monthly: Object.entries(monthlyMap)
          .map(([month, d]) => ({ month, india: d.india, uae: d.uae, trips: d.trips }))
          .sort((a, b) => a.month.localeCompare(b.month)),
        yearly: Object.entries(yearlyMap)
          .map(([year, d]) => ({ year, india: d.india, uae: d.uae, trips: d.trips }))
          .sort((a, b) => a.year.localeCompare(b.year)),
        availableYears,
        availableFinancialYears,
        availableUsernames,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/stats/years ──────────────────────────────────────────────────────
router.get('/years', async (req, res) => {
  try {
    const trips = await Trip.find({}, { returnDate: 1, travelDate: 1, username: 1 }).lean();

    const years = [...new Set(
      trips
        .map(t => t.returnDate || t.travelDate)
        .filter(Boolean)
        .map(d => new Date(d).getUTCFullYear())
    )].sort((a, b) => b - a);

    const financialYears = [...new Set(
      trips
        .map(t => t.returnDate || t.travelDate)
        .filter(Boolean)
        .map(d => {
          const dt = new Date(d);
          const y  = dt.getUTCMonth() >= 3 ? dt.getUTCFullYear() : dt.getUTCFullYear() - 1;
          return `${y}-${String((y + 1) % 100).padStart(2, '0')}`;
        })
    )].sort((a, b) => b.localeCompare(a));

    const usernames = (await Trip.distinct('username')).sort();

    res.json({ success: true, data: { years, financialYears, usernames } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;