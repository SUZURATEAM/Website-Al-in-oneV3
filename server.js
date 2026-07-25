require('dotenv').config();

const path = require('path');
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const { connectDB } = require('./dbConnect');
const { registerSocketHandlers, broadcastCounts } = require('./socket');
const adminRoutes = require('./adminRoutes');
const reportRoutes = require('./reportRoutes');

const PORT = process.env.PORT || 3000;

// Semua file frontend ada di root proyek yang sama dengan server (struktur flat,
// biar gampang di-upload lewat GitHub mobile web tanpa perlu bikin folder).
// Supaya source code server (.js) tidak ikut ke-download publik, kita hanya
// izinkan file-file frontend berikut untuk disajikan sebagai static file.
const PUBLIC_FILES = [
  'index.html',
  'chat.html',
  'admin.html',
  'style.css',
  'script.js',
  'chat.js',
  'admin.js',
];

async function main() {
  await connectDB(); // opsional; server tetap jalan kalau gagal/tidak diset

  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: process.env.ALLOWED_ORIGIN || '*' },
  });

  app.set('io', io);

  app.use(cors({ origin: process.env.ALLOWED_ORIGIN || '*' }));
  app.use(express.json());

  // Sajikan HANYA file frontend yang ada di daftar PUBLIC_FILES
  app.get('/:file', (req, res, next) => {
    if (PUBLIC_FILES.includes(req.params.file)) {
      return res.sendFile(path.join(__dirname, req.params.file));
    }
    next();
  });

  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
  });

  // REST API
  app.use('/api/admin', adminRoutes);
  app.use('/api/report', reportRoutes);

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: Date.now() });
  });

  // Fallback ke index.html untuk route lain yang bukan file/API dikenal (SPA-friendly)
  app.use((req, res) => {
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.sendFile(path.join(__dirname, 'index.html'));
  });

  registerSocketHandlers(io);

  server.listen(PORT, () => {
    console.log(`🔵 RiyoChat server jalan di http://localhost:${PORT}`);
    broadcastCounts(io);
  });
}

main().catch((err) => {
  console.error('Gagal menjalankan server:', err);
  process.exit(1);
});
