// ============================================================
// FLUX MALL - User Dashboard Script (No Firebase)
// All data fetched from Node.js/MongoDB backend via REST API
// FEX Coin system integrated — balances stored & shown in FEX
// ============================================================

let currentUserData = null;
let globalConfig = { minWithdraw: 2000, withdrawFee: 0 };
let FEX_RATE = 0.7; // 1 FEX = ₦0.7 — overwritten by server on init

// ─── API HELPER ────────────────────────────────────────────
async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options
  });
  if (res.status === 401) { logoutUser(); return null; }
  
  if (res.json) {
    setTimeout(() => {
      document.querySelector('.loader-container').style.display = 'none';
    }, 3000);
  }
  return res.json();
}

// ─── LOGOUT ───────────────────────────────────────────────
window.logoutUser = async function() {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  showAlert('Signing you out!!', false);
  localStorage.removeItem('loggedInUser');
  window.location.href = '/m2/index.html#login-page';
};

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
    if (maintenance?.enabled) {
      renderLockScreen('🛠 System Maintenance', 'Our site is currently undergoing scheduled upgrades, We\'ll be back shortly.');
      return;
    }
    
    if (config.siteName) {
      document.querySelectorAll('.site-name').forEach(el => el.innerText = config.siteName);
      document.title = config.siteName;
    }
    if (config.siteLogo) {
      chatSiteLogo = config.siteLogo;
      document.querySelectorAll('.logo-img').forEach(img => {
        img.src = config.siteLogo;
        img.onerror = () => img.style.display = 'none';
      });
      let fav = document.querySelector("link[rel='icon']");
      if (!fav) {
        fav = document.createElement('link');
        fav.rel = 'icon';
        document.head.appendChild(fav);
      }
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
  
  // ── Load live FEX rate from server ──────────────────────
  const rateRes = await api('/api/user/fex-rate');
  if (rateRes?.success) {
    FEX_RATE = rateRes.fexRate;
    console.log(`[FEX] Rate loaded: 1 FEX = ₦${FEX_RATE}`);
  }
  
  renderUserUI();
  
  if (currentUserData.status === 'Banned') {
    renderLockScreen('🚫 Account Banned', 'Your account has been suspended for violating our terms of service.');
    return;
  }
  
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
  loadReferralTiers()
  
  const today = new Date().toDateString();
  if (currentUserData.lastCheckIn === today) {
    const btn = document.getElementById('checkinBtn');
    if (btn) { btn.innerHTML = `<i class="ri-gift-line"></i> Refer`; }
  }
}

// ─── RENDER USER UI ───────────────────────────────────────
function renderUserUI() {
  const u = currentUserData;
  document.querySelectorAll('.userName').forEach(el => el.innerHTML = u.username?.substring(0, 10));
  document.querySelectorAll('.userEmail').forEach(el => el.innerHTML = u.email);

  document.querySelectorAll('.avtr').forEach(el => {
    el.innerHTML = u.username?.slice(0, 1).toUpperCase() || '??';
  });
  
  const fexBal = Number(u.ib) || 0;
  const nairaEq = (fexBal * FEX_RATE).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fexFmt = fexBal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  
  document.querySelectorAll('.balance').forEach(el => {
    el.innerHTML = `${fexFmt} <small style="font-size:0.6em;opacity:0.6;font-weight:400;"></small>`;
  });
  
  document.querySelectorAll('.balance-naira').forEach(el => {
    el.innerHTML = `≈ ₦${nairaEq}`;
  });
}

// ─── WITHDRAWALS ──────────────────────────────────────────
async function loadWithdrawals() {
  const list = document.getElementById('withdrawList');
  if (!list) return;
  const data = await api('/api/user/withdrawals');
  if (!data?.success) return;
  list.innerHTML = '';
  if (!data.withdrawals.length) {
    list.innerHTML = `<div class="empty-state"><div class="fox-logo-placeholder">🔮</div><p>Nothing here to see</p></div>`;
    return;
  }
  data.withdrawals.forEach(d => {
    const badgeClass = d.status === 'pending' ? 'badge-pending' : d.status === 'success' ? 'badge-success' : 'badge-declined';
    const dateStr = d.createdAt ? new Date(d.createdAt).toLocaleDateString() : 'Just now';
    const rate = d.fexRate || FEX_RATE;
    const nairaStr = d.nairaAmount ?
      `₦${Number(d.nairaAmount).toLocaleString()}` :
      `₦${(Number(d.amount) * rate).toLocaleString()}`;
    list.innerHTML += `
      <div class="history-item">
        <div class="tx-details">
          <span class="tx-amount">🪙 ${Number(d.amount).toLocaleString()}</span>
          <span class="tx-date">${nairaStr} · ${dateStr}</span>
        </div>
        <span class="badge ${badgeClass}">${d.status}</span>
      </div>`;
  });
}

// ======================================================
// TRANSACTIONS ENGINE
// ======================================================
const TXN_ENDPOINTS = {
  deposit: '/api/user/deposits',
  withdrawal: '/api/user/withdrawals',
  activity: '/api/user/activity',
};

const txnCache = { deposit: null, withdrawal: null, activity: null };
let txnFiltered = [];
let txnPage = 1;
const TXN_PER_PAGE = 10;

function initTransactions() {
  const type = document.getElementById('txnTypeFilter').value || 'all';
  loadTransactions(type);
}

function onTypeFilterChange() {
  const type = document.getElementById('txnTypeFilter').value;
  document.getElementById('txnStatusFilter').value = 'all';
  document.getElementById('txnSearch').value = '';
  txnPage = 1;
  loadTransactions(type);
}

async function fetchEndpoint(type) {
  if (txnCache[type] !== null) return txnCache[type];
  const json = await api(TXN_ENDPOINTS[type]);
  if (!json) throw new Error(`${type}: unauthorized or failed`);
  const rows = Array.isArray(json) ? json :
    json.data ? json.data :
    json.transactions ? json.transactions :
    json.deposits ? json.deposits :
    json.withdrawals ? json.withdrawals :
    json.activity ? json.activity : [];
  const tagged = rows.map(r => ({ ...r, _type: type }));
  txnCache[type] = tagged;
  return tagged;
}

async function loadTransactions(type) {
  showTxnState('loading');
  setRefreshSpin(true);
  try {
    let rows = [];
    if (type === 'all') {
      const [deps, wds, acts] = await Promise.all([
        fetchEndpoint('deposit'),
        fetchEndpoint('withdrawal'),
        fetchEndpoint('activity'),
      ]);
      rows = [...deps, ...wds, ...acts];
    } else {
      rows = await fetchEndpoint(type);
    }
    rows.sort((a, b) => {
      const da = new Date(a.createdAt || a.date || 0);
      const db = new Date(b.createdAt || b.date || 0);
      return db - da;
    });
    txnFiltered = rows;
    txnPage = 1;
    logTxnTotals();
    applyTxnFilters();
  } catch (err) {
    console.error('[Transactions] Fetch error:', err);
    showTxnState('error');
    document.getElementById('txnErrorMsg').textContent = err.message || 'Failed to load transactions';
  } finally {
    setRefreshSpin(false);
  }
}

function applyTxnFilters() {
  const status = document.getElementById('txnStatusFilter').value;
  const search = document.getElementById('txnSearch').value.trim().toLowerCase();
  const type = document.getElementById('txnTypeFilter').value;
  let rows = type === 'all' ? [...(txnCache.deposit || []), ...(txnCache.withdrawal || []), ...(txnCache.activity || [])] :
    (txnCache[type] || []);
  if (status !== 'all') rows = rows.filter(r => (r.status || '').toLowerCase() === status);
  if (search) rows = rows.filter(r => JSON.stringify(r).toLowerCase().includes(search));
  txnFiltered = rows;
  txnPage = 1;
  renderTxnTable();
}

function renderTxnTable() {
  if (!txnFiltered.length) { showTxnState('empty'); return; }
  showTxnState('table');
  const start = (txnPage - 1) * TXN_PER_PAGE;
  const slice = txnFiltered.slice(start, start + TXN_PER_PAGE);
  document.getElementById('txnTableBody').innerHTML = slice.map(r => buildTxnRow(r)).join('');
  renderPagination();
  renderSummaryPills();
}

function buildTxnRow(r) {
  const type = r._type || 'activity';
  const status = (r.status || 'pending').toLowerCase();
  const amount = r.amount || 0;
  const ref = r.reference || r.ref || r.txn_id || r._id || '—';
  const dateRaw = r.createdAt || r.date;
  const date = dateRaw ? new Date(dateRaw).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
  return `<tr>
    <td>${buildTypeBadge(type)}</td>
    <td style="max-width:180px;">${buildAmountStr(type, amount)}</td>
    <td style="white-space:nowrap;font-size:10px;">${date}</td>
    <td>${buildStatusBadge(status)}</td>
    <td style="font-family:monospace;font-size:11px;color:var(--text3);">${escHtml(String(ref)).substring(0, 8)}</td>
  </tr>`;
}

function buildTypeBadge(type) {
  const map = {
    deposit: 'background:var(--blue-bg);color:var(--blue)',
    withdrawal: 'background:var(--red-bg);color:var(--red)',
    activity: 'background:var(--accent-glow);color:var(--accent2)',
  };
  return `<span class="badge" style="${map[type]||''}">${type.charAt(0).toUpperCase()+type.slice(1)}</span>`;
}

function buildStatusBadge(status) {
  const map = { success: 'success', pending: 'pending', failed: 'failed', warning: 'pending' };
  return `<span class="badge ${map[status]||'pending'}">${status.charAt(0).toUpperCase()+status.slice(1)}</span>`;
}

function buildAmountStr(type, amount) {
  const num = parseFloat(amount) || 0;
  const naira = (num * FEX_RATE).toLocaleString('en-NG', { minimumFractionDigits: 2 });
  const fexFmt = num.toLocaleString('en-US', { minimumFractionDigits: 2 });
  const isCredit = type === 'deposit' || type === 'activity';
  const color = isCredit ? 'var(--green)' : 'var(--red)';
  const sign = isCredit ? '+' : '-';
  return `<span style="color:${color};font-weight:500;">${sign}🪙${fexFmt}</span><br>
          <span style="font-size:10px;color:var(--text3);">≈ ₦${naira}</span>`;
}

function escHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderPagination() {
  const total = txnFiltered.length;
  const totalPages = Math.ceil(total / TXN_PER_PAGE);
  const start = (txnPage - 1) * TXN_PER_PAGE + 1;
  const end = Math.min(txnPage * TXN_PER_PAGE, total);
  document.getElementById('txnPageInfo').textContent = `Showing ${start}–${end} of ${total} transactions`;
  document.getElementById('txnPrevBtn').disabled = txnPage <= 1;
  document.getElementById('txnNextBtn').disabled = txnPage >= totalPages;
  const btnsEl = document.getElementById('txnPageBtns');
  btnsEl.innerHTML = '';
  getPageRange(txnPage, totalPages, 5).forEach(p => {
    const b = document.createElement('button');
    b.className = 'btn btn-ghost btn-sm';
    b.style.cssText = p === txnPage ? 'background:var(--accent);color:#fff;min-width:32px;' : 'min-width:32px;';
    b.textContent = p;
    b.onclick = () => {
      txnPage = p;
      renderTxnTable();
    };
    btnsEl.appendChild(b);
  });
  document.getElementById('txnPagination').style.display = totalPages > 1 ? 'flex' : 'none';
}

