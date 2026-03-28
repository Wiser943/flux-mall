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
      method: 'POST',
      body: formData
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
    //window.location.href = '#analytics';
    initDashboard();
  } else {
    window.location.href = '#login';
  }
}checkAdminSession();


// ─── ADMIN LOGIN ─────────────────────────────────────────
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
    window.location.href = '#analytics';
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
  window.location.href = '#login';
};
















const sideLinks = document.querySelectorAll('.sidebar .side-menu li a:not(.logout)');

sideLinks.forEach(item => {
    const li = item.parentElement;
    item.addEventListener('click', () => {
        sideLinks.forEach(i => {
            i.parentElement.classList.remove('active');
        })
        li.classList.add('active');
    })
});

const menuBar = document.querySelector('.content nav .bx.bx-menu');
const sideBar = document.querySelector('.sidebar');

menuBar.addEventListener('click', () => {
    sideBar.classList.toggle('close');
});

const searchBtn = document.querySelector('.content nav form .form-input button');
const searchBtnIcon = document.querySelector('.content nav form .form-input button .bx');
const searchForm = document.querySelector('.content nav form');

searchBtn.addEventListener('click', function (e) {
    if (window.innerWidth < 576) {
        e.preventDefault;
        searchForm.classList.toggle('show');
        if (searchForm.classList.contains('show')) {
            searchBtnIcon.classList.replace('bx-search', 'bx-x');
        } else {
            searchBtnIcon.classList.replace('bx-x', 'bx-search');
        }
    }
});

window.addEventListener('resize', () => {
    if (window.innerWidth < 768) {
        sideBar.classList.add('close');
    } else {
        sideBar.classList.remove('close');
    }
    if (window.innerWidth > 576) {
        searchBtnIcon.classList.replace('bx-x', 'bx-search');
        searchForm.classList.remove('show');
    }
});

const toggler = document.getElementById('theme-toggle');

toggler.addEventListener('change', function () {
    if (this.checked) {
        document.body.classList.add('dark');
        setTheme('dark')
    } else {
        document.body.classList.remove('dark');setTheme('light')
    }
});






//window.location.href = '#login';
// ─── TAB NAVIGATION ───────────────────────────────────────
const navItems = document.querySelectorAll('.nav-item');
      const allPages = document.querySelectorAll('.page');

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

const ctx = document.querySelector('.activity-chart');
const ctx2 = document.querySelector('.prog-chart');

new Chart(ctx, {
    type: 'bar',
    data: {
        labels: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
        datasets: [{
            label: 'Time',
            data: [8, 6, 7, 6, 10, 8, 4],
            backgroundColor: '#1e293b',
            borderWidth: 3,
            borderRadius: 6,
            hoverBackgroundColor: '#60a5fa'
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            x: {
                border: {
                    display: true
                },
                grid: {
                    display: true,
                    color: '#1e293b'
                }
            },
            y: {
                ticks: {
                    display: false
                }
            }
        },
        plugins: {
            legend: {
                display: false
            }
        },
        animation: {
            duration: 1000,
            easing: 'easeInOutQuad',
        }
    }
});

new Chart(ctx2, {
    type: 'line',
    data: {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'],
        datasets: [{
            label: 'Class GPA',
            data: [6, 10, 8, 14, 6, 7, 4],
            borderColor: '#0891b2',
            tension: 0.4
        },
        {
            label: 'Aver GPA',
            data: [8, 6, 7, 6, 11, 8, 10],
            borderColor: '#ca8a04',
            tension: 0.4
        }
        ]
    },
    options: {
        responsive: true,
        maintainAspectRatio: true,
        scales: {
            x: {
                grid: {
                    display: false,
                }
            },
            y: {
                ticks: {
                    display: false
                },
                border: {
                    display: false,
                    dash: [5, 5]
                }
            }
        },
        plugins: {
            legend: {
                display: false
            }
        },
        animation: {
            duration: 1000,
            easing: 'easeInOutQuad',
        }
    }
});



/* ══════════════════════════════════════
   SETTINGS STATE
══════════════════════════════════════ */
const settings = {};

// Track original values for unsaved changes detection
const originalValues = {};
let unsavedChanges = 0;
let confirmCallback = null;

/* ══════════════════════════════════════
   TOGGLE SECTION (dropdown)
══════════════════════════════════════ */
function toggleSection(id) {
  const card = document.getElementById(id);
  card.classList.toggle('open');
}

/* ══════════════════════════════════════
   THEME
══════════════════════════════════════ */
function setTheme(mode) {
  const html = document.documentElement;
  if (mode === 'auto') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    html.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  } else {
    html.setAttribute('data-theme', mode);
  }
  localStorage.setItem('fm_admin_theme', mode);
  updateThemeBtns(mode);
}

function updateThemeBtns(mode) {
  ['light','dark','auto'].forEach(m => {
    const btn = document.getElementById('theme' + m.charAt(0).toUpperCase() + m.slice(1));
    if (btn) btn.classList.toggle('active', m === mode);
  });
}

(function(){
  const saved = localStorage.getItem('fm_admin_theme') || 'dark';
  setTheme(saved);
})();

/* ══════════════════════════════════════
   CONFIRMATION MODAL
   Usage: showConfirm({ title, msg, type, yesLabel, onYes })
   type: 'danger' | 'warning' | 'info'
══════════════════════════════════════ */
const confirmIcons = { danger: 'ri-error-warning-line', warning: 'ri-alert-line', info: 'ri-question-line' };

