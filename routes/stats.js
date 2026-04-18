const express = require('express');
const router = express.Router();
const Trip = require('../models/Trip');

/*
 * GAP-BASED DAY COUNTING
 * ----------------------
 * All trips are sorted chronologically.
 * Days in destination = trip days (inclusive both ends).
 * Days in the gap between trip[i].returnDate and trip[i+1].departureDate
 * are assigned to whichever country the traveller returned TO after trip[i]:
 *   - After UAE_TO_INDIA → returned to UAE → gap days = UAE
 *   - After INDIA_TO_UAE → returned to India → gap days = India
 *
 * Example:
 *   UAE→India Jan 1–Feb 1  → 32 days in India
 *   [gap Feb 2–Apr 30]     → 88 days in UAE
 *   UAE→India May 1–Jun 1  → 32 days in India
 */
function computeStats(allTrips, filterFn) {
  const MS = 1000 * 60 * 60 * 24;

  const sorted = [...allTrips].sort(
    (a, b) => new Date(a.departureDate) - new Date(b.departureDate)
  );

  const segments = [];

  for (let i = 0; i < sorted.length; i++) {
    const trip = sorted[i];
    const dep = new Date(trip.departureDate);
    const ret = new Date(trip.returnDate);
    const destCountry = trip.direction === 'UAE_TO_INDIA' ? 'india' : 'uae';

    segments.push({ start: dep, end: ret, country: destCountry, type: 'trip' });

    if (i < sorted.length - 1) {
      const nextDep = new Date(sorted[i + 1].departureDate);
      const gapStart = new Date(ret.getTime() + MS);   // day after return
      const gapEnd   = new Date(nextDep.getTime() - MS); // day before next departure

      if (gapEnd >= gapStart) {
        const gapCountry = trip.direction === 'UAE_TO_INDIA' ? 'uae' : 'india';
        segments.push({ start: gapStart, end: gapEnd, country: gapCountry, type: 'gap' });
      }
    }
  }

  const monthlyMap = {};
  const yearlyMap  = {};
  let daysInIndia = 0;
  let daysInUAE   = 0;

  for (const seg of segments) {
    let segStart = new Date(seg.start);
    let segEnd   = new Date(seg.end);

    if (filterFn) {
      if (filterFn.from && segStart < filterFn.from) segStart = new Date(filterFn.from);
      if (filterFn.to   && segEnd   > filterFn.to)   segEnd   = new Date(filterFn.to);
      if (segEnd < segStart) continue;
    }

    const days = Math.round((segEnd - segStart) / MS) + 1;
    if (days <= 0) continue;

    if (seg.country === 'india') daysInIndia += days;
    else                          daysInUAE   += days;

    // Spread days across calendar months they span
    let cursor = new Date(segStart.getFullYear(), segStart.getMonth(), segStart.getDate());
    while (cursor <= segEnd) {
      const yearKey  = cursor.getFullYear().toString();
      const monthKey = `${yearKey}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;

      const endOfMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
      const sliceEnd   = endOfMonth < segEnd ? endOfMonth : new Date(segEnd);
      const sliceDays  = Math.round((sliceEnd - cursor) / MS) + 1;

      if (!monthlyMap[monthKey]) monthlyMap[monthKey] = { india: 0, uae: 0 };
      if (!yearlyMap[yearKey])   yearlyMap[yearKey]   = { india: 0, uae: 0 };

      if (seg.country === 'india') {
        monthlyMap[monthKey].india += sliceDays;
        yearlyMap[yearKey].india   += sliceDays;
      } else {
        monthlyMap[monthKey].uae += sliceDays;
        yearlyMap[yearKey].uae   += sliceDays;
      }

      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
  }

  // Trip counts (actual logged records, optionally filtered by date range)
  let tripsToIndia = 0;
  let tripsToUAE   = 0;
  for (const trip of allTrips) {
    const dep = new Date(trip.departureDate);
    if (filterFn?.from && dep < filterFn.from) continue;
    if (filterFn?.to   && dep > filterFn.to)   continue;
    if (trip.direction === 'UAE_TO_INDIA') tripsToIndia++;
    else                                    tripsToUAE++;
  }

  const monthly = Object.entries(monthlyMap)
    .map(([month, data]) => ({ month, ...data }))
    .sort((a, b) => a.month.localeCompare(b.month));

  const yearly = Object.entries(yearlyMap)
    .map(([yr, data]) => ({ year: yr, ...data }))
    .sort((a, b) => a.year.localeCompare(b.year));

  return { daysInIndia, daysInUAE, tripsToIndia, tripsToUAE, monthly, yearly };
}

// GET summary stats
router.get('/summary', async (req, res) => {
  try {
    const { year } = req.query;

    // Always load ALL trips so cross-year gaps are not missed
    const allTrips = await Trip.find({}).sort({ departureDate: 1 });

    let filterFn = null;
    if (year && year !== 'ALL') {
      const y = parseInt(year);
      filterFn = {
        from: new Date(`${y}-01-01T00:00:00.000Z`),
        to:   new Date(`${y}-12-31T23:59:59.999Z`),
      };
    }

    const { daysInIndia, daysInUAE, tripsToIndia, tripsToUAE, monthly, yearly } =
      computeStats(allTrips, filterFn);

    const availableYears = [
      ...new Set(allTrips.map((t) => new Date(t.departureDate).getFullYear())),
    ].sort((a, b) => b - a);

    res.json({
      success: true,
      data: {
        totalTrips: allTrips.length,
        tripsToIndia,
        tripsToUAE,
        daysInIndia,
        daysInUAE,
        totalDays: daysInIndia + daysInUAE,
        monthly,
        yearly,
        availableYears,
        note: 'Gap days between trips are automatically attributed to the country you returned to.',
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET available years
router.get('/years', async (req, res) => {
  try {
    const trips = await Trip.find({}, { departureDate: 1 });
    const years = [
      ...new Set(trips.map((t) => new Date(t.departureDate).getFullYear())),
    ].sort((a, b) => b - a);
    res.json({ success: true, data: years });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
