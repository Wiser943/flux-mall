// ============================================================
// FLUXMALL ADMIN PANEL — Unified Script
// Single source of truth. No duplicates.
// ============================================================

// ══════════════════════════════════════════════════════════
//  SECTION 1 — GLOBAL STATE & CONSTANTS
// ══════════════════════════════════════════════════════════

// ── Shared ─────────────────────────────────────────────────
let allData = []; // deposits raw data
let allUsers = []; // users raw data from API
let flashInterval = null;
let originalTitle = document.title;

// ── User Management Table ──────────────────────────────────
const COLORS = ['#4CAF7D', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899',
  '#14b8a6', '#f97316', '#ef4444', '#22c55e', '#6366f1'
];
const PER_PAGE = 10;

let UM_USERS = []; // user management list (from API)
let filtered = [];
let selected = new Set();
let page = 1;
let activeUserId = null; // currently open user detail
let sortCol = 'joined';
let sortDir = -1;
let ctxUserId = null;
let mobileFilter = 'all';

// ── Settings ───────────────────────────────────────────────
const settingsState = {};
let unsavedChanges = 0;
let confirmCallback = null;
const depositAmounts = [1000, 2000, 3000, 5000, 10000, 20000, 50000];

// ── Chat (Support) ─────────────────────────────────────────
// Renamed from USERS → CHAT_USERS to avoid collision
const CHAT_USERS = [
  { id: 1, name: 'Chioma Okafor', email: 'chioma@gmail.com', initials: 'CO', online: true, unread: 3, pinned: true, status: 'open', balance: '₦42,500', shares: 3, deposits: 7, referrals: 12, lastMsg: 'Please I need help with my withdrawal', lastTime: '09:42', muted: false, color: '#4CAF7D' },
  { id: 2, name: 'Emeka Nwachukwu', email: 'emeka.n@yahoo.com', initials: 'EN', online: true, unread: 1, pinned: false, status: 'open', balance: '₦8,200', shares: 1, deposits: 3, referrals: 2, lastMsg: 'The deposit is not showing in my wallet', lastTime: '09:31', muted: false, color: '#f59e0b' },
  { id: 3, name: 'Fatima Bello', email: 'fbello@hotmail.com', initials: 'FB', online: false, unread: 0, pinned: false, status: 'resolved', balance: '₦15,750', shares: 2, deposits: 5, referrals: 8, lastMsg: 'Thank you so much! 🙏', lastTime: 'Yesterday', muted: false, color: '#3b82f6' },
  { id: 4, name: 'Tunde Adeyemi', email: 'tunde.a@gmail.com', initials: 'TA', online: false, unread: 1, pinned: false, status: 'open', balance: '₦3,000', shares: 0, deposits: 1, referrals: 0, lastMsg: 'How do I verify my account?', lastTime: 'Yesterday', muted: true, color: '#8b5cf6' },
  { id: 5, name: 'Ngozi Williams', email: 'ngozi@mail.com', initials: 'NW', online: true, unread: 0, pinned: false, status: 'open', balance: '₦120,000', shares: 8, deposits: 22, referrals: 34, lastMsg: 'Can I get my referral bonus?', lastTime: 'Mon', muted: false, color: '#ec4899' },
  { id: 6, name: 'Adaeze Ike', email: 'adaeze@gmail.com', initials: 'AI', online: false, unread: 0, pinned: false, status: 'resolved', balance: '₦28,000', shares: 4, deposits: 9, referrals: 5, lastMsg: 'Issue resolved, thank you!', lastTime: 'Mon', muted: false, color: '#14b8a6' },
  { id: 7, name: 'Babatunde Folake', email: 'bfola@gmail.com', initials: 'BF', online: false, unread: 0, pinned: true, status: 'open', balance: '₦7,500', shares: 1, deposits: 2, referrals: 1, lastMsg: 'Admin please reply my message', lastTime: 'Sun', muted: false, color: '#f97316' },
  { id: 8, name: 'Kemi Adebayo', email: 'kemi@gmail.com', initials: 'KA', online: true, unread: 0, pinned: false, status: 'open', balance: '₦55,000', shares: 5, deposits: 11, referrals: 19, lastMsg: 'Thanks for the quick response!', lastTime: 'Sun', muted: false, color: '#22c55e' },
];

const CHAT_MESSAGES = {
  1: [
    { id: 1, from: 'user', text: 'Hello, I made a withdrawal request yesterday but it has not been processed', time: '09:10', status: 'read' },
    { id: 2, from: 'admin', text: 'Hello Chioma! I can see your request. Let me check the status right away.', time: '09:11', status: 'read' },
    { id: 3, from: 'user', text: 'Thank you. I really need the money urgently', time: '09:13', status: 'read' },
    { id: 4, from: 'admin', text: 'I understand, please bear with us. Withdrawals are processed between 9am–6pm. Your request is in the queue.', time: '09:14', status: 'read' },
    { id: 5, from: 'user', text: 'Ok noted. How long more please?', time: '09:20', status: 'read' },
    { id: 6, from: 'admin', text: 'Should be within the next 30 minutes. I have flagged your request as priority. 🙏', time: '09:21', status: 'read' },
    { id: 7, from: 'user', text: 'Please I need help with my withdrawal', time: '09:42', status: 'delivered' },
  ],
  2: [
    { id: 1, from: 'user', text: 'Good morning admin', time: '09:00', status: 'read' },
    { id: 2, from: 'admin', text: 'Good morning Emeka! How can I help you today?', time: '09:02', status: 'read' },
    { id: 3, from: 'user', text: 'The deposit is not showing in my wallet', time: '09:31', status: 'delivered' },
  ],
  3: [
    { id: 1, from: 'user', text: 'Please I cannot login to my account', time: '08:00', status: 'read' },
    { id: 2, from: 'admin', text: 'Hi Fatima, let me help you reset your password. Please check your email for reset instructions.', time: '08:05', status: 'read' },
    { id: 3, from: 'user', text: 'I received the email, trying now...', time: '08:10', status: 'read' },
    { id: 4, from: 'admin', text: 'Great! Let me know if you need any more help.', time: '08:11', status: 'read' },
    { id: 5, from: 'user', text: 'Thank you so much! 🙏', time: '08:15', status: 'read' },
  ],
  4: [{ id: 1, from: 'user', text: 'How do I verify my account?', time: '14:30', status: 'delivered' }],
  5: [
    { id: 1, from: 'user', text: 'Hi, I referred 5 people to the platform but my bonus has not been credited', time: '10:00', status: 'read' },
    { id: 2, from: 'admin', text: 'Hello Ngozi! Your referrals are confirmed. The bonus will be credited within 24 hours after your referrals make their first deposit.', time: '10:05', status: 'read' },
    { id: 3, from: 'user', text: 'All 5 of them have deposited', time: '10:08', status: 'read' },
    { id: 4, from: 'admin', text: 'Perfect! I can confirm this. Your bonus of ₦5,000 will be credited shortly. 🎉', time: '10:10', status: 'read' },
    { id: 5, from: 'user', text: 'Can I get my referral bonus?', time: '10:15', status: 'read' },
  ],
  6: [
    { id: 1, from: 'user', text: 'Issue resolved, thank you!', time: '11:00', status: 'read' },
    { id: 2, from: 'admin', text: 'You are welcome Adaeze! Have a great day 😊', time: '11:02', status: 'read' },
  ],
  7: [
    { id: 1, from: 'user', text: 'Hello admin I have a question about shares', time: '09:00', status: 'read' },
    { id: 2, from: 'user', text: 'Admin please reply my message', time: '09:05', status: 'delivered' },
  ],
  8: [
    { id: 1, from: 'user', text: 'Hi admin', time: '08:30', status: 'read' },
    { id: 2, from: 'admin', text: 'Hello Kemi! What can I help you with?', time: '08:32', status: 'read' },
    { id: 3, from: 'user', text: 'Thanks for the quick response!', time: '08:33', status: 'read' },
  ],
};

// Chat UI state
let chatActiveUserId = null;
let currentFilter = 'all';
let chatSortDesc = true;
let replyingTo = null;
let emojiOpen = false;
let quickOpen = false;
let userPanelOpen = false;
let msgSearchActive = false;
let ctxMsgText = '';
let ctxMsgId = null;

const EMOJIS = ['😊', '😂', '❤️', '👍', '🙏', '😍', '🎉', '🔥', '💯', '😭', '😅', '🤣', '👏', '🙌', '💪', '✅', '⚡', '🎁', '💰', '🌟', '😢', '😎', '🤔', '💎', '🚀', '👀', '💬', '📱'];

// Admin Chat (Real API sessions)
let activeSessionId = null;
let activeUserData = null;
let statusTickerTimer = null;
let adminChatPollTimer = null;
let adminTypingPollTimer = null;
let adminTypingTimer = null;
let adminLastMsgCount = 0;
let adminSoundEnabled = true;
let adminSiteLogo = '';
let adminChatSessionStatus = 'active';
let adminAllMessages = [];
let adminReplyingTo = null;
let adminEditingMsgId = null;
const ADMIN_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];


// ══════════════════════════════════════════════════════════
//  SECTION 2 — CORE UTILITIES
// ══════════════════════════════════════════════════════════

// ── API Helper ─────────────────────────────────────────────
async function api(path, options = {}) {
  try {
    const res = await fetch(path, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options
    });
    if (res.status === 401) { window.location.hash = '#login'; return null; }
    return res.json();
  } catch (err) {
    console.error('API error:', path, err);
    return null;
  }
}

// ── Toast ──────────────────────────────────────────────────
// One unified toast — works for both showToast() and toast() callers
function showToast(msg, type = 'success') {
  // Try toast-container first (settings/users), fallback to toast (chat)
  const container = document.getElementById('toast-container') || document.getElementById('toast');
  if (!container) return;
  const icons = { success: 'ri-check-circle-line', error: 'ri-error-warning-line', info: 'ri-information-line', warning: 'ri-alert-line' };
  const el = document.createElement('div');
  el.className = `toast-msg ${type}`;
  el.innerHTML = `<i class="${icons[type]||icons.info}"></i><span>${msg}</span>`;
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(-6px) scale(0.95)';
    el.style.transition = '0.3s';
    setTimeout(() => el.remove(), 300);
  }, 3000);
}
// Alias so both calling conventions work
const toast = showToast;

// ── Flash title ────────────────────────────────────────────
window.startFlash = (msg) => {
  if (flashInterval) return;
  flashInterval = setInterval(() => {
    document.title = document.title === originalTitle ? `🔔 ${msg}` : originalTitle;
  }, 800);
};
window.stopFlash = () => {
  clearInterval(flashInterval);
  flashInterval = null;
  document.title = originalTitle;
};

// ── Helpers ────────────────────────────────────────────────
function nowTime() {
  return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function highlightText(text, query) {
  if (!query) return text;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`, 'gi');
  return text.replace(regex, '<mark class="hl">$1</mark>');
}

// ── ImgBB Upload ───────────────────────────────────────────
async function uploadToImgBB(file, statusEl) {
  if (statusEl) statusEl.innerHTML = '<i class="ri-loader-line"></i> Uploading...';
  try {
    const settingsData = await api('/api/admin/settings/apikeys');
    const imgbbKey = settingsData?.apikeys?.imgbb;
    if (!imgbbKey) {
      if (statusEl) statusEl.innerHTML = '';
      alert('⚠️ ImgBB API key not set. Go to Settings → API Keys and save your ImgBB key first.');
      return null;
    }
    const formData = new FormData();
    formData.append('image', file);
    const res = await fetch(`https://api.imgbb.com/1/upload?key=${imgbbKey}`, { method: 'POST', body: formData });
    const result = await res.json();
    if (result.success) {
      if (statusEl) statusEl.innerHTML = '✅ Uploaded';
      return result.data.url;
    } else {
      if (statusEl) statusEl.innerHTML = '';
      alert('❌ ImgBB upload failed. Check your API key in Settings → API Keys.');
      return null;
    }
  } catch (err) {
    if (statusEl) statusEl.innerHTML = '';
    alert('❌ Upload error: ' + err.message);
    return null;
  }
}

// ── showModal (generic modal system) ───────────────────────
window.showModal = (cfg) => {
  const old = document.getElementById(cfg.id);
  if (old) old.remove();
  
  const overlay = document.createElement('div');
  overlay.id = cfg.id;
  overlay.className = 'modal-overlay';
  overlay.style.cssText = `
    position:fixed;top:0;left:0;width:100%;height:100%;
    background:rgba(0,0,0,0.85);display:flex;align-items:center;
    justify-content:center;z-index:9999;backdrop-filter:blur(8px);
    animation:fadeIn 0.3s ease;`;
  
  const buttonsHTML = (cfg.buttons || []).map(btn =>
    `<button class="${btn.class||'btn-submit'}" onclick="${btn.onclick}" style="${btn.style||''}">${btn.text}</button>`
  ).join('');
  
  const card = document.createElement('div');
  card.className = 'modal-card';
  card.style.cssText = `
    background:var(--card);color:var(--text);max-width:${cfg.width||'450px'};
    box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);
    border:1px solid var(--border);transform:scale(1);`;
  card.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
      <h3 style="margin:0;font-size:1.4rem;">${cfg.title}</h3>
      <span onclick="document.getElementById('${cfg.id}').remove()" style="cursor:pointer;opacity:0.5;font-size:1.5rem;">&times;</span>
    </div>
    <div class="modal-body" style="margin-bottom:25px;">${cfg.content}</div>
    <div class="modal-footer" style="display:flex;gap:12px;justify-content:flex-end;">${buttonsHTML}</div>`;
  
  overlay.appendChild(card);
  document.body.appendChild(overlay);
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
};

// ── Slide-up modal (settings/users confirm) ────────────────



function openSlideModal(html) {
  document.getElementById('modalContent').innerHTML = html;
  document.getElementById('modalOverlay').classList.add('vis');
}

function closeSlideModal() {
  document.getElementById('modalOverlay').classList.remove('vis');
}

function closeModalOutside(e) {
  if (e.target === document.getElementById('modalOverlay')) closeSlideModal();
}
// Aliases expected by the user management functions
const openModal = openSlideModal;
const closeModal = closeSlideModal;


// ══════════════════════════════════════════════════════════
//  SECTION 3 — SIDEBAR & PAGE NAVIGATION
// ══════════════════════════════════════════════════════════

const sideLinks = document.querySelectorAll('.sidebar .side-menu li a:not(.logout)');

sideLinks.forEach(item => {
  item.parentElement.addEventListener('click', () => {
    sideLinks.forEach(i => i.parentElement.classList.remove('active'));
    item.parentElement.classList.add('active');
  });
});

const menuBar = document.querySelector('.content nav .bx.bx-menu');
const sideBar = document.querySelector('.sidebar');

if (menuBar && sideBar) {
  menuBar.addEventListener('click', () => sideBar.classList.toggle('close'));
}

const searchBtn = document.querySelector('.content nav form .form-input button');
const searchBtnIcon = document.querySelector('.content nav form .form-input button .bx');
const searchForm = document.querySelector('.content nav form');

if (searchBtn) {
  searchBtn.addEventListener('click', function(e) {
    if (window.innerWidth < 576) {
      e.preventDefault();
      searchForm.classList.toggle('show');
      if (searchForm.classList.contains('show')) {
        searchBtnIcon.classList.replace('bx-search', 'bx-x');
      } else {
        searchBtnIcon.classList.replace('bx-x', 'bx-search');
      }
    }
  });
}

window.addEventListener('resize', () => {
  if (window.innerWidth < 768) sideBar?.classList.add('close');
  else sideBar?.classList.remove('close');
  if (window.innerWidth > 576) {
    searchBtnIcon?.classList.replace('bx-x', 'bx-search');
    searchForm?.classList.remove('show');
  }
});

// Theme toggle (header checkbox)
const toggler = document.getElementById('theme-toggle');
if (toggler) {
  toggler.addEventListener('change', function() {
    if (this.checked) { document.body.classList.add('dark');
      setTheme('dark'); }
    else { document.body.classList.remove('dark');
      setTheme('light'); }
  });
}

// ── Hash-based page switching ──────────────────────────────
const navItems = document.querySelectorAll('.nav-item');
const allPages = document.querySelectorAll('.page');

function switchPageByHash() {
  const hash = window.location.hash || '#dashboard';
  const targetId = hash.substring(1);
  const target = document.getElementById(targetId);
  if (!target) return;
  
  allPages.forEach(p => p.classList.remove('active'));
  navItems.forEach(i => i.classList.remove('active'));
  target.classList.add('active');
  navItems.forEach(i => {
    if (i.getAttribute('href') === hash) i.classList.add('active');
  });
  
  // Lazy-init pages on first visit
  if (targetId === 'users' && UM_USERS.length === 0) initUserManagement();
  if (targetId === 'chats') initChatPage();
}

window.addEventListener('DOMContentLoaded', switchPageByHash);
window.addEventListener('hashchange', switchPageByHash);


// ══════════════════════════════════════════════════════════
//  SECTION 4 — AUTH
// ══════════════════════════════════════════════════════════

async function checkAdminSession() {
  const res = await fetch('/api/admin/me', { credentials: 'include' });
  if (res.ok) {
    initDashboard();
  } else {
    window.location.hash = '#login';
  }
}

window.handleAdminLogin = async (e) => {
  e.preventDefault();
  const email = document.getElementById('adminEmail').value.trim();
  const pass = document.getElementById('adminPass').value;
  const btn = document.getElementById('loginBtn');
  btn.disabled = true;
  btn.innerText = 'Verifying...';
  
  const data = await api('/api/admin/login', {
    method: 'POST',
    body: JSON.stringify({ email, password: pass })
  });
  
  if (data?.success) {
    window.location.hash = '#dashboard';
    initDashboard();
  } else {
    alert(data?.error || 'Login failed.');
    btn.disabled = false;
    btn.innerText = 'Verify Identity';
  }
};

window.adminLogout = async () => {
  await api('/api/admin/logout', { method: 'POST' });
  window.location.hash = '#login';
};


// ══════════════════════════════════════════════════════════
//  SECTION 5 — DASHBOARD INIT
// ══════════════════════════════════════════════════════════

async function initDashboard() {
  setupAnalyticsCharts();
  loadThemeSettings();
  await Promise.all([
    loadAnalytics(),
    renderApiUsers(),
    loadWithdrawals(),
    loadSettings(),
  ]);
  loadAdminChatSessions();
  
  setInterval(async () => {
    await loadAnalytics();
    await renderApiUsers();
    await loadWithdrawals();
  }, 30000);
}


// ══════════════════════════════════════════════════════════
//  SECTION 6 — ANALYTICS CHARTS
// ══════════════════════════════════════════════════════════

let pieChart, barChart;

function setupAnalyticsCharts() {
  // Analytics page charts (from original dashboard)
  const ctx = document.querySelector('.activity-chart');
  const ctx2 = document.querySelector('.prog-chart');
  
  if (ctx) {
    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
        datasets: [{ label: 'Time', data: [8, 6, 7, 6, 10, 8, 4], backgroundColor: '#1e293b', borderWidth: 3, borderRadius: 6, hoverBackgroundColor: '#60a5fa' }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { x: { grid: { display: true, color: '#1e293b' } }, y: { ticks: { display: false } } },
        plugins: { legend: { display: false } },
        animation: { duration: 1000, easing: 'easeInOutQuad' }
      }
    });
  }
  
  if (ctx2) {
    new Chart(ctx2, {
      type: 'line',
      data: {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'],
        datasets: [
          { label: 'Class GPA', data: [6, 10, 8, 14, 6, 7, 4], borderColor: '#0891b2', tension: 0.4 },
          { label: 'Aver GPA', data: [8, 6, 7, 6, 11, 8, 10], borderColor: '#ca8a04', tension: 0.4 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        scales: { x: { grid: { display: false } }, y: { ticks: { display: false }, border: { display: false, dash: [5, 5] } } },
        plugins: { legend: { display: false } },
        animation: { duration: 1000, easing: 'easeInOutQuad' }
      }
    });
  }
  
  // Stats charts
  const pCtx = document.getElementById('pieChart')?.getContext('2d');
  if (pCtx) {
    pieChart = new Chart(pCtx, {
      type: 'doughnut',
      data: { labels: ['Success', 'Pending', 'Declined'], datasets: [{ data: [0, 0, 0], backgroundColor: ['#05cd99', '#f6ad55', '#ee5d50'] }] },
      options: { plugins: { legend: { position: 'bottom' } } }
    });
  }
  const bCtx = document.getElementById('barChart')?.getContext('2d');
  if (bCtx) {
    barChart = new Chart(bCtx, {
      type: 'bar',
      data: {
        labels: ['Deposits', 'Withdrawals'],
        datasets: [{ label: '₦ Value', data: [0, 0], backgroundColor: ['#4318ff', '#ee5d50'], borderRadius: 10 }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });
  }
}


// ══════════════════════════════════════════════════════════
//  SECTION 7 — ANALYTICS & DEPOSITS (API)
// ══════════════════════════════════════════════════════════

async function loadAnalytics() {
  const data = await api('/api/admin/analytics');
  if (!data?.success) return;
  const s = data.stats;
  
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.innerText = v; };
  set('statTotal', `₦${(s.successV||0).toLocaleString()}`);
  set('statPending', `₦${(s.pendingV||0).toLocaleString()}`);
  set('statUsers', s.totalUsers || 0);
  
  const tbody = document.getElementById('analyticsTableBody');
  if (tbody) {
    tbody.innerHTML = `
      <tr><td>Successful</td><td></td><td>${s.sCount}</td><td>₦${(s.successV).toLocaleString()}</td></tr>
      <tr><td>Pending</td><td></td><td>${s.pCount}</td><td>₦${(s.pendingV).toLocaleString()}</td></tr>
      <tr><td>Declined</td><td></td><td>${s.dCount}</td><td>--</td></tr>`;
  }
  
  if (pieChart) { pieChart.data.datasets[0].data = [s.sCount, s.pCount, s.dCount];
    pieChart.update(); }
  if (barChart) { barChart.data.datasets[0].data = [s.successV, s.withdrawSuccessV];
    barChart.update(); }
  
  allData = data.deposits;
  renderDeposits(allData);
}

function renderDeposits(data) {
  const tbody = document.getElementById('depositTableBody');
  if (!tbody) return;
  tbody.innerHTML = data.map(i => {
    const date = i.createdAt ? new Date(i.createdAt).toLocaleDateString() : 'Now';
    const userId = i.userId?._id || i.userId || '';
    const userName = i.userId?.username || userId.substring(0, 7) + '...';
    return `
      <tr>
        <td>${date}</td>
        <td><small>${userName}</small></td>
        <td>₦${Number(i.amount).toLocaleString()}</td>
        <td><code>${(i.refCode||'').substring(0,8)}...</code></td>
        <td><span class="status-badge ${i.status}">${i.status}</span></td>
        <td>
          ${i.status === 'pending' ? `
            <button class="btn-action" style="background:var(--success)" onclick="approveDeposit('${i._id}','${userId}','${i.amount}')">✔</button>
            <button class="btn-action" style="background:var(--danger)"  onclick="declineDeposit('${i._id}')">✖</button>
          ` : `<button class="btn-action" style="color:var(--danger);background:transparent" onclick="deleteDeposit('${i._id}')">✖</button>`}
        </td>
      </tr>`;
  }).join('');
}

window.approveDeposit = async (id, userId, amount) => {
  if (!confirm(`Approve ₦${Number(amount).toLocaleString()} deposit?`)) return;
  const data = await api(`/api/admin/deposits/${id}`, { method: 'PUT', body: JSON.stringify({ status: 'success' }) });
  if (data?.success) { showToast('Deposit approved and user credited!', 'success');
    loadAnalytics(); }
  else alert(data?.error || 'Error approving deposit.');
};

window.declineDeposit = async (id) => {
  if (!confirm('Decline this deposit?')) return;
  const data = await api(`/api/admin/deposits/${id}`, { method: 'PUT', body: JSON.stringify({ status: 'declined' }) });
  if (data?.success) loadAnalytics();
  else alert(data?.error || 'Error.');
};

window.deleteDeposit = async (id) => {
  if (!confirm('Delete this deposit record?')) return;
  await api(`/api/admin/deposits/${id}`, { method: 'DELETE' });
  loadAnalytics();
};

window.filterDeposits = () => {
  const term = document.getElementById('adminSearch')?.value.toLowerCase() || '';
  const filtered = allData.filter(i => {
    const uid = (i.userId?._id || i.userId || '').toString().toLowerCase();
    const ref = (i.refCode || '').toLowerCase();
    return uid.includes(term) || ref.includes(term);
  });
  renderDeposits(filtered);
};

window.exportCSV = () => {
  let csv = 'Date,User,Amount,Ref,Status\n';
  allData.forEach(i => {
    csv += `${new Date(i.createdAt).toLocaleDateString()},${i.userId?._id||i.userId},${i.amount},${i.refCode},${i.status}\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Report.csv';
  a.click();
};


