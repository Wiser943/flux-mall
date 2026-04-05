// ============================================================
// FLUX MALL — Account Script
// account.html inline script already declares and exposes:
//   signupForm, loginForm, resetForm, urlParams, refParam,
//   referralCodeInput, usernameInput, emailInput, passwordInput,
//   loginEmailInput, loginPasswordInput, and all error elements,
//   showAlert(), showConfirm(), showLoading(), togglePassword(),
//   switchPageByHash()
// DO NOT redeclare any of these here.
// ============================================================

// ─── BRANDING & CONFIG ────────────────────────────────────
async function syncBranding() {
  try {
    const res  = await fetch('/api/user/config');
    const data = await res.json();
    if (!data.success) return;
    const { config, maintenance } = data;

    if (maintenance && maintenance.enabled) {
      document.body.innerHTML =
        '<div style="display:flex;align-items:center;justify-content:center;height:100vh;' +
        'flex-direction:column;gap:16px;background:#0b1437;color:#fff;text-align:center;padding:20px">' +
        '<h1 style="font-size:3rem">🛠️</h1><h2>System Maintenance</h2><p>We\'ll be back shortly.</p></div>';
      return;
    }

    if (config.siteName) {
      document.querySelectorAll('.site-name').forEach(el => el.innerText = config.siteName);
      document.title = 'Account | ' + config.siteName;
    }

    if (config.siteLogo) {
      document.querySelectorAll('.logo-img').forEach(img => img.src = config.siteLogo);
      let link = document.querySelector("link[rel~='icon']");
      if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
      link.href = config.siteLogo;
    }

    if (config.theme) applyTheme(config.theme);

  } catch (err) {
    console.log('Branding sync failed:', err);
  }
}

function applyTheme(theme) {
  const root = document.documentElement;
  root.style.setProperty('--primary', theme.primary || '#4318ff');
  root.style.setProperty('--accent-green', theme.secondary || '#05cd99');
  if (theme.mode === 'dark') {
    root.style.setProperty('--right-panel-bg', '#0b1437');
    root.style.setProperty('--card-bg', '#111c44');
    root.style.setProperty('--text-white', '#ffffff');
    root.style.setProperty('--input-bg', '#1b254b');
    root.style.setProperty('--border', 'rgba(255,255,255,0.1)');
  } else {
    root.style.setProperty('--right-panel-bg', '#f4f7fe');
    root.style.setProperty('--card-bg', '#ffffff');
    root.style.setProperty('--text-white', '#2b3674');
    root.style.setProperty('--input-bg', '#f4f7fe');
    root.style.setProperty('--border', '#e0e5f2');
  }
}

// ─── SESSION CHECK ────────────────────────────────────────
async function checkSession() {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    if (res.ok) window.location.href = '/m1/index.html';
  } catch (err) {}
}

// ─── REFERRER FETCH ───────────────────────────────────────
async function fetchReferrer(refId) {
  try {
    const res  = await fetch('/api/auth/referrer/' + refId);
    const data = await res.json();
    if (data.username) {
      const nameEl    = document.getElementById('referrerName');
      const sectionEl = document.getElementById('referrerSection');
      if (nameEl)    nameEl.innerText        = data.username;
      if (sectionEl) sectionEl.style.display = 'block';
    }
  } catch (err) {}
}

// ─── VALIDATION HELPERS ───────────────────────────────────
function clearErrors() {
  ['usernameError','emailError','passwordError','formMessage',
   'loginEmailError','loginPasswordError','loginFormMessage'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '';
  });
}

function validateInput(input, errorEl, msg) {
  if (!input || input.value.trim() === '') {
    if (errorEl) errorEl.textContent = msg;
    return false;
  }
  if (errorEl) errorEl.textContent = '';
  return true;
}

function validateEmail(input, errorEl) {
  const email = input ? input.value.trim() : '';
  if (!email) { if (errorEl) errorEl.textContent = 'Email is required.'; return false; }
  if (!/\S+@\S+\.\S+/.test(email)) { if (errorEl) errorEl.textContent = 'Invalid email format.'; return false; }
  if (errorEl) errorEl.textContent = '';
  return true;
}

