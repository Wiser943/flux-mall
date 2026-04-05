const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Resend } = require('resend');
const User = require('../models/User');
const { Settings } = require('../models/Models');
const { requireAuth } = require('../middleware/auth');

// ─── RESEND CLIENT ─────────────────────────────────────────
// Uses HTTPS (port 443) — works on Render free tier unlike Gmail SMTP
const resend = new Resend(process.env.RESEND_API_KEY);

// ─── HELPER: Send email fire-and-forget (non-blocking) ────
function sendEmail(to, subject, html) {
  resend.emails.send({
    from: process.env.EMAIL_FROM || 'Flux Mall <noreply@fluxmall.online>',
    to,
    subject,
    html
  }).then(() => {
    console.log(`[EMAIL] Sent to ${to}`);
  }).catch(err => {
    console.log(`[EMAIL] Resend failed:`, err.message);
  });
}


// ─── HELPER: Generate short unique uid ────────────────────
function generateUID() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let uid = '';
  for (let i = 0; i < 6; i++) uid += chars[Math.floor(Math.random() * chars.length)];
  return uid;
}

async function generateUniqueUID() {
  let uid, exists;
  do {
    uid = generateUID();
    exists = await User.findOne({ uid });
  } while (exists);
  return uid;
}

// ─── HELPER: set user cookie ───────────────────────────────
function setUserCookie(res, userId) {
  const token = jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '8h' });
  res.cookie('userSession', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: 8 * 60 * 60 * 1000
  });
  return token;
}

