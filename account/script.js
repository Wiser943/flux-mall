// ============================================================
// FLUX MALL - Account Script (No Firebase)
// The inline <script> in account.html already declares:
// signupForm, loginForm, resetForm, urlParams, refParam,
// referralCodeInput, usernameInput, emailInput, passwordInput,
// loginEmailInput, loginPasswordInput, and all error elements,
// showAlert, showConfirm, showLoading, togglePassword,
// switchPageByHash — DO NOT redeclare any of these here!
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
      document.querySelectorAll('.site-name').forEach(function(el) { el.innerText = config.siteName; });
      document.title = 'Account | ' + config.siteName;
    }

    if (config.siteLogo) {
      document.querySelectorAll('.logo-img').forEach(function(img) { img.src = config.siteLogo; });
      var link = document.querySelector("link[rel~='icon']");
      if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
      link.href = config.siteLogo;
    }

    if (config.theme) applyTheme(config.theme);

  } catch (err) {
    console.log('Branding sync failed:', err);
  }
}

function applyTheme(theme) {
  var root = document.documentElement;
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
    var res = await fetch('/api/auth/me', { credentials: 'include' });
    if (res.ok) window.location.href = '/index.html';
  } catch (err) {}
}

// ─── REFERRER FETCH ───────────────────────────────────────
async function fetchReferrer(refId) {
  try {
    var res  = await fetch('/api/auth/referrer/' + refId);
    var data = await res.json();
    if (data.username) {
      var nameEl    = document.getElementById('referrerName');
      var sectionEl = document.getElementById('referrerSection');
      if (nameEl)    nameEl.innerText        = data.username;
      if (sectionEl) sectionEl.style.display = 'block';
    }
  } catch (err) {}
}

// ─── VALIDATION HELPERS ───────────────────────────────────
function clearErrors() {
  ['usernameError','emailError','passwordError','formMessage',
   'loginEmailError','loginPasswordError','loginFormMessage'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.textContent = '';
  });
}

function validateInput(input, errorEl, msg) {
  if (!input || input.value.trim() === '') { if (errorEl) errorEl.textContent = msg; return false; }
  if (errorEl) errorEl.textContent = '';
  return true;
}

function validateEmail(input, errorEl) {
  var email = input ? input.value.trim() : '';
  if (!email) { if (errorEl) errorEl.textContent = 'Email is required.'; return false; }
  if (!/\S+@\S+\.\S+/.test(email)) { if (errorEl) errorEl.textContent = 'Invalid email format.'; return false; }
  if (errorEl) errorEl.textContent = '';
  return true;
}

// ─── WIRE UP FORMS AFTER DOM READY ────────────────────────
// Uses variables already declared in the inline script
window.addEventListener('DOMContentLoaded', function() {

  // Fetch referrer name if ref param exists (refParam from inline script)
  if (typeof refParam !== 'undefined' && refParam) {
    fetchReferrer(refParam);
  }

  // Enable reset button when email is typed
  var resetEmailEl = document.getElementById('resetEmail');
  var resetBtnEl   = document.querySelector('#resetForm button[type="submit"]');
  if (resetEmailEl && resetBtnEl) {
    resetEmailEl.addEventListener('input', function() {
      resetBtnEl.disabled = resetEmailEl.value.trim() === '';
    });
  }

  // ── SIGNUP ──────────────────────────────────────────────
  if (signupForm) {
    signupForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      clearErrors();

      var isValid = true;
      if (!validateInput(usernameInput, usernameError, 'Username is required.')) isValid = false;
      if (!validateEmail(emailInput, emailError)) isValid = false;
      if (!validateInput(passwordInput, passwordError, 'Password is required.')) isValid = false;

      if (usernameInput && (
        usernameInput.value.length < 2 || usernameInput.value.length > 15 ||
        usernameInput.value.includes('@') || usernameInput.value.includes('.')
      )) { usernameError.textContent = 'Invalid Name format or length'; isValid = false; }

      if (passwordInput && passwordInput.value.length < 6) {
        passwordError.textContent = 'Password must be at least 6 characters.'; isValid = false;
      }
      if (!isValid) { if (formMessage) formMessage.textContent = 'Please fix the errors above.'; return; }

      submitSignupBtn.disabled  = true;
      submitSignupBtn.innerText = 'Please Wait...';

      try {
        var res = await fetch('/api/auth/signup', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username:   usernameInput.value.trim(),
            email:      emailInput.value.trim(),
            password:   passwordInput.value,
            referrerId: (referralCodeInput && referralCodeInput.value) ? referralCodeInput.value : (refParam || null)
          })
        });
        var data = await res.json();
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
        submitSignupBtn.innerText = 'Sign Up';
      }
    });
  }

  // ── LOGIN ────────────────────────────────────────────────
  if (loginForm) {
    loginForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      clearErrors();

      if (!validateEmail(loginEmailInput, loginEmailError)) return;
      if (!validateInput(loginPasswordInput, loginPasswordError, 'Password is required.')) return;

      var submitBtn   = loginForm.querySelector('button[type="submit"]');
      submitBtn.disabled  = true;
      submitBtn.innerText = 'Signing in...';

      try {
        var res = await fetch('/api/auth/login', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email:    loginEmailInput.value.trim(),
            password: loginPasswordInput.value
          })
        });
        var data = await res.json();
        if (data.success) {
          localStorage.setItem('loggedInUser', JSON.stringify({
            username: data.user.username,
            email:    data.user.email,
            userid:   data.user._id,
            referrer: data.user.referrerId || null
          }));
          showAlert('Login successful!', true);
          loginForm.reset();
          setTimeout(function() { window.location.href = '/index.html'; }, 1000);
        } else {
          showAlert(data.error || 'Login failed. Please check your credentials.', false);
        }
      } catch (err) {
        showAlert('Network error. Please check your connection.', false);
      } finally {
        submitBtn.disabled  = false;
        submitBtn.innerText = 'Sign in';
      }
    });
  }

  // ── FORGOT PASSWORD ──────────────────────────────────────
  if (resetForm) {
    resetForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      var email     = document.getElementById('resetEmail').value.trim();
      var submitBtn = resetForm.querySelector('button[type="submit"]');
      submitBtn.disabled  = true;
      submitBtn.innerText = 'Sending...';

      try {
        var res = await fetch('/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email })
        });
        var data = await res.json();
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
    });
  }

}); // end DOMContentLoaded

// ─── INIT ─────────────────────────────────────────────────
syncBranding();
checkSession();