function getPageRange(current, total, size) {
  let start = Math.max(1, current - Math.floor(size / 2));
  let end = Math.min(total, start + size - 1);
  if (end - start + 1 < size) start = Math.max(1, end - size + 1);
  const range = [];
  for (let i = start; i <= end; i++) range.push(i);
  return range;
}

function changeTxnPage(dir) {
  const total = Math.ceil(txnFiltered.length / TXN_PER_PAGE);
  txnPage = Math.max(1, Math.min(txnPage + dir, total));
  renderTxnTable();
}

function renderSummaryPills() {
  const type = document.getElementById('txnTypeFilter').value;
  const source = type === 'all' ? [...(txnCache.deposit || []), ...(txnCache.withdrawal || []), ...(txnCache.activity || [])] :
    (txnCache[type] || []);
  // Summary pill elements are commented out in HTML — kept here for easy re-enable
  void source;
}

function logTxnTotals() {
  const types = ['deposit', 'withdrawal', 'activity'];
  
  const updateUI = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };
  
  console.group('%c[FluxMall] Transaction Totals', 'color:#8b85ff;font-weight:700;font-size:13px;');
  
  types.forEach(type => {
    const rows = txnCache[type];
    if (!rows) return;
    
    const success = rows.filter(r => (r.status || '').toLowerCase() === 'success');
    const pending = rows.filter(r => (r.status || '').toLowerCase() === 'pending');
    const failed = rows.filter(r => (r.status || '').toLowerCase() === 'failed');
    const warning = rows.filter(r => (r.status || '').toLowerCase() === 'warning');
    
    const sumFex = arr => arr.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    const sumNaira = arr => (sumFex(arr) * FEX_RATE).toFixed(2);
    
    updateUI(`${type}-total-count`, rows.length);
    [{ name: 'success', data: success }, { name: 'pending', data: pending }, { name: 'failed', data: failed }, { name: 'warning', data: warning }]
    .forEach(s => {
      updateUI(`${type}-${s.name}-count`, s.data.length);
      updateUI(`${type}-${s.name}-fex`, sumFex(s.data).toLocaleString());
      updateUI(`${type}-${s.name}-naira`, sumNaira(s.data));
    });
    
    console.group(`%c${type.toUpperCase()}`, 'color:#f0f2f8;font-weight:600;');
    console.log(`  Total records : ${rows.length}`);
    console.log(`  ✅ Success     : ${success.length}  (🪙${sumFex(success).toLocaleString()} FEX = ₦${sumNaira(success)})`);
    console.log(`  ⏳ Pending     : ${pending.length}  (🪙${sumFex(pending).toLocaleString()} FEX = ₦${sumNaira(pending)})`);
    console.log(`  ❌ Failed      : ${failed.length}   (🪙${sumFex(failed).toLocaleString()} FEX = ₦${sumNaira(failed)})`);
    if (warning.length) console.log(`  ⚠️  Warning     : ${warning.length}  (🪙${sumFex(warning).toLocaleString()} FEX = ₦${sumNaira(warning)})`);
    console.groupEnd();
  });
  
  console.groupEnd();
}

function showTxnState(state) {
  document.getElementById('txnLoading').style.display = state === 'loading' ? 'block' : 'none';
  document.getElementById('txnError').style.display = state === 'error' ? 'block' : 'none';
  document.getElementById('txnEmpty').style.display = state === 'empty' ? 'block' : 'none';
  document.getElementById('txnTableWrap').style.display = state === 'table' ? 'block' : 'none';
  if (state !== 'table') document.getElementById('txnSummaryBar').style.display = 'none';
}

function setRefreshSpin(on) {
  document.getElementById('txnRefreshBtn').classList.toggle('spinning', on);
}

function refreshTransactions() {
  const type = document.getElementById('txnTypeFilter').value;
  if (type === 'all') txnCache.deposit = txnCache.withdrawal = txnCache.activity = null;
  else txnCache[type] = null;
  loadTransactions(type);
}

