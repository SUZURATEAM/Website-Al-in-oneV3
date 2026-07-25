/**
 * Semua aturan keamanan pesan dikumpulkan di sini supaya gampang
 * ditambah/diubah tanpa mengutak-atik logic socket.
 */

const MAX_MESSAGE_LENGTH = 1000;
const SPAM_WINDOW_MS = 3000; // jendela waktu
const SPAM_MAX_MESSAGES = 5; // maksimal pesan dalam jendela waktu di atas

// Daftar kata kasar dasar (Bahasa Indonesia + Inggris umum). Gampang ditambah.
const BAD_WORDS = [
  'anjing', 'bangsat', 'kontol', 'memek', 'ngentot', 'goblok', 'tolol',
  'bego', 'kampret', 'asu', 'babi', 'jancok', 'bajingan', 'tai', 'sialan',
  'fuck', 'shit', 'bitch', 'asshole', 'dick', 'pussy', 'cunt', 'bastard',
];

const BAD_WORDS_REGEX = new RegExp(
  '\\b(' + BAD_WORDS.map((w) => w.split('').join('\\W*')).join('|') + ')\\b',
  'gi'
);

// Pola URL sederhana untuk mendeteksi link
const URL_REGEX = /((https?:\/\/|www\.)[^\s]+|[a-z0-9-]+\.(com|net|org|id|xyz|link|click|top|info|biz|ru|tk)[^\s]*)/gi;

// Domain yang selalu diblokir total meski terlihat aman (contoh known-bad)
const KNOWN_MALICIOUS_PATTERNS = [/bit\.ly/i, /tinyurl/i, /grabify/i, /iplogger/i, /discord\.gg\/[a-z0-9]+/i];

/** Sensor kata kasar jadi tanda bintang, tetap kirim pesannya (bukan blokir total) */
function censorBadWords(text) {
  return text.replace(BAD_WORDS_REGEX, (match) => '*'.repeat(match.length));
}

/** Deteksi apakah pesan mengandung link */
function containsLink(text) {
  return URL_REGEX.test(text);
}

/** Deteksi link yang dikenal berbahaya/mencurigakan (shortener, IP logger, dsb) */
function containsMaliciousLink(text) {
  return KNOWN_MALICIOUS_PATTERNS.some((pattern) => pattern.test(text));
}

/** Validasi & bersihkan pesan sebelum dikirim. Return { ok, text, reason } */
function sanitizeMessage(rawText) {
  if (typeof rawText !== 'string') {
    return { ok: false, reason: 'invalid' };
  }

  const trimmed = rawText.trim();

  if (trimmed.length === 0) {
    return { ok: false, reason: 'empty' };
  }

  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return { ok: false, reason: 'too_long' };
  }

  if (containsMaliciousLink(trimmed)) {
    return { ok: false, reason: 'malicious_link' };
  }

  // Link biasa tetap diblokir per aturan brief ("blokir pengiriman link berbahaya")
  // — kita perlakukan semua link sebagai berisiko dan blokir pengirimannya.
  if (containsLink(trimmed)) {
    return { ok: false, reason: 'link_blocked' };
  }

  const clean = censorBadWords(trimmed);

  return { ok: true, text: clean };
}

/**
 * Rate limiter sederhana berbasis sliding window per user.
 * Dipanggil setiap kali user kirim pesan; simpan timestamps di session user.
 */
function isSpamming(timestamps) {
  const now = Date.now();
  // buang timestamp yang sudah di luar window
  while (timestamps.length && now - timestamps[0] > SPAM_WINDOW_MS) {
    timestamps.shift();
  }
  timestamps.push(now);
  return timestamps.length > SPAM_MAX_MESSAGES;
}

module.exports = {
  MAX_MESSAGE_LENGTH,
  sanitizeMessage,
  isSpamming,
};
