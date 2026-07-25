const express = require('express');
const router = express.Router();

const { onlineUsers, activeRooms, memoryReports, memoryBans, liveStats } = require('./memoryStore');
const { isDbConnected } = require('./dbConnect');

let Report, BannedUser;
try {
  Report = require('./reportModel');
  BannedUser = require('./bannedUserModel');
} catch (e) {
  /* opsional */
}

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'riyoadmin123';

function requireAdmin(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Token admin tidak valid.' });
  }
  next();
}

router.get('/stats', requireAdmin, (req, res) => {
  res.json({
    onlineUsers: onlineUsers.size,
    activeRooms: activeRooms.size,
    totalMatchesToday: liveStats.totalMatchesToday,
    totalReportsToday: liveStats.totalReportsToday,
    dbConnected: isDbConnected(),
  });
});

router.get('/reports', requireAdmin, async (req, res) => {
  if (isDbConnected() && Report) {
    try {
      const reports = await Report.find().sort({ createdAt: -1 }).limit(200);
      return res.json(reports);
    } catch (err) {
      return res.json(memoryReports.slice().reverse());
    }
  }
  res.json(memoryReports.slice().reverse());
});

router.post('/ban', requireAdmin, async (req, res) => {
  const { identifier, reason } = req.body || {};
  if (!identifier) {
    return res.status(400).json({ error: 'identifier wajib diisi.' });
  }

  memoryBans.add(identifier);

  if (isDbConnected() && BannedUser) {
    try {
      await BannedUser.findOneAndUpdate(
        { identifier },
        { identifier, reason: reason || '', bannedAt: new Date() },
        { upsert: true }
      );
    } catch (err) {
      // sudah ke-cover memoryBans
    }
  }

  for (const [socketId, user] of onlineUsers.entries()) {
    if (user.ip === identifier || user.guestId === identifier) {
      req.app.get('io')?.to(socketId).emit('banned', { reason: reason || 'Kamu telah diblokir dari RiyoChat.' });
      req.app.get('io')?.sockets.sockets.get(socketId)?.disconnect(true);
    }
  }

  res.json({ ok: true });
});

router.post('/broadcast', requireAdmin, (req, res) => {
  const { message } = req.body || {};
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message wajib diisi.' });
  }

  const io = req.app.get('io');
  io.emit('admin:broadcast', { message: message.slice(0, 500), timestamp: Date.now() });

  res.json({ ok: true });
});

module.exports = router;