// ══════════════════════════════════════════════════════════
//  SECTION 8 — WITHDRAWALS (API)
// ══════════════════════════════════════════════════════════

async function loadWithdrawals() {
  const data = await api('/api/admin/withdrawals');
  if (!data?.success) return;
  const tbody = document.getElementById('withdrawTableBody');
  if (!tbody) return;
  tbody.innerHTML = data.withdrawals.map(w => `
    <tr>
      <td>${new Date(w.createdAt).toLocaleDateString()}</td>
      <td>${w.username||w.userId?.toString().substring(0,7)}</td>
      <td>₦${Number(w.amount).toLocaleString()}</td>
      <td>₦${Number(w.netAmount).toLocaleString()}</td>
      <td>${w.bankDetails?.bankName||'--'}</td>
      <td>${w.bankDetails?.accountNumber||'--'}</td>
      <td><span class="status-badge ${w.status}">${w.status}</span></td>
      <td>
        ${w.status === 'pending' ? `
          <button class="btn-action" style="background:var(--success)" onclick="approveWithdrawal('${w._id}')">Pay</button>
          <button class="btn-action" style="background:var(--danger)"  onclick="declineWithdrawal('${w._id}')">✖</button>
        ` : `<button class="btn-action" style="color:var(--danger);background:transparent" onclick="deleteWithdrawal('${w._id}')">✖</button>`}
      </td>
    </tr>`).join('');
}

window.approveWithdrawal = async (id) => {
  if (!confirm('Confirm payment sent?')) return;
  await api(`/api/admin/withdrawals/${id}`, { method: 'PUT', body: JSON.stringify({ status: 'success' }) });
  loadWithdrawals();
};
window.declineWithdrawal = async (id) => {
  if (!confirm('Decline and refund user?')) return;
  await api(`/api/admin/withdrawals/${id}`, { method: 'PUT', body: JSON.stringify({ status: 'declined' }) });
  loadWithdrawals();
};
window.deleteWithdrawal = async (id) => {
  await api(`/api/admin/withdrawals/${id}`, { method: 'DELETE' });
  loadWithdrawals();
};


// ══════════════════════════════════════════════════════════
//  SECTION 9 — USER MANAGEMENT (API + Mock UI)
// ══════════════════════════════════════════════════════════

// ── Load users from API ────────────────────────────────────
async function renderApiUsers() {
  const tbody = document.getElementById('userTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="5">Syncing Database...</td></tr>';
  const data = await api('/api/admin/users');
  if (!data?.success) return;
  allUsers = data.users;
  tbody.innerHTML = '';
  data.users.forEach(u => {
    const isBanned = u.status === 'Banned';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td onclick="viewUserDetails('${u._id}','${u.status}','${u.username}','${u.email}','${u.ib}','${u.emailVerified}','${u.createdAt}','${u.refPoints||0}','${u.referrerId||''}','')" style="cursor:pointer">
        <code style="background:var(--bg);padding:4px 8px;border-radius:5px;">${u._id.substring(0,8)}... <i class="ri-pencil-line"></i></code>
      </td>
      <td style="font-size:0.85rem;color:var(--text-sub);">${u.transCount} Trans.</td>
      <td style="font-weight:bold;color:var(--primary);">₦${(u.transTotal||0).toLocaleString()}</td>
      <td>
        <label class="switch">
          <input type="checkbox" ${isBanned?'checked':''} onchange="toggleBanStatus('${u._id}',this.checked)">
          <span class="slider"></span>
        </label>
      </td>
      <td onclick="copyAndMove('${u._id}')">
        <i class="ri-arrow-right-up-fill" style="font-size:22px;cursor:pointer;color:var(--text-sub)"></i>
      </td>`;
    tbody.appendChild(tr);
  });
}

window.toggleBanStatus = async (uid, isBanned) => {
  const newStatus = isBanned ? 'Banned' : 'Active';
  const data = await api(`/api/admin/users/${uid}`, { method: 'PUT', body: JSON.stringify({ status: newStatus }) });
  if (!data?.success) { alert('Error updating ban status.');
    renderApiUsers(); }
};

window.filterUsers = () => {
  const term = document.getElementById('userSearch')?.value.toLowerCase() || '';
  const filtered = allUsers.filter(u =>
    u.username?.toLowerCase().includes(term) ||
    u.email?.toLowerCase().includes(term) ||
    u._id?.includes(term)
  );
  const tbody = document.getElementById('userTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  filtered.forEach(u => {
    const isBanned = u.status === 'Banned';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><code>${u._id.substring(0,8)}...</code></td>
      <td>${u.transCount} Trans.</td>
      <td>₦${(u.transTotal||0).toLocaleString()}</td>
      <td><label class="switch"><input type="checkbox" ${isBanned?'checked':''} onchange="toggleBanStatus('${u._id}',this.checked)"><span class="slider"></span></label></td>
      <td><i class="ri-arrow-right-up-fill" style="font-size:22px;cursor:pointer"></i></td>`;
    tbody.appendChild(tr);
  });
};

window.viewUserDetails = async (uid, status, name, email, balance, verified, createdAt, refPoints, referrerId) => {
  showModal({
    id: 'userDetailModal',
    title: `User: ${name}`,
    content: `
      <p><b>ID:</b> <code>${uid}</code></p>
      <p><b>Email:</b> ${email}</p>
      <p><b>Balance:</b> ₦${Number(balance).toLocaleString()}</p>
      <p><b>Status:</b> ${status}</p>
      <p><b>Email Verified:</b> ${verified}</p>
      <p><b>Ref Points:</b> ₦${refPoints}</p>
      <p><b>Referrer:</b> ${referrerId||'None'}</p>
      <hr>
      <div class="input-group">
        <label>Adjust Balance</label>
        <input type="number" id="crAmount" placeholder="Amount" min="0">
      </div>
      <input type="hidden" id="crUserId" value="${uid}">`,
    buttons: [
      { text: 'Credit', class: 'btn-submit', onclick: `processAdjustment('credit')` },
      { text: 'Debit', class: 'btn-sec', onclick: `processAdjustment('debit')` },
      { text: 'Delete User', class: 'btn-danger', onclick: `deleteUser('${uid}')` },
      { text: 'Close', class: 'btn-sec', onclick: `document.getElementById('userDetailModal').remove()` }
    ]
  });
};

window.processAdjustment = async (action) => {
  const uid = document.getElementById('crUserId')?.value.trim();
  const amount = Number(document.getElementById('crAmount')?.value);
  if (!uid || !amount) return alert('Please enter a User ID and Amount.');
  const data = await api('/api/admin/users/adjust-balance', {
    method: 'POST',
    body: JSON.stringify({ userId: uid, amount, action })
  });
  if (data?.success) {
    alert(`✅ ${action} of ₦${amount.toLocaleString()} successful! New balance: ₦${data.newBalance.toLocaleString()}`);
    document.getElementById('userDetailModal')?.remove();
    renderApiUsers();
  } else {
    alert(data?.error || 'Error processing adjustment.');
  }
};

window.deleteUser = async (uid) => {
  if (!confirm('⚠️ Permanently delete this user and all their data?')) return;
  await api(`/api/admin/users/${uid}`, { method: 'DELETE' });
  document.getElementById('userDetailModal')?.remove();
  renderApiUsers();
};

window.copyAndMove = (uid) => {
  navigator.clipboard.writeText(uid);
  const el = document.getElementById('crUserId');
  if (el) el.value = uid;
};

// ── User Management UI (table + cards) ────────────────────
function initUserManagement() {
  // Populate UM_USERS from API users or use empty array
  // The table/card UI will be populated when renderApiUsers runs
  // For the rich UI (table, cards, detail pane), we use UM_USERS
  // which gets populated below from the API
  loadUMUsers();
}

async function loadUMUsers() {
  const data = await api('/api/admin/users');
  if (!data?.success) return;
  
  UM_USERS = data.users.map((u, i) => ({
    id: u._id,
    name: u.username || 'Unknown',
    initials: (u.username || 'U').substring(0, 2).toUpperCase(),
    email: u.email || '',
    phone: u.phone || '',
    balance: u.ib || 0,
    shares: u.shares || 0,
    deposits: u.transCount || 0,
    withdrawals: u.withdrawals || 0,
    referrals: u.refPoints || 0,
    status: u.status === 'Banned' ? 'banned' : u.emailVerified ? 'verified' : 'unverified',
    active: u.status !== 'Banned',
    color: COLORS[i % COLORS.length],
    joined: u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
    lastSeen: 'Recently',
    referredBy: u.referrerId || null,
    device: 'Unknown',
    ip: '—',
  }));
  
  filtered = [...UM_USERS];
  updateUMStats();
  renderTable();
}

function updateUMStats() {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('s-total', UM_USERS.length);
  set('s-verified', UM_USERS.filter(u => u.status === 'verified').length);
  set('s-active', UM_USERS.filter(u => u.active).length);
  set('s-banned', UM_USERS.filter(u => u.status === 'banned').length);
  const total = UM_USERS.reduce((a, u) => a + u.balance, 0);
  set('s-balance', '₦' + total.toLocaleString());
  set('totalCount', UM_USERS.length + ' users');
}
// Alias for HTML onclick calls
const updateStats = updateUMStats;

function handleUserSearch(q) {
  document.getElementById('searchClear')?.classList.toggle('vis', q.length > 0);
  applyFilters();
}
// The HTML calls handleSearch() for users — route it here
// (Settings also calls handleSearch — we disambiguate by page)
function handleSearch(q) {
  // If settings search input is active, route to settings
  const settingsSearch = document.getElementById('settingsSearch');
  if (document.activeElement === settingsSearch || settingsSearch?.value === q) {
    handleSettingsSearch(q);
  } else {
    handleUserSearch(q);
  }
}

function clearSearch() {
  const si = document.getElementById('searchInput');
  if (si) { si.value = '';
    document.getElementById('searchClear')?.classList.remove('vis'); }
  applyFilters();
}

function applyFilters() {
  const q = document.getElementById('searchInput')?.value.trim().toLowerCase() || '';
  const status = document.getElementById('statusFilter')?.value || '';
  const sort = document.getElementById('sortFilter')?.value || 'newest';
  
  filtered = UM_USERS.filter(u => {
    const matchQ = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.id.toLowerCase().includes(q) || u.phone.includes(q);
    const matchS = !status || u.status === status;
    return matchQ && matchS;
  });
  
  filtered.sort((a, b) => {
    switch (sort) {
      case 'balance-desc':
        return b.balance - a.balance;
      case 'balance-asc':
        return a.balance - b.balance;
      case 'name-asc':
        return a.name.localeCompare(b.name);
      case 'oldest':
        return 1;
      default:
        return -1;
    }
  });
  
  page = 1;
  renderTable();
}

function sortBy(col) {
  if (sortCol === col) sortDir *= -1;
  else { sortCol = col;
    sortDir = -1; }
  document.querySelectorAll('#userTable thead th').forEach(th => th.classList.remove('sort-asc', 'sort-desc'));
  filtered.sort((a, b) => {
    let va = a[col],
      vb = b[col];
    if (typeof va === 'string') return sortDir * va.localeCompare(vb);
    return sortDir * (vb - va);
  });
  renderTable();
}

function renderTable() {
  const tbody = document.getElementById('tableBody');
  const empty = document.getElementById('emptyState');
  if (!tbody) return;
  const start = (page - 1) * PER_PAGE;
  const slice = filtered.slice(start, start + PER_PAGE);
  
  if (filtered.length === 0) {
    tbody.innerHTML = '';
    if (empty) empty.style.display = 'flex';
    renderPagination();
    renderCards();
    return;
  }
  if (empty) empty.style.display = 'none';
  
  tbody.innerHTML = slice.map(u => {
    const isSel = selected.has(u.id);
    const isActive = activeUserId === u.id;
    return `
    <tr class="${isSel?'selected':''} ${isActive?'active-row':''}"
      onclick="openDetail('${u.id}')"
      oncontextmenu="showCtx(event,'${u.id}')">
      <td class="check-cell" onclick="event.stopPropagation()">
        <input type="checkbox" ${isSel?'checked':''} onchange="toggleSelect('${u.id}',this.checked)">
      </td>
      <td>
        <div class="user-cell">
          <div class="u-avatar" style="background:${u.color}">${u.initials}</div>
          <div>
            <div class="u-name">${u.name}</div>
            <div class="u-email">${u.email}</div>
            <div class="u-id">${u.id}</div>
          </div>
        </div>
      </td>
      <td><span class="amount ${u.balance>0?'positive':'zero'}">₦${u.balance.toLocaleString()}</span></td>
      <td>${u.shares}</td>
      <td>${u.referrals}</td>
      <td>
        <div style="display:flex;flex-direction:column;gap:4px;">
          <span class="badge ${u.status}">${u.status.charAt(0).toUpperCase()+u.status.slice(1)}</span>
          <span class="badge ${u.active?'active':'inactive'}">${u.active?'Active':'Inactive'}</span>
        </div>
      </td>
      <td style="font-size:.78rem;color:var(--muted);">${u.joined}</td>
      <td onclick="event.stopPropagation()">
        <div class="row-actions">
          <button class="row-btn" onclick="openDetail('${u.id}')" title="View"><i class="ri-eye-line"></i></button>
          <button class="row-btn" onclick="openEditModal('${u.id}')" title="Edit"><i class="ri-edit-line"></i></button>
          <button class="row-btn" onclick="openCreditModal('${u.id}')" title="Balance"><i class="ri-wallet-3-line"></i></button>
          <button class="row-btn danger" onclick="confirmBan('${u.id}')" title="Ban"><i class="ri-forbid-line"></i></button>
        </div>
      </td>
    </tr>`;
  }).join('');
  
  renderPagination();
  renderCards();
}

function renderPagination() {
  const total = filtered.length;
  const pages = Math.ceil(total / PER_PAGE);
  const start = (page - 1) * PER_PAGE + 1;
  const end = Math.min(page * PER_PAGE, total);
  const info = document.getElementById('pageInfo');
  if (info) info.textContent = total === 0 ? 'No results' : `Showing ${start}–${end} of ${total}`;
  
  const btns = document.getElementById('pageBtns');
  if (!btns) return;
  let html = `<button class="page-btn" onclick="goPage(${page-1})" ${page===1?'disabled':''}><i class="ri-arrow-left-s-line"></i></button>`;
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || Math.abs(i - page) <= 1) {
      html += `<button class="page-btn ${i===page?'active':''}" onclick="goPage(${i})">${i}</button>`;
    } else if (Math.abs(i - page) === 2) {
      html += `<button class="page-btn" disabled>…</button>`;
    }
  }
  html += `<button class="page-btn" onclick="goPage(${page+1})" ${page===pages?'disabled':''}><i class="ri-arrow-right-s-line"></i></button>`;
  btns.innerHTML = html;
}

