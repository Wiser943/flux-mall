// ============================================================
// FLUX MALL - User Dashboard Script (No Firebase)
// All data fetched from Node.js/MongoDB backend via REST API
// ============================================================

let currentUserData = null;
let globalConfig = { minWithdraw: 2000, withdrawFee: 0 };

// ─── API HELPER ────────────────────────────────────────────
async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options
  });
  if (res.status === 401) { logoutUser(); return null; }
  return res.json();
}

// ─── TOAST ────────────────────────────────────────────────
const notifications = document.querySelector('.notifications');
window.showToast = function (text, type = 'success', icon = '', title = '') {
  if (window.navigator?.vibrate) window.navigator.vibrate(100);
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <i class="${icon} toast-icon"></i>
    <div style="display:inline-block;margin-left:-3px;">
      <div class="title">${title}</div>
      <span>${text}</span>
    </div>
    <i class="ri-close-line cBtn" style="justify-self:flex-end;color:#ff4444;"></i>`;
  notifications.appendChild(toast);
  toast.querySelector('.cBtn').onclick = () => toast.remove();
  setTimeout(() => toast.remove(), 5000);
};

// ─── LOGOUT ───────────────────────────────────────────────
window.logoutUser = async function () {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  localStorage.removeItem('loggedInUser');
  window.location.href = '/account/account.html#login-page';
};

// ─── APPLY THEME ──────────────────────────────────────────
function applyTheme(theme) {
  if (!theme) return;
  const root = document.documentElement;
  root.style.setProperty('--primary', theme.primary || '#4318ff');
  root.style.setProperty('--teal', theme.secondary || '#05cd99');
  if (theme.mode === 'dark') {
    root.style.setProperty('--card-bg', '#111c44');
    root.style.setProperty('--text-main', '#ffffff');
    root.style.setProperty('--text-muted', '#a3adc2');
    root.style.setProperty('--input-bg', '#1b254b');
    root.style.setProperty('--border', 'rgba(255,255,255,0.1)');
  } else {
    root.style.setProperty('--bg-color', '#f4f7fe');
    root.style.setProperty('--card-bg', '#ffffff');
    root.style.setProperty('--text-main', '#2b3674');
    root.style.setProperty('--text-muted', '#a3adc2');
    root.style.setProperty('--input-bg', '#f4f7fe');
    root.style.setProperty('--border', '#e0e5f2');
  }
}

// ─── RENDER LOCK SCREEN ───────────────────────────────────
function renderLockScreen(title, msg) {
  document.body.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;gap:16px;background:#0b1437;color:#fff;text-align:center;padding:20px">
      <h1 style="font-size:3rem">${title.split(' ')[0]}</h1>
      <h2>${title}</h2><p>${msg}</p>
    </div>`;
}

// ─── MAIN INIT ────────────────────────────────────────────
async function init() {
  // 1. Auth check
  const meRes = await api('/api/auth/me');
  if (!meRes?.success) { logoutUser(); return; }
  currentUserData = meRes.user;

  // 2. Load config (theme, branding, announcement, wheel)
  const configRes = await api('/api/user/config');
  if (configRes?.success) {
    const { config, payment, maintenance, wheel } = configRes;

    // Maintenance check
    if (maintenance?.enabled) { renderLockScreen('🛠️ System Maintenance', 'Our site is currently undergoing scheduled upgrades.'); return; }

    // Theme
    if (config.theme) applyTheme(config.theme);

    // Branding
    if (config.siteName) {
      document.querySelectorAll('.site-name').forEach(el => el.innerText = config.siteName);
      document.title = config.siteName;
    }
    if (config.siteLogo) {
      // Show site logo in all avatar spots
      document.querySelectorAll('.logo-img').forEach(img => {
        img.src = config.siteLogo;
        img.onerror = () => img.style.display = 'none';
      });
      // Update browser favicon dynamically
      let fav = document.querySelector("link[rel='icon']");
      if (!fav) { fav = document.createElement('link'); fav.rel = 'icon'; document.head.appendChild(fav); }
      fav.href = config.siteLogo;
    }

    // Announcement ticker
    const ticker = document.getElementById('ticker-wrapper');
    if (ticker && config.announcement?.active) {
      ticker.style.display = 'flex';
      document.querySelectorAll('.ticker-text').forEach(el => el.textContent = config.announcement.text || '');
    } else if (ticker) ticker.style.display = 'none';

    // Global withdraw config
    if (config.minWithdraw) globalConfig.minWithdraw = config.minWithdraw;
    if (config.withdrawFee !== undefined) globalConfig.withdrawFee = config.withdrawFee;

    // Payment config (store globally for deposit)
    window.paymentConfig = payment;

    // Wheel prizes
    if (wheel?.prizes?.length) {
      prizes = wheel.prizes;
      drawWheel();
    }
  }

  // 3. Render user data
  renderUserUI();

  // 4. Security check (ban status)
  if (currentUserData.status === 'Banned') {
    renderLockScreen('🚫 Account Banned', 'Your account has been suspended for violating our terms of service.');
    return;
  }

  // 5. Load all dashboard data
  loadDeposits();
  loadWithdrawals();
  loadTeamData();
  generateReferralLink();
  loadShares();
  loadMyInvestments();
  collectDailyEarnings();
  fetchAmounts();
  initBankSync();
  updateVerificationUI();
  fetchUserHistory();
  pollNotifications();

  // 6. Check-in status
  const today = new Date().toDateString();
  if (currentUserData.lastCheckIn === today) {
    const btn = document.getElementById('checkinBtn');
    const msg = document.getElementById('checkinMsg');
    if (msg) msg.innerText = 'Already claimed! Check back tomorrow.';
    if (btn) { btn.style.opacity = '0.5'; btn.className = 'check-box active'; }
  }
}

