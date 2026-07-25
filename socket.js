const crypto = require('crypto');
const { onlineUsers, searchQueue, activeRooms, userRoomMap, memoryBans, memoryReports, liveStats } = require('./memoryStore');
const { findBestMatch, addToQueue, removeFromQueue } = require('./matching');
const { sanitizeMessage, isSpamming } = require('./filters');
const { isDbConnected } = require('./dbConnect');

let Report, BannedUser;
try {
  Report = require('./reportModel');
  BannedUser = require('./bannedUserModel');
} catch (e) {
  // Model belum terpakai kalau mongoose tidak dikonfigurasi — tidak masalah.
}

function randomGuestId() {
  const n = Math.floor(10000 + Math.random() * 90000);
  return `Guest#${n}`;
}

function broadcastCounts(io) {
  io.emit('counts:update', {
    online: onlineUsers.size,
    searching: searchQueue.length,
  });
}

function botMessage(text) {
  return {
    id: crypto.randomUUID(),
    sender: 'bot',
    text,
    timestamp: Date.now(),
  };
}

function createRoomId() {
  return crypto.randomUUID();
}

/** Bersihkan user dari queue, room aktif, dan beri tahu partner bila ada */
function leaveCurrentRoom(io, socketId, { notifyPartner = true, reasonText } = {}) {
  const roomId = userRoomMap.get(socketId);
  if (!roomId) return null;

  const room = activeRooms.get(roomId);
  if (!room) {
    userRoomMap.delete(socketId);
    return null;
  }

  const partnerId = room.userA === socketId ? room.userB : room.userA;

  activeRooms.delete(roomId);
  userRoomMap.delete(socketId);
  userRoomMap.delete(partnerId);

  if (notifyPartner && partnerId && onlineUsers.has(partnerId)) {
    io.to(partnerId).emit('chat:bot-message', botMessage(reasonText || '❌ Lawan chat meninggalkan percakapan.'));
    io.to(partnerId).emit('partner:left');
  }

  return partnerId;
}

/** Coba matchkan user yang lagi nyari; kalau ketemu, bikin room & kabarin dua-duanya */
function tryMatch(io, socketId) {
  const user = onlineUsers.get(socketId);
  if (!user || !user.searching) return;

  const partnerId = findBestMatch(socketId);
  if (!partnerId) return; // belum ada yang cocok, tetap di antrian

  const partner = onlineUsers.get(partnerId);
  if (!partner) return;

  // Keluarkan berdua dari antrian
  removeFromQueue(socketId);
  removeFromQueue(partnerId);
  user.searching = false;
  partner.searching = false;

  const roomId = createRoomId();
  activeRooms.set(roomId, { userA: socketId, userB: partnerId, createdAt: Date.now() });
  userRoomMap.set(socketId, roomId);
  userRoomMap.set(partnerId, roomId);

  liveStats.totalMatchesToday++;

  const payloadFor = (selfUser, otherUser) => ({
    roomId,
    partner: {
      nickname: otherUser.nickname,
      guestId: otherUser.guestId,
      interests: otherUser.interests,
    },
  });

  io.to(socketId).emit('match:found', payloadFor(user, partner));
  io.to(partnerId).emit('match:found', payloadFor(partner, user));

  io.to(socketId).emit('chat:bot-message', botMessage('✅ Teman ditemukan.'));
  io.to(partnerId).emit('chat:bot-message', botMessage('✅ Teman ditemukan.'));

  broadcastCounts(io);
}

/** Setelah masuk antrian, coba matchkan dia dengan siapa pun yang sudah nunggu */
function enterQueueAndMatch(io, socketId) {
  addToQueue(socketId);
  io.to(socketId).emit('chat:bot-message', botMessage('🔍 Sedang mencari teman...'));
  broadcastCounts(io);

  // Coba cocokkan socketId ini, dan juga kasih kesempatan tiap orang lain di antrian
  // untuk dicek ulang (siapa tahu socket baru ini partner terbaik buat mereka).
  tryMatch(io, socketId);
}