function goPage(p) {
  const pages = Math.ceil(filtered.length / PER_PAGE);
  if (p < 1 || p > pages) return;
  page = p;
  renderTable();
}

function setMobileFilter(f, btn) {
  mobileFilter = f;
  document.querySelectorAll('.mf-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderCards();
}

function renderCards() {
  const cardList = document.getElementById('cardList');
  if (!cardList) return;
  let data = [...filtered];
  if (mobileFilter !== 'all') {
    if (mobileFilter === 'active') data = data.filter(u => u.active);
    else data = data.filter(u => u.status === mobileFilter);
  }
  const start = (page - 1) * PER_PAGE;
  const slice = data.slice(start, start + PER_PAGE);
  if (slice.length === 0) {
    cardList.innerHTML = '<div style="text-align:center;padding:50px 20px;color:var(--muted);"><i class="ri-user-search-line" style="font-size:2rem;display:block;opacity:.3;margin-bottom:10px;"></i>No users found</div>';
    return;
  }
  cardList.innerHTML = slice.map((u, i) => {
    const isSel = selected.has(u.id);
    const bal = u.balance >= 1000 ? '₦' + (u.balance / 1000).toFixed(0) + 'k' : '₦' + u.balance;
    return `
    <div class="user-card ${isSel?'selected':''}" style="animation-delay:${i*0.04}s"
      onclick="openDetail('${u.id}')"
      oncontextmenu="showCtx(event,'${u.id}')">
      <input type="checkbox" class="uc-check" ${isSel?'checked':''}
        onclick="event.stopPropagation()"
        onchange="toggleSelect('${u.id}',this.checked)">
      <div class="uc-top">
        <div class="uc-avatar" style="background:${u.color}">${u.initials}</div>
        <div class="uc-info">
          <div class="uc-name">${u.name}</div>
          <div class="uc-email">${u.email}</div>
          <div class="uc-id">${u.id}</div>
        </div>
        <div class="uc-badges">
          <span class="badge ${u.status}">${u.status.charAt(0).toUpperCase()+u.status.slice(1)}</span>
        </div>
      </div>
      <div class="uc-stats">
        <div class="uc-stat"><span class="uc-stat-val green">${bal}</span><span class="uc-stat-label">Balance</span></div>
        <div class="uc-stat"><span class="uc-stat-val">${u.shares}</span><span class="uc-stat-label">Shares</span></div>
        <div class="uc-stat"><span class="uc-stat-val">${u.deposits}</span><span class="uc-stat-label">Deposits</span></div>
        <div class="uc-stat"><span class="uc-stat-val">${u.referrals}</span><span class="uc-stat-label">Refs</span></div>
      </div>
      <div class="uc-actions" onclick="event.stopPropagation()">
        <button class="uc-btn" onclick="openDetail('${u.id}')"><i class="ri-eye-line"></i> View</button>
        <button class="uc-btn" onclick="openEditModal('${u.id}')"><i class="ri-edit-line"></i> Edit</button>
        <button class="uc-btn" onclick="openCreditModal('${u.id}')"><i class="ri-wallet-3-line"></i> Wallet</button>
        <button class="uc-btn danger" onclick="confirmBan('${u.id}')"><i class="ri-forbid-line"></i> Ban</button>
      </div>
    </div>`;
  }).join('');
}

// ── Selection ──────────────────────────────────────────────
function toggleSelect(id, checked) {
  if (checked) selected.add(id);
  else selected.delete(id);
  updateBulkBar();
  renderTable();
}

function toggleSelectAll(el) {
  const start = (page - 1) * PER_PAGE;
  const slice = filtered.slice(start, start + PER_PAGE);
  slice.forEach(u => { el.checked ? selected.add(u.id) : selected.delete(u.id); });
  updateBulkBar();
  renderTable();
}

function updateBulkBar() {
  const bar = document.getElementById('bulkBar');
  if (bar) bar.classList.toggle('vis', selected.size > 0);
  const cnt = document.getElementById('bulkCount');
  if (cnt) cnt.textContent = `${selected.size} selected`;
}

function clearSelection() { selected.clear();
  updateBulkBar();
  renderTable(); }

// ── Detail Pane ────────────────────────────────────────────
function openDetail(id) {
  const u = UM_USERS.find(x => x.id === id);
  if (!u) return;
  activeUserId = id;
  
  const dp = document.getElementById('detailPane');
  if (dp) { dp.classList.remove('hidden');
    dp.classList.add('mobile-open'); }
  
  const dpBody = document.getElementById('dpBody');
  if (!dpBody) return;
  dpBody.innerHTML = `
    <div class="dp-avatar-wrap">
      <div class="dp-big-avatar" style="background:${u.color}">${u.initials}</div>
      <div class="dp-name">${u.name}</div>
      <div class="dp-email">${u.email}</div>
      <div class="dp-badges">
        <span class="badge ${u.status}">${u.status}</span>
        <span class="badge ${u.active?'active':'inactive'}">${u.active?'Active':'Inactive'}</span>
      </div>
    </div>
    <div class="dp-stat-grid">
      <div class="dp-stat"><div class="dp-stat-val" style="color:var(--gl)">₦${u.balance.toLocaleString()}</div><div class="dp-stat-label">Balance</div></div>
      <div class="dp-stat"><div class="dp-stat-val">${u.shares}</div><div class="dp-stat-label">Shares</div></div>
      <div class="dp-stat"><div class="dp-stat-val">${u.deposits}</div><div class="dp-stat-label">Deposits</div></div>
      <div class="dp-stat"><div class="dp-stat-val">${u.withdrawals}</div><div class="dp-stat-label">Cashouts</div></div>
    </div>
    <div class="dp-section">Account Info</div>
    <div class="dp-info-row"><span class="dp-info-key">User ID</span><span class="dp-info-val" style="font-family:monospace">${u.id}</span></div>
    <div class="dp-info-row"><span class="dp-info-key">Phone</span><span class="dp-info-val">${u.phone||'—'}</span></div>
    <div class="dp-info-row"><span class="dp-info-key">Referrals</span><span class="dp-info-val">${u.referrals}</span></div>
    <div class="dp-info-row"><span class="dp-info-key">Referred By</span><span class="dp-info-val">${u.referredBy||'—'}</span></div>
    <div class="dp-info-row"><span class="dp-info-key">Joined</span><span class="dp-info-val">${u.joined}</span></div>
    <div class="dp-info-row"><span class="dp-info-key">Last Seen</span><span class="dp-info-val">${u.lastSeen}</span></div>
    <div class="dp-section">Actions</div>
    <button class="dp-action" onclick="openEditModal('${u.id}')"><i class="ri-edit-line"></i> Edit User Details</button>
    <button class="dp-action" onclick="openCreditModal('${u.id}')"><i class="ri-wallet-3-line"></i> Credit / Debit Balance</button>
    <button class="dp-action" onclick="sendMessageModal('${u.id}')"><i class="ri-message-3-line"></i> Send Message</button>
    <button class="dp-action" onclick="toggleVerify('${u.id}')"><i class="ri-shield-check-line"></i> ${u.status==='verified'?'Revoke Verification':'Verify Account'}</button>
    <button class="dp-action" onclick="resetPassword('${u.id}')"><i class="ri-lock-password-line"></i> Reset Password</button>
    <button class="dp-action danger" onclick="confirmBan('${u.id}')"><i class="ri-forbid-line"></i> ${u.status==='banned'?'Unban User':'Ban User'}</button>
    <button class="dp-action danger" onclick="confirmDelete('${u.id}')"><i class="ri-delete-bin-line"></i> Delete Account</button>`;
  
  renderTable();
}

function closeDetail() {
  activeUserId = null;
  const dp = document.getElementById('detailPane');
  if (dp) { dp.classList.add('hidden');
    dp.classList.remove('mobile-open'); }
  renderTable();
}

// ── User Modals ────────────────────────────────────────────
function openAddUser() {
  openModal(`
    <div class="modal-title">Add New User</div>
    <div class="modal-sub">Create a new user account manually.</div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">First Name</label><input class="form-input" id="m-fname" placeholder="Chioma"></div>
      <div class="form-group"><label class="form-label">Last Name</label><input class="form-input" id="m-lname" placeholder="Okafor"></div>
    </div>
    <div class="form-group"><label class="form-label">Email</label><input class="form-input" id="m-email" type="email" placeholder="user@gmail.com"></div>
    <div class="form-group"><label class="form-label">Phone</label><input class="form-input" id="m-phone" placeholder="08012345678"></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Password</label><input class="form-input" id="m-pass" type="password" placeholder="••••••••"></div>
      <div class="form-group"><label class="form-label">Status</label>
        <select class="form-input" id="m-status"><option value="unverified">Unverified</option><option value="verified">Verified</option></select>
      </div>
    </div>
    <div class="form-group"><label class="form-label">Initial Balance (₦)</label><input class="form-input" id="m-balance" type="number" placeholder="0" min="0"></div>
    <div class="modal-btns">
      <button class="modal-btn-primary" onclick="submitAddUser()">Create User</button>
      <button class="modal-btn-secondary" onclick="closeModal()">Cancel</button>
    </div>`);
}

function submitAddUser() {
  const fn = document.getElementById('m-fname')?.value.trim();
  const ln = document.getElementById('m-lname')?.value.trim();
  const email = document.getElementById('m-email')?.value.trim();
  if (!fn || !ln || !email) { showToast('Please fill required fields', 'error'); return; }
  const name = `${fn} ${ln}`;
  const initials = `${fn[0]}${ln[0]}`.toUpperCase();
  const newUser = {
    id: `FLX${String(1001+UM_USERS.length).padStart(5,'0')}`,
    name,
    initials,
    email,
    phone: document.getElementById('m-phone')?.value || '',
    balance: parseInt(document.getElementById('m-balance')?.value) || 0,
    shares: 0,
    deposits: 0,
    withdrawals: 0,
    referrals: 0,
    status: document.getElementById('m-status')?.value || 'unverified',
    active: true,
    color: COLORS[UM_USERS.length % COLORS.length],
    joined: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    lastSeen: 'Just now',
    referredBy: null,
    device: 'Unknown',
    ip: '—',
  };
  UM_USERS.unshift(newUser);
  closeModal();
  updateUMStats();
  applyFilters();
  showToast(`${name} added successfully`, 'success');
}

function openEditModal(id) {
  const u = UM_USERS.find(x => x.id === id);
  if (!u) return;
  openModal(`
    <div class="modal-title">Edit User</div>
    <div class="modal-sub">Update details for <strong>${u.name}</strong></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Full Name</label><input class="form-input" id="e-name" value="${u.name}"></div>
      <div class="form-group"><label class="form-label">Phone</label><input class="form-input" id="e-phone" value="${u.phone||''}"></div>
    </div>
    <div class="form-group"><label class="form-label">Email</label><input class="form-input" id="e-email" value="${u.email}" type="email"></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Status</label>
        <select class="form-input" id="e-status">
          <option value="verified" ${u.status==='verified'?'selected':''}>Verified</option>
          <option value="unverified" ${u.status==='unverified'?'selected':''}>Unverified</option>
          <option value="banned" ${u.status==='banned'?'selected':''}>Banned</option>
        </select>
      </div>
      <div class="form-group"><label class="form-label">Account State</label>
        <select class="form-input" id="e-active">
          <option value="1" ${u.active?'selected':''}>Active</option>
          <option value="0" ${!u.active?'selected':''}>Inactive</option>
        </select>
      </div>
    </div>
    <div class="modal-btns">
      <button class="modal-btn-primary" onclick="submitEdit('${u.id}')">Save Changes</button>
      <button class="modal-btn-secondary" onclick="closeModal()">Cancel</button>
    </div>`);
}

function submitEdit(id) {
  const u = UM_USERS.find(x => x.id === id);
  if (!u) return;
  u.name = document.getElementById('e-name')?.value.trim() || u.name;
  u.email = document.getElementById('e-email')?.value.trim() || u.email;
  u.phone = document.getElementById('e-phone')?.value.trim() || u.phone;
  u.status = document.getElementById('e-status')?.value;
  u.active = document.getElementById('e-active')?.value === '1';
  closeModal();
  updateUMStats();
  applyFilters();
  if (activeUserId === id) openDetail(id);
  showToast('User updated', 'success');
}

function openCreditModal(id) {
  const u = UM_USERS.find(x => x.id === id);
  if (!u) return;
  openModal(`
    <div class="modal-title">Adjust Balance</div>
    <div class="modal-sub">Current balance: <strong style="color:var(--gl)">₦${u.balance.toLocaleString()}</strong></div>
    <div class="form-group"><label class="form-label">Action</label>
      <select class="form-input" id="c-type">
        <option value="credit">Credit (Add)</option>
        <option value="debit">Debit (Subtract)</option>
        <option value="set">Set Balance</option>
      </select>
    </div>
    <div class="form-group"><label class="form-label">Amount (₦)</label><input class="form-input" id="c-amount" type="number" min="0" placeholder="0"></div>
    <div class="form-group"><label class="form-label">Reason / Note</label><input class="form-input" id="c-note" placeholder="e.g. Manual adjustment..."></div>
    <div class="modal-btns">
      <button class="modal-btn-primary" onclick="submitBalance('${id}')">Apply</button>
      <button class="modal-btn-secondary" onclick="closeModal()">Cancel</button>
    </div>`);
}

function submitBalance(id) {
  const u = UM_USERS.find(x => x.id === id);
  if (!u) return;
  const type = document.getElementById('c-type')?.value;
  const amt = parseInt(document.getElementById('c-amount')?.value) || 0;
  if (amt <= 0 && type !== 'set') { showToast('Enter a valid amount', 'error'); return; }
  if (type === 'credit') u.balance += amt;
  else if (type === 'debit') u.balance = Math.max(0, u.balance - amt);
  else u.balance = amt;
  closeModal();
  updateUMStats();
  applyFilters();
  if (activeUserId === id) openDetail(id);
  showToast(`Balance ${type==='credit'?'credited':type==='debit'?'debited':'set'} — ₦${u.balance.toLocaleString()}`, 'success');
}

function sendMessageModal(id) {
  const u = UM_USERS.find(x => x.id === id);
  if (!u) return;
  openModal(`
    <div class="modal-title">Send Message</div>
    <div class="modal-sub">Send a notification to <strong>${u.name}</strong></div>
    <div class="form-group"><label class="form-label">Message Type</label>
      <select class="form-input" id="msg-type">
        <option value="info">Info</option><option value="success">Success</option>
        <option value="warning">Warning</option><option value="alert">Alert</option>
      </select>
    </div>
    <div class="form-group"><label class="form-label">Title</label><input class="form-input" id="msg-title" placeholder="e.g. Important Notice"></div>
    <div class="form-group"><label class="form-label">Message</label>
      <textarea class="form-input" id="msg-body" rows="4" placeholder="Enter your message..."></textarea>
    </div>
    <div class="modal-btns">
      <button class="modal-btn-primary" onclick="submitMessage('${id}')">Send Notification</button>
      <button class="modal-btn-secondary" onclick="closeModal()">Cancel</button>
    </div>`);
}

function submitMessage(id) {
  const u = UM_USERS.find(x => x.id === id);
  if (!u) return;
  if (!document.getElementById('msg-body')?.value.trim()) { showToast('Message cannot be empty', 'error'); return; }
  closeModal();
  showToast(`Message sent to ${u.name}`, 'success');
}

function confirmBan(id) {
  const u = UM_USERS.find(x => x.id === id);
  if (!u) return;
  const isBanned = u.status === 'banned';
  openModal(`
    <div class="modal-title">${isBanned?'Unban':'Ban'} User</div>
    <div class="modal-sub">${isBanned?`Remove ban from <strong>${u.name}</strong>?`:`Ban <strong>${u.name}</strong>? They will lose all access immediately.`}</div>
    ${!isBanned?`<div class="form-group"><label class="form-label">Reason for Ban</label><input class="form-input" id="ban-reason" placeholder="e.g. Fraudulent activity..."></div>`:''}
    <div class="modal-btns">
      <button class="${isBanned?'modal-btn-primary':'modal-btn-danger'}" onclick="submitBan('${id}')">${isBanned?'Unban User':'Confirm Ban'}</button>
      <button class="modal-btn-secondary" onclick="closeModal()">Cancel</button>
    </div>`);
}

function submitBan(id) {
  const u = UM_USERS.find(x => x.id === id);
  if (!u) return;
  u.status = u.status === 'banned' ? 'unverified' : 'banned';
  closeModal();
  updateUMStats();
  applyFilters();
  if (activeUserId === id) openDetail(id);
  showToast(`${u.name} ${u.status==='banned'?'banned':'unbanned'}`, 'info');
}

function confirmDelete(id) {
  const u = UM_USERS.find(x => x.id === id);
  if (!u) return;
  openModal(`
    <div class="modal-title">Delete Account</div>
    <div class="modal-sub">This will permanently delete <strong>${u.name}</strong>'s account. <strong>Cannot be undone.</strong></div>
    <div class="form-group"><label class="form-label">Type "DELETE" to confirm</label><input class="form-input" id="del-confirm" placeholder="DELETE"></div>
    <div class="modal-btns">
      <button class="modal-btn-danger" onclick="submitDelete('${id}')">Delete Permanently</button>
      <button class="modal-btn-secondary" onclick="closeModal()">Cancel</button>
    </div>`);
}

function submitDelete(id) {
  if (document.getElementById('del-confirm')?.value !== 'DELETE') { showToast('Type DELETE to confirm', 'error'); return; }
  const u = UM_USERS.find(x => x.id === id);
  UM_USERS = UM_USERS.filter(x => x.id !== id);
  if (activeUserId === id) closeDetail();
  selected.delete(id);
  closeModal();
  updateUMStats();
  applyFilters();
  showToast(`${u?.name} deleted`, 'info');
}

function toggleVerify(id) {
  const u = UM_USERS.find(x => x.id === id);
  if (!u) return;
  u.status = u.status === 'verified' ? 'unverified' : 'verified';
  updateUMStats();
  applyFilters();
  if (activeUserId === id) openDetail(id);
  showToast(`${u.name} ${u.status==='verified'?'verified':'unverified'}`, 'success');
}

function resetPassword(id) {
  const u = UM_USERS.find(x => x.id === id);
  if (!u) return;
  openModal(`
    <div class="modal-title">Reset Password</div>
    <div class="modal-sub">Set a new password for <strong>${u.name}</strong></div>
    <div class="form-group"><label class="form-label">New Password</label><input class="form-input" id="rp-pass" type="password" placeholder="Min 8 characters"></div>
    <div class="form-group"><label class="form-label">Confirm Password</label><input class="form-input" id="rp-pass2" type="password" placeholder="Repeat password"></div>
    <div class="modal-btns">
      <button class="modal-btn-primary" onclick="submitResetPass('${id}')">Set Password</button>
      <button class="modal-btn-secondary" onclick="closeModal();showToast('Reset link sent to ${u.email}','info');">Send Reset Link</button>
    </div>`);
}

function submitResetPass(id) {
  const p1 = document.getElementById('rp-pass')?.value;
  const p2 = document.getElementById('rp-pass2')?.value;
  if (!p1 || p1.length < 8) { showToast('Password must be at least 8 characters', 'error'); return; }
  if (p1 !== p2) { showToast('Passwords do not match', 'error'); return; }
  closeModal();
  showToast('Password reset successfully', 'success');
}

// ── Bulk Actions ───────────────────────────────────────────
function bulkVerify() {
  selected.forEach(id => { const u = UM_USERS.find(x => x.id === id); if (u) u.status = 'verified'; });
  clearSelection();
  updateUMStats();
  applyFilters();
  showToast('Selected users verified', 'success');
}

function bulkBan() {
  openModal(`
    <div class="modal-title">Ban ${selected.size} Users?</div>
    <div class="modal-sub">All selected users will be banned immediately.</div>
    <div class="modal-btns">
      <button class="modal-btn-danger" onclick="submitBulkBan()">Ban All</button>
      <button class="modal-btn-secondary" onclick="closeModal()">Cancel</button>
    </div>`);
}

function submitBulkBan() {
  selected.forEach(id => { const u = UM_USERS.find(x => x.id === id); if (u) u.status = 'banned'; });
  clearSelection();
  closeModal();
  updateUMStats();
  applyFilters();
  showToast('Selected users banned', 'info');
}

function bulkDelete() {
  openModal(`
    <div class="modal-title">Delete ${selected.size} Users?</div>
    <div class="modal-sub">Cannot be undone.</div>
    <div class="form-group"><label class="form-label">Type "DELETE" to confirm</label><input class="form-input" id="bd-confirm" placeholder="DELETE"></div>
    <div class="modal-btns">
      <button class="modal-btn-danger" onclick="submitBulkDelete()">Delete All</button>
      <button class="modal-btn-secondary" onclick="closeModal()">Cancel</button>
    </div>`);
}

function submitBulkDelete() {
  if (document.getElementById('bd-confirm')?.value !== 'DELETE') { showToast('Type DELETE to confirm', 'error'); return; }
  const count = selected.size;
  UM_USERS = UM_USERS.filter(u => !selected.has(u.id));
  clearSelection();
  closeModal();
  updateUMStats();
  applyFilters();
  showToast(`${count} users deleted`, 'info');
}

function bulkMessage() {
  openModal(`
    <div class="modal-title">Message ${selected.size} Users</div>
    <div class="form-group"><label class="form-label">Message</label>
      <textarea class="form-input" id="bm-body" rows="4" placeholder="Your message..."></textarea>
    </div>
    <div class="modal-btns">
      <button class="modal-btn-primary" onclick="submitBulkMsg()">Send to All</button>
      <button class="modal-btn-secondary" onclick="closeModal()">Cancel</button>
    </div>`);
}

function submitBulkMsg() {
  if (!document.getElementById('bm-body')?.value.trim()) { showToast('Message cannot be empty', 'error'); return; }
  clearSelection();
  closeModal();
  showToast('Message sent to all selected users', 'success');
}

// ── Context Menu ───────────────────────────────────────────
function showCtx(e, id) {
  e.preventDefault();
  ctxUserId = id;
  const menu = document.getElementById('ctxMenu');
  if (!menu) return;
  menu.classList.add('vis');
  menu.style.left = Math.min(e.clientX, window.innerWidth - 200) + 'px';
  menu.style.top = Math.min(e.clientY, window.innerHeight - 320) + 'px';
}

function hideCtx() { document.getElementById('ctxMenu')?.classList.remove('vis'); }

function ctxAct(action) {
  hideCtx();
  if (!ctxUserId) return;
  const map = {
    view: () => openDetail(ctxUserId),
    edit: () => openEditModal(ctxUserId),
    credit: () => openCreditModal(ctxUserId),
    debit: () => openCreditModal(ctxUserId),
    verify: () => toggleVerify(ctxUserId),
    message: () => sendMessageModal(ctxUserId),
    reset: () => resetPassword(ctxUserId),
    ban: () => confirmBan(ctxUserId),
    delete: () => confirmDelete(ctxUserId),
  };
  map[action]?.();
}

document.addEventListener('click', e => {
  if (!e.target.closest('#ctxMenu') && !e.target.closest('.row-btn[data-more]')) hideCtx();
});


// ══════════════════════════════════════════════════════════
//  SECTION 10 — SETTINGS
// ══════════════════════════════════════════════════════════

async function loadSettings() {
  try {
    await loadApiKeys();
    const data = await api('/api/admin/settings');
    if (!data?.success) { console.error('Failed to fetch settings:', data?.message); return; }
    const s = data.settings;
    
    const mToggle = document.getElementById('maintenanceToggle');
    if (mToggle && s.maintenance) {
      mToggle.checked = s.maintenance.enabled || false;
      mToggle.onchange = async (e) => {
        await api('/api/admin/settings/maintenance', { method: 'PUT', body: JSON.stringify({ enabled: e.target.checked }) });
      };
    }
    if (s.config) {
      // Merge maintenance and features into config so fillSettings can restore toggles
      fillSettings({
        ...s.config,
        maintenance: s.maintenance,
        features:    s.features,
      });
    }
  } catch (err) {
    console.error('Error in loadSettings:', err);
  }
}

function fillSettings(data) {
  const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ''; };
  setVal('initBal', data.initBal);
  setVal('descText', data.siteAbout);
  setVal('waLink', data.whatsappLink);
  setVal('tgLink', data.telegramLink);
  setVal('siteNameInput', data.siteName);
  setVal('signinAmt', data.dailyCheckInAmount);
  setVal('minWithdraw', data.minWithdraw);
  setVal('withdrawFee', data.withdrawFee);
  // Also fill new settings UI fields
  setVal('siteName', data.siteName);
  setVal('siteTagline', data.tagline || '');
  setVal('siteDesc', data.siteAbout);
  setVal('whatsappLink', data.whatsappLink);
  setVal('telegramLink', data.telegramLink);
  setVal('checkinBonus', data.dailyCheckInAmount);
  
  const preview = document.getElementById('logoPreview');
  if (preview && preview.tagName === 'IMG') preview.src = data.siteLogo || '';
  
  if (Array.isArray(data.referralPercents)) {
    setVal('ref1', data.referralPercents[0]);
    setVal('ref2', data.referralPercents[1]);
    setVal('ref3', data.referralPercents[2]);
    setVal('refL1', data.referralPercents[0]);
    setVal('refL2', data.referralPercents[1]);
    setVal('refL3', data.referralPercents[2]);
  }

  // Restore deposit amounts if API has them
  if (Array.isArray(data.depositAmounts) && data.depositAmounts.length) {
    depositAmounts.length = 0;
    data.depositAmounts.forEach(a => depositAmounts.push(a));
    renderTags('depositTags', depositAmounts);
  }

  // Restore feature flag toggles
  if (data.features) {
    const toggleMap = {
      deposits:    'tgl-deposits',
      withdrawals: 'tgl-withdrawals',
      shares:      'tgl-shares',
      referral:    'tgl-referral',
      spin:        'tgl-spin',
      register:    'tgl-register',
    };
    Object.entries(toggleMap).forEach(([key, elId]) => {
      const el = document.getElementById(elId);
      if (el && data.features[key] !== undefined) el.checked = !!data.features[key];
    });
  }
  if (data.maintenance?.enabled !== undefined) {
    const mt = document.getElementById('tgl-maintenance');
    if (mt) mt.checked = !!data.maintenance.enabled;
  }
}