// ─── RENDER USER UI ───────────────────────────────────────
function renderUserUI() {
  const u = currentUserData;
  document.querySelectorAll('.userId').forEach(el => {
    el.innerHTML = u._id.substring(0, 8);
    el.onclick = () => navigator.clipboard.writeText(u._id)
      .then(() => showToast('ID Copied!', 'success', 'ri-clipboard-line', 'Copied!'));
  });
  document.querySelectorAll('.email').forEach(el => el.innerHTML = u.email);
  document.querySelectorAll('.userName').forEach(el => el.innerHTML = u.username?.substring(0, 10));
  document.querySelectorAll('.tBalance').forEach(el => {
    el.innerHTML = u.ib ? Number(u.ib).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00';
  });
  document.getElementById('spinsLeft').innerText = u.freeSpins || 0;
}

// ─── DEPOSITS ────────────────────────────────────────────
async function loadDeposits() {
  const list = document.getElementById('depositList');
  const data = await api('/api/user/deposits');
  if (!data?.success) return;
  list.innerHTML = '';
  if (!data.deposits.length) {
    list.innerHTML = `<div class="empty-state"><div class="fox-logo-placeholder">🔮</div><p>Nothing here to see</p></div>`;
    return;
  }
  data.deposits.forEach(d => {
    let badgeClass = d.status === 'pending' ? 'badge-pending' : d.status === 'success' ? 'badge-success' : 'badge-declined';
    const dateStr = d.createdAt ? new Date(d.createdAt).toLocaleDateString() : 'Just now';
    list.innerHTML += `
      <div class="history-item">
        <div class="tx-details">
          <span class="tx-amount">₦${Number(d.amount).toLocaleString()}</span>
          <span class="tx-ref">Ref: ${d.refCode}</span>
          <span class="tx-date">${dateStr}</span>
        </div>
        <span class="badge ${badgeClass}">${d.status}</span>
      </div>`;
  });
}

// ─── WITHDRAWALS ──────────────────────────────────────────
async function loadWithdrawals() {
  const list = document.getElementById('withdrawList');
  const data = await api('/api/user/withdrawals');
  if (!data?.success) return;
  list.innerHTML = '';
  if (!data.withdrawals.length) {
    list.innerHTML = `<div class="empty-state"><div class="fox-logo-placeholder">🔮</div><p>Nothing here to see</p></div>`;
    return;
  }
  data.withdrawals.forEach(d => {
    let badgeClass = d.status === 'pending' ? 'badge-pending' : d.status === 'success' ? 'badge-success' : 'badge-declined';
    const dateStr = d.createdAt ? new Date(d.createdAt).toLocaleDateString() : 'Just now';
    list.innerHTML += `
      <div class="history-item">
        <div class="tx-details">
          <span class="tx-amount">₦${Number(d.amount).toLocaleString()}</span>
          <span class="tx-date">${dateStr}</span>
        </div>
        <span class="badge ${badgeClass}">${d.status}</span>
      </div>`;
  });
}

