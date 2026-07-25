/**
 * Sumber kebenaran tunggal (single source of truth) untuk state realtime.
 * Semua data di sini hidup di RAM supaya matching & chat secepat mungkin.
 * Modul lain (socket.js, matching.js, routes/admin.js) import dari sini
 * supaya tidak ada state yang tercecer di banyak tempat.
 */

/** Map<socketId, UserSession> — semua user yang sedang terhubung */
const onlineUsers = new Map();

/** Array<socketId> — antrian user yang sedang mencari partner (FIFO + skor minat) */
const searchQueue = [];

/** Map<roomId, Room> — semua room chat yang sedang aktif */
const activeRooms = new Map();

/** Map<socketId, roomId> — lookup cepat: user ini lagi di room mana */
const userRoomMap = new Map();

/** Fallback in-memory kalau MongoDB tidak dipakai */
const memoryReports = [];
const memoryBans = new Set(); // berisi identifier (ip/fingerprint) yang di-ban

/** Statistik ringan untuk admin panel */
const liveStats = {
  totalMatchesToday: 0,
  totalReportsToday: 0,
};

function resetDailyStats() {
  liveStats.totalMatchesToday = 0;
  liveStats.totalReportsToday = 0;
}

module.exports = {
  onlineUsers,
  searchQueue,
  activeRooms,
  userRoomMap,
  memoryReports,
  memoryBans,
  liveStats,
  resetDailyStats,
};