function showConfirm({ title, msg, type = 'danger', yesLabel = 'Confirm', onYes }) {
  confirmCallback = onYes;
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmMsg').textContent = msg;
  document.getElementById('confirmIconEl').className = confirmIcons[type] || confirmIcons.danger;
  const iconWrap = document.getElementById('confirmIcon');
  iconWrap.className = `confirm-icon-wrap ${type}`;
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

/* ══════════════════════════════════════
   TOGGLE HANDLER
   All toggles call this.
══════════════════════════════════════ */
function onToggle(feature, checked) {
  // Destructive toggles need confirmation before applying
  if (feature === 'maintenance' && checked) {
    // Revert visually until confirmed
    document.getElementById('tgl-maintenance').checked = false;
    showConfirm({
      title: 'Enable Maintenance Mode?',
      msg: 'All users will be locked out immediately. Only admins can log in during this time.',
      type: 'danger',
      yesLabel: 'Enable Maintenance',
      onYes: () => {
        document.getElementById('tgl-maintenance').checked = true;
        settings['maintenance'] = true;
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
      msg: 'Users will not be able to cash out until you re-enable this. Existing requests remain unaffected.',
      type: 'warning',
      yesLabel: 'Disable Withdrawals',
      onYes: () => {
        document.getElementById('tgl-withdrawals').checked = false;
        settings['withdrawals'] = false;
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
        settings['register'] = false;
        saveFeatureState('register', false);
        showToast('New registrations disabled', 'info');
        markChanged();
      }
    });
    return;
  }

  settings[feature] = checked;
  saveFeatureState(feature, checked);
  markChanged();

  const label = feature.charAt(0).toUpperCase() + feature.slice(1);
  if (feature !== 'maintenance') {
    showToast(`${label} ${checked ? 'enabled' : 'disabled'}`, checked ? 'success' : 'info');
  }
}

async function saveFeatureState(feature, value) {
  // await fetch('/api/admin/settings/toggle', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ feature, value }) });
  console.log(`[API stub] Saved ${feature}=${value}`);
}

/* ══════════════════════════════════════
   UNSAVED CHANGES TRACKING
══════════════════════════════════════ */
function markChanged() {
  unsavedChanges++;
  document.getElementById('unsavedCount').textContent = unsavedChanges;
  document.getElementById('unsavedBar').classList.add('visible');
}

function resetUnsaved() {
  unsavedChanges = 0;
  document.getElementById('unsavedCount').textContent = '0';
  document.getElementById('unsavedBar').classList.remove('visible');
}

function confirmDiscard() {
  showConfirm({
    title: 'Discard Changes?',
    msg: `You have ${unsavedChanges} unsaved change${unsavedChanges !== 1 ? 's' : ''}. All changes will be lost.`,
    type: 'warning',
    yesLabel: 'Discard Changes',
    onYes: () => {
      location.reload();
    }
  });
}

// Watch all inputs, textareas, selects for changes
function initChangeTracking() {
  document.querySelectorAll('.form-input, .add-tag-input').forEach(el => {
    el.addEventListener('input', markChanged);
    el.addEventListener('change', markChanged);
  });
}

// Warn before page unload if unsaved changes
window.addEventListener('beforeunload', (e) => {
  if (unsavedChanges > 0) {
    e.preventDefault();
    e.returnValue = '';
  }
});

/* ══════════════════════════════════════
   SAVE ALL
══════════════════════════════════════ */
function saveAllSettings() {
  const payload = {
    siteName:    document.getElementById('siteName')?.value,
    siteTagline: document.getElementById('siteTagline')?.value,
    siteDesc:    document.getElementById('siteDesc')?.value,
    whatsapp:    document.getElementById('whatsappLink')?.value,
    telegram:    document.getElementById('telegramLink')?.value,
    checkinBonus: document.getElementById('checkinBonus')?.value,
    refL1:        document.getElementById('refL1')?.value,
    refL2:        document.getElementById('refL2')?.value,
    refL3:        document.getElementById('refL3')?.value,
    minDeposit:  document.getElementById('minDeposit')?.value,
    maxDeposit:  document.getElementById('maxDeposit')?.value,
    minWithdraw: document.getElementById('minWithdraw')?.value,
    withdrawFee: document.getElementById('withdrawFee')?.value,
    withdrawStart: document.getElementById('withdrawStart')?.value,
    withdrawEnd:   document.getElementById('withdrawEnd')?.value,
    adminEmail:  document.getElementById('adminEmail')?.value,
    maintMsg:    document.getElementById('maintMsg')?.value,
    gateway:     document.getElementById('payGateway')?.value,
    environment: document.getElementById('payEnv')?.value,
    ...settings
  };
  console.log('[Save All]', payload);

  const btns = document.querySelectorAll('.btn-save, .btn-save-now');
  btns.forEach(btn => {
    const orig = btn.innerHTML;
    btn.innerHTML = '<i class="ri-check-line"></i> Saved!';
    btn.style.background = '#16a34a';
    setTimeout(() => { btn.innerHTML = orig; btn.style.background = ''; }, 2000);
  });

  resetUnsaved();
  showToast('All settings saved successfully', 'success');
}

/* ══════════════════════════════════════
   RESET DEFAULTS — now uses confirm modal
══════════════════════════════════════ */
function resetDefaults() {
  showConfirm({
    title: 'Reset to Defaults?',
    msg: 'All settings will be restored to their factory defaults. This cannot be undone.',
    type: 'warning',
    yesLabel: 'Yes, Reset Everything',
    onYes: () => {
      document.getElementById('siteName').value = 'Fluxmall Exchange';
      document.getElementById('siteTagline').value = 'Setting Standards';
      document.getElementById('checkinBonus').value = '50';
      document.getElementById('refL1').value = '5';
      document.getElementById('refL2').value = '3';
      document.getElementById('refL3').value = '1';
      document.getElementById('minDeposit').value = '1000';
      document.getElementById('maxDeposit').value = '500000';
      document.getElementById('minWithdraw').value = '500';
      document.getElementById('withdrawFee').value = '2';
      showToast('Settings reset to defaults', 'info');
      resetUnsaved();
    }
  });
}

/* ══════════════════════════════════════
   SEARCH
══════════════════════════════════════ */
function handleSearch(query) {
  const q = query.trim().toLowerCase();
  const clearBtn = document.getElementById('searchClear');
  const noResults = document.getElementById('noResults');

  clearBtn.classList.toggle('visible', q.length > 0);

  if (!q) {
    // Show everything
    document.querySelectorAll('.section-card').forEach(c => c.classList.remove('search-hidden'));
    document.querySelectorAll('[data-search-label]').forEach(l => l.classList.remove('search-hidden'));
    document.querySelectorAll('.settings-grid').forEach(g => g.classList.remove('search-hidden'));
    noResults.classList.remove('visible');
    return;
  }

  let totalVisible = 0;

  document.querySelectorAll('.section-card').forEach(card => {
    const keywords = (card.dataset.searchKeywords || '').toLowerCase();
    const titleEl = card.querySelector('.section-title-text');
    const subEl = card.querySelector('.section-sub');
    const titleText = (titleEl?.textContent || '').toLowerCase();
    const subText = (subEl?.textContent || '').toLowerCase();
    const combined = `${titleText} ${subText} ${keywords}`;

    if (combined.includes(q)) {
      card.classList.remove('search-hidden');
      // Auto-open matched cards
      card.classList.add('open');
      // Highlight matching text in title
      if (titleEl) titleEl.innerHTML = highlightText(titleEl.textContent, q);
      totalVisible++;
    } else {
      card.classList.add('search-hidden');
    }
  });

  // Hide section labels that have no visible cards in their group
  document.querySelectorAll('[data-search-label]').forEach(label => {
    // Find the next sibling grid
    let next = label.nextElementSibling;
    let hasVisible = false;
    while (next && !next.hasAttribute('data-search-label')) {
      if (next.classList.contains('settings-grid')) {
        const visibleCards = next.querySelectorAll('.section-card:not(.search-hidden)');
        if (visibleCards.length > 0) hasVisible = true;
      }
      next = next.nextElementSibling;
    }
    label.classList.toggle('search-hidden', !hasVisible);
  });

  if (totalVisible === 0) {
    noResults.classList.add('visible');
    document.getElementById('noResultsQuery').textContent = query;
  } else {
    noResults.classList.remove('visible');
  }
}

function highlightText(text, query) {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return text.slice(0, idx)
    + `<span class="search-highlight">${text.slice(idx, idx + query.length)}</span>`
    + text.slice(idx + query.length);
}

function clearSearch() {
  const input = document.getElementById('settingsSearch');
  input.value = '';
  handleSearch('');
  input.focus();

  // Restore original title text (remove highlights)
  document.querySelectorAll('.section-title-text').forEach(el => {
    el.innerHTML = el.textContent;
  });
}

// Keyboard shortcut: / to focus search
document.addEventListener('keydown', (e) => {
  if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
    e.preventDefault();
    document.getElementById('settingsSearch').focus();
  }
  if (e.key === 'Escape') {
    const search = document.getElementById('settingsSearch');
    if (document.activeElement === search) { clearSearch(); search.blur(); }
    else closeConfirm();
  }
});

/* ══════════════════════════════════════
   STEP NUMBER INPUT
══════════════════════════════════════ */
function stepNum(id, delta) {
  const el = document.getElementById(id);
  if (!el) return;
  const val = parseFloat(el.value) || 0;
  const min = parseFloat(el.min ?? -Infinity);
  const max = parseFloat(el.max ?? Infinity);
  el.value = Math.min(max, Math.max(min, val + delta));
  markChanged();
}

/* ══════════════════════════════════════
   AMOUNT TAGS
══════════════════════════════════════ */
const depositAmounts = [1000, 2000, 3000, 5000, 10000, 20000, 50000];

function renderTags(containerId, amounts) {
  const container = document.getElementById(containerId);
  container.innerHTML = amounts.map(a => `
    <div class="amount-tag">
      ₦${Number(a).toLocaleString()}
      <span class="tag-del" onclick="removeTag('${containerId}', ${a})">✕</span>
    </div>
  `).join('');
}

function addTag(containerId, inputId) {
  const input = document.getElementById(inputId);
  const val = parseInt(input.value);
  if (!val || val <= 0) { showToast('Enter a valid amount', 'error'); return; }
  if (depositAmounts.includes(val)) { showToast('Amount already exists', 'error'); return; }
  depositAmounts.push(val);
  depositAmounts.sort((a,b) => a - b);
  renderTags(containerId, depositAmounts);
  input.value = '';
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

renderTags('depositTags', depositAmounts);

/* ══════════════════════════════════════
   LOGO UPLOAD
══════════════════════════════════════ */
function handleLogoUpload(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const preview = document.getElementById('logoPreview');
    preview.innerHTML = `<img src="${e.target.result}" alt="Logo">`;
    document.getElementById('logoUrl').value = e.target.result;
    showToast('Logo uploaded — save to apply', 'success');
    markChanged();
  };
  reader.readAsDataURL(file);
}

/* ══════════════════════════════════════
   API KEY UTILS
══════════════════════════════════════ */
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
  const orig = btn.innerHTML;
  btn.innerHTML = '<i class="ri-loader-4-line"></i> Testing...';
  btn.disabled = true;
  await new Promise(r => setTimeout(r, 1800));
  btn.innerHTML = orig;
  btn.disabled = false;
  showToast('Connection successful ✓', 'success');
}

