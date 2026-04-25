const mongoose = require("mongoose");

const tripSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      default: "Sajeev PK",
      trim: true,
    },
    designation: {
      type: String,
      required: true,
      default: "Managing Director",
      trim: true,
    },
    direction: {
      type: String,
      required: true,
      enum: ["UAE_TO_INDIA", "INDIA_TO_UAE"],
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
    issueDate: {
      type: Date,
      default: null,
    },
    airline: {
      type: String,
      trim: true,
      default: "",
    },
    // ⚠️  NO enum here — enum with runValidators rejects '' on update
    travelClass: {
      type: String,
      trim: true,
      default: "",
    },
    sector: {
      type: String,
      trim: true,
      default: "",
    },
    fare: {
      type: Number,
      default: null,
    },
    fareCurrency: {
      type: String,
      trim: true,
      default: "AED",
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },
    arrivalTime: { type: String, default: null }, // "HH:MM" IST — UAE→India only
    departureTime: { type: String, default: null }, // "HH:MM" IST — India→UAE only
  },
  { timestamps: true },
);

// Auto-calculate daysCount on every save
tripSchema.pre("save", function (next) {
  if (this.departureDate && this.returnDate) {
    const msPerDay = 1000 * 60 * 60 * 24;
    this.daysCount =
      Math.round((this.returnDate - this.departureDate) / msPerDay) + 1;
  }
  next();
});

// ⚠️  Do NOT use pre('findOneAndUpdate') for daysCount — the PUT route
//     now does a find → mutate → save() cycle so the pre('save') hook fires.

module.exports = mongoose.model("Trip", tripSchema);