// ─── DEPOSIT INITIATION ───────────────────────────────────
window.initiateDeposit = async function (amount) {
  if (!document.getElementById('attest')?.checked)
    return showToast('Please read and accept before proceeding.', 'warning', 'ri-close-line', 'Attestation');

  amount = Number(amount);
  if (!amount) return showToast('Enter valid amount (Minimum 3000)', 'error', 'ri-close-line', 'Invalid Amount');

  const refCode = Math.floor(10000000 + Math.random() * 90000000).toString();
  const config = window.paymentConfig || {};

  if (config.mode === 'korapay' && config.korapay?.publicKey) {
    payWithKorapay(amount, config.korapay.publicKey);
    return;
  }

  // Manual bank transfer
  const bankName = config.manual?.bankName || 'Contact Admin';
  const accNum   = config.manual?.accountNumber || '0000000000';
  const accName  = config.manual?.accountName || 'Admin';

  const modal = document.createElement('div');
  modal.id = 'paymentModal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content">
      <h3 style="margin-top:0;color:var(--teal)">Complete Transfer</h3>
      <strong style="font-size:1.3rem;color:#666">₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</strong>
      <div class="bank-details">
        <div class="detail-row"><p style="font-size:0.9rem;color:#666">Transfer the exact amount to:</p></div>
        <div class="detail-row"><span>Bank:</span><strong>${bankName}</strong></div>
        <div class="detail-row"><span>Account:</span><strong id="modalAcc">${accNum}</strong></div>
        <div class="detail-row"><span>Name:</span><strong>${accName}</strong></div>
        <hr style="border:0;border-top:1px solid #e2e8f0;margin:15px 0;">
        <div style="text-align:center;cursor:pointer" onclick="copyText('modalRef')">
          <span style="font-size:0.75rem;color:#666;text-transform:uppercase;font-weight:bold;">Use this Reference as Narration</span>
          <span class="ref-box" id="modalRef">${refCode}</span>
        </div>
        <p style="font-size:0.8rem;color:#666;text-align:center;margin-top:10px;">Note this account is only for this transaction</p>
      </div>
      <button class="share-btn" onclick="submitManualDeposit(${amount}, '${refCode}')">I Have Sent the Money</button>
    </div>`;
  document.body.appendChild(modal);
};

window.submitManualDeposit = async (amount, refCode) => {
  closeModal();
  const data = await api('/api/user/deposit', {
    method: 'POST',
    body: JSON.stringify({ amount, method: 'Bank Transfer', refCode: refCode || 'MAN_' + Date.now(), status: 'pending' })
  });
  if (data?.success) {
    showToast('Deposit submitted! Awaiting admin approval.', 'info', 'ri-check-line', 'Submitted');
    loadDeposits();
  } else {
    showToast(data?.error || 'Error submitting deposit.', 'error', 'ri-close-line', 'Error');
  }
};

let isProcessingDeposit = false;
window.payWithKorapay = (amount, key) => {
  if (!window.Korapay) return showToast('Payment error. Please refresh.', 'error', 'ri-close-line', 'Error');
  isProcessingDeposit = false;
  const u = currentUserData;
  window.Korapay.initialize({
    key, amount, currency: 'NGN',
    reference: 'DEP_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
    customer: { name: u.username || 'User', email: u.email },
    onClose: () => { isProcessingDeposit = false; showToast('Transaction cancelled.', 'warning', 'ri-close-line', 'Cancelled'); },
    onSuccess: async (data) => {
      if (isProcessingDeposit) return;
      isProcessingDeposit = true;
      const res = await api('/api/user/deposit', {
        method: 'POST',
        body: JSON.stringify({ amount, method: 'Korapay', refCode: data.reference, status: 'success' })
      });
      if (res?.success) {
        showToast(`🎉 ₦${amount.toLocaleString()} added to wallet!`, 'success', 'ri-check-line', 'Success');
        loadDeposits();
        refreshBalance();
      }
    }
  });
};

// ─── WITHDRAWAL ───────────────────────────────────────────
window.handleWithdrawalSubmit = async () => {
  const amount = Number(document.getElementById('withdrawAmount').value);
  const btn = document.getElementById('withdrawBtn');
  const u = currentUserData;

  if (!u.bankDetails?.accountNumber)
    return showToast('Please bind your Bank Account in the Profile section first.', 'warning', 'ri-close-line', 'Bank Required');
  if (!u.emailVerified)
    return showToast('❌ Verification Required! Verify your account first.', 'error', 'ri-close', 'Verify First');
  if (amount < globalConfig.minWithdraw)
    return showToast(`Minimum withdrawal is ₦${globalConfig.minWithdraw.toLocaleString()}`, 'warning', 'ri-close-line', 'Invalid Amount');
  if (amount > u.ib)
    return showToast('Insufficient balance.', 'warning', 'ri-close-line', 'Insufficient');

  const fee = (amount * globalConfig.withdrawFee) / 100;
  const net = Math.floor(amount - fee);
  if (!confirm(`Withdrawal: ₦${amount.toLocaleString()}\nFee (${globalConfig.withdrawFee}%): ₦${fee.toLocaleString()}\nYou receive: ₦${net.toLocaleString()}\n\nConfirm?`)) return;

  btn.disabled = true;
  btn.innerText = 'Processing...';
  try {
    const data = await api('/api/user/withdraw', { method: 'POST', body: JSON.stringify({ amount }) });
    if (data?.success) {
      showToast('✅ Withdrawal request submitted!', 'info', 'ri-check-line', 'Success');
      document.getElementById('withdrawAmount').value = '';
      loadWithdrawals();
      refreshBalance();
    } else {
      showToast(data?.error || 'Error submitting withdrawal.', 'error', 'ri-close-line', 'Error');
    }
  } catch (err) {
    showToast('Something went wrong.', 'warning', 'ri-close-line', 'Error');
  } finally {
    btn.disabled = false;
    btn.innerText = 'Confirm Withdrawal';
  }
};

window.updateWithdrawPreview = () => {
  const amount = Number(document.getElementById('withdrawAmount').value) || 0;
  const fee = (amount * globalConfig.withdrawFee) / 100;
  const net = Math.floor(amount - fee);
  const el = document.getElementById('netAmount');
  if (el) el.innerText = `₦${net.toLocaleString()}`;
};

// ─── BANK SYNC ───────────────────────────────────────────
function initBankSync() {
  const u = currentUserData;
  if (u.bankDetails?.accountNumber) {
    const b = u.bankDetails;
    const bn = document.getElementById('bankName');
    const an = document.getElementById('accNumber');
    const ac = document.getElementById('accName');
    if (bn) bn.value = b.bankName || '';
    if (an) an.value = b.accountNumber || '';
    if (ac) ac.value = b.accountName || '';
  }
  // Apply global lock
  const isMasterLocked = window.paymentConfig?.globalBankLock || false;
  const saveBtn = document.getElementById('saveBtn');
  if (isMasterLocked && u.bankDetails?.accountNumber) {
    ['bankName','accNumber','accName'].forEach(id => { const el = document.getElementById(id); if (el) el.disabled = true; });
    if (saveBtn) { saveBtn.disabled = true; saveBtn.innerText = 'Contact support'; saveBtn.style.display = 'none'; }
    const msg = document.getElementById('status-msg');
    if (msg) msg.innerText = 'This feature is currently unavailable';
  }
}

window.handleSave = async () => {
  const bName = document.getElementById('bankName').value.trim();
  const aNum  = document.getElementById('accNumber').value.trim();
  const aName = document.getElementById('accName').value.trim();
  if (!bName || aNum.length < 10 || !aName)
    return showToast('Please fill all fields correctly. Account number must be 10 digits.', 'warning', 'ri-close-line', 'Invalid Input');

  const data = await api('/api/user/bank-details', {
    method: 'PUT',
    body: JSON.stringify({ bankName: bName, accountNumber: aNum, accountName: aName })
  });
  if (data?.success) {
    showToast('✅ Bank details saved successfully!', 'info', 'ri-check-line', 'Success');
    currentUserData.bankDetails = { bankName: bName, accountNumber: aNum, accountName: aName };
  } else {
    showToast(data?.error || 'Error saving bank details.', 'error', 'ri-close-line', 'Error');
  }
};

// ─── DEPOSIT AMOUNTS ─────────────────────────────────────
const amountListDiv = document.getElementById('amountGrid');
const confirmInput  = document.getElementById('customAmount');
const confirmBtn    = document.getElementById('rechargeBtn');

async function fetchAmounts() {
  const data = await api('/api/user/deposit-amounts');
  const amounts = data?.amounts?.length ? data.amounts : [3000, 5000, 10000];
  displayAmounts(amounts);
}

function displayAmounts(amounts) {
  if (!amountListDiv) return;
  amountListDiv.innerHTML = '';
  amounts.forEach((amt, index) => {
    const card = document.createElement('div');
    card.className = 'amt-btn';
    if (index === 0) { card.classList.add('active'); if (confirmInput) confirmInput.value = amt.toFixed(2); }
    card.innerText = `₦${amt.toLocaleString()}`;
    card.onclick = () => {
      if (confirmInput) confirmInput.value = amt.toFixed(2);
      document.querySelectorAll('.amt-btn').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
    };
    amountListDiv.appendChild(card);
  });
}

if (confirmBtn) {
  confirmBtn.onclick = () => {
    const amt = Number(confirmInput.value);
    if (amt > 0) initiateDeposit(amt);
  };
}

// ─── SHARES ───────────────────────────────────────────────
async function loadShares() {
  const container = document.getElementById('shares-container');
  if (!container) return;
  const data = await api('/api/user/shares');
  if (!data?.success) return;
  container.innerHTML = '';
  data.shares.forEach(s => {
    container.innerHTML += `
      <div class="action-card block" style="padding:0;overflow:hidden">
        <div class="share-img-wrapper">
          <img src="${s.img}" alt="${s.name}">
          <div class="duration-badge">${s.duration} Days</div>
        </div>
        <div class="share-details">
          <h3>${s.name}</h3>
          <div class="stats-row">
            <div class="stat-item" style="text-align:left"><span>Price</span><b>₦${s.price.toLocaleString()}</b></div>
            <div class="stat-item" style="text-align:right"><span>Daily Pay</span><b style="color:#10ac84;">₦${s.dailyIncome.toLocaleString()}</b></div>
          </div>
          <button class="buy-btn" onclick="buyShare('${s._id}',${s.price},'${s.name}',${s.dailyIncome},${s.duration})">Invest Now</button>
        </div>
      </div>`;
  });
}

window.buyShare = async (id, price, name, daily, dur) => {
  if (currentUserData.ib < price)
    return showToast('Insufficient Balance! Try depositing.', 'warning', 'ri-close-line', 'Insufficient Balance');
  if (!confirm(`Buy ${name} for ₦${price.toLocaleString()}?`)) return;
  const data = await api('/api/user/buy-share', {
    method: 'POST',
    body: JSON.stringify({ shareId: id, name, price, dailyIncome: daily, duration: dur })
  });
  if (data?.success) {
    showToast('🎁 Bonus: 2 Free Spins earned!', 'success', 'ri-close-line', 'Bonus Earned');
    showToast('Investment Active!', 'info', 'ri-check-line', 'Investment Active');
    refreshBalance();
    loadMyInvestments();
  } else {
    showToast(data?.error || 'Error buying share.', 'error', 'ri-close-line', 'Error');
  }
};

// ─── MY INVESTMENTS ───────────────────────────────────────
async function loadMyInvestments() {
  const container = document.getElementById('myInvestmentsContainer');
  if (!container) return;
  const data = await api('/api/user/my-investments');
  if (!data?.success) return;
  container.innerHTML = '';
  if (!data.investments.length) {
    container.innerHTML = "<p style='text-align:center;color:gray;'>No active investments yet.</p>";
    return;
  }
  data.investments.forEach(d => {
    const purchaseDate  = new Date(d.purchaseDate);
    const now           = new Date();
    const daysPassed    = Math.floor(Math.abs(now - purchaseDate) / (1000 * 60 * 60 * 24));
    const remaining     = d.duration - daysPassed;
    const progressPct   = Math.min(100, (daysPassed / d.duration) * 100);
    container.innerHTML += `
      <div class="order-card block">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
          <span class="product-name">${d.shareName?.toUpperCase()}</span>
          <span class="status-badge"><i class="ri-flashlight-fill" style="color:#f1c40f"></i>Auto Claim On</span>
        </div>
        <div class="info-row"><span class="label">Price:</span><span class="value">₦${d.pricePaid}</span></div>
        <div class="info-row"><span class="label">Total Profit:</span><span class="value">₦${d.dailyIncome * d.duration}</span></div>
        <div class="info-row"><span class="label">Daily Profit:</span><span class="value">₦${d.dailyIncome}</span></div>
        <div class="info-row"><span class="label">Duration:</span><span class="value">${d.duration} Days</span></div>
        <div class="info-row"><span class="label">Date:</span><span class="value">${purchaseDate.toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}</span></div>
        <div class="info-row" style="font-weight:600;font-size:1rem;color:var(--success);">
          <span class="label">Claimed:</span>
          <span class="value">₦${(daysPassed * d.dailyIncome).toLocaleString()}</span>
        </div>
        <div class="progress-bar"><div class="progress-fill" style="width:${progressPct}%"></div></div>
        <div class="info-row">
          <span style="background:var(--success);color:white;" class="btn btn-secondary"><i class="ri-flashlight-fill" style="color:#f1c40f"></i>${d.status} Running</span>
          <span class="status-badge">${remaining} Days Left</span>
        </div>
      </div>`;
  });
}

// ─── COLLECT DAILY EARNINGS ───────────────────────────────
async function collectDailyEarnings() {
  const data = await api('/api/user/collect-earnings', { method: 'POST' });
  if (data?.credited > 0) {
    showToast(`💰 Daily Profit: ₦${data.credited.toLocaleString()} added!`, 'info', 'ri-check-line', 'Profit Added');
    refreshBalance();
  }
}

// ─── TEAM / REFERRAL ──────────────────────────────────────
async function loadTeamData() {
  const data = await api('/api/user/team');
  if (!data?.success) return;

  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
  setEl('level1Count', data.level1.count);
  setEl('level2Count', data.level2.count);
  setEl('level3Count', data.level3.count);

  // Render level 1 users if container exists
  const teamContainer = document.getElementById('teamContainer');
  if (teamContainer) {
    teamContainer.innerHTML = '';
    data.level1.users.forEach(u => {
      teamContainer.innerHTML += `
        <div class="team-member">
          <span>${u.username}</span>
          <span>${u.email}</span>
        </div>`;
    });
  }
}

function generateReferralLink() {
  if (!currentUserData) return;
  const link = `${window.location.origin}/account/account.html?ref=${currentUserData._id}#signup-page`;
  document.querySelectorAll('.refLink').forEach(el => el.innerText = link);
  window.copyRefLink = () => {
    navigator.clipboard.writeText(link)
      .then(() => showToast('Referral link copied!', 'success', 'ri-clipboard-line', 'Copied!'));
  };
}

