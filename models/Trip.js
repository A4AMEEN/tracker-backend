// models/Trip.js
const mongoose = require('mongoose');

const tripSchema = new mongoose.Schema({
  username:          { type: String, required: true, trim: true, default: '' },
  designation:       { type: String, trim: true, default: '' },
  issueDate:         { type: Date, default: null },
  airline:           { type: String, trim: true, default: '' },
  travelClass:       { type: String, trim: true, default: '' },
  sector:            { type: String, trim: true, default: '' },
  // 'IN_UAE' | 'IN_INDIA' | '' — for rows where travel starts mid-period
  startingLocation:  { type: String, trim: true, default: '' },
  travelDate:        { type: Date, default: null },   // null = "In UAE" / "In India" start
  returnDate:        { type: Date, default: null },
  exitTime:          { type: String, trim: true, default: '' },
  entryTime:         { type: String, trim: true, default: '' },
  // Manually entered / auto-suggested days
  inIndiaDays:       { type: Number, default: 0, min: 0 },
  inUAEDays:         { type: Number, default: 0, min: 0 },
  fare:              { type: Number, default: null },
  fareCurrency:      { type: String, trim: true, default: 'AED' },
  notes:             { type: String, trim: true, default: '' },
  direction:         { type: String, default: '' }, // legacy compat
}, { timestamps: true });

module.exports = mongoose.model('Trip', tripSchema);