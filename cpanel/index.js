// ============================================================
// FLUXMALL ADMIN PANEL — Unified Script
// Single source of truth. No duplicate

// ══════════════════════════════════════════════════════════
//  SECTION 1 — GLOBAL STATE & CONSTANTS
// ══════════════════════════════════════════════════════════
let allData = []; // deposits raw data
let allUsers = []; // users raw data from API
let flashInterval = null;
let originalTitle = document.title;

// ── User Management Table ──────────────────────────────────
const COLORS = ['#4CAF7D', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899',
  '#14b8a6', '#f97316', '#ef4444', '#22c55e', '#6366f1', '#4318ff', '#05cd99', '#ee5d50', '#f6ad55', '#4299e1', '#9f7aea', '#ed64a6', '#38b2ac', '#4318ff', '#05cd99', '#ee5d50', '#f6ad55', '#4299e1', '#9f7aea', '#ed64a6', '#38b2ac'
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

//for chat frature



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
      showToast('⚠️ ImgBB API key not set. Go to Settings → API Keys and save your ImgBB key first.', 'error');
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
      showToast('❌ ImgBB upload failed. Check your API key in Settings → API Keys.', 'error');
      return null;
    }
  } catch (err) {
    if (statusEl) statusEl.innerHTML = '';
    showToast('❌ Upload error: ' + err.message, 'error');
    return null;
  }
}

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

const menuBar = document.querySelectorAll('.menu-bar');
const sideBar = document.querySelector('.sidebar');

if (menuBar && sideBar) {
  menuBar.forEach((btn) => {
    btn.addEventListener('click', () => sideBar.classList.toggle('close'));
    
  })
}

// 1. Initial Check on Page Load
const handleSidebarResponsive = () => {
  if (window.innerWidth >= 768) {
    sideBar?.classList.remove('close'); // Always open on laptops
  } else {
    // sideBar?.classList.add('close');    // Always closed on mobile initially
    sideBar?.classList.remove('close'); // Always open on laptops
    
  }
};

// Run on load
handleSidebarResponsive();

// 2. Handle the Window Resize
window.addEventListener('resize', handleSidebarResponsive);

// 3. Handle Sidebar Interaction (Mobile Only)
if (sideBar) {
  sideBar.addEventListener('click', (e) => {
    if (window.innerWidth < 768) {
      sideBar.classList.remove('close');
      e.stopPropagation(); // Prevents the 'click outside' logic from firing immediately
    }
  });
}
/*Potentially disabled by admin
// 4. Close when clicking anywhere else (Mobile Only)
document.addEventListener('click', (e) => {
  if (window.innerWidth < 768) {
    // If click is NOT on sidebar and NOT on the toggle button, close it
    if (!sideBar.contains(e.target) && !toggler.contains(e.target)) {
      sideBar.classList.add('close');
    }
  }
});
*/
const allPages = document.querySelectorAll('.page');

// 1. Select all elements with the .page class
let lastScrollTop = 0;
const threshold = 15;

allPages.forEach(page => {
  page.addEventListener('scroll', () => {
    const currentScroll = page.scrollTop;
    
    // Accuracy Check: Ignore tiny jitters
    if (Math.abs(currentScroll - lastScrollTop) < threshold) return;
    
    // FIXED LOGIC:
    // Scroll DOWN -> HIDE
    // Scroll UP -> SHOW
    if (window.innerWidth < 768) {
      
      if (currentScroll > lastScrollTop) {
        sideBar?.classList.add('hide-scroll');
      } else {
        sideBar?.classList.remove('hide-scroll');
      }
    }
    // Update position - ensures it stays positive
    lastScrollTop = currentScroll <= 0 ? 0 : currentScroll;
  }, { passive: true });
});


// Theme toggle (header button)
const toggler = document.getElementById('theme-toggle');

if (toggler) {
  toggler.addEventListener('click', function() {
    // Toggle the dark class on the body
    const isDark = document.body.classList.toggle('dark');
    
    if (isDark) {
      setTheme('dark');
      // Update icon to "Sun" so user knows clicking it leads back to light mode
      this.innerHTML = '<i class="ri-sun-line"></i>';
    } else {
      setTheme('light');
      // Update icon to "Moon" for dark mode
      this.innerHTML = '<i class="ri-moon-line"></i>';
    }
  });
}

// ── Hash-based page switching ──────────────────────────────
const navItems = document.querySelectorAll('.nav-item');

function switchPageByHash() {
  const hash = window.location.hash || '#dashboard';
  //checkAdminSession()
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
 // if (targetId === 'chats') initChatPage();
  if (targetId === 'shares') refreshAll();
  if (targetId === 'tasks') refreshAll();
  
}

window.addEventListener('DOMContentLoaded', switchPageByHash);
window.addEventListener('hashchange', switchPageByHash);


// ══════════════════════════════════════════════════════════
//  SECTION 4 — AUTH
// ══════════════════════════════════════════════════════════

async function checkAdminSession() {
  const res = await fetch('/api/admin/me', { credentials: 'include' });
  const data = await res.json().catch(() => null);
  if (res.ok && data) {
    const adminName = data.user?.username || data.user?.email || data.username || data.email;
    console.log(`%c[FluxMall] 👋 Logged in as: ${adminName}`, 'color:#4318ff;font-weight:700;font-size:14px;');
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
    const adminName = data.user?.username || data.user?.email || data.username || data.email || 'Admin';
    console.log(`%c[FluxMall] ✅ Admin login: ${adminName}`, 'color:#05cd99;font-weight:700;font-size:14px;');
    window.location.hash = '#dashboard';
    initDashboard();
  } else {
    showToast(data?.error || 'Login failed.', 'error');
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
  loadThemeSettings();
  await Promise.all([
    loadAnalytics(),
    renderApiUsers(),
    loadWithdrawals(),
    loadSettings(),
  ]);
  loadAdminChatSessions();
  //  setupCharts();
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

function setupCharts() {
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
window.loadAnalytics = async () => {
  const data = await api('/api/admin/analytics');
  console.log(data)
  //  if (!data?.success) return;
  
  const s = data.stats;
  
  document.getElementById('statTotal').innerText = `₦${(s.successV || 0).toLocaleString()}`;
  document.getElementById('statPending').innerText = `₦${(s.pendingV || 0).toLocaleString()}`;
  document.getElementById('statUsers').innerText = s.totalUsers || 0;
  
  const tbody = document.getElementById('analyticsTableBody');
  if (tbody) {
    tbody.innerHTML = `
      <tr><td>Successful</td><td></td><td>${s.sCount}</td><td>₦${(s.successV).toLocaleString()}</td></tr>
      <tr><td>Pending</td><td></td><td>${s.pCount}</td><td>₦${(s.pendingV).toLocaleString()}</td></tr>
      <tr><td>Declined</td><td></td><td>${s.dCount}</td><td>--</td></tr>`;
  }
  
  if (pieChart) {
    pieChart.data.datasets[0].data = [s.sCount, s.pCount, s.dCount];
    pieChart.update();
  }
  if (barChart) {
    barChart.data.datasets[0].data = [s.successV, s.withdrawSuccessV];
    barChart.update();
  }
  
  //  allData = data.deposits;
  setupCharts();
  renderDepositsPage()
}

loadAnalytics();


function renderDepositsPage() {
  const tbody = document.getElementById('depositTableBody');
  if (!tbody) return;
  if (!_dFiltered.length) {
    setEmpty('depositTableBody', 6, 'No deposits found');
    hidePagination('deposit');
    return;
  }
  
  const slice = paginate(_dFiltered, dPage, PER_PAGE);
  tbody.innerHTML = slice.map(i => {
    const date = i.createdAt ? new Date(i.createdAt).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Now';
    const userId = i.userId?._id || i.userId || '';
    const userName = i.userId?.username || userId.toString().substring(0, 8);
    const ref = (i.refCode || '').substring(0, 10);
    const fex = Number(i.amount);
    const naira = (fex * 0.7).toLocaleString('en-NG', { minimumFractionDigits: 2 });
    
    return `<tr>
      <td>
        <div class="user-chip">
          <div class="avatar" style="background:${avatarColor(userName)}">${initials(userName)}</div>
          <div>
            <div class="username">${userName}</div>
            <div class="user-id">${userId.toString().substring(0,8)}…</div>
          </div>
        </div>
      </td>
      <td>
        <div class="amt-fex">🪙 ${fex.toLocaleString()}</div>
        <div class="amt-naira">≈ ₦${naira}</div>
      </td>
      <td><code style="font-size:11px;color:var(--text3);">${ref}…</code></td>
      <td style="white-space:nowrap;font-size:12px;color:var(--text3);">${date}</td>
      <td>${statusBadge(i.status)}</td>
      <td>
        <div class="action-group">
          ${i.status === 'pending' ? `
            <button class="btn btn-success btn-sm" onclick="approveDeposit('${i._id}','${userId}','${i.amount}','${userName}')">
              <i class="ri-check-line"></i> Approve
            </button>
            <button class="btn btn-danger btn-sm" onclick="declineDeposit('${i._id}')">
              <i class="ri-close-line"></i>
            </button>
          ` : `
            <button class="btn btn-ghost btn-sm" onclick="viewDepositDetail(${JSON.stringify(i).replace(/"/g,'&quot;')})">
              <i class="ri-eye-line"></i>
            </button>
            <button class="btn btn-danger btn-sm" onclick="deleteDeposit('${i._id}')">
              <i class="ri-delete-bin-line"></i>
            </button>
          `}
        </div>
      </td>
    </tr>`;
  }).join('');
  
  renderPagination('deposit', _dFiltered.length, dPage, (p) => {
    dPage = p;
    renderDepositsPage();
  });
}

window.approveDeposit = async (id, userId, amount, username) => {
  showConfirm({
    title: 'Approve this Deposit?',
    msg: 'Approve deposit.Are you certain of this action?',
    type: 'warning',
    yesLabel: 'Approve',
    onYes: async () => {
      const data = await api(`/api/admin/deposits/${id}`, { method: 'PUT', body: JSON.stringify({ status: 'success' }) });
      if (data?.success) {
        showToast('Deposit approved — user credited!', 'success');
        loadDeposits();
      } else {
        showToast(data?.error || 'Error approving deposit.', 'error');
      }
    },
  });
};

window.declineDeposit = async (id) => {
  showConfirm({
    title: 'Decline Deposit?',
    msg: 'Decline this deposit? The user will not be credited.',
    type: 'danger',
    yesLabel: 'Decline',
    onYes: async () => {
      const data = await api(`/api/admin/deposits/${id}`, { method: 'PUT', body: JSON.stringify({ status: 'declined' }) });
      if (data?.success) loadDeposits();
      else showToast(data?.error || 'Error.', 'error');
    }
  });
};

window.deleteDeposit = async (id) => {
  showConfirm({
    title: 'Delete Deposit?',
    msg: 'Delete this deposit record permanently?',
    type: 'danger',
    yesLabel: 'Delete',
    onYes: async () => {
      await api(`/api/admin/deposits/${id}`, { method: 'DELETE' });
      loadAnalytics();
    }
  });
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
  if (!data?.success) {
    showToast('Error updating ban status.', 'error');
    renderApiUsers();
  }
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
  showConfirm({
    title: 'Approve this Deposit?',
    msg: 'Approve deposit.Are you certain of this action?',
    type: 'warning',
    yesLabel: 'Approve',
    onYes: async () => {
      const data = await api(`/api/admin/deposits/${id}`, { method: 'PUT', body: JSON.stringify({ status: 'success' }) });
      if (data?.success) {
        showToast('Deposit approved — user credited!', 'success');
        loadDeposits();
      } else {
        showToast(data?.error || 'Error approving deposit.', 'error');
      }
    },
  });
  
  
  showConfirm({
    title: `User: ${name}`,
    msg: `
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
      <input type="hidden" id="crUserId" value="${uid}">
      <button class="btn-submit" onclick= "processAdjustment('credit')">Credit</button>
      <button class="btn-sec" onclick= "processAdjustment('debit')">Debit</button>
      <button class="btn-danger" onclick="deleteUser('${uid}')">Delete user</button>`,
    onYes: async () => {},
    icon: false
  });
};

window.processAdjustment = async (action) => {
  const uid = document.getElementById('crUserId')?.value.trim();
  const amount = Number(document.getElementById('crAmount')?.value);
  if (!uid || !amount) return showToast('Please enter a User ID and Amount.', 'error');
  const data = await api('/api/admin/users/adjust-balance', {
    method: 'POST',
    body: JSON.stringify({ userId: uid, amount, action })
  });
  if (data?.success) {
    showToast(`✅ ${action} of ₦${amount.toLocaleString()} successful! New balance: ₦${data.newBalance.toLocaleString()}`, 'success');
    document.getElementById('userDetailModal')?.remove();
    renderApiUsers();
  } else {
    showToast(data?.error || 'Error processing adjustment.', 'error');
  }
};

window.deleteUser = async (uid) => {
  showConfirm({
    title: 'Delete Account?',
    msg: '⚠️ This action will Permanently delete this user account and all thier data!!',
    type: 'danger',
    yesLabel: 'Delete',
    onYes: async () => {
      await api(`/api/admin/users/${uid}`, { method: 'DELETE' });
      renderApiUsers();
    }
  });
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
  if (si) {
    si.value = '';
    document.getElementById('searchClear')?.classList.remove('vis');
  }
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
  else {
    sortCol = col;
    sortDir = -1;
  }
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

function clearSelection() {
  selected.clear();
  updateBulkBar();
  renderTable();
}

// ── Detail Pane ────────────────────────────────────────────
function openDetail(id) {
  const u = UM_USERS.find(x => x.id === id);
  if (!u) return;
  activeUserId = id;
  
  const dp = document.getElementById('detailPane');
  if (dp) {
    dp.classList.remove('hidden');
    dp.classList.add('mobile-open');
  }
  
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
    <button class="dp-action danger" onclick="confirmBan('${u.id}')"><i class="ri-forbid-line"></i> ${u.status==='banned'?'Unban User':'Ban User'}</button>
    <button class="dp-action danger" onclick="confirmDelete('${u.id}')"><i class="ri-delete-bin-line"></i> Delete Account</button>`;
  
  renderTable();
}

function closeDetail() {
  activeUserId = null;
  const dp = document.getElementById('detailPane');
  if (dp) {
    dp.classList.add('hidden');
    dp.classList.remove('mobile-open');
  }
  renderTable();
}

// ── User Modals ────────────────────────────────────────────
function openAddUser() {
  showConfirm({
    title: 'Add New User',
    msg: `    <div class="form-row">
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
  `,
    type: 'green',
    yesLabel: 'Create user',
    onYes: async () => {
      const fn = document.getElementById('m-fname')?.value.trim();
      const ln = document.getElementById('m-lname')?.value.trim();
      const email = document.getElementById('m-email')?.value.trim();
      const pass = document.getElementById('m-pass')?.value;
      if (!fn || !ln || !email || !pass) { showToast('Please fill all required fields', 'error'); return; }
      
      api('/api/admin/create-user', {
        method: 'POST',
        body: JSON.stringify({
          username: `${fn}${ln}`.toLowerCase().replace(/\s+/g, ''),
          email,
          password: pass,
          role: 'user',
          initBal: parseInt(document.getElementById('m-balance')?.value) || 0
        })
      }).then(data => {
        if (data?.success) {
          showToast(`${fn} ${ln} added successfully`, 'success');
          // Reload from API to get real _id
          loadUMUsers();
        } else {
          showToast(data?.error || 'Failed to create user.', 'error');
        }
      });
    },
    icon: false
  });
}

function openEditModal(id) {
  const u = UM_USERS.find(x => x.id === id);
  if (!u) return;
  showConfirm({
    title: 'Edit User',
    msg: `
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
    </div>`,
    type: 'warning',
    yesLabel: 'Save changes',
    onYes: async () => {
      
      const u = UM_USERS.find(x => x.id === id);
      if (!u) return;
      const name = document.getElementById('e-name')?.value.trim() || u.name;
      const email = document.getElementById('e-email')?.value.trim() || u.email;
      const phone = document.getElementById('e-phone')?.value.trim() || u.phone;
      const status = document.getElementById('e-status')?.value;
      const active = document.getElementById('e-active')?.value === '1';
      const apiStatus = status === 'banned' ? 'Banned' : 'Active';
      api(`/api/admin/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          username: name,
          email,
          phone,
          status: apiStatus,
          emailVerified: status === 'verified'
        })
      }).then(data => {
        if (data?.success) {
          u.name = name;
          u.email = email;
          u.phone = phone;
          u.status = status;
          u.active = active;
          updateUMStats();
          applyFilters();
          if (activeUserId === id) openDetail(id);
          showToast('User updated', 'success');
        } else {
          showToast(data?.error || 'Failed to update user.', 'error');
        }
      });
    },
    icon: false
    
  });
}

function openCreditModal(id) {
  const u = UM_USERS.find(x => x.id === id);
  if (!u) return;
  showConfirm({
    title: `Adjust Balance<br><div class="modal-sub">Current balance: <strong style="color:var(--gl)">₦${u.balance.toLocaleString()}</strong></div>`,
    msg: ` <div class="form-group"><label class="form-label">Action</label>
      <select class="form-input" id="c-type">
        <option value="credit">Credit (Add)</option>
        <option value="debit">Debit (Subtract)</option>
        <option value="set">Set Balance</option>
      </select>
    </div>
    <div class="form-group"><label class="form-label">Amount (₦)</label><input class="form-input" id="c-amount" type="number" min="0" placeholder="0"></div>
    <div class="form-group"><label class="form-label">Reason / Note</label><input class="form-input" id="c-note" placeholder="e.g. Manual adjustment..."></div>`,
    type: 'warning',
    yesLabel: 'Apply',
    onYes: async () => {
      const u = UM_USERS.find(x => x.id === id);
      if (!u) return;
      const type = document.getElementById('c-type')?.value;
      const amt = parseInt(document.getElementById('c-amount')?.value) || 0;
      if (amt <= 0 && type !== 'set') { showToast('Enter a valid amount', 'error'); return; }
      
      // Map UI type to API action
      const action = type === 'credit' ? 'credit' : type === 'debit' ? 'debit' : 'set';
      
      await api('/api/admin/users/adjust-balance', {
        method: 'POST',
        body: JSON.stringify({ userId: id, amount: amt, action })
      }).then(data => {
        if (data?.success) {
          u.balance = data.newBalance ?? (
            type === 'credit' ? u.balance + amt :
            type === 'debit' ? Math.max(0, u.balance - amt) :
            amt
          );
          updateUMStats();
          applyFilters();
          if (activeUserId === id) openDetail(id);
          showToast(
            `Balance ${type === 'credit' ? 'credited' : type === 'debit' ? 'debited' : 'set'} — ₦${u.balance.toLocaleString()}`,
            'success'
          );
        } else {
          showToast(data?.error || 'Error adjusting balance.', 'error');
        }
      });
    },
    icon: false
  });
}


