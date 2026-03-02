// ============================================================
// FLUX MALL - Account Script (No Firebase)
// All auth is handled via REST API calls to Node.js backend
// ============================================================

// ─── BRANDING & CONFIG ON LOAD ─────────────────────────────
async function syncBranding() {
  try {
    const res = await fetch('/api/user/config');
    const data = await res.json();
    if (!data.success) return;

    const { config, maintenance } = data;

    // Maintenance mode check
    if (maintenance?.enabled) {
      document.body.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;gap:16px;background:#0b1437;color:#fff">
          <h1 style="font-size:3rem">🛠️</h1>
          <h2>System Maintenance</h2>
          <p>We'll be back shortly.</p>
        </div>`;
      return;
    }

    // Site name
    if (config.siteName) {
      document.querySelectorAll('.site-name').forEach(el => el.innerText = config.siteName);
      document.title = `Account | ${config.siteName}`;
    }

    // Logo
    if (config.siteLogo) {
      document.querySelectorAll('.logo-img').forEach(img => img.src = config.siteLogo);
      let link = document.querySelector("link[rel~='icon']");
      if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
      link.href = config.siteLogo;
    }

    // Theme
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
    root.style.setProperty('--text-gary', '#a3adc2');
    root.style.setProperty('--input-bg', '#1b254b');
    root.style.setProperty('--border', 'rgba(255,255,255,0.1)');
  } else {
    root.style.setProperty('--right-panel-bg', '#f4f7fe');
    root.style.setProperty('--card-bg', '#ffffff');
    root.style.setProperty('--text-white', '#2b3674');
    root.style.setProperty('--text-gray', '#a3adc2');
    root.style.setProperty('--input-bg', '#f4f7fe');
    root.style.setProperty('--border', '#e0e5f2');
  }
}

// ─── SESSION CHECK ─────────────────────────────────────────
// If already logged in, redirect to dashboard
async function checkSession() {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    if (res.ok) {
      window.location.href = '/index.html';
    }
  } catch (err) {
    // No valid session, stay on login page
  }
}

// ─── REFERRER CHECK ────────────────────────────────────────
const urlParams = new URLSearchParams(window.location.search);
const refParam = urlParams.get('ref');
const tabParam = urlParams.get('tab');
const referralCodeInput = document.getElementById('referralCode');

if (refParam && referralCodeInput) {
  referralCodeInput.value = refParam;
  referralCodeInput.setAttribute('disabled', true);
  referralCodeInput.style.opacity = '.5';
  fetchReferrer(refParam);
}

async function fetchReferrer(refId) {
  try {
    const res = await fetch(`/api/auth/referrer/${refId}`);
    const data = await res.json();
    if (data.username) {
      document.getElementById('referrerName').innerText = data.username;
      document.getElementById('referrerSection').style.display = 'block';
    }
  } catch (err) {
    console.log('Referrer fetch failed:', err);
  }
}

// ─── VALIDATION HELPERS ────────────────────────────────────
function clearErrors() {
  ['usernameError','emailError','passwordError','formMessage',
   'loginEmailError','loginPasswordError','loginFormMessage'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '';
  });
}

function validateInput(input, errorElement, message) {
  if (!input || input.value.trim() === '') {
    if (errorElement) errorElement.textContent = message;
    return false;
  }
  if (errorElement) errorElement.textContent = '';
  return true;
}

function validateEmail(input, errorElement) {
  const email = input.value.trim();
  if (!email) { if (errorElement) errorElement.textContent = 'Email is required.'; return false; }
  if (!/\S+@\S+\.\S+/.test(email)) { if (errorElement) errorElement.textContent = 'Invalid email format.'; return false; }
  if (errorElement) errorElement.textContent = '';
  return true;
}

// ─── SIGNUP FORM ───────────────────────────────────────────
const signupForm = document.getElementById('signupForm');
if (signupForm) {
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();

    const usernameInput = document.getElementById('username');
    const emailInput    = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const usernameError = document.getElementById('usernameError');
    const emailError    = document.getElementById('emailError');
    const passwordError = document.getElementById('passwordError');
    const formMessage   = document.getElementById('formMessage');

    let isValid = true;
    if (!validateInput(usernameInput, usernameError, 'Username is required.')) isValid = false;
    if (!validateEmail(emailInput, emailError)) isValid = false;
    if (!validateInput(passwordInput, passwordError, 'Password is required.')) isValid = false;

    if (usernameInput && (usernameInput.value.length < 2 || usernameInput.value.length > 15 ||
        usernameInput.value.includes('@') || usernameInput.value.includes('.'))) {
      usernameError.textContent = 'Invalid Name format or length';
      isValid = false;
    }
    if (passwordInput && passwordInput.value.length < 6) {
      passwordError.textContent = 'Password must be at least 6 characters.';
      isValid = false;
    }
    if (!isValid) { if (formMessage) formMessage.textContent = 'Please fix the errors above.'; return; }

    const submitBtn = signupForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<div class="loader" style="height:20px;width:20px;display:inline-block"></div> Please Wait...`;

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          username: usernameInput.value.trim(),
          email: emailInput.value.trim(),
          password: passwordInput.value,
          referrerId: referralCodeInput?.value || refParam || null
        })
      });
      const data = await res.json();
      if (data.success) {
        showAlert('Account created successfully! Please log in.', true);
        signupForm.reset();
        window.location.hash = '#login-page';
      } else {
        showAlert(data.error || 'Signup failed.', false);
      }
    } catch (err) {
      showAlert('Network error. Please try again.', false);
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Create Account';
    }
  });
}

