const mongoose = require('mongoose');

const tripSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      default: 'Sajeev PK',
      trim: true,
    },
    designation: {
      type: String,
      required: true,
      default: 'Managing Director',
      trim: true,
    },
    direction: {
      type: String,
      required: true,
      enum: ['UAE_TO_INDIA', 'INDIA_TO_UAE'],
    },
    departureDate: {
      type: Date,
      required: true,
    },
    returnDate: {
      type: Date,
      required: true,
    },
    daysCount: {
      type: Number,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Auto-calculate days (inclusive: both departure and return counted)
tripSchema.pre('save', function (next) {
  if (this.departureDate && this.returnDate) {
    const msPerDay = 1000 * 60 * 60 * 24;
    const diff = Math.round(
      (this.returnDate - this.departureDate) / msPerDay
    );
    this.daysCount = diff + 1; // inclusive
  }
  next();
});

// Also handle findOneAndUpdate
tripSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate();
  if (update.departureDate && update.returnDate) {
    const msPerDay = 1000 * 60 * 60 * 24;
    const dep = new Date(update.departureDate);
    const ret = new Date(update.returnDate);
    const diff = Math.round((ret - dep) / msPerDay);
    update.daysCount = diff + 1;
  }
  next();
});

module.exports = mongoose.model('Trip', tripSchema);
