const mongoose = require('mongoose');

const BannedUserSchema = new mongoose.Schema({
  identifier: { type: String, required: true, unique: true },
  reason: { type: String, default: '' },
  bannedAt: { type: Date, default: Date.now },
  bannedBy: { type: String, default: 'admin' },
});

module.exports = mongoose.model('BannedUser', BannedUserSchema);