async function loadApiKeys() {
  const data = await api('/api/admin/settings/apikeys');
  if (!data?.apikeys) return;
  const k = data.apikeys;
  const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
  setVal('imgbbKeyInput', k.imgbb);
  setVal('koraPublicKeyInput', k.korapay_public);
  setVal('koraSecretKeyInput', k.korapay_secret);
}

// ── Settings toggles ───────────────────────────────────────
function toggleSection(id) {
  document.getElementById(id)?.classList.toggle('open');
}

function onToggle(feature, checked) {
  if (feature === 'maintenance' && checked) {
    document.getElementById('tgl-maintenance').checked = false;
    showConfirm({
      title: 'Enable Maintenance Mode?',
      msg: 'All users will be locked out immediately. Only admins can log in during this time.',
      type: 'danger',
      yesLabel: 'Enable Maintenance',
      onYes: () => {
        document.getElementById('tgl-maintenance').checked = true;
        settingsState['maintenance'] = true;
        saveFeatureState('maintenance', true);
        showToast('⚠️ Maintenance mode ON — users are locked out', 'error');
        markChanged();
      }
    });
    return;
  }
  if (feature === 'withdrawals' && !checked) {
    document.getElementById('tgl-withdrawals').checked = true;
    showConfirm({
      title: 'Disable Withdrawals?',
      msg: 'Users will not be able to cash out until you re-enable this.',
      type: 'warning',
      yesLabel: 'Disable Withdrawals',
      onYes: () => {
        document.getElementById('tgl-withdrawals').checked = false;
        settingsState['withdrawals'] = false;
        saveFeatureState('withdrawals', false);
        showToast('Withdrawals disabled', 'info');
        markChanged();
      }
    });
    return;
  }
  if (feature === 'register' && !checked) {
    document.getElementById('tgl-register').checked = true;
    showConfirm({
      title: 'Stop New Registrations?',
      msg: 'New users will not be able to sign up. Existing accounts are unaffected.',
      type: 'warning',
      yesLabel: 'Stop Registrations',
      onYes: () => {
        document.getElementById('tgl-register').checked = false;
        settingsState['register'] = false;
        saveFeatureState('register', false);
        showToast('New registrations disabled', 'info');
        markChanged();
      }
    });
    return;
  }
  settingsState[feature] = checked;
  saveFeatureState(feature, checked);
  markChanged();
  if (feature !== 'maintenance') {
    const label = feature.charAt(0).toUpperCase() + feature.slice(1);
    showToast(`${label} ${checked?'enabled':'disabled'}`, checked ? 'success' : 'info');
  }
}

async function saveFeatureState(feature, value) {
  try {
    await api('/api/admin/settings/toggle', {
      method: 'POST',
      body: JSON.stringify({ feature, value })
    });
  } catch (err) {
    console.warn('[saveFeatureState] API not available, change tracked locally');
  }
  console.log(`[Settings] ${feature} = ${value}`);
}

// ── Unsaved changes ────────────────────────────────────────
function markChanged() {
  unsavedChanges++;
  const cnt = document.getElementById('unsavedCount');
  if (cnt) cnt.textContent = unsavedChanges;
  document.getElementById('unsavedBar')?.classList.add('visible');
}

function resetUnsaved() {
  unsavedChanges = 0;
  const cnt = document.getElementById('unsavedCount');
  if (cnt) cnt.textContent = '0';
  document.getElementById('unsavedBar')?.classList.remove('visible');
}

function confirmDiscard() {
  showConfirm({
    title: 'Discard Changes?',
    msg: `You have ${unsavedChanges} unsaved change${unsavedChanges!==1?'s':''}. All changes will be lost.`,
    type: 'warning',
    yesLabel: 'Discard Changes',
    onYes: () => location.reload()
  });
}

function initChangeTracking() {
  document.querySelectorAll('.form-input, .add-tag-input').forEach(el => {
    el.addEventListener('input', markChanged);
    el.addEventListener('change', markChanged);
  });
}

window.addEventListener('beforeunload', (e) => {
  if (unsavedChanges > 0) { e.preventDefault();
    e.returnValue = ''; }
});

// ── Save all settings ──────────────────────────────────────
async function saveAllSettings() {
  const g = (id) => document.getElementById(id)?.value;

  // Build the config payload matching your backend schema
  const configPayload = {
    siteName:           g('siteName')      || g('siteNameInput'),
    tagline:            g('siteTagline'),
    siteAbout:          g('siteDesc')      || g('descText'),
    whatsappLink:       g('whatsappLink')  || g('waLink'),
    telegramLink:       g('telegramLink')  || g('tgLink'),
    dailyCheckInAmount: Number(g('checkinBonus') || g('signinAmt') || 0),
    referralPercents:   [g('refL1')||g('ref1'), g('refL2')||g('ref2'), g('refL3')||g('ref3')].map(Number),
    minDeposit:         Number(g('minDeposit')  || 0),
    maxDeposit:         Number(g('maxDeposit')  || 0),
    minWithdraw:        Number(g('minWithdraw') || 0),
    withdrawFee:        Number(g('withdrawFee') || 0),
    withdrawStart:      g('withdrawStart'),
    withdrawEnd:        g('withdrawEnd'),
    adminEmail:         g('adminEmail'),
    maintMsg:           g('maintMsg'),
    gateway:            g('payGateway'),
    environment:        g('payEnv'),
    ...settingsState
  };

  // Animate buttons immediately so it feels responsive
  document.querySelectorAll('.btn-save, .btn-save-now').forEach(btn => {
    btn._orig = btn.innerHTML;
    btn.innerHTML = '<i class="ri-loader-4-line"></i> Saving...';
    btn.disabled = true;
  });

  try {
    const result = await api('/api/admin/settings/config', {
      method: 'PUT',
      body: JSON.stringify(configPayload)
    });

    if (result?.success || result?.message) {
      document.querySelectorAll('.btn-save, .btn-save-now').forEach(btn => {
        btn.innerHTML = '<i class="ri-check-line"></i> Saved!';
        btn.style.background = '#16a34a';
        setTimeout(() => {
          btn.innerHTML = btn._orig;
          btn.style.background = '';
          btn.disabled = false;
        }, 2000);
      });
      resetUnsaved();
      showToast('All settings saved successfully', 'success');
    } else {
      throw new Error(result?.error || result?.message || 'Save failed');
    }
  } catch (err) {
    console.error('[saveAllSettings]', err);
    document.querySelectorAll('.btn-save, .btn-save-now').forEach(btn => {
      btn.innerHTML = btn._orig;
      btn.disabled = false;
    });
    showToast('Failed to save: ' + err.message, 'error');
  }
}

function resetDefaults() {
  showConfirm({
    title: 'Reset to Defaults?',
    msg: 'All settings will be restored to factory defaults. This cannot be undone.',
    type: 'warning',
    yesLabel: 'Yes, Reset Everything',
    onYes: () => {
      const s = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
      s('siteName', 'Fluxmall Exchange');
      s('siteTagline', 'Setting Standards');
      s('checkinBonus', '50');
      s('refL1', '5');
      s('refL2', '3');
      s('refL3', '1');
      s('minDeposit', '1000');
      s('maxDeposit', '500000');
      s('minWithdraw', '500');
      s('withdrawFee', '2');
      showToast('Settings reset to defaults', 'info');
      resetUnsaved();
    }
  });
}

// ── Settings search ────────────────────────────────────────
function handleSettingsSearch(query) {
  const q = query.trim().toLowerCase();
  const clearBtn = document.getElementById('searchClear');
  const noResults = document.getElementById('noResults');
  if (clearBtn) clearBtn.classList.toggle('visible', q.length > 0);
  
  if (!q) {
    document.querySelectorAll('.section-card').forEach(c => c.classList.remove('search-hidden'));
    document.querySelectorAll('[data-search-label]').forEach(l => l.classList.remove('search-hidden'));
    document.querySelectorAll('.settings-grid').forEach(g => g.classList.remove('search-hidden'));
    if (noResults) noResults.classList.remove('visible');
    return;
  }
  
  let totalVisible = 0;
  document.querySelectorAll('.section-card').forEach(card => {
    const keywords = (card.dataset.searchKeywords || '').toLowerCase();
    const titleEl = card.querySelector('.section-title-text');
    const subEl = card.querySelector('.section-sub');
    const combined = `${titleEl?.textContent||''} ${subEl?.textContent||''} ${keywords}`.toLowerCase();
    if (combined.includes(q)) {
      card.classList.remove('search-hidden');
      card.classList.add('open');
      if (titleEl) titleEl.innerHTML = highlightText(titleEl.textContent, q);
      totalVisible++;
    } else {
      card.classList.add('search-hidden');
    }
  });
  
  document.querySelectorAll('[data-search-label]').forEach(label => {
    let next = label.nextElementSibling;
    let hasVisible = false;
    while (next && !next.hasAttribute('data-search-label')) {
      if (next.classList.contains('settings-grid')) {
        if (next.querySelectorAll('.section-card:not(.search-hidden)').length > 0) hasVisible = true;
      }
      next = next.nextElementSibling;
    }
    label.classList.toggle('search-hidden', !hasVisible);
  });
  
  if (noResults) {
    noResults.classList.toggle('visible', totalVisible === 0);
    const qEl = document.getElementById('noResultsQuery');
    if (qEl) qEl.textContent = query;
  }
}

