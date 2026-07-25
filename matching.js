const { onlineUsers, searchQueue } = require('./memoryStore');

/**
 * Cek apakah dua user cocok berdasarkan filter gender masing-masing.
 * "Siapa saja" selalu cocok. Kalau user A minta "cowok", user B harus gender cowok, dst.
 */
function passesGenderFilter(userA, userB) {
  const wantA = userA.filterGender || 'any';
  const wantB = userB.filterGender || 'any';

  const aAccepts = wantA === 'any' || wantA === userB.gender;
  const bAccepts = wantB === 'any' || wantB === userA.gender;

  return aAccepts && bAccepts;
}

/** Hitung skor kecocokan minat (semakin besar semakin cocok). 0 = tidak ada minat sama. */
function interestScore(userA, userB) {
  const a = new Set(userA.interests || []);
  const b = new Set(userB.interests || []);
  let score = 0;
  for (const interest of a) {
    if (b.has(interest)) score++;
  }
  return score;
}

/**
 * Cari partner terbaik untuk `user` di antrian saat ini.
 * Strategi: filter kandidat yang valid (online, bukan diri sendiri, lolos filter gender),
 * lalu prioritaskan skor minat tertinggi, lalu FIFO (yang paling lama nunggu duluan)
 * supaya tidak ada yang menunggu terlalu lama walau minatnya beda.
 */
function findBestMatch(socketId) {
  const user = onlineUsers.get(socketId);
  if (!user) return null;

  let bestCandidateId = null;
  let bestScore = -1;
  let bestWaitTime = -1;

  for (const candidateId of searchQueue) {
    if (candidateId === socketId) continue; // tidak boleh matching diri sendiri

    const candidate = onlineUsers.get(candidateId);
    if (!candidate || !candidate.searching) continue;

    if (!passesGenderFilter(user, candidate)) continue;

    const score = interestScore(user, candidate);
    const waitTime = Date.now() - candidate.searchStartedAt;

    // Prioritas: skor minat lebih tinggi menang. Kalau seri, yang nunggu lebih lama menang.
    if (score > bestScore || (score === bestScore && waitTime > bestWaitTime)) {
      bestScore = score;
      bestWaitTime = waitTime;
      bestCandidateId = candidateId;
    }
  }

  return bestCandidateId;
}

function addToQueue(socketId) {
  if (!searchQueue.includes(socketId)) {
    searchQueue.push(socketId);
  }
}

function removeFromQueue(socketId) {
  const idx = searchQueue.indexOf(socketId);
  if (idx !== -1) searchQueue.splice(idx, 1);
}

module.exports = {
  findBestMatch,
  addToQueue,
  removeFromQueue,
};