function registerSocketHandlers(io) {
  io.on('connection', (socket) => {
    const clientIp = socket.handshake.address || 'unknown';

    if (memoryBans.has(clientIp)) {
      socket.emit('banned', { reason: 'Kamu telah diblokir dari RiyoChat.' });
      socket.disconnect(true);
      return;
    }

    // --- Setup profil ---
    socket.on('profile:setup', (data = {}) => {
      const nickname = (data.nickname || '').trim().slice(0, 20) || null;
      const age = Number.isInteger(data.age) && data.age > 0 && data.age < 120 ? data.age : null;
      const gender = ['male', 'female'].includes(data.gender) ? data.gender : null;
      const filterGender = ['male', 'female', 'any'].includes(data.filterGender) ? data.filterGender : 'any';
      const interests = Array.isArray(data.interests) ? data.interests.slice(0, 6) : [];

      const guestId = randomGuestId();

      onlineUsers.set(socket.id, {
        socketId: socket.id,
        guestId,
        nickname: nickname || guestId,
        age,
        gender,
        filterGender,
        interests,
        searching: false,
        searchStartedAt: null,
        messageTimestamps: [], // buat anti-spam
        ip: clientIp,
      });

      socket.emit('profile:ready', { guestId });
      broadcastCounts(io);
    });

    // --- Mulai mencari teman ---
    socket.on('search:start', () => {
      const user = onlineUsers.get(socket.id);
      if (!user) return;
      if (userRoomMap.has(socket.id)) return; // sudah di dalam chat
      if (user.searching) return;

      user.searching = true;
      user.searchStartedAt = Date.now();
      enterQueueAndMatch(io, socket.id);
    });

    // --- Berhenti mencari, kembali ke halaman utama ---
    socket.on('search:stop', () => {
      const user = onlineUsers.get(socket.id);
      if (!user) return;
      user.searching = false;
      removeFromQueue(socket.id);
      broadcastCounts(io);
    });

    // --- Kirim pesan chat ---
    socket.on('chat:message', (data = {}) => {
      const user = onlineUsers.get(socket.id);
      const roomId = userRoomMap.get(socket.id);
      if (!user || !roomId) return;

      if (isSpamming(user.messageTimestamps)) {
        socket.emit('chat:blocked', { reason: 'spam' });
        return;
      }

      const result = sanitizeMessage(data.text);
      if (!result.ok) {
        socket.emit('chat:blocked', { reason: result.reason });
        return;
      }

      const room = activeRooms.get(roomId);
      if (!room) return;
      const partnerId = room.userA === socket.id ? room.userB : room.userA;

      const message = {
        id: crypto.randomUUID(),
        sender: 'partner', // dari sudut pandang penerima
        text: result.text,
        timestamp: Date.now(),
      };

      // Kirim ke pengirim sendiri sebagai konfirmasi (sender: 'me')
      socket.emit('chat:message', { ...message, id: message.id, sender: 'me' });
      // Kirim ke partner
      if (onlineUsers.has(partnerId)) {
        io.to(partnerId).emit('chat:message', message);
      }
    });

    // --- Hapus pesan sendiri (memberi tahu partner untuk hide bubble) ---
    socket.on('chat:delete-message', (data = {}) => {
      const roomId = userRoomMap.get(socket.id);
      if (!roomId || !data.id) return;
      const room = activeRooms.get(roomId);
      if (!room) return;
      const partnerId = room.userA === socket.id ? room.userB : room.userA;
      if (onlineUsers.has(partnerId)) {
        io.to(partnerId).emit('chat:message-deleted', { id: data.id });
      }
    });

    // --- Indikator mengetik ---
    socket.on('chat:typing', (data = {}) => {
      const roomId = userRoomMap.get(socket.id);
      if (!roomId) return;
      const room = activeRooms.get(roomId);
      if (!room) return;
      const partnerId = room.userA === socket.id ? room.userB : room.userA;
      if (onlineUsers.has(partnerId)) {
        io.to(partnerId).emit('chat:typing', { isTyping: !!data.isTyping });
      }
    });

    // --- Skip: akhiri chat sekarang, langsung cari partner baru ---
    socket.on('chat:skip', () => {
      const user = onlineUsers.get(socket.id);
      if (!user) return;

      leaveCurrentRoom(io, socket.id, { reasonText: '🔄 Lawan chat melakukan skip. Sedang mencari partner baru...' });

      user.searching = true;
      user.searchStartedAt = Date.now();
      enterQueueAndMatch(io, socket.id);
    });

    // --- Stop chat: kembali ke halaman utama tanpa cari lagi ---
    socket.on('chat:stop', () => {
      leaveCurrentRoom(io, socket.id);
      const user = onlineUsers.get(socket.id);
      if (user) user.searching = false;
      removeFromQueue(socket.id);
      broadcastCounts(io);
    });

    // --- Laporkan pengguna ---
    socket.on('chat:report', async (data = {}) => {
      const roomId = userRoomMap.get(socket.id);
      const room = roomId ? activeRooms.get(roomId) : null;
      const reportedId = room ? (room.userA === socket.id ? room.userB : room.userA) : null;
      const reportedUser = reportedId ? onlineUsers.get(reportedId) : null;

      const reason = ['spam', 'toxic', 'inappropriate', 'other'].includes(data.reason) ? data.reason : 'other';
      const note = (data.note || '').toString().slice(0, 500);

      const reportDoc = {
        reporterId: onlineUsers.get(socket.id)?.guestId || socket.id,
        reportedId: reportedUser?.guestId || reportedId || 'unknown',
        reason,
        note,
        roomId: roomId || null,
        createdAt: new Date(),
      };

      liveStats.totalReportsToday++;

      if (isDbConnected() && Report) {
        try {
          await Report.create(reportDoc);
        } catch (err) {
          memoryReports.push(reportDoc);
        }
      } else {
        memoryReports.push(reportDoc);
      }

      socket.emit('chat:report-received');
    });

    // --- Disconnect ---
    socket.on('disconnect', () => {
      removeFromQueue(socket.id);
      leaveCurrentRoom(io, socket.id);
      onlineUsers.delete(socket.id);
      broadcastCounts(io);
    });
  });
}

module.exports = { registerSocketHandlers, broadcastCounts };