function sendMessageModal(id) {
  const u = UM_USERS.find(x => x.id === id);
  if (!u) return;
  showConfirm({
    title: "Send Message",
    msg: `
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
    </div>`,
    type: "warning",
    yesLabel: "Send Notification",
    onYes: () => {
      const u = UM_USERS.find(x => x.id === id);
      if (!u) return;
      const body = document.getElementById('msg-body')?.value.trim();
      if (!body) { showToast('Message cannot be empty', 'error'); return; }
      api(`/api/admin/users/${id}/notify`, {
        method: 'POST',
        body: JSON.stringify({
          title: document.getElementById('msg-title')?.value.trim() || 'Admin Message',
          message: body,
          type: document.getElementById('msg-type')?.value || 'info'
        })
      }).then(data => {
        if (data?.success) {
          showToast(`Message sent to ${u.name}`, 'success');
        } else {
          // Endpoint may not exist yet — still close and notify
          showToast(`Message queued for ${u.name}`, 'info');
        }
      });
    },
    icon: false
  });
}


function confirmBan(id) {
  const u = UM_USERS.find(x => x.id === id);
  if (!u) return;
  const isBanned = u.status === 'banned';
  showConfirm({
    title: `${isBanned?'Unban':'Ban'} User`,
    msg: `<div class="modal-sub">${isBanned?`Remove ban from <strong>${u.name}</strong>?`:`Ban <strong>${u.name}</strong>? They will lose all access immediately.`}</div>
      ${!isBanned?`<div class="form-group"><label class="form-label">Reason for Ban</label><input class="form-input" id="ban-reason" placeholder="e.g. Fraudulent activity..."></div>`:''}`,
    type: 'danger',
    yesLabel: `${isBanned?'Unban User':'Confirm Ban'}`,
    onYes: async () => {
      const u = UM_USERS.find(x => x.id === id);
      if (!u) return;
      const newStatus = u.status === 'banned' ? 'Active' : 'Banned';
      const reason = document.getElementById('ban-reason')?.value || '';
      
      await api(`/api/admin/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus, banReason: reason })
      }).then(data => {
        if (data?.success) {
          u.status = newStatus === 'Banned' ? 'banned' : 'unverified';
          updateUMStats();
          applyFilters();
          if (activeUserId === id) openDetail(id);
          showToast(`${u.name} ${u.status === 'banned' ? 'banned' : 'unbanned'}`, 'info');
        } else {
          showToast(data?.error || 'Failed to update ban status.', 'error');
        }
      });
    }
  });
}

function confirmDelete(id) {
  const u = UM_USERS.find(x => x.id === id);
  if (!u) return;
  
  showConfirm({
    title: `Delete Account`,
    msg: ` <div class="modal-sub">This will permanently delete <strong>${u.name}</strong>'s account. <strong>Cannot be undone.</strong></div>
    <div class="form-group"><label class="form-label">Type "DELETE" to confirm</label><input class="form-input" id="del-confirm" placeholder="DELETE"></div>`,
    type: 'danger',
    yesLabel: `Delete Permanently`,
    onYes: async () => {
      if (document.getElementById('del-confirm')?.value !== 'DELETE') {
        showToast('Type DELETE to confirm', 'error');
        return;
      }
      api(`/api/admin/users/${id}`, { method: 'DELETE' }).then(data => {
        if (data?.success) {
          const u = UM_USERS.find(x => x.id === id);
          UM_USERS = UM_USERS.filter(x => x.id !== id);
          /*   if (activeUserId === id) closeDetail();*/
          selected.delete(id);
          updateUMStats();
          applyFilters();
          showToast(`${u?.name || 'User'} deleted`, 'info');
        } else {
          showToast(data?.error || 'Failed to delete user.', 'error');
        }
      });
    }
  });
}




// ── Bulk Actions ───────────────────────────────────────────
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
  const ids = [...selected];
  Promise.all(
    ids.map(id => api(`/api/admin/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'Banned' })
    }))
  ).then(() => {
    ids.forEach(id => { const u = UM_USERS.find(x => x.id === id); if (u) u.status = 'banned'; });
    clearSelection();
    closeModal();
    updateUMStats();
    applyFilters();
    showToast('Selected users banned', 'info');
  });
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
  if (document.getElementById('bd-confirm')?.value !== 'DELETE') {
    showToast('Type DELETE to confirm', 'error');
    return;
  }
  const ids = [...selected];
  const count = ids.length;
  Promise.all(
    ids.map(id => api(`/api/admin/users/${id}`, { method: 'DELETE' }))
  ).then(() => {
    UM_USERS = UM_USERS.filter(u => !selected.has(u.id));
    clearSelection();
    closeModal();
    updateUMStats();
    applyFilters();
    showToast(`${count} users deleted`, 'info');
  });
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
    message: () => sendMessageModal(ctxUserId),
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
const mToggle = document.getElementById('tgl-maintenance');

mToggle.onchange = async (e) => {
  const enabled = e.target.checked;
  
  // Helper function to handle the actual API call and UI sync
  const updateMaintenance = async (status) => {
    try {
      await api('/api/admin/settings/maintenance', {
        method: 'PUT',
        body: JSON.stringify({ enabled: status })
      });
      
      if (typeof syncMaintUI === 'function') syncMaintUI(status);
      
      showToast(
        status ? '⚠️ Maintenance mode ON' : 'Maintenance mode OFF',
        status ? 'error' : 'success'
      );
    } catch (err) {
      // If API fails, revert the checkbox state
      e.target.checked = !status;
      showToast('Action failed', 'error');
    }
  };
  
  if (enabled) {
    // 1. If checking ON: Show the warning modal
    showConfirm({
      title: 'Enable Maintenance Mode?',
      msg: 'All users will be locked out immediately. Only admins can log in during this time.',
      type: 'danger',
      yesLabel: 'Enable Maintenance',
      onYes: () => updateMaintenance(true),
      onCancel: () => {
        // Revert toggle if they click cancel
        e.target.checked = false;
      }
    });
  } else {
    // 2. If checking OFF: Just do it immediately without warning
    await updateMaintenance(false);
  }
};

async function loadSettings() {
  try {
    await loadApiKeys();
    const data = await api('/api/admin/settings');
    if (!data?.success) { console.error('Failed to fetch settings:', data?.message); return; }
    const s = data.settings;
    
    // ── Maintenance toggle — uses id="tgl-maintenance" ──────
    
    
    if (s.config) {
      fillSettings({
        ...s.config,
        maintenance: s.maintenance,
        features: s.features,
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
      deposits: 'tgl-deposits',
      withdrawals: 'tgl-withdrawals',
      shares: 'tgl-shares',
      referral: 'tgl-referral',
      spin: 'tgl-spin',
      register: 'tgl-register',
    };
    Object.entries(toggleMap).forEach(([key, elId]) => {
      const el = document.getElementById(elId);
      if (el && data.features[key] !== undefined) el.checked = !!data.features[key];
    });
  }
  if (data.maintenance?.enabled !== undefined) {
    const mt = document.getElementById('tgl-maintenance');
    if (mt) {
      mt.checked = !!data.maintenance.enabled;
      // Keep dropdown UI in sync if present
      if (typeof syncMaintUI === 'function') syncMaintUI(mt.checked);
    }
  }
}

function switchTab(name, btn) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('panel-' + name).classList.add('active');
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

function onToggle(feature, endpoint = "toggle", checked) {
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
        saveFeatureState('maintenance', 'maintenance', true);
        showToast('⚠️ Maintenance mode ON — users are locked out', 'error');
        if (typeof syncMaintUI === 'function') syncMaintUI(true);
      }
    });
    return;
  }
  // Turning maintenance OFF — no confirm needed, just save immediately
  if (feature === 'maintenance' && !checked) {
    settingsState['maintenance'] = false;
    saveFeatureState('maintenance', 'maintenance', false);
    showToast('✅ Maintenance mode OFF — platform is live', 'success');
    if (typeof syncMaintUI === 'function') syncMaintUI(false);
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
        saveFeatureState('withdrawals', 'toggle', false);
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
        saveFeatureState('register', 'toggle', false);
        showToast('New registrations disabled', 'info');
        markChanged();
      }
    });
    return;
  }
  settingsState[feature] = checked;
  saveFeatureState(feature, endpoint, checked);
  markChanged();
  if (feature !== 'maintenance') {
    const label = feature.charAt(0).toUpperCase() + feature.slice(1);
    showToast(`${label} ${checked?'enabled':'disabled'}`, checked ? 'success' : 'info');
  }
}

