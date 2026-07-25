# RiyoChat 🔵

Platform chat anonim real-time — cari teman ngobrol baru tanpa perlu bikin akun.

## Struktur (flat — sengaja tanpa folder)

Semua file sengaja diletakkan rata di satu folder yang sama (bukan dipisah
`client/` dan `server/`) supaya gampang di-upload lewat GitHub versi mobile,
yang cuma bisa pilih file satu-satu tanpa bisa upload folder.

```
riyochat/
├── index.html, chat.html, admin.html     ← halaman frontend
├── style.css, script.js, chat.js, admin.js
├── server.js                              ← entry point
├── socket.js                              ← semua event Socket.IO & matching
├── matching.js                            ← algoritma matchmaking
├── filters.js                             ← anti-spam, filter kata kasar, blokir link
├── memoryStore.js                         ← state realtime (user online, room, antrian)
├── dbConnect.js                           ← koneksi MongoDB (opsional)
├── reportModel.js, bannedUserModel.js, statModel.js   ← skema Mongoose
├── adminRoutes.js, reportRoutes.js        ← REST API
├── package.json
└── .env.example
```

`server.js` cuma mengizinkan 7 file frontend di atas untuk diakses publik lewat
browser — file `.js` lain (socket.js, matching.js, dst) tetap jalan di server
tapi tidak bisa dibuka langsung dari URL, supaya source code backend tidak
ke-expose.

## Cara Menjalankan (lokal)

```bash
npm install
npm start
```

Buka `http://localhost:3000`.

## Deploy ke Railway

1. Push semua file di folder ini ke root sebuah GitHub repo (bukan di dalam subfolder).
2. Di Railway: New Project → Deploy from GitHub repo → pilih repo ini.
3. Root Directory dikosongkan / `/` (karena `package.json` ada di root).
4. Start Command: `npm start`.
5. (Opsional) isi Environment Variables: `ADMIN_TOKEN`, `MONGODB_URI`, `ALLOWED_ORIGIN`.

## Admin Panel

Buka `/admin.html`, masukkan `ADMIN_TOKEN` (default: `riyoadmin123`).