// ─── SPIN WHEEL ───────────────────────────────────────────
const canvas = document.getElementById('wheelCanvas');
const ctx = canvas?.getContext('2d');
let prizes = [];
let currentRotation = 0;
let isSpinning = false;

function drawWheel() {
  if (!ctx || !prizes.length) return;
  const arcSize = (2 * Math.PI) / prizes.length;
  prizes.forEach((prize, i) => {
    const angle = i * arcSize;
    ctx.beginPath();
    ctx.fillStyle = prize.color;
    ctx.moveTo(150, 150);
    ctx.arc(150, 150, 150, angle, angle + arcSize);
    ctx.fill();
    ctx.save();
    ctx.translate(150, 150);
    ctx.rotate(angle + arcSize / 2);
    ctx.textAlign = 'right';
    ctx.fillStyle = 'white';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(prize.label, 140, 10);
    ctx.restore();
  });
}

window.spinWheel = async () => {
  if (isSpinning) return;
  const spinBtn = document.getElementById('spinBtn');

  isSpinning = true;
  if (spinBtn) spinBtn.disabled = true;

  // Animate first, then validate on server
  const randomStop = Math.floor(Math.random() * 360);
  currentRotation += (7 * 360) + randomStop;
  if (canvas) canvas.style.transform = `rotate(${currentRotation}deg)`;

  setTimeout(async () => {
    const data = await api('/api/user/spin', { method: 'POST' });
    isSpinning = false;
    if (spinBtn) spinBtn.disabled = false;

    if (!data?.success) {
      showToast(data?.error || 'Spin failed.', 'error', 'ri-close-line', 'Error');
      // Revert rotation visually
      currentRotation -= (7 * 360) + randomStop;
      if (canvas) canvas.style.transform = `rotate(${currentRotation}deg)`;
      return;
    }

    const win = data.prize;
    if (win.value > 0) {
      showToast(`🎉 You're Lucky! Won ${win.label}!`, 'success', 'ri-check-line', "You're Lucky!");
    } else {
      showToast('Unlucky! Try Again', 'warning', 'ri-close-line', win.label);
    }
    refreshBalance();
  }, 4000);
};