async function saveFeatureState(feature, endpoint = "toggle", value) {
  try {
    await api(`/api/admin/settings/${endpoint}`, {
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
  /* unsavedChanges++;
   const cnt = document.getElementById('unsavedCount');
   if (cnt) cnt.textContent = unsavedChanges;
   document.getElementById('unsavedBar')?.classList.add('visible');*/
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
  if (unsavedChanges > 0) {
    e.preventDefault();
    e.returnValue = '';
  }
});

// ── Save all settings ──────────────────────────────────────
async function saveAllSettings() {
  const g = (id) => document.getElementById(id)?.value;
  
  // Build the config payload matching your backend schema
  const configPayload = {
    siteName: g('siteName') || g('siteNameInput'),
    tagline: g('siteTagline'),
    siteAbout: g('siteDesc') || g('descText'),
    whatsappLink: g('whatsappLink') || g('waLink'),
    telegramLink: g('telegramLink') || g('tgLink'),
    dailyCheckInAmount: Number(g('checkinBonus') || g('signinAmt') || 0),
    referralPercents: [g('refL1') || g('ref1'), g('refL2') || g('ref2'), g('refL3') || g('ref3')].map(Number),
    minDeposit: Number(g('minDeposit') || 0),
    maxDeposit: Number(g('maxDeposit') || 0),
    minWithdraw: Number(g('minWithdraw') || 0),
    withdrawFee: Number(g('withdrawFee') || 0),
    withdrawStart: g('withdrawStart'),
    withdrawEnd: g('withdrawEnd'),
    adminEmail: g('adminEmail'),
    maintMsg: g('maintMsg'),
    gateway: g('payGateway'),
    environment: g('payEnv'),
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
  if (input) {
    input.value = '';
    handleSettingsSearch('');
    input.focus();
  }
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

function openUtil(section) { showToast(`Opening ${section} manager...`, 'info'); }

function saveBrandAssets() {
  showToast('Brand assets saved', 'success');
  markChanged();
}

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
  else showToast(data?.error || 'Error saving API keys.', 'error');
};

// ── Confirmation modal ─────────────────────────────────────
const confirmIcons = {
  danger: 'ri-error-warning-line',
  warning: 'ri-alert-line',
  info: 'ri-question-line',
  success: 'ri-checkbox-circle-line' // Added success just in case
};

function showConfirm({ title, msg, type = 'danger', yesLabel = 'Confirm', onYes, icon = true, iconClass }) {
  confirmCallback = onYes;
  
  // 1. Set text and content
  document.getElementById('confirmTitle').innerHTML = title;
  document.getElementById('confirmMsg').innerHTML = msg;
  
  // 2. Handle Icon Visibility and Logic
  const iconWrap = document.getElementById('confirmIcon');
  const iconEl = document.getElementById('confirmIconEl');
  
  if (icon === false) {
    iconWrap.style.display = 'none'; // Hide if icon: false is passed
  } else {
    iconWrap.style.display = 'flex'; // Show by default
    // Use passed iconClass > mapped icon > default danger icon
    const finalIconClass = iconClass || confirmIcons[type] || confirmIcons.danger;
    iconEl.className = finalIconClass;
    iconWrap.className = `confirm-icon-wrap ${type}`;
  }
  
  // 3. Setup Button
  const yesBtn = document.getElementById('confirmYesBtn');
  yesBtn.textContent = yesLabel;
  // Keeps your specific 'green' override for info types
  yesBtn.className = `confirm-btn-yes ${type === 'info' ? 'green' : type}`;
  
  // 4. Show Overlay
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
  const html = document.body;
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
    if (btn) {
      btn.disabled = true;
      btn.innerText = 'Saving...';
    }
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
      showToast('Error updating config. Check your connection.', 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerText = 'Save Config';
      }
    }
  };
}

// Payment settings
window.openBindBankModal = async () => {
  const data = await api('/api/admin/settings');
  const p = data?.settings?.payment || {};
  
  showConfirm({
    title: 'Payments Configuration',
    msg: `               
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
      
      <div class="section-body" style="display:block;">
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Payment Gateway</label>
                  <div class="select-wrap">
                    <select class="form-input" id="payGateway" onchange="onGatewayChange(this.value)">
                      <option value="paystack">Paystack</option>
                      <option value="flutterwave">Flutterwave</option>
                      <option value="korapay">Korapay</option>
                    </select>
                  </div>
                </div>
                <div class="form-group">
                  <label class="form-label">Environment</label>
                  <div class="select-wrap">
                    <select class="form-input" id="payEnv">
                      <option value="test">Test / Sandbox</option>
                      <option value="live">Live / Production</option>
                    </select>
                  </div>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Public Key</label>
                <div class="api-key-wrap">
                  <input type="text" class="form-input" id="koraPublicKey" value="${p.korapay?.publicKey||''}"
                   placeholder="pk_live_xxxxxxxxxxxxxx">
                  <button class="btn-icon" onclick="copyField('koraPublicKey')" title="Copy"><i class="ri-file-copy-line"></i></button>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Secret Key</label>
                <div class="api-key-wrap">
                  <input type="password" class="form-input" id="koraSecretKey" value="${p.korapay?.secretKey||''}" placeholder="sk_live_xxxxxxxxxxxxxx">
                  <button class="btn-icon" onclick="togglePasswordField('koraSecretKey', this)" title="Show/Hide"><i class="ri-eye-off-line"></i></button>
                  <button class="btn-icon" onclick="copyField('koraSecretKey')" title="Copy"><i class="ri-file-copy-line"></i></button>
                </div>
              </div>
            </div>
  `,
    type: 'green',
    yesLabel: 'Configure Connection',
    onYes: () => savePaymentSettings(),
    icon: false
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



//for chat feature 
// ═══════════════════════════════════════════════════════════
// ADMIN CHAT SYSTEM — Professional FB-style
// ═══════════════════════════════════════════════════════════

let activeSessionId      = null;
let activeUserData       = null;   // full user object from session.userId
let statusTickerTimer    = null;   // cycles status line in header
let adminChatPollTimer   = null;
let adminTypingPollTimer = null;
let adminTypingTimer     = null;
let adminLastMsgCount    = 0;
let adminSoundEnabled    = true;
let adminSiteLogo        = '';
let adminChatSessionStatus = 'active';
let adminAllMessages     = [];
let adminReplyingTo      = null;
let adminEditingMsgId    = null;
const ADMIN_EMOJIS       = ['👍','❤️','😂','😮','😢','🔥'];

// ─── GET SITE LOGO ────────────────────────────────────────
async function getAdminSiteLogo() {
  if (adminSiteLogo) return adminSiteLogo;
  const data = await api('/api/admin/settings');
  adminSiteLogo = data?.config?.siteLogo || '';
  return adminSiteLogo;
}

// ─── AUDIO ────────────────────────────────────────────────
function playAdminChatSound() {
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = 660;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.4);
  } catch(e) {}
}

// ─── LOAD SESSION LIST ────────────────────────────────────
window.loadAdminChatSessions = async function() {
  const container = document.getElementById('chatSessionItems');
  if (!container) return;

  const logo = await getAdminSiteLogo();
  const data = await api('/api/admin/chat/sessions');
  if (!data?.success) { container.innerHTML = '<div style="padding:20px;text-align:center;color:#aaa;">Failed to load chats.</div>'; return; }

  if (!data.sessions.length) {
    container.innerHTML = '<div style="padding:20px;text-align:center;color:#aaa;font-size:13px;">No chats yet.</div>';
    return;
  }

  container.innerHTML = '';
  data.sessions.forEach(s => {
    const isActive  = s._id === activeSessionId;
    const hasUnread = s.unreadAdmin > 0;
    const timeStr   = s.lastMessageAt ? new Date(s.lastMessageAt).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }) : '';
    const ended     = s.status === 'ended';
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
        <div style="font-size:12px;color:#aaa;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px;">${s.lastMessage || 'No messages'}</div>
      </div>
      ${hasUnread ? `<span style="background:#e74c3c;color:#fff;border-radius:50%;width:20px;height:20px;font-size:11px;display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0;">${s.unreadAdmin}</span>` : ''}
      ${ended ? `<span style="background:#e74c3c;color:#fff;border-radius:10px;padding:2px 6px;font-size:10px;flex-shrink:0;">Ended</span>` : ''}`;
    container.appendChild(div);
  });

  const totalUnread = data.sessions.reduce((a,s) => a + (s.unreadAdmin||0), 0);
  const badge = document.getElementById('adminChatBadge');
  if (badge) { badge.textContent = totalUnread; badge.style.display = totalUnread > 0 ? 'flex' : 'none'; }
};

// ─── OPEN SESSION ─────────────────────────────────────────
window.openAdminChatSession = async function(sessionId, username, status, userData) {
  activeSessionId = sessionId;
  activeUserData  = userData || null;
  adminChatSessionStatus = status || 'active';
  adminAllMessages = [];
  adminReplyingTo  = null;
  adminEditingMsgId = null;

  const logo = await getAdminSiteLogo();

  document.getElementById('chatWindowEmpty').style.display = 'none';
  const activeWin = document.getElementById('chatWindowActive');
  activeWin.style.display = 'flex';

  // Mobile: slide session list out
  if (window.innerWidth <= 700) {
    document.getElementById('chatSessionList')?.classList.add('slide-out');
    const backBtn = document.getElementById('chatBackBtn');
    if (backBtn) backBtn.style.display = 'flex';
  }

  document.getElementById('adminChatUsername').textContent = username;
  document.getElementById('adminChatUserLogo').src = logo;

  // Update block button state
  updateBlockBtn(userData?.status);

  // Start status ticker
  startStatusTicker(sessionId, status, userData?.status);

  const inputBar = document.getElementById('adminChatInputBar');
  const polarBtn = document.getElementById('adminPolarBtn');
  if (inputBar) inputBar.style.display = status === 'ended' ? 'none' : 'flex';
  if (polarBtn) polarBtn.style.display = status === 'ended' ? 'none' : 'inline-block';

  // Reset reply bar
  cancelAdminReply();

  await loadAdminMessages(sessionId);
  startAdminChatPolling(sessionId);
  startAdminTypingPoll(sessionId);
  loadAdminChatSessions();
};

// ─── LOAD MESSAGES ────────────────────────────────────────
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
    const dateStr = new Date(msg.createdAt).toLocaleDateString([], { weekday:'long', month:'short', day:'numeric' });
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

// ─── BUILD BUBBLE ─────────────────────────────────────────
function buildAdminMsgBubble(msg, logo) {
  const isMe    = msg.sender === 'admin';
  const time    = new Date(msg.createdAt).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
  const wrapper = document.createElement('div');
  wrapper.dataset.msgId = msg._id;
  wrapper.style.cssText = `display:flex;flex-direction:column;align-items:${isMe?'flex-end':'flex-start'};gap:2px;margin-bottom:2px;position:relative;`;

  // Reply quote
  let replyHtml = '';
  if (msg.replyTo?.msgId) {
    replyHtml = `
      <div style="background:rgba(0,0,0,0.06);border-left:3px solid #4318ff;border-radius:6px;padding:5px 10px;margin-bottom:4px;font-size:11px;color:#888;max-width:100%;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">
        <span style="font-weight:700;color:#4318ff;margin-right:6px;">${msg.replyTo.sender === 'admin' ? 'You' : 'User'}</span>${msg.replyTo.preview}
      </div>`;
  }

  // Content
  let bubbleContent = '';
  if (msg.deleted) {
    bubbleContent = `<span style="font-style:italic;opacity:0.6;font-size:13px;">🚫 This message was deleted</span>`;
  } else if (msg.type === 'image' && msg.imageUrl) {
    bubbleContent = `<img src="${msg.imageUrl}" style="max-width:220px;border-radius:10px;cursor:pointer;" onclick="window.open('${msg.imageUrl}','_blank')">`;
  } else if (msg.type === 'polar') {
    const answered = msg.polarAnswer;
    bubbleContent = `
      <div style="font-size:13px;margin-bottom:6px;font-weight:600;">❓ ${msg.polarQuestion}</div>
      ${answered
        ? `<div style="padding:6px 12px;border-radius:8px;background:rgba(255,255,255,0.2);font-weight:700;color:${answered==='yes'?'#10ac84':'#e74c3c'};">${answered==='yes'?'✅ User answered: Yes':'❌ User answered: No'}</div>`
        : '<div style="color:rgba(255,255,255,0.7);font-size:12px;">⏳ Awaiting answer...</div>'}`;
  } else {
    bubbleContent = `<span style="font-size:13px;line-height:1.5;word-break:break-word;">${msg.content}</span>`;
  }

  // Ticks for admin's own messages
  let ticksHtml = '';
  if (isMe && !msg.deleted) {
    const tickColor = msg.read ? '#4fc3f7' : msg.delivered ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.4)';
    ticksHtml = `<span style="font-size:11px;color:${tickColor};margin-left:4px;">${msg.read?'✓✓':msg.delivered?'✓✓':'✓'}</span>`;
  }

  const editedHtml = msg.edited && !msg.deleted ? `<span style="font-size:10px;opacity:0.5;margin-left:4px;">edited</span>` : '';

  // Reactions
  const reactEntries = Object.entries(msg.reactions||{}).filter(([,v])=>v.length>0);
  const reactionsHtml = reactEntries.length ? `
    <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:3px;">
      ${reactEntries.map(([emoji,users]) => `
        <span onclick="adminToggleReaction('${msg._id}','${emoji}')" style="background:rgba(0,0,0,0.07);border-radius:12px;padding:2px 7px;font-size:12px;cursor:pointer;border:1px solid ${users.includes('admin')?'#4318ff':'transparent'};">
          ${emoji} ${users.length}
        </span>`).join('')}
    </div>` : '';

  // Emoji/action bar
  const emojiBarId = `aebar-${msg._id}`;
  const emojiBarHtml = msg.deleted ? '' : `
    <div id="${emojiBarId}" style="display:none;position:absolute;${isMe?'right:0':'left:0'};bottom:calc(100% + 4px);background:#fff;border-radius:20px;padding:6px 10px;box-shadow:0 4px 16px rgba(0,0,0,0.15);gap:6px;z-index:100;white-space:nowrap;">
      ${ADMIN_EMOJIS.map(e => `<span onclick="adminToggleReaction('${msg._id}','${e}');adminHideEmojiBar('${emojiBarId}')" style="font-size:20px;cursor:pointer;" onmouseover="this.style.transform='scale(1.3)'" onmouseout="this.style.transform='scale(1)'">${e}</span>`).join('')}
      <span onclick="adminStartReply('${msg._id}');adminHideEmojiBar('${emojiBarId}')" style="font-size:18px;cursor:pointer;padding:0 3px;" title="Reply">↩️</span>
      ${isMe && !msg.deleted ? `<span onclick="adminStartEdit('${msg._id}');adminHideEmojiBar('${emojiBarId}')" style="font-size:18px;cursor:pointer;padding:0 3px;" title="Edit">✏️</span>
      <span onclick="adminDeleteMsg('${msg._id}');adminHideEmojiBar('${emojiBarId}')" style="font-size:18px;cursor:pointer;padding:0 3px;" title="Delete">🗑️</span>` : ''}
    </div>`;

  wrapper.innerHTML = `
    ${emojiBarHtml}
    <div>
      <div class="admin-bubble" data-msg-id="${msg._id}"
        style="max-width:72%;background:${isMe?'#4318ff':'#fff'};color:${isMe?'#fff':'#333'};border-radius:${isMe?'16px 16px 4px 16px':'16px 16px 16px 4px'};padding:10px 13px;box-shadow:0 1px 3px rgba(0,0,0,0.08);cursor:pointer;position:relative;"
        oncontextmenu="adminShowEmojiBar(event,'${emojiBarId}')"
        ontouchstart="adminHandleTouchStart(event,'${emojiBarId}')"
        ontouchend="adminHandleTouchEnd()"
      >
        ${replyHtml}${bubbleContent}
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:3px;padding:0 38px;">
      <span style="font-size:10px;color:#aaa;">${time}</span>${editedHtml}${ticksHtml}
    </div>
    ${reactionsHtml}`;

  return wrapper;
}

// ─── EMOJI BAR ────────────────────────────────────────────
let adminLongPressTimer = null;

window.adminShowEmojiBar = function(e, barId) {
  e.preventDefault();
  adminHideAllEmojiBars();
  const bar = document.getElementById(barId);
  if (bar) bar.style.display = 'flex';
};
window.adminHideEmojiBar = function(barId) {
  const bar = document.getElementById(barId); if (bar) bar.style.display = 'none';
};
function adminHideAllEmojiBars() {
  document.querySelectorAll('[id^="aebar-"]').forEach(b => b.style.display = 'none');
}
window.adminHandleTouchStart = function(e, barId) {
  adminLongPressTimer = setTimeout(() => adminShowEmojiBar(e, barId), 500);
};
window.adminHandleTouchEnd = function() { clearTimeout(adminLongPressTimer); };

document.addEventListener('click', e => {
  if (!e.target.closest('[id^="aebar-"]') && !e.target.closest('.admin-bubble')) adminHideAllEmojiBars();
});

// ─── REACTIONS ────────────────────────────────────────────
window.adminToggleReaction = async function(msgId, emoji) {
  const data = await api('/api/admin/chat/react', { method:'POST', body: JSON.stringify({ msgId, emoji }) });
  if (data?.success) await loadAdminMessages(activeSessionId);
};

// ─── REPLY ────────────────────────────────────────────────
window.adminStartReply = function(msgId) {
  const msg = adminAllMessages.find(m => m._id === msgId);
  if (!msg) return;
  adminEditingMsgId = null;
  adminReplyingTo = {
    msgId,
    sender: msg.sender,
    preview: msg.type === 'image' ? '📷 Image' : msg.content?.substring(0, 80) || ''
  };
  const bar = document.getElementById('adminReplyBar');
  if (bar) bar.style.display = 'flex';
  document.getElementById('adminReplyBarSender').textContent = msg.sender === 'admin' ? 'You' : 'User';
  document.getElementById('adminReplyBarText').textContent = adminReplyingTo.preview;
  document.getElementById('adminChatInput')?.focus();
};

window.cancelAdminReply = function() {
  adminReplyingTo = null;
  adminEditingMsgId = null;
  const bar = document.getElementById('adminReplyBar');
  if (bar) bar.style.display = 'none';
  const input = document.getElementById('adminChatInput');
  if (input) input.value = '';
};

// ─── EDIT ─────────────────────────────────────────────────
window.adminStartEdit = function(msgId) {
  const msg = adminAllMessages.find(m => m._id === msgId);
  if (!msg || msg.deleted) return;
  adminReplyingTo = null;
  adminEditingMsgId = msgId;
  const input = document.getElementById('adminChatInput');
  if (input) { input.value = msg.content; input.focus(); }
  const bar = document.getElementById('adminReplyBar');
  if (bar) bar.style.display = 'flex';
  document.getElementById('adminReplyBarSender').textContent = '✏️ Editing';
  document.getElementById('adminReplyBarText').textContent = msg.content?.substring(0, 80);
};

// ─── DELETE ───────────────────────────────────────────────
window.adminDeleteMsg = async function(msgId) {
  if (!confirm('Delete this message?')) return;
  const data = await api(`/api/admin/chat/message/${msgId}`, { method:'DELETE' });
  if (data?.success) await loadAdminMessages(activeSessionId);
};

// ─── SEND ─────────────────────────────────────────────────
window.sendAdminMessage = async function() {
  if (adminChatSessionStatus === 'ended') return alert('Session ended.');
  const input = document.getElementById('adminChatInput');
  const text  = input?.value.trim();
  if (!text || !activeSessionId) return;

  // Handle edit
  if (adminEditingMsgId) {
    const data = await api(`/api/admin/chat/message/${adminEditingMsgId}`, {
      method: 'PUT',
      body: JSON.stringify({ content: text })
    });
    if (data?.success) { cancelAdminReply(); await loadAdminMessages(activeSessionId); }
    else alert(data?.error || 'Failed to edit.');
    return;
  }

  input.value = '';
  const body = { sessionId: activeSessionId, content: text, type: 'text' };
  if (adminReplyingTo) body.replyTo = adminReplyingTo;
  cancelAdminReply();

  const data = await api('/api/admin/chat/send', { method:'POST', body: JSON.stringify(body) });
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

// Keydown for admin input
window.onAdminInputKeydown = function(e) {
  if (e.key === 'Enter') { sendAdminMessage(); return; }
  clearTimeout(adminTypingTimer);
  adminTypingTimer = setTimeout(() => {
    if (activeSessionId) api('/api/admin/chat/typing', { method:'POST', body: JSON.stringify({ sessionId: activeSessionId }) });
  }, 300);
};

// ─── SEND IMAGE ───────────────────────────────────────────
window.sendAdminImage = async function(input) {
  const file = input.files[0];
  if (!file || !activeSessionId) return;
  if (adminChatSessionStatus === 'ended') return alert('Session ended.');

  const keysRes  = await api('/api/admin/settings/apikeys');
  const imgbbKey = keysRes?.apikeys?.imgbb;
  if (!imgbbKey) return alert('ImgBB key not set in Settings → API Keys.');

  const formData = new FormData();
  formData.append('image', file);
  const res    = await fetch(`https://api.imgbb.com/1/upload?key=${imgbbKey}`, { method:'POST', body:formData });
  const result = await res.json();
  if (!result.success) return alert('Image upload failed.');

  const body = { sessionId: activeSessionId, type:'image', imageUrl: result.data.url, content:'📷 Image' };
  if (adminReplyingTo) body.replyTo = adminReplyingTo;
  cancelAdminReply();

  const data = await api('/api/admin/chat/send', { method:'POST', body: JSON.stringify(body) });
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

// ─── POLAR ────────────────────────────────────────────────
window.togglePolarInput = function() {
  const area = document.getElementById('polarInputArea');
  if (area) area.style.display = area.style.display === 'none' ? 'block' : 'none';
};

window.sendAdminPolar = async function() {
  const question = document.getElementById('polarQuestionInput')?.value.trim();
  if (!question || !activeSessionId) return;

  const data = await api('/api/admin/chat/send', {
    method:'POST',
    body: JSON.stringify({ sessionId: activeSessionId, type:'polar', polarQuestion: question, content:`❓ ${question}` })
  });
  if (data?.success) {
    const logo = await getAdminSiteLogo();
    adminAllMessages.push(data.message);
    const container = document.getElementById('adminChatMessages');
    container?.appendChild(buildAdminMsgBubble(data.message, logo));
    if (container) container.scrollTop = container.scrollHeight;
    document.getElementById('polarQuestionInput').value = '';
    togglePolarInput();
    adminLastMsgCount++;
  }
};

// ─── END / DELETE SESSION ─────────────────────────────────
window.endAdminChatSession = async function() {
  if (!activeSessionId || !confirm('End this chat session?')) return;
  const data = await api(`/api/admin/chat/session/${activeSessionId}/end`, { method:'PUT' });
  if (data?.success) {
    adminChatSessionStatus = 'ended';
    document.getElementById('adminChatSessionStatus').textContent = '🔴 Session Ended';
    const inputBar = document.getElementById('adminChatInputBar');
    const polarBtn = document.getElementById('adminPolarBtn');
    if (inputBar) inputBar.style.display = 'none';
    if (polarBtn) polarBtn.style.display = 'none';
    loadAdminChatSessions();
  }
};

window.deleteAdminChatSession = async function() {
  if (!activeSessionId || !confirm('Delete entire chat? Cannot be undone.')) return;
  const data = await api(`/api/admin/chat/session/${activeSessionId}`, { method:'DELETE' });
  if (data?.success) {
    activeSessionId = null;
    document.getElementById('chatWindowEmpty').style.display = 'flex';
    document.getElementById('chatWindowActive').style.display = 'none';
    stopAdminChatPolling();
    loadAdminChatSessions();
  }
};

// ─── TYPING POLL ──────────────────────────────────────────
function startAdminTypingPoll(sessionId) {
  if (adminTypingPollTimer) clearInterval(adminTypingPollTimer);
  adminTypingPollTimer = setInterval(async () => {
    if (!activeSessionId) return;
    const data = await api(`/api/admin/chat/typing/${sessionId}`);
    const el = document.getElementById('adminTypingIndicator');
    if (el) el.style.display = data?.typing ? 'flex' : 'none';
  }, 2000);
}

// ─── CHAT POLLING ─────────────────────────────────────────
function startAdminChatPolling(sessionId) {
  stopAdminChatPolling();
  adminChatPollTimer = setInterval(async () => {
    if (!activeSessionId) return;
    const data = await api(`/api/admin/chat/messages/${sessionId}`);
    if (!data?.success) return;

    const hasChanges = data.messages.length !== adminLastMsgCount ||
      JSON.stringify(data.messages.map(m=>m.reactions)) !== JSON.stringify(adminAllMessages.map(m=>m.reactions));

    if (hasChanges) {
      const newMsgs = data.messages.slice(adminLastMsgCount);
      const hasUserMsg = newMsgs.some(m => m.sender === 'user');
      const logo = await getAdminSiteLogo();
      adminAllMessages = data.messages;

      // Full re-render to catch edits/deletes/reactions
      const container = document.getElementById('adminChatMessages');
      if (container) {
        container.innerHTML = '';
        let lastDate = '';
        data.messages.forEach(msg => {
          const dateStr = new Date(msg.createdAt).toLocaleDateString([], { weekday:'long', month:'short', day:'numeric' });
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
      // Update seen labels
      setTimeout(() => updateSeenLabel(data.messages), 100);
    }
  }, 4000);
}

function stopAdminChatPolling() {
  if (adminChatPollTimer) clearInterval(adminChatPollTimer);
}

// ─── BROWSER NOTIFICATION ────────────────────────────────
async function requestNotifPermission() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') await Notification.requestPermission();
}
requestNotifPermission();

function sendBrowserNotif(username, message) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (document.visibilityState === 'visible') return;
  const notif = new Notification(`💬 ${username}`, {
    body: message, icon: adminSiteLogo || '/favicon.ico',
    tag: 'flux-chat', requireInteraction: true
  });
  notif.onclick = () => { window.focus(); notif.close(); };
}

// ─── UNREAD BADGE POLLING ────────────────────────────────
let lastKnownUnread = 0;

setInterval(async () => {
  const data  = await api('/api/admin/chat/unread');
  const badge = document.getElementById('adminChatBadge');
  if (data?.unread > 0) {
    if (badge) { badge.textContent = data.unread; badge.style.display = 'flex'; }
    if (data.unread > lastKnownUnread) {
      if (adminSoundEnabled) playAdminChatSound();
      const sessions = await api('/api/admin/chat/sessions');
      if (sessions?.sessions?.length) {
        const active = sessions.sessions
          .filter(s => s.unreadAdmin > 0)
          .sort((a,b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt))[0];
        if (active) sendBrowserNotif(active.username, active.lastMessage || 'New message');
      }
    }
    lastKnownUnread = data.unread;
  } else {
    if (badge) badge.style.display = 'none';
    lastKnownUnread = 0;
  }
}, 15000);

// ─── CHAT SETTINGS ────────────────────────────────────────
async function loadChatSettings() {
  const data = await api('/api/admin/chat/settings');
  if (!data?.success) return;
  const s = data.settings;
  const setCheck = (id, val) => { const el = document.getElementById(id); if (el) el.checked = !!val; };
  const setVal   = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  setCheck('cs_available',          s.available !== false);
  setCheck('cs_sound',              s.sound !== false);
  setCheck('cs_allowImages',        s.allowImages !== false);
  setCheck('cs_requireVerified',    !!s.requireVerified);
  setCheck('cs_officeHoursEnabled', !!s.officeHours?.enabled);
  setVal('cs_autoReply',  s.autoReply);
  setVal('cs_open',       s.officeHours?.open  || 9);
  setVal('cs_close',      s.officeHours?.close || 18);
  setVal('cs_offlineMsg', s.officeHours?.offlineMsg);
  setVal('cs_autoClose',  s.autoClose || 48);
  setVal('cs_charLimit',  s.charLimit || 500);
  adminSoundEnabled = s.sound !== false;
}

window.saveChatSettings = async function() {
  const getCheck = id => document.getElementById(id)?.checked;
  const getVal   = id => document.getElementById(id)?.value;
  const body = {
    available:       getCheck('cs_available'),
    sound:           getCheck('cs_sound'),
    allowImages:     getCheck('cs_allowImages'),
    requireVerified: getCheck('cs_requireVerified'),
    autoReply:       getVal('cs_autoReply'),
    autoClose:       parseInt(getVal('cs_autoClose')) || 48,
    charLimit:       parseInt(getVal('cs_charLimit')) || 500,
    officeHours: {
      enabled:    getCheck('cs_officeHoursEnabled'),
      open:       getVal('cs_open'),
      close:      getVal('cs_close'),
      offlineMsg: getVal('cs_offlineMsg'),
    }
  };
  const data = await api('/api/admin/chat/settings', { method:'PUT', body: JSON.stringify(body) });
  if (data?.success) { adminSoundEnabled = body.sound;  // 5. Show Success Modal
        showModal({
            id: 'detailsPopup',
            title: 'Configuration Alert',
            content: `
                <strong>Configuration successfully saved</strong>
                <p>✅ Chat settings saved.</p>
            `,
            buttons: [{
                text: 'Close',
                class: 'btn-sec',
                onclick: "document.getElementById('detailsPopup').remove()"
            }]
        }); }
  else alert(data?.error || 'Error saving settings.');
};

loadChatSettings();


// ═══════════════════════════════════════════════════════════
// CHAT — NEW FEATURES
// ═══════════════════════════════════════════════════════════

// ─── 1. VIEW USER PROFILE FROM CHAT ──────────────────────
window.openChatUserProfile = function() {
  if (!activeUserData) return alert('User data not available.');
  const u = activeUserData;
  viewUserDetails(
    u._id || u,
    u.status || 'active',
    u.username || 'Unknown',
    u.email || '',
    u.ib || 0,
    u.emailVerified || false,
    u.createdAt || '',
    u.refPoints || 0,
    u.referrerId || ''
  );
};

// ─── 2. STATUS TICKER ─────────────────────────────────────
// Cycles: status → session ID → status → ...
function startStatusTicker(sessionId, sessionStatus, userStatus) {
  if (statusTickerTimer) clearInterval(statusTickerTimer);

  const el = document.getElementById('adminChatSessionStatus');
  if (!el) return;

  const shortId = sessionId ? sessionId.toString().slice(-8).toUpperCase() : '--------';

  const isBlocked = userStatus === 'blocked';
  const isEnded   = sessionStatus === 'ended';

  const states = [
    // State 1: user status
    () => {
      if (isEnded) {
        el.innerHTML = `<span style="color:#e74c3c;display:flex;align-items:center;gap:4px;"><i class="ri-stop-circle-line"></i> Session Ended</span>`;
      } else if (isBlocked) {
        el.innerHTML = `<span style="color:#e74c3c;display:flex;align-items:center;gap:4px;"><i class="ri-forbid-line"></i> Offline — Blocked</span>`;
      } else {
        el.innerHTML = `<span style="color:#10ac84;display:flex;align-items:center;gap:4px;"><i class="ri-radio-button-line"></i> Online — Active</span>`;
      }
    },
    // State 2: session ID
    () => {
      el.innerHTML = `<span style="color:#aaa;display:flex;align-items:center;gap:4px;"><i class="ri-fingerprint-line"></i> ID: <code style="font-size:10px;background:rgba(0,0,0,0.06);padding:1px 5px;border-radius:4px;">${shortId}</code></span>`;
    }
  ];

  let idx = 0;
  states[0](); // show immediately

  statusTickerTimer = setInterval(() => {
    el.style.opacity = '0';
    setTimeout(() => {
      idx = (idx + 1) % states.length;
      states[idx]();
      el.style.opacity = '1';
    }, 300);
  }, 3500);
}

// ─── 3. BLOCK / UNBLOCK FROM CHAT ─────────────────────────
function updateBlockBtn(userStatus) {
  const btn   = document.getElementById('adminBlockBtn');
  const label = document.getElementById('adminBlockLabel');
  if (!btn) return;
  const isBlocked = userStatus === 'blocked';
  const icon = btn.querySelector('i');
  if (icon) icon.className = isBlocked ? 'ri-shield-check-line' : 'ri-forbid-line';
  if (label) label.textContent = isBlocked ? 'Unblock' : 'Block';
  btn.style.background = isBlocked ? '#e8f8f1' : '#fdecea';
  btn.style.color      = isBlocked ? '#10ac84' : '#e74c3c';
  btn.title = isBlocked ? 'Unblock user' : 'Block user';
}

window.toggleBlockFromChat = async function() {
  if (!activeSessionId) return;
  const isBlocked = activeUserData?.status === 'blocked';
  const action    = isBlocked ? 'unblock' : 'block';
  if (!confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} this user?`)) return;

  const data = await api(`/api/admin/chat/session/${activeSessionId}/block`, {
    method: 'PUT',
    body: JSON.stringify({ block: !isBlocked })
  });

  if (data?.success) {
    if (activeUserData) activeUserData.status = data.userStatus;
    updateBlockBtn(data.userStatus);
    // Restart ticker with updated status
    startStatusTicker(activeSessionId, isBlocked ? 'active' : 'ended', data.userStatus);
    // If blocked, hide input bar
    if (!isBlocked) {
      adminChatSessionStatus = 'ended';
      document.getElementById('adminChatInputBar').style.display = 'none';
      document.getElementById('adminPolarBtn').style.display = 'none';
    } else {
      adminChatSessionStatus = 'active';
      document.getElementById('adminChatInputBar').style.display = 'flex';
      document.getElementById('adminPolarBtn').style.display = 'inline-block';
    }
    loadAdminChatSessions();
  } else {
    alert(data?.error || 'Failed.');
  }
};

// ─── 4. SEARCH MESSAGES ───────────────────────────────────
window.toggleChatSearch = function() {
  const bar = document.getElementById('chatSearchBar');
  if (!bar) return;
  const isVisible = bar.style.display !== 'none';
  bar.style.display = isVisible ? 'none' : 'block';
  if (!isVisible) document.getElementById('chatSearchInput')?.focus();
  else {
    document.getElementById('chatSearchInput').value = '';
    document.getElementById('chatSearchResults').textContent = '';
    // Remove all highlights
    document.querySelectorAll('.search-highlight').forEach(el => {
      el.outerHTML = el.textContent;
    });
  }
};

window.searchChatMessages = function(query) {
  const resultsEl = document.getElementById('chatSearchResults');
  // Remove previous highlights
  document.querySelectorAll('.search-highlight').forEach(el => {
    const text = document.createTextNode(el.textContent);
    el.parentNode.replaceChild(text, el);
  });

  if (!query.trim()) { if (resultsEl) resultsEl.textContent = ''; return; }

  const q = query.toLowerCase();
  const bubbles = document.querySelectorAll('#adminChatMessages .admin-bubble');
  let matchCount = 0;
  let firstMatch = null;

  bubbles.forEach(bubble => {
    const spans = bubble.querySelectorAll('span');
    spans.forEach(span => {
      if (span.children.length > 0) return; // skip non-text spans
      const text = span.textContent;
      if (text.toLowerCase().includes(q)) {
        matchCount++;
        // Highlight the match
        const highlighted = text.replace(
          new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'),
          '<mark class="search-highlight" style="background:#fff176;border-radius:3px;padding:0 2px;">$1</mark>'
        );
        span.innerHTML = highlighted;
        if (!firstMatch) firstMatch = bubble;
      }
    });
  });

  if (resultsEl) {
    resultsEl.textContent = matchCount > 0 ? `${matchCount} result${matchCount > 1 ? 's' : ''} found` : 'No results found';
    resultsEl.style.color = matchCount > 0 ? '#10ac84' : '#e74c3c';
  }

  // Scroll to first match
  if (firstMatch) firstMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
};

// ─── 5. SCROLL TO BOTTOM BUTTON ───────────────────────────
function initScrollToBottom() {
  const container = document.getElementById('adminChatMessages');
  if (!container) return;

  // Create the button if not exists
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
    const distFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    btn.style.display = distFromBottom > 120 ? 'flex' : 'none';
    btn.style.alignItems = 'center';
    btn.style.justifyContent = 'center';
  };
}

// Call initScrollToBottom when a session is opened
const _origLoadAdminMsgs = loadAdminMessages;
// Hook into openAdminChatSession — initScrollToBottom runs after messages load
const _origOpen = window.openAdminChatSession;
window.openAdminChatSession = async function(sessionId, username, status, userData) {
  await _origOpen(sessionId, username, status, userData);
  setTimeout(initScrollToBottom, 200);
};

// ─── 6. SEEN RECEIPT ──────────────────────────────────────
// Already handled by message ticks (✓✓ blue = read). 
// Additionally show "Seen" label under the last admin message.
function updateSeenLabel(messages) {
  // Remove existing seen labels
  document.querySelectorAll('.seen-label').forEach(el => el.remove());

  // Find last admin message that was read
  const lastReadAdminMsg = [...messages].reverse().find(m => m.sender === 'admin' && m.read && !m.deleted);
  if (!lastReadAdminMsg) return;

  const bubble = document.querySelector(`[data-msg-id="${lastReadAdminMsg._id}"]`);
  if (!bubble) return;

  const label = document.createElement('div');
  label.className = 'seen-label';
  label.style.cssText = 'font-size:10px;color:#4fc3f7;text-align:right;padding:0 42px;margin-top:-4px;';
  label.textContent = 'Seen ✓✓';
  bubble.after(label);
}

// Patch startAdminChatPolling to call updateSeenLabel
const _origPollFn = startAdminChatPolling;

// ─── MOBILE: Back to session list ─────────────────────────
window.closeChatOnMobile = function() {
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
//  SECTION 16 — STARTUP
// ══════════════════════════════════════════════════════════
// ── STATE ──────────────────────────────────────────────────
let _deposits = [];
let _withdrawals = [];
let _activity = [];

let _dFiltered = [],
  _wFiltered = [],
  _aFiltered = [];

let dPage = 1,
  wPage = 1,
  aPage = 1;

// ── AVATAR COLOR MAP ───────────────────────────────────────

function avatarColor(str) {
  let h = 0;
  for (let i = 0; i < (str || '').length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return COLORS[Math.abs(h) % COLORS.length];
}

function initials(str) { return (str || '?').slice(0, 2).toUpperCase(); }


// Init on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  initChangeTracking();
  renderTags('depositTags', depositAmounts);
  loadThemeSettings();
  // Init theme icons correctly
  const saved = localStorage.getItem('fm_admin_theme') || 'light';
  updateThemeIcons(saved);
});

window.addEventListener('DOMContentLoaded', () => {
  loadDeposits();
  loadWithdrawals();
  loadActivity();
});

async function refreshAll() {
  //for transactions refresh
  loadDeposits();
  loadWithdrawals();
  loadActivity();
  //shares refreshing
  loadShares();
  loadInvestments();
  await Promise.all([atLoadTasks(), atLoadSubmissions()]);
  showToast('Refreshed ✓', 'success');
}

// ═══════════════════════════════════════════════════════════
// DEPOSITS
// ═══════════════════════════════════════════════════════════
async function loadDeposits() {
  setLoading('depositTableBody', 6);
  const data = await api('/api/admin/deposits');
  if (!data?.success) { setError('depositTableBody', 6, 'Failed to load deposits'); return; }
  _deposits = data.deposits || [];
  _dFiltered = [..._deposits];
  updateDepositStats();
  renderDepositsPage();
}

function updateDepositStats() {
  const total = _deposits.length;
  const approved = _deposits.filter(d => d.status === 'success').length;
  const pending = _deposits.filter(d => d.status === 'pending').length;
  const withdrawCount = _withdrawals.length;
  
  setText('statTotalDeposits', total);
  setText('statApprovedDeposits', approved);
  setText('statPendingDeposits', pending);
  setText('statTotalWithdrawals', withdrawCount);
  setText('tcDeposits', total);
}

//big issues
function filterDeposits(term) {
  term = term.toLowerCase();
  _dFiltered = _deposits.filter(d => {
    const user = d.userId?.username || d.userId?._id || d.userId || '';
    const ref = d.refCode || '';
    return user.toString().toLowerCase().includes(term) || ref.toLowerCase().includes(term);
  });
  dPage = 1;
  renderDepositsPage();
}

function filterDepositStatus(status) {
  _dFiltered = status === 'all' ? [..._deposits] : _deposits.filter(d => d.status === status);
  dPage = 1;
  renderDepositsPage();
}

/*
window.filterDeposits = () => {
  const term = document.getElementById('adminSearch')?.value.toLowerCase() || '';
  const filtered = allData.filter(i => {
    const uid = (i.userId?._id || i.userId || '').toString().toLowerCase();
    const ref = (i.refCode || '').toLowerCase();
    return uid.includes(term) || ref.includes(term);
  });
  renderDeposits(filtered);
};


*/

window.viewDepositDetail = (i) => {
  const userName = i.userId?.username || i.userId?.toString().substring(0, 8) || '—';
  const fex = Number(i.amount);
  const naira = (fex * 0.7).toLocaleString();
  showConfirm({
    title: '<h3>Deposit Detail</h3>',
    msg: `   <div class="dp-section">Transaction Info</div>
    <div class="dp-info-row"><span class="dp-info-key">User</span><span class="dp-info-val" style="font-family:monospace">${userName}</span></div>
    <div class="dp-info-row"><span class="dp-info-key">Status</span><span class="dp-info-val">${statusBadge(i.status)}</span></div>
    <div class="dp-info-row"><span class="dp-info-key">Amount (FEX)</span><span class="dp-info-val">🪙 ${fex.toLocaleString()}</span></div>
    <div class="dp-info-row"><span class="dp-info-key">Reference</span><span class="dp-info-val">${i.refCode || '—'}</span></div>
    <div class="dp-info-row"><span class="dp-info-key">Method</span><span class="dp-info-val">${i.method || 'Bank Transfer'}</span></div>
    
    <div class="dp-info-row"><span class="dp-info-key">Date</span><span class="dp-info-val">${i.createdAt ? new Date(i.createdAt).toLocaleString() : '—'}</span>
    </div>`,
    type: 'warning',
    yesLabel: 'Approve',
    onYes: () => approveDeposit(i._id),
    icon: false
  });
};

// ═══════════════════════════════════════════════════════════
// WITHDRAWALS
// ═══════════════════════════════════════════════════════════
async function loadWithdrawals() {
  setLoading('withdrawTableBody', 7);
  const data = await api('/api/admin/withdrawals');
  if (!data?.success) { setError('withdrawTableBody', 7, 'Failed to load withdrawals'); return; }
  _withdrawals = data.withdrawals || [];
  _wFiltered = [..._withdrawals];
  setText('tcWithdrawals', _withdrawals.length);
  setText('statTotalWithdrawals', _withdrawals.length);
  renderWithdrawalsPage();
}

function filterWithdrawals(term) {
  term = term.toLowerCase();
  _wFiltered = _withdrawals.filter(w => {
    const user = w.username || w.userId?.toString() || '';
    const acc = w.bankDetails?.accountNumber || '';
    const bank = w.bankDetails?.bankName || '';
    return user.toLowerCase().includes(term) || acc.includes(term) || bank.toLowerCase().includes(term);
  });
  wPage = 1;
  renderWithdrawalsPage();
}

function filterWithdrawalStatus(status) {
  _wFiltered = status === 'all' ? [..._withdrawals] : _withdrawals.filter(w => w.status === status);
  wPage = 1;
  renderWithdrawalsPage();
}

function renderWithdrawalsPage() {
  const tbody = document.getElementById('withdrawTableBody');
  if (!tbody) return;
  if (!_wFiltered.length) {
    setEmpty('withdrawTableBody', 7, 'No withdrawals found');
    hidePagination('withdraw');
    return;
  }
  
  const slice = paginate(_wFiltered, wPage, PER_PAGE);
  tbody.innerHTML = slice.map(w => {
    const date = w.createdAt ? new Date(w.createdAt).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
    const userName = w.username || w.userId?.toString().substring(0, 8) || '—';
    const fex = Number(w.amount);
    const net = Number(w.netAmount || (fex * 0.7));
    const rate = w.fexRate || 0.7;
    
    return `<tr>
      <td>
        <div class="user-chip">
          <div class="avatar" style="background:${avatarColor(userName)}">${initials(userName)}</div>
          <div>
            <div class="username">${userName}</div>
          </div>
        </div>
      </td>
      <td>
        <div class="amt-fex">🪙 ${fex.toLocaleString()} FEX</div>
        <div class="amt-naira">@ ₦${rate}/FEX</div>
      </td>
      <td>
        <div class="amt-fex">₦${net.toLocaleString()}</div>
        ${w.fee ? `<div class="amt-naira">fee: ₦${Number(w.fee).toLocaleString()}</div>` : ''}
      </td>
      <td>
        <div class="bank-tag">
          <i class="ri-bank-line"></i>
          ${w.bankDetails?.bankName || '—'}
        </div>
        <div class="amt-naira" style="margin-top:3px;">${w.bankDetails?.accountNumber || '—'} · ${w.bankDetails?.accountName || ''}</div>
      </td>
      <td style="white-space:nowrap;font-size:12px;color:var(--text3);">${date}</td>
      <td>${statusBadge(w.status)}</td>
      <td>
        <div class="action-group">
          ${w.status === 'pending' ? `
            <button class="btn btn-success btn-sm" onclick="approveWithdrawal('${w._id}')">
              <i class="ri-money-dollar-circle-line"></i> Pay
            </button>
            <button class="btn btn-danger btn-sm" onclick="declineWithdrawal('${w._id}')">
              <i class="ri-close-line"></i>
            </button>
          ` : `
            <button class="btn btn-ghost btn-sm" onclick="viewWithdrawalDetail(${JSON.stringify(w).replace(/"/g,'&quot;')})">
              <i class="ri-eye-line"></i>
            </button>
            <button class="btn btn-danger btn-sm" onclick="deleteWithdrawal('${w._id}')">
              <i class="ri-delete-bin-line"></i>
            </button>
          `}
        </div>
      </td>
    </tr>`;
  }).join('');
  
  renderPagination('withdraw', _wFiltered.length, wPage, (p) => {
    wPage = p;
    renderWithdrawalsPage();
  });
}

window.approveWithdrawal = async (id) => {
  showConfirm({
    title: 'Confirm Payment Sent?',
    msg: 'Mark this withdrawal as paid? This cannot be undone.',
    type: 'info',
    yesLabel: 'Confirm Payment',
    onYes: async () => {
      await api(`/api/admin/withdrawals/${id}`, { method: 'PUT', body: JSON.stringify({ status: 'success' }) });
      loadWithdrawals();
    }
  });
};




window.declineWithdrawal = async (id) => {
  showConfirm({
    title: 'Decline & Refund?',
    msg: 'Decline this withdrawal and refund the user? The funds will be returned to their balance.',
    type: 'warning',
    yesLabel: 'Decline & Refund',
    onYes: async () => {
      const data = await api(`/api/admin/withdrawals/${id}`, { method: 'PUT', body: JSON.stringify({ status: 'declined' }) });
      if (data?.success) {
        showToast('Withdrawal declined — user refunded.', 'warning');
        loadWithdrawals();
      } else showToast(data?.error || 'Error.', 'error');
    }
  });
};


window.deleteWithdrawal = async (id) => {
  showConfirm({
    title: 'Delete Withdrawal Record?',
    msg: 'This will permanently remove this withdrawal record. This cannot be undone.',
    type: 'danger',
    yesLabel: 'Delete Record',
    onYes: async () => {
      await api(`/api/admin/withdrawals/${id}`, { method: 'DELETE' });
      showToast('Record deleted.', 'warning');
      loadWithdrawals();
    }
  });
};


window.viewWithdrawalDetail = (w) => {
  const fex = Number(w.amount);
  const rate = w.fexRate || 0.7;
  const net = Number(fex * rate || 0.7);
  
  showConfirm({
    title: '<h3>Withdrawal Detail</h3>',
    msg: `<div class="dp-section">Transaction Info</div>
    <div class="dp-info-row"><span class="dp-info-key">User</span><span class="dp-info-val" style="font-family:monospace">${w.username || '—'}</span></div>
    <div class="dp-info-row"><span class="dp-info-key">Status</span><span class="dp-info-val">${statusBadge(w.status)}</span></div>
    <div class="dp-info-row"><span class="dp-info-key">FEX Amount</span><span class="dp-info-val">🪙 ${fex.toLocaleString()}</span></div>
    <div class="dp-info-row"><span class="dp-info-key">Naira Payout</span><span class="dp-info-val">₦${net.toLocaleString()}</span></div>
    <div class="dp-info-row"><span class="dp-info-key">Rate</span><span class="dp-info-val">₦${rate}/FEX</span></div>
    <div class="dp-info-row"><span class="dp-info-key">Fee</span><span class="dp-info-val">₦${Number(w.fee || 0).toLocaleString()}</span></div>
    <div class="dp-info-row"><span class="dp-info-key">Bank</span><span class="dp-info-val">${w.bankDetails?.bankName || '—'}</span></div>
    <div class="dp-info-row"><span class="dp-info-key">Account</span><span class="dp-info-val">${w.bankDetails?.accountNumber || '—'}</span></div>
    <div class="dp-info-row"><span class="dp-info-key">Account name</span><span class="dp-info-val">${w.bankDetails?.accountName || '—'}</span></div>
    <div class="dp-info-row"><span class="dp-info-key">Date</span><span class="dp-info-val">${w.createdAt ? new Date(w.createdAt).toLocaleString() : '—'}</span></div>`,
    type: 'warning',
    yesLabel: 'Mark Paid',
    onYes: () => approveWithdrawal(w._id),
    icon: false
  });
};


// ═══════════════════════════════════════════════════════════
// ACTIVITY
// ═══════════════════════════════════════════════════════════
async function loadActivity() {
  setLoading('activityTableBody', 5);
  // /api/admin/activity — returns all users activity logs
  // Falls back to analytics deposits if endpoint unavailable
  const data = await api('/api/admin/activity');
  if (!data?.success) { setError('activityTableBody', 5, 'Activity log unavailable'); return; }
  _activity = data.activity || data.logs || [];
  _aFiltered = [..._activity];
  setText('tcActivity', _activity.length);
  renderActivityPage();
}

function filterActivity(term) {
  term = term.toLowerCase();
  _aFiltered = _activity.filter(a =>
    (a.desc || '').toLowerCase().includes(term) ||
    (a.type || '').toLowerCase().includes(term) ||
    (a.userId?.username || '').toLowerCase().includes(term)
  );
  aPage = 1;
  renderActivityPage();
}

function filterActivityType(type) {
  _aFiltered = type === 'all' ? [..._activity] : _activity.filter(a => a.type === type);
  aPage = 1;
  renderActivityPage();
}

function renderActivityPage() {
  const tbody = document.getElementById('activityTableBody');
  if (!tbody) return;
  if (!_aFiltered.length) {
    setEmpty('activityTableBody', 5, 'No activity logs found');
    hidePagination('activity');
    return;
  }
  
  const typeIcon = {
    'Deposit': { icon: 'ri-arrow-down-circle-line', color: 'var(--primary)' },
    'Withdrawal': { icon: 'ri-arrow-up-circle-line', color: 'var(--danger)' },
    'Check-in': { icon: 'ri-gift-line', color: 'var(--success)' },
    'Shares': { icon: 'ri-stock-line', color: 'var(--warning)' },
    'share': { icon: 'ri-stock-line', color: 'var(--warning)' },
    'Won spin': { icon: 'ri-trophy-line', color: 'var(--success)' },
    'Spin Loss': { icon: 'ri-medal-line', color: 'var(--text3)' },
  };
  
  const slice = paginate(_aFiltered, aPage, PER_PAGE);
  tbody.innerHTML = slice.map(a => {
    const date = a.createdAt ? new Date(a.createdAt).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
    const userName = a.userId?.username || a.username || '—';
    const ti = typeIcon[a.type] || { icon: 'ri-exchange-line', color: 'var(--text3)' };
    const fex = parseFloat(a.amount) || 0;
    const isCredit = !['Withdrawal', 'Spin Loss'].includes(a.type);
    
    return `<tr>
      <td>
        <div class="user-chip">
          <div class="avatar" style="background:${avatarColor(userName)}">${initials(userName)}</div>
          <div class="username">${userName}</div>
        </div>
      </td>
      <td>
        <span class="badge blue" style="gap:4px;">
          <i class="${ti.icon}" style="color:${ti.color}"></i>
          ${a.type || '—'}
        </span>
      </td>
      <td>
        <div class="amt-fex" style="color:${isCredit ? 'var(--success)' : 'var(--danger)'}">
          ${isCredit ? '+' : '-'}🪙 ${fex.toLocaleString()} FEX
        </div>
      </td>
      <td style="font-size:12px;color:var(--text2);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${a.desc || '—'}</td>
      <td style="white-space:nowrap;font-size:12px;color:var(--text3);">${date}</td>
    </tr>`;
  }).join('');
  
  renderPagination('activity', _aFiltered.length, aPage, (p) => {
    aPage = p;
    renderActivityPage();
  });
}

async function clearAllActivity() {
  showConfirm({
    title: "Clear Logs",
    msg: `Are you sure you want to permanently clear ALL activity logs? This cannot be undone.`,
    type: "danger",
    yesLabel: "Clear",
    onYes: async () => {
      const data = await api('/api/admin/activity/clear-all', { method: 'DELETE' });
      if (data?.success) {
        // Reset local data
        _activity = [];
        _aFiltered = [];
        // Update UI elements
        setText('tcActivity', 0);
        renderActivityPage();
        // Optional: show a success message
        showToast('All activity logs have been cleared.', "success");
      } else {
        showToast(data?.error || 'Failed to clear activity logs.', "error");
      }
    },
  });
}


// ═══════════════════════════════════════════════════════════
// EXPORT CSV
// ═══════════════════════════════════════════════════════════
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

function exportAllCSV() {
  // Determine which tab is active
  const active = document.querySelector('.tab-panel.active')?.id;
  let rows = [],
    headers = [],
    name = '';
  
  if (active === 'panel-deposits') {
    headers = ['Date', 'User', 'Amount FEX', 'Ref', 'Status', 'Method'];
    rows = _dFiltered.map(d => [
      d.createdAt ? new Date(d.createdAt).toLocaleDateString() : '',
      d.userId?.username || d.userId || '',
      d.amount, d.refCode, d.status, d.method || 'Bank Transfer'
    ]);
    name = 'deposits';
  } else if (active === 'panel-withdrawals') {
    headers = ['Date', 'User', 'FEX', 'Naira', 'Bank', 'Account', 'Status'];
    rows = _wFiltered.map(w => [
      w.createdAt ? new Date(w.createdAt).toLocaleDateString() : '',
      w.username || '',
      w.amount, w.netAmount,
      w.bankDetails?.bankName || '', w.bankDetails?.accountNumber || '',
      w.status
    ]);
    name = 'withdrawals';
  } else {
    headers = ['Date', 'User', 'Type', 'Amount FEX', 'Description'];
    rows = _aFiltered.map(a => [
      a.createdAt ? new Date(a.createdAt).toLocaleDateString() : '',
      a.userId?.username || '',
      a.type, a.amount, a.desc
    ]);
    name = 'activity';
  }
  
  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v||'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `fluxmall_${name}_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('CSV exported ✓', 'success');
}

// ═══════════════════════════════════════════════════════════
// UI HELPERS
// ═══════════════════════════════════════════════════════════
function statusBadge(s) {
  const map = {
    success: 'success',
    approved: 'success',
    pending: 'pending',
    declined: 'declined',
    failed: 'declined'
  };
  const cls = map[s] || 'pending';
  const dot = { success: '🟢', pending: '🟡', declined: '🔴' } [cls] || '⚪';
  return `<span class="badge ${cls}">${dot} ${(s||'pending').charAt(0).toUpperCase() + (s||'pending').slice(1)}</span>`;
}

function paginate(arr, page, per) {
  const start = (page - 1) * per;
  return arr.slice(start, start + per);
}

function renderPagination(prefix, total, page, onPage) {
  const totalPages = Math.ceil(total / PER_PAGE);
  const start = (page - 1) * PER_PAGE + 1;
  const end = Math.min(page * PER_PAGE, total);
  const wrap = document.getElementById(prefix + 'Pagination');
  const info = document.getElementById(prefix + 'PageInfo');
  const btns = document.getElementById(prefix + 'PageBtns');
  if (!wrap) return;
  
  if (totalPages <= 1) { wrap.style.display = 'none'; return; }
  wrap.style.display = 'flex';
  if (info) info.textContent = `${start}–${end} of ${total}`;
  
  // Build page buttons
  const range = [];
  let s = Math.max(1, page - 2);
  let e = Math.min(totalPages, s + 4);
  if (e - s < 4) s = Math.max(1, e - 4);
  for (let i = s; i <= e; i++) range.push(i);
  
  btns.innerHTML = `
    <button ${page<=1?'disabled':''} onclick="(${onPage.toString()})(${page-1})"><i class="ri-arrow-left-s-line"></i></button>
    ${range.map(p => `<button class="${p===page?'active':''}" onclick="(${onPage.toString()})(${p})">${p}</button>`).join('')}
    <button ${page>=totalPages?'disabled':''} onclick="(${onPage.toString()})(${page+1})"><i class="ri-arrow-right-s-line"></i></button>`;
}

function hidePagination(prefix) {
  const wrap = document.getElementById(prefix + 'Pagination');
  if (wrap) wrap.style.display = 'none';
}

function setLoading(tbodyId, cols) {
  const el = document.getElementById(tbodyId);
  if (el) el.innerHTML = `<tr><td colspan="${cols}"><div class="state-box"><div class="spinner"></div><p>Loading…</p></div></td></tr>`;
}

function setEmpty(tbodyId, cols, msg) {
  const el = document.getElementById(tbodyId);
  if (el) el.innerHTML = `<tr><td colspan="${cols}"><div class="state-box"><i class="ri-inbox-line"></i><p>${msg}</p></div></td></tr>`;
}

function setError(tbodyId, cols, msg) {
  const el = document.getElementById(tbodyId);
  if (el) el.innerHTML = `<tr><td colspan="${cols}"><div class="state-box"><i class="ri-error-warning-line" style="color:var(--danger)"></i><p>${msg}</p></div></td></tr>`;
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ── TOAST ──────────────────────────────────────────────────
let _toastWrap = null;
const toast = showToast;

function showToast(msg, type = 'success') {
  if (!_toastWrap) {
    _toastWrap = document.createElement('div');
    _toastWrap.style.cssText = 'position:fixed;bottom:70px;left:50%;transform:translateX(-50%);z-index:9999999;display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none;height:40px;overflow:hidden;justify-content:flex-start; width:max-content'
    document.body.appendChild(_toastWrap);
  }
  const colors = { success: '#05cd99', warning: '#f6ad55', error: '#ee5d50' };
  const t = document.createElement('div');
  t.style.cssText = `
    background:${colors[type]||'#4318ff'};color:#fff;
    padding:10px 18px;border-radius:20px;font-size:13px;font-weight:600;
    box-shadow:0 4px 16px rgba(0,0,0,0.15);
    animation:toastIn 0.22s ease;
    pointer-events:auto;
  `;
  t.textContent = msg;
  _toastWrap.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transition = 'opacity 0.3s';
    setTimeout(() => t.remove(), 300);
  }, 3000);
}


// ── STATE ──────────────────────────────────────────────────
let _shares = []; // share catalog
let _investments = []; // all purchased shares across all users
let _invFiltered = [];
const INV_PER_PAGE = 15;
let invPage = 1;

const AVATAR_COLORS = ['#4318ff', '#05cd99', '#ee5d50', '#f6ad55', '#4299e1', '#9f7aea', '#ed64a6', '#38b2ac'];

function avatarColor(str) { let h = 0; for (let i = 0; i < (str || '').length; i++) h = str.charCodeAt(i) + ((h << 5) - h); return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]; }

function initials(s) { return (s || '?').slice(0, 2).toUpperCase(); }

// ── API ─────────────────────────────────────────────────────
async function api(path, opts = {}) {
  try {
    const res = await fetch(path, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...opts.headers },
      ...opts
    });
    return res.json();
  } catch (e) { console.error('[API]', e); return null; }
}

