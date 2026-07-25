const express = require('express');
const router = express.Router();

const { memoryReports, liveStats } = require('./memoryStore');
const { isDbConnected } = require('./dbConnect');

let Report;
try {
  Report = require('./reportModel');
} catch (e) {
  /* opsional */
}

router.post('/', async (req, res) => {
  const { reporterId, reportedId, reason, note, roomId } = req.body || {};

  if (!reportedId || !['spam', 'toxic', 'inappropriate', 'other'].includes(reason)) {
    return res.status(400).json({ error: 'Data laporan tidak lengkap.' });
  }

  const doc = {
    reporterId: reporterId || 'unknown',
    reportedId,
    reason,
    note: (note || '').toString().slice(0, 500),
    roomId: roomId || null,
    createdAt: new Date(),
  };

  liveStats.totalReportsToday++;

  if (isDbConnected() && Report) {
    try {
      await Report.create(doc);
      return res.json({ ok: true });
    } catch (err) {
      memoryReports.push(doc);
      return res.json({ ok: true });
    }
  }

  memoryReports.push(doc);
  res.json({ ok: true });
});

module.exports = router;
