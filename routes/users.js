// routes/users.js
const express = require('express');
const router  = express.Router();
const User    = require('../models/User');
const Trip    = require('../models/Trip');

// ── GET all users (with their trip stats) ──────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const users = await User.find({}).sort({ firstName: 1, lastName: 1 });

    // Attach quick trip stats for each user
    const enriched = await Promise.all(
      users.map(async (u) => {
        const fullName = u.fullName;
        const trips    = await Trip.find({ username: { $regex: `^${fullName}$`, $options: 'i' } });
        const daysInIndia = trips
          .filter(t => t.direction === 'UAE_TO_INDIA')
          .reduce((s, t) => s + (t.daysCount || 0), 0);
        const daysInUAE = trips
          .filter(t => t.direction === 'INDIA_TO_UAE')
          .reduce((s, t) => s + (t.daysCount || 0), 0);
        return {
          ...u.toJSON(),
          tripCount: trips.length,
          daysInIndia,
          daysInUAE,
          totalDays: daysInIndia + daysInUAE,
        };
      })
    );

    res.json({ success: true, data: enriched, count: enriched.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET single user ────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST create user ───────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { firstName, lastName, designation, email, phone, nationality, passportNo, notes } = req.body;
    if (!firstName || !lastName || !designation) {
      return res.status(400).json({ success: false, error: 'First name, last name and designation are required' });
    }
    // Prevent exact-name duplicates
    const existing = await User.findOne({
      firstName: { $regex: `^${firstName}$`, $options: 'i' },
      lastName:  { $regex: `^${lastName}$`,  $options: 'i' },
    });
    if (existing) {
      return res.status(409).json({ success: false, error: `User "${firstName} ${lastName}" already exists` });
    }
    const user = new User({ firstName, lastName, designation, email, phone, nationality, passportNo, notes });
    await user.save();
    res.status(201).json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── PUT update user ────────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const { firstName, lastName, designation, email, phone, nationality, passportNo, isActive, notes } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    const oldFullName = user.fullName;

    if (firstName   !== undefined) user.firstName   = firstName;
    if (lastName    !== undefined) user.lastName     = lastName;
    if (designation !== undefined) user.designation  = designation;
    if (email       !== undefined) user.email        = email;
    if (phone       !== undefined) user.phone        = phone;
    if (nationality !== undefined) user.nationality  = nationality;
    if (passportNo  !== undefined) user.passportNo   = passportNo;
    if (isActive    !== undefined) user.isActive     = isActive;
    if (notes       !== undefined) user.notes        = notes;

    await user.save();
    const newFullName = user.fullName;

    // If name changed, cascade-update all trips that reference old full name
    if (oldFullName !== newFullName) {
      await Trip.updateMany(
        { username: { $regex: `^${oldFullName}$`, $options: 'i' } },
        { $set: { username: newFullName, designation: user.designation } }
      );
    } else if (designation !== undefined) {
      // designation changed only — update trips
      await Trip.updateMany(
        { username: { $regex: `^${newFullName}$`, $options: 'i' } },
        { $set: { designation: user.designation } }
      );
    }

    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── DELETE user ────────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    res.json({ success: true, message: `User "${user.fullName}" deleted` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;