// ─── TOKEN EXTRACTION ─────────────────────────────────────
// FIX: Declared at MODULE level (outside DOMContentLoaded) so it's
// accessible to ALL functions including the resetForm submit handler.
// Reads token from: /#forgot-password-page?token=xxx
// or standard query string: /account.html?token=xxx
function getResetToken() {
  const hash      = window.location.hash || '';
  const hashQuery = hash.includes('?') ? hash.split('?')[1] : '';
  const params    = new URLSearchParams(hashQuery || window.location.search);
  return params.get('token') || null;
}

// Read once at module load — available everywhere in this file
const RESET_TOKEN = getResetToken();

// ─── RESET FORM UI SWITCHER ───────────────────────────────
function applyResetMode(token) {
  const emailField  = document.getElementById('resetEmail');
  const submitBtn   = document.getElementById('resetSubmitBtn');
  const formTitle   = document.getElementById('resetFormTitle');
  const formSub     = document.getElementById('resetFormSubtitle');

  if (!token) {
    removePwFields();
    if (emailField) {
      const wrap = findFieldWrapper(emailField);
      if (wrap) wrap.style.display = '';
    }
    if (submitBtn) {
      submitBtn.textContent = 'Send Reset Link';
      submitBtn.disabled    = true;
    }
    return;
  }

  // ── SET NEW PASSWORD MODE ────────────────────────────────
  // 1. Hide the email field wrapper
  if (emailField) {
    const wrap = findFieldWrapper(emailField);
    if (wrap) wrap.style.display = 'none';
  }

  // 2. Update headings
  if (formTitle) formTitle.textContent = 'Set New Password';
  if (formSub)   formSub.textContent   = 'Choose a strong password for your account.';

  // 3. Inject password fields only once
  if (submitBtn && !document.getElementById('resetNewPassword')) {
    submitBtn.insertAdjacentHTML('beforebegin', `
      <div id="resetPwFields" style="margin-bottom:0;">
        <div class="input-group" style="margin-bottom:14px;">
          <label style="font-size:13px;font-weight:500;color:var(--text-muted,#707eae);display:block;margin-bottom:6px;">
            New Password
          </label>
          <div style="position:relative;">
            <input
              type="password"
              id="resetNewPassword"
              placeholder="Enter new password"
              autocomplete="new-password"
              oninput="onResetPwInput()"
              style="width:100%;padding:12px 44px 12px 14px;border:1px solid var(--border,#e0e5f2);border-radius:10px;background:var(--input-bg,#f4f7fe);font-size:14px;outline:none;transition:border 0.2s;color:var(--text-white,#2b3674);"
            >
            <span onclick="toggleResetPw('resetNewPassword',this)"
              style="position:absolute;right:14px;top:50%;transform:translateY(-50%);cursor:pointer;font-size:18px;color:var(--text-muted,#707eae);user-select:none;">
              👁️
            </span>
          </div>
          <div id="resetStrengthWrap" style="display:none;margin-top:6px;">
            <div style="height:4px;background:var(--border,#e0e5f2);border-radius:99px;overflow:hidden;">
              <div id="resetStrengthFill" style="height:100%;width:0;border-radius:99px;transition:width 0.4s,background 0.3s;"></div>
            </div>
            <div id="resetStrengthLabel" style="font-size:11px;font-weight:600;color:#aaa;margin-top:4px;"></div>
          </div>
        </div>
        <div class="input-group" style="margin-bottom:20px;">
          <label style="font-size:13px;font-weight:500;color:var(--text-muted,#707eae);display:block;margin-bottom:6px;">
            Confirm Password
          </label>
          <div style="position:relative;">
            <input
              type="password"
              id="resetConfirmPassword"
              placeholder="Re-enter your password"
              autocomplete="new-password"
              oninput="onResetConfirmInput()"
              style="width:100%;padding:12px 44px 12px 14px;border:1px solid var(--border,#e0e5f2);border-radius:10px;background:var(--input-bg,#f4f7fe);font-size:14px;outline:none;transition:border 0.2s;color:var(--text-white,#2b3674);"
            >
            <span onclick="toggleResetPw('resetConfirmPassword',this)"
              style="position:absolute;right:14px;top:50%;transform:translateY(-50%);cursor:pointer;font-size:18px;color:var(--text-muted,#707eae);user-select:none;">
              👁️
            </span>
          </div>
          <div id="resetConfirmHint" style="font-size:12px;margin-top:5px;min-height:16px;"></div>
        </div>
      </div>`);
  }

  // 4. Update button — do NOT disable here; let updateResetSubmitBtn control it
  if (submitBtn) {
    submitBtn.textContent = 'Reset Password';
    updateResetSubmitBtn();
  }
}