// ─── GET /api/auth/me ──────────────────────────────────────
router.get('/me', requireAuth, async (req, res) => {
  try {
    res.json({ success: true, user: req.user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/auth/signup ─────────────────────────────────
router.post('/signup', async (req, res) => {
  try {
    const { username, email, password, referrerId } = req.body;

    if (!username || !email || !password)
      return res.status(400).json({ error: 'All fields are required.' });
    if (username.length < 2 || username.length > 15 || username.includes('@') || username.includes('.'))
      return res.status(400).json({ error: 'Invalid username format.' });
    if (password.length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(400).json({ error: 'An account with this email already exists.' });

    const configDoc = await Settings.findOne({ key: 'config' });
    const initBal  = configDoc?.value?.initBal || 0;
    const siteName = configDoc?.value?.siteName || 'Flux Mall';

    const hashedPwd = await bcrypt.hash(password, 12);
    const uid = await generateUniqueUID();
    const user = await User.create({
      username,
      email: email.toLowerCase(),
      password: hashedPwd,
      ib: initBal,
      uid,
      referrerId: referrerId || null,
    });

    // Respond immediately — don't wait for email
    res.status(201).json({
      success: true,
      message: 'Account created successfully! Check your email to verify your account.'
    });

    // Send welcome + verification email (non-blocking)
    const verifyToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    const verifyUrl  = `${process.env.APP_URL}/api/auth/verify-email?token=${verifyToken}`;

    sendEmail(
      user.email,
      `Welcome to ${siteName} 🎉 — Verify Your Email`,
      `<!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { margin: 0; padding: 0; background: #f4f7fe; font-family: Arial, sans-serif; }
          .container { max-width: 560px; margin: 40px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
          .header { background: linear-gradient(135deg, #4318ff 0%, #868cff 100%); padding: 40px 32px; text-align: center; }
          .header h1 { color: #ffffff; font-size: 28px; margin: 0 0 8px; font-weight: 700; }
          .header p { color: rgba(255,255,255,0.85); font-size: 15px; margin: 0; }
          .body { padding: 36px 32px; }
          .greeting { font-size: 18px; font-weight: 600; color: #2b3674; margin-bottom: 12px; }
          .text { font-size: 15px; color: #6b7a99; line-height: 1.7; margin-bottom: 24px; }
          .btn { display: block; width: fit-content; margin: 0 auto 24px; padding: 14px 36px; background: linear-gradient(135deg, #4318ff, #868cff); color: #ffffff; text-decoration: none; border-radius: 10px; font-size: 16px; font-weight: 600; text-align: center; }
          .features { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 24px; }
          .feature { flex: 1; min-width: 120px; background: #f4f7fe; border-radius: 10px; padding: 14px; text-align: center; }
          .feature .icon { font-size: 24px; margin-bottom: 6px; }
          .feature .label { font-size: 12px; color: #6b7a99; font-weight: 500; }
          .warning { background: #fff8e6; border-left: 3px solid #f6ad55; border-radius: 8px; padding: 12px 16px; font-size: 13px; color: #7b5c00; margin-bottom: 24px; }
          .divider { height: 1px; background: #e8eaf6; margin: 24px 0; }
          .footer { background: #f4f7fe; padding: 20px 32px; text-align: center; }
          .footer p { font-size: 12px; color: #a3adc2; margin: 0; line-height: 1.8; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to ${siteName}! 🎉</h1>
            <p>Your account has been created successfully</p>
          </div>
          <div class="body">
            <p class="greeting">Hi ${username},</p>
            <p class="text">Thank you for joining <strong>${siteName}</strong>! Please verify your email to unlock all features.</p>
            <a href="${verifyUrl}" class="btn">✅ Verify My Email</a>
            <div class="features">
              <div class="feature"><div class="icon">💰</div><div class="label">Deposits & Withdrawals</div></div>
              <div class="feature"><div class="icon">🎡</div><div class="label">Spin Wheel</div></div>
              <div class="feature"><div class="icon">📈</div><div class="label">Investment Shares</div></div>
              <div class="feature"><div class="icon">👥</div><div class="label">Referral Rewards</div></div>
            </div>
            <div class="warning">⚠️ This link expires in <strong>24 hours</strong>. If you didn't sign up, ignore this email.</div>
            <div class="divider"></div>
            <p class="text" style="font-size:13px;">
              If the button doesn't work, paste this link in your browser:<br>
              <a href="${verifyUrl}" style="color:#4318ff;word-break:break-all;">${verifyUrl}</a>
            </p>
          </div>
          <div class="footer"><p>© ${new Date().getFullYear()} ${siteName}. All rights reserved.</p></div>
        </div>
      </body>
      </html>`
    );

  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Signup failed. Please try again.' });
  }
});

// ─── GET /api/auth/verify-email ────────────────────────────
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    await User.findByIdAndUpdate(decoded.id, { emailVerified: true });
    res.redirect(`${process.env.NETLIFY_URL || 'https://fluxmall.online'}/?verified=true`);
  } catch (err) {
    res.status(400).send(`
      <html><body style="font-family:Arial;text-align:center;padding:60px;background:#0b1437;color:#fff">
        <h2>❌ Invalid or Expired Link</h2>
        <p>This verification link has expired or is invalid.</p>
        <p>Please log in and request a new verification email.</p>
        <a href="https://fluxmall.online/account/account.html" style="color:#868cff">← Back to Login</a>
      </body></html>
    `);
  }
});

// ─── POST /api/auth/login ──────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required.' });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(400).json({ error: 'No account found with that email.' });

    if (user.status === 'Banned')
      return res.status(403).json({ error: '⛔ This account has been suspended. Contact support.' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      const newAttempts = (user.attempts || 0) + 1;
      if (newAttempts >= 3) {
        await User.findByIdAndUpdate(user._id, { attempts: newAttempts, status: 'Banned', banReason: '3 failed login attempts' });
        return res.status(403).json({ error: '⛔ Too many failed attempts. Your account is now suspended.' });
      }
      await User.findByIdAndUpdate(user._id, { attempts: newAttempts });
      return res.status(401).json({ error: `Incorrect password. ${3 - newAttempts} attempt(s) left before suspension.` });
    }

    await User.findByIdAndUpdate(user._id, { attempts: 0 });
    setUserCookie(res, user._id);

    res.json({
      success: true,
      message: 'Login successful!',
      user: { _id: user._id, uid: user.uid, username: user.username, email: user.email, emailVerified: user.emailVerified || false, referrerId: user.referrerId || null }
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

// ─── POST /api/auth/logout ─────────────────────────────────
router.post('/logout', (req, res) => {
  res.clearCookie('userSession', { httpOnly: true, secure: true, sameSite: 'none' });
  res.json({ success: true });
});

// ─── POST /api/auth/forgot-password ────────────────────────
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json({ error: 'No account found with that email.' });

    const resetToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const resetUrl  = `${process.env.NETLIFY_URL}/m2/index.html?token=${resetToken}#forgot-password-page`;

    res.json({ success: true, message: 'A password reset link has been sent to your email.' });

    sendEmail(
      user.email,
      'Password Reset — Flux Mall',
      `<!DOCTYPE html>
      <html>
      <head>
        <style>
          body { margin: 0; padding: 0; background: #f4f7fe; font-family: Arial, sans-serif; }
          .container { max-width: 520px; margin: 40px auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
          .header { background: linear-gradient(135deg, #ee5d50, #ff7c6e); padding: 36px; text-align: center; }
          .header h1 { color: #fff; margin: 0; font-size: 24px; }
          .body { padding: 32px; }
          .text { font-size: 15px; color: #6b7a99; line-height: 1.7; margin-bottom: 24px; }
          .btn { display: block; width: fit-content; margin: 0 auto 24px; padding: 14px 36px; background: linear-gradient(135deg, #ee5d50, #ff7c6e); color: #fff; text-decoration: none; border-radius: 10px; font-size: 16px; font-weight: 600; }
          .warning { background: #fff8e6; border-left: 3px solid #f6ad55; border-radius: 8px; padding: 12px 16px; font-size: 13px; color: #7b5c00; }
          .footer { background: #f4f7fe; padding: 20px; text-align: center; font-size: 12px; color: #a3adc2; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header"><h1>🔐 Password Reset</h1></div>
          <div class="body">
            <p class="text">Hi <strong>${user.username}</strong>,<br><br>Click below to reset your password.</p>
            <a href="${resetUrl}" class="btn">Reset My Password</a>
            <div class="warning">⚠️ Expires in <strong>1 hour</strong>. If you didn't request this, ignore this email.</div>
          </div>
          <div class="footer">© ${new Date().getFullYear()} Flux Mall. All rights reserved.</div>
        </div>
      </body>
      </html>`
    );

  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Failed to process request. Try again later.' });
  }
});

// ─── POST /api/auth/reset-password ─────────────────────────
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!newPassword || newPassword.length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const hashed  = await bcrypt.hash(newPassword, 12);
    await User.findByIdAndUpdate(decoded.id, { password: hashed, attempts: 0 });
    res.json({ success: true, message: 'Password reset successfully! You can now log in.' });
  } catch (err) {
    res.status(400).json({ error: 'Invalid or expired reset link.' });
  }
});

// ─── GET /api/auth/referrer/:id ────────────────────────────
// Supports both short uid (e.g. ZD7K2X) and legacy mongo _id
router.get('/referrer/:id', async (req, res) => {
  try {
    const id = req.params.id;
    // Try uid first (6-char short ID), fall back to mongo _id for old links
    let user = await User.findOne({ uid: id }).select('username uid');
    if (!user && id.length === 24) user = await User.findById(id).select('username uid');
    if (!user) return res.status(404).json({ error: 'Referrer not found.' });
    res.json({ username: user.username });
  } catch (err) {
    res.status(500).json({ error: 'Error fetching referrer.' });
  }
});

module.exports = router;