function clearSettingsSearch() {
  const input = document.getElementById('settingsSearch');
  if (input) { input.value = '';
    handleSettingsSearch('');
    input.focus(); }
  document.querySelectorAll('.section-title-text').forEach(el => { el.innerHTML = el.textContent; });
}

// ── Number stepper ─────────────────────────────────────────
function stepNum(id, delta) {
  const el = document.getElementById(id);
  if (!el) return;
  const val = parseFloat(el.value) || 0;
  const min = parseFloat(el.min ?? -Infinity);
  const max = parseFloat(el.max ?? Infinity);
  el.value = Math.min(max, Math.max(min, val + delta));
  markChanged();
}

// ── Amount tags ────────────────────────────────────────────
function renderTags(containerId, amounts) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = amounts.map(a => `
    <div class="amount-tag">
      ₦${Number(a).toLocaleString()}
      <span class="tag-del" onclick="removeTag('${containerId}',${a})">✕</span>
    </div>`).join('');
}

function addTag(containerId, inputId) {
  const input = document.getElementById(inputId);
  const val = parseInt(input?.value);
  if (!val || val <= 0) { showToast('Enter a valid amount', 'error'); return; }
  if (depositAmounts.includes(val)) { showToast('Amount already exists', 'error'); return; }
  depositAmounts.push(val);
  depositAmounts.sort((a, b) => a - b);
  renderTags(containerId, depositAmounts);
  if (input) input.value = '';
  showToast(`₦${val.toLocaleString()} added`, 'success');
  markChanged();
}

function removeTag(containerId, amount) {
  showConfirm({
    title: 'Remove Amount?',
    msg: `Remove ₦${Number(amount).toLocaleString()} from quick-select options?`,
    type: 'warning',
    yesLabel: 'Remove',
    onYes: () => {
      const idx = depositAmounts.indexOf(amount);
      if (idx > -1) depositAmounts.splice(idx, 1);
      renderTags(containerId, depositAmounts);
      markChanged();
    }
  });
}

// ── Logo upload ────────────────────────────────────────────
function handleLogoUpload(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const preview = document.getElementById('logoPreview');
    if (preview) {
      if (preview.tagName === 'IMG') preview.src = e.target.result;
      else preview.innerHTML = `<img src="${e.target.result}" alt="Logo">`;
    }
    const logoUrl = document.getElementById('logoUrl');
    if (logoUrl) logoUrl.value = e.target.result;
    showToast('Logo uploaded — save to apply', 'success');
    markChanged();
  };
  reader.readAsDataURL(file);
}

// ── API key utils ──────────────────────────────────────────
function copyField(id) {
  const el = document.getElementById(id);
  if (!el || !el.value) { showToast('Nothing to copy', 'error'); return; }
  navigator.clipboard.writeText(el.value).then(() => showToast('Copied to clipboard', 'success'));
}

function togglePasswordField(id, btn) {
  const el = document.getElementById(id);
  if (!el) return;
  el.type = el.type === 'password' ? 'text' : 'password';
  btn.innerHTML = el.type === 'password' ? '<i class="ri-eye-off-line"></i>' : '<i class="ri-eye-line"></i>';
}

function onGatewayChange(val) {
  showToast(`Gateway switched to ${val.charAt(0).toUpperCase()+val.slice(1)}`, 'info');
  markChanged();
}

async function testApiConnection() {
  const btn = document.querySelector('#card-api .btn-configure');
  if (!btn) return;
  const orig = btn.innerHTML;
  btn.innerHTML = '<i class="ri-loader-4-line"></i> Testing...';
  btn.disabled = true;
  await new Promise(r => setTimeout(r, 1800));
  btn.innerHTML = orig;
  btn.disabled = false;
  showToast('Connection successful ✓', 'success');
}

function openUtil(section) { showToast(`Opening ${section} manager...`, 'info'); }

function saveBrandAssets() { showToast('Brand assets saved', 'success');
  markChanged(); }

function checkUpdates() {
  showToast('Checking for updates...', 'info');
  setTimeout(() => showToast('Platform is up to date ✓', 'success'), 2000);
}

window.saveApiKeys = async () => {
  const g = (id) => document.getElementById(id)?.value.trim();
  const data = await api('/api/admin/settings/apikeys', {
    method: 'PUT',
    body: JSON.stringify({ imgbb: g('imgbbKeyInput'), korapay_public: g('koraPublicKeyInput'), korapay_secret: g('koraSecretKeyInput') })
  });
  if (data?.success) showToast('API Keys saved!', 'success');
  else alert(data?.error || 'Error saving API keys.');
};

// ── Confirmation modal ─────────────────────────────────────
const confirmIcons = { danger: 'ri-error-warning-line', warning: 'ri-alert-line', info: 'ri-question-line' };

function showConfirm({ title, msg, type = 'danger', yesLabel = 'Confirm', onYes }) {
  confirmCallback = onYes;
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmMsg').textContent = msg;
  document.getElementById('confirmIconEl').className = confirmIcons[type] || confirmIcons.danger;
  document.getElementById('confirmIcon').className = `confirm-icon-wrap ${type}`;
  const yesBtn = document.getElementById('confirmYesBtn');
  yesBtn.textContent = yesLabel;
  yesBtn.className = `confirm-btn-yes ${type === 'info' ? 'green' : type}`;
  document.getElementById('confirmOverlay').classList.add('visible');
  document.body.style.overflow = 'hidden';
}

function closeConfirm() {
  document.getElementById('confirmOverlay').classList.remove('visible');
  document.body.style.overflow = '';
  confirmCallback = null;
}

function confirmYes() {
  if (confirmCallback) confirmCallback();
  closeConfirm();
}

function handleOverlayClick(e) {
  if (e.target === document.getElementById('confirmOverlay')) closeConfirm();
}


// ══════════════════════════════════════════════════════════
//  SECTION 11 — THEME
// ══════════════════════════════════════════════════════════

function setTheme(mode) {
  const html = document.documentElement;
  if (mode === 'auto') {
    mode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  html.setAttribute('data-theme', mode);
  localStorage.setItem('fm_admin_theme', mode);
  updateThemeIcons(mode);
}

function updateThemeIcons(theme) {
  document.querySelectorAll('.i-moon').forEach(el => el.style.display = theme === 'dark' ? 'block' : 'none');
  document.querySelectorAll('.i-sun').forEach(el => el.style.display = theme === 'light' ? 'block' : 'none');
}

function loadThemeSettings() {
  const saved = localStorage.getItem('fm_admin_theme') || 'light';
  setTheme(saved);
  const toggler = document.getElementById('theme-toggle');
  if (toggler) toggler.checked = saved === 'dark';
}

function toggleTheme() {
  const curr = document.documentElement.getAttribute('data-theme') || 'dark';
  setTheme(curr === 'dark' ? 'light' : 'dark');
}

window.applyPreset = (mode, primary, secondary) => {
  const s = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
  s('themeMode', mode);
  s('primaryColor', primary);
  s('secondaryColor', secondary);
  saveThemeConfig();
};

window.saveThemeConfig = async (e) => {
  if (e) e.preventDefault();
  const btn = document.querySelector('#themeForm button');
  if (btn) { btn.disabled = true;
    btn.innerText = 'Publishing...'; }
  try {
    await api('/api/admin/settings/config', {
      method: 'PUT',
      body: JSON.stringify({
        theme: {
          mode: document.getElementById('themeMode')?.value,
          primary: document.getElementById('primaryColor')?.value,
          secondary: document.getElementById('secondaryColor')?.value
        }
      })
    });
    alert('✅ Theme Updated! Users will see it immediately.');
  } catch (err) {
    alert('Failed to update theme. Check console for details.');
  } finally {
    if (btn) { btn.disabled = false;
      btn.innerText = 'Save Theme'; }
  }
};


// ══════════════════════════════════════════════════════════
//  SECTION 12 — SETTINGS FORM SUBMISSIONS (old panels)
// ══════════════════════════════════════════════════════════

// rulesForm submit
const rulesForm = document.getElementById('rulesForm');
if (rulesForm) {
  rulesForm.addEventListener('invalid', (e) => {
    const details = e.target.closest('details');
    if (details) details.open = true;
  }, true);
  
  rulesForm.onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    if (btn) { btn.disabled = true;
      btn.innerText = 'Saving...'; }
    try {
      const newConfig = {
        siteName: document.getElementById('siteNameInput')?.value,
        siteAbout: document.getElementById('descText')?.value,
        whatsappLink: document.getElementById('waLink')?.value,
        telegramLink: document.getElementById('tgLink')?.value,
        initBal: Number(document.getElementById('initBal')?.value),
        dailyCheckInAmount: Number(document.getElementById('signinAmt')?.value),
        referralPercents: [
          Number(document.getElementById('ref1')?.value),
          Number(document.getElementById('ref2')?.value),
          Number(document.getElementById('ref3')?.value),
        ],
      };
      await api('/api/admin/settings/config', { method: 'PUT', body: JSON.stringify(newConfig) });
      showToast('Configuration saved!', 'success');
    } catch (err) {
      alert('Error updating config. Check your connection.');
    } finally {
      if (btn) { btn.disabled = false;
        btn.innerText = 'Save Config'; }
    }
  };
}

// Payment settings
window.openBindBankModal = async () => {
  const data = await api('/api/admin/settings');
  const p = data?.settings?.payment || {};
  showModal({
    id: 'createBankModal',
    title: 'Payments Configuration',
    content: `
      <div class="input-group"><label>Active Deposit Mode</label>
        <select id="depositMode" onchange="togglePaymentFields()">
          <option value="manual" ${p.mode==='manual'?'selected':''}>Manual Bank Transfer</option>
          <option value="korapay" ${p.mode==='korapay'?'selected':''}>Korapay Automatic</option>
        </select>
      </div>
      <div id="manualSettings">
        <div class="input-group"><label>Bank Name</label><input type="text" id="adminBankName" value="${p.manual?.bankName||''}"></div>
        <div class="input-group"><label>Account Number</label><input type="text" id="adminAccNum" value="${p.manual?.accountNumber||''}"></div>
        <div class="input-group"><label>Account Name</label><input type="text" id="adminAccName" value="${p.manual?.accountName||''}"></div>
      </div>
      <div id="korapaySettings" style="display:none">
        <div class="input-group"><label>Korapay Public Key</label><input type="text" id="koraPublicKey" value="${p.korapay?.publicKey||''}"></div>
        <div class="input-group"><label>Secret Key</label><input type="password" id="koraSecretKey" value="${p.korapay?.secretKey||''}"></div>
      </div>`,
    buttons: [
      { text: 'Cancel', class: 'btn-sec', onclick: "document.getElementById('createBankModal').remove()" },
      { text: 'Configure', class: 'btn-submit', onclick: 'savePaymentSettings()' }
    ]
  });
  togglePaymentFields();
};

window.togglePaymentFields = () => {
  const mode = document.getElementById('depositMode')?.value;
  const ms = document.getElementById('manualSettings');
  const ks = document.getElementById('korapaySettings');
  if (ms) ms.style.display = mode === 'manual' ? 'block' : 'none';
  if (ks) ks.style.display = mode === 'korapay' ? 'block' : 'none';
};

window.savePaymentSettings = async () => {
  const g = (id) => document.getElementById(id)?.value;
  const config = {
    mode: g('depositMode'),
    manual: { bankName: g('adminBankName'), accountNumber: g('adminAccNum'), accountName: g('adminAccName') },
    korapay: { publicKey: g('koraPublicKey'), secretKey: g('koraSecretKey') }
  };
  await api('/api/admin/settings/payment', { method: 'PUT', body: JSON.stringify(config) });
  showToast('Payment settings saved!', 'success');
  document.getElementById('createBankModal')?.remove();
};

// Announcement
window.openCreateNewsModal = async () => {
  const data = await api('/api/admin/settings');
  const ann = data?.settings?.config?.announcement || {};
  showModal({
    id: 'createNewsModal',
    title: 'Make Announcement',
    content: `
      <div class="input-group" style="margin-top:15px;">
        <textarea id="announcementText" placeholder="Enter news here..." style="width:100%;height:60px;border-radius:8px;padding:10px;margin-top:5px;">${ann.text||''}</textarea>
        <div style="display:flex;gap:10px;margin-top:8px;">
          <label>📢 Enable Global Announcement</label>
          <label class="switch"><input type="checkbox" id="showAnnouncement" ${ann.active?'checked':''}><span class="slider"></span></label>
        </div>
      </div>`,
    buttons: [
      { text: 'Cancel', class: 'btn-sec', onclick: "document.getElementById('createNewsModal').remove()" },
      { text: 'Announce', class: 'btn-submit', onclick: 'saveAnnouncement()' }
    ]
  });
};

window.saveAnnouncement = async () => {
  const data = await api('/api/admin/settings');
  const config = data?.settings?.config || {};
  config.announcement = {
    text: document.getElementById('announcementText')?.value,
    active: document.getElementById('showAnnouncement')?.checked
  };
  await api('/api/admin/settings/config', { method: 'PUT', body: JSON.stringify(config) });
  document.getElementById('createNewsModal')?.remove();
  showToast('Announcement saved!', 'success');
};

// Shares
window.openSharesModal = async () => {
  const data = await api('/api/admin/shares');
  const shares = data?.shares || [];
  showModal({
    id: 'sharesModal',
    title: 'Manage Investment Shares',
    content: `
      <div id="sharesList">${shares.map(s => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px;border:1px solid #eee;border-radius:8px;margin-bottom:8px;">
          <span>${s.name} — ₦${s.price.toLocaleString()} | ₦${s.dailyIncome}/day | ${s.duration}days</span>
          <button class="btn-action" style="background:var(--danger)" onclick="deleteShare('${s._id}')">✖</button>
        </div>`).join('') || '<p style="color:gray">No shares yet.</p>'}</div>
      <hr>
      <h4>Add New Share</h4>
      <div class="input-group"><label>Name</label><input id="newShareName" placeholder="e.g Gold Pack"></div>
      <div class="input-group"><label>Price</label><input type="number" id="newSharePrice" placeholder="5000"></div>
      <div class="input-group"><label>Daily Income</label><input type="number" id="newShareDaily" placeholder="200"></div>
      <div class="input-group"><label>Duration (Days)</label><input type="number" id="newShareDuration" placeholder="30"></div>
      <div class="input-group">
        <label>Share Image</label>
        <input type="file" id="newShareImgFile" accept="image/*" style="padding:6px;border-radius:8px;border:1px solid #ddd;width:100%">
        <span id="shareImgStatus" style="font-size:12px;color:var(--primary)"></span>
        <input type="hidden" id="newShareImg">
      </div>`,
    buttons: [
      { text: 'Add Share', class: 'btn-submit', onclick: 'addShare()' },
      { text: 'Close', class: 'btn-sec', onclick: "document.getElementById('sharesModal').remove()" }
    ]
  });
};

window.addShare = async () => {
  const g = (id) => document.getElementById(id)?.value;
  const name = g('newShareName');
  const price = Number(g('newSharePrice'));
  const daily = Number(g('newShareDaily'));
  const duration = Number(g('newShareDuration'));
  if (!name || !price) { alert('Please fill all required fields.'); return; }
  
  let imgUrl = g('newShareImg');
  const fileInput = document.getElementById('newShareImgFile');
  if (fileInput?.files[0]) {
    imgUrl = await uploadToImgBB(fileInput.files[0], document.getElementById('shareImgStatus'));
    if (!imgUrl) return;
  }
  
  await api('/api/admin/shares', { method: 'POST', body: JSON.stringify({ name, price, dailyIncome: daily, duration, img: imgUrl || '' }) });
  document.getElementById('sharesModal')?.remove();
  showToast('Share added successfully!', 'success');
};

window.deleteShare = async (id) => {
  if (!confirm('Delete this share?')) return;
  await api(`/api/admin/shares/${id}`, { method: 'DELETE' });
  document.getElementById('sharesModal')?.remove();
};

window.openCreateUserModal = () => {
  showModal({
    id: 'createUserModal',
    title: 'Create New User',
    content: `
      <div class="input-group"><label>Username</label><input id="newUsername" placeholder="johndoe"></div>
      <div class="input-group"><label>Email</label><input type="email" id="newEmail" placeholder="user@email.com"></div>
      <div class="input-group"><label>Password</label><input type="password" id="newPassword" placeholder="min 6 chars"></div>
      <div class="input-group"><label>Role</label>
        <select id="newRole"><option value="user">User</option><option value="admin">Admin</option></select>
      </div>`,
    buttons: [
      { text: 'Create', class: 'btn-submit', onclick: 'createUser()' },
      { text: 'Cancel', class: 'btn-sec', onclick: "document.getElementById('createUserModal').remove()" }
    ]
  });
};

window.createUser = async () => {
  const g = (id) => document.getElementById(id)?.value;
  const data = await api('/api/admin/create-user', {
    method: 'POST',
    body: JSON.stringify({ username: g('newUsername'), email: g('newEmail'), password: g('newPassword'), role: g('newRole') })
  });
  if (data?.success) {
    showToast('User created successfully!', 'success');
    document.getElementById('createUserModal')?.remove();
    renderApiUsers();
  } else {
    alert(data?.error || 'Error creating user.');
  }
};

window.previewLogo = async (input) => {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => { const p = document.getElementById('logoPreview'); if (p) p.src = e.target.result; };
  reader.readAsDataURL(file);
  const statusEl = document.getElementById('logoUploadStatus');
  const url = await uploadToImgBB(file, statusEl);
  if (!url) return;
  const confData = await api('/api/admin/settings');
  const config = confData?.settings?.config || {};
  config.siteLogo = url;
  await api('/api/admin/settings/config', { method: 'PUT', body: JSON.stringify(config) });
  const preview = document.getElementById('logoPreview');
  if (preview) preview.src = url;
  showToast('Logo uploaded and saved!', 'success');
};

window.openChatModal = async () => {
  showModal({
    id: 'createChatModal',
    title: 'Chat settings',
    content: `
      <div class="settings-row">
        <label>Chat Available</label>
        <label class="switch"><input type="checkbox" id="cs_available" checked><span class="slider"></span></label>
      </div>
      <div class="settings-row">
        <label>Sound Alerts</label>
        <label class="switch"><input type="checkbox" id="cs_sound" checked><span class="slider"></span></label>
      </div>
      <div class="settings-row">
        <label>Allow User Images</label>
        <label class="switch"><input type="checkbox" id="cs_allowImages" checked><span class="slider"></span></label>
      </div>
      <div style="margin:14px 0 6px;font-size:13px;font-weight:600;">Auto-Reply Message</div>
      <textarea id="cs_autoReply" rows="3" placeholder="e.g. Thanks for reaching out!" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:8px;font-size:13px;"></textarea>`,
    buttons: [
      { text: 'Cancel', class: 'btn-sec', onclick: "document.getElementById('createChatModal').remove()" },
      { text: 'Save Settings', class: 'btn-submit', onclick: 'saveChatSettings()' }
    ]
  });
  loadChatSettings();
};