// ── TAB SWITCH ──────────────────────────────────────────────
function switchTab(name, btn) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('panel-' + name).classList.add('active');
}

// ── INIT ────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  loadShares();
  loadInvestments();
});


// ═══════════════════════════════════════════════════════════
// SHARE CATALOG
// ═══════════════════════════════════════════════════════════
async function loadShares() {
  document.getElementById('sharesGrid').innerHTML =
    `<div class="state-box" style="grid-column:1/-1"><div class="spinner"></div><p>Loading…</p></div>`;
  
  const data = await api('/api/admin/shares');
  _shares = data?.shares || [];
  setText('statTotalShares', _shares.length);
  setText('tcCatalog', _shares.length);
  renderCatalog(_shares);
}

let _catalogFiltered = [];
let _catalogSort = 'price-asc';

function filterCatalog(term) {
  term = term.toLowerCase();
  _catalogFiltered = _shares.filter(s => s.name.toLowerCase().includes(term));
  applyCatalogSort();
}

function sortCatalog(val) {
  _catalogSort = val;
  applyCatalogSort();
}

function applyCatalogSort() {
  const arr = _catalogFiltered.length ? _catalogFiltered : [..._shares];
  arr.sort((a, b) => {
    if (_catalogSort === 'price-asc') return a.price - b.price;
    if (_catalogSort === 'price-desc') return b.price - a.price;
    if (_catalogSort === 'duration-asc') return a.duration - b.duration;
    if (_catalogSort === 'name-asc') return a.name.localeCompare(b.name);
    return 0;
  });
  renderCatalog(arr);
}

