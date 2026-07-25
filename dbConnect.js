const mongoose = require('mongoose');

/**
 * Koneksi ke MongoDB bersifat OPSIONAL.
 * Kalau MONGODB_URI tidak diset atau koneksi gagal, server tetap jalan
 * (matching & chat real-time tidak butuh database sama sekali).
 * Fitur yang butuh persistence (laporan, ban) akan otomatis fallback
 * ke penyimpanan in-memory lewat memoryStore.js.
 */
let isConnected = false;

async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.log('[DB] MONGODB_URI tidak diset. Berjalan dalam mode in-memory (laporan & ban tidak permanen).');
    return false;
  }

  try {
    await mongoose.connect(uri);
    isConnected = true;
    console.log('[DB] Terhubung ke MongoDB.');
    return true;
  } catch (err) {
    console.error('[DB] Gagal konek ke MongoDB, fallback ke in-memory store:', err.message);
    return false;
  }
}

function isDbConnected() {
  return isConnected;
}

module.exports = { connectDB, isDbConnected };