function exportTxnCSV() {
  if (!txnFiltered.length) { showAlert('No transactions to export.', 'warning', 'ri-close-line', 'Empty'); return; }
  const headers = ['Description', 'Type', 'FEX Amount', 'Naira Equiv', 'Date', 'Status', 'Reference'];
  const rows = txnFiltered.map(r => [
    r.description || r.narration || r._type || '',
    r._type || '',
    r.amount || 0,
    ((parseFloat(r.amount) || 0) * FEX_RATE).toFixed(2),
    r.createdAt || r.date || '',
    r.status || '',
    r.reference || r.ref || r._id || '',
  ].map(v => `"${String(v).replace(/"/g,'""')}"`).join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `transactions_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showAlert('CSV downloaded', 'success', 'ri-download-line', 'Done');
}

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    if (!txnCache.deposit && !txnCache.withdrawal && !txnCache.activity) {
      Promise.all([
        fetchEndpoint('deposit').catch(() => null),
        fetchEndpoint('withdrawal').catch(() => null),
        fetchEndpoint('activity').catch(() => null),
      ]).then(() => logTxnTotals());
    }
  }, 1200);
});

// ─── DEPOSIT INITIATION ───────────────────────────────────
window.initiateDeposit = async function(amount) {
  /*
    if (!document.getElementById('attest')?.checked)
      return showAlert('Please read and accept before proceeding.', 'warning', 'ri-close-line', 'Attestation');
  */
  amount = Number(amount);
  if (!amount) return showAlert('Enter valid amount (Minimum 3000)', 'error', 'ri-close-line', 'Invalid Amount');
  
  const config = window.paymentConfig || {};
  
  // ── Korapay mode: use custom modal instead of Korapay popup ──
  if (config.mode === 'korapay' && config.korapay?.publicKey) {
    payWithKorapay(amount, config.korapay.publicKey);
    return;
  }
  // ── Manual bank transfer fallback ────────────────────────
  const refCode = Math.floor(10000000 + Math.random() * 90000000).toString();
  const bankName = config.manual?.bankName || 'Contact Admin';
  const accNum = config.manual?.accountNumber || '0000000000';
  const accName = config.manual?.accountName || 'Admin';
  
  showConfirm({
    title: 'Complete Transfer',
    message: 'Proceed to your bank app to complete this transfer.',
    detail: `  
      <strong style="font-size:1.3rem;font-weight:800;">₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</strong>
      <div class="bank-details">
        <div class="detail-row"><p style="font-size:0.9rem;color:#666">Transfer the exact amount to:</p></div>
        <div class="detail-row"><span>Bank:</span>
        <strong><span>${bankName}</span> <i onclick="copyCode('${bankName}')" class="ri-file-copy-line"></i>
        </strong>
        </div>
        <div class="detail-row"><span>Account:</span><strong id="modalAcc">
        <span>${accNum}</span>
        <i onclick="copyCode('${accNum}')" class="ri-file-copy-line"></i>
        </strong>
        </div>
        <div class="detail-row"><span>Name:</span><strong>${accName}</strong></div>
        <hr style="border:0;border-top:1px solid #e2e8f0;margin:15px 0;">
        <div style="text-align:center;cursor:pointer" onclick="copyCode('${refCode}')">
          <span style="font-size:0.75rem;color:#666;text-transform:uppercase;font-weight:bold;">Use this Reference as Narration</span>
          <span class="ref-box" id="modalRef">${refCode}</span>
      `,
    yesText: 'Done',
    noText: 'Cancel',
    onConfirm: async function() {
      // closeModal();
      const fexAmount = parseFloat((amount / FEX_RATE).toFixed(2));
      const data = await api('/api/user/deposit', {
        method: 'POST',
        body: JSON.stringify({ amount: fexAmount, method: 'Bank Transfer', refCode: refCode || 'MAN_' + Date.now(), status: 'pending' })
      });
      if (data?.success) {
        showAlert('Deposit submitted! Awaiting admin approval.', 'info', 'ri-check-line', 'Submitted');
      } else {
        showAlert(data?.error || 'Error submitting deposit.', 'error', 'ri-close-line', 'Error');
      }
    },
    onCancel: function() {}
  });
  //to be pasted
};

/*
window.submitManualDeposit = async (amount, refCode) => {
  closeModal();
  const fexAmount = parseFloat((amount / FEX_RATE).toFixed(2));
  const data = await api('/api/user/deposit', {
    method: 'POST',
    body: JSON.stringify({ amount: fexAmount, method: 'Bank Transfer', refCode: refCode || 'MAN_' + Date.now(), status: 'pending' })
  });
  if (data?.success) {
    showAlert('Deposit submitted! Awaiting admin approval.', 'info', 'ri-check-line', 'Submitted');
  } else {
    showAlert(data?.error || 'Error submitting deposit.', 'error', 'ri-close-line', 'Error');
  }
};
*/
// ─── KORAPAY CUSTOM MODAL ────────────────────────────────
// Calls server-side Korapay Collect API, then renders our own
// modal with the virtual bank account details — no Korapay popup.
window.payWithKorapay = async (amount, _key) => {
  // Step 1 — show loading modal immediately so user sees feedback
  const loadingModal = document.createElement('div');
  loadingModal.id = 'paymentModal';
  loadingModal.className = 'modal-overlay';
  loadingModal.innerHTML = `
    <div class="modal-content" style="text-align:center;padding:40px 24px;">
      <div style="font-size:2.5rem;margin-bottom:14px;">⏳</div>
      <p style="color:var(--text2);font-size:15px;font-weight:500;">Generating your secure account...</p>
      <p style="color:var(--text3);font-size:12px;margin-top:6px;">This takes a few seconds</p>
    </div>`;
  document.body.appendChild(loadingModal);
  
  try {
    // Step 2 — ask server to create a Korapay virtual account charge
    const data = await api('/api/user/initiate-korapay', {
      method: 'POST',
      body: JSON.stringify({ amount })
    });
    closeModal(); // remove loading modal
    if (!data?.success) {
      return showAlert(data?.error || 'Could not initialize payment. Try again.', 'error', 'ri-close-line', 'Error');
    }
    console.log(data.bankName)
    // Step 3 — show our own custom modal with the bank details
    const fexToCredit = parseFloat((amount / FEX_RATE).toFixed(2));
    const expiryText = data.expiresAt ?
      `⏱ Expires at ${new Date(data.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` :
      '⏱ Valid for this session only';
    
    showConfirm({
      title: 'Complete Bank Transfer',
      message: 'Transfer the exact amount to the account below.',
      detail: `  
        <strong style="font-size:1.4rem;color:var(--text1);">
          ₦${Number(amount).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
        </strong>
        <div style="font-size:12px;color:var(--text3);margin-top:4px;margin-bottom:18px;">
          🪙 ${fexToCredit.toLocaleString()} will be credited after payment confirms
        </div>

        <div class="bank-details">
          <div class="detail-row">
            <span>Bank:</span>
            <strong>${data.bankName || '—'}</strong>
          </div>
          <div class="detail-row" onclick="copyText('koraAccNum')" style="cursor:pointer;user-select:none;">
            <span>Account:</span>
            <strong id="koraAccNum">${data.accountNumber || '—'}</strong>
            <span style="font-size:11px;color:var(--primary);margin-left:6px;">tap to copy</span>
          </div>
          <div class="detail-row">
            <span>Name:</span>
            <strong>${data.accountName || '—'}</strong>
          </div>
          <div class="detail-row" onclick="copyText('koraRef')" style="cursor:pointer;user-select:none;">
            <span>Reference:</span>
            <strong id="koraRef">${data.reference}</strong>
            <span style="font-size:11px;color:var(--primary);margin-left:6px;">tap to copy</span>
          </div>
          <p style="font-size:0.75rem;color:#888;text-align:center;margin-top:12px;">${expiryText}</p>
          <p style="font-size:0.75rem;color:#888;text-align:center;margin-top:4px;">
            This account is generated for this transaction only
          </p>
        </div>
      `,
      yesText: 'I have sent it',
      noText: 'Cancel',
      onConfirm: async function() {
        confirmKorapayDeposit(data.reference, fexToCredit)
      },
      onCancel: function() {}
    });
  } catch (err) {
    showAlert('Something went wrong. Please try again.', 'error', 'ri-close-line', 'Error');
    console.error('[Korapay Modal Error]', err);
  }
};

// ─── CONFIRM KORAPAY DEPOSIT ──────────────────────────────
// Called when user taps "I Have Sent the Money"
// Records as pending — webhook or admin will confirm it
window.confirmKorapayDeposit = async (reference, fexAmount) => {
  closeModal();
  const data = await api('/api/user/deposit', {
    method: 'POST',
    body: JSON.stringify({
      amount: fexAmount,
      method: 'Korapay',
      refCode: reference,
      status: 'pending'
    })
  });
  if (data?.success) {
    showAlert('Deposit submitted! Will be credited once your transfer confirms.', 'info', 'ri-check-line', 'Submitted');
    refreshBalance();
  } else {
    showAlert(data?.error || 'Error recording deposit.', 'error', 'ri-close-line', 'Error');
  }
};

function addNewBank() {
  
}


// ─── WITHDRAWAL ───────────────────────────────────────────
window.handleWithdrawalSubmit = async () => {
  const fexAmount = Number(document.getElementById('withdrawAmount').value);
  const btn = document.getElementById('withdrawBtn');
  const u = currentUserData;
  
  if (!u.bankDetails?.accountNumber)
    return showAlert('Please bind your Bank Account in the Profile section first.', 'warning', 'ri-close-line', 'Bank Required');
  if (!u.emailVerified)
    return showAlert('❌ Verification Required! Verify your account first.', 'error', 'ri-close', 'Verify First');
  if (!fexAmount || fexAmount <= 0)
    return showAlert('Enter a valid FEX amount.', 'warning', 'ri-close-line', 'Invalid Amount');
  if (fexAmount > u.ib)
    return showAlert('Insufficient FEX balance.', 'warning', 'ri-close-line', 'Insufficient');
  
  const conv = await api('/api/user/convert-fex', {
    method: 'POST',
    body: JSON.stringify({ fexAmount })
  });
  
  if (!conv?.success)
    return showAlert(conv?.error || 'Could not fetch conversion rate.', 'error', 'ri-close-line', 'Error');
  
  const { naira, fexRate } = conv;
  const fee = parseFloat(((naira * globalConfig.withdrawFee) / 100).toFixed(2));
  const net = parseFloat((naira - fee).toFixed(2));
  
  showConfirm({
    title: 'Confirm Withdrawal',
    message: 'Please review your withdrawal details below.',
    detail: `
      <div class="detail-row"><span>Amount:</span><strong>🪙${fexAmount.toLocaleString()} FEX</strong></div>
      <div class="detail-row"><span>Rate:</span><strong>1 FEX = ₦${fexRate}</strong></div>
      <div class="detail-row"><span>Naira Value:</span><strong>₦${naira.toLocaleString()}</strong></div>
      <div class="detail-row"><span>Fee (${globalConfig.withdrawFee}%):</span><strong>₦${fee.toLocaleString()}</strong></div>
      <div class="detail-row"><span>You receive:</span><strong>₦${net.toLocaleString()}</strong></div>
    `,
    yesText: 'Confirm',
    noText: 'Cancel',
    onConfirm: async function() {
      btn.disabled = true;
      btn.innerText = 'Processing...';
      try {
        const data = await api('/api/user/withdraw', {
          method: 'POST',
          body: JSON.stringify({ fexAmount })
        });
        if (data?.success) {
          showAlert(data.message || '✅ Withdrawal submitted!', 'info', 'ri-check-line', 'Success');
          document.getElementById('withdrawAmount').value = '';
          loadWithdrawals();
          refreshBalance();
        } else {
          showAlert(data?.error || 'Error submitting withdrawal.', 'error', 'ri-close-line', 'Error');
        }
      } catch (err) {
        showAlert('Something went wrong.', 'warning', 'ri-close-line', 'Error');
      } finally {
        btn.disabled = false;
        btn.innerText = 'Confirm Withdrawal';
      }
    },
    onCancel: function() {}
  });
};

window.updateWithdrawPreview = () => {
  const fex = Number(document.getElementById('withdrawAmount').value) || 0;
  const naira = parseFloat((fex * FEX_RATE).toFixed(2));
  const fee = parseFloat(((naira * globalConfig.withdrawFee) / 100).toFixed(2));
  const net = parseFloat((naira - fee).toFixed(2));
  const el = document.getElementById('netAmount');
  if (el) {
    el.innerHTML = fex > 0 ?
      `₦${net.toLocaleString()} <span style="font-size:11px;opacity:0.6;">(🪙${fex.toLocaleString()} FEX @ ₦${FEX_RATE}/FEX)</span>` :
      '₦0.00';
  }
};

// ─── BANK SYNC ───────────────────────────────────────────
async function initBankSync() {
  const u = currentUserData;
  await loadBanksDropdown();
  if (u.bankDetails?.accountNumber) {
    const b = u.bankDetails;
    const an = document.getElementById('accNumber');
    const ac = document.getElementById('accName');
    if (an) an.value = b.accountNumber || '';
    if (ac) ac.value = b.accountName || '';
    const bn = document.getElementById('bankName');
    if (bn) {
      const match = Array.from(bn.options).find(o => o.text === b.bankName || o.value === b.bankCode);
      if (match) bn.value = match.value;
    }
  }
  const isMasterLocked = window.paymentConfig?.globalBankLock || false;
  const saveBtn = document.getElementById('saveBtn');
  if (isMasterLocked && u.bankDetails?.accountNumber) {
    ['bankName', 'accNumber', 'accName'].forEach(id => { const el = document.getElementById(id); if (el) el.disabled = true; });
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerText = 'Contact support';
      saveBtn.style.display = 'none';
    }
    const msg = document.getElementById('status-msg');
    if (msg) msg.innerText = 'This feature is currently unavailable';
  }
}

async function loadBanksDropdown() {
  const select = document.getElementById('bankSelect');
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
      opt.text = bank.name;
      opt.dataset.name = bank.name;
      select.appendChild(opt);
    });
    const accNum = document.getElementById('accNumber')?.value;
    if (accNum?.length === 10) handleAccNumberInput(accNum);
  } catch (err) {
    select.innerHTML = '<option value="">❌ Could not load banks</option>';
  }
}

// ─── ACCOUNT NUMBER AUTO-VERIFY ──────────────────────────
let verifyTimer = null;

window.handleAccNumberInput = (value) => {
  clearTimeout(verifyTimer);
  const statusEl = document.getElementById('verifyStatus');
  const accName = document.getElementById('accName');
  if (accName) accName.value = '';
  if (statusEl) statusEl.innerHTML = '';
  if (value.length !== 10) return;
  
  const bankCode = document.getElementById('bankSelect')?.value;
  
  if (bankCode) { verifyAccount(value); return; }
  
  if (statusEl) statusEl.innerHTML = '<span style="color:var(--primary)">🔍 Detecting bank...</span>';
  verifyTimer = setTimeout(async () => {
    try {
      const data = await api('/api/user/resolve-account', {
        method: 'POST',
        body: JSON.stringify({ accountNumber: value })
      });
      if (data?.success) {
        if (accName) accName.value = data.accountName;
        const bankSelect = document.getElementById('bankSelect');
        if (bankSelect) bankSelect.value = data.bankCode;
        if (statusEl) statusEl.innerHTML = `<span style="color:#10ac84">✅ ${data.accountName} · ${data.bankName}</span>`;
      } else {
        if (statusEl) statusEl.innerHTML = `<span style="color:orange">⚠️ ${data?.error || 'Could not detect bank. Please select manually.'}</span>`;
      }
    } catch (err) {
      if (statusEl) statusEl.innerHTML = '<span style="color:red">❌ Connection error</span>';
    }
  }, 700);
};

async function verifyAccount(accountNumber) {
  const bankSelect = document.getElementById('bankName');
  const statusEl = document.getElementById('verifyStatus');
  const accName = document.getElementById('accName');
  const bankCode = bankSelect?.value;
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
  const bankCode = bankSelect?.value;
  const bankLabel = bankSelect?.options[bankSelect.selectedIndex]?.dataset?.name || '';
  const aNum = document.getElementById('accNumber').value.trim();
  const aName = document.getElementById('accName').value.trim();
  if (!bankCode) return showAlert('Please select a bank.', 'warning', 'ri-close-line', 'Invalid Input');
  if (aNum.length !== 10) return showAlert('Account number must be exactly 10 digits.', 'warning', 'ri-close-line', 'Invalid Input');
  if (!aName) return showAlert('Account not verified yet.', 'warning', 'ri-close-line', 'Not Verified');
  const data = await api('/api/user/bank-details', {
    method: 'PUT',
    body: JSON.stringify({ bankName: bankLabel, bankCode, accountNumber: aNum, accountName: aName })
  });
  if (data?.success) {
    showAlert('✅ Bank details saved successfully!', 'info', 'ri-check-line', 'Success');
    currentUserData.bankDetails = { bankName: bankLabel, bankCode, accountNumber: aNum, accountName: aName };
  } else {
    showAlert(data?.error || 'Error saving bank details.', 'error', 'ri-close-line', 'Error');
  }
};

// ─── DEPOSIT AMOUNTS ─────────────────────────────────────
const amountListDiv = document.getElementById('amountGrid');
const confirmInput = document.getElementById('depositAmount');
const confirmBtn = document.getElementById('rechargeBtn');

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
    card.className = 'qa-btn';
    const fexEquiv = parseFloat((amt / FEX_RATE).toFixed(2));
    if (index === 0) { card.classList.add('active'); if (confirmInput) confirmInput.value = amt.toFixed(2); }
    card.innerHTML = `₦${amt.toLocaleString()} <small style="display:block;font-size:0.7em;opacity:0.7;">🪙 ${fexEquiv.toLocaleString()} FEX</small>`;
    card.onclick = () => {
      if (confirmInput) confirmInput.value = amt.toFixed(2);
      document.querySelectorAll('.qa-btn').forEach(c => c.classList.remove('active'));
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
  const container = document.getElementById('investment-grid');
  if (!container) return;
  const data = await api('/api/user/shares');
  if (!data?.success) return;
  container.innerHTML = '';
  data.shares.forEach(s => {
    container.innerHTML += `
              <div class="invest-card" data-category="real-estate">
            <div class="image-placeholder">
                        <img src="${s.img}" alt="${s.name}">
            </div>
            <div class="card-details">
              <h3>${s.name}</h3>
              <p class="plan-info">Return: ${s.dailyIncome * s.duration} after ${s.duration} days</p>
              <div class="price-row">
                <span class="price">🪙${s.price.toLocaleString()} FEX</span>
              </div>
              <button class="btn-invest" onclick="buyShare('${s._id}',${s.price},'${s.name}',${s.dailyIncome},${s.duration})">Invest</button>
            </div>
          </div>`;
  });
}

window.buyShare = async (id, price, name, daily, dur) => {
  if (currentUserData.ib < price)
    return showAlert('Insufficient FEX Balance! Try depositing.', 'warning', 'ri-close-line', 'Insufficient Balance');
  showConfirm({
    title: 'Confirm Investment',
    message: `Buy ${name} for 🪙${price.toLocaleString()} FEX?`,
    yesText: 'Buy',
    noText: 'Cancel',
    onConfirm: async function() {
      const data = await api('/api/user/buy-share', {
        method: 'POST',
        body: JSON.stringify({ shareId: id, name, price, dailyIncome: daily, duration: dur })
      });
      if (data?.success) {
        showAlert('🎁 Bonus: 2 Free Spins earned!', 'success', 'ri-close-line', 'Bonus Earned');
        showAlert('Investment Active!', 'info', 'ri-check-line', 'Investment Active');
        refreshBalance();
        loadMyInvestments();
      } else {
        showAlert(data?.error || 'Error buying share.', 'error', 'ri-close-line', 'Error');
      }
    },
    onCancel: function() {}
  });
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
  
  // ─── INVESTMENT STATS CONSOLE LOG ─────────────────────
  const now = new Date();
  const activeInvestments = data.investments.filter(d => {
    const daysPassed = Math.floor((now - new Date(d.purchaseDate)) / (1000 * 60 * 60 * 24));
    return daysPassed < d.duration && d.status === 'active';
  });
  
  const totalDailyProfit = activeInvestments.reduce((sum, d) => sum + Number(d.dailyIncome), 0);
  
  console.group('%c[FluxMall] Investment Summary', 'color:#05cd99;font-weight:700;font-size:13px;');
  console.log(`%c Total Active Plans   : ${activeInvestments.length}`, 'color:#f0f2f8;font-size:12px;');
  console.log(`%c Total Daily Profit   : 🪙${totalDailyProfit.toLocaleString()} FEX`, 'color:#05cd99;font-size:12px;font-weight:600;');
  activeInvestments.forEach((d, i) => {
    const daysPassed = Math.floor((now - new Date(d.purchaseDate)) / (1000 * 60 * 60 * 24));
    const remaining = d.duration - daysPassed;
    console.log(
      `%c  [${i + 1}] ${d.shareName?.toUpperCase()} — Daily: 🪙${Number(d.dailyIncome).toLocaleString()} FEX · ${remaining} days left`,
      'color:#a3adc2;font-size:11px;'
    );
  });
  console.groupEnd();
  // ──────────────────────────────────────────────────────
  
  data.investments.forEach(d => {
    const purchaseDate = new Date(d.purchaseDate);
    const daysPassed = Math.floor(Math.abs(now - purchaseDate) / (1000 * 60 * 60 * 24));
    const remaining = d.duration - daysPassed;
    const progressPct = Math.min(100, (daysPassed / d.duration) * 100);
    
    container.innerHTML += `
      <div class="card" style="border-left:3px solid var(--green);">
        <div class="flex-between mb-4">
          <div>
            <div style="font-family:'Syne',sans-serif;font-weight:700;font-size:16px;">${d.shareName?.toUpperCase()} — ${d.duration}</div>
            <div class="text-xs mt-4">Started: ${purchaseDate.toLocaleDateString()} · Matures in ${remaining} days</div>
          </div>
          <span class="badge success">Active</span>
        </div>
        <div class="form-row" style="margin-bottom:12px;">
          <div>
            <div class="text-xs mb-4">Principal</div>
            <div style="font-weight:700;">🪙${d.pricePaid.toLocaleString()} FEX</div>
          </div>
          <div>
            <div class="text-xs mb-4">Daily Income</div>
            <div style="font-weight:700;color:var(--green);">🪙${d.dailyIncome.toLocaleString()} FEX</div>
          </div>
        </div>
        <div class="flex-between mb-4 text-sm">
          <span>Progress</span><span>${remaining} Days Left</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill green" style="width:${progressPct}%"></div>
        </div>
      </div>`;
  });
}

// ─── COLLECT DAILY EARNINGS ───────────────────────────────
async function collectDailyEarnings() {
  const data = await api('/api/user/collect-earnings', { method: 'POST' });
  if (data?.credited > 0) {
    showAlert(`💰 Daily Profit: 🪙${data.credited.toLocaleString()} FEX added!`, 'info', 'ri-check-line', 'Profit Added');
    refreshBalance();
  }
}

// ─── TEAM DATA ────────────────────────────────────────────
async function loadTeamData() {
  const teamContainer = document.getElementById('teamContainer');
  if (!teamContainer) return;
  
  const data = await api('/api/user/team');
  if (!data?.success) return;
  
  const users = data.level1.users || [];
  
  if (users.length === 0) {
    teamContainer.innerHTML = `
      <div style="text-align:center;padding:3rem;color:var(--text3);border:1px dashed rgba(255,255,255,0.1);border-radius:12px;">
        <i class="ri-user-add-line" style="font-size:24px;opacity:0.5;"></i>
        <p style="margin-top:10px;">No referrals found yet.</p>
      </div>`;
    return;
  }
  
  const REFERRAL_BONUS_NAIRA = 700;
  let totalReferred = users.length;
  let totalEarned = 0;
  let tableRows = '';
  
  users.forEach(u => {
    const date = u.createdAt ?
      new Date(u.createdAt).toLocaleDateString('en-NG', { month: 'short', day: '2-digit', year: 'numeric' }) : '—';
    
    const isCompleted = u.referralCompleted === true;
    const badgeClass = isCompleted ? 'success' : 'pending';
    const statusText = isCompleted ? 'Active' : 'Pending';
    const earnedAmount = isCompleted ? REFERRAL_BONUS_NAIRA : 0;
    
    totalEarned += earnedAmount;
    
    const amountColor = earnedAmount > 0 ? 'var(--green)' : 'var(--yellow)';
    
    tableRows += `
      <tr>
        <td>${u.username || 'Anonymous'}</td>
        <td>${date}</td>
        <td><span class="badge ${badgeClass}">${statusText}</span></td>
        <td style="color:${amountColor};font-weight:600;">₦${earnedAmount.toLocaleString()}</td>
      </tr>`;
  });
  
  document.querySelectorAll('.refStat').forEach((div) => {
    div.innerHTML = `
      <div class="stat-card yellow">
        <div class="stat-icon yellow"><i class="ri-user-add-line"></i></div>
        <div class="stat-value">₦${totalEarned.toLocaleString()}</div>
        <div class="stat-label">Referral Earnings</div>
        <div class="stat-change up"><i class="ri-arrow-up-s-line"></i> ${totalReferred} user(s) referred</div>
      </div>`;
  });
  
  teamContainer.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>User</th><th>Joined</th><th>Status</th><th>Earned</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>`;
}
// ─── REFERRAL LINK ────────────────────────────────────────
function generateReferralLink() {
  if (!currentUserData) return;
  const refId = currentUserData.uid || currentUserData._id;
  const link = `${window.location.origin}/m2/index.html?ref=${refId}#signup-page`;
  document.getElementById('refLink').innerHTML = `
            <div class="referral-block card">
      <h3>Invite Your Friends</h3>
      <p>Earn from refering friends!</p>
      <br>
      <label>Referral code</label>
      <div class="ref-input-row">
        <input type="text" value="${refId}" readonly>
        <button onclick="copyCode('${refId}')" class="copy-btn"><i class="ri-file-copy-line"></i></button>
      </div>
      <label>Referral link</label>
         <div class="ref-input-row">
     <input type="text" value="${link}" readonly>
     <button onclick="copyCode('${link}')" class="copy-btn"><i class="ri-file-copy-line"></i></button>
   </div>
      
   <div class="mt-6" style="margin-top:16px;display:flex;gap:8px;">
     <button class="btn btn-primary" onclick="copyCode('${link}')"><i class="ri-share-line"></i> Share</button>
     <button class="btn btn-outline" onclick="window.open('https://wa.me/?text=${encodeURIComponent(link)}','_blank')"><i class="ri-whatsapp-line"></i> WhatsApp</button>
   </div>
</div>
`;
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
      showAlert(data?.error || 'Spin failed.', 'error', 'ri-close-line', 'Error');
      currentRotation -= (7 * 360) + randomStop;
      if (canvas) canvas.style.transform = `rotate(${currentRotation}deg)`;
      return;
    }
    const win = data.prize;
    if (win.value > 0) {
      showAlert(`🎉 You're Lucky! Won 🪙${win.value} FEX!`, 'success', 'ri-check-line', "You're Lucky!");
    } else {
      showAlert('Unlucky! Try Again', 'warning', 'ri-close-line', win.label);
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
    if (age < 30) showAlert(`${latest.title}\n${latest.message}`, 'info', 'ri-information-line', 'Notification');
    lastNotifCount = data.notifications.length;
  }
  setTimeout(pollNotifications, 15000);
}

// ─── ACTIVITY / HISTORY ───────────────────────────────────
let _activityData = [];

window.fetchUserHistory = async () => {
  const list = document.getElementById('historyList');
  if (!list) return;
  
  list.innerHTML = '<small class="loading">Loading</small>';
  
  const data = await api('/api/user/activity');
  if (!data?.success) {
    list.innerHTML = '<div class="error">Failed to load history.</div>';
    return;
  }
  
  if (!data.activity?.length) {
    list.innerHTML = '<small class="loading">No recent transactions</small>';
    return;
  }
  
  _activityData = data.activity;
  
  const config = {
    checkin: { icon: 'ri-gift-line', class: 'credit' },
    'Check-in': { icon: 'ri-gift-line', class: 'credit' },
    Deposit: { icon: 'ri-arrow-down-line', class: 'credit' },
    deposit: { icon: 'ri-arrow-down-line', class: 'credit' },
    share: { icon: 'ri-time-line', class: 'pending' },
    Share: { icon: 'ri-time-line', class: 'pending' },
    Shares: { icon: 'ri-time-line', class: 'pending' },
    Withdrawal: { icon: 'ri-arrow-up-line', class: 'debit' },
    withdrawal: { icon: 'ri-arrow-up-line', class: 'debit' },
  };
  
  list.innerHTML = '';
  data.activity.forEach(item => {
    const date = new Date(item.createdAt).toLocaleDateString();
    const typeConfig = config[item.type] || { icon: 'ri-exchange-line', class: 'credit' };
    const div = document.createElement('div');
    div.className = 'txn-item';
    div.innerHTML = `
      <div class="txn-icon ${typeConfig.class}">
        <i class="${typeConfig.icon}"></i>
      </div>
      <div class="txn-info">
        <div class="txn-name">${item.desc}</div>
        <div class="txn-date">${date}</div>
      </div>
      <div class="txn-amount ${typeConfig.class}">
        ${typeConfig.class === 'debit' ? '-' : ''}🪙${Number(item.amount).toLocaleString()}
      </div>`;
    list.appendChild(div);
  });
  
  renderActivityChart('7D');
};

window.renderActivityChart = function(range) {
  const chartEl = document.getElementById('activityChart');
  const labelsEl = document.getElementById('activityChartLabels');
  if (!chartEl || !labelsEl) return;
  
  const now = new Date();
  let days = 7;
  if (range === '30D') days = 30;
  if (range === '90D') days = 90;
  
  const buckets = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    buckets.push({ date: d.toDateString(), label: d.toLocaleDateString('en-NG', { weekday: 'short' }), total: 0 });
  }
  
  _activityData.forEach(item => {
    const itemDate = new Date(item.createdAt).toDateString();
    const bucket = buckets.find(b => b.date === itemDate);
    if (bucket) bucket.total += parseFloat(item.amount) || 0;
  });
  
  const max = Math.max(...buckets.map(b => b.total), 1);
  const labelEvery = days <= 7 ? 1 : days <= 30 ? 5 : 15;
  
  chartEl.innerHTML = buckets.map((b) => {
    const pct = Math.max(6, Math.round((b.total / max) * 100));
    const isToday = b.date === now.toDateString();
    return `<div class="bar${isToday ? ' active' : ''}" style="height:${pct}%;flex:1;" title="${b.label}: 🪙${b.total.toLocaleString()} FEX"></div>`;
  }).join('');
  
  labelsEl.innerHTML = buckets.map((b, i) =>
    (i % labelEvery === 0 || i === buckets.length - 1) ? `<span>${b.label}</span>` : `<span></span>`
  ).join('');
};

// ─── EMAIL VERIFICATION ───────────────────────────────────
async function updateVerificationUI() {
  const container = document.getElementById('verifiedStatus');
  if (!container) return;
  
  container.innerHTML = `
            <div class="stat-card purple">
            <div id="verificationIcon" class="stat-icon purple"><i class="ri-shield-check-line"></i></div>
            <div class="stat-value">Status</div>
            <div class="stat-label" id="verificationText">Checking...</div>
            <div class="stat-change up"><i class="ri-arrow-up-s-line"></i>Type: Fex</div></div>`;
  //to be added later
  /*          <div style="font-size:12px;color:var(--text3);margin-bottom:6px;font-weight:600;letter-spacing:0.5px;">ACCOUNT LEVEL</div>
            <div style="font-weight:700;color:var(--accent2);font-size:18px;font-family:'Syne',sans-serif;display:flex;align-items:center;gap:6px;">
              <i class="ri-medal-line"></i>Gold Tier
            </div>
            <div class="progress-bar mt-4">
              <div class="progress-fill purple" style="width:74%"></div>
            </div>
            <div class="text-xs mt-4">₦26,000 to Platinum</div>
            */
  
  const text = document.getElementById('verificationText');
  const label = document.getElementById('verificationLabel');
  const icon = document.getElementById('verificationIcon');
  const u = currentUserData || {};
  
  if (u.emailVerified) {
    if (text) text.innerText = 'Full access enabled';
    if (label) label.innerText = 'Verified';
    container.classList.remove('unverified-red');
    container.classList.add('verified-green', 'status-badge');
    if (icon) icon.style.color = 'var(--green, #10b981)';
    container.onclick = null;
    container.style.cursor = 'default';
  } else {
    if (text) text.innerText = 'Click to send verification link';
    if (label) label.innerText = 'Unverified';
    container.classList.remove('verified-green');
    container.classList.add('unverified-red', 'status-badge');
    if (icon) icon.style.color = '#ef4444';
    container.style.cursor = 'pointer';
    container.onclick = async () => {
      if (text.innerText === 'Email Sent!') { showAlert('Please check your inbox or spam folder', 'info'); return; }
      try {
        container.style.opacity = '0.5';
        container.style.pointerEvents = 'none';
        const data = await api('/api/user/resend-verification', { method: 'POST' });
        if (data?.success) {
          showAlert('Verification link sent to ' + u.email, 'success');
          if (text) text.innerText = 'Email Sent!';
        } else {
          showAlert(data?.error || 'Error sending email.', 'error');
        }
      } catch (err) {
        showAlert('Wait a bit before retrying.', 'error');
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
    showAlert(`✅ Check-in bonus 🪙${data.bonus} FEX added!`, 'success', 'ri-check-line', 'Checked In!');
    const btn = document.getElementById('checkinBtn');
    if (btn) { btn.innerHTML = `<i class="ri-gift-line"></i> Refer`; }
    refreshBalance();
  } else {
    showAlert(data?.error || 'Check-in failed.', 'warning');
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
    .then(() => showAlert('Copied!', 'success', 'ri-clipboard-line', 'Copied!'));
};

window.copyCode = (text) => {
  navigator.clipboard.writeText(text)
    .then(() => showAlert('Copied!', 'success', 'ri-clipboard-line', 'Copied!'));
};

function closeModal() {
  const modal = document.getElementById('paymentModal');
  if (modal) modal.remove();
}

// ─── START ────────────────────────────────────────────────
init();

// ═══════════════════════════════════════════════════════════
// CHAT SYSTEM — Professional FB-style
// ═══════════════════════════════════════════════════════════

let chatSessionId = null;
let chatSessionStatus = 'active';
let chatPollTimer = null;
let chatTypingTimer = null;
let chatTypingPollTimer = null;
let lastMsgCount = 0;
let chatSoundEnabled = true;
let chatSiteLogo = '';
let replyingTo = null;
let editingMsgId = null;
let chatAllMessages = [];
const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

// ─── AUDIO BEEP ───────────────────────────────────────────
function playChatSound() {
  try {
    const ctx = new(window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch (e) {}
}

// ─── OPEN CHAT ────────────────────────────────────────────
window.openChat = async function() {
  window.location.hash = '#chat';
  lucide.createIcons();
  const logo = document.getElementById('chatAdminLogo');
  if (logo && chatSiteLogo) logo.src = chatSiteLogo;
  const messagesEl = document.getElementById('chatMessages');
  const loadingEl = document.getElementById('chatLoading');
  if (loadingEl) loadingEl.style.display = 'block';
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
  chatSessionId = sessionRes.session._id;
  chatSessionStatus = sessionRes.session.status;
  await loadChatMessages();
  startChatPolling();
  startTypingPoll();
};

// ─── LOAD MESSAGES ────────────────────────────────────────
async function loadChatMessages() {
  const data = await api('/api/user/chat/messages');
  if (!data?.success) return;
  chatSessionId = data.sessionId || chatSessionId;
  chatSessionStatus = data.sessionStatus || chatSessionStatus;
  chatAllMessages = data.messages;
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
  let lastDate = '';
  messages.forEach(msg => {
    const dateStr = new Date(msg.createdAt).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
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
  const isMe = (perspective === 'user') ? msg.sender === 'user' : msg.sender === 'admin';
  const time = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const wrapper = document.createElement('div');
  wrapper.dataset.msgId = msg._id;
  wrapper.style.cssText = `display:flex;flex-direction:column;align-items:${isMe?'flex-end':'flex-start'};gap:2px;margin-bottom:2px;position:relative;`;
  let replyHtml = '';
  if (msg.replyTo?.msgId) {
    replyHtml = `<div style="background:rgba(0,0,0,0.06);border-left:3px solid var(--primary);border-radius:6px;padding:5px 10px;margin-bottom:4px;font-size:11px;color:var(--text-muted);max-width:100%;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;"><span style="font-weight:700;color:var(--primary);margin-right:6px;">${msg.replyTo.sender==='user'?'You':'Support'}</span>${msg.replyTo.preview}</div>`;
  }
  let bubbleContent = '';
  if (msg.deleted) {
    bubbleContent = `<span style="font-style:italic;opacity:0.6;font-size:13px;">🚫 This message was deleted</span>`;
  } else if (msg.type === 'image' && msg.imageUrl) {
    bubbleContent = `<img src="${msg.imageUrl}" style="max-width:220px;border-radius:10px;cursor:pointer;" onclick="window.open('${msg.imageUrl}','_blank')">`;
  } else if (msg.type === 'polar') {
    const answered = msg.polarAnswer;
    bubbleContent = `
      <div style="font-size:13px;margin-bottom:8px;font-weight:600;">❓ ${msg.polarQuestion}</div>
      ${answered
        ? `<div style="padding:6px 12px;border-radius:8px;font-weight:700;background:rgba(255,255,255,0.2);color:${answered==='yes'?'#10ac84':'#e74c3c'};">${answered==='yes'?'✅ You answered: Yes':'❌ You answered: No'}</div>`
        : `<div style="display:flex;gap:8px;margin-top:4px;">
            <button onclick="answerPolar('${msg._id}','yes',this)" style="background:#10ac84;color:#fff;border:none;border-radius:8px;padding:7px 20px;font-weight:600;cursor:pointer;">✅ Yes</button>
            <button onclick="answerPolar('${msg._id}','no',this)" style="background:#e74c3c;color:#fff;border:none;border-radius:8px;padding:7px 20px;font-weight:600;cursor:pointer;">❌ No</button>
          </div>`
      }`;
  } else {
    bubbleContent = `<span style="font-size:14px;line-height:1.5;word-break:break-word;">${msg.content}</span>`;
  }
  let ticksHtml = '';
  if (isMe && !msg.deleted) {
    const tickColor = msg.read ? '#4fc3f7' : 'rgba(255,255,255,0.5)';
    const tickLabel = msg.read ? '✓✓' : msg.delivered ? '✓✓' : '✓';
    ticksHtml = `<span style="font-size:11px;color:${tickColor};margin-left:4px;">${tickLabel}</span>`;
  }
  const editedHtml = msg.edited && !msg.deleted ? `<span style="font-size:10px;opacity:0.6;margin-left:4px;">edited</span>` : '';
  const reactEntries = Object.entries(msg.reactions || {}).filter(([, v]) => v.length > 0);
  const reactionsHtml = reactEntries.length ? `
    <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:3px;">
      ${reactEntries.map(([emoji, users]) => `
        <span onclick="toggleReaction('${msg._id}','${emoji}')" style="background:rgba(0,0,0,0.08);border-radius:12px;padding:2px 7px;font-size:12px;cursor:pointer;border:1px solid ${users.includes('user')?'var(--primary)':'transparent'};">
          ${emoji} ${users.length}
        </span>`).join('')}
    </div>` : '';
  const emojiBarId = `ebar-${msg._id}`;
  const emojiBarHtml = msg.deleted ? '' : `
    <div id="${emojiBarId}" style="display:none;position:absolute;${isMe?'right:0':'left:0'};bottom:calc(100% + 4px);background:var(--card-bg,#fff);border-radius:20px;padding:6px 10px;box-shadow:0 4px 16px rgba(0,0,0,0.15);gap:6px;z-index:100;white-space:nowrap;">
      ${EMOJIS.map(e => `<span onclick="toggleReaction('${msg._id}','${e}');hideEmojiBar('${emojiBarId}')" style="font-size:20px;cursor:pointer;transition:transform 0.1s;" onmouseover="this.style.transform='scale(1.3)'" onmouseout="this.style.transform='scale(1)'">${e}</span>`).join('')}
      ${isMe && !msg.deleted
        ? `<span onclick="startReply('${msg._id}');hideEmojiBar('${emojiBarId}')" style="font-size:18px;cursor:pointer;padding:0 4px;" title="Reply">↩️</span>
           <span onclick="startEdit('${msg._id}');hideEmojiBar('${emojiBarId}')" style="font-size:18px;cursor:pointer;padding:0 4px;" title="Edit">✏️</span>
           <span onclick="deleteMsg('${msg._id}');hideEmojiBar('${emojiBarId}')" style="font-size:18px;cursor:pointer;padding:0 4px;" title="Delete">🗑️</span>`
        : !isMe && !msg.deleted
          ? `<span onclick="startReply('${msg._id}');hideEmojiBar('${emojiBarId}')" style="font-size:18px;cursor:pointer;padding:0 4px;" title="Reply">↩️</span>`
          : ''}
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

// ─── EMOJI BAR ────────────────────────────────────────────
let longPressTimer = null;

function showEmojiBar(e, id) {
  e.preventDefault();
  document.querySelectorAll('[id^="ebar-"]').forEach(el => el.style.display = 'none');
  const bar = document.getElementById(id);
  if (bar) bar.style.display = 'flex';
}

function hideEmojiBar(id) {
  const bar = document.getElementById(id);
  if (bar) bar.style.display = 'none';
}

function handleTouchStart(e, id) {
  longPressTimer = setTimeout(() => showEmojiBar(e, id), 500);
}

function handleTouchEnd() {
  clearTimeout(longPressTimer);
}

// ─── REACTIONS ────────────────────────────────────────────
window.toggleReaction = async (msgId, emoji) => {
  const data = await api('/api/user/chat/react', { method: 'POST', body: JSON.stringify({ msgId, emoji }) });
  if (data?.success) await loadChatMessages();
};

// ─── REPLY ────────────────────────────────────────────────
window.startReply = (msgId) => {
  const msgEl = document.querySelector(`[data-msg-id="${msgId}"] .chat-bubble`);
  const preview = msgEl?.innerText?.substring(0, 60) || '';
  replyingTo = { msgId, sender: 'user', preview };
  const bar = document.getElementById('replyPreviewBar');
  if (bar) {
    bar.style.display = 'flex';
    const rt = bar.querySelector('.reply-text');
    if (rt) rt.textContent = preview;
  }
};

window.cancelReply = () => {
  replyingTo = null;
  const bar = document.getElementById('replyPreviewBar');
  if (bar) bar.style.display = 'none';
};

// ─── EDIT ─────────────────────────────────────────────────
window.startEdit = (msgId) => {
  const msg = chatAllMessages.find(m => m._id === msgId);
  if (!msg) return;
  editingMsgId = msgId;
  const input = document.getElementById('chatInput');
  if (input) {
    input.value = msg.content;
    input.focus();
  }
};

// ─── DELETE ───────────────────────────────────────────────
window.deleteMsg = async (msgId) => {
  showConfirm({
    title: 'Delete Message',
    message: 'Delete this message?',
    yesText: 'Delete',
    noText: 'Cancel',
    onConfirm: async function() {
      const data = await api(`/api/user/chat/message/${msgId}`, { method: 'DELETE' });
      if (data?.success) await loadChatMessages();
    },
    onCancel: function() {}
  });
};

// ─── SEND MESSAGE ─────────────────────────────────────────
window.sendChatMessage = async () => {
  const input = document.getElementById('chatInput');
  const content = input?.value?.trim();
  if (!content && !editingMsgId) return;
  
  if (editingMsgId) {
    const data = await api(`/api/user/chat/message/${editingMsgId}`, { method: 'PUT', body: JSON.stringify({ content }) });
    editingMsgId = null;
    if (input) input.value = '';
    if (data?.success) await loadChatMessages();
    return;
  }
  
  const body = { type: 'text', content };
  if (replyingTo) {
    body.replyTo = replyingTo;
    cancelReply();
  }
  
  const data = await api('/api/user/chat/send', { method: 'POST', body: JSON.stringify(body) });
  if (data?.success) {
    chatAllMessages.push(data.message);
    const container = document.getElementById('chatMessages');
    container?.appendChild(buildMsgBubble(data.message, 'user'));
    if (container) container.scrollTop = container.scrollHeight;
    lastMsgCount++;
  }
  if (input) input.value = '';
};

// ─── POLAR ANSWER ─────────────────────────────────────────
window.answerPolar = async (msgId, answer, btn) => {
  btn.disabled = true;
  const data = await api('/api/user/chat/send', { method: 'POST', body: JSON.stringify({ type: 'polar_answer', content: answer, polarMsgId: msgId }) });
  if (data?.success) await loadChatMessages();
};

// ─── IMAGE UPLOAD ─────────────────────────────────────────
window.handleChatImageUpload = async (input) => {
  const file = input.files?.[0];
  if (!file) return;
  const keysRes = await api('/api/user/apikeys');
  const imgbbKey = keysRes?.imgbb;
  if (!imgbbKey) return showAlert('Image upload not configured.', 'error', 'ri-close-line', 'Error');
  const formData = new FormData();
  formData.append('image', file);
  const res = await fetch(`https://api.imgbb.com/1/upload?key=${imgbbKey}`, { method: 'POST', body: formData });
  const result = await res.json();
  if (!result.success) return showAlert('Upload failed.', 'error', 'ri-close-line', 'Error');
  const body = { type: 'image', imageUrl: result.data.url, content: '📷 Image' };
  if (replyingTo) {
    body.replyTo = replyingTo;
    cancelReply();
  }
  const data = await api('/api/user/chat/send', { method: 'POST', body: JSON.stringify(body) });
  if (data?.success) {
    chatAllMessages.push(data.message);
    const container = document.getElementById('chatMessages');
    container?.appendChild(buildMsgBubble(data.message, 'user'));
    if (container) container.scrollTop = container.scrollHeight;
    lastMsgCount++;
  }
  input.value = '';
};

// ─── TYPING INDICATOR ─────────────────────────────────────
window.onChatInputKeydown = function(e) {
  if (e.key === 'Enter') { sendChatMessage(); return; }
  clearTimeout(chatTypingTimer);
  chatTypingTimer = setTimeout(() => {
    api('/api/user/chat/typing', { method: 'POST', body: '{}' });
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
  const ended = chatSessionStatus === 'ended';
  const badge = document.getElementById('chatEndedBadge');
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
    if (data.messages.length !== lastMsgCount ||
      JSON.stringify(data.messages.map(m => m.reactions)) !== JSON.stringify(chatAllMessages.map(m => m.reactions))) {
      const newMsgs = data.messages.slice(lastMsgCount);
      const hasAdminMsg = newMsgs.some(m => m.sender === 'admin');
      chatAllMessages = data.messages;
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
  const data = await api('/api/user/chat/unread');
  const badge = document.getElementById('chatUnreadBadge');
  if (badge && data?.unread > 0) {
    badge.textContent = data.unread;
    badge.style.display = 'flex';
  } else if (badge) {
    badge.style.display = 'none';
  }
  setTimeout(pollChatUnread, 10000);
}

function switchMainTab(name, btn) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById(name).classList.add('active');
}

window.addEventListener('DOMContentLoaded', () => {
  setTimeout(pollChatUnread, 3000);
});










// ══════════════════════════════════════════════════════════
// FLUX MALL — User Task Page (embedded)
// ══════════════════════════════════════════════════════════

const UT_CAT_ICONS = { Social: 'ri-share-line', Survey: 'ri-questionnaire-line', Watch: 'ri-play-circle-line', Download: 'ri-download-line', Review: 'ri-star-line', General: 'ri-task-line' };
const UT_CAT_COLORS = { Social: '#4299e1', Survey: '#9f7aea', Watch: '#ee5d50', Download: '#05cd99', Review: '#f6ad55', General: '#4318ff' };
const UT_PLATFORM = {
  X: { icon: 'ri-twitter-x-line', color: '#000000', label: 'X (Twitter)' },
  Facebook: { icon: 'ri-facebook-fill', color: '#1877f2', label: 'Facebook' },
  Instagram: { icon: 'ri-instagram-line', color: '#e1306c', label: 'Instagram' },
  GitHub: { icon: 'ri-github-fill', color: '#24292e', label: 'GitHub' },
  YouTube: { icon: 'ri-youtube-line', color: '#ff0000', label: 'YouTube' },
  Custom: { icon: 'ri-global-line', color: '#4318ff', label: 'Custom' },
};

// ─── Replace with your own key from imgbb.com/api ──────
const IMGBB_KEY = '0251ff89aa26f5ade333ed4e51cdc2e1';

let _utTasks = [];
let _utHistory = [];
let _utActiveCat = 'all';

// Per-task upload cache: { taskId: { fileHash: imgbbUrl } }
// Persists in memory for the session — prevents re-uploading the same file
const _utUploadCache = {};

// ── TABS ────────────────────────────────────────────────
function utSwitchTab(name, btn) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('ut-panel-' + name).classList.add('active');
  if (name === 'history') utLoadHistory();
}

// ── INIT ────────────────────────────────────────────────
// Direct call — DOMContentLoaded already fired in SPA context
utLoadTasks();

async function utLoadTasks() {
  document.getElementById('utTaskList').innerHTML =
    `<div class="state-box"><div class="spinner"></div><p>Loading tasks…</p></div>`;
  
  const data = await api('/api/user/tasks');
  if (!data?.success) {
    document.getElementById('utTaskList').innerHTML =
      `<div class="state-box"><i class="ri-error-warning-line"></i><p>Could not load tasks.</p></div>`;
    return;
  }
  
  _utTasks = data.tasks || [];
  document.getElementById('utTcAvailable').textContent = _utTasks.filter(t => t.canSubmit).length;
  
  const cats = ['all', ...new Set(_utTasks.map(t => t.category).filter(Boolean))];
  document.getElementById('utChipRow').innerHTML = cats.map((c, i) =>
    `<div class="chip ${i===0?'active':''}" onclick="utFilterCat('${c}',this)">${c==='all'?'All':c}</div>`
  ).join('');
  
  utRenderTasks();
}

function utFilterCat(cat, el) {
  _utActiveCat = cat;
  document.querySelectorAll('#utChipRow .chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  utRenderTasks();
}

function utRenderTasks() {
  const list = document.getElementById('utTaskList');
  const tasks = _utActiveCat === 'all' ? _utTasks : _utTasks.filter(t => t.category === _utActiveCat);
  
  if (!tasks.length) {
    list.innerHTML = `<div class="state-box"><i class="ri-task-line"></i><p>No tasks in this category.</p></div>`;
    return;
  }
  
  list.innerHTML = tasks.map(t => {
    const pm = t.category === 'Social' && t.platform && UT_PLATFORM[t.platform] ? UT_PLATFORM[t.platform] : null;
    const icon = pm ? pm.icon : (UT_CAT_ICONS[t.category] || 'ri-task-line');
    const color = pm ? pm.color : (UT_CAT_COLORS[t.category] || '#4318ff');
    const catLabel = t.category === 'Social' && pm ?
      `<span style="display:inline-flex;align-items:center;gap:3px;font-weight:700;color:${pm.color};"><i class="${pm.icon}"></i> ${pm.label}</span>` :
      t.category;
    
    let statusBar = '';
    if (t.userStatus === 'pending') {
      statusBar = `<div class="tc-status-bar pending"><i class="ri-time-line"></i> Submitted — awaiting review</div>`;
    } else if (t.userStatus === 'approved') {
      statusBar = `<div class="tc-status-bar approved"><i class="ri-checkbox-circle-line"></i> Approved! 🪙${Number(t.points).toLocaleString()} FEX credited</div>`;
    } else if (t.userStatus === 'declined') {
      statusBar = `<div class="tc-status-bar declined"><i class="ri-close-circle-line"></i> Declined — you may re-submit</div>`;
    }
    
    const maxTag = t.maxCompletions > 0 ?
      `<div class="tc-meta-tag"><i class="ri-group-line"></i>${t.completedCount}/${t.maxCompletions} spots</div>` : '';
    const expTag = t.expiresAt ?
      `<div class="tc-meta-tag"><i class="ri-time-line"></i>Ends ${new Date(t.expiresAt).toLocaleDateString()}</div>` : '';
    
    const canSubmit = t.canSubmit || t.userStatus === 'declined';
    
    // ── PROOF INPUT ──────────────────────────────────────
    let proofInput = '';
    
    if (t.proofType === 'screenshot') {
      // Full drag-drop + file-picker uploader
      // The hidden input #proof_{id} gets the imgbb URL after upload
      proofInput = `
              <label>Screenshot Proof</label>

              <div class="screenshot-drop" id="sdDrop_${t._id}"
                ondragover="utDragOver(event,'${t._id}')"
                ondragleave="utDragLeave('${t._id}')"
                ondrop="utHandleDrop(event,'${t._id}')">
                <input type="file" id="sdFile_${t._id}" accept="image/*"
                  onchange="utHandleFileSelect(this,'${t._id}')">
                <i class="ri-image-add-line sd-icon"></i>
                <div class="sd-label">Tap to upload screenshot</div>
                <div class="sd-sub">PNG · JPG · WEBP — uploads instantly</div>
              </div>

              <div class="sd-uploading" id="sdUploading_${t._id}">
                <div class="sd-upload-spinner"></div>
                <span>Uploading image…</span>
              </div>

              <div class="sd-duplicate" id="sdDuplicate_${t._id}">
                <i class="ri-error-warning-line"></i>
                <span>Same image detected — using your previous upload link.</span>
              </div>

              <div class="sd-error" id="sdError_${t._id}">
                <i class="ri-close-circle-line"></i>
                <span id="sdErrorMsg_${t._id}">Upload failed. Please try again.</span>
              </div>

              <div class="sd-preview" id="sdPreview_${t._id}">
                <img id="sdPreviewImg_${t._id}" src="" alt="Screenshot preview">
                <div class="sd-preview-bar">
                  <span class="sd-ok"><i class="ri-checkbox-circle-fill"></i> Uploaded successfully</span>
                  <button class="sd-redo" onclick="utResetUpload('${t._id}')">
                    <i class="ri-refresh-line"></i> Change image
                  </button>
                </div>
              </div>

              <input type="hidden" id="proof_${t._id}" value="">`;
      
    } else if (t.proofType === 'url') {
      proofInput = `<label>Link / URL</label>
              <input type="url" id="proof_${t._id}" placeholder="https://…">`;
    } else if (t.proofType === 'text') {
      proofInput = `<label>Your response</label>
              <textarea id="proof_${t._id}" rows="3" placeholder="Type your answer here…"></textarea>`;
    }
    
    return `
          <div class="task-card ${t.userStatus && t.userStatus !== 'declined' ? 'done' : ''}">
            <div class="tc-top">
              <div class="tc-icon-wrap" style="background:${color}22;color:${color};">
                <i class="${icon}"></i>
              </div>
              <div class="tc-info">
                <div class="tc-title">${t.title}</div>
                <div class="tc-cat">${catLabel}</div>
              </div>
            </div>

            <div class="tc-reward"><i class="ri-coin-line"></i> 🪙${Number(t.points).toLocaleString()} FEX</div>

            ${t.taskLink ? `<a href="${t.taskLink}" target="_blank" rel="noopener"
              style="display:inline-flex;align-items:center;gap:6px;background:var(--primary);color:#fff;border-radius:10px;padding:8px 16px;font-size:13px;font-weight:700;text-decoration:none;margin-bottom:10px;">
              <i class="ri-external-link-line"></i> Go to Task
            </a>` : ''}

            <div class="tc-desc">${t.description}</div>

            ${t.instructions ? `<div class="instructions-box"><strong>How to complete:</strong><br>${t.instructions.replace(/\n/g,'<br>')}</div>` : ''}

            <div class="tc-meta">
              ${maxTag}${expTag}
              <div class="tc-meta-tag"><i class="ri-file-list-line"></i>${t.proofType === 'none' ? 'No proof needed' : t.proofType}</div>
            </div>

            ${statusBar}

            ${canSubmit ? `
              <div class="submit-area" id="submitArea_${t._id}">
                ${proofInput}
                <div style="margin-top:10px;">
                  <button class="btn btn-primary" id="submitBtn_${t._id}"
                    onclick="utSubmitTask('${t._id}','${t.proofType}')"
                    ${t.proofType === 'screenshot' ? 'disabled' : ''}>
                    <i class="ri-check-line"></i> ${t.userStatus === 'declined' ? 'Re-submit Task' : 'Submit Task'}
                  </button>
                </div>
              </div>` : ''}

            ${t.maxReached && !t.userStatus ? `<div style="text-align:center;font-size:12px;color:var(--text3);padding:8px;">This task is fully claimed</div>` : ''}
          </div>`;
  }).join('');
}

// ══════════════════════════════════════════════════════════
// SCREENSHOT UPLOAD SYSTEM
// ══════════════════════════════════════════════════════════

// SHA-256 hash of file bytes → 16-char hex fingerprint
// Used to detect if the exact same file was already uploaded
async function utFileHash(file) {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16);
}

// Check file is actually an image (not a PDF, video, etc.)
function utIsImage(file) {
  return file && /^image\/(jpeg|png|webp|gif|bmp)$/i.test(file.type);
}

// Central state machine — controls which UI elements are visible
function utSetUploadState(taskId, state, data = {}) {
  const drop = document.getElementById(`sdDrop_${taskId}`);
  const uploading = document.getElementById(`sdUploading_${taskId}`);
  const preview = document.getElementById(`sdPreview_${taskId}`);
  const duplicate = document.getElementById(`sdDuplicate_${taskId}`);
  const errorBox = document.getElementById(`sdError_${taskId}`);
  const submitBtn = document.getElementById(`submitBtn_${taskId}`);
  
  // Hide all feedback elements
  uploading?.classList.remove('show');
  preview?.classList.remove('show');
  duplicate?.classList.remove('show');
  errorBox?.classList.remove('show');
  
  if (state === 'idle') {
    if (drop) drop.style.display = '';
    if (submitBtn) submitBtn.disabled = true; // no image yet
  }
  else if (state === 'uploading') {
    if (drop) drop.style.display = 'none';
    uploading?.classList.add('show');
    if (submitBtn) submitBtn.disabled = true;
  }
  else if (state === 'done') {
    if (drop) drop.style.display = 'none';
    preview?.classList.add('show');
    const img = document.getElementById(`sdPreviewImg_${taskId}`);
    if (img && data.url) img.src = data.url;
    if (submitBtn) submitBtn.disabled = false;
  }
  else if (state === 'duplicate') {
    // Same image already uploaded — show preview + warning, still allow submit
    if (drop) drop.style.display = 'none';
    duplicate?.classList.add('show');
    preview?.classList.add('show');
    const img = document.getElementById(`sdPreviewImg_${taskId}`);
    if (img && data.url) img.src = data.url;
    if (submitBtn) submitBtn.disabled = false;
  }
  else if (state === 'error') {
    if (drop) drop.style.display = '';
    errorBox?.classList.add('show');
    const msg = document.getElementById(`sdErrorMsg_${taskId}`);
    if (msg) msg.textContent = data.message || 'Upload failed. Please try again.';
    if (submitBtn) submitBtn.disabled = false;
  }
}

// Reset everything back to the initial upload state
function utResetUpload(taskId) {
  utSetUploadState(taskId, 'idle');
  const hidden = document.getElementById(`proof_${taskId}`);
  if (hidden) hidden.value = '';
  const fileInput = document.getElementById(`sdFile_${taskId}`);
  if (fileInput) fileInput.value = ''; // clear so same file can be re-selected
}

// Core upload function — called by both file input and drag-drop
async function utUploadToImgbb(file, taskId) {
  // 1. Validate it's an image
  if (!utIsImage(file)) {
    utSetUploadState(taskId, 'error', { message: 'Only image files are accepted (PNG, JPG, WEBP).' });
    return;
  }
  
  // 2. Check for duplicate — hash the file bytes
  const hash = await utFileHash(file);
  if (!_utUploadCache[taskId]) _utUploadCache[taskId] = {};
  
  if (_utUploadCache[taskId][hash]) {
    // Exact same image was uploaded before for this task — reuse the URL silently
    const cachedUrl = _utUploadCache[taskId][hash];
    const hidden = document.getElementById(`proof_${taskId}`);
    if (hidden) hidden.value = cachedUrl;
    utSetUploadState(taskId, 'duplicate', { url: cachedUrl });
    return;
  }
  
  // 3. Upload to imgbb
  utSetUploadState(taskId, 'uploading');
  try {
    const fd = new FormData();
    fd.append('image', file);
    fd.append('key', IMGBB_KEY);
    
    const res = await fetch('https://api.imgbb.com/1/upload', { method: 'POST', body: fd });
    const json = await res.json();
    
    if (json.success) {
      const url = json.data.url;
      _utUploadCache[taskId][hash] = url; // cache so duplicate detection works
      const hidden = document.getElementById(`proof_${taskId}`);
      if (hidden) hidden.value = url;
      utSetUploadState(taskId, 'done', { url });
    } else {
      utSetUploadState(taskId, 'error', {
        message: json.error?.message || 'Image host rejected the upload. Try a different image.'
      });
    }
  } catch (e) {
    utSetUploadState(taskId, 'error', {
      message: 'Network error — check your connection and try again.'
    });
  }
}

// ── Event handlers for the upload widget ────────────────
function utHandleFileSelect(input, taskId) {
  const file = input.files?.[0];
  if (file) utUploadToImgbb(file, taskId);
}

function utDragOver(e, taskId) {
  e.preventDefault();
  document.getElementById(`sdDrop_${taskId}`)?.classList.add('drag-over');
}

function utDragLeave(taskId) {
  document.getElementById(`sdDrop_${taskId}`)?.classList.remove('drag-over');
}

function utHandleDrop(e, taskId) {
  e.preventDefault();
  document.getElementById(`sdDrop_${taskId}`)?.classList.remove('drag-over');
  const file = e.dataTransfer.files?.[0];
  if (file) utUploadToImgbb(file, taskId);
}

// ══════════════════════════════════════════════════════════
// SUBMIT
// ══════════════════════════════════════════════════════════
async function utSubmitTask(taskId, proofType) {
  const btn = document.getElementById(`submitBtn_${taskId}`);
  let proof = '';
  
  if (proofType !== 'none') {
    const inp = document.getElementById(`proof_${taskId}`);
    proof = inp?.value?.trim() || '';
    
    if (!proof) {
      if (proofType === 'screenshot') {
        utShowToast('Please upload a screenshot first', 'error');
      } else {
        utShowToast('Please provide proof before submitting', 'error');
        inp?.focus();
      }
      return;
    }
    
    // URL proof type — basic validation
    if (proofType === 'url' && !proof.startsWith('http')) {
      utShowToast('Please enter a valid URL starting with https://', 'error');
      inp?.focus();
      return;
    }
  }
  
  btn.disabled = true;
  btn.innerHTML = '<i class="ri-loader-line"></i> Submitting…';
  
  const res = await api(`/api/user/tasks/${taskId}/submit`, {
    method: 'POST',
    body: JSON.stringify({ proof })
  });
  
  if (res?.success) {
    utShowToast(res.message || 'Task submitted!', 'success');
    utLoadTasks();
  } else {
    utShowToast(res?.error || 'Error submitting task', 'error');
    btn.disabled = false;
    btn.innerHTML = '<i class="ri-check-line"></i> Submit Task';
  }
}

// ── HISTORY ─────────────────────────────────────────────
async function utLoadHistory() {
  document.getElementById('utHistoryList').innerHTML =
    `<div class="state-box"><div class="spinner"></div><p>Loading…</p></div>`;
  
  const data = await api('/api/user/tasks/my-submissions');
  _utHistory = data?.submissions || [];
  document.getElementById('utTcHistory').textContent = _utHistory.length;
  
  if (!_utHistory.length) {
    document.getElementById('utHistoryList').innerHTML =
      `<div class="state-box"><i class="ri-history-line"></i><p>No submissions yet. Complete a task to get started!</p></div>`;
    return;
  }
  
  document.getElementById('utHistoryList').innerHTML = _utHistory.map(s => {
    const date = s.createdAt ? new Date(s.createdAt).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
    const pts = s.points || s.taskId?.points || 0;
    const isApproved = s.status === 'approved';
    const isDeclined = s.status === 'declined';
    
    const histPm = s.taskId?.category === 'Social' && s.taskId?.platform && UT_PLATFORM[s.taskId.platform] ?
      UT_PLATFORM[s.taskId.platform] : null;
    const catDisp = histPm ?
      `<i class="${histPm.icon}" style="color:${histPm.color};margin-right:2px;"></i>${histPm.label}` :
      (s.taskId?.category || '');
    
    // Show proof thumbnail if it's an image
    const proof = s.proof || '';
    const isImg = proof.startsWith('http') && (
      proof.includes('ibb.co') || proof.includes('imgbb') ||
      /\.(png|jpg|jpeg|webp|gif)(\?|$)/i.test(proof)
    );
    const proofThumb = isImg ?
      `<img src="${proof}" alt="Your proof" onclick="window.open('${proof}','_blank')"
                style="width:100%;max-height:120px;object-fit:cover;border-radius:8px;margin-top:8px;cursor:pointer;">` :
      (proof && s.taskId?.proofType !== 'none' ?
        `<div style="font-size:11px;color:var(--text3);margin-top:4px;word-break:break-all;">${proof.length > 70 ? proof.slice(0,70)+'…' : proof}</div>` :
        '');
    
    return `
          <div class="history-item">
            <div class="hi-header">
              <div class="hi-title">${s.taskId?.title || 'Task'}</div>
              <span class="badge ${s.status}">
                ${s.status === 'approved' ? '🟢' : s.status === 'pending' ? '🟡' : '🔴'}
                ${s.status.charAt(0).toUpperCase() + s.status.slice(1)}
              </span>
            </div>
            <div class="hi-sub">
              <span class="tc-meta-tag" style="font-size:11px;">${catDisp}</span>
              <span style="color:var(--text3);font-size:11px;">${date}</span>
              ${isApproved ? `<span class="hi-points credit">+🪙${Number(pts).toLocaleString()} FEX</span>` : ''}
              ${isDeclined && s.penalty > 0 ? `<span class="hi-points debit">-🪙${Number(s.penalty).toLocaleString()} FEX</span>` : ''}
            </div>
            ${proofThumb}
            ${s.adminNote ? `<div class="hi-note"><i class="ri-information-line"></i> ${s.adminNote}</div>` : ''}
          </div>`;
  }).join('');
}

// ── TOAST ────────────────────────────────────────────────
function utShowToast(msg, type = 'success') {
  const wrap = document.getElementById('notifWrap');
  if (!wrap) return;
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<i class="ri-${type==='success'?'check-line':type==='error'?'close-line':'information-line'}"></i><span>${msg}</span>`;
  wrap.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transition = 'opacity .3s';
    setTimeout(() => t.remove(), 300);
  }, 4000);
}



// ─── REFERRAL TIERS ───────────────────────────────────────
async function loadReferralTiers() {
  const card = document.getElementById('referralTierCard');
  if (!card) return;
  
  const data = await api('/api/user/referral-tier');
  if (!data?.success) return;
  
  const { tiers, activeReferrals, currentTier, emailVerified } = data;
  
  const tierColors = {
    1: 'var(--accent2)',
    2: 'var(--green)',
    3: '#f6ad55',
    4: 'var(--yellow)',
  };
  
  const tiersHTML = tiers.map(t => {
    const isCurrent = t.isCurrent;
    const isReached = t.isReached;
    const color = tierColors[t.level];
    const maxLabel = t.max === Infinity ? `${t.min}+` : `${t.min}–${t.max}`;
    
    let claimBtn = '';
    if (!emailVerified) {
      claimBtn = `<button class="btn btn-sm" disabled style="font-size:11px;opacity:0.5;margin-top:8px;">Verify email to claim</button>`;
    } else if (t.isClaimed) {
      claimBtn = `<button class="btn btn-sm" disabled style="font-size:11px;background:var(--green);color:#fff;margin-top:8px;opacity:0.7;">✅ Claimed</button>`;
    } else if (t.canClaim) {
      claimBtn = `<button class="btn btn-sm btn-primary" style="font-size:11px;margin-top:8px;" onclick="claimTierBonus(${t.level}, this)">🎁 Claim ₦${t.claimBonus.toLocaleString()}</button>`;
    } else {
      claimBtn = `<div class="text-xs" disabled style="opacity:0.5;">🔒 ${t.min} refs needed</div>`;
    }
    
    return `
      <div class="ref-level" style="${isCurrent ? 'border-color:rgba(108,99,255,0.3);background:var(--accent-glow);' : ''}">
        <div class="ref-level-num" style="color:${color};">L${t.level}</div>
        <div style="flex:1;">
          <div style="font-size:14px;font-weight:600;">
            ${t.name}
            ${isCurrent ? `<span style="font-size:11px;color:var(--green);">• Current</span>` : ''}
            ${isReached && !isCurrent ? `<span style="font-size:11px;color:var(--text3);">• Passed</span>` : ''}
          </div>
          ${claimBtn}
        </div>
        <div style="text-align:right;">
          <div style="font-weight:700;color:${color};">
            ₦${t.rewardPerRef.toLocaleString()}/ref
          </div>
          <div style="font-size:10px;color:var(--text3);margin-top:2px;">
            Bonus: ₦${t.claimBonus.toLocaleString()}
          </div>
        </div>
      </div>`;
  }).join('');
  
  card.innerHTML = `
    <div style="font-family:'Syne',sans-serif;font-weight:700;font-size:16px;margin-bottom:4px;">Referral Tiers</div>
    <div style="font-size:12px;color:var(--text3);margin-bottom:16px;">
      You have <strong>${activeReferrals}</strong> active referral${activeReferrals !== 1 ? 's' : ''} · 
      Current tier: <strong style="color:var(--accent2);">${currentTier.name}</strong>
    </div>
    ${tiersHTML}`;
}
document.getElementById("statusBadge").innerHTML = currentTier.name;

// ─── CLAIM TIER BONUS ─────────────────────────────────────
window.claimTierBonus = async (level, btn) => {
  btn.disabled = true;
  btn.innerText = 'Claiming...';
  
  const data = await api('/api/user/claim-tier-bonus', {
    method: 'POST',
    body: JSON.stringify({ level })
  });
  
  if (data?.success) {
    showAlert(data.message, 'success', 'ri-check-line', 'Bonus Claimed!');
    refreshBalance();
    loadReferralTiers(); // re-render to show claimed state
  } else {
    showAlert(data?.error || 'Could not claim bonus.', 'error', 'ri-close-line', 'Error');
    btn.disabled = false;
    btn.innerText = `🎁 Claim`;
  }
};





/*        <div class="card mb-6">
          <div style="font-family:'Syne',sans-serif;font-weight:700;font-size:16px;margin-bottom:16px;">Referral Tiers</div>
          <div class="ref-level">
            <div class="ref-level-num">L1</div>
            <div style="flex:1;">
              <div style="font-size:14px;font-weight:600;">Starter</div>
              <div class="text-xs">0–4 referrals</div>
            </div>
            <div style="text-align:right;">
              <div style="font-weight:700;color:var(--accent2);">₦800/ref</div>
            </div>
          </div>
          <div class="ref-level" style="border-color:rgba(108,99,255,0.3);background:var(--accent-glow)">
            <div class="ref-level-num">L2</div>
            <div style="flex:1;">
              <div style="font-size:14px;font-weight:600;">Grower <span style="font-size:11px;color:var(--green);">• Current</span></div>
              <div class="text-xs">5–14 referrals</div>
            </div>
            <div style="text-align:right;">
              <div style="font-weight:700;color:var(--accent2);">₦1,200/ref</div>
            </div>
          </div>
          <div class="ref-level">
            <div class="ref-level-num">L3</div>
            <div style="flex:1;">
              <div style="font-size:14px;font-weight:600;">Champion</div>
              <div class="text-xs">15–49 referrals</div>
            </div>
            <div style="text-align:right;">
              <div style="font-weight:700;color:var(--accent2);">₦1,800/ref</div>
            </div>
          </div>
          <div class="ref-level">
            <div class="ref-level-num">L4</div>
            <div style="flex:1;">
              <div style="font-size:14px;font-weight:600;">Ambassador</div>
              <div class="text-xs">50+ referrals</div>
            </div>
            <div style="text-align:right;">
              <div style="font-weight:700;color:var(--yellow);">₦2,500/ref + Bonus</div>
            </div>
          </div>
        </div>
*/