function renderCatalog(shares) {
  const grid = document.getElementById('sharesGrid');
  if (!shares.length) {
    grid.innerHTML = `<div class="state-box" style="grid-column:1/-1">
      <i class="ri-stack-line"></i><p>No share packages yet. Click <strong>+ New Share</strong> to create one.</p>
    </div>`;
    return;
  }
  
  // Count how many users bought each share
  const buyCount = {};
  _investments.forEach(inv => {
    const key = inv.shareName;
    buyCount[key] = (buyCount[key] || 0) + 1;
  });
  
  grid.innerHTML = shares.map(s => {
    const buyers = buyCount[s.name] || 0;
    const roi = s.duration > 0 ? ((s.dailyIncome * s.duration / s.price) * 100).toFixed(1) : '0';
    const imgHtml = s.img ?
      `<img src="${s.img}" alt="${s.name}" onerror="this.parentElement.innerHTML='📦'">` :
      '📦';
    
    return `
    <div class="share-card">
      <div class="share-img">${imgHtml}</div>
      <div class="share-body">
        <div class="duration-pill"><i class="ri-calendar-line"></i> ${s.duration} Days</div>
        <div class="share-name">${s.name}</div>
        <div class="share-stats">
          <div class="share-stat">
            <label>Price</label>
            <span class="blue">🪙${Number(s.price).toLocaleString()}</span>
          </div>
          <div class="share-stat">
            <label>Daily Income</label>
            <span class="green">🪙${Number(s.dailyIncome).toLocaleString()}</span>
          </div>
          <div class="share-stat">
            <label>Total ROI</label>
            <span>${roi}%</span>
          </div>
          <div class="share-stat">
            <label>Buyers</label>
            <span>${buyers} user${buyers!==1?'s':''}</span>
          </div>
        </div>
        <div class="share-actions">
          <button class="btn btn-warning btn-sm" style="flex:1" onclick="openEditShareModal('${s._id}')">
            <i class="ri-edit-line"></i> Edit
          </button>
          <button class="btn btn-danger btn-sm" onclick="deleteShare('${s._id}','${s.name}')">
            <i class="ri-delete-bin-line"></i>
          </button>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ═══════════════════════════════════════════════════════════
// USER INVESTMENTS (Purchased Shares)
// ═══════════════════════════════════════════════════════════
async function loadInvestments() {
  setLoading('investmentsTableBody', 7);
  // Uses the admin purchased-shares endpoint
  const data = await api('/api/admin/purchased-shares');
  _investments = data?.investments || data?.purchasedShares || [];
  _invFiltered = [..._investments];
  
  // Update stats
  const active = _investments.filter(i => !isExpired(i)).length;
  const expired = _investments.filter(i => isExpired(i)).length;
  const totalFex = _investments.reduce((s, i) => s + Number(i.pricePaid || 0), 0);
  
  setText('statActiveInvestments', active);
  setText('statExpired', expired);
  setText('statTotalInvested', '🪙' + totalFex.toLocaleString());
  setText('tcInvestments', _investments.length);
  
  renderInvestmentsPage();
  // Re-render catalog to update buyer counts
  renderCatalog(_shares);
}

function isExpired(inv) {
  if (!inv.purchaseDate) return false;
  const daysPassed = Math.floor((Date.now() - new Date(inv.purchaseDate)) / 86400000);
  return daysPassed >= (inv.duration || 0);
}

function daysLeft(inv) {
  const daysPassed = Math.floor((Date.now() - new Date(inv.purchaseDate)) / 86400000);
  return Math.max(0, (inv.duration || 0) - daysPassed);
}

function progressPct(inv) {
  const daysPassed = Math.floor((Date.now() - new Date(inv.purchaseDate)) / 86400000);
  return Math.min(100, Math.round((daysPassed / (inv.duration || 1)) * 100));
}

function filterInvestments(term) {
  term = term.toLowerCase();
  const statusSel = document.querySelector('#panel-investments .filter-select')?.value || 'all';
  applyInvestmentFilters(term, statusSel);
}

function filterInvestmentStatus(status) {
  const term = document.querySelector('#panel-investments .search-box input')?.value.toLowerCase() || '';
  applyInvestmentFilters(term, status);
}

function applyInvestmentFilters(term, status) {
  _invFiltered = _investments.filter(inv => {
    const name = (inv.userId?.username || inv.username || '').toLowerCase();
    const share = (inv.shareName || '').toLowerCase();
    const matchQ = !term || name.includes(term) || share.includes(term);
    const matchS = status === 'all' || (status === 'active' ? !isExpired(inv) : isExpired(inv));
    return matchQ && matchS;
  });
  invPage = 1;
  renderInvestmentsPage();
}

function renderInvestmentsPage() {
  const tbody = document.getElementById('investmentsTableBody');
  if (!_invFiltered.length) {
    setEmpty('investmentsTableBody', 7, 'No investments found');
    hidePagination('invest');
    return;
  }
  
  const slice = paginate(_invFiltered, invPage, INV_PER_PAGE);
  tbody.innerHTML = slice.map(inv => {
    const username = inv.userId?.username || inv.username || '—';
    const email = inv.userId?.email || '—';
    const pct = progressPct(inv);
    const left = daysLeft(inv);
    const expired = isExpired(inv);
    const date = inv.purchaseDate ?
      new Date(inv.purchaseDate).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' }) :
      '—';
    const earned = Math.floor((inv.duration - left) * (inv.dailyIncome || 0));
    
    return `<tr>
      <td>
        <div class="user-chip">
          <div class="avatar" style="background:${avatarColor(username)}">${initials(username)}</div>
          <div>
            <div class="username">${username}</div>
            <div class="user-sub">${email}</div>
          </div>
        </div>
      </td>
      <td>
        <div style="font-weight:700;font-size:13px;">${inv.shareName || '—'}</div>
        <div style="font-size:11px;color:var(--text3);">🪙${Number(inv.pricePaid||0).toLocaleString()} paid</div>
      </td>
      <td style="min-width:120px;">
        <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text3);margin-bottom:3px;">
          <span>${pct}%</span>
          <span>${expired ? 'Done' : left+' days left'}</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill ${expired?'':'green'}" style="width:${pct}%;background:${expired?'var(--text3)':'var(--success)'}"></div>
        </div>
        <div style="font-size:10px;color:var(--text3);margin-top:2px;">🪙${earned.toLocaleString()} earned</div>
      </td>
      <td>
        <div style="font-weight:700;color:var(--success);font-size:13px;">🪙${Number(inv.dailyIncome||0).toLocaleString()}/day</div>
        <div style="font-size:11px;color:var(--text3);">${inv.duration} days total</div>
      </td>
      <td style="white-space:nowrap;font-size:12px;color:var(--text3);">${date}</td>
      <td>
        ${expired
          ? `<span class="badge expired">⬛ Expired</span>`
          : `<span class="badge active">🟢 Active</span>`}
      </td>
      <td>
        <div class="action-group">
          <button class="btn btn-ghost btn-sm" onclick="viewInvestmentDetail(${JSON.stringify(inv).replace(/"/g,'&quot;')})">
            <i class="ri-eye-line"></i>
          </button>
          <button class="btn btn-danger btn-sm" onclick="deleteInvestment('${inv._id}','${username}')">
            <i class="ri-delete-bin-line"></i>
          </button>
        </div>
      </td>
    </tr>`;
  }).join('');
  
  renderPagination('invest', _invFiltered.length, invPage, (p) => {
    invPage = p;
    renderInvestmentsPage();
  });
}

// ═══════════════════════════════════════════════════════════
// CRUD — SHARES
// ═══════════════════════════════════════════════════════════
function openAddShareModal() {
  showConfirm({
    title: 'New share package',
    msg: `    
      <div class="form-group">
        <label>Package Name</label>
        <input id="ms_name" placeholder="e.g. Gold Pack">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Price (FEX)</label>
          <input type="number" id="ms_price" placeholder="5000" min="1">
        </div>
        <div class="form-group">
          <label>Duration (Days)</label>
          <input type="number" id="ms_duration" placeholder="30" min="1">
        </div>
      </div>
      <div class="form-group">
        <label>Daily Income (FEX)</label>
        <input type="number" id="ms_daily" placeholder="200" min="1">
      </div>
      <div class="form-group">
        <label>Share Image</label>
        <input type="file" id="ms_imgFile" accept="image/*" style="padding:8px;border:1.5px solid var(--border);border-radius:10px;width:100%;font-size:13px;cursor:pointer;">
        <div id="ms_imgStatus" style="font-size:12px;color:var(--primary);margin-top:4px;"></div>
        <input type="hidden" id="ms_imgUrl">
      </div>
      <div id="ms_roiPreview" style="background:var(--bg);border-radius:10px;padding:10px 12px;font-size:12px;color:var(--text2);display:none;">
        💡 <span id="ms_roiText"></span>
    </div>`,
    type: 'green',
    yesLabel: 'Create share',
    onYes: () => submitAddShare(),
    icon: false
  });
  // Live ROI preview
  ['ms_price', 'ms_daily', 'ms_duration'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', updateRoiPreview);
  });
}

function updateRoiPreview() {
  const price = Number(document.getElementById('ms_price')?.value) || 0;
  const daily = Number(document.getElementById('ms_daily')?.value) || 0;
  const dur = Number(document.getElementById('ms_duration')?.value) || 0;
  const prev = document.getElementById('ms_roiPreview');
  const text = document.getElementById('ms_roiText');
  if (price && daily && dur) {
    const total = daily * dur;
    const roi = ((total / price) * 100).toFixed(1);
    text.textContent = `Total return: 🪙${total.toLocaleString()} FEX (${roi}% ROI over ${dur} days)`;
    prev.style.display = 'block';
  } else {
    prev.style.display = 'none';
  }
}

async function submitAddShare() {
  const g = id => document.getElementById(id)?.value;
  const name = g('ms_name')?.trim();
  const price = Number(g('ms_price'));
  const daily = Number(g('ms_daily'));
  const duration = Number(g('ms_duration'));
  if (!name || !price || !daily || !duration) { showToast('Please fill all fields', 'error'); return; }
  
  let imgUrl = g('ms_imgUrl');
  const fileInput = document.getElementById('ms_imgFile');
  if (fileInput?.files[0]) {
    const statusEl = document.getElementById('ms_imgStatus');
    imgUrl = await uploadToImgBB(fileInput.files[0], statusEl);
    if (!imgUrl) return;
  }
  
  const res = await api('/api/admin/shares', {
    method: 'POST',
    body: JSON.stringify({ name, price, dailyIncome: daily, duration, img: imgUrl || '' })
  });
  
  if (res?.success) {
    showToast(`✅ "${name}" share created!`, 'success');
    closeModal();
    loadShares();
  } else {
    showToast(res?.error || 'Error creating share', 'error');
  }
}

function openEditShareModal(id) {
  const s = _shares.find(x => x._id === id);
  if (!s) return;
  showConfirm({
    title: 'Edit package',
    msg: `    <div class="modal-body">

          <div class="form-group">
        <label>Package Name</label>
        <input id="es_name" value="${s.name}">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Price (FEX)</label>
          <input type="number" id="es_price" value="${s.price}">
        </div>
        <div class="form-group">
          <label>Duration (Days)</label>
          <input type="number" id="es_duration" value="${s.duration}">
        </div>
      </div>
      <div class="form-group">
        <label>Daily Income (FEX)</label>
        <input type="number" id="es_daily" value="${s.dailyIncome}">
      </div>
      <div class="form-group">
        <label>Image URL (optional)</label>
        <input id="es_img" value="${s.img||''}" placeholder="https://...">
      </div>
      ${s.img ? `<img src="${s.img}" style="width:100%;height:80px;object-fit:cover;border-radius:8px;margin-bottom:10px;" onerror="this.style.display='none'">` : ''}
    </div>`,
    type: 'warning',
    yesLabel: 'Save changes',
    onYes: () => submitEditShare(id),
    icon: false,
  });
}

async function submitEditShare(id) {
  const g = id => document.getElementById(id)?.value;
  const payload = {
    name: g('es_name')?.trim(),
    price: Number(g('es_price')),
    dailyIncome: Number(g('es_daily')),
    duration: Number(g('es_duration')),
    img: g('es_img')?.trim() || '',
  };
  if (!payload.name || !payload.price) { showToast('Name and price required', 'error'); return; }
  
  const res = await api(`/api/admin/shares/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
  
  if (res?.success) {
    showToast('Share updated!', 'success');
    closeModal();
    loadShares();
  } else {
    showToast(res?.error || 'Error updating share', 'error');
  }
}