function findFieldWrapper(el) {
  let node = el.parentElement;
  while (node && node.tagName !== 'FORM') {
    if (
      node.classList.contains('input-group') ||
      node.classList.contains('form-group') ||
      node.classList.contains('field-wrap') ||
      (node.tagName === 'DIV' && node.parentElement?.tagName !== 'DIV')
    ) return node;
    node = node.parentElement;
  }
  return el.parentElement;
}

function removePwFields() {
  const el = document.getElementById('resetPwFields');
  if (el) el.remove();
}

// ─── PASSWORD STRENGTH ────────────────────────────────────
const RESET_REQS = [
  pw => pw.length >= 8,
  pw => /[A-Z]/.test(pw),
  pw => /[0-9]/.test(pw),
  pw => /[^A-Za-z0-9]/.test(pw),
];

const RESET_STRENGTH_MAP = [
  { label: '',       color: 'transparent', pct: '0%'   },
  { label: 'Weak',   color: '#ef4444',     pct: '25%'  },
  { label: 'Fair',   color: '#f59e0b',     pct: '50%'  },
  { label: 'Good',   color: '#3b82f6',     pct: '75%'  },
  { label: 'Strong', color: '#22c55e',     pct: '100%' },
];

function calcResetStrength(pw) {
  return RESET_REQS.filter(fn => fn(pw)).length;
}

window.onResetPwInput = function () {
  const pw    = document.getElementById('resetNewPassword')?.value || '';
  const score = calcResetStrength(pw);
  const map   = RESET_STRENGTH_MAP[score];

  const wrap = document.getElementById('resetStrengthWrap');
  const fill = document.getElementById('resetStrengthFill');
  const lbl  = document.getElementById('resetStrengthLabel');

  if (wrap) wrap.style.display = pw.length ? 'block' : 'none';
  if (fill) { fill.style.width = map.pct; fill.style.background = map.color; }
  if (lbl)  { lbl.textContent = map.label ? 'Strength: ' + map.label : ''; lbl.style.color = map.color; }

  const confirm = document.getElementById('resetConfirmPassword');
  if (confirm && confirm.value) onResetConfirmInput();

  updateResetSubmitBtn();
};

window.onResetConfirmInput = function () {
  const pw      = document.getElementById('resetNewPassword')?.value    || '';
  const confirm = document.getElementById('resetConfirmPassword')?.value || '';
  const hint    = document.getElementById('resetConfirmHint');
  const input   = document.getElementById('resetConfirmPassword');

  if (!confirm) {
    if (hint)  hint.textContent = '';
    if (input) input.style.borderColor = '';
    updateResetSubmitBtn();
    return;
  }

  if (pw === confirm) {
    if (hint)  { hint.textContent = '✓ Passwords match'; hint.style.color = '#22c55e'; }
    if (input) input.style.borderColor = '#22c55e';
  } else {
    if (hint)  { hint.textContent = '✗ Passwords do not match'; hint.style.color = '#ef4444'; }
    if (input) input.style.borderColor = '#ef4444';
  }

  updateResetSubmitBtn();
};

function updateResetSubmitBtn() {
  const pw      = document.getElementById('resetNewPassword')?.value    || '';
  const confirm = document.getElementById('resetConfirmPassword')?.value || '';
  const btn     = document.getElementById('resetSubmitBtn');
  if (!btn) return;
  const valid = pw.length >= 8 && pw === confirm && calcResetStrength(pw) >= 2;
  btn.disabled = !valid;
}

window.toggleResetPw = function (inputId, span) {
  const input = document.getElementById(inputId);
  if (!input) return;
  input.type       = input.type === 'password' ? 'text' : 'password';
  span.textContent = input.type === 'password' ? '👁️' : '🙈';
};