// ─── NOTIFICATIONS POLLING ────────────────────────────────
let lastNotifCount = 0;
async function pollNotifications() {
  const data = await api('/api/user/notifications');
  if (data?.success && data.notifications.length > lastNotifCount) {
    const latest = data.notifications[0];
    const age = (Date.now() - new Date(latest.createdAt).getTime()) / 1000;
    if (age < 30) showToast(`${latest.title}\n${latest.message}`, 'info', 'ri-information-line', 'Notification');
    lastNotifCount = data.notifications.length;
  }
  setTimeout(pollNotifications, 15000); // Poll every 15 seconds
}

// ─── ACTIVITY / HISTORY ───────────────────────────────────
window.fetchUserHistory = async () => {
  const list = document.getElementById('historyList');
  if (!list) return;
  list.innerHTML = 'Loading history...';
  const data = await api('/api/user/activity');
  if (!data?.success) return;
  list.innerHTML = '';
  data.activity.forEach(item => {
    const date = new Date(item.createdAt).toLocaleDateString();
    const div = document.createElement('div');
    div.className = 'history-item';
    div.innerHTML = `
      <div class="tx-details">
        <h5>${item.type}: ${item.desc}</h5>
        <span class="tx-date">${date}</span>
      </div>
      <div class="badge">| ${item.amount}</div>`;
    list.appendChild(div);
  });
};

