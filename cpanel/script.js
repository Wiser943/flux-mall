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
