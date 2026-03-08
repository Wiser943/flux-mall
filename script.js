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
  const meRes = await api('/api/auth/me');
  if (!meRes?.success) { logoutUser(); return; }
  currentUserData = meRes.user;

  const configRes = await api('/api/user/config');
  if (configRes?.success) {
    const { config, payment, maintenance, wheel } = configRes;

    if (maintenance?.enabled) { renderLockScreen('System Maintenance', 'Our site is currently undergoing scheduled upgrades.'); return; }

    if (config.theme) applyTheme(config.theme);

    if (config.siteName) {
      document.querySelectorAll('.site-name').forEach(el => el.innerText = config.siteName);
      document.title = config.siteName;
    }
    if (config.siteLogo) {
      chatSiteLogo = config.siteLogo; // capture for chat header
      document.querySelectorAll('.logo-img').forEach(img => {
        img.src = config.siteLogo;
        img.onerror = () => img.style.display = 'none';
      });
      let fav = document.querySelector("link[rel='icon']");
      if (!fav) { fav = document.createElement('link'); fav.rel = 'icon'; document.head.appendChild(fav); }
      fav.href = config.siteLogo;
    }

    const ticker = document.getElementById('ticker-wrapper');
    if (ticker && config.announcement?.active) {
      ticker.style.display = 'flex';
      document.querySelectorAll('.ticker-text').forEach(el => el.textContent = config.announcement.text || '');
    } else if (ticker) ticker.style.display = 'none';

    if (config.minWithdraw) globalConfig.minWithdraw = config.minWithdraw;
    if (config.withdrawFee !== undefined) globalConfig.withdrawFee = config.withdrawFee;

    window.paymentConfig = payment;

    if (wheel?.prizes?.length) {
      prizes = wheel.prizes;
      drawWheel();
    }
  }

  renderUserUI();

  if (currentUserData.status === 'Banned') {
    renderLockScreen('🚫 Account Banned', 'Your account has been suspended for violating our terms of service.');
    return;
  }

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
    el.innerHTML = u.uid || u._id.substring(0, 8);
    el.onclick = () => navigator.clipboard.writeText(u.uid || u._id)
      .then(() => showToast('ID Copied!', 'success', 'ri-clipboard-line', 'Copied!'));
  });
  document.querySelectorAll('.email').forEach(el => el.innerHTML = u.email);
  document.querySelectorAll('.userName').forEach(el => el.innerHTML = u.username?.substring(0, 10));
  document.querySelectorAll('.balance').forEach(el => {
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
async function initBankSync() {
  const u = currentUserData;

  // Load banks dropdown from Korapay
  await loadBanksDropdown();

  // Pre-fill existing bank details
  if (u.bankDetails?.accountNumber) {
    const b  = u.bankDetails;
    const an = document.getElementById('accNumber');
    const ac = document.getElementById('accName');
    if (an) an.value = b.accountNumber || '';
    if (ac) ac.value = b.accountName || '';
    // Match bank in dropdown by name or code
    const bn = document.getElementById('bankName');
    if (bn) {
      const match = Array.from(bn.options).find(o => o.text === b.bankName || o.value === b.bankCode);
      if (match) bn.value = match.value;
    }
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

// ─── LOAD BANKS DROPDOWN ─────────────────────────────────
async function loadBanksDropdown() {
  const select = document.getElementById('bankName');
  if (!select) return;
  select.innerHTML = '<option value="">⏳ Loading banks...</option>';
  try {
    const data = await api('/api/user/banks');
    if (!data?.success || !data.banks?.length) {
      select.innerHTML = '<option value="">❌ Could not load banks</option>';
      return;
    }
    select.innerHTML = '<option value="">-- Select your Bank --</option>';
    data.banks.forEach(bank => {
      const opt = document.createElement('option');
      opt.value = bank.code;
      opt.text  = bank.name;
      opt.dataset.name = bank.name;
      select.appendChild(opt);
    });
    // If account number already exists, trigger verify
    const accNum = document.getElementById('accNumber')?.value;
    if (accNum?.length === 10) handleAccNumberInput(accNum);
  } catch (err) {
    select.innerHTML = '<option value="">❌ Could not load banks</option>';
  }
}

// ─── ACCOUNT NUMBER AUTO-VERIFY ──────────────────────────
let verifyTimer = null;
window.handleAccNumberInput = (value) => {
  const statusEl = document.getElementById('verifyStatus');
  const accName  = document.getElementById('accName');
  if (accName) accName.value = '';
  if (statusEl) statusEl.innerHTML = '';
  if (value.length !== 10) return;
  // Debounce — wait 700ms after typing stops
  clearTimeout(verifyTimer);
  verifyTimer = setTimeout(() => verifyAccount(value), 700);
};

async function verifyAccount(accountNumber) {
  const bankSelect = document.getElementById('bankName');
  const statusEl   = document.getElementById('verifyStatus');
  const accName    = document.getElementById('accName');
  const bankCode   = bankSelect?.value;

  if (!bankCode) {
    if (statusEl) statusEl.innerHTML = '<span style="color:orange">⚠️ Please select a bank first</span>';
    return;
  }
  if (statusEl) statusEl.innerHTML = '<span style="color:var(--primary)">🔍 Verifying account...</span>';

  const data = await api('/api/user/verify-account', {
    method: 'POST',
    body: JSON.stringify({ accountNumber, bankCode })
  });

  if (data?.success) {
    if (accName) accName.value = data.accountName;
    if (statusEl) statusEl.innerHTML = `<span style="color:#10ac84">✅ ${data.accountName}</span>`;
  } else {
    if (accName) accName.value = '';
    if (statusEl) statusEl.innerHTML = `<span style="color:red">❌ ${data?.error || 'Verification failed'}</span>`;
  }
}

window.handleSave = async () => {
  const bankSelect = document.getElementById('bankName');
  const bankCode   = bankSelect?.value;
  const bankLabel  = bankSelect?.options[bankSelect.selectedIndex]?.dataset?.name || '';
  const aNum       = document.getElementById('accNumber').value.trim();
  const aName      = document.getElementById('accName').value.trim();

  if (!bankCode)
    return showToast('Please select a bank.', 'warning', 'ri-close-line', 'Invalid Input');
  if (aNum.length !== 10)
    return showToast('Account number must be exactly 10 digits.', 'warning', 'ri-close-line', 'Invalid Input');
  if (!aName)
    return showToast('Account not verified yet. Wait for auto-verification.', 'warning', 'ri-close-line', 'Not Verified');

  const data = await api('/api/user/bank-details', {
    method: 'PUT',
    body: JSON.stringify({ bankName: bankLabel, bankCode, accountNumber: aNum, accountName: aName })
  });
  if (data?.success) {
    showToast('✅ Bank details saved successfully!', 'info', 'ri-check-line', 'Success');
    currentUserData.bankDetails = { bankName: bankLabel, bankCode, accountNumber: aNum, accountName: aName };
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
  const teamContainer = document.getElementById('teamContainer');
  if (teamContainer) {
    teamContainer.innerHTML = '';
    data.level1.users.forEach(u => {
      teamContainer.innerHTML += `<div class="team-member"><span>${u.username}</span><span>${u.email}</span></div>`;
    });
  }
}

function generateReferralLink() {
  if (!currentUserData) return;
  const refId = currentUserData.uid || currentUserData._id;
  const link = `${window.location.origin}/account/account.html?ref=${refId}#signup-page`;
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
  const randomStop = Math.floor(Math.random() * 360);
  currentRotation += (7 * 360) + randomStop;
  if (canvas) canvas.style.transform = `rotate(${currentRotation}deg)`;
  setTimeout(async () => {
    const data = await api('/api/user/spin', { method: 'POST' });
    isSpinning = false;
    if (spinBtn) spinBtn.disabled = false;
    if (!data?.success) {
      showToast(data?.error || 'Spin failed.', 'error', 'ri-close-line', 'Error');
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
  setTimeout(pollNotifications, 15000);
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
      if (text.innerText === 'Email Sent!') { alert('Please try again later'); return; }
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


// ═══════════════════════════════════════════════════════════


// ═══════════════════════════════════════════════════════════
// CHAT SYSTEM — Professional FB-style
// ═══════════════════════════════════════════════════════════

let chatSessionId     = null;
let chatSessionStatus = 'active';
let chatPollTimer     = null;
let chatTypingTimer   = null;
let chatTypingPollTimer = null;
let lastMsgCount      = 0;
let chatSoundEnabled  = true;
let chatSiteLogo      = '';
let replyingTo        = null;   // { msgId, sender, preview }
let editingMsgId      = null;
let chatAllMessages   = [];     // full message cache for reply lookup
const EMOJIS          = ['👍','❤️','😂','😮','😢','🔥'];

// ─── AUDIO BEEP ───────────────────────────────────────────
function playChatSound() {
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.3);
  } catch(e) {}
}

// ─── OPEN CHAT ────────────────────────────────────────────
window.openChat = async function() {
  window.location.hash = '#chat';
  lucide.createIcons();

  const logo = document.getElementById('chatAdminLogo');
  if (logo && chatSiteLogo) logo.src = chatSiteLogo;

  const messagesEl = document.getElementById('chatMessages');
  const loadingEl  = document.getElementById('chatLoading');
  if (loadingEl) loadingEl.style.display = 'block';

  // Load settings to enforce image toggle + sound
  const settingsRes = await api('/api/user/chat/settings');
  if (settingsRes?.success) {
    chatSoundEnabled = settingsRes.settings?.sound !== false;
    const imgLabel = document.querySelector('label[for="chatImgInput"]');
    if (imgLabel) imgLabel.style.display = settingsRes.settings?.allowImages === false ? 'none' : 'flex';
  }

  const sessionRes = await api('/api/user/chat/session');

  if (sessionRes?.offline) {
    if (messagesEl) messagesEl.innerHTML = `
      <div style="text-align:center;padding:40px 20px;">
        <div style="font-size:40px;margin-bottom:12px;">🌙</div>
        <div style="font-weight:700;color:var(--text-main);margin-bottom:8px;">Unavailable</div>
        <div style="color:var(--text-muted);font-size:13px;">${sessionRes.offlineMsg}</div>
      </div>`;
    const inputBar = document.getElementById('chatInputBar');
    if (inputBar) inputBar.style.display = 'none';
    return;
  }

  if (!sessionRes?.success) return;

  chatSessionId     = sessionRes.session._id;
  chatSessionStatus = sessionRes.session.status;

  await loadChatMessages();
  startChatPolling();
  startTypingPoll();
};

// ─── LOAD MESSAGES ────────────────────────────────────────
async function loadChatMessages() {
  const data = await api('/api/user/chat/messages');
  if (!data?.success) return;

  chatSessionId     = data.sessionId     || chatSessionId;
  chatSessionStatus = data.sessionStatus || chatSessionStatus;
  chatAllMessages   = data.messages;

  renderChatMessages(data.messages);
  updateChatSessionUI();

  const badge = document.getElementById('chatUnreadBadge');
  if (badge) badge.style.display = 'none';

  lastMsgCount = data.messages.length;
}

// ─── RENDER MESSAGES ──────────────────────────────────────
function renderChatMessages(messages) {
  const container = document.getElementById('chatMessages');
  if (!container) return;
  const loading = document.getElementById('chatLoading');
  if (loading) loading.style.display = 'none';

  container.innerHTML = '';
  if (!messages.length) {
    container.innerHTML = `<div style="text-align:center;color:var(--text-muted);padding:40px 0;font-size:13px;">No messages yet. Say hello 👋</div>`;
    return;
  }

  // Group messages by date
  let lastDate = '';
  messages.forEach(msg => {
    const dateStr = new Date(msg.createdAt).toLocaleDateString([], { weekday:'long', month:'short', day:'numeric' });
    if (dateStr !== lastDate) {
      const divider = document.createElement('div');
      divider.style.cssText = 'text-align:center;margin:12px 0;';
      divider.innerHTML = `<span style="background:rgba(0,0,0,0.08);color:var(--text-muted);border-radius:12px;padding:3px 12px;font-size:11px;">${dateStr}</span>`;
      container.appendChild(divider);
      lastDate = dateStr;
    }
    container.appendChild(buildMsgBubble(msg, 'user'));
  });

  container.scrollTop = container.scrollHeight;
}

// ─── BUILD MESSAGE BUBBLE ─────────────────────────────────
function buildMsgBubble(msg, perspective) {
  const isMe    = (perspective === 'user') ? msg.sender === 'user' : msg.sender === 'admin';
  const time    = new Date(msg.createdAt).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
  const wrapper = document.createElement('div');
  wrapper.dataset.msgId = msg._id;
  wrapper.style.cssText = `display:flex;flex-direction:column;align-items:${isMe ? 'flex-end' : 'flex-start'};gap:2px;margin-bottom:2px;position:relative;`;

  // ── Reply thread quote ──
  let replyHtml = '';
  if (msg.replyTo?.msgId) {
    replyHtml = `
      <div style="background:rgba(0,0,0,0.06);border-left:3px solid var(--primary);border-radius:6px;padding:5px 10px;margin-bottom:4px;font-size:11px;color:var(--text-muted);max-width:100%;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">
        <span style="font-weight:700;color:var(--primary);margin-right:6px;">${msg.replyTo.sender === 'user' ? 'You' : 'Support'}</span>${msg.replyTo.preview}
      </div>`;
  }

  // ── Main content ──
  let bubbleContent = '';
  if (msg.deleted) {
    bubbleContent = `<span style="font-style:italic;opacity:0.6;font-size:13px;">🚫 This message was deleted</span>`;
  } else if (msg.type === 'image' && msg.imageUrl) {
    bubbleContent = `<img src="${msg.imageUrl}" style="max-width:220px;border-radius:10px;cursor:pointer;" onclick="window.open('${msg.imageUrl}','_blank')">`;
  } else if (msg.type === 'polar') {
    const answered = msg.polarAnswer;
    const disabledAttr = answered ? 'disabled' : '';
    const disabledStyle = answered ? 'opacity:0.5;cursor:not-allowed;' : 'cursor:pointer;';
    bubbleContent = `
      <div style="font-size:13px;margin-bottom:8px;font-weight:600;">❓ ${msg.polarQuestion}</div>
      ${answered
        ? `<div style="padding:6px 12px;border-radius:8px;font-weight:700;background:rgba(255,255,255,0.2);color:${answered==='yes'?'#10ac84':'#e74c3c'};">${answered==='yes'?'✅ You answered: Yes':'❌ You answered: No'}</div>`
        : `<div style="display:flex;gap:8px;margin-top:4px;">
            <button onclick="answerPolar('${msg._id}','yes',this)" ${disabledAttr} style="background:#10ac84;color:#fff;border:none;border-radius:8px;padding:7px 20px;font-weight:600;${disabledStyle}">✅ Yes</button>
            <button onclick="answerPolar('${msg._id}','no',this)" ${disabledAttr} style="background:#e74c3c;color:#fff;border:none;border-radius:8px;padding:7px 20px;font-weight:600;${disabledStyle}">❌ No</button>
          </div>`
      }`;
  } else {
    bubbleContent = `<span style="font-size:14px;line-height:1.5;word-break:break-word;">${msg.content}</span>`;
  }

  // ── Ticks (only for user's own messages) ──
  let ticksHtml = '';
  if (isMe && !msg.deleted) {
    const tickColor = msg.read ? '#4fc3f7' : msg.delivered ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.5)';
    const tickLabel = msg.read ? '✓✓' : msg.delivered ? '✓✓' : '✓';
    ticksHtml = `<span style="font-size:11px;color:${isMe ? tickColor : 'var(--text-muted)'};margin-left:4px;">${tickLabel}</span>`;
  }

  // ── Edit/deleted label ──
  const editedHtml = msg.edited && !msg.deleted ? `<span style="font-size:10px;opacity:0.6;margin-left:4px;">edited</span>` : '';

  // ── Reactions ──
  const reactEntries = Object.entries(msg.reactions || {}).filter(([,v]) => v.length > 0);
  const reactionsHtml = reactEntries.length ? `
    <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:3px;">
      ${reactEntries.map(([emoji, users]) => `
        <span onclick="toggleReaction('${msg._id}','${emoji}')" style="background:rgba(0,0,0,0.08);border-radius:12px;padding:2px 7px;font-size:12px;cursor:pointer;border:1px solid ${users.includes('user')?'var(--primary)':'transparent'};">
          ${emoji} ${users.length}
        </span>`).join('')}
    </div>` : '';

  // ── Emoji reaction bar (shown on hover/long-press) ──
  const emojiBarId = `ebar-${msg._id}`;
  const emojiBarHtml = msg.deleted ? '' : `
    <div id="${emojiBarId}" style="display:none;position:absolute;${isMe?'right:0':'left:0'};bottom:calc(100% + 4px);background:var(--card-bg,#fff);border-radius:20px;padding:6px 10px;box-shadow:0 4px 16px rgba(0,0,0,0.15);display:none;gap:6px;z-index:100;white-space:nowrap;">
      ${EMOJIS.map(e => `<span onclick="toggleReaction('${msg._id}','${e}');hideEmojiBar('${emojiBarId}')" style="font-size:20px;cursor:pointer;transition:transform 0.1s;" onmouseover="this.style.transform='scale(1.3)'" onmouseout="this.style.transform='scale(1)'">${e}</span>`).join('')}
      ${isMe && !msg.deleted ? `<span onclick="startReply('${msg._id}');hideEmojiBar('${emojiBarId}')" style="font-size:18px;cursor:pointer;padding:0 4px;" title="Reply">↩️</span>
      <span onclick="startEdit('${msg._id}');hideEmojiBar('${emojiBarId}')" style="font-size:18px;cursor:pointer;padding:0 4px;" title="Edit">✏️</span>
      <span onclick="deleteMsg('${msg._id}');hideEmojiBar('${emojiBarId}')" style="font-size:18px;cursor:pointer;padding:0 4px;" title="Delete">🗑️</span>` :
      !isMe && !msg.deleted ? `<span onclick="startReply('${msg._id}');hideEmojiBar('${emojiBarId}')" style="font-size:18px;cursor:pointer;padding:0 4px;" title="Reply">↩️</span>` : ''}
    </div>`;

  wrapper.innerHTML = `
    ${emojiBarHtml}
    <div class="chat-bubble" data-msg-id="${msg._id}"
      style="max-width:78%;background:${isMe?'var(--primary)':'var(--card-bg,#fff)'};color:${isMe?'#fff':'var(--text-main)'};border-radius:${isMe?'18px 18px 4px 18px':'18px 18px 18px 4px'};padding:10px 14px;box-shadow:0 1px 4px rgba(0,0,0,0.08);cursor:pointer;position:relative;"
      oncontextmenu="showEmojiBar(event,'${emojiBarId}')"
      ontouchstart="handleTouchStart(event,'${emojiBarId}')"
      ontouchend="handleTouchEnd()"
    >
      ${replyHtml}${bubbleContent}
    </div>
    <div style="display:flex;align-items:center;gap:3px;padding:0 4px;">
      <span style="font-size:10px;color:var(--text-muted);">${time}</span>${editedHtml}${ticksHtml}
    </div>
    ${reactionsHtml}`;

  return wrapper;
}

// ─── EMOJI BAR SHOW/HIDE ──────────────────────────────────
let longPressTimer = null;

window.showEmojiBar = function(e, barId) {
  e.preventDefault();
  hideAllEmojiBars();
  const bar = document.getElementById(barId);
  if (bar) bar.style.display = 'flex';
};

window.hideEmojiBar = function(barId) {
  const bar = document.getElementById(barId);
  if (bar) bar.style.display = 'none';
};

function hideAllEmojiBars() {
  document.querySelectorAll('[id^="ebar-"]').forEach(b => b.style.display = 'none');
}

window.handleTouchStart = function(e, barId) {
  longPressTimer = setTimeout(() => showEmojiBar(e, barId), 500);
};

window.handleTouchEnd = function() {
  clearTimeout(longPressTimer);
};

// Close emoji bars when tapping elsewhere
document.addEventListener('click', e => {
  if (!e.target.closest('[id^="ebar-"]') && !e.target.closest('.chat-bubble')) {
    hideAllEmojiBars();
  }
});

// ─── REACTIONS ────────────────────────────────────────────
window.toggleReaction = async function(msgId, emoji) {
  const data = await api('/api/user/chat/react', {
    method: 'POST',
    body: JSON.stringify({ msgId, emoji })
  });
  if (data?.success) await loadChatMessages();
};

// ─── REPLY ────────────────────────────────────────────────
window.startReply = function(msgId) {
  const msg = chatAllMessages.find(m => m._id === msgId);
  if (!msg) return;
  editingMsgId = null;
  replyingTo = {
    msgId,
    sender: msg.sender,
    preview: msg.type === 'image' ? '📷 Image' : msg.content?.substring(0, 80) || ''
  };
  const bar = document.getElementById('chatReplyBar');
  const barText = document.getElementById('chatReplyBarText');
  const barSender = document.getElementById('chatReplyBarSender');
  if (bar) bar.style.display = 'flex';
  if (barSender) barSender.textContent = msg.sender === 'user' ? 'You' : 'Support';
  if (barText) barText.textContent = replyingTo.preview;
  document.getElementById('chatInput')?.focus();
};

window.cancelReply = function() {
  replyingTo = null;
  editingMsgId = null;
  const bar = document.getElementById('chatReplyBar');
  if (bar) bar.style.display = 'none';
  const input = document.getElementById('chatInput');
  if (input) input.value = '';
  input?.setAttribute('placeholder', 'Type a message...');
};

// ─── EDIT ─────────────────────────────────────────────────
window.startEdit = function(msgId) {
  const msg = chatAllMessages.find(m => m._id === msgId);
  if (!msg || msg.deleted) return;
  replyingTo = null;
  editingMsgId = msgId;
  const input = document.getElementById('chatInput');
  if (input) { input.value = msg.content; input.focus(); }
  const bar = document.getElementById('chatReplyBar');
  const barSender = document.getElementById('chatReplyBarSender');
  const barText = document.getElementById('chatReplyBarText');
  if (bar) bar.style.display = 'flex';
  if (barSender) barSender.textContent = '✏️ Editing';
  if (barText) barText.textContent = msg.content?.substring(0, 80);
};

// ─── DELETE ───────────────────────────────────────────────
window.deleteMsg = async function(msgId) {
  if (!confirm('Delete this message?')) return;
  const data = await api(`/api/user/chat/message/${msgId}`, { method: 'DELETE' });
  if (data?.success) await loadChatMessages();
  else showToast(data?.error || 'Failed', 'error', 'ri-close-line', 'Error');
};

// ─── SEND MESSAGE ─────────────────────────────────────────
window.sendChatMessage = async function() {
  if (chatSessionStatus === 'ended') return showToast('This chat session has ended.', 'warning', 'ri-close-line', 'Ended');
  const input = document.getElementById('chatInput');
  const text  = input?.value.trim();
  if (!text) return;

  // Handle edit
  if (editingMsgId) {
    const data = await api(`/api/user/chat/message/${editingMsgId}`, {
      method: 'PUT',
      body: JSON.stringify({ content: text })
    });
    if (data?.success) { cancelReply(); await loadChatMessages(); }
    else showToast(data?.error || 'Failed', 'error', 'ri-close-line', 'Error');
    return;
  }

  input.value = '';

  const body = { content: text, type: 'text' };
  if (replyingTo) body.replyTo = replyingTo;
  cancelReply();

  const data = await api('/api/user/chat/send', {
    method: 'POST',
    body: JSON.stringify(body)
  });
  if (data?.success) {
    chatAllMessages.push(data.message);
    const container = document.getElementById('chatMessages');
    const empty = container?.querySelector('[style*="No messages"]');
    if (empty) empty.remove();
    container?.appendChild(buildMsgBubble(data.message, 'user'));
    container.scrollTop = container.scrollHeight;
    lastMsgCount++;
  } else {
    showToast(data?.error || 'Failed to send.', 'error', 'ri-close-line', 'Error');
  }
};

// ─── ANSWER POLAR ─────────────────────────────────────────
window.answerPolar = async function(msgId, answer, btnEl) {
  // Disable both buttons immediately
  if (btnEl) {
    const parent = btnEl.closest('div');
    if (parent) parent.querySelectorAll('button').forEach(b => { b.disabled = true; b.style.opacity = '0.5'; b.style.cursor = 'not-allowed'; });
  }

  const data = await api('/api/user/chat/send', {
    method: 'POST',
    body: JSON.stringify({ content: answer, type: 'polar_answer', polarMsgId: msgId })
  });
  if (data?.success) {
    await loadChatMessages();
  } else {
    showToast(data?.error || 'Failed to answer.', 'error', 'ri-close-line', 'Error');
    if (btnEl) {
      const parent = btnEl.closest('div');
      if (parent) parent.querySelectorAll('button').forEach(b => { b.disabled = false; b.style.opacity = '1'; b.style.cursor = 'pointer'; });
    }
  }
};

// ─── UPLOAD IMAGE ─────────────────────────────────────────
window.handleChatImageUpload = async function(input) {
  const file = input.files[0];
  if (!file) return;
  if (chatSessionStatus === 'ended') return showToast('Session ended.', 'warning', 'ri-close-line', 'Ended');

  showToast('Uploading image...', 'info', 'ri-loader-line', 'Uploading');

  const keysRes  = await api('/api/user/apikeys');
  const imgbbKey = keysRes?.imgbb;
  if (!imgbbKey) return showToast('Image upload not configured.', 'error', 'ri-close-line', 'Error');

  const formData = new FormData();
  formData.append('image', file);
  const res    = await fetch(`https://api.imgbb.com/1/upload?key=${imgbbKey}`, { method:'POST', body:formData });
  const result = await res.json();
  if (!result.success) return showToast('Upload failed.', 'error', 'ri-close-line', 'Error');

  const body = { type: 'image', imageUrl: result.data.url, content: '📷 Image' };
  if (replyingTo) body.replyTo = replyingTo;
  cancelReply();

  const data = await api('/api/user/chat/send', { method:'POST', body: JSON.stringify(body) });
  if (data?.success) {
    chatAllMessages.push(data.message);
    const container = document.getElementById('chatMessages');
    container?.appendChild(buildMsgBubble(data.message, 'user'));
    container.scrollTop = container.scrollHeight;
    lastMsgCount++;
  }
  input.value = '';
};

// ─── TYPING INDICATOR ─────────────────────────────────────
window.onChatInputKeydown = function(e) {
  if (e.key === 'Enter') { sendChatMessage(); return; }
  clearTimeout(chatTypingTimer);
  chatTypingTimer = setTimeout(() => {
    api('/api/user/chat/typing', { method:'POST', body:'{}' });
  }, 300);
};

function startTypingPoll() {
  stopTypingPoll();
  chatTypingPollTimer = setInterval(async () => {
    if (window.location.hash !== '#chat' || !chatSessionId) return;
    const data = await api('/api/user/chat/typing');
    const el = document.getElementById('chatTypingIndicator');
    if (el) el.style.display = data?.typing ? 'flex' : 'none';
  }, 2000);
}

function stopTypingPoll() {
  if (chatTypingPollTimer) clearInterval(chatTypingPollTimer);
}

// ─── UPDATE SESSION UI ────────────────────────────────────
function updateChatSessionUI() {
  const ended    = chatSessionStatus === 'ended';
  const badge    = document.getElementById('chatEndedBadge');
  const inputBar = document.getElementById('chatInputBar');
  const statusDot = document.getElementById('chatStatusDot');
  if (badge) badge.style.display = ended ? 'block' : 'none';
  if (inputBar) inputBar.style.display = ended ? 'none' : 'flex';
  if (statusDot) statusDot.textContent = ended ? '● Session Ended' : '● Online';
}

// ─── POLL FOR NEW MESSAGES ────────────────────────────────
function startChatPolling() {
  stopChatPolling();
  chatPollTimer = setInterval(async () => {
    if (window.location.hash !== '#chat') return;
    const data = await api('/api/user/chat/messages');
    if (!data?.success) return;
    if (data.messages.length !== lastMsgCount || JSON.stringify(data.messages.map(m=>m.reactions)) !== JSON.stringify(chatAllMessages.map(m=>m.reactions))) {
      const newMsgs    = data.messages.slice(lastMsgCount);
      const hasAdminMsg = newMsgs.some(m => m.sender === 'admin');
      chatAllMessages  = data.messages;
      renderChatMessages(data.messages);
      if (chatSoundEnabled && hasAdminMsg) playChatSound();
      lastMsgCount = data.messages.length;
    }
    chatSessionStatus = data.sessionStatus;
    updateChatSessionUI();
  }, 4000);
}

function stopChatPolling() {
  if (chatPollTimer) clearInterval(chatPollTimer);
}

// ─── POLL UNREAD BADGE ────────────────────────────────────
async function pollChatUnread() {
  if (window.location.hash === '#chat') { setTimeout(pollChatUnread, 10000); return; }
  const data  = await api('/api/user/chat/unread');
  const badge = document.getElementById('chatUnreadBadge');
  if (badge && data?.unread > 0) {
    badge.textContent = data.unread;
    badge.style.display = 'flex';
  } else if (badge) {
    badge.style.display = 'none';
  }
  setTimeout(pollChatUnread, 10000);
}

window.addEventListener('DOMContentLoaded', () => {
  setTimeout(pollChatUnread, 3000);
});
