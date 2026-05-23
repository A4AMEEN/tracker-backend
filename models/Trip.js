// models/Trip.js
const mongoose = require('mongoose');

const TripSchema = new mongoose.Schema({
  // ── Who ───────────────────────────────────────────────────
  username:     { type: String, required: true, trim: true },
  designation:  { type: String, default: '',   trim: true },

  // ── Ticket info ───────────────────────────────────────────
  issueDate:    { type: Date,   default: null },
  airline:      { type: String, default: '',   trim: true },
  sector:       { type: String, default: '',   trim: true },   // e.g. "COK/DXB/TRV"
  travelClass:  { type: String, default: '',   trim: true },

  // ── Travel dates ──────────────────────────────────────────
  // travelDateText: stores "In UAE" / "In India" for opening-balance rows,
  //                 or left null when travelDate (Date) is set
  travelDateText: { type: String, default: null },             // "In UAE" | "In India" | null
  travelDate:     { type: Date,   default: null },             // null when travelDateText is set
  returnDate:     { type: Date,   default: null },

  // ── Times ─────────────────────────────────────────────────
  exitTime:     { type: String, default: '' },                 // "4:30 AM"
  entryTime:    { type: String, default: '' },                 // "3:10 AM"

  // ── Days (manually entered) ───────────────────────────────
  inIndiaDays:  { type: Number, default: 0 },
  inUAEDays:    { type: Number, default: 0 },

  // ── Notes ─────────────────────────────────────────────────
  notes:        { type: String, default: '' },

}, { timestamps: true });

// Virtual: total days this record
TripSchema.virtual('totalDays').get(function () {
  return (this.inIndiaDays || 0) + (this.inUAEDays || 0);
});

// Sort helper: effective date for ordering
TripSchema.virtual('effectiveDate').get(function () {
  return this.travelDate || this.returnDate;
});

module.exports = mongoose.model('Trip', TripSchema);