// ============================================================
// FLUX MALL - Admin Panel Script (No Firebase)
// All operations via REST API to Node.js/MongoDB backend
// ============================================================

let allData = [];
let allUsers = [];
let flashInterval = null;
let originalTitle = document.title;

// ─── API HELPER ────────────────────────────────────────────
async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options
  });
  if (res.status === 401) { window.location.href = '#login'; return null; }
  return res.json();
}


// ─── IMGBB UPLOAD UTILITY ─────────────────────────────────
// Fetches API key from DB config, uploads image, returns URL
async function uploadToImgBB(file, statusEl) {
  if (statusEl) statusEl.innerHTML = '<i class="ri-loader-line"></i> Uploading...';
  try {
    // Fetch imgbb key from settings/apikeys
    const settingsData = await api('/api/admin/settings/apikeys');
    const imgbbKey = settingsData?.apikeys?.imgbb;
    if (!imgbbKey) {
      if (statusEl) statusEl.innerHTML = '';
      alert('⚠️ ImgBB API key not set. Go to Settings → API Keys and save your ImgBB key first.');
      return null;
    }
    const formData = new FormData();
    formData.append('image', file);
    const res = await fetch(`https://api.imgbb.com/1/upload?key=${imgbbKey}`, {
      method: 'POST', body: formData
    });
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

// ─── FLASH TITLE ─────────────────────────────────────────
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

// ─── AUTH CHECK ───────────────────────────────────────────
async function checkAdminSession() {
  const data = await fetch('/api/admin/me', { credentials: 'include' });
  if (data.ok) {
    showTab('analytics-tab');
    initDashboard();
  } else {
    showTab('login');
  }
}

// ─── ADMIN LOGIN ─────────────────────────────────────────
window.handleAdminLogin = async (e) => {
  e.preventDefault();
  const email  = document.getElementById('adminEmail').value.trim();
  const pass   = document.getElementById('adminPass').value;
  const btn    = document.getElementById('loginBtn');
  btn.disabled = true;
  btn.innerText = 'Verifying...';

  const data = await api('/api/admin/login', {
    method: 'POST',
    body: JSON.stringify({ email, password: pass })
  });

  if (data?.success) {
    showTab('analytics-tab');
    initDashboard();
  } else {
    alert(data?.error || 'Login failed.');
    btn.disabled = false;
    btn.innerText = 'Verify Identity';
  }
};

// ─── ADMIN LOGOUT ─────────────────────────────────────────
window.adminLogout = async () => {
  await api('/api/admin/logout', { method: 'POST' });
  showTab('login');
};

// ─── INIT DASHBOARD ───────────────────────────────────────
async function initDashboard() {
  setupCharts();
  loadThemeSettings();
  await loadAnalytics();
  await renderUsers();
  await loadWithdrawals();
  await loadSettings();loadAdminChatSessions();
  // Poll for updates every 30 seconds
  setInterval(async () => {
    await loadAnalytics();
    await renderUsers();
    await loadWithdrawals();
  }, 30000);
}

// ─── CHARTS ───────────────────────────────────────────────
let pieChart, barChart;
function setupCharts() {
  const pCtx = document.getElementById('pieChart')?.getContext('2d');
  if (pCtx) {
    pieChart = new Chart(pCtx, {
      type: 'doughnut',
      data: { labels: ['Success', 'Pending', 'Declined'], datasets: [{ data: [0,0,0], backgroundColor: ['#05cd99','#f6ad55','#ee5d50'] }] },
      options: { plugins: { legend: { position: 'bottom' } } }
    });
  }
  const bCtx = document.getElementById('barChart')?.getContext('2d');
  if (bCtx) {
    barChart = new Chart(bCtx, {
      type: 'bar',
      data: {
        labels: ['Deposits', 'Withdrawals'],
        datasets: [{ label: '₦ Value', data: [0,0], backgroundColor: ['#4318ff','#ee5d50'], borderRadius: 10 }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });
  }
}

// ─── ANALYTICS ────────────────────────────────────────────
async function loadAnalytics() {
  const data = await api('/api/admin/analytics');
  if (!data?.success) return;
  const s = data.stats;

  document.getElementById('statTotal').innerText   = `₦${(s.successV || 0).toLocaleString()}`;
  document.getElementById('statPending').innerText = `₦${(s.pendingV || 0).toLocaleString()}`;
  document.getElementById('statUsers').innerText   = s.totalUsers || 0;

  const tbody = document.getElementById('analyticsTableBody');
  if (tbody) {
    tbody.innerHTML = `
      <tr><td>Successful</td><td></td><td>${s.sCount}</td><td>₦${(s.successV).toLocaleString()}</td></tr>
      <tr><td>Pending</td><td></td><td>${s.pCount}</td><td>₦${(s.pendingV).toLocaleString()}</td></tr>
      <tr><td>Declined</td><td></td><td>${s.dCount}</td><td>--</td></tr>`;
  }

  if (pieChart) { pieChart.data.datasets[0].data = [s.sCount, s.pCount, s.dCount]; pieChart.update(); }
  if (barChart) { barChart.data.datasets[0].data = [s.successV, s.withdrawSuccessV]; barChart.update(); }

  allData = data.deposits;
  renderDeposits(allData);
}

// ─── DEPOSITS ────────────────────────────────────────────
function renderDeposits(data) {
  const tbody = document.getElementById('depositTableBody');
  if (!tbody) return;
  tbody.innerHTML = data.map(i => {
    const date = i.createdAt ? new Date(i.createdAt).toLocaleDateString() : 'Now';
    const userId = i.userId?._id || i.userId || '';
    const userName = i.userId?.username || userId.substring(0,7) + '...';
    return `
      <tr>
        <td>${date}</td>
        <td><small>${userName}</small></td>
        <td>₦${Number(i.amount).toLocaleString()}</td>
        <td><code>${(i.refCode || '').substring(0, 8)}...</code></td>
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
  if (data?.success) { showModal({ id:'statusAlert', title:'Success', content:'<p>✅ Deposit approved and user credited!</p>', buttons:[{ text:'Close', class:'btn-sec', onclick:"document.getElementById('statusAlert').remove();" }] }); loadAnalytics(); }
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
  const term = document.getElementById('adminSearch').value.toLowerCase();
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
    csv += `${new Date(i.createdAt).toLocaleDateString()},${i.userId?._id || i.userId},${i.amount},${i.refCode},${i.status}\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'Report.csv'; a.click();
};

// ─── WITHDRAWALS ─────────────────────────────────────────
async function loadWithdrawals() {
  const data = await api('/api/admin/withdrawals');
  if (!data?.success) return;
  const tbody = document.getElementById('withdrawTableBody');
  if (!tbody) return;
  tbody.innerHTML = data.withdrawals.map(w => `
    <tr>
      <td>${new Date(w.createdAt).toLocaleDateString()}</td>
      <td>${w.username || w.userId?.toString().substring(0,7)}</td>
      <td>₦${Number(w.amount).toLocaleString()}</td>
      <td>₦${Number(w.netAmount).toLocaleString()}</td>
      <td>${w.bankDetails?.bankName || '--'}</td>
      <td>${w.bankDetails?.accountNumber || '--'}</td>
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

// ─── USERS ────────────────────────────────────────────────
async function renderUsers() {
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
      <td onclick="viewUserDetails('${u._id}','${u.status}','${u.username}','${u.email}','${u.ib}','${u.emailVerified}','${u.createdAt}','${u.refPoints || 0}','${u.referrerId || ''}','')" style="cursor:pointer">
        <code style="background:var(--bg);padding:4px 8px;border-radius:5px;">${u._id.substring(0,8)}... <i class="ri-pencil-line"></i></code>
      </td>
      <td style="font-size:0.85rem;color:var(--text-sub);">${u.transCount} Trans.</td>
      <td style="font-weight:bold;color:var(--primary);">₦${(u.transTotal || 0).toLocaleString()}</td>
      <td>
        <label class="switch">
          <input type="checkbox" ${isBanned ? 'checked' : ''} onchange="toggleBanStatus('${u._id}', this.checked)">
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
  if (!data?.success) { alert('Error updating ban status.'); renderUsers(); }
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
    tr.innerHTML = `<td><code>${u._id.substring(0,8)}...</code></td><td>${u.transCount} Trans.</td><td>₦${(u.transTotal||0).toLocaleString()}</td>
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
      <p><b>Referrer:</b> ${referrerId || 'None'}</p>
      <hr>
      <div class="input-group">
        <label>Adjust Balance</label>
        <input type="number" id="crAmount" placeholder="Amount" min="0">
      </div>
      <input type="hidden" id="crUserId" value="${uid}">`,
    buttons: [
      { text: 'Credit',  class: 'btn-submit', onclick: `processAdjustment('credit')` },
      { text: 'Debit',   class: 'btn-sec',    onclick: `processAdjustment('debit')` },
      { text: 'Delete User', class: 'btn-danger', onclick: `deleteUser('${uid}')` },
      { text: 'Close',   class: 'btn-sec',    onclick: `document.getElementById('userDetailModal').remove()` }
    ]
  });
};

window.processAdjustment = async (action) => {
  const uid    = document.getElementById('crUserId').value.trim();
  const amount = Number(document.getElementById('crAmount').value);
  if (!uid || !amount) return alert('Please enter a User ID and Amount.');

  const data = await api('/api/admin/users/adjust-balance', {
    method: 'POST',
    body: JSON.stringify({ userId: uid, amount, action })
  });
  if (data?.success) {
    alert(`✅ ${action} of ₦${amount.toLocaleString()} successful! New balance: ₦${data.newBalance.toLocaleString()}`);
    document.getElementById('userDetailModal')?.remove();
    renderUsers();
  } else {
    alert(data?.error || 'Error processing adjustment.');
  }
};

window.deleteUser = async (uid) => {
  if (!confirm('⚠️ Permanently delete this user and all their data?')) return;
  await api(`/api/admin/users/${uid}`, { method: 'DELETE' });
  document.getElementById('userDetailModal')?.remove();
  renderUsers();
};

window.copyAndMove = (uid) => {
  navigator.clipboard.writeText(uid);
  document.getElementById('crUserId').value = uid;
  showTab('users-tab');
};

// ─── SETTINGS ─────────────────────────────────────────────
async function loadSettings() {
  try {
    // 1. Load keys and fetch data
    await loadApiKeys();
    const data = await api('/api/admin/settings');
    
    if (!data?.success) {
      console.error("Failed to fetch settings:", data?.message);
      return;
    }

    const s = data.settings;

    // 2. Handle Maintenance Toggle (Isolated logic)
    const mToggle = document.getElementById('maintenanceToggle');
    if (mToggle && s.maintenance) {
      mToggle.checked = s.maintenance.enabled || false;
      
      // Use an arrow function to preserve 'this' or use 'e.target'
      mToggle.onchange = async (e) => {
        await api('/api/admin/settings/maintenance', { 
          method: 'PUT', 
          body: JSON.stringify({ enabled: e.target.checked }) 
        });
      };
    }
    // 3. Populate all other form fields
    if (s.config) {
      fillSettings(s.config);
    }

  } catch (err) {
    console.error("Error in loadSettings:", err);
  }
}

function fillSettings(data) {
    // Helper to safely set values only if the element exists
    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val ?? ""; // Use nullish coalescing
    };

    // Main Config Fields
    setVal('initBal', data.initBal);
    setVal('descText', data.siteAbout);
    setVal('waLink', data.whatsappLink);
    setVal('tgLink', data.telegramLink);
    setVal('siteNameInput', data.siteName);
    setVal('signinAmt', data.dailyCheckInAmount);
    
    // Withdrawal Fields (Added these here for consistency)
    setVal('minWithdraw', data.minWithdraw);
    setVal('withdrawFee', data.withdrawFee);

    // Logo Preview
    const preview = document.getElementById('logoPreview');
    if (preview) {
        preview.src = data.siteLogo || "assets/img/placeholder-logo.png";
    }

    // Referral Logic (Mapping array to individual inputs)
    if (Array.isArray(data.referralPercents)) {
        setVal('ref1', data.referralPercents[0]);
        setVal('ref2', data.referralPercents[1]);
        setVal('ref3', data.referralPercents[2]);
    }
}

// ─── LOAD API KEYS ────────────────────────────────────────
async function loadApiKeys() {
  const data = await api('/api/admin/settings/apikeys');
  if (!data?.apikeys) return;
  const k = data.apikeys;
  const imgbbInput = document.getElementById('imgbbKeyInput');
  const koraPublic = document.getElementById('koraPublicKeyInput');
  const koraSec    = document.getElementById('koraSecretKeyInput');
  if (imgbbInput) imgbbInput.value = k.imgbb || '';
  if (koraPublic)  koraPublic.value  = k.korapay_public || '';
  if (koraSec)     koraSec.value     = k.korapay_secret || '';
}
window.applyPreset = (mode, primary, secondary) => {
	document.getElementById('themeMode').value = mode;
	document.getElementById('primaryColor').value = primary;
	document.getElementById('secondaryColor').value = secondary;
	// Optional: Auto-save immediately for "Click & Go"
	saveThemeConfig();
	//	alert(`Selected: ${mode} mode with ${primary}`);
};
window.saveThemeConfig = async (e) => {
    // If this is called from an 'onsubmit', we need to prevent refresh
    if (e) e.preventDefault();
    
    const btn = document.querySelector('#themeForm button'); // Adjust selector as needed
    if (btn) {
        btn.disabled = true;
        btn.innerText = "Publishing...";
    }

    try {
        // We wrap them in a 'theme' object to match the original logic
        const themeData = {
            theme: {
                mode: document.getElementById('themeMode').value,
                primary: document.getElementById('primaryColor').value,
                secondary: document.getElementById('secondaryColor').value
            }
        };
   
        // This keeps the structure consistent: config -> theme -> colors
        await api('/api/admin/settings/config', { 
            method: 'PUT', 
            body: JSON.stringify(themeData) 
        });

        alert("✅ Theme Updated! Users will see it immediately.");
    } catch (err) {
        console.error("Theme Update Error:", err);
        alert("Failed to update theme. Check console for details.");
    } finally {
       
    }
};
/*
window.saveConfig = async () => {
  const fields = ['siteName','minWithdraw','withdrawFee','initBal'];
  const value = {};
  fields.forEach(f => {
    const el = document.getElementById(f);
    if (el) value[f] = isNaN(el.value) ? el.value : Number(el.value);
  });
  // Theme
  const primary   = document.getElementById('primaryColor')?.value;
  const secondary = document.getElementById('secondaryColor')?.value;
  const mode      = document.getElementById('themeMode')?.value;
  if (primary || secondary || mode) value.theme = { primary, secondary, mode };

  await api('/api/admin/settings/config', { method: 'PUT', body: JSON.stringify(value) });
  alert('✅ Config saved!');
};
*/

// 1. Listen for any invalid input inside the form
document.getElementById('rulesForm').addEventListener('invalid', (e) => {
    // 2. Find if the invalid input is inside a <details> tag
    const details = e.target.closest('details');
    
    // 3. If it is, open it!
    if (details) {
        details.open = true;
    }
}, true); // The "true" here is important to catch the event as it happens

	document.getElementById('rulesForm').onsubmit = async (e) => {
    e.preventDefault();
    
    // 1. Grab elements and values
    const btn = e.target.querySelector('button');
    const siteName = document.getElementById('siteNameInput').value;
    const desc = document.getElementById('descText').value;
    const wa = document.getElementById('waLink').value;
    const tg = document.getElementById('tgLink').value;
    const initBal = document.getElementById('initBal').value; // Get value here
    const fileInput = document.getElementById('logoFileInput');
    const file = fileInput.files[0];

    // 2. Visual Feedback: Disable button so they can't double-click
    btn.disabled = true;
    btn.innerText = "Saving...";
    try {
        let logoUrl = null;

        // (Your ImgBB logic can go here later when you're ready)

        // 3. Create the Config Object
        const newConfig = {
            siteName: siteName,
            siteAbout: desc,
            whatsappLink: wa,
            telegramLink: tg,
            initBal: Number(initBal), // Ensure it's a number
            dailyCheckInAmount: Number(document.getElementById('signinAmt').value),
            referralPercents: [
                Number(document.getElementById('ref1').value),
                Number(document.getElementById('ref2').value),
                Number(document.getElementById('ref3').value)
            ],
        };

        // 4. Update via API (Fixed the typo here: newConfig)
        await api('/api/admin/settings/config', { 
            method: 'PUT', 
            body: JSON.stringify(newConfig) 
        });

        // 5. Show Success Modal
        showModal({
            id: 'detailsPopup',
            title: 'Configuration Alert',
            content: `
                <strong>Configuration successfully saved</strong>
                <p>✅ Branding updated! Logo and site name are now live.</p>
            `,
            buttons: [{
                text: 'Close',
                class: 'btn-sec',
                onclick: "document.getElementById('detailsPopup').remove()"
            }]
        });

    } catch (err) {
        console.error("Update Error:", err);
        alert("Error updating branding. Check your connection.");
    } finally {
        // 6. Re-enable the button
        btn.disabled = false;
        btn.innerText = "Save Config";
    }
};
// ─── PAYMENT SETTINGS ─────────────────────────────────────
window.openBindBankModal = async () => {
  const data = await api('/api/admin/settings');
  const p = data?.settings?.payment || {};
  showModal({
    id: 'createBankModal',
    title: 'Payments Configuration',
    content: `
      <div class="input-group">
        <label>Active Deposit Mode</label>
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
      </div>
      <div style="display:flex;gap:20px;margin-top:10px;">
        <label style="font-size:12px;">📢 Disable Users Bank Details Update</label>
        <label class="switch">
          <input type="checkbox" id="masterBankLockToggle" ${data?.settings?.config?.globalBankLock?'checked':''} onchange="toggleGlobalBankLock(this.checked)">
          <span class="slider"></span>
        </label>
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
  document.getElementById('manualSettings').style.display  = mode === 'manual'  ? 'block' : 'none';
  document.getElementById('korapaySettings').style.display = mode === 'korapay' ? 'block' : 'none';
};

window.savePaymentSettings = async () => {
  const config = {
    mode:    document.getElementById('depositMode').value,
    manual:  { bankName: document.getElementById('adminBankName').value, accountNumber: document.getElementById('adminAccNum').value, accountName: document.getElementById('adminAccName').value },
    korapay: { publicKey: document.getElementById('koraPublicKey').value, secretKey: document.getElementById('koraSecretKey').value }
  };
  await api('/api/admin/settings/payment', { method: 'PUT', body: JSON.stringify(config) });
  alert('✅ Payment settings saved!');
  document.getElementById('createBankModal')?.remove();
};

window.toggleGlobalBankLock = async (isChecked) => {
  const data = await api('/api/admin/settings');
  const config = data?.settings?.config || {};
  config.globalBankLock = isChecked;
  await api('/api/admin/settings/config', { method: 'PUT', body: JSON.stringify(config) });
  alert(`🔒 Master Bank Lock is now ${isChecked ? 'ACTIVATED' : 'DEACTIVATED'}`);
};

  <!-- Chat Settings Panel -->
window.openChatModal = async () => {
 
  showModal({
    id: 'createChatModal', title: 'Chat settings',
    content: `
                    <div id="chatSettingsPanel">
                        <div style="font-weight:700;font-size:14px;margin-bottom:16px;color:var(--primary);"></div>

                        <div class="settings-row">
                            <label style="font-size:13px;font-weight:600;">Chat Available</label>
                            <label class="switch"><input type="checkbox" id="cs_available" checked><span class="slider"></span></label>
                        </div>
                        <div class="settings-row">
                            <label style="font-size:13px;font-weight:600;">Sound Alerts</label>
                            <label class="switch"><input type="checkbox" id="cs_sound" checked><span class="slider"></span></label>
                        </div>
                        <div class="settings-row">
                            <label style="font-size:13px;font-weight:600;">Allow User Images</label>
                            <label class="switch"><input type="checkbox" id="cs_allowImages" checked><span class="slider"></span></label>
                        </div>
                        <div class="settings-row">
                            <label style="font-size:13px;font-weight:600;">Require Email Verification</label>
                            <label class="switch"><input type="checkbox" id="cs_requireVerified"><span class="slider"></span></label>
                        </div>

                        <div style="margin:14px 0 6px;font-size:13px;font-weight:600;">Auto-Reply Message</div>
                        <textarea id="cs_autoReply" rows="3" placeholder="e.g. Thanks for reaching out! We'll reply shortly." style="width:100%;padding:8px;border:1px solid var(--border,#e0e5f2);border-radius:8px;font-size:13px;resize:vertical;"></textarea>

       <details
                                    style="margin:6px 0;background-color: var(--bg);padding: 8px 15px;border-radius: 12px;">

                                    <summary style="display: flex; justify-content: space-between; font-size: 12pt;margin:8px 0 10px 0;">
                                        <span style="font-weight: bold;">More settings</span>
                                    </summary>

                               <div style="margin:14px 0 6px;font-size:13px;font-weight:600;">Office Hours</div>
                        <label class="switch" style="margin-bottom:8px;"><input type="checkbox" id="cs_officeHoursEnabled"><span class="slider"></span></label>
                        <div style="display:flex;gap:8px;margin-top:8px;">
                            <div style="flex:1;"><div style="font-size:11px;color:#aaa;margin-bottom:4px;">Open (hr)</div><input type="number" id="cs_open" min="0" max="23" value="9" style="width:100%;padding:6px;border:1px solid var(--border,#e0e5f2);border-radius:6px;"></div>
                            <div style="flex:1;"><div style="font-size:11px;color:#aaa;margin-bottom:4px;">Close (hr)</div><input type="number" id="cs_close" min="0" max="23" value="18" style="width:100%;padding:6px;border:1px solid var(--border,#e0e5f2);border-radius:6px;"></div>
                        </div>
                        <input type="text" id="cs_offlineMsg" placeholder="Offline message..." style="width:100%;padding:8px;border:1px solid var(--border,#e0e5f2);border-radius:8px;font-size:13px;margin-top:8px;">

                        <div style="margin:14px 0 6px;font-size:13px;font-weight:600;">Auto-close Inactive (hours)</div>
                        <input type="number" id="cs_autoClose" value="48" min="1" style="width:100%;padding:8px;border:1px solid var(--border,#e0e5f2);border-radius:8px;font-size:13px;">

                        <div style="margin:14px 0 6px;font-size:13px;font-weight:600;">Message Char Limit</div>
                        <input type="number" id="cs_charLimit" value="500" min="50" style="width:100%;padding:8px;border:1px solid var(--border,#e0e5f2);border-radius:8px;font-size:13px;">
                                </details>
      </div>`,
    buttons: [
      { text: 'Cancel',   class: 'btn-sec',    onclick: "document.getElementById('createChatModal').remove()" },
      { text: 'Save Settings', class: 'btn-submit',  onclick: 'saveChatSettings()' }
    ]
  });
};

// ─── ANNOUNCEMENT ─────────────────────────────────────────
window.openCreateNewsModal = async () => {
  const data = await api('/api/admin/settings');
  const ann = data?.settings?.config?.announcement || {};
  showModal({
    id: 'createNewsModal', title: 'Make Announcement',
    content: `
      <div class="input-group" style="margin-top:15px;border-top:1px solid rgba(0,0,0,0.1);padding-top:10px;">
        <textarea id="announcementText" placeholder="Enter news here..." style="width:100%;height:60px;border-radius:8px;padding:10px;margin-top:5px;">${ann.text||''}</textarea>
        <div style="display:flex;gap:10px;">
          <label>📢 Enable Global Announcement</label>
          <label class="switch"><input type="checkbox" id="showAnnouncement" ${ann.active?'checked':''}><span class="slider"></span></label>
        </div>
      </div>`,
    buttons: [
      { text: 'Cancel',   class: 'btn-sec',    onclick: "document.getElementById('createNewsModal').remove()" },
      { text: 'Announce', class: 'btn-submit',  onclick: 'saveAnnouncement()' }
    ]
  });
};

window.saveAnnouncement = async () => {
  const data = await api('/api/admin/settings');
  const config = data?.settings?.config || {};
  config.announcement = {
    text:   document.getElementById('announcementText').value,
    active: document.getElementById('showAnnouncement').checked
  };
  await api('/api/admin/settings/config', { method: 'PUT', body: JSON.stringify(config) });
  document.getElementById('createNewsModal')?.remove();
};

// ─── WHEEL PRIZES ─────────────────────────────────────────
window.updateWheelPrizes = async () => {
  const inputs = document.querySelectorAll('.prize-input');
  const prizes = [];
  inputs.forEach((input, i) => {
    const val = Number(input.value);
    const labels = ['Empty', 'Better Luck', 'Empty', 'Opps!', 'Next Time'];
    prizes.push({ label: val > 0 ? '₦' + val.toLocaleString() : labels[i % labels.length], value: val, color: input.dataset.color });
  });
  await api('/api/admin/settings/wheel', { method: 'PUT', body: JSON.stringify({ prizes }) });
  alert('✅ Wheel prizes updated!');
};

// ─── SHARES MANAGEMENT ────────────────────────────────────
window.openSharesModal = async () => {
  const data = await api('/api/admin/shares');
  const shares = data?.shares || [];
  showModal({
    id: 'sharesModal', title: 'Manage Investment Shares',
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
  const name     = document.getElementById('newShareName').value;
  const price    = Number(document.getElementById('newSharePrice').value);
  const daily    = Number(document.getElementById('newShareDaily').value);
  const duration = Number(document.getElementById('newShareDuration').value);
  if (!name || !price) return alert('Please fill all required fields.');

  // Upload image to imgbb if file selected
  let imgUrl = document.getElementById('newShareImg').value;
  const fileInput = document.getElementById('newShareImgFile');
  if (fileInput?.files[0]) {
    const statusEl = document.getElementById('shareImgStatus');
    imgUrl = await uploadToImgBB(fileInput.files[0], statusEl);
    if (!imgUrl) return; // upload failed
  }

  const share = { name, price, dailyIncome: daily, duration, img: imgUrl || '' };
  await api('/api/admin/shares', { method: 'POST', body: JSON.stringify(share) });
  document.getElementById('sharesModal')?.remove();
  alert('✅ Share added!');
};

window.deleteShare = async (id) => {
  if (!confirm('Delete this share?')) return;
  await api(`/api/admin/shares/${id}`, { method: 'DELETE' });
  document.getElementById('sharesModal')?.remove();
};

// ─── CREATE USER ─────────────────────────────────────────
window.openCreateUserModal = () => {
  showModal({
    id: 'createUserModal', title: 'Create New User',
    content: `
      <div class="input-group"><label>Username</label><input id="newUsername" placeholder="johndoe"></div>
      <div class="input-group"><label>Email</label><input type="email" id="newEmail" placeholder="user@email.com"></div>
      <div class="input-group"><label>Password</label><input type="password" id="newPassword" placeholder="min 6 chars"></div>
      <div class="input-group"><label>Role</label>
        <select id="newRole"><option value="user">User</option><option value="admin">Admin</option></select>
      </div>`,
    buttons: [
      { text: 'Create', class: 'btn-submit', onclick: 'createUser()' },
      { text: 'Cancel', class: 'btn-sec',    onclick: "document.getElementById('createUserModal').remove()" }
    ]
  });
};

window.createUser = async () => {
  const body = {
    username: document.getElementById('newUsername').value,
    email:    document.getElementById('newEmail').value,
    password: document.getElementById('newPassword').value,
    role:     document.getElementById('newRole').value
  };
  const data = await api('/api/admin/create-user', { method: 'POST', body: JSON.stringify(body) });
  if (data?.success) {
    alert('✅ User created!');
    document.getElementById('createUserModal')?.remove();
    renderUsers();
  } else {
    alert(data?.error || 'Error creating user.');
  }
};

// ─── THEME SETTINGS ───────────────────────────────────────
function loadThemeSettings() {
  const saved = localStorage.getItem('exempe-theme') || 'light';
  setTheme(saved);
}

window.setTheme = (theme, el) => {
  localStorage.setItem('exempe-theme', theme);
  document.body.setAttribute('data-theme', theme);
  document.querySelectorAll('.theme-dot').forEach(d => d.classList.remove('active'));
  if (el) el.classList.add('active');
};

// ─── TAB NAVIGATION ───────────────────────────────────────
const navItems = document.querySelectorAll('.nav-item');
      const allPages = document.querySelectorAll('.tab-content');

      function switchPageByHash() {
        const hash = window.location.hash || '#home';
        const targetId = hash.substring(1);
        const targetElement = document.getElementById(targetId);
        if (targetElement) {
          allPages.forEach(page => page.classList.remove('active'));
          navItems.forEach(item => item.classList.remove('active'));
          targetElement.classList.add('active');
          navItems.forEach(item => {
            if (item.getAttribute('href') === hash) item.classList.add('active');
          });
        }
      }

      window.addEventListener('DOMContentLoaded', () => { switchPageByHash(); });
      window.addEventListener('hashchange', switchPageByHash);


window.showTab = (tabId, el) => {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  const tab = document.getElementById(tabId);
  if (tab) tab.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  if (el) el.classList.add('active');
};


/**
 * @param {Object} cfg - Configuration object
 * @param {string} cfg.id - Unique ID for the modal
 * @param {string} cfg.title - Header text
 * @param {string} cfg.content - The HTML body of the modal
 * @param {Array} cfg.buttons - Array of button objects {text, class, onclick}
 */
window.showModal = (cfg) => {
	// 1. Cleanup old versions
	const old = document.getElementById(cfg.id);
	if (old) old.remove();

	// 2. Create Wrapper
	const overlay = document.createElement('div');
	overlay.id = cfg.id;
	overlay.className = 'modal-overlay';
	overlay.style = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.85); display: flex; align-items: center;
        justify-content: center; z-index: 9999; backdrop-filter: blur(8px);
        animation: fadeIn 0.3s ease;
    `;

	// 3. Generate Buttons HTML
	const buttonsHTML = (cfg.buttons || []).map(btn => `
        <button class="${btn.class || 'btn-submit'}" 
                onclick="${btn.onclick}" 
                style="${btn.style || ''}">${btn.text}</button>
    `).join('');

	// 4. Create Card
	const card = document.createElement('div');
	card.className = "modal-card";
	card.style = `
        background: var(--card); color: var(--text);max-width: ${cfg.width || '450px'};
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        border: 1px solid var(--border); transform: scale(1);
    `;
	card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
            <h3 style="margin:0; font-size:1.4rem;">${cfg.title}</h3>
            <span onclick="document.getElementById('${cfg.id}').remove()" style="cursor:pointer; opacity:0.5; font-size:1.5rem;">&times;</span>
        </div>
        <div class="modal-body" style="margin-bottom:25px;">${cfg.content}</div>
        <div class="modal-footer" style="display:flex; gap:12px; justify-content:flex-end;">
            ${buttonsHTML}
        </div>
    `;
	overlay.appendChild(card);
	document.body.appendChild(overlay);
	// Close on click outside
	overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
};


// ─── LOGO UPLOAD VIA IMGBB ────────────────────────────────
window.previewLogo = async (input) => {
  const file = input.files[0];
  if (!file) return;
  // Show local preview instantly
  const reader = new FileReader();
  reader.onload = e => { const p = document.getElementById('logoPreview'); if (p) p.src = e.target.result; };
  reader.readAsDataURL(file);
  // Upload to imgbb
  const statusEl = document.getElementById('logoUploadStatus');
  const url = await uploadToImgBB(file, statusEl);
  if (!url) return;
  // Save to config
  const confData = await api('/api/admin/settings');
  const config   = confData?.settings?.config || {};
  config.siteLogo = url;
  await api('/api/admin/settings/config', { method: 'PUT', body: JSON.stringify(config) });
  const preview = document.getElementById('logoPreview');
  if (preview) preview.src = url;
  alert('✅ Logo uploaded and saved!');
};

// ─── SAVE API KEYS ────────────────────────────────────────
window.saveApiKeys = async () => {
  const imgbb          = document.getElementById('imgbbKeyInput')?.value.trim();
  const korapay_public = document.getElementById('koraPublicKeyInput')?.value.trim();
  const korapay_secret = document.getElementById('koraSecretKeyInput')?.value.trim();
  const data = await api('/api/admin/settings/apikeys', {
    method: 'PUT',
    body: JSON.stringify({ imgbb, korapay_public, korapay_secret })
  });
  if (data?.success) alert('✅ API Keys saved!');
  else alert(data?.error || 'Error saving API keys.');
};

// ─── INIT ─────────────────────────────────────────────────
checkAdminSession();



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
    <div style="display:flex;align-items:flex-end;gap:6px;${isMe?'flex-direction:row-reverse;':''}">
      <img src="${logo}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;flex-shrink:0;background:#eee;">
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
  if (data?.success) { adminSoundEnabled = body.sound; alert('✅ Chat settings saved!'); }
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
