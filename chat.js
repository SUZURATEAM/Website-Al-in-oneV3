(function () {
  'use strict';

  // --- Ambil profil dari homepage ---
  const profileRaw = sessionStorage.getItem('riyochat_profile');
  const profile = profileRaw ? JSON.parse(profileRaw) : {};

  // --- Elemen DOM ---
  const searchOverlay = document.getElementById('search-overlay');
  const searchStatusText = document.getElementById('search-status-text');
  const cancelSearchBtn = document.getElementById('cancel-search-btn');

  const chatBody = document.getElementById('chat-body');
  const chatInputBar = document.getElementById('chat-input-bar');
  const messageInput = document.getElementById('message-input');
  const sendBtn = document.getElementById('send-btn');

  const partnerName = document.getElementById('partner-name');
  const partnerStatus = document.getElementById('partner-status');
  const partnerInitial = document.getElementById('partner-initial');

  const skipBtn = document.getElementById('skip-btn');
  const stopBtn = document.getElementById('stop-btn');
  const reportBtn = document.getElementById('report-btn');

  const emojiBtn = document.getElementById('emoji-btn');
  const emojiPicker = document.getElementById('emoji-picker');

  const reportModal = document.getElementById('report-modal');
  const reportNote = document.getElementById('report-note');
  const cancelReportBtn = document.getElementById('cancel-report-btn');
  const submitReportBtn = document.getElementById('submit-report-btn');

  const toastStack = document.getElementById('toast-stack');

  let currentRoomId = null;
  let typingTimeout = null;
  let iAmTyping = false;

  // ==========================================================================
  // Notifikasi suara (Web Audio API — tanpa file eksternal)
  // ==========================================================================
  let audioCtx = null;
  function beep(freq, duration, volume = 0.08) {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.value = volume;
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) { /* audio tidak tersedia, abaikan */ }
  }
  const soundMatchFound = () => { beep(660, 0.12); setTimeout(() => beep(880, 0.15), 110); };
  const soundNewMessage = () => beep(520, 0.09, 0.05);

  // ==========================================================================
  // Toast
  // ==========================================================================
  function showToast(text) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = text;
    toastStack.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }

  // ==========================================================================
  // Koneksi socket & setup profil
  // ==========================================================================
  const socket = io();

  socket.on('connect', () => {
    socket.emit('profile:setup', profile);
  });

  socket.on('profile:ready', () => {
    socket.emit('search:start');
  });

  socket.on('banned', ({ reason }) => {
    alert('🚫 ' + (reason || 'Kamu diblokir dari RiyoChat.'));
    window.location.href = 'index.html';
  });

  socket.on('disconnect', () => {
    appendBotMessage('⚠️ Koneksi terputus.');
  });

  socket.on('connect_error', () => {
    showToast('⚠️ Gagal terhubung ke server.');
  });

  socket.on('admin:broadcast', ({ message }) => {
    showToast('📢 ' + message);
  });


  // ==========================================================================
  // Matching
  // ==========================================================================
  socket.on('chat:bot-message', (msg) => {
    if (!currentRoomId) {
      searchStatusText.textContent = msg.text;
    }
    appendBotMessage(msg.text, msg.timestamp);
  });

  socket.on('match:found', ({ roomId, partner }) => {
    currentRoomId = roomId;
    soundMatchFound();

    searchOverlay.style.display = 'none';
    chatBody.style.display = 'flex';
    chatInputBar.style.display = 'block';
    chatBody.innerHTML = '';

    const displayName = partner.nickname || 'Anonim';
    partnerName.textContent = displayName;
    partnerInitial.textContent = displayName.charAt(0).toUpperCase();
    partnerStatus.textContent = partner.interests && partner.interests.length
      ? partner.interests.join(' · ')
      : 'Online';

    messageInput.focus();
  });

  socket.on('partner:left', () => {
    currentRoomId = null;
    chatBody.style.display = 'none';
    chatInputBar.style.display = 'none';
    searchOverlay.style.display = 'flex';
    searchStatusText.textContent = '🔍 Sedang mencari teman baru...';
    partnerName.textContent = 'Mencari partner…';
    partnerStatus.textContent = '—';
    partnerInitial.textContent = '?';
    hideTypingIndicator();
  });

  // ==========================================================================
  // Pesan
  // ==========================================================================
  function formatTime(ts) {
    const d = new Date(ts);
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  }

  function appendBotMessage(text, ts) {
    const row = document.createElement('div');
    row.className = 'bubble-row bot';
    row.innerHTML = `<div class="bubble">${escapeHtml(text)}</div>`;
    chatBody.appendChild(row);
    scrollToBottom();
  }

  function appendMessage({ id, sender, text, timestamp }) {
    const row = document.createElement('div');
    row.className = `bubble-row ${sender}`;
    row.dataset.id = id;

    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.innerHTML = `${escapeHtml(text)}<span class="bubble-time">${formatTime(timestamp)}</span>`;

    if (sender === 'me') {
      const tools = document.createElement('div');
      tools.className = 'bubble-tools';
      tools.innerHTML = `
        <button class="bubble-tool-btn" data-action="copy" title="Salin">⧉</button>
        <button class="bubble-tool-btn" data-action="delete" title="Hapus">✕</button>
      `;
      bubble.appendChild(tools);
    }

    row.appendChild(bubble);
    chatBody.appendChild(row);
    scrollToBottom();

    if (sender === 'partner') soundNewMessage();
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function scrollToBottom() {
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  socket.on('chat:message', (msg) => {
    hideTypingIndicator();
    appendMessage(msg);
  });

  socket.on('chat:message-deleted', ({ id }) => {
    const row = chatBody.querySelector(`[data-id="${CSS.escape(id)}"]`);
    if (row) {
      row.querySelector('.bubble').innerHTML = `<em style="opacity:.5">Pesan dihapus</em>`;
    }
  });

  socket.on('chat:blocked', ({ reason }) => {
    const reasons = {
      spam: 'Kamu mengirim pesan terlalu cepat. Tunggu sebentar ya.',
      too_long: 'Pesan terlalu panjang (maks. 1000 karakter).',
      link_blocked: 'Pengiriman link tidak diizinkan demi keamanan.',
      malicious_link: 'Link yang kamu kirim terdeteksi berbahaya dan diblokir.',
      empty: null,
      invalid: null,
    };
    const text = reasons[reason];
    if (text) showToast('⚠️ ' + text);
  });

  // --- Klik tombol copy/delete di bubble ---
  chatBody.addEventListener('click', (e) => {
    const btn = e.target.closest('.bubble-tool-btn');
    if (!btn) return;
    const row = btn.closest('.bubble-row');
    const id = row.dataset.id;

    if (btn.dataset.action === 'copy') {
      const text = row.querySelector('.bubble').childNodes[0].textContent;
      navigator.clipboard?.writeText(text).then(() => showToast('Pesan disalin.'));
    }

    if (btn.dataset.action === 'delete') {
      row.querySelector('.bubble').innerHTML = `<em style="opacity:.5">Pesan dihapus</em>`;
      socket.emit('chat:delete-message', { id });
    }
  });

  // ==========================================================================
  // Kirim pesan
  // ==========================================================================
  function sendMessage() {
    const text = messageInput.value.trim();
    if (!text || !currentRoomId) return;
    socket.emit('chat:message', { text });
    messageInput.value = '';
    autoResize();
    sendBtn.disabled = true;
    stopTyping();
  }

  sendBtn.addEventListener('click', sendMessage);

  messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  messageInput.addEventListener('input', () => {
    sendBtn.disabled = messageInput.value.trim().length === 0;
    autoResize();
    handleTypingSignal();
  });

  function autoResize() {
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
  }

  // ==========================================================================
  // Indikator mengetik
  // ==========================================================================
  function handleTypingSignal() {
    if (!currentRoomId) return;
    if (!iAmTyping) {
      iAmTyping = true;
      socket.emit('chat:typing', { isTyping: true });
    }
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(stopTyping, 1500);
  }

  function stopTyping() {
    if (iAmTyping) {
      iAmTyping = false;
      socket.emit('chat:typing', { isTyping: false });
    }
  }

  let typingIndicatorEl = null;
  socket.on('chat:typing', ({ isTyping }) => {
    if (isTyping) {
      showTypingIndicator();
    } else {
      hideTypingIndicator();
    }
  });

  function showTypingIndicator() {
    if (typingIndicatorEl) return;
    typingIndicatorEl = document.createElement('div');
    typingIndicatorEl.className = 'bubble-row partner';
    typingIndicatorEl.id = 'typing-row';
    typingIndicatorEl.innerHTML = `
      <div class="typing-indicator show">
        <span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>
      </div>`;
    chatBody.appendChild(typingIndicatorEl);
    scrollToBottom();
  }

  function hideTypingIndicator() {
    if (typingIndicatorEl) {
      typingIndicatorEl.remove();
      typingIndicatorEl = null;
    }
  }

  // ==========================================================================
  // Emoji picker sederhana
  // ==========================================================================
  const EMOJIS = ['😀','😂','😍','😅','😉','😎','🤔','😢','😡','👍','👎','🙏','🔥','🎉','❤️','💯','😴','🤗','😱','👀','🥲','🙌'];
  emojiPicker.innerHTML = EMOJIS.map((e) => `<button type="button">${e}</button>`).join('');

  emojiBtn.addEventListener('click', () => emojiPicker.classList.toggle('open'));

  emojiPicker.addEventListener('click', (e) => {
    if (e.target.tagName !== 'BUTTON') return;
    messageInput.value += e.target.textContent;
    messageInput.focus();
    sendBtn.disabled = messageInput.value.trim().length === 0;
    autoResize();
  });

  document.addEventListener('click', (e) => {
    if (!emojiPicker.contains(e.target) && e.target !== emojiBtn) {
      emojiPicker.classList.remove('open');
    }
  });

  // ==========================================================================
  // Skip / Stop
  // ==========================================================================
  skipBtn.addEventListener('click', () => {
    if (!currentRoomId) return;
    socket.emit('chat:skip');
    currentRoomId = null;
    chatBody.style.display = 'none';
    chatInputBar.style.display = 'none';
    searchOverlay.style.display = 'flex';
    searchStatusText.textContent = '🔄 Sedang mencari partner baru...';
    partnerName.textContent = 'Mencari partner…';
    partnerStatus.textContent = '—';
    partnerInitial.textContent = '?';
    hideTypingIndicator();
  });

  stopBtn.addEventListener('click', () => {
    socket.emit('chat:stop');
    window.location.href = 'index.html';
  });

  cancelSearchBtn.addEventListener('click', () => {
    socket.emit('search:stop');
    window.location.href = 'index.html';
  });

  // ==========================================================================
  // Laporkan
  // ==========================================================================
  reportBtn.addEventListener('click', () => {
    if (!currentRoomId) {
      showToast('Belum ada partner untuk dilaporkan.');
      return;
    }
    reportModal.classList.add('open');
  });

  cancelReportBtn.addEventListener('click', () => reportModal.classList.remove('open'));
  reportModal.addEventListener('click', (e) => {
    if (e.target === reportModal) reportModal.classList.remove('open');
  });

  document.getElementById('report-reasons').addEventListener('click', (e) => {
    document.querySelectorAll('.report-reason').forEach((r) => r.classList.remove('selected'));
    const label = e.target.closest('.report-reason');
    if (label) label.classList.add('selected');
  });

  submitReportBtn.addEventListener('click', () => {
    const selected = document.querySelector('input[name="reason"]:checked');
    if (!selected) {
      showToast('Pilih alasan laporan dulu ya.');
      return;
    }
    socket.emit('chat:report', { reason: selected.value, note: reportNote.value.trim() });
    reportModal.classList.remove('open');
    reportNote.value = '';
    document.querySelectorAll('input[name="reason"]').forEach((r) => (r.checked = false));
    document.querySelectorAll('.report-reason').forEach((r) => r.classList.remove('selected'));
  });

  socket.on('chat:report-received', () => {
    showToast('✅ Laporan terkirim. Terima kasih.');
  });

  // --- Kalau user tutup tab / pindah halaman saat masih di antrian/chat ---
  window.addEventListener('beforeunload', () => {
    socket.emit('chat:stop');
    socket.emit('search:stop');
  });
})();