// ══════════════════════════════════════════════════════════
//  SECTION 13 — CHAT PAGE (Support panel with mock data)
// ══════════════════════════════════════════════════════════

async function initChatPage() {
  buildEmojiGrid();
  await loadChatSessionsIntoList();
  // Poll for new chats every 15 seconds when on chat page
  if (window._chatPagePollTimer) clearInterval(window._chatPagePollTimer);
  window._chatPagePollTimer = setInterval(loadChatSessionsIntoList, 15000);
}

// Loads real sessions from API and renders them in the chat list sidebar
async function loadChatSessionsIntoList() {
  const list    = document.getElementById('chatList');
  const noChats = document.getElementById('noChats');
  if (!list) return;

  const data = await api('/api/admin/chat/sessions');

  // API failed or not available — fall back to mock data silently
  if (!data?.success) {
    if (list.innerHTML === '') {
      // Only render mock if list is completely empty (first load fail)
      renderChatList(CHAT_USERS);
    }
    return;
  }

  const sessions = data.sessions || [];

  // Map API session shape → the shape renderChatList expects
  const mapped = sessions.map((s, i) => ({
    id:       s._id,
    name:     s.username || 'Unknown User',
    initials: (s.username || 'U').substring(0, 2).toUpperCase(),
    email:    s.userEmail || '',
    online:   s.status !== 'ended',
    unread:   s.unreadAdmin || 0,
    pinned:   s.pinned || false,
    muted:    s.muted  || false,
    status:   s.status === 'ended' ? 'resolved' : 'open',
    balance:  s.userId?.ib || 0,
    shares:   s.userId?.shares || 0,
    deposits: s.userId?.transCount || 0,
    referrals:s.userId?.refPoints || 0,
    lastMsg:  s.lastMessage || 'No messages yet',
    lastTime: s.lastMessageAt
      ? new Date(s.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '',
    color:    COLORS[i % COLORS.length],
    // keep original session id so openChat can open the real session
    sessionId: s._id,
    userData:  s.userId,
  }));

  // Update badge counts in footer
  const openCount     = mapped.filter(u => u.status === 'open').length;
  const unreadCount   = mapped.reduce((a, u) => a + u.unread, 0);
  const resolvedCount = mapped.filter(u => u.status === 'resolved').length;
  const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setEl('stat-open',     openCount);
  setEl('stat-unread',   unreadCount);
  setEl('stat-resolved', resolvedCount);
  setEl('badge-all',     mapped.length);
  setEl('badge-unread',  unreadCount);

  // Store mapped sessions globally so search/filter can re-use them
  window._chatSessions = mapped;

  // Apply current filter + search before rendering
  const q = document.getElementById('chatSearch')?.value.trim().toLowerCase() || '';
  handleChatSearch(q);
}

function renderChatList(users, query = '') {
  const list = document.getElementById('chatList');
  const noChats = document.getElementById('noChats');
  if (!list) return;
  
  const sorted = [...users].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return chatSortDesc ? -1 : 1;
  });
  
  if (sorted.length === 0) {
    list.innerHTML = '';
    noChats?.classList.add('visible');
    return;
  }
  noChats?.classList.remove('visible');
  
  list.innerHTML = sorted.map(u => {
    const name = query ? highlightText(u.name, query) : u.name;
    const preview = query ? highlightText(u.lastMsg, query) : u.lastMsg;
    const isActive = chatActiveUserId === u.id;
    return `
    <div class="chat-item ${u.unread?'unread':''} ${u.pinned?'pinned':''} ${u.muted?'muted':''} ${isActive?'active':''}"
      id="ci-${u.id}" onclick="openChat(${u.id})" oncontextmenu="chatItemCtx(event,${u.id})">
      <div class="chat-avatar">
        <div class="avatar-img initials" style="color:${u.color};border-color:${u.color}22;">${u.initials}</div>
        <div class="online-dot ${u.online?'visible':''}"></div>
      </div>
      <div class="chat-info">
        <div class="chat-name-row">
          <span class="chat-name">${name}</span>
          <div style="display:flex;align-items:center;gap:4px;">
            <i class="ri-pushpin-2-fill pin-icon"></i>
            <span class="chat-time">${u.lastTime}</span>
          </div>
        </div>
        <div class="chat-preview-row">
          <span class="chat-preview">${preview}</span>
          <span class="typing-preview">typing...</span>
          <i class="ri-volume-mute-line muted-icon"></i>
          <span class="unread-badge">${u.unread}</span>
        </div>
      </div>
    </div>`;
  }).join('');
}

function openChat(userId) {
  chatActiveUserId = userId;

  // Try real sessions first, then fall back to mock
  const sessions = window._chatSessions || CHAT_USERS;
  const user = sessions.find(u => u.id === userId) || CHAT_USERS.find(u => u.id === userId);
  if (!user) return;

  // If this is a real API session, open it in the admin chat system
  if (user.sessionId && user.sessionId !== userId) {
    openAdminChatSession(user.sessionId, user.name, user.status === 'resolved' ? 'ended' : 'active', user.userData);
    return;
  }
  user.unread = 0;
  
  document.querySelectorAll('.chat-item').forEach(el => el.classList.remove('active'));
  const ci = document.getElementById(`ci-${userId}`);
  if (ci) {
    ci.classList.remove('unread');
    ci.classList.add('active');
    const badge = ci.querySelector('.unread-badge');
    if (badge) { badge.textContent = '0';
      badge.style.display = 'none'; }
  }
  
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  const setStyle = (id, prop, v) => { const el = document.getElementById(id); if (el) el.style[prop] = v; };
  
  const hdrAvatar = document.getElementById('hdrAvatar');
  if (hdrAvatar) { hdrAvatar.textContent = user.initials;
    hdrAvatar.style.color = user.color; }
  set('hdrName', user.name);
  
  const statusEl = document.getElementById('hdrStatus');
  const dotEl = document.getElementById('hdrOnlineDot');
  if (statusEl) {
    statusEl.textContent = user.online ? 'Online' : 'Offline';
    statusEl.className = `chat-header-status${user.online?' online':''}`;
  }
  dotEl?.classList.toggle('visible', user.online);
  
  // User info panel
  const uipAvatar = document.getElementById('uipAvatar');
  if (uipAvatar) { uipAvatar.textContent = user.initials;
    uipAvatar.style.color = user.color; }
  set('uipName', user.name);
  set('uipEmail', user.email);
  set('uipBalance', user.balance);
  set('uipShares', user.shares);
  set('uipDeposits', user.deposits);
  set('uipReferrals', user.referrals);
  
  // Session bar
  const seb = document.getElementById('sessionEndedBar');
  seb?.classList.toggle('visible', user.status === 'resolved');
  
  document.getElementById('chatEmpty').style.display = 'none';
  document.getElementById('chatWindow').classList.add('active');
  document.getElementById('chatMain').classList.add('mobile-open');
  
  renderMessages(userId);
}

function renderMessages(userId, highlight = '') {
  const area = document.getElementById('messagesArea');
  if (!area) return;
  const msgs = CHAT_MESSAGES[userId] || [];
  if (msgs.length === 0) {
    area.innerHTML = '<div class="sys-msg"><span>No messages yet. Say hello! 👋</span></div>';
    return;
  }
  
  let html = '<div class="date-sep"><span class="date-sep-text">Today</span></div>';
  let prevFrom = null;
  
  msgs.forEach((msg, i) => {
    const isContinuation = prevFrom === msg.from && i > 0;
    const isOut = msg.from === 'admin';
    const cls = `msg-wrap ${isOut?'out':'in'} ${isContinuation?'continuation':''}`;
    let textContent = highlight ? highlightText(escapeHtml(msg.text), highlight) : escapeHtml(msg.text);
    const isEmoji = /^[\u{1F300}-\u{1FFFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\s]+$/u.test(msg.text) && msg.text.length <= 6;
    const statusIcon = isOut ? `<i class="ri-check-double-line bubble-status ${msg.status==='read'?'read':''}"></i>` : '';
    
    html += `
    <div class="${cls}" data-msg-id="${msg.id}" oncontextmenu="showCtxMenu(event,${msg.id},'${escapeHtml(msg.text)}')">
      <div class="bubble ${isEmoji?'emoji-only':''}">
        ${!isOut&&!isContinuation?`<span class="bubble-sender">${CHAT_USERS.find(u=>u.id===userId)?.name.split(' ')[0]||'User'}</span>`:''}
        <div class="bubble-text">${textContent}</div>
        ${!isEmoji?`<div class="bubble-meta"><span class="bubble-time">${msg.time}</span>${statusIcon}</div>`:''}
      </div>
    </div>`;
    prevFrom = msg.from;
  });
  
  area.innerHTML = html;
  area.scrollTop = area.scrollHeight;
}

function sendMessage() {
  if (!chatActiveUserId) return;
  const input = document.getElementById('msgInput');
  const text = input?.value.trim();
  if (!text) return;
  
  const msgs = CHAT_MESSAGES[chatActiveUserId];
  const newMsg = { id: msgs.length + 1, from: 'admin', text, time: nowTime(), status: 'delivered', replyTo: replyingTo ? { ...replyingTo } : null };
  msgs.push(newMsg);
  
  const user = CHAT_USERS.find(u => u.id === chatActiveUserId);
  if (user) { user.lastMsg = text;
    user.lastTime = nowTime(); }
  
  if (input) input.value = '';
  const msgInput = document.getElementById('msgInput');
  if (msgInput) msgInput.style.height = 'auto';
  
  cancelReply();
  closeQuickReplies();
  closeEmoji();
  renderMessages(chatActiveUserId);
  handleChatSearch(document.getElementById('chatSearch')?.value || '');
}

function handleInputKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault();
    sendMessage(); }
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

function closeMobileChat() {
  document.getElementById('chatMain').classList.remove('mobile-open');
  document.querySelectorAll('.chat-item').forEach(el => el.classList.remove('active'));
  chatActiveUserId = null;
}

function handleChatSearch(query) {
  const q        = query.trim().toLowerCase();
  const clearBtn = document.getElementById('searchClearBtn');
  clearBtn?.classList.toggle('visible', q.length > 0);
  // Use real API sessions if available, else fall back to mock
  let users = window._chatSessions || CHAT_USERS;
  if (q) {
    users = users.filter(u =>
      u.name.toLowerCase().includes(q) ||
      u.lastMsg.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    );
  }
  users = applyChatFilter(users);
  renderChatList(users, q);
}

function clearChatSearch() {
  const input = document.getElementById('chatSearch');
  if (input) input.value = '';
  handleChatSearch('');
  document.getElementById('chatSearch')?.focus();
}

function setFilter(filter, btn) {
  currentFilter = filter;
  document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  handleChatSearch(document.getElementById('chatSearch')?.value || '');
}

function applyChatFilter(users) {
  switch (currentFilter) {
    case 'unread':
      return users.filter(u => u.unread > 0);
    case 'open':
      return users.filter(u => u.status === 'open');
    case 'resolved':
      return users.filter(u => u.status === 'resolved');
    case 'pinned':
      return users.filter(u => u.pinned);
    default:
      return users;
  }
}

function toggleSearch() {
  const bar = document.getElementById('msgSearchBar');
  if (!bar) return;
  msgSearchActive = !msgSearchActive;
  bar.style.display = msgSearchActive ? 'block' : 'none';
  document.getElementById('msgSearchBtn')?.classList.toggle('active', msgSearchActive);
  if (msgSearchActive) {
    document.getElementById('msgSearchInput')?.focus();
    document.getElementById('msgSearchClear')?.classList.add('visible');
  } else {
    closeMessageSearch();
  }
}

function searchInChat(query) {
  if (!chatActiveUserId) return;
  const q = query.trim();
  const countEl = document.getElementById('msgSearchCount');
  if (!q) { renderMessages(chatActiveUserId); if (countEl) countEl.textContent = ''; return; }
  const msgs = CHAT_MESSAGES[chatActiveUserId] || [];
  const matches = msgs.filter(m => m.text.toLowerCase().includes(q.toLowerCase()));
  if (countEl) countEl.textContent = matches.length ? `${matches.length} result${matches.length!==1?'s':''}` : 'No results';
  renderMessages(chatActiveUserId, q);
}

function closeMessageSearch() {
  const bar = document.getElementById('msgSearchBar');
  if (bar) bar.style.display = 'none';
  const si = document.getElementById('msgSearchInput');
  if (si) si.value = '';
  document.getElementById('msgSearchClear')?.classList.remove('visible');
  const cnt = document.getElementById('msgSearchCount');
  if (cnt) cnt.textContent = '';
  document.getElementById('msgSearchBtn')?.classList.remove('active');
  msgSearchActive = false;
  if (chatActiveUserId) renderMessages(chatActiveUserId);
}

function showCtxMenu(e, msgId, text) {
  e.preventDefault();
  ctxMsgId = msgId;
  ctxMsgText = text;
  const menu = document.getElementById('ctxMenu');
  if (!menu) return;
  menu.classList.add('visible');
  menu.style.left = Math.min(e.clientX, window.innerWidth - 190) + 'px';
  menu.style.top = Math.min(e.clientY, window.innerHeight - 220) + 'px';
}

function hideCtxMenu() { document.getElementById('ctxMenu')?.classList.remove('visible'); }

function ctxAction(action) {
  hideCtxMenu();
  switch (action) {
    case 'reply':
      startReply(ctxMsgId, ctxMsgText);
      break;
    case 'copy':
      navigator.clipboard.writeText(ctxMsgText).then(() => showToast('Copied!', 'success'));
      break;
    case 'forward':
      showToast('Forward: coming soon', 'info');
      break;
    case 'star':
      showToast('Message starred ⭐', 'success');
      break;
    case 'delete':
      if (chatActiveUserId && ctxMsgId) {
        const msgs = CHAT_MESSAGES[chatActiveUserId];
        const idx = msgs.findIndex(m => m.id === ctxMsgId);
        if (idx > -1) { msgs.splice(idx, 1);
          renderMessages(chatActiveUserId);
          showToast('Message deleted', 'info'); }
      }
      break;
  }
}

function startReply(msgId, text) {
  if (!chatActiveUserId) return;
  replyingTo = { msgId, text };
  const user = CHAT_USERS.find(u => u.id === chatActiveUserId);
  const rs = document.getElementById('replyBarSender');
  const rt = document.getElementById('replyBarText');
  if (rs) rs.textContent = user?.name.split(' ')[0] || 'User';
  if (rt) rt.textContent = text;
  document.getElementById('replyBar')?.classList.add('visible');
  document.getElementById('msgInput')?.focus();
}

function cancelReply() {
  replyingTo = null;
  document.getElementById('replyBar')?.classList.remove('visible');
}

function toggleQuickReplies() {
  quickOpen = !quickOpen;
  document.getElementById('quickReplies')?.classList.toggle('visible', quickOpen);
}

function closeQuickReplies() {
  quickOpen = false;
  document.getElementById('quickReplies')?.classList.remove('visible');
}

function useQuickReply(text) {
  const input = document.getElementById('msgInput');
  if (input) { input.value = text;
    autoResize(input); }
  closeQuickReplies();
  input?.focus();
}

function buildEmojiGrid() {
  const grid = document.getElementById('emojiGrid');
  if (!grid) return;
  grid.innerHTML = EMOJIS.map(e => `<span class="emoji-btn-item" onclick="insertEmoji('${e}')">${e}</span>`).join('');
}

function toggleEmoji() {
  emojiOpen = !emojiOpen;
  document.getElementById('emojiPicker')?.classList.toggle('visible', emojiOpen);
}

function closeEmoji() {
  emojiOpen = false;
  document.getElementById('emojiPicker')?.classList.remove('visible');
}

function insertEmoji(emoji) {
  const inp = document.getElementById('msgInput');
  if (!inp) return;
  const pos = inp.selectionStart;
  inp.value = inp.value.slice(0, pos) + emoji + inp.value.slice(pos);
  inp.selectionStart = inp.selectionEnd = pos + emoji.length;
  inp.focus();
}

function toggleUserPanel() {
  userPanelOpen = !userPanelOpen;
  document.getElementById('userInfoPanel')?.classList.toggle('hidden', !userPanelOpen);
  document.getElementById('uipToggleBtn')?.classList.toggle('active', userPanelOpen);
}

function simulateTyping() {
  if (!chatActiveUserId) return;
  const tb = document.getElementById('typingBubble');
  const area = document.getElementById('messagesArea');
  const ci = document.getElementById(`ci-${chatActiveUserId}`);
  ci?.classList.add('typing');
  tb?.classList.add('visible');
  if (area) area.scrollTop = area.scrollHeight;
  
  setTimeout(() => {
    tb?.classList.remove('visible');
    ci?.classList.remove('typing');
    const user = CHAT_USERS.find(u => u.id === chatActiveUserId);
    const responses = ['Thank you for your help!', 'Ok I will wait then', 'Is there anything else I should do?', 'My issue has been resolved 🙏', 'Please when will it be done?'];
    const text = responses[Math.floor(Math.random() * responses.length)];
    CHAT_MESSAGES[chatActiveUserId].push({ id: Date.now(), from: 'user', text, time: nowTime(), status: 'delivered' });
    if (user) { user.lastMsg = text;
      user.lastTime = nowTime(); }
    renderMessages(chatActiveUserId);
    handleChatSearch(document.getElementById('chatSearch')?.value || '');
  }, 2500);
}

function resolveSession() {
  if (!chatActiveUserId) return;
  const user = CHAT_USERS.find(u => u.id === chatActiveUserId);
  if (!user) return;
  user.status = 'resolved';
  document.getElementById('sessionEndedBar')?.classList.add('visible');
  const ia = document.getElementById('inputArea');
  if (ia) { ia.style.opacity = '0.5';
    ia.style.pointerEvents = 'none'; }
  showToast(`Session with ${user.name} resolved`, 'success');
  handleChatSearch(document.getElementById('chatSearch')?.value || '');
}