// ─── ACTUAL RESET PASSWORD API CALL ──────────────────────
// FIX: Extracted into its own named function so it can be called
// directly from the button click AND from the form submit handler.
// This avoids any showConfirm rendering issues blocking the flow.
async function doResetPassword() {
  const newPw  = document.getElementById('resetNewPassword')?.value    || '';
  const confPw = document.getElementById('resetConfirmPassword')?.value || '';
  const btn    = document.getElementById('resetSubmitBtn');

  if (!newPw || newPw.length < 8) {
    showAlert('Password must be at least 8 characters.', false);
    return;
  }
  if (newPw !== confPw) {
    showAlert('Passwords do not match.', false);
    return;
  }
  if (calcResetStrength(newPw) < 2) {
    showAlert('Password is too weak. Add uppercase, numbers or symbols.', false);
    return;
  }

  if (btn) { btn.disabled = true; btn.innerText = 'Resetting...'; }

  try {
    const res = await fetch('/api/auth/reset-password', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ token: RESET_TOKEN, newPassword: newPw })
    });
    const data = await res.json();

    if (data.success) {
      showAlert('Password reset successfully! You can now log in.', true);
      // Clear token from URL so the link can't be reused
      window.history.replaceState(null, '', window.location.pathname);
      setTimeout(() => { window.location.hash = '#login-page'; }, 1500);
    } else {
      const errMsg = data.error || 'Reset failed. The link may have expired.';
      showAlert(errMsg, false);
      if (errMsg.toLowerCase().includes('expired') || errMsg.toLowerCase().includes('invalid')) {
        // Push user back to request a fresh link
        setTimeout(() => {
          removePwFields();
          const emailWrap = document.getElementById('resetEmail') && findFieldWrapper(document.getElementById('resetEmail'));
          if (emailWrap) emailWrap.style.display = '';
          window.location.hash = '#forgot-password-page';
        }, 2000);
      }
    }
  } catch (err) {
    showAlert('Network error. Please try again.', false);
  } finally {
    if (btn) { btn.disabled = false; btn.innerText = 'Reset Password'; }
  }
}