// ─── EMAIL VERIFICATION ───────────────────────────────────
async function updateVerificationUI() {
  const container = document.getElementById('verifiedStatus');
  const text      = document.getElementById('verificationText');
  const icon      = document.getElementById('verificationIcon');
  if (!container) return;

  const u = currentUserData;
  if (u.emailVerified) {
    if (text) text.innerText = 'Verified';
    if (container) container.className = 'verified-bg status-badge';
    if (icon) icon.className = 'ri-checkbox-circle-fill';
    container.onclick = null;
  } else {
    if (text) text.innerText = '(Click to verify)';
    if (container) container.className = 'status-badge unverified-bg';
    if (icon) icon.className = 'ri-error-warning-line';     
    container.onclick = async () => {
          if (text.innerHtml==="Email sent!"){ alert("Please try again later"); return}
      try {
        container.style.opacity = '0.5';
        container.style.pointerEvents = 'none';
        const data = await api('/api/user/resend-verification', { method: 'POST' });
        if (data?.success) {
          showToast('Verification link sent to ' + u.email, 'success', 'ri-check-line', 'Email Sent');
          if (text) text.innerText = 'Email Sent!';
        } else {
          showToast(data?.error || 'Error sending email.', 'error', 'ri-close-line', 'Error');
        }
      } catch (err) {
        showToast('Wait a bit before retrying.', 'error');
      } finally {
        container.style.opacity = '1';
        container.style.pointerEvents = 'auto';
      }
    };
  }
}