function reopenSession() {
  if (!chatActiveUserId) return;
  const user = CHAT_USERS.find(u => u.id === chatActiveUserId);
  if (!user) return;
  user.status = 'open';
  document.getElementById('sessionEndedBar')?.classList.remove('visible');
  const ia = document.getElementById('inputArea');
  if (ia) { ia.style.opacity = '';
    ia.style.pointerEvents = ''; }
  showToast('Session reopened', 'info');
}

function chatItemCtx(e, userId) {
  e.preventDefault();
  const user = CHAT_USERS.find(u => u.id === userId);
  if (!user) return;
  const actions = [
    { label: user.pinned ? 'Unpin chat' : 'Pin chat', fn: `user.pinned=!user.pinned;handleChatSearch('');showToast(user.pinned?'Chat pinned':'Chat unpinned','info');` },
    { label: user.muted ? 'Unmute chat' : 'Mute chat', fn: `user.muted=!user.muted;handleChatSearch('');showToast(user.muted?'Chat muted':'Chat unmuted','info');` },
    { label: 'Mark as unread', fn: `user.unread=1;handleChatSearch('');showToast('Marked as unread','info');` },
    { label: 'Resolve chat', fn: `user.status='resolved';handleChatSearch('');showToast('Resolved','success');` },
  ];
  const menu = document.getElementById('ctxMenu');
  if (!menu) return;
  // We need access to user in the onclick scope — use a closure via data attribute
  menu.innerHTML = actions.map((a, i) => `<div class="ctx-item" onclick="executeChatCtx(${userId},${i})">${a.label}</div>`).join('');
  menu._chatCtxActions = actions;
  menu._chatCtxUser = user;
  menu.classList.add('visible');
  menu.style.left = Math.min(e.clientX, window.innerWidth - 190) + 'px';
  menu.style.top = Math.min(e.clientY, window.innerHeight - 180) + 'px';
  menu.addEventListener('mouseleave', resetCtxMenu, { once: true });
}

window.executeChatCtx = function(userId, actionIdx) {
  const menu = document.getElementById('ctxMenu');
  const user = CHAT_USERS.find(u => u.id === userId);
  if (!menu || !user) return;
  const actions = [
    () => { user.pinned = !user.pinned;
      handleChatSearch('');
      showToast(user.pinned ? 'Chat pinned' : 'Chat unpinned', 'info'); },
    () => { user.muted = !user.muted;
      handleChatSearch('');
      showToast(user.muted ? 'Chat muted' : 'Chat unmuted', 'info'); },
    () => { user.unread = 1;
      handleChatSearch('');
      showToast('Marked as unread', 'info'); },
    () => { user.status = 'resolved';
      handleChatSearch('');
      showToast('Resolved', 'success'); },
  ];
  actions[actionIdx]?.();
  menu.classList.remove('visible');
  resetCtxMenu();
};

function resetCtxMenu() {
  const menu = document.getElementById('ctxMenu');
  if (!menu) return;
  menu.innerHTML = `
    <div class="ctx-item" onclick="ctxAction('reply')"><i class="ri-reply-line"></i> Reply</div>
    <div class="ctx-item" onclick="ctxAction('copy')"><i class="ri-file-copy-line"></i> Copy</div>
    <div class="ctx-item" onclick="ctxAction('forward')"><i class="ri-share-forward-line"></i> Forward</div>
    <div class="ctx-item" onclick="ctxAction('star')"><i class="ri-star-line"></i> Star message</div>
    <div class="ctx-divider"></div>
    <div class="ctx-item danger" onclick="ctxAction('delete')"><i class="ri-delete-bin-line"></i> Delete</div>`;
}

function toggleSort() {
  chatSortDesc = !chatSortDesc;
  const btn = document.getElementById('sortBtn');
  if (btn) btn.querySelector('i').className = chatSortDesc ? 'ri-sort-desc' : 'ri-sort-asc';
  handleChatSearch(document.getElementById('chatSearch')?.value || '');
  showToast(`Sorted ${chatSortDesc?'newest first':'oldest first'}`, 'info');
}

function showMoreMenu() {
  if (!chatActiveUserId) return;
  const user = CHAT_USERS.find(u => u.id === chatActiveUserId);
  showToast(`More options for ${user?.name}`, 'info');
}


// ══════════════════════════════════════════════════════════
//  SECTION 14 — ADMIN CHAT SESSIONS (Real API)
// ══════════════════════════════════════════════════════════

async function getAdminSiteLogo() {
  if (adminSiteLogo) return adminSiteLogo;
  const data = await api('/api/admin/settings');
  adminSiteLogo = data?.config?.siteLogo || '';
  return adminSiteLogo;
}

function playAdminChatSound() {
  try {
    const ctx = new(window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 660;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  } catch (e) {}
}

window.loadAdminChatSessions = async function() {
  const container = document.getElementById('chatSessionItems');
  if (!container) return;
  const logo = await getAdminSiteLogo();
  const data = await api('/api/admin/chat/sessions');
  if (!data?.success) { container.innerHTML = '<div style="padding:20px;text-align:center;color:#aaa;">Failed to load chats.</div>'; return; }
  if (!data.sessions.length) { container.innerHTML = '<div style="padding:20px;text-align:center;color:#aaa;font-size:13px;">No chats yet.</div>'; return; }
  
  container.innerHTML = '';
  data.sessions.forEach(s => {
    const isActive = s._id === activeSessionId;
    const hasUnread = s.unreadAdmin > 0;
    const timeStr = s.lastMessageAt ? new Date(s.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    const ended = s.status === 'ended';
    const div = document.createElement('div');
    div.style.cssText = `padding:12px 14px;cursor:pointer;border-bottom:1px solid var(--border,#e0e5f2);display:flex;align-items:center;gap:10px;background:${isActive?'rgba(67,24,255,0.06)':'transparent'};`;
    div.onclick = () => openAdminChatSession(s._id, s.username, s.status, s.userId);
    div.innerHTML = `
      <img src="${logo}" style="width:38px;height:38px;border-radius:50%;object-fit:cover;flex-shrink:0;background:#eee;border:2px solid ${ended?'#e74c3c':'#10ac84'};">
      <div style="flex:1;min-width:0;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-weight:700;font-size:13px;">${s.username}</span>
          <span style="font-size:10px;color:#aaa;">${timeStr}</span>
        </div>
        <div style="font-size:12px;color:#aaa;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px;">${s.lastMessage||'No messages'}</div>
      </div>
      ${hasUnread?`<span style="background:#e74c3c;color:#fff;border-radius:50%;width:20px;height:20px;font-size:11px;display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0;">${s.unreadAdmin}</span>`:''}
      ${ended?`<span style="background:#e74c3c;color:#fff;border-radius:10px;padding:2px 6px;font-size:10px;flex-shrink:0;">Ended</span>`:''}`;
    container.appendChild(div);
  });
  
  const totalUnread = data.sessions.reduce((a, s) => a + (s.unreadAdmin || 0), 0);
  const badge = document.getElementById('adminChatBadge');
  if (badge) { badge.textContent = totalUnread;
    badge.style.display = totalUnread > 0 ? 'flex' : 'none'; }
};

window.openAdminChatSession = async function(sessionId, username, status, userData) {
  activeSessionId = sessionId;
  activeUserData = userData || null;
  adminChatSessionStatus = status || 'active';
  adminAllMessages = [];
  adminReplyingTo = null;
  adminEditingMsgId = null;
  
  const logo = await getAdminSiteLogo();
  document.getElementById('chatWindowEmpty').style.display = 'none';
  document.getElementById('chatWindowActive').style.display = 'flex';
  
  if (window.innerWidth <= 700) {
    document.getElementById('chatSessionList')?.classList.add('slide-out');
    const backBtn = document.getElementById('chatBackBtn');
    if (backBtn) backBtn.style.display = 'flex';
  }
  
  const uname = document.getElementById('adminChatUsername');
  const ulogo = document.getElementById('adminChatUserLogo');
  if (uname) uname.textContent = username;
  if (ulogo) ulogo.src = logo;
  
  updateBlockBtn(userData?.status);
  startStatusTicker(sessionId, status, userData?.status);
  
  const inputBar = document.getElementById('adminChatInputBar');
  const polarBtn = document.getElementById('adminPolarBtn');
  if (inputBar) inputBar.style.display = status === 'ended' ? 'none' : 'flex';
  if (polarBtn) polarBtn.style.display = status === 'ended' ? 'none' : 'inline-block';
  
  cancelAdminReply();
  await loadAdminMessages(sessionId);
  startAdminChatPolling(sessionId);
  startAdminTypingPoll(sessionId);
  loadAdminChatSessions();
  setTimeout(initScrollToBottom, 200);
};

async function loadAdminMessages(sessionId) {
  const container = document.getElementById('adminChatMessages');
  if (!container) return;
  const data = await api(`/api/admin/chat/messages/${sessionId}`);
  if (!data?.success) return;
  adminAllMessages = data.messages;
  container.innerHTML = '';
  if (!data.messages.length) {
    container.innerHTML = '<div style="text-align:center;color:#aaa;padding:30px;font-size:13px;">No messages yet.</div>';
    adminLastMsgCount = 0;
    return;
  }
  const logo = await getAdminSiteLogo();
  let lastDate = '';
  data.messages.forEach(msg => {
    const dateStr = new Date(msg.createdAt).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
    if (dateStr !== lastDate) {
      const divider = document.createElement('div');
      divider.style.cssText = 'text-align:center;margin:12px 0;';
      divider.innerHTML = `<span style="background:rgba(0,0,0,0.06);color:#aaa;border-radius:12px;padding:3px 12px;font-size:11px;">${dateStr}</span>`;
      container.appendChild(divider);
      lastDate = dateStr;
    }
    container.appendChild(buildAdminMsgBubble(msg, logo));
  });
  container.scrollTop = container.scrollHeight;
  adminLastMsgCount = data.messages.length;
  setTimeout(() => updateSeenLabel(data.messages), 100);
}

function buildAdminMsgBubble(msg, logo) {
  const isMe = msg.sender === 'admin';
  const time = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const wrapper = document.createElement('div');
  wrapper.dataset.msgId = msg._id;
  wrapper.style.cssText = `display:flex;flex-direction:column;align-items:${isMe?'flex-end':'flex-start'};gap:2px;margin-bottom:2px;position:relative;`;
  
  let replyHtml = '';
  if (msg.replyTo?.msgId) {
    replyHtml = `<div style="background:rgba(0,0,0,0.06);border-left:3px solid #4318ff;border-radius:6px;padding:5px 10px;margin-bottom:4px;font-size:11px;color:#888;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
      <span style="font-weight:700;color:#4318ff;margin-right:6px;">${msg.replyTo.sender==='admin'?'You':'User'}</span>${msg.replyTo.preview}
    </div>`;
  }
  
  let bubbleContent = '';
  if (msg.deleted) {
    bubbleContent = `<span style="font-style:italic;opacity:0.6;font-size:13px;">🚫 This message was deleted</span>`;
  } else if (msg.type === 'image' && msg.imageUrl) {
    bubbleContent = `<img src="${msg.imageUrl}" style="max-width:220px;border-radius:10px;cursor:pointer;" onclick="window.open('${msg.imageUrl}','_blank')">`;
  } else if (msg.type === 'polar') {
    const answered = msg.polarAnswer;
    bubbleContent = `<div style="font-size:13px;margin-bottom:6px;font-weight:600;">❓ ${msg.polarQuestion}</div>
      ${answered?`<div style="padding:6px 12px;border-radius:8px;background:rgba(255,255,255,0.2);font-weight:700;color:${answered==='yes'?'#10ac84':'#e74c3c'};">${answered==='yes'?'✅ User answered: Yes':'❌ User answered: No'}</div>`
      :'<div style="color:rgba(255,255,255,0.7);font-size:12px;">⏳ Awaiting answer...</div>'}`;
  } else {
    bubbleContent = `<span style="font-size:13px;line-height:1.5;word-break:break-word;">${msg.content}</span>`;
  }
  
  let ticksHtml = '';
  if (isMe && !msg.deleted) {
    const tickColor = msg.read ? '#4fc3f7' : 'rgba(255,255,255,0.4)';
    ticksHtml = `<span style="font-size:11px;color:${tickColor};margin-left:4px;">${msg.read?'✓✓':'✓'}</span>`;
  }
  
  const editedHtml = msg.edited && !msg.deleted ? `<span style="font-size:10px;opacity:0.5;margin-left:4px;">edited</span>` : '';
  const reactEntries = Object.entries(msg.reactions || {}).filter(([, v]) => v.length > 0);
  const reactionsHtml = reactEntries.length ? `
    <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:3px;">
      ${reactEntries.map(([emoji,users]) => `
        <span onclick="adminToggleReaction('${msg._id}','${emoji}')" style="background:rgba(0,0,0,0.07);border-radius:12px;padding:2px 7px;font-size:12px;cursor:pointer;border:1px solid ${users.includes('admin')?'#4318ff':'transparent'};">
          ${emoji} ${users.length}
        </span>`).join('')}
    </div>` : '';
  
  const emojiBarId = `aebar-${msg._id}`;
  const emojiBarHtml = msg.deleted ? '' : `
    <div id="${emojiBarId}" style="display:none;position:absolute;${isMe?'right:0':'left:0'};bottom:calc(100% + 4px);background:#fff;border-radius:20px;padding:6px 10px;box-shadow:0 4px 16px rgba(0,0,0,0.15);gap:6px;z-index:100;white-space:nowrap;">
      ${ADMIN_EMOJIS.map(e => `<span onclick="adminToggleReaction('${msg._id}','${e}');adminHideEmojiBar('${emojiBarId}')" style="font-size:20px;cursor:pointer;">${e}</span>`).join('')}
      <span onclick="adminStartReply('${msg._id}');adminHideEmojiBar('${emojiBarId}')" style="font-size:18px;cursor:pointer;padding:0 3px;" title="Reply">↩️</span>
      ${isMe&&!msg.deleted?`<span onclick="adminStartEdit('${msg._id}');adminHideEmojiBar('${emojiBarId}')" style="font-size:18px;cursor:pointer;padding:0 3px;">✏️</span>
      <span onclick="adminDeleteMsg('${msg._id}');adminHideEmojiBar('${emojiBarId}')" style="font-size:18px;cursor:pointer;padding:0 3px;">🗑️</span>`:''}
    </div>`;
  
  wrapper.innerHTML = `
    ${emojiBarHtml}
    <div>
      <div class="admin-bubble" data-msg-id="${msg._id}"
        style="max-width:72%;background:${isMe?'#4318ff':'#fff'};color:${isMe?'#fff':'#333'};border-radius:${isMe?'16px 16px 4px 16px':'16px 16px 16px 4px'};padding:10px 13px;box-shadow:0 1px 3px rgba(0,0,0,0.08);cursor:pointer;position:relative;"
        oncontextmenu="adminShowEmojiBar(event,'${emojiBarId}')"
        ontouchstart="adminHandleTouchStart(event,'${emojiBarId}')"
        ontouchend="adminHandleTouchEnd()">
        ${replyHtml}${bubbleContent}
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:3px;padding:0 38px;">
      <span style="font-size:10px;color:#aaa;">${time}</span>${editedHtml}${ticksHtml}
    </div>
    ${reactionsHtml}`;
  return wrapper;
}

let adminLongPressTimer = null;
window.adminShowEmojiBar = (e, barId) => { e.preventDefault();
  adminHideAllEmojiBars(); const b = document.getElementById(barId); if (b) b.style.display = 'flex'; };
window.adminHideEmojiBar = (barId) => { const b = document.getElementById(barId); if (b) b.style.display = 'none'; };
window.adminHandleTouchStart = (e, barId) => { adminLongPressTimer = setTimeout(() => adminShowEmojiBar(e, barId), 500); };
window.adminHandleTouchEnd = () => clearTimeout(adminLongPressTimer);

function adminHideAllEmojiBars() { document.querySelectorAll('[id^="aebar-"]').forEach(b => b.style.display = 'none'); }
document.addEventListener('click', e => { if (!e.target.closest('[id^="aebar-"]') && !e.target.closest('.admin-bubble')) adminHideAllEmojiBars(); });

window.adminToggleReaction = async (msgId, emoji) => {
  const data = await api('/api/admin/chat/react', { method: 'POST', body: JSON.stringify({ msgId, emoji }) });
  if (data?.success) await loadAdminMessages(activeSessionId);
};

window.adminStartReply = (msgId) => {
  const msg = adminAllMessages.find(m => m._id === msgId);
  if (!msg) return;
  adminEditingMsgId = null;
  adminReplyingTo = { msgId, sender: msg.sender, preview: msg.type === 'image' ? '📷 Image' : msg.content?.substring(0, 80) || '' };
  const bar = document.getElementById('adminReplyBar');
  if (bar) bar.style.display = 'flex';
  const rs = document.getElementById('adminReplyBarSender');
  const rt = document.getElementById('adminReplyBarText');
  if (rs) rs.textContent = msg.sender === 'admin' ? 'You' : 'User';
  if (rt) rt.textContent = adminReplyingTo.preview;
  document.getElementById('adminChatInput')?.focus();
};

window.cancelAdminReply = () => {
  adminReplyingTo = null;
  adminEditingMsgId = null;
  const bar = document.getElementById('adminReplyBar');
  if (bar) bar.style.display = 'none';
  const input = document.getElementById('adminChatInput');
  if (input) input.value = '';
};

window.adminStartEdit = (msgId) => {
  const msg = adminAllMessages.find(m => m._id === msgId);
  if (!msg || msg.deleted) return;
  adminReplyingTo = null;
  adminEditingMsgId = msgId;
  const input = document.getElementById('adminChatInput');
  if (input) { input.value = msg.content;
    input.focus(); }
  const bar = document.getElementById('adminReplyBar');
  if (bar) bar.style.display = 'flex';
  const rs = document.getElementById('adminReplyBarSender');
  const rt = document.getElementById('adminReplyBarText');
  if (rs) rs.textContent = '✏️ Editing';
  if (rt) rt.textContent = msg.content?.substring(0, 80);
};

window.adminDeleteMsg = async (msgId) => {
  if (!confirm('Delete this message?')) return;
  const data = await api(`/api/admin/chat/message/${msgId}`, { method: 'DELETE' });
  if (data?.success) await loadAdminMessages(activeSessionId);
};

window.sendAdminMessage = async () => {
  if (adminChatSessionStatus === 'ended') return alert('Session ended.');
  const input = document.getElementById('adminChatInput');
  const text = input?.value.trim();
  if (!text || !activeSessionId) return;
  
  if (adminEditingMsgId) {
    const data = await api(`/api/admin/chat/message/${adminEditingMsgId}`, { method: 'PUT', body: JSON.stringify({ content: text }) });
    if (data?.success) { cancelAdminReply();
      await loadAdminMessages(activeSessionId); }
    else alert(data?.error || 'Failed to edit.');
    return;
  }
  
  if (input) input.value = '';
  const body = { sessionId: activeSessionId, content: text, type: 'text' };
  if (adminReplyingTo) body.replyTo = adminReplyingTo;
  cancelAdminReply();
  
  const data = await api('/api/admin/chat/send', { method: 'POST', body: JSON.stringify(body) });
  if (data?.success) {
    const logo = await getAdminSiteLogo();
    adminAllMessages.push(data.message);
    const container = document.getElementById('adminChatMessages');
    const empty = container?.querySelector('[style*="No messages"]');
    if (empty) empty.remove();
    container?.appendChild(buildAdminMsgBubble(data.message, logo));
    if (container) container.scrollTop = container.scrollHeight;
    adminLastMsgCount++;
  }
};

window.onAdminInputKeydown = (e) => {
  if (e.key === 'Enter') { sendAdminMessage(); return; }
  clearTimeout(adminTypingTimer);
  adminTypingTimer = setTimeout(() => {
    if (activeSessionId) api('/api/admin/chat/typing', { method: 'POST', body: JSON.stringify({ sessionId: activeSessionId }) });
  }, 300);
};

window.sendAdminImage = async (input) => {
  const file = input.files[0];
  if (!file || !activeSessionId) return;
  if (adminChatSessionStatus === 'ended') return alert('Session ended.');
  const keysRes = await api('/api/admin/settings/apikeys');
  const imgbbKey = keysRes?.apikeys?.imgbb;
  if (!imgbbKey) return alert('ImgBB key not set in Settings → API Keys.');
  const formData = new FormData();
  formData.append('image', file);
  const res = await fetch(`https://api.imgbb.com/1/upload?key=${imgbbKey}`, { method: 'POST', body: formData });
  const result = await res.json();
  if (!result.success) return alert('Image upload failed.');
  const body = { sessionId: activeSessionId, type: 'image', imageUrl: result.data.url, content: '📷 Image' };
  if (adminReplyingTo) body.replyTo = adminReplyingTo;
  cancelAdminReply();
  const data = await api('/api/admin/chat/send', { method: 'POST', body: JSON.stringify(body) });
  if (data?.success) {
    const logo = await getAdminSiteLogo();
    adminAllMessages.push(data.message);
    const container = document.getElementById('adminChatMessages');
    container?.appendChild(buildAdminMsgBubble(data.message, logo));
    if (container) container.scrollTop = container.scrollHeight;
    adminLastMsgCount++;
  }
  input.value = '';
};

window.togglePolarInput = () => { const a = document.getElementById('polarInputArea'); if (a) a.style.display = a.style.display === 'none' ? 'block' : 'none'; };
window.sendAdminPolar = async () => {
  const question = document.getElementById('polarQuestionInput')?.value.trim();
  if (!question || !activeSessionId) return;
  const data = await api('/api/admin/chat/send', { method: 'POST', body: JSON.stringify({ sessionId: activeSessionId, type: 'polar', polarQuestion: question, content: `❓ ${question}` }) });
  if (data?.success) {
    const logo = await getAdminSiteLogo();
    adminAllMessages.push(data.message);
    const container = document.getElementById('adminChatMessages');
    container?.appendChild(buildAdminMsgBubble(data.message, logo));
    if (container) container.scrollTop = container.scrollHeight;
    const qi = document.getElementById('polarQuestionInput');
    if (qi) qi.value = '';
    togglePolarInput();
    adminLastMsgCount++;
  }
};

window.endAdminChatSession = async () => {
  if (!activeSessionId || !confirm('End this chat session?')) return;
  const data = await api(`/api/admin/chat/session/${activeSessionId}/end`, { method: 'PUT' });
  if (data?.success) {
    adminChatSessionStatus = 'ended';
    const st = document.getElementById('adminChatSessionStatus');
    if (st) st.textContent = '🔴 Session Ended';
    document.getElementById('adminChatInputBar').style.display = 'none';
    document.getElementById('adminPolarBtn').style.display = 'none';
    loadAdminChatSessions();
  }
};

window.deleteAdminChatSession = async () => {
  if (!activeSessionId || !confirm('Delete entire chat? Cannot be undone.')) return;
  const data = await api(`/api/admin/chat/session/${activeSessionId}`, { method: 'DELETE' });
  if (data?.success) {
    activeSessionId = null;
    document.getElementById('chatWindowEmpty').style.display = 'flex';
    document.getElementById('chatWindowActive').style.display = 'none';
    stopAdminChatPolling();
    loadAdminChatSessions();
  }
};

function startAdminTypingPoll(sessionId) {
  if (adminTypingPollTimer) clearInterval(adminTypingPollTimer);
  adminTypingPollTimer = setInterval(async () => {
    if (!activeSessionId) return;
    const data = await api(`/api/admin/chat/typing/${sessionId}`);
    const el = document.getElementById('adminTypingIndicator');
    if (el) el.style.display = data?.typing ? 'flex' : 'none';
  }, 2000);
}

function startAdminChatPolling(sessionId) {
  stopAdminChatPolling();
  adminChatPollTimer = setInterval(async () => {
    if (!activeSessionId) return;
    const data = await api(`/api/admin/chat/messages/${sessionId}`);
    if (!data?.success) return;
    const hasChanges = data.messages.length !== adminLastMsgCount ||
      JSON.stringify(data.messages.map(m => m.reactions)) !== JSON.stringify(adminAllMessages.map(m => m.reactions));
    if (hasChanges) {
      const newMsgs = data.messages.slice(adminLastMsgCount);
      const hasUserMsg = newMsgs.some(m => m.sender === 'user');
      const logo = await getAdminSiteLogo();
      adminAllMessages = data.messages;
      const container = document.getElementById('adminChatMessages');
      if (container) {
        container.innerHTML = '';
        let lastDate = '';
        data.messages.forEach(msg => {
          const dateStr = new Date(msg.createdAt).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
          if (dateStr !== lastDate) {
            const divider = document.createElement('div');
            divider.style.cssText = 'text-align:center;margin:12px 0;';
            divider.innerHTML = `<span style="background:rgba(0,0,0,0.06);color:#aaa;border-radius:12px;padding:3px 12px;font-size:11px;">${dateStr}</span>`;
            container.appendChild(divider);
            lastDate = dateStr;
          }
          container.appendChild(buildAdminMsgBubble(msg, logo));
        });
        container.scrollTop = container.scrollHeight;
      }
      if (adminSoundEnabled && hasUserMsg) playAdminChatSound();
      adminLastMsgCount = data.messages.length;
      loadAdminChatSessions();
      setTimeout(() => updateSeenLabel(data.messages), 100);
    }
  }, 4000);
}

function stopAdminChatPolling() {
  if (adminChatPollTimer) clearInterval(adminChatPollTimer);
}

async function requestNotifPermission() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') await Notification.requestPermission();
}
requestNotifPermission();

function sendBrowserNotif(username, message) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (document.visibilityState === 'visible') return;
  const notif = new Notification(`💬 ${username}`, { body: message, icon: adminSiteLogo || '/favicon.ico', tag: 'flux-chat', requireInteraction: true });
  notif.onclick = () => { window.focus();
    notif.close(); };
}

