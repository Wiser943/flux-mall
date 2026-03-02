const jwt = require('jsonwebtoken');
const User = require('../models/User');

// ─── USER AUTH MIDDLEWARE ───────────────────────────────────
const requireAuth = async (req, res, next) => {
  try {
    const token = req.cookies?.userSession || req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized. Please log in.' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user) return res.status(401).json({ error: 'User not found.' });
    if (user.status === 'Banned') return res.status(403).json({ error: 'Account banned.' });

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
  }
};

// ─── ADMIN AUTH MIDDLEWARE ──────────────────────────────────
const requireAdmin = async (req, res, next) => {
  try {
    const token = req.cookies?.adminSession || req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized.' });

    const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user || user.role !== 'admin') return res.status(403).json({ error: 'Admin access required.' });

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired admin session.' });
  }
};

module.exports = { requireAuth, requireAdmin };