// ─── WIRE UP FORMS ────────────────────────────────────────
window.addEventListener('DOMContentLoaded', function () {

  if (typeof refParam !== 'undefined' && refParam) {
    fetchReferrer(refParam);
  }

  // Apply reset mode on initial load if already on the forgot-password page
  if (window.location.hash.includes('forgot-password-page')) {
    applyResetMode(RESET_TOKEN);
  }

  // Re-apply on hash navigation
  window.addEventListener('hashchange', function () {
    if (window.location.hash.includes('forgot-password-page')) {
      applyResetMode(RESET_TOKEN);
    }
  });

  // Email-mode: enable button only when email is typed
  if (!RESET_TOKEN) {
    const resetEmailEl = document.getElementById('resetEmail');
    const resetBtnEl   = document.getElementById('resetSubmitBtn');
    if (resetEmailEl && resetBtnEl) {
      resetEmailEl.addEventListener('input', function () {
        resetBtnEl.disabled = resetEmailEl.value.trim() === '';
      });
    }
  }

  // ══════════════════════════════════════
  // SIGNUP
  // ══════════════════════════════════════
  if (signupForm) {
    signupForm.addEventListener('submit', function (e) {
      e.preventDefault();
      clearErrors();

      let isValid = true;
      if (!validateInput(usernameInput, usernameError, 'Username is required.')) isValid = false;
      if (!validateEmail(emailInput, emailError)) isValid = false;
      if (!validateInput(passwordInput, passwordError, 'Password is required.')) isValid = false;

      if (usernameInput && (
        usernameInput.value.length < 2 || usernameInput.value.length > 15 ||
        usernameInput.value.includes('@') || usernameInput.value.includes('.')
      )) { usernameError.textContent = 'Invalid name format or length'; isValid = false; }

      if (passwordInput && passwordInput.value.length < 6) {
        passwordError.textContent = 'Password must be at least 6 characters.'; isValid = false;
      }

      if (!isValid) {
        if (formMessage) formMessage.textContent = 'Please fix the errors above.';
        return;
      }

      showConfirm({
        title:   'Confirm Your Details',
        message: 'Please verify these details are correct before we create your account.',
        detail:  '<strong>USERNAME</strong>' + usernameInput.value.trim() +
                 '<strong>EMAIL</strong>'    + emailInput.value.trim(),
        yesText: 'Proceed with Signup',
        noText:  'Recheck Details',
        onConfirm: async function () {
          submitSignupBtn.disabled  = true;
          submitSignupBtn.innerText = 'Please Wait...';
          try {
            const res = await fetch('/api/auth/signup', {
              method: 'POST', credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                username:   usernameInput.value.trim(),
                email:      emailInput.value.trim(),
                password:   passwordInput.value,
                referrerId: (referralCodeInput && referralCodeInput.value) ? referralCodeInput.value : (refParam || null)
              })
            });
            const data = await res.json();
            if (data.success) {
              showAlert('Account created successfully! Please log in.', true);
              signupForm.reset();
              window.location.hash = '#login-page';
            } else {
              showAlert(data.error || 'Signup failed. Please try again.', false);
            }
          } catch (err) {
            showAlert('Network error. Please check your connection.', false);
          } finally {
            submitSignupBtn.disabled  = false;
            submitSignupBtn.innerText = 'SIGN UP →';
          }
        },
        onCancel: function () {}
      });
    });
  }

  // ══════════════════════════════════════
  // LOGIN
  // ══════════════════════════════════════
  if (loginForm) {
    loginForm.addEventListener('submit', function (e) {
      e.preventDefault();
      clearErrors();

      if (!validateEmail(loginEmailInput, loginEmailError)) return;
      if (!validateInput(loginPasswordInput, loginPasswordError, 'Password is required.')) return;

      const submitBtn = loginForm.querySelector('button[type="submit"]');

      showConfirm({
        title:   'Confirm Login',
        message: 'Are these details correct? Click Proceed to sign in.',
        detail:  '<strong>EMAIL</strong>' + loginEmailInput.value.trim(),
        yesText: 'Proceed to Login',
        noText:  'Recheck Details',
        onConfirm: async function () {
          submitBtn.disabled  = true;
          submitBtn.innerText = 'Signing in...';
          try {
            const res = await fetch('/api/auth/login', {
              method: 'POST', credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email:    loginEmailInput.value.trim(),
                password: loginPasswordInput.value
              })
            });
            const data = await res.json();
            if (data.success) {
              localStorage.setItem('loggedInUser', JSON.stringify({
                username: data.user.username,
                email:    data.user.email,
                userid:   data.user._id,
                uid:      data.user.uid || null,
                referrer: data.user.referrerId || null
              }));
              showAlert('Login successful!', true);
              loginForm.reset();
              setTimeout(() => { window.location.href = '/m1/index.html'; }, 1000);
            } else {
              showAlert(data.error || 'Login failed. Please check your credentials.', false);
            }
          } catch (err) {
            showAlert('Network error. Please check your connection.', false);
          } finally {
            submitBtn.disabled  = false;
            submitBtn.innerText = 'LOGIN →';
          }
        },
        onCancel: function () {}
      });
    });
  }

  // ══════════════════════════════════════
  // FORGOT PASSWORD / RESET PASSWORD
  // MODE A — no token:    sends reset email  → /api/auth/forgot-password
  // MODE B — token found: sets new password  → /api/auth/reset-password
  // ══════════════════════════════════════
  if (resetForm) {
    resetForm.addEventListener('submit', function (e) {
      e.preventDefault();

      // ── MODE B: token present — call doResetPassword directly ──
      // FIX: We call doResetPassword() directly instead of wrapping
      // it in showConfirm, which was silently failing when detail:''
      // caused the confirm sheet to not render its confirm button.
      if (RESET_TOKEN) {
        doResetPassword();
        return;
      }

      // ── MODE A: no token — send reset email ─────────────────────
      const submitBtn = document.getElementById('resetSubmitBtn');
      const email     = document.getElementById('resetEmail').value.trim();

      if (!email) {
        showAlert('Please enter your email address.', false);
        return;
      }

      showConfirm({
        title:   'Send Reset Link',
        message: 'We will email a password reset link to this address. Is it correct?',
        detail:  '<strong>EMAIL</strong>' + email,
        yesText: 'Yes, Send Link',
        noText:  'Recheck Email',
        onConfirm: async function () {
          submitBtn.disabled  = true;
          submitBtn.innerText = 'Sending...';
          try {
            const res = await fetch('/api/auth/forgot-password', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: email })
            });
            const data = await res.json();
            if (data.success) {
              showAlert('Reset link sent! Check your inbox or spam folder.', true);
              resetForm.reset();
              window.location.hash = '#login-page';
            } else {
              showAlert(data.error || 'Failed to send reset email.', false);
            }
          } catch (err) {
            showAlert('Network error. Try again later.', false);
          } finally {
            submitBtn.disabled  = false;
            submitBtn.innerText = 'Send Reset Link';
          }
        },
        onCancel: function () {}
      });
    });
  }

}); // end DOMContentLoaded

// ─── INIT ─────────────────────────────────────────────────
syncBranding();
checkSession();