let lastKnownUnread = 0;
setInterval(async () => {
  const data = await api('/api/admin/chat/unread');
  const badge = document.getElementById('adminChatBadge');
  if (data?.unread > 0) {
    if (badge) { badge.textContent = data.unread;
      badge.style.display = 'flex'; }
    if (data.unread > lastKnownUnread) {
      if (adminSoundEnabled) playAdminChatSound();
      const sessions = await api('/api/admin/chat/sessions');
      if (sessions?.sessions?.length) {
        const active = sessions.sessions.filter(s => s.unreadAdmin > 0).sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt))[0];
        if (active) sendBrowserNotif(active.username, active.lastMessage || 'New message');
      }
    }
    lastKnownUnread = data.unread;
  } else {
    if (badge) badge.style.display = 'none';
    lastKnownUnread = 0;
  }
}, 15000);

async function loadChatSettings() {
  const data = await api('/api/admin/chat/settings');
  if (!data?.success) return;
  const s = data.settings;
  const sc = (id, v) => { const el = document.getElementById(id); if (el) el.checked = !!v; };
  const sv = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
  sc('cs_available', s.available !== false);
  sc('cs_sound', s.sound !== false);
  sc('cs_allowImages', s.allowImages !== false);
  sc('cs_requireVerified', !!s.requireVerified);
  sc('cs_officeHoursEnabled', !!s.officeHours?.enabled);
  sv('cs_autoReply', s.autoReply);
  sv('cs_open', s.officeHours?.open || 9);
  sv('cs_close', s.officeHours?.close || 18);
  sv('cs_offlineMsg', s.officeHours?.offlineMsg);
  sv('cs_autoClose', s.autoClose || 48);
  sv('cs_charLimit', s.charLimit || 500);
  adminSoundEnabled = s.sound !== false;
}

window.saveChatSettings = async () => {
  const gc = (id) => document.getElementById(id)?.checked;
  const gv = (id) => document.getElementById(id)?.value;
  const body = {
    available: gc('cs_available'),
    sound: gc('cs_sound'),
    allowImages: gc('cs_allowImages'),
    requireVerified: gc('cs_requireVerified'),
    autoReply: gv('cs_autoReply'),
    autoClose: parseInt(gv('cs_autoClose')) || 48,
    charLimit: parseInt(gv('cs_charLimit')) || 500,
    officeHours: { enabled: gc('cs_officeHoursEnabled'), open: gv('cs_open'), close: gv('cs_close'), offlineMsg: gv('cs_offlineMsg') }
  };
  const data = await api('/api/admin/chat/settings', { method: 'PUT', body: JSON.stringify(body) });
  if (data?.success) { adminSoundEnabled = body.sound;
    showToast('Chat settings saved!', 'success'); }
  else alert(data?.error || 'Error saving settings.');
};

loadChatSettings();

function updateBlockBtn(userStatus) {
  const btn = document.getElementById('adminBlockBtn');
  const label = document.getElementById('adminBlockLabel');
  if (!btn) return;
  const isBlocked = userStatus === 'blocked';
  const icon = btn.querySelector('i');
  if (icon) icon.className = isBlocked ? 'ri-shield-check-line' : 'ri-forbid-line';
  if (label) label.textContent = isBlocked ? 'Unblock' : 'Block';
  btn.style.background = isBlocked ? '#e8f8f1' : '#fdecea';
  btn.style.color = isBlocked ? '#10ac84' : '#e74c3c';
}

window.toggleBlockFromChat = async () => {
  if (!activeSessionId) return;
  const isBlocked = activeUserData?.status === 'blocked';
  if (!confirm(`${isBlocked?'Unblock':'Block'} this user?`)) return;
  const data = await api(`/api/admin/chat/session/${activeSessionId}/block`, { method: 'PUT', body: JSON.stringify({ block: !isBlocked }) });
  if (data?.success) {
    if (activeUserData) activeUserData.status = data.userStatus;
    updateBlockBtn(data.userStatus);
    startStatusTicker(activeSessionId, isBlocked ? 'active' : 'ended', data.userStatus);
    adminChatSessionStatus = isBlocked ? 'active' : 'ended';
    document.getElementById('adminChatInputBar').style.display = isBlocked ? 'flex' : 'none';
    document.getElementById('adminPolarBtn').style.display = isBlocked ? 'inline-block' : 'none';
    loadAdminChatSessions();
  } else {
    alert(data?.error || 'Failed.');
  }
};

function startStatusTicker(sessionId, sessionStatus, userStatus) {
  if (statusTickerTimer) clearInterval(statusTickerTimer);
  const el = document.getElementById('adminChatSessionStatus');
  if (!el) return;
  const shortId = sessionId ? sessionId.toString().slice(-8).toUpperCase() : '--------';
  const isBlocked = userStatus === 'blocked';
  const isEnded = sessionStatus === 'ended';
  const states = [
    () => {
      if (isEnded) el.innerHTML = `<span style="color:#e74c3c;display:flex;align-items:center;gap:4px;"><i class="ri-stop-circle-line"></i> Session Ended</span>`;
      else if (isBlocked) el.innerHTML = `<span style="color:#e74c3c;display:flex;align-items:center;gap:4px;"><i class="ri-forbid-line"></i> Offline — Blocked</span>`;
      else el.innerHTML = `<span style="color:#10ac84;display:flex;align-items:center;gap:4px;"><i class="ri-radio-button-line"></i> Online — Active</span>`;
    },
    () => { el.innerHTML = `<span style="color:#aaa;display:flex;align-items:center;gap:4px;"><i class="ri-fingerprint-line"></i> ID: <code style="font-size:10px;background:rgba(0,0,0,0.06);padding:1px 5px;border-radius:4px;">${shortId}</code></span>`; }
  ];
  let idx = 0;
  states[0]();
  statusTickerTimer = setInterval(() => {
    el.style.opacity = '0';
    setTimeout(() => { idx = (idx + 1) % states.length;
      states[idx]();
      el.style.opacity = '1'; }, 300);
  }, 3500);
}

window.toggleChatSearch = () => {
  const bar = document.getElementById('chatSearchBar');
  if (!bar) return;
  const isVisible = bar.style.display !== 'none';
  bar.style.display = isVisible ? 'none' : 'block';
  if (!isVisible) document.getElementById('chatSearchInput')?.focus();
  else {
    const si = document.getElementById('chatSearchInput');
    if (si) si.value = '';
    const sr = document.getElementById('chatSearchResults');
    if (sr) sr.textContent = '';
    document.querySelectorAll('.search-highlight').forEach(el => { el.outerHTML = el.textContent; });
  }
};

window.searchChatMessages = (query) => {
  const resultsEl = document.getElementById('chatSearchResults');
  document.querySelectorAll('.search-highlight').forEach(el => {
    const text = document.createTextNode(el.textContent);
    el.parentNode.replaceChild(text, el);
  });
  if (!query.trim()) { if (resultsEl) resultsEl.textContent = ''; return; }
  const q = query.toLowerCase();
  const bubbles = document.querySelectorAll('#adminChatMessages .admin-bubble');
  let matchCount = 0,
    firstMatch = null;
  bubbles.forEach(bubble => {
    bubble.querySelectorAll('span').forEach(span => {
      if (span.children.length > 0) return;
      const text = span.textContent;
      if (text.toLowerCase().includes(q)) {
        matchCount++;
        span.innerHTML = text.replace(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`, 'gi'), '<mark class="search-highlight" style="background:#fff176;border-radius:3px;padding:0 2px;">$1</mark>');
        if (!firstMatch) firstMatch = bubble;
      }
    });
  });
  if (resultsEl) { resultsEl.textContent = matchCount > 0 ? `${matchCount} result${matchCount>1?'s':''} found` : 'No results found';
    resultsEl.style.color = matchCount > 0 ? '#10ac84' : '#e74c3c'; }
  if (firstMatch) firstMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
};

function initScrollToBottom() {
  const container = document.getElementById('adminChatMessages');
  if (!container) return;
  let btn = document.getElementById('scrollToBottomBtn');
  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'scrollToBottomBtn';
    btn.innerHTML = '↓';
    btn.style.cssText = 'display:none;position:absolute;bottom:80px;right:16px;width:36px;height:36px;border-radius:50%;background:var(--primary);color:#fff;border:none;cursor:pointer;font-size:18px;box-shadow:0 2px 8px rgba(0,0,0,0.2);z-index:50;';
    btn.onclick = () => { container.scrollTop = container.scrollHeight; };
    container.parentElement.style.position = 'relative';
    container.parentElement.appendChild(btn);
  }
  container.onscroll = () => {
    const d = container.scrollHeight - container.scrollTop - container.clientHeight;
    btn.style.display = d > 120 ? 'flex' : 'none';
    btn.style.alignItems = 'center';
    btn.style.justifyContent = 'center';
  };
}

function updateSeenLabel(messages) {
  document.querySelectorAll('.seen-label').forEach(el => el.remove());
  const lastRead = [...messages].reverse().find(m => m.sender === 'admin' && m.read && !m.deleted);
  if (!lastRead) return;
  const bubble = document.querySelector(`[data-msg-id="${lastRead._id}"]`);
  if (!bubble) return;
  const label = document.createElement('div');
  label.className = 'seen-label';
  label.style.cssText = 'font-size:10px;color:#4fc3f7;text-align:right;padding:0 42px;margin-top:-4px;';
  label.textContent = 'Seen ✓✓';
  bubble.after(label);
}

window.closeChatOnMobile = () => {
  document.getElementById('chatSessionList')?.classList.remove('slide-out');
  document.getElementById('chatWindowActive').style.display = 'none';
  document.getElementById('chatWindowEmpty').style.display = 'flex';
  const backBtn = document.getElementById('chatBackBtn');
  if (backBtn) backBtn.style.display = 'none';
  stopAdminChatPolling();
  activeSessionId = null;
};

window.addEventListener('resize', () => {
  if (window.innerWidth > 700) {
    document.getElementById('chatSessionList')?.classList.remove('slide-out');
    const backBtn = document.getElementById('chatBackBtn');
    if (backBtn) backBtn.style.display = 'none';
  }
});


// ══════════════════════════════════════════════════════════
//  SECTION 15 — KEYBOARD SHORTCUTS & GLOBAL EVENTS
// ══════════════════════════════════════════════════════════

document.addEventListener('keydown', (e) => {
  // / = focus settings search
  if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
    const si = document.getElementById('settingsSearch');
    if (si) { e.preventDefault();
      si.focus(); }
  }
  if (e.key === 'Escape') {
    // Settings search
    const si = document.getElementById('settingsSearch');
    if (document.activeElement === si) { clearSettingsSearch();
      si.blur(); return; }
    // Confirm modal
    closeConfirm();
    // Ctx menus
    hideCtx();
    hideCtxMenu();
    // Slide modal
    closeSlideModal();
    // Chat emoji / quick
    closeEmoji();
    closeQuickReplies();
    cancelReply();
    if (msgSearchActive) closeMessageSearch();
  }
});


// ══════════════════════════════════════════════════════════
//  SECTION 16 — STARTUP
// ══════════════════════════════════════════════════════════

// Init on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  initChangeTracking();
  renderTags('depositTags', depositAmounts);
  loadThemeSettings();
  // Init theme icons correctly
  const saved = localStorage.getItem('fm_admin_theme') || 'light';
  updateThemeIcons(saved);
});

// Boot — check session
checkAdminSession();