// ─── LOGIN FORM ────────────────────────────────────────────
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();

    const loginEmailInput    = document.getElementById('loginEmail');
    const loginPasswordInput = document.getElementById('loginPassword');
    const loginEmailError    = document.getElementById('loginEmailError');
    const loginPasswordError = document.getElementById('loginPasswordError');

    if (!validateEmail(loginEmailInput, loginEmailError)) return;
    if (!validateInput(loginPasswordInput, loginPasswordError, 'Password is required.')) return;

    const submitBtn = loginForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<div class="loader" style="height:20px;width:20px;display:inline-block"></div> Signing in...`;

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: loginEmailInput.value.trim(),
          password: loginPasswordInput.value
        })
      });
      const data = await res.json();
      if (data.success) {
        // Store minimal user info
        localStorage.setItem('loggedInUser', JSON.stringify({
          username: data.user.username,
          email: data.user.email,
          userid: data.user._id,
          referrer: data.user.referrerId || null
        }));
        showAlert('Login successful!', true);
        loginForm.reset();
        setTimeout(() => { window.location.href = '/index.html'; }, 1000);
      } else {
        showAlert(data.error || 'Login failed.', false);
      }
    } catch (err) {
      showAlert('Network error. Please try again.', false);
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Sign in';
    }
  });
}

// ─── FORGOT PASSWORD FORM ──────────────────────────────────
const resetForm = document.getElementById('resetForm');
if (resetForm) {
  resetForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const emailInput = document.getElementById('resetEmail');
    const submitBtn  = resetForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput.value.trim() })
      });
      const data = await res.json();
      if (data.success) {
        showAlert('A password reset link has been sent to your email. Check your inbox or spam.', true);
        resetForm.reset();
        window.location.hash = '#login-page';
      } else {
        showAlert(data.error || 'Failed to send reset email.', false);
      }
    } catch (err) {
      showAlert('Network error. Try again later.', false);
    } finally {
      submitBtn.disabled = false;
    }
  });
}

// ─── INIT ──────────────────────────────────────────────────
syncBranding();
checkSession();

// Enable submit buttons when inputs have content
document.querySelectorAll('form input').forEach(input => {
  input.addEventListener('input', () => {
    const form = input.closest('form');
    const btn = form?.querySelector('button[type="submit"]');
    if (btn) btn.disabled = false;
  });
});
