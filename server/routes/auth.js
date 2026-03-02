const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const User = require('../models/User');
const { Settings } = require('../models/Models');
const { requireAuth } = require('../middleware/auth');

// ─── EMAIL TRANSPORTER ─────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

// ─── HELPER: set user cookie ───────────────────────────────
function setUserCookie(res, userId) {
  const token = jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '8h' });
  res.cookie('userSession', token, {
    httpOnly: true,
    sameSite: 'Strict',
    maxAge: 8 * 60 * 60 * 1000 // 8 hours
  });
  return token;
}

// ─── GET /api/auth/me ──────────────────────────────────────
// Check current session and return user data
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

    // Validation
    if (!username || !email || !password)
      return res.status(400).json({ error: 'All fields are required.' });
    if (username.length < 2 || username.length > 15 || username.includes('@') || username.includes('.'))
      return res.status(400).json({ error: 'Invalid username format.' });
    if (password.length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });

    // Check existing user
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(400).json({ error: 'An account with this email already exists.' });

    // Get initial balance from settings
    const configDoc = await Settings.findOne({ key: 'config' });
    const initBal = configDoc?.value?.initBal || 0;

    // Hash password
    const hashedPwd = await bcrypt.hash(password, 12);

    // Create user
    const user = await User.create({
      username,
      email: email.toLowerCase(),
      password: hashedPwd,
      ib: initBal,
      referrerId: referrerId || null,
    });

    // Send verification email
    const verifyToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    const verifyUrl = `${process.env.APP_URL}/api/auth/verify-email?token=${verifyToken}`;
    try {
      await transporter.sendMail({
        from: `"Flux Mall" <${process.env.EMAIL_USER}>`,
        to: user.email,
        subject: 'Verify your email - Flux Mall',
        html: `<p>Click the link below to verify your email:</p>
               <a href="${verifyUrl}">${verifyUrl}</a>
               <p>This link expires in 24 hours.</p>`
      });
    } catch (e) {
      console.log('Email send failed (non-critical):', e.message);
    }

    res.status(201).json({ success: true, message: 'Account created! Please log in.' });

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
    res.redirect('/?verified=true');
  } catch (err) {
    res.status(400).send('Invalid or expired verification link.');
  }
});

// ─── POST /api/auth/login ──────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required.' });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(400).json({ error: 'No user found with that email.' });

    // Check ban
    if (user.status === 'Banned')
      return res.status(403).json({ error: '⛔ This account has been Banned due to security violations.' });

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      const newAttempts = (user.attempts || 0) + 1;
      if (newAttempts >= 3) {
        await User.findByIdAndUpdate(user._id, {
          attempts: newAttempts, status: 'Banned', banReason: '3 failed login attempts'
        });
        return res.status(403).json({ error: '⛔ Too many failed attempts. Your account is now BANNED.' });
      } else {
        await User.findByIdAndUpdate(user._id, { attempts: newAttempts });
        return res.status(401).json({ error: `Invalid password. ${3 - newAttempts} attempts left before ban.` });
      }
    }

    // Reset attempts on success
    await User.findByIdAndUpdate(user._id, { attempts: 0 });

    // Set cookie
    const token = setUserCookie(res, user._id);

    res.json({
      success: true,
      message: 'Login successful!',
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        referrerId: user.referrerId || null
      }
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

// ─── POST /api/auth/logout ─────────────────────────────────
router.post('/logout', (req, res) => {
  res.clearCookie('userSession');
  res.json({ success: true });
});

// ─── POST /api/auth/forgot-password ────────────────────────
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json({ error: "This Email isn't registered yet." });

    const resetToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const resetUrl = `${process.env.APP_URL}/account/account.html#reset-password?token=${resetToken}`;

    await transporter.sendMail({
      from: `"Flux Mall" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: 'Password Reset - Flux Mall',
      html: `<p>You requested a password reset. Click the link below:</p>
             <a href="${resetUrl}">${resetUrl}</a>
             <p>This link expires in 1 hour. If you didn't request this, ignore this email.</p>`
    });

    res.json({ success: true, message: 'A password reset link has been sent to your email.' });

  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Failed to send reset email. Try again later.' });
  }
});

// ─── POST /api/auth/reset-password ────────────────────────
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!newPassword || newPassword.length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const hashed = await bcrypt.hash(newPassword, 12);
    await User.findByIdAndUpdate(decoded.id, { password: hashed, attempts: 0 });

    res.json({ success: true, message: 'Password reset successfully. You can now log in.' });
  } catch (err) {
    res.status(400).json({ error: 'Invalid or expired reset link.' });
  }
});

// ─── GET /api/auth/referrer/:id ────────────────────────────
router.get('/referrer/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('username');
    if (!user) return res.status(404).json({ error: 'Referrer not found.' });
    res.json({ username: user.username });
  } catch (err) {
    res.status(500).json({ error: 'Error fetching referrer.' });
  }
});

module.exports = router;
