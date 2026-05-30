const express = require('express');
const router  = express.Router();
const Trip    = require('../models/Trip');

function getFinancialYearRange(financialYear) {
  const startYear = parseInt(String(financialYear).split('-')[0], 10);
  return {
    from: new Date(Date.UTC(startYear,     3,  1,  0,  0,  0,   0)),
    to:   new Date(Date.UTC(startYear + 1, 2, 31, 23, 59, 59, 999)),
  };
}

function computeStats(allTrips, filterFn) {
  const MS = 1000 * 60 * 60 * 24;
  const sorted = [...allTrips].sort((a, b) => new Date(a.departureDate) - new Date(b.departureDate));
  const segments = [];

  for (let i = 0; i < sorted.length; i++) {
    const trip = sorted[i];
    const dep  = new Date(trip.departureDate);
    const ret  = new Date(trip.returnDate);
    const dest = trip.direction === 'UAE_TO_INDIA' ? 'india' : 'uae';
    segments.push({ start: dep, end: ret, country: dest, type: 'trip' });

    if (i < sorted.length - 1) {
      const nextDep  = new Date(sorted[i + 1].departureDate);
      const gapStart = new Date(ret.getTime() + MS);
      const gapEnd   = new Date(nextDep.getTime() - MS);
      if (gapEnd >= gapStart) {
        const gapCountry = trip.direction === 'UAE_TO_INDIA' ? 'uae' : 'india';
        segments.push({ start: gapStart, end: gapEnd, country: gapCountry, type: 'gap' });
      }
    }
  }

  const monthlyMap = {}, yearlyMap = {};
  let daysInIndia = 0, daysInUAE = 0;

  for (const seg of segments) {
    let segStart = new Date(seg.start), segEnd = new Date(seg.end);
    if (filterFn) {
      if (filterFn.from && segStart < filterFn.from) segStart = new Date(filterFn.from);
      if (filterFn.to   && segEnd   > filterFn.to  ) segEnd   = new Date(filterFn.to);
      if (segEnd < segStart) continue;
    }
    const days = Math.round((segEnd - segStart) / MS) + 1;
    if (days <= 0) continue;
    if (seg.country === 'india') daysInIndia += days; else daysInUAE += days;

    let cursor = new Date(segStart.getFullYear(), segStart.getMonth(), segStart.getDate());
    while (cursor <= segEnd) {
      const yearKey  = cursor.getFullYear().toString();
      const monthKey = `${yearKey}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
      const endOfMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
      const sliceEnd   = endOfMonth < segEnd ? endOfMonth : new Date(segEnd);
      const sliceDays  = Math.round((sliceEnd - cursor) / MS) + 1;

      if (!monthlyMap[monthKey]) monthlyMap[monthKey] = { india: 0, uae: 0, tripsToIndia: 0, tripsToUAE: 0 };
      if (!yearlyMap[yearKey])   yearlyMap[yearKey]   = { india: 0, uae: 0, tripsToIndia: 0, tripsToUAE: 0 };

      if (seg.country === 'india') { monthlyMap[monthKey].india += sliceDays; yearlyMap[yearKey].india += sliceDays; }
      else                         { monthlyMap[monthKey].uae   += sliceDays; yearlyMap[yearKey].uae   += sliceDays; }

      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
  }

  let tripsToIndia = 0, tripsToUAE = 0;
  for (const trip of allTrips) {
    const dep = new Date(trip.departureDate);
    if (filterFn?.from && dep < filterFn.from) continue;
    if (filterFn?.to   && dep > filterFn.to  ) continue;
    const yearKey  = dep.getFullYear().toString();
    const monthKey = `${yearKey}-${String(dep.getMonth() + 1).padStart(2, '0')}`;
    if (trip.direction === 'UAE_TO_INDIA') {
      tripsToIndia++;
      if (yearlyMap[yearKey])   yearlyMap[yearKey].tripsToIndia++;
      if (monthlyMap[monthKey]) monthlyMap[monthKey].tripsToIndia++;
    } else {
      tripsToUAE++;
      if (yearlyMap[yearKey])   yearlyMap[yearKey].tripsToUAE++;
      if (monthlyMap[monthKey]) monthlyMap[monthKey].tripsToUAE++;
    }
  }

  return {
    daysInIndia, daysInUAE, tripsToIndia, tripsToUAE,
    monthly: Object.entries(monthlyMap).map(([month, d]) => ({ month, ...d })).sort((a,b) => a.month.localeCompare(b.month)),
    yearly:  Object.entries(yearlyMap) .map(([year,  d]) => ({ year,  ...d })).sort((a,b) => a.year.localeCompare(b.year)),
  };
}

// GET /api/stats/summary
router.get('/summary', async (req, res) => {
  try {
    const { year, financialYear, username } = req.query;

    // Apply username filter at DB level so gap-calc only uses that person's trips
    const mongoFilter = {};
    if (username && username !== 'ALL') {
      mongoFilter.username = { $regex: `^${username}$`, $options: 'i' };
    }
    const allTrips = await Trip.find(mongoFilter).sort({ departureDate: 1 });

    let filterFn = null;
    if (financialYear && financialYear !== 'ALL') {
      filterFn = getFinancialYearRange(financialYear);
    } else if (year && year !== 'ALL') {
      const y = parseInt(year, 10);
      filterFn = {
        from: new Date(Date.UTC(y,  0,  1,  0,  0,  0,   0)),
        to:   new Date(Date.UTC(y, 11, 31, 23, 59, 59, 999)),
      };
    }

    const stats = computeStats(allTrips, filterFn);

    // Year/FY lists from ALL trips (not filtered by username)
    const allForYears = await Trip.find({}, { departureDate: 1 });
    const availableYears = [...new Set(allForYears.map(t => new Date(t.departureDate).getUTCFullYear()))].sort((a,b) => b-a);
    const availableFinancialYears = [...new Set(allForYears.map(t => {
      const d = new Date(t.departureDate);
      const y = d.getUTCMonth() >= 3 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
      return `${y}-${String((y+1)%100).padStart(2,'0')}`;
    }))].sort((a,b) => b.localeCompare(a));

    // All distinct usernames for the filter dropdown
    const availableUsernames = (await Trip.distinct('username')).sort();

    res.json({
      success: true,
      data: {
        ...stats,
        totalTrips: allTrips.length,
        totalDays: stats.daysInIndia + stats.daysInUAE,
        availableYears,
        availableFinancialYears,
        availableUsernames,
        note: 'Gap days between trips are attributed to the country you returned to.',
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/stats/years
router.get('/years', async (req, res) => {
  try {
    const trips = await Trip.find({}, { departureDate: 1 });
    const years = [...new Set(trips.map(t => new Date(t.departureDate).getUTCFullYear()))].sort((a,b) => b-a);
    const financialYears = [...new Set(trips.map(t => {
      const d = new Date(t.departureDate);
      const y = d.getUTCMonth() >= 3 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
      return `${y}-${String((y+1)%100).padStart(2,'0')}`;
    }))].sort((a,b) => b.localeCompare(a));
    const usernames = (await Trip.distinct('username')).sort();
    res.json({ success: true, data: { years, financialYears, usernames } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;