/* ══════════════════════════════════════
   UTILITIES
══════════════════════════════════════ */
function openUtil(section) {
  showToast(`Opening ${section} manager...`, 'info');
}

function exportData() {
  showConfirm({
    title: 'Export Transaction Data?',
    msg: 'A CSV file of all transactions will be prepared and downloaded.',
    type: 'info',
    yesLabel: 'Export CSV',
    onYes: () => showToast('Preparing export... Download will start shortly.', 'info')
  });
}

function saveBrandAssets() {
  showToast('Brand assets saved', 'success');
  markChanged();
}

function checkUpdates() {
  showToast('Checking for updates...', 'info');
  setTimeout(() => showToast('Platform is up to date ✓', 'success'), 2000);
}

/* ══════════════════════════════════════
   TOAST
══════════════════════════════════════ */
function showToast(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  const icons = { success: 'ri-check-circle-line', error: 'ri-error-warning-line', info: 'ri-information-line' };
  const toast = document.createElement('div');
  toast.className = `toast-msg ${type}`;
  toast.innerHTML = `<i class="${icons[type] || icons.info}"></i><span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-6px) scale(0.95)';
    toast.style.transition = '0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/* ══════════════════════════════════════
   INIT
══════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', initChangeTracking);

    /* ══════════════════════════════════════
   DATA — Mock users & conversations
══════════════════════════════════════ */
    const USERS = [
      { id: 1, name: 'Chioma Okafor', email: 'chioma@gmail.com', initials: 'CO', online: true, unread: 3, pinned: true, status: 'open', balance: '₦42,500', shares: 3, deposits: 7, referrals: 12, lastMsg: 'Please I need help with my withdrawal', lastTime: '09:42', muted: false, color: '#4CAF7D' },
      { id: 2, name: 'Emeka Nwachukwu', email: 'emeka.n@yahoo.com', initials: 'EN', online: true, unread: 1, pinned: false, status: 'open', balance: '₦8,200', shares: 1, deposits: 3, referrals: 2, lastMsg: 'The deposit is not showing in my wallet', lastTime: '09:31', muted: false, color: '#f59e0b' },
      { id: 3, name: 'Fatima Bello', email: 'fbello@hotmail.com', initials: 'FB', online: false, unread: 0, pinned: false, status: 'resolved', balance: '₦15,750', shares: 2, deposits: 5, referrals: 8, lastMsg: 'Thank you so much! 🙏', lastTime: 'Yesterday', muted: false, color: '#3b82f6' },
      { id: 4, name: 'Tunde Adeyemi', email: 'tunde.a@gmail.com', initials: 'TA', online: false, unread: 1, pinned: false, status: 'open', balance: '₦3,000', shares: 0, deposits: 1, referrals: 0, lastMsg: 'How do I verify my account?', lastTime: 'Yesterday', muted: true, color: '#8b5cf6' },
      { id: 5, name: 'Ngozi Williams', email: 'ngozi@mail.com', initials: 'NW', online: true, unread: 0, pinned: false, status: 'open', balance: '₦120,000', shares: 8, deposits: 22, referrals: 34, lastMsg: 'Can I get my referral bonus?', lastTime: 'Mon', muted: false, color: '#ec4899' },
      { id: 6, name: 'Adaeze Ike', email: 'adaeze@gmail.com', initials: 'AI', online: false, unread: 0, pinned: false, status: 'resolved', balance: '₦28,000', shares: 4, deposits: 9, referrals: 5, lastMsg: 'Issue resolved, thank you!', lastTime: 'Mon', muted: false, color: '#14b8a6' },
      { id: 7, name: 'Babatunde Folake', email: 'bfola@gmail.com', initials: 'BF', online: false, unread: 0, pinned: true, status: 'open', balance: '₦7,500', shares: 1, deposits: 2, referrals: 1, lastMsg: 'Admin please reply my message', lastTime: 'Sun', muted: false, color: '#f97316' },
      { id: 8, name: 'Kemi Adebayo', email: 'kemi@gmail.com', initials: 'KA', online: true, unread: 0, pinned: false, status: 'open', balance: '₦55,000', shares: 5, deposits: 11, referrals: 19, lastMsg: 'Thanks for the quick response!', lastTime: 'Sun', muted: false, color: '#22c55e' },
    ];
    
    const MESSAGES = {
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
      4: [
        { id: 1, from: 'user', text: 'How do I verify my account?', time: '14:30', status: 'delivered' },
      ],
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
    
    /* ══════════════════════════════════════
       STATE
    ══════════════════════════════════════ */
    let activeUserId = null;
    let currentFilter = 'all';
    let sortDesc = true;
    let replyingTo = null;
    let ctxMsgEl = null;
    let emojiOpen = false;
    let quickOpen = false;
    let userPanelOpen = false;
    let msgSearchActive = false;
    
    const EMOJIS = ['😊', '😂', '❤️', '👍', '🙏', '😍', '🎉', '🔥', '💯', '😭', '😅', '🤣', '👏', '🙌', '💪', '✅', '⚡', '🎁', '💰', '🌟', '😢', '😎', '🤔', '💎', '🚀', '👀', '💬', '📱'];
    
    /* ══════════════════════════════════════
       INIT
    ══════════════════════════════════════ */
    function init() {
      renderChatList(USERS);
      buildEmojiGrid();
      // Close context menu on outside click
      document.addEventListener('click', (e) => {
        if (!e.target.closest('.context-menu')) hideCtxMenu();
        if (!e.target.closest('.emoji-picker') && !e.target.closest('.emoji-btn')) closeEmoji();
        if (!e.target.closest('.quick-replies') && !e.target.closest('.input-attach')) closeQuickReplies();
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          hideCtxMenu();
          closeEmoji();
          closeQuickReplies();
          cancelReply();
          if (msgSearchActive) closeMessageSearch();
        }
      });
    }
    
    /* ══════════════════════════════════════
       RENDER CHAT LIST
    ══════════════════════════════════════ */
    function renderChatList(users, query = '') {
      const list = document.getElementById('chatList');
      const noChats = document.getElementById('noChats');
      
      // Sort: pinned first, then by time
      const sorted = [...users].sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return sortDesc ? -1 : 1;
      });
      
      if (sorted.length === 0) {
        list.innerHTML = '';
        noChats.classList.add('visible');
        return;
      }
      noChats.classList.remove('visible');
      
      list.innerHTML = sorted.map(u => {
        const name = query ? highlightText(u.name, query) : u.name;
        const preview = query ? highlightText(u.lastMsg, query) : u.lastMsg;
        const isActive = activeUserId === u.id;
        return `
    <div class="chat-item ${u.unread ? 'unread' : ''} ${u.pinned ? 'pinned' : ''} ${u.muted ? 'muted' : ''} ${isActive ? 'active' : ''}"
      id="ci-${u.id}"
      onclick="openChat(${u.id})"
      oncontextmenu="chatItemCtx(event, ${u.id})"
    >
      <div class="chat-avatar">
        <div class="avatar-img initials" style="color:${u.color};border-color:${u.color}22;">${u.initials}</div>
        <div class="online-dot ${u.online ? 'visible' : ''}"></div>
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
    
    /* ══════════════════════════════════════
       OPEN CHAT
    ══════════════════════════════════════ */
    function openChat(userId) {
      activeUserId = userId;
      const user = USERS.find(u => u.id === userId);
      if (!user) return;
      
      // Mark unread as read
      user.unread = 0;
      
      // Update sidebar active state
      document.querySelectorAll('.chat-item').forEach(el => el.classList.remove('active'));
      const ci = document.getElementById(`ci-${userId}`);
      if (ci) {
        ci.classList.remove('unread');
        ci.classList.add('active');
        ci.querySelector('.unread-badge').textContent = '0';
        ci.querySelector('.unread-badge').style.display = 'none';
      }
      
      // Set header
      document.getElementById('hdrAvatar').textContent = user.initials;
      document.getElementById('hdrAvatar').style.color = user.color;
      document.getElementById('hdrName').textContent = user.name;
      const statusEl = document.getElementById('hdrStatus');
      const dotEl = document.getElementById('hdrOnlineDot');
      if (user.online) {
        statusEl.textContent = 'Online';
        statusEl.className = 'chat-header-status online';
        dotEl.classList.add('visible');
      } else {
        statusEl.textContent = 'Offline';
        statusEl.className = 'chat-header-status';
        dotEl.classList.remove('visible');
      }
      
      // Update user info panel
      document.getElementById('uipAvatar').textContent = user.initials;
      document.getElementById('uipAvatar').style.color = user.color;
      document.getElementById('uipName').textContent = user.name;
      document.getElementById('uipEmail').textContent = user.email;
      document.getElementById('uipBalance').textContent = user.balance;
      document.getElementById('uipShares').textContent = user.shares;
      document.getElementById('uipDeposits').textContent = user.deposits;
      document.getElementById('uipReferrals').textContent = user.referrals;
      
      // Session ended bar
      const seb = document.getElementById('sessionEndedBar');
      seb.classList.toggle('visible', user.status === 'resolved');
      
      // Show window
      document.getElementById('chatEmpty').style.display = 'none';
      const win = document.getElementById('chatWindow');
      win.classList.add('active');
      
      // Render messages
      renderMessages(userId);
      
      // Mobile: slide in
      document.getElementById('chatMain').classList.add('mobile-open');
    }
    
    /* ══════════════════════════════════════
       RENDER MESSAGES
    ══════════════════════════════════════ */
    function renderMessages(userId, highlight = '') {
      const area = document.getElementById('messagesArea');
      const msgs = MESSAGES[userId] || [];
      if (msgs.length === 0) {
        area.innerHTML = '<div class="sys-msg"><span>No messages yet. Say hello! 👋</span></div>';
        return;
      }
      
      let html = '<div class="date-sep"><span class="date-sep-text">Today</span></div>';
      let prevFrom = null;
      
      msgs.forEach((msg, i) => {
        const isContinuation = prevFrom === msg.from && i > 0;
        const isOut = msg.from === 'admin';
        const cls = `msg-wrap ${isOut ? 'out' : 'in'} ${isContinuation ? 'continuation' : ''}`;
        
        let textContent = highlight ? highlightText(escapeHtml(msg.text), highlight) : escapeHtml(msg.text);
        const isEmoji = /^[\u{1F300}-\u{1FFFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\s]+$/u.test(msg.text) && msg.text.length <= 6;
        
        const statusIcon = isOut ? `<i class="ri-check-double-line bubble-status ${msg.status === 'read' ? 'read' : ''}"></i>` : '';
        
        html += `
    <div class="${cls}" data-msg-id="${msg.id}" oncontextmenu="showCtxMenu(event, ${msg.id}, '${escapeHtml(msg.text)}')">
      <div class="bubble ${isEmoji ? 'emoji-only' : ''}">
        ${!isOut && !isContinuation ? `<span class="bubble-sender">${USERS.find(u=>u.id===userId)?.name.split(' ')[0]||'User'}</span>` : ''}
        <div class="bubble-text">${textContent}</div>
        ${!isEmoji ? `<div class="bubble-meta"><span class="bubble-time">${msg.time}</span>${statusIcon}</div>` : ''}
      </div>
    </div>`;
        prevFrom = msg.from;
      });
      
      area.innerHTML = html;
      area.scrollTop = area.scrollHeight;
    }
    
    /* ══════════════════════════════════════
       SEND MESSAGE
    ══════════════════════════════════════ */
    function sendMessage() {
      if (!activeUserId) return;
      const input = document.getElementById('msgInput');
      const text = input.value.trim();
      if (!text) return;
      
      const msgs = MESSAGES[activeUserId];
      const newMsg = {
        id: msgs.length + 1,
        from: 'admin',
        text,
        time: now(),
        status: 'delivered',
        replyTo: replyingTo ? { ...replyingTo } : null
      };
      msgs.push(newMsg);
      
      // Update last message in list
      const user = USERS.find(u => u.id === activeUserId);
      if (user) {
        user.lastMsg = text;
        user.lastTime = now();
      }
      
      input.value = '';
      input.style.height = 'auto';
      cancelReply();
      closeQuickReplies();
      closeEmoji();
      renderMessages(activeUserId);
      
      // Re-render list to update preview
      const q = document.getElementById('chatSearch').value;
      handleChatSearch(q);
    }
    
    function handleInputKey(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    }
    
    function autoResize(el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 120) + 'px';
    }
    
    /* ══════════════════════════════════════
       MOBILE BACK
    ══════════════════════════════════════ */
    function closeMobileChat() {
      document.getElementById('chatMain').classList.remove('mobile-open');
      document.querySelectorAll('.chat-item').forEach(el => el.classList.remove('active'));
      activeUserId = null;
    }
    
    /* ══════════════════════════════════════
       SEARCH — CHAT LIST
    ══════════════════════════════════════ */
    function handleChatSearch(query) {
      const q = query.trim().toLowerCase();
      const clearBtn = document.getElementById('searchClearBtn');
      clearBtn.classList.toggle('visible', q.length > 0);
      
      let filtered = USERS;
      if (q) {
        filtered = USERS.filter(u =>
          u.name.toLowerCase().includes(q) ||
          u.lastMsg.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q)
        );
      }
      
      // Apply filter tab
      filtered = applyFilter(filtered);
      renderChatList(filtered, q);
    }
    
    function clearChatSearch() {
      const input = document.getElementById('chatSearch');
      input.value = '';
      handleChatSearch('');
      input.focus();
    }
    
    /* ══════════════════════════════════════
       FILTER TABS
    ══════════════════════════════════════ */
    function setFilter(filter, btn) {
      currentFilter = filter;
      document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      handleChatSearch(document.getElementById('chatSearch').value);
    }
    
    function applyFilter(users) {
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
    
    /* ══════════════════════════════════════
       SEARCH IN MESSAGES
    ══════════════════════════════════════ */
    function toggleSearch() {
      const bar = document.getElementById('msgSearchBar');
      msgSearchActive = !msgSearchActive;
      bar.style.display = msgSearchActive ? 'block' : 'none';
      document.getElementById('msgSearchBtn').classList.toggle('active', msgSearchActive);
      if (msgSearchActive) {
        document.getElementById('msgSearchInput').focus();
        document.getElementById('msgSearchClear').classList.add('visible');
      } else {
        closeMessageSearch();
      }
    }
    
    function searchInChat(query) {
      if (!activeUserId) return;
      const q = query.trim();
      const countEl = document.getElementById('msgSearchCount');
      if (!q) {
        renderMessages(activeUserId);
        countEl.textContent = '';
        return;
      }
      const msgs = MESSAGES[activeUserId] || [];
      const matches = msgs.filter(m => m.text.toLowerCase().includes(q.toLowerCase()));
      countEl.textContent = matches.length ? `${matches.length} result${matches.length !== 1 ? 's' : ''}` : 'No results';
      renderMessages(activeUserId, q);
    }
    
    function closeMessageSearch() {
      const bar = document.getElementById('msgSearchBar');
      bar.style.display = 'none';
      document.getElementById('msgSearchInput').value = '';
      document.getElementById('msgSearchClear').classList.remove('visible');
      document.getElementById('msgSearchCount').textContent = '';
      document.getElementById('msgSearchBtn').classList.remove('active');
      msgSearchActive = false;
      if (activeUserId) renderMessages(activeUserId);
    }
    
    /* ══════════════════════════════════════
       CONTEXT MENU
    ══════════════════════════════════════ */
    let ctxMsgText = '';
    let ctxMsgId = null;
    
    function showCtxMenu(e, msgId, text) {
      e.preventDefault();
      ctxMsgId = msgId;
      ctxMsgText = text;
      const menu = document.getElementById('ctxMenu');
      menu.classList.add('visible');
      const x = Math.min(e.clientX, window.innerWidth - 190);
      const y = Math.min(e.clientY, window.innerHeight - 220);
      menu.style.left = x + 'px';
      menu.style.top = y + 'px';
    }
    
    function hideCtxMenu() {
      document.getElementById('ctxMenu').classList.remove('visible');
    }
    
    function ctxAction(action) {
      hideCtxMenu();
      switch (action) {
        case 'reply':
          startReply(ctxMsgId, ctxMsgText);
          break;
        case 'copy':
          navigator.clipboard.writeText(ctxMsgText).then(() => toast('Copied!', 'success'));
          break;
        case 'forward':
          toast('Forward: coming soon', 'info');
          break;
        case 'star':
          toast('Message starred ⭐', 'success');
          break;
        case 'delete':
          if (activeUserId && ctxMsgId) {
            const msgs = MESSAGES[activeUserId];
            const idx = msgs.findIndex(m => m.id === ctxMsgId);
            if (idx > -1) {
              msgs.splice(idx, 1);
              renderMessages(activeUserId);
              toast('Message deleted', 'info');
            }
          }
          break;
      }
    }
    
    /* ══════════════════════════════════════
       REPLY
    ══════════════════════════════════════ */
    function startReply(msgId, text) {
      if (!activeUserId) return;
      replyingTo = { msgId, text };
      const user = USERS.find(u => u.id === activeUserId);
      document.getElementById('replyBarSender').textContent = user?.name.split(' ')[0] || 'User';
      document.getElementById('replyBarText').textContent = text;
      document.getElementById('replyBar').classList.add('visible');
      document.getElementById('msgInput').focus();
    }
    
    function cancelReply() {
      replyingTo = null;
      document.getElementById('replyBar').classList.remove('visible');
    }
    
    /* ══════════════════════════════════════
       QUICK REPLIES
    ══════════════════════════════════════ */
    function toggleQuickReplies() {
      quickOpen = !quickOpen;
      document.getElementById('quickReplies').classList.toggle('visible', quickOpen);
    }
    
    function closeQuickReplies() {
      quickOpen = false;
      document.getElementById('quickReplies').classList.remove('visible');
    }
    
    function useQuickReply(text) {
      document.getElementById('msgInput').value = text;
      autoResize(document.getElementById('msgInput'));
      closeQuickReplies();
      document.getElementById('msgInput').focus();
    }
    
    /* ══════════════════════════════════════
       EMOJI
    ══════════════════════════════════════ */
    function buildEmojiGrid() {
      document.getElementById('emojiGrid').innerHTML = EMOJIS.map(e =>
        `<span class="emoji-btn-item" onclick="insertEmoji('${e}')">${e}</span>`
      ).join('');
    }
    
    function toggleEmoji() {
      emojiOpen = !emojiOpen;
      document.getElementById('emojiPicker').classList.toggle('visible', emojiOpen);
    }
    
    function closeEmoji() {
      emojiOpen = false;
      document.getElementById('emojiPicker').classList.remove('visible');
    }
    
    function insertEmoji(emoji) {
      const inp = document.getElementById('msgInput');
      const pos = inp.selectionStart;
      const val = inp.value;
      inp.value = val.slice(0, pos) + emoji + val.slice(pos);
      inp.selectionStart = inp.selectionEnd = pos + emoji.length;
      inp.focus();
    }
    
    /* ══════════════════════════════════════
       USER INFO PANEL
    ══════════════════════════════════════ */
    function toggleUserPanel() {
      userPanelOpen = !userPanelOpen;
      document.getElementById('userInfoPanel').classList.toggle('hidden', !userPanelOpen);
      document.getElementById('uipToggleBtn').classList.toggle('active', userPanelOpen);
    }
    
    /* ══════════════════════════════════════
       TYPING SIMULATION
    ══════════════════════════════════════ */
    function simulateTyping() {
      if (!activeUserId) return;
      const tb = document.getElementById('typingBubble');
      const area = document.getElementById('messagesArea');
      // Show typing in chat list
      const ci = document.getElementById(`ci-${activeUserId}`);
      if (ci) ci.classList.add('typing');
      
      tb.classList.add('visible');
      area.scrollTop = area.scrollHeight;
      
      setTimeout(() => {
        tb.classList.remove('visible');
        if (ci) ci.classList.remove('typing');
        
        // Add a fake user message
        const user = USERS.find(u => u.id === activeUserId);
        const responses = [
          'Thank you for your help!',
          'Ok I will wait then',
          'Is there anything else I should do?',
          'My issue has been resolved 🙏',
          'Please when will it be done?'
        ];
        const text = responses[Math.floor(Math.random() * responses.length)];
        MESSAGES[activeUserId].push({ id: Date.now(), from: 'user', text, time: now(), status: 'delivered' });
        if (user) {
          user.lastMsg = text;
          user.lastTime = now();
        }
        renderMessages(activeUserId);
        handleChatSearch(document.getElementById('chatSearch').value);
      }, 2500);
    }
    
    /* ══════════════════════════════════════
       RESOLVE SESSION
    ══════════════════════════════════════ */
    function resolveSession() {
      if (!activeUserId) return;
      const user = USERS.find(u => u.id === activeUserId);
      if (!user) return;
      user.status = 'resolved';
      document.getElementById('sessionEndedBar').classList.add('visible');
      const inputArea = document.getElementById('inputArea');
      inputArea.style.opacity = '0.5';
      inputArea.style.pointerEvents = 'none';
      toast(`Session with ${user.name} resolved`, 'success');
      handleChatSearch(document.getElementById('chatSearch').value);
    }
    
    function reopenSession() {
      if (!activeUserId) return;
      const user = USERS.find(u => u.id === activeUserId);
      if (!user) return;
      user.status = 'open';
      document.getElementById('sessionEndedBar').classList.remove('visible');
      const inputArea = document.getElementById('inputArea');
      inputArea.style.opacity = '';
      inputArea.style.pointerEvents = '';
      toast('Session reopened', 'info');
    }
    
    /* ══════════════════════════════════════
       CHAT ITEM CONTEXT (right click on list)
    ══════════════════════════════════════ */
    function chatItemCtx(e, userId) {
      e.preventDefault();
      const user = USERS.find(u => u.id === userId);
      if (!user) return;
      // Simple pin/mute toggle
      const actions = [
      {
        label: user.pinned ? 'Unpin chat' : 'Pin chat',
        fn: () => {
          user.pinned = !user.pinned;
          handleChatSearch('');
          toast(user.pinned ? 'Chat pinned' : 'Chat unpinned', 'info');
        }
      },
      {
        label: user.muted ? 'Unmute chat' : 'Mute chat',
        fn: () => {
          user.muted = !user.muted;
          handleChatSearch('');
          toast(user.muted ? 'Chat muted' : 'Chat unmuted', 'info');
        }
      },
      {
        label: 'Mark as unread',
        fn: () => {
          user.unread = 1;
          handleChatSearch('');
          toast('Marked as unread', 'info');
        }
      },
      {
        label: 'Resolve chat',
        fn: () => {
          user.status = 'resolved';
          handleChatSearch('');
          toast('Resolved', 'success');
        }
      }, ];
      // Build a mini menu (reuse ctx menu)
      const menu = document.getElementById('ctxMenu');
      // Temporarily swap items
      menu.innerHTML = actions.map(a => `<div class="ctx-item" onclick="this.closest('.context-menu').classList.remove('visible'); (${a.fn.toString()})()"><i class="ri-settings-3-line"></i>${a.label}</div>`).join('');
      menu.classList.add('visible');
      menu.style.left = Math.min(e.clientX, window.innerWidth - 190) + 'px';
      menu.style.top = Math.min(e.clientY, window.innerHeight - 180) + 'px';
      // Reset menu on close
      menu.addEventListener('mouseleave', resetCtxMenu, { once: true });
    }
    
    function resetCtxMenu() {
      document.getElementById('ctxMenu').innerHTML = `
    <div class="ctx-item" onclick="ctxAction('reply')"><i class="ri-reply-line"></i> Reply</div>
    <div class="ctx-item" onclick="ctxAction('copy')"><i class="ri-file-copy-line"></i> Copy</div>
    <div class="ctx-item" onclick="ctxAction('forward')"><i class="ri-share-forward-line"></i> Forward</div>
    <div class="ctx-item" onclick="ctxAction('star')"><i class="ri-star-line"></i> Star message</div>
    <div class="ctx-divider"></div>
    <div class="ctx-item danger" onclick="ctxAction('delete')"><i class="ri-delete-bin-line"></i> Delete</div>`;
    }
    
    /* ══════════════════════════════════════
       SORT
    ══════════════════════════════════════ */
    function toggleSort() {
      sortDesc = !sortDesc;
      document.getElementById('sortBtn').querySelector('i').className = sortDesc ? 'ri-sort-desc' : 'ri-sort-asc';
      handleChatSearch(document.getElementById('chatSearch').value);
      toast(`Sorted ${sortDesc ? 'newest first' : 'oldest first'}`, 'info');
    }
    
    /* ══════════════════════════════════════
       MORE MENU (header)
    ══════════════════════════════════════ */
    function showMoreMenu() {
      if (!activeUserId) return;
      const user = USERS.find(u => u.id === activeUserId);
      toast(`More options for ${user?.name}`, 'info');
    }
    
    
    
    /* ══════════════════════════════════════
       TOAST
    ══════════════════════════════════════ */
    function toast(msg, type = 'success') {
      const container = document.getElementById('toast');
      const icons = { success: 'ri-check-circle-line', error: 'ri-error-warning-line', info: 'ri-information-line' };
      const el = document.createElement('div');
      el.className = `toast-item ${type}`;
      el.innerHTML = `<i class="${icons[type]||icons.info}"></i><span>${msg}</span>`;
      container.appendChild(el);
      setTimeout(() => {
        el.style.opacity = '0';
        el.style.transition = '0.25s';
        setTimeout(() => el.remove(), 250);
      }, 2800);
    }
    
    /* ══════════════════════════════════════
       HELPERS
    ══════════════════════════════════════ */
    function now() {
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
    
    /* ══════════════════════════════════════
       START
    ══════════════════════════════════════ */
   // init();