// ─── DAILY CHECK-IN ───────────────────────────────────────
window.handleCheckIn = async () => {
  const data = await api('/api/user/checkin', { method: 'POST' });
  if (data?.success) {
    showToast(`✅ Check-in bonus ₦${data.bonus} added!`, 'success', 'ri-check-line', 'Checked In!');
    const btn = document.getElementById('checkinBtn');
    const msg = document.getElementById('checkinMsg');
    if (msg) msg.innerText = 'Already claimed! Check back tomorrow.';
    if (btn) { btn.style.opacity = '0.5'; btn.className = 'check-box active'; }
    refreshBalance();
  } else {
    showToast(data?.error || 'Check-in failed.', 'warning', 'ri-close-line', 'Error');
  }
};

// ─── REFRESH BALANCE ─────────────────────────────────────
async function refreshBalance() {
  const meRes = await api('/api/auth/me');
  if (meRes?.success) {
    currentUserData = meRes.user;
    renderUserUI();
  }
}

// ─── UTILITY ─────────────────────────────────────────────
window.copyText = (id) => {
  const el = document.getElementById(id);
  if (el) navigator.clipboard.writeText(el.innerText)
    .then(() => showToast('Copied!', 'success', 'ri-clipboard-line', 'Copied!'));
};

function closeModal() {
  const modal = document.getElementById('paymentModal');
  if (modal) modal.remove();
}


// ─── START ────────────────────────────────────────────────
init();
