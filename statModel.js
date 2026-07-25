const mongoose = require('mongoose');

const StatSchema = new mongoose.Schema({
  date: { type: String, required: true, unique: true },
  peakOnline: { type: Number, default: 0 },
  totalMatches: { type: Number, default: 0 },
  totalReports: { type: Number, default: 0 },
});

module.exports = mongoose.model('Stat', StatSchema);