async function deleteShare(id, name) {
  showConfirm({
    title: `Delete "${name}"?`,
    msg: 'This share package will be removed permanently. Users who already bought it will keep their investment.',
    type: 'danger',
    yesLabel: 'Delete Share',
    onYes: async () => {
      const res = await api(`/api/admin/shares/${id}`, { method: 'DELETE' });
      if (res?.success) {
        showToast(`"${name}" deleted`, 'warning');
        loadShares();
      } else {
        showToast(res?.error || 'Error deleting share', 'error');
      }
    }
  });
}

// ═══════════════════════════════════════════════════════════
// CRUD — PURCHASED SHARES (User Investments)
// ═══════════════════════════════════════════════════════════
function viewInvestmentDetail(inv) {
  const username = inv.userId?.username || inv.username || '—';
  const pct = progressPct(inv);
  const left = daysLeft(inv);
  const earned = Math.floor(((inv.duration || 0) - left) * (inv.dailyIncome || 0));
  
  showConfirm({
    title: 'Investment Details',
    msg: `      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;padding:12px;background:var(--bg);border-radius:10px;">
        <div class="avatar" style="width:40px;height:40px;font-size:14px;background:${avatarColor(username)}">${initials(username)}</div>
        <div>
          <div style="font-weight:700;font-size:14px;">${username}</div>
          <div style="font-size:12px;color:var(--text3);">${inv.userId?.email||'—'}</div>
        </div>
        <div style="margin-left:auto;">${isExpired(inv)?'<span class="badge expired">Expired</span>':'<span class="badge active">🟢 Active</span>'}</div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;">
        <div style="background:var(--bg);border-radius:10px;padding:10px 12px;">
          <div style="font-size:10px;color:var(--text3);font-weight:700;text-transform:uppercase;margin-bottom:3px;">Package</div>
          <div style="font-weight:700;">${inv.shareName||'—'}</div>
        </div>
        <div style="background:var(--bg);border-radius:10px;padding:10px 12px;">
          <div style="font-size:10px;color:var(--text3);font-weight:700;text-transform:uppercase;margin-bottom:3px;">Price Paid</div>
          <div style="font-weight:700;">🪙${Number(inv.pricePaid||0).toLocaleString()} FEX</div>
        </div>
        <div style="background:var(--bg);border-radius:10px;padding:10px 12px;">
          <div style="font-size:10px;color:var(--text3);font-weight:700;text-transform:uppercase;margin-bottom:3px;">Daily Income</div>
          <div style="font-weight:700;color:var(--success);">🪙${Number(inv.dailyIncome||0).toLocaleString()}/day</div>
        </div>
        <div style="background:var(--bg);border-radius:10px;padding:10px 12px;">
          <div style="font-size:10px;color:var(--text3);font-weight:700;text-transform:uppercase;margin-bottom:3px;">Earned So Far</div>
          <div style="font-weight:700;color:var(--primary);">🪙${earned.toLocaleString()} FEX</div>
        </div>
        <div style="background:var(--bg);border-radius:10px;padding:10px 12px;">
          <div style="font-size:10px;color:var(--text3);font-weight:700;text-transform:uppercase;margin-bottom:3px;">Days Left</div>
          <div style="font-weight:700;">${isExpired(inv) ? 'Completed' : left+' of '+inv.duration}</div>
        </div>
        <div style="background:var(--bg);border-radius:10px;padding:10px 12px;">
          <div style="font-size:10px;color:var(--text3);font-weight:700;text-transform:uppercase;margin-bottom:3px;">Purchased</div>
          <div style="font-weight:700;font-size:12px;">${inv.purchaseDate ? new Date(inv.purchaseDate).toLocaleDateString() : '—'}</div>
        </div>
      </div>

      <div style="margin-bottom:6px;font-size:12px;font-weight:600;color:var(--text2);">Progress — ${pct}%</div>
      <div class="progress-bar" style="height:8px;">
        <div class="progress-fill" style="width:${pct}%;background:${isExpired(inv)?'var(--text3)':'var(--success)'}"></div>
      </div>
    </div>`,
    type: 'warning',
    yesLabel: 'Remove Investment',
    onYes: async () => {
      deleteInvestment('${inv._id}', '${username}')
    },
    icon: false
  });
}

async function deleteInvestment(id, username) {
  showConfirm({
    title: 'Remove Investment?',
    msg: `Remove <strong>${username}</strong>'s investment? This cannot be undone.`,
    type: 'danger',
    yesLabel: 'Remove Investment',
    onYes: async () => {
      const res = await api(`/api/admin/purchased-shares/${id}`, { method: 'DELETE' });
      if (res?.success) {
        showToast(`Investment removed for ${username}`, 'warning');
        loadInvestments();
      } else {
        showToast(res?.error || 'Error removing investment', 'error');
      }
    }
  });
}

// ═══════════════════════════════════════════════════════════
// IMGBB UPLOAD (reuses your existing function if available)
// ═══════════════════════════════════════════════════════════
async function uploadToImgBB(file, statusEl) {
  if (statusEl) statusEl.innerHTML = '<i class="ri-loader-line"></i> Uploading image...';
  try {
    const settingsData = await api('/api/admin/settings/apikeys');
    const imgbbKey = settingsData?.apikeys?.imgbb;
    if (!imgbbKey) {
      if (statusEl) statusEl.innerHTML = '';
      showToast('ImgBB API key not set in Settings', 'error');
      return null;
    }
    const formData = new FormData();
    formData.append('image', file);
    const res = await fetch(`https://api.imgbb.com/1/upload?key=${imgbbKey}`, { method: 'POST', body: formData });
    const result = await res.json();
    if (result.success) {
      if (statusEl) statusEl.innerHTML = '✅ Image uploaded';
      return result.data.url;
    } else {
      if (statusEl) statusEl.innerHTML = '';
      showToast('ImgBB upload failed', 'error');
      return null;
    }
  } catch (err) {
    if (statusEl) statusEl.innerHTML = '';
    showToast('Upload error: ' + err.message, 'error');
    return null;
  }
}

// ═══════════════════════════════════════════════════════════
// UI HELPERS
// ═══════════════════════════════════════════════════════════
function paginate(arr, page, per) {
  return arr.slice((page - 1) * per, page * per);
}

function renderPagination(prefix, total, page, onPage) {
  const totalPages = Math.ceil(total / INV_PER_PAGE);
  const wrap = document.getElementById(prefix + 'Pagination');
  const info = document.getElementById(prefix + 'PageInfo');
  const btns = document.getElementById(prefix + 'PageBtns');
  if (!wrap) return;
  if (totalPages <= 1) { wrap.style.display = 'none'; return; }
  wrap.style.display = 'flex';
  const start = (page - 1) * INV_PER_PAGE + 1;
  const end = Math.min(page * INV_PER_PAGE, total);
  if (info) info.textContent = `${start}–${end} of ${total}`;
  
  const range = [];
  let s = Math.max(1, page - 2),
    e = Math.min(totalPages, s + 4);
  if (e - s < 4) s = Math.max(1, e - 4);
  for (let i = s; i <= e; i++) range.push(i);
  
  btns.innerHTML = `
    <button ${page<=1?'disabled':''} onclick="(${onPage.toString()})(${page-1})"><i class="ri-arrow-left-s-line"></i></button>
    ${range.map(p=>`<button class="${p===page?'active':''}" onclick="(${onPage.toString()})(${p})">${p}</button>`).join('')}
    <button ${page>=totalPages?'disabled':''} onclick="(${onPage.toString()})(${page+1})"><i class="ri-arrow-right-s-line"></i></button>`;
}

