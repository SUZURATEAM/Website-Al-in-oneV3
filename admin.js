(function () {
  'use strict';

  const loginView = document.getElementById('admin-login');
  const dashboardView = document.getElementById('admin-dashboard');
  const tokenInput = document.getElementById('admin-token');
  const loginBtn = document.getElementById('login-btn');
  const loginError = document.getElementById('login-error');
  const toastStack = document.getElementById('toast-stack');

  let ADMIN_TOKEN = sessionStorage.getItem('riyochat_admin_token') || '';
  let pollInterval = null;

  function showToast(text) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = text;
    toastStack.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }

  async function apiCall(path, options = {}) {
    const res = await fetch('/api/admin' + path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Token': ADMIN_TOKEN,
        ...(options.headers || {}),
      },
    });
    if (res.status === 401) throw new Error('unauthorized');
    return res.json();
  }

  async function tryLogin(token) {
    ADMIN_TOKEN = token;
    try {
      await apiCall('/stats');
      sessionStorage.setItem('riyochat_admin_token', token);
      loginView.style.display = 'none';
      dashboardView.style.display = 'block';
      loginError.style.display = 'none';
      startPolling();
    } catch (err) {
      loginError.style.display = 'block';
    }
  }

  loginBtn.addEventListener('click', () => {
    const token = tokenInput.value.trim();
    if (token) tryLogin(token);
  });

  tokenInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') loginBtn.click();
  });

  // Auto-login kalau ada token tersimpan
  if (ADMIN_TOKEN) {
    tryLogin(ADMIN_TOKEN);
  }

  async function refreshStats() {
    try {
      const stats = await apiCall('/stats');
      document.getElementById('stat-online').textContent = stats.onlineUsers;
      document.getElementById('stat-rooms').textContent = stats.activeRooms;
      document.getElementById('stat-matches').textContent = stats.totalMatchesToday;
      document.getElementById('stat-reports').textContent = stats.totalReportsToday;
    } catch (err) {
      if (err.message === 'unauthorized') logout();
    }
  }

  async function refreshReports() {
    try {
      const reports = await apiCall('/reports');
      const body = document.getElementById('reports-body');
      if (!reports.length) {
        body.innerHTML = '<tr><td colspan="5" style="color:var(--text-dim);">Belum ada laporan.</td></tr>';
        return;
      }
      body.innerHTML = reports
        .map((r) => `
          <tr>
            <td style="font-family:var(--font-mono);font-size:12px;">${new Date(r.createdAt).toLocaleString('id-ID')}</td>
            <td>${escapeHtml(r.reporterId)}</td>
            <td>${escapeHtml(r.reportedId)}</td>
            <td><span class="badge">${escapeHtml(r.reason)}</span></td>
            <td style="color:var(--text-dim);">${escapeHtml(r.note || '—')}</td>
          </tr>
        `)
        .join('');
    } catch (err) {
      if (err.message === 'unauthorized') logout();
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function logout() {
    sessionStorage.removeItem('riyochat_admin_token');
    clearInterval(pollInterval);
    dashboardView.style.display = 'none';
    loginView.style.display = 'block';
    loginError.style.display = 'block';
  }

  function startPolling() {
    refreshStats();
    refreshReports();
    pollInterval = setInterval(() => {
      refreshStats();
      refreshReports();
    }, 5000);
  }

  document.getElementById('broadcast-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('broadcast-message');
    const message = input.value.trim();
    if (!message) return;
    try {
      await apiCall('/broadcast', { method: 'POST', body: JSON.stringify({ message }) });
      showToast('📢 Pengumuman terkirim.');
      input.value = '';
    } catch (err) {
      showToast('Gagal mengirim pengumuman.');
    }
  });

  document.getElementById('ban-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const identifier = document.getElementById('ban-identifier').value.trim();
    const reason = document.getElementById('ban-reason').value.trim();
    if (!identifier) return;
    try {
      await apiCall('/ban', { method: 'POST', body: JSON.stringify({ identifier, reason }) });
      showToast('🚫 User berhasil di-ban.');
      document.getElementById('ban-identifier').value = '';
      document.getElementById('ban-reason').value = '';
    } catch (err) {
      showToast('Gagal melakukan ban.');
    }
  });
})();
