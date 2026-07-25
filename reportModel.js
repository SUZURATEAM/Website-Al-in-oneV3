const mongoose = require('mongoose');

const ReportSchema = new mongoose.Schema({
  reporterId: { type: String, required: true },
  reportedId: { type: String, required: true },
  reason: {
    type: String,
    enum: ['spam', 'toxic', 'inappropriate', 'other'],
    required: true,
  },
  note: { type: String, maxlength: 500, default: '' },
  roomId: { type: String },
  createdAt: { type: Date, default: Date.now },
  resolved: { type: Boolean, default: false },
});

module.exports = mongoose.model('Report', ReportSchema);