function hidePagination(prefix) {
  const el = document.getElementById(prefix + 'Pagination');
  if (el) el.style.display = 'none';
}

function setLoading(tbodyId, cols) {
  const el = document.getElementById(tbodyId);
  if (el) el.innerHTML = `<tr><td colspan="${cols}"><div class="state-box"><div class="spinner"></div><p>Loading…</p></div></td></tr>`;
}

function setEmpty(tbodyId, cols, msg) {
  const el = document.getElementById(tbodyId);
  if (el) el.innerHTML = `<tr><td colspan="${cols}"><div class="state-box"><i class="ri-inbox-line"></i><p>${msg}</p></div></td></tr>`;
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ── TOAST ──────────────────────────────────────────────────
let _tw = null;

function showToast(msg, type = 'success') {
  if (!_tw) {
    _tw = document.createElement('div');
    _tw.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:99999;display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none;width:max-content';
    document.body.appendChild(_tw);
  }
  const colors = { success: '#05cd99', warning: '#f6ad55', error: '#ee5d50' };
  const t = document.createElement('div');
  t.style.cssText = `background:${colors[type]||'#4318ff'};color:#fff;padding:10px 18px;border-radius:20px;font-size:13px;font-weight:600;box-shadow:0 4px 16px rgba(0,0,0,0.15);animation:toastIn 0.2s ease;`;
  t.textContent = msg;
  _tw.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transition = 'opacity 0.3s';
    setTimeout(() => t.remove(), 300);
  }, 3000);
}
const s2 = document.createElement('style');
s2.textContent = '@keyframes toastIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}';
document.head.appendChild(s2);


// ══════════════════════════════════════════════════════════
// FLUX MALL — Admin Task Manager
// ══════════════════════════════════════════════════════════
const CAT_ICONS = { Social: 'ri-share-line', Survey: 'ri-questionnaire-line', Watch: 'ri-play-circle-line', Download: 'ri-download-line', Review: 'ri-star-line', General: 'ri-task-line' };
const PLATFORM_META = {
  X: { icon: 'ri-twitter-x-line', color: '#000000', label: 'X (Twitter)' },
  Facebook: { icon: 'ri-facebook-fill', color: '#1877f2', label: 'Facebook' },
  Instagram: { icon: 'ri-instagram-line', color: '#e1306c', label: 'Instagram' },
  GitHub: { icon: 'ri-github-fill', color: '#24292e', label: 'GitHub' },
  YouTube: { icon: 'ri-youtube-line', color: '#ff0000', label: 'YouTube' },
  Custom: { icon: 'ri-global-line', color: '#4318ff', label: 'Custom' },
};
const CAT_COLORS = { Social: '#4299e1', Survey: '#9f7aea', Watch: '#ee5d50', Download: '#05cd99', Review: '#f6ad55', General: '#4318ff' };

let _atTasks = [];
let _atSubs = [];
let _atSubFiltered = [];
let _atSubPage = 1;
const AT_PER = 20;

function atAvatarColor(s) { let h = 0; for (let i = 0; i < (s || '').length; i++) h = s.charCodeAt(i) + ((h << 5) - h); return COLORS[Math.abs(h) % COLORS.length]; }

function atInitials(s) { return (s || '?').slice(0, 2).toUpperCase(); }



// ══════════════════════════════════════════════════════════
// TASK CATALOG
// ══════════════════════════════════════════════════════════
async function atLoadTasks() {
  document.getElementById('atTasksGrid').innerHTML =
    `<div class="state-box" style="grid-column:1/-1"><div class="spinner"></div><p>Loading…</p></div>`;
  
  const data = await api('/api/admin/tasks');
  _atTasks = data?.tasks || [];
  
  // Stats
  const totalPending = _atSubs.filter(s => s.status === 'pending').length;
  const totalApproved = _atSubs.filter(s => s.status === 'approved').length;
  const totalDeclined = _atSubs.filter(s => s.status === 'declined').length;
  atSetText('atStatTasks', _atTasks.length);
  atSetText('atStatPending', totalPending);
  atSetText('atStatApproved', totalApproved);
  atSetText('atStatDeclined', totalDeclined);
  atSetText('atTcCatalog', _atTasks.length);
  
  // Populate category filter
  const cats = [...new Set(_atTasks.map(t => t.category).filter(Boolean))];
  const catSel = document.getElementById('atCatFilter');
  if (catSel) { catSel.innerHTML = '<option value="all">All Categories</option>' + cats.map(c => `<option value="${c}">${c}</option>`).join(''); }
  
  atRenderCatalog(_atTasks);
}

let _atCatalogFiltered = [];
let _atStatusFilter = 'all';
let _atCatFilter = 'all';
let _atSearchFilter = '';

function atFilterCatalog(term) {
  _atSearchFilter = term.toLowerCase();
  atApplyCatalogFilters();
}

function atFilterCatalogStatus(v) {
  _atStatusFilter = v;
  atApplyCatalogFilters();
}

function atFilterCatalogCategory(v) {
  _atCatFilter = v;
  atApplyCatalogFilters();
}

function atApplyCatalogFilters() {
  _atCatalogFiltered = _atTasks.filter(t => {
    const matchSearch = !_atSearchFilter || t.title.toLowerCase().includes(_atSearchFilter) || t.description.toLowerCase().includes(_atSearchFilter);
    const matchStatus = _atStatusFilter === 'all' || (_atStatusFilter === 'active' ? t.active : !t.active);
    const matchCat = _atCatFilter === 'all' || t.category === _atCatFilter;
    return matchSearch && matchStatus && matchCat;
  });
  atRenderCatalog(_atCatalogFiltered);
}

function atRenderCatalog(tasks) {
  const grid = document.getElementById('atTasksGrid');
  if (!tasks.length) {
    grid.innerHTML = `<div class="state-box" style="grid-column:1/-1">
      <i class="ri-task-line"></i><p>No tasks found. Click <strong>+ New Task</strong> to create one.</p></div>`;
    return;
  }
  grid.innerHTML = tasks.map(t => {
    const icon = CAT_ICONS[t.category] || 'ri-task-line';
    const color = CAT_COLORS[t.category] || '#4318ff';
    const exp = t.expiresAt ? `<span style="font-size:11px;color:var(--danger);">⏳ ${new Date(t.expiresAt).toLocaleDateString()}</span>` : '';
    const maxTag = t.maxCompletions > 0 ? `<span style="font-size:11px;color:var(--text3);">Max: ${t.approvedCount}/${t.maxCompletions}</span>` : '';
    
    return `
    <div class="task-card ${t.active?'':'inactive'}">
      <div class="tc-header">
        <div class="tc-icon" style="background:${color}22;color:${color};">
          <i class="${icon}"></i>
        </div>
        <div style="flex:1;min-width:0;">
          <div class="tc-title">${t.title}</div>
          <div class="tc-cat">${t.category}${t.platform&&t.category==='Social'?` · <span style="font-weight:700;">${t.platform}</span>`:''} · ${t.proofType}</div>
        </div>
        <div style="display:flex;align-items:center;gap:4px;">
          <div class="status-dot ${t.active?'active':'inactive'}"></div>
        </div>
      </div>

      <div class="tc-points"><i class="ri-coin-line"></i> 🪙${Number(t.points).toLocaleString()} FEX reward</div>
      <div class="tc-desc">${t.description}</div>
      ${t.taskLink?`<a href="${t.taskLink}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:5px;font-size:11px;color:var(--primary);background:var(--primary-soft);border-radius:6px;padding:3px 9px;margin-bottom:8px;text-decoration:none;font-weight:600;"><i class="ri-external-link-line"></i> Task Link</a>`:''}

      <div class="tc-stats">
        <div class="tc-stat">
          <span class="tc-stat-val" style="color:var(--text1);">${t.totalSubmissions||0}</span>
          <span class="tc-stat-label">Total</span>
        </div>
        <div class="tc-stat">
          <span class="tc-stat-val" style="color:var(--success);">${t.approvedCount||0}</span>
          <span class="tc-stat-label">Approved</span>
        </div>
        <div class="tc-stat">
          <span class="tc-stat-val" style="color:var(--warning);">${t.pendingCount||0}</span>
          <span class="tc-stat-label">Pending</span>
        </div>
      </div>

      <div style="display:flex;gap:6px;align-items:center;margin-bottom:10px;flex-wrap:wrap;">${exp}${maxTag}</div>

      <div class="tc-actions">
        <button class="btn btn-warning btn-sm" style="flex:1" onclick="openEditTaskModal('${t._id}')">
          <i class="ri-edit-line"></i> Edit
        </button>
        <button class="btn btn-ghost btn-sm" onclick="atToggleActive('${t._id}',${!t.active})" title="${t.active?'Deactivate':'Activate'}">
          <i class="ri-${t.active?'pause':'play'}-circle-line"></i>
        </button>
        <button class="btn btn-danger btn-sm" onclick="atDeleteTask('${t._id}','${t.title}')">
          <i class="ri-delete-bin-line"></i>
        </button>
      </div>
    </div>`;
  }).join('');
}


// ══════════════════════════════════════════════════════════
// SUBMISSIONS
// ══════════════════════════════════════════════════════════
async function atLoadSubmissions() {
  const data = await api('/api/admin/tasks/submissions?limit=500');
  _atSubs = data?.submissions || [];
  _atSubFiltered = [..._atSubs];
  atSetText('atTcSubmissions', _atSubs.length);
  
  // Update stat counts after subs load
  atSetText('atStatPending', _atSubs.filter(s => s.status === 'pending').length);
  atSetText('atStatApproved', _atSubs.filter(s => s.status === 'approved').length);
  atSetText('atStatDeclined', _atSubs.filter(s => s.status === 'declined').length);
  
  _atSubPage = 1;
  atRenderSubsPage();
}

function atFilterSubmissions(term) {
  term = term.toLowerCase();
  const statusSel = document.querySelector('#at-panel-submissions .filter-select')?.value || 'all';
  atApplySubFilters(term, statusSel);
}

function atFilterSubStatus(status) {
  const term = document.querySelector('#at-panel-submissions .search-box input')?.value.toLowerCase() || '';
  atApplySubFilters(term, status);
}

function atApplySubFilters(term, status) {
  _atSubFiltered = _atSubs.filter(s => {
    const user = (s.userId?.username || '').toLowerCase();
    const task = (s.taskId?.title || '').toLowerCase();
    const matchQ = !term || user.includes(term) || task.includes(term);
    const matchS = status === 'all' || s.status === status;
    return matchQ && matchS;
  });
  _atSubPage = 1;
  atRenderSubsPage();
}

