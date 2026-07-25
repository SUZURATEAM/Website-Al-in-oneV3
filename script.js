(function () {
  'use strict';

  // --- Loading screen ---
  window.addEventListener('load', () => {
    setTimeout(() => {
      document.getElementById('loading-screen').classList.add('hidden');
    }, 400);
  });

  // --- Socket buat live counter di homepage saja (belum setup profil) ---
  const socket = io({ autoConnect: true });

  socket.on('counts:update', ({ online, searching }) => {
    document.getElementById('online-count').textContent = online;
    document.getElementById('searching-count').textContent = searching;
  });

  socket.on('admin:broadcast', ({ message }) => {
    const stack = document.getElementById('toast-stack');
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = '📢 ' + message;
    stack.appendChild(el);
    setTimeout(() => el.remove(), 5000);
  });


  // --- Filter gender chip ---
  const genderGroup = document.getElementById('filter-gender-group');
  let selectedFilterGender = 'any';
  genderGroup.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    genderGroup.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
    chip.classList.add('active');
    selectedFilterGender = chip.dataset.value;
  });

  // --- Minat chip (multi-select) ---
  const interestsGroup = document.getElementById('interests-group');
  const selectedInterests = new Set();
  interestsGroup.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    chip.classList.toggle('active');
    if (chip.classList.contains('active')) {
      selectedInterests.add(chip.dataset.value);
    } else {
      selectedInterests.delete(chip.dataset.value);
    }
  });

  // --- Toggle panel filter lanjutan ---
  const advToggle = document.getElementById('advanced-toggle');
  const advPanel = document.getElementById('advanced-panel');
  const advArrow = document.getElementById('advanced-arrow');
  advToggle.addEventListener('click', () => {
    advPanel.classList.toggle('open');
    advArrow.textContent = advPanel.classList.contains('open') ? '▾' : '▸';
  });

  // --- Modal cara menggunakan ---
  const howToBtn = document.getElementById('how-to-btn');
  const howToModal = document.getElementById('how-to-modal');
  howToBtn.addEventListener('click', () => howToModal.classList.add('open'));
  document.getElementById('close-how-to').addEventListener('click', () => howToModal.classList.remove('open'));
  howToModal.addEventListener('click', (e) => {
    if (e.target === howToModal) howToModal.classList.remove('open');
  });

  // --- Submit form: simpan profil, lanjut ke halaman chat ---
  const form = document.getElementById('search-form');
  const findBtn = document.getElementById('find-btn');

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const profile = {
      nickname: document.getElementById('nickname').value.trim().slice(0, 20),
      age: parseInt(document.getElementById('age').value, 10) || null,
      gender: document.getElementById('gender').value || null,
      filterGender: selectedFilterGender,
      interests: Array.from(selectedInterests),
    };

    sessionStorage.setItem('riyochat_profile', JSON.stringify(profile));

    findBtn.disabled = true;
    findBtn.textContent = 'Menghubungkan…';

    window.location.href = 'chat.html';
  });
})();