function atRenderSubsPage() {
  const tbody = document.getElementById('atSubTableBody');
  if (!_atSubFiltered.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="state-box"><i class="ri-inbox-line"></i><p>No submissions found</p></div></td></tr>`;
    document.getElementById('atSubPagination').style.display = 'none';
    return;
  }
  const start = (_atSubPage - 1) * AT_PER;
  const slice = _atSubFiltered.slice(start, start + AT_PER);
  
  tbody.innerHTML = slice.map(s => {
    const uname = s.userId?.username || '—';
    const date = s.createdAt ? new Date(s.createdAt).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
    const pts = s.points || s.taskId?.points || 0;
    const proof = s.proof || '—';
    const isImg = proof.startsWith('http') && (proof.includes('imgbb') || proof.includes('imgur') || proof.includes('.png') || proof.includes('.jpg'));
    const isUrl = proof.startsWith('http') && !isImg;
    
    let proofHtml = '—';
    if (proof && proof !== '—') {
      if (isImg) proofHtml = `<div class="proof-box" onclick="atViewProof('img','${proof}','${uname}')"><i class="ri-image-line"></i> Screenshot</div>`;
      else if (isUrl) proofHtml = `<div class="proof-box" onclick="window.open('${proof}','_blank')"><i class="ri-link"></i> ${proof.substring(0,30)}…</div>`;
      else proofHtml = `<div class="proof-box" title="${proof}" onclick="atViewProof('text','${encodeURIComponent(proof)}','${uname}')">${proof.substring(0,30)}${proof.length>30?'…':''}</div>`;
    }
    
    return `<tr>
      <td>
        <div class="user-chip">
          <div class="avatar" style="background:${atAvatarColor(uname)}">${atInitials(uname)}</div>
          <div>
            <div class="username">${uname}</div>
            <div class="user-sub">${s.userId?.email||'—'}</div>
          </div>
        </div>
      </td>
      <td>
        <div style="font-weight:700;font-size:12px;">${s.taskId?.title||'—'}</div>
        <div style="font-size:11px;color:var(--text3);">${s.taskId?.category||''}</div>
      </td>
      <td><span style="font-weight:700;color:var(--primary);">🪙${Number(pts).toLocaleString()}</span></td>
      <td>${proofHtml}</td>
      <td style="font-size:11px;color:var(--text3);white-space:nowrap;">${date}</td>
      <td>${atStatusBadge(s.status)}</td>
      <td>
        <div class="action-group">
          ${s.status==='pending' ? `
            <button class="btn btn-success btn-sm" onclick="atReviewSub('${s._id}','approved','${uname}','${s.taskId?.title||''}')">
              <i class="ri-check-line"></i> Approve
            </button>
            <button class="btn btn-danger btn-sm" onclick="atOpenDeclineModal('${s._id}','${uname}','${s.userId?.ib||0}')">
              <i class="ri-close-line"></i> Decline
            </button>
          ` : `
            <button class="btn btn-ghost btn-sm" onclick="atViewSubDetail(${JSON.stringify(s).replace(/"/g,'&quot;')})">
              <i class="ri-eye-line"></i>
            </button>
            <button class="btn btn-danger btn-sm" onclick="atDeleteSub('${s._id}')">
              <i class="ri-delete-bin-line"></i>
            </button>
          `}
        </div>
      </td>
    </tr>`;
  }).join('');
  
  atRenderPagination(_atSubFiltered.length, _atSubPage, (p) => {
    _atSubPage = p;
    atRenderSubsPage();
  });
}

// ══════════════════════════════════════════════════════════
// CRUD — TASKS
// ══════════════════════════════════════════════════════════
// ── PLATFORM HELPER ─────────────────────────────────────
function atTogglePlatform(selectId, wrapId) {
  const cat = document.getElementById(selectId)?.value;
  const wrap = document.getElementById(wrapId);
  if (!wrap) return;
  if (cat === 'Social') {
    wrap.style.display = 'block';
    wrap.style.animation = 'fadeSlideDown .18s ease';
  } else {
    wrap.style.display = 'none';
  }
}

function atGetPlatform(selectId) {
  const wrap = document.getElementById(selectId)?.closest('.form-group')?.nextElementSibling;
  // just read by id directly
  return null;
}

function openCreateTaskModal() {
  showConfirm({
    title: 'New Task',
    msg: ` <div class="form-group">
        <label>Task Title *</label>
        <input id="ct_title" placeholder="e.g. Follow us on Twitter">
      </div>
      <div class="form-group">
        <label>Description *</label>
        <textarea id="ct_desc" rows="3" placeholder="What the user needs to do…"></textarea>
      </div>
      <div class="form-group">
        <label>Step-by-step Instructions</label>
        <textarea id="ct_instr" rows="2" placeholder="1. Go to… 2. Click… 3. Screenshot…"></textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Points (FEX) *</label>
          <input type="number" id="ct_points" placeholder="500" min="1">
        </div>
        <div class="form-group">
          <label>Category</label>
          <select id="ct_cat" onchange="atTogglePlatform('ct_cat','ct_platform_wrap')">
            <option value="General">General</option>
            <option value="Social">Social</option>
            <option value="Survey">Survey</option>
            <option value="Watch">Watch</option>
            <option value="Download">Download</option>
            <option value="Review">Review</option>
          </select>
        </div>
      </div>
      <div id="ct_platform_wrap" style="display:none;">
        <div class="form-group">
          <label>Platform</label>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;" id="ct_platform_grid">
            <label class="platform-chip" data-val="X" onclick="atSelectPlatform(this,'ct')">
              <i class="ri-twitter-x-line"></i><span>X</span>
            </label>
            <label class="platform-chip" data-val="Facebook" onclick="atSelectPlatform(this,'ct')">
              <i class="ri-facebook-fill" style="color:#1877f2"></i><span>Facebook</span>
            </label>
            <label class="platform-chip" data-val="Instagram" onclick="atSelectPlatform(this,'ct')">
              <i class="ri-instagram-line" style="color:#e1306c"></i><span>Instagram</span>
            </label>
            <label class="platform-chip" data-val="GitHub" onclick="atSelectPlatform(this,'ct')">
              <i class="ri-github-fill"></i><span>GitHub</span>
            </label>
            <label class="platform-chip" data-val="YouTube" onclick="atSelectPlatform(this,'ct')">
              <i class="ri-youtube-line" style="color:#ff0000"></i><span>YouTube</span>
            </label>
            <label class="platform-chip" data-val="Custom" onclick="atSelectPlatform(this,'ct')">
              <i class="ri-global-line" style="color:#4318ff"></i><span>Custom</span>
            </label>
          </div>
          <input type="hidden" id="ct_platform" value="">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Proof Type</label>
          <select id="ct_proof">
            <option value="screenshot">Screenshot (image URL)</option>
            <option value="url">URL link</option>
            <option value="text">Text response</option>
            <option value="none">No proof needed</option>
          </select>
        </div>
        <div class="form-group">
          <label>Max Completions (0 = unlimited)</label>
          <input type="number" id="ct_max" placeholder="0" min="0" value="0">
        </div>
      </div>
      <div class="form-group">
        <label>Expiry Date (optional)</label>
        <input type="datetime-local" id="ct_expires">
      </div>
      <div class="form-group">
        <label>Task Link (optional — shown to user as a button)</label>
        <input type="url" id="ct_link" placeholder="https://twitter.com/FluxMall — link user clicks to do the task">
      </div>
    </div>`,
    type: 'warning',
    yesLabel: 'Create Task',
    onYes: async () => {
      const g = id => document.getElementById(id)?.value;
      const title = g('ct_title')?.trim();
      const desc = g('ct_desc')?.trim();
      const points = Number(g('ct_points'));
      if (!title || !desc || !points) { showToast('Title, description and points are required', 'error'); return; }
      
      const res = await api('/api/admin/tasks', {
        method: 'POST',
        body: JSON.stringify({
          title,
          description: desc,
          instructions: g('ct_instr')?.trim() || '',
          points,
          category: g('ct_cat'),
          platform: g('ct_platform') || '',
          proofType: g('ct_proof'),
          maxCompletions: Number(g('ct_max')) || 0,
          expiresAt: g('ct_expires') || null,
          taskLink: g('ct_link')?.trim() || '',
        })
      });
      
      if (res?.success) {
        showToast(`Task "${title}" created!`, 'success');
        atLoadTasks();
      } else {
        showToast(res?.error || 'Error creating task', 'error');
      }
    },
    icon: false
  });
}


function openEditTaskModal(id) {
  const t = _atTasks.find(x => x._id === id);
  if (!t) return;
  showConfirm({
    title: "Edit Task",
    msg: `
    <div class="modal-body">
      <div class="form-group">
        <label>Task Title</label>
        <input id="et_title" value="${t.title}">
      </div>
      <div class="form-group">
        <label>Description</label>
        <textarea id="et_desc" rows="3">${t.description}</textarea>
      </div>
      <div class="form-group">
        <label>Instructions</label>
        <textarea id="et_instr" rows="2">${t.instructions||''}</textarea>
      </div>
      <div class="form-group">
        <label>Task Link (optional — shown to user as a button)</label>
        <input type="url" id="et_link" value="${t.taskLink||''}" placeholder="https://…">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Points (FEX)</label>
          <input type="number" id="et_points" value="${t.points}">
        </div>
        <div class="form-group">
          <label>Category</label>
          <select id="et_cat" onchange="atTogglePlatform('et_cat','et_platform_wrap')">
            ${['General','Social','Survey','Watch','Download','Review'].map(c=>`<option value="${c}" ${t.category===c?'selected':''}>${c}</option>`).join('')}
          </select>
        </div>
      </div>
      <div id="et_platform_wrap" style="display:${t.category==='Social'?'block':'none'};">
        <div class="form-group">
          <label>Platform</label>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;" id="et_platform_grid">
            ${['X','Facebook','Instagram','GitHub','YouTube','Custom'].map(p=>{
              const pm = PLATFORM_META[p];
              const sel = t.platform===p;
              return `<label class="platform-chip ${sel?'selected':''}" data-val="${p}" onclick="atSelectPlatform(this,'et')">
                <i class="${pm.icon}" style="color:${sel?'#fff':pm.color}"></i><span>${p==='X'?'X':p}</span>
              </label>`;
            }).join('')}
          </div>
          <input type="hidden" id="et_platform" value="${t.platform||''}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Proof Type</label>
          <select id="et_proof">
            ${['screenshot','url','text','none'].map(p=>`<option value="${p}" ${t.proofType===p?'selected':''}>${p}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Max Completions</label>
          <input type="number" id="et_max" value="${t.maxCompletions||0}" min="0">
        </div>
      </div>
      <div class="form-group">
        <label>Status</label>
        <select id="et_active">
          <option value="true"  ${t.active?'selected':''}>Active</option>
          <option value="false" ${!t.active?'selected':''}>Inactive</option>
        </select>
      </div>
    </div>
  `,
    type: "warning",
    yesLabel: "Save",
    onYes: async () => {
      const g = id2 => document.getElementById(id2)?.value;
      const res = await api(`/api/admin/tasks/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: g('et_title')?.trim(),
          description: g('et_desc')?.trim(),
          instructions: g('et_instr')?.trim(),
          points: Number(g('et_points')),
          category: g('et_cat'),
          platform: g('et_platform') || '',
          proofType: g('et_proof'),
          maxCompletions: Number(g('et_max')) || 0,
          active: g('et_active') === 'true',
          taskLink: g('et_link')?.trim() || '',
        })
      });
      if (res?.success) {
        showToast('Task updated!', 'success');
        atLoadTasks();
      }
      else showToast(res?.error || 'Error', 'error');
    },
    icon: false
  });
}

async function atToggleActive(id, active) {
  const res = await api(`/api/admin/tasks/${id}`, { method: 'PUT', body: JSON.stringify({ active }) });
  if (res?.success) {
    showToast(active ? 'Task activated' : 'Task deactivated', active ? 'success' : 'warning');
    atLoadTasks();
  }
  else showToast(res?.error || 'Error', 'error');
}

async function atDeleteTask(id, name) {
  showConfirm({
    title: `Delete task "${name}"?`,
    msg: 'All submissions will also be deleted.',
    type: 'danger',
    yesLabel: 'Delete',
    onYes: async () => {
      const res = await api(`/api/admin/tasks/${id}`, { method: 'DELETE' });
      if (res?.success) {
        showToast(`"${name}" deleted`, 'warning');
        atLoadTasks();
        atLoadSubmissions();
      }
      else showToast(res?.error || 'Error', 'error');
    },
  });
}

// ══════════════════════════════════════════════════════════
// REVIEW SUBMISSIONS
// ══════════════════════════════════════════════════════════
async function atReviewSub(id, status, username, taskTitle) {
  showConfirm({
    title: `Approve Submission`,
    msg: `Approve ${username}'s submission for "${taskTitle}"?`,
    type: 'warning',
    yesLabel: 'Approve',
    onYes: async () => {
      const res = await api(`/api/admin/tasks/submissions/${id}`, { method: 'PUT', body: JSON.stringify({ status }) });
      if (res?.success) {
        showToast(`✅ Submission approved — user credited!`, 'success');
        atLoadSubmissions();
        atLoadTasks(); // refresh pending counts on cards
      } else {
        showToast(res?.error || 'Error', 'error');
      }
    },
  });
}

function atOpenDeclineModal(id, username, balance) {
  const penalty = parseFloat((Number(balance) * 0.05).toFixed(2));
  showConfirm({
    title: "Decline Submission",
    msg: `
    <div class="modal-body">
      <div style="background:var(--danger-soft);border-radius:10px;padding:12px 14px;margin-bottom:16px;font-size:13px;color:var(--danger);">
        ⚠️ Declining will deduct <strong>5% (🪙${penalty.toLocaleString()} FEX)</strong> from <strong>${username}</strong>'s balance.
      </div>
      <div class="form-group">
        <label>Reason for decline (shown to user)</label>
        <textarea id="dec_note" rows="3" placeholder="e.g. Screenshot not clear, task not completed correctly…"></textarea>
      </div>
    </div>`,
    type: "warning",
    yesLabel: `Decline & Deduct ${penalty.toLocaleString()} FEX`,
    onYes: async () => {
      const note = document.getElementById('dec_note')?.value.trim();
      const res = await api(`/api/admin/tasks/submissions/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'declined', adminNote: note || '' })
      });
      if (res?.success) {
        showToast(`Submission declined — 5% deducted from ${username}`, 'warning');
        atLoadSubmissions();
        atLoadTasks();
      } else {
        showToast(res?.error || 'Error', 'error');
      }
    }
  });
}


function atViewSubDetail(s) {
  const uname = s.userId?.username || '—';
  const pts = s.points || s.taskId?.points || 0;
  const proof = s.proof || '—';
  const isImg = proof.startsWith('http') && (proof.includes('imgbb') || proof.includes('.png') || proof.includes('.jpg') || proof.includes('.jpeg') || proof.includes('.webp'));
  
  showConfirm({
    title: "Submission Details",
    msg: `
    <div class="modal-body">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;padding:12px;background:var(--bg);border-radius:10px;">
        <div class="avatar" style="width:38px;height:38px;font-size:13px;background:${atAvatarColor(uname)}">${atInitials(uname)}</div>
        <div>
          <div style="font-weight:700;">${uname}</div>
          <div style="font-size:11px;color:var(--text3);">${s.userId?.email||'—'}</div>
        </div>
        <div style="margin-left:auto;">${atStatusBadge(s.status)}</div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;">
        <div style="background:var(--bg);border-radius:10px;padding:10px 12px;">
          <div style="font-size:10px;color:var(--text3);font-weight:700;text-transform:uppercase;margin-bottom:3px;">Task</div>
          <div style="font-weight:700;font-size:12px;">${s.taskId?.title||'—'}</div>
        </div>
        <div style="background:var(--bg);border-radius:10px;padding:10px 12px;">
          <div style="font-size:10px;color:var(--text3);font-weight:700;text-transform:uppercase;margin-bottom:3px;">Reward</div>
          <div style="font-weight:700;color:var(--primary);">🪙${Number(pts).toLocaleString()} FEX</div>
        </div>
        <div style="background:var(--bg);border-radius:10px;padding:10px 12px;">
          <div style="font-size:10px;color:var(--text3);font-weight:700;text-transform:uppercase;margin-bottom:3px;">Submitted</div>
          <div style="font-weight:700;font-size:12px;">${s.createdAt?new Date(s.createdAt).toLocaleString():'—'}</div>
        </div>
        ${s.penalty>0?`<div style="background:var(--danger-soft);border-radius:10px;padding:10px 12px;">
          <div style="font-size:10px;color:var(--danger);font-weight:700;text-transform:uppercase;margin-bottom:3px;">Penalty Deducted</div>
          <div style="font-weight:700;color:var(--danger);">🪙${Number(s.penalty).toLocaleString()} FEX</div>
        </div>`:''}
      </div>

      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--text3);margin-bottom:8px;">Proof Submitted</div>
      ${isImg
        ? `<img src="${proof}" class="proof-img" onclick="window.open('${proof}','_blank')" style="cursor:pointer;">`
        : `<div class="proof-full">${proof}</div>`}

      ${s.adminNote?`<div style="margin-top:12px;background:var(--warning-soft);border-radius:10px;padding:10px 12px;font-size:12px;color:var(--warning);">
        <strong>Admin Note:</strong> ${s.adminNote}
      </div>`:''}
    </div>
    <div class="modal-footer">
      ${s.status==='pending'?`
        <button class="btn btn-danger" onclick="atOpenDeclineModal('${s._id}','${uname}','${s.userId?.ib||0}');"><i class="ri-close-line"></i> Decline</button>
      `:''}
    </div>
  `,
    type: "warning",
    yesLabel: "Approve",
    onYes: () => {
      atReviewSub(s._id, 'approved', uname, s.taskId?.title || '')
    },
    icon: false
  });
}

function atViewProof(type, data, username) {
  const isImg = type === 'img';
  const text = isImg ? data : decodeURIComponent(data);
  showConfirm({
    title: `Proof — ${username}`,
    msg: `
    <div class="modal-body">
      ${isImg
        ? `<img src="${text}" class="proof-img" onclick="window.open('${text}','_blank')" style="cursor:pointer;width:100%;">`
        : `<div class="proof-full">${text}</div>`}
    </div>
    <div class="modal-footer">
      ${isImg?`<button class="btn btn-primary" onclick="window.open('${text}','_blank')"><i class="ri-external-link-line"></i> Open Full</button>`:''}
    </div>
  `,
    type: "warning",
    yesLabel: "Open Full",
    onYes: () => {
      if (isImg) {
        window.open(text, '_blank')
      }
    },
    icon: false
  });
}

async function atDeleteSub(id) {
  showConfirm({
    title: 'Delete Submission?',
    msg: 'Delete this submission record?',
    type: 'warning',
    yesLabel: 'Delete',
    onYes: async () => {
      const res = await api(`/api/admin/tasks/submissions/${id}`, { method: 'DELETE' });
      if (res?.success) {
        showToast('Deleted', 'warning');
        atLoadSubmissions();
      }
      else showToast(res?.error || 'Error', 'error');
    },
  });
}

// ── PLATFORM CHIP SELECTOR ──────────────────────────────
function atSelectPlatform(chip, prefix) {
  const grid = chip.parentElement;
  grid.querySelectorAll('.platform-chip').forEach(c => {
    c.classList.remove('selected');
    const icon = c.querySelector('i');
    const val = c.dataset.val;
    if (icon && PLATFORM_META[val]) icon.style.color = PLATFORM_META[val].color;
  });
  chip.classList.add('selected');
  const icon = chip.querySelector('i');
  if (icon) icon.style.color = '#fff';
  const hidden = document.getElementById(prefix + '_platform');
  if (hidden) hidden.value = chip.dataset.val;
}

// ══════════════════════════════════════════════════════════
// UI HELPERS
// ══════════════════════════════════════════════════════════
function atStatusBadge(s) {
  const map = { approved: 'success', pending: 'pending', declined: 'declined' };
  const dot = { approved: '🟢', pending: '🟡', declined: '🔴' };
  const cls = map[s] || 'pending';
  return `<span class="badge ${cls}">${dot[s]||'⚪'} ${(s||'pending').charAt(0).toUpperCase()+(s||'pending').slice(1)}</span>`;
}

function atSetText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function atRenderPagination(total, page, onPage) {
  const totalPages = Math.ceil(total / AT_PER);
  const wrap = document.getElementById('atSubPagination');
  const info = document.getElementById('atSubPageInfo');
  const btns = document.getElementById('atSubPageBtns');
  if (!wrap) return;
  if (totalPages <= 1) { wrap.style.display = 'none'; return; }
  wrap.style.display = 'flex';
  const start = (page - 1) * AT_PER + 1,
    end = Math.min(page * AT_PER, total);
  if (info) info.textContent = `${start}–${end} of ${total}`;
  const range = [];
  let s = Math.max(1, page - 2),
    e = Math.min(totalPages, s + 4);
  if (e - s < 4) s = Math.max(1, e - 4);
  for (let i = s; i <= e; i++) range.push(i);
  btns.innerHTML = `
    <button ${page<=1?'disabled':''} onclick="(${onPage.toString()})(${page-1})"><i class="ri-arrow-left-s-line"></i></button>
    ${range.map(p=>`<button class="${p===page?'active':''}" onclick="(${onPage.toString()})(${p})">${p}</button>`).join('')}
    <button ${page>=totalPages?'disabled':''} onclick="(${onPage.toString()})(${page+1})"><i class="ri-arrow-right-s-line"></i></button>`;
}



// ── Sync the pill + subtitle text whenever toggle changes ─────
function syncMaintUI(isOn) {
  const pill = document.getElementById('maintStatusPill');
  const text = document.getElementById('maintStatusText');
  const mirror = document.getElementById('tgl-maintenance');
  
  // Keep the hidden mirror in sync so fillSettings() can find it
  if (mirror) mirror.value = isOn ? 'true' : 'false';
  
  if (pill) {
    pill.textContent = isOn ? 'ON' : 'OFF';
    pill.style.background = isOn ?
      'rgba(238,93,80,0.12)' // red-soft when ON
      :
      'rgba(5,205,153,0.12)'; // green-soft when OFF
    pill.style.color = isOn ?
      '#ee5d50' // danger
      :
      '#05cd99'; // success
  }
  
  if (text) {
    text.textContent = isOn ?
      '🔴 Platform is in maintenance' :
      '🟢 Platform is live';
  }
}

// ── On page load — reflect current state from API ─────────────
// This runs AFTER loadSettings() has set maintenanceToggle.checked
// We use a MutationObserver to catch when loadSettings() sets the checkbox
const _maintObs = new MutationObserver(() => {});
document.addEventListener('DOMContentLoaded', () => {
  // Poll briefly until the checkbox is set by loadSettings()
  const poll = setInterval(() => {
    const toggle = document.getElementById('maintenanceToggle');
    if (!toggle) return;
    // Once loadSettings() has run it will have set .checked
    // We just sync the UI to match whatever state it is
    syncMaintUI(toggle.checked);
    clearInterval(poll);
  }, 200);
  
  // Fallback — stop polling after 5s regardless
  setTimeout(() => clearInterval(poll), 5000);
});

// ── Payment mode quick-switcher ─────────────────────────────
// Loads current mode on page load and highlights the active pill.
// quickSetPaymentMode() saves instantly without opening the modal.

async function loadPaymentModeBadge() {
  const data = await api('/api/admin/settings');
  const mode = data?.settings?.payment?.mode || 'manual';
  updatePaymentPills(mode);
}

function updatePaymentPills(mode) {
  const badge = document.getElementById('paymentModeBadge');
  const manual = document.getElementById('pillManual');
  const kora = document.getElementById('pillKorapay');
  if (!badge || !manual || !kora) return;
  
  const isManual = mode === 'manual';
  
  // Badge
  badge.textContent = isManual ? 'Manual' : 'Korapay';
  badge.style.background = isManual ? 'rgba(246,173,85,0.15)' : 'rgba(5,205,153,0.12)';
  badge.style.color = isManual ? '#f6ad55' : '#05cd99';
  
  // Active pill
  const activeStyle = 'border-color:green;background:rgba(67,24,255,0.08);color:green;';
  const inactiveStyle = 'border-color:var(--border,#e0e5f2);background:var(--bg,#f4f7fe);color:var(--text2,#4a5568);';
  manual.style.cssText += isManual ? activeStyle : inactiveStyle;
  kora.style.cssText += isManual ? inactiveStyle : activeStyle;
}

async function quickSetPaymentMode(mode) {
  // Fetch existing payment config so we don't wipe manual/korapay keys
  const data = await api('/api/admin/settings');
  const existing = data?.settings?.payment || {};
  
  const config = { ...existing, mode };
  
  const res = await api('/api/admin/settings/payment', {
    method: 'PUT',
    body: JSON.stringify(config)
  });
  
  if (res?.success) {
    updatePaymentPills(mode);
    showToast(`Switched to ${mode === 'manual' ? 'Manual Transfer' : 'Korapay'}`, 'success');
  } else {
    showToast('Failed to switch mode', 'error');
  }
}

// Run on load
loadPaymentModeBadge();



// Boot — check session
//checkAdminSession();