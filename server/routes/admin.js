const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const {
  Deposit, Withdrawal, Notification, Activity,
  Share, PurchasedShare, Settings, DepositAmt
} = require('../models/Models');
const { requireAdmin } = require('../middleware/auth');

// ─── POST /api/admin/login ────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email.toLowerCase(), role: 'admin' });
    if (!user) return res.status(401).json({ error: 'Invalid admin credentials.' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: 'Invalid credentials.' });

    const token = jwt.sign({ id: user._id }, process.env.ADMIN_JWT_SECRET, { expiresIn: '8h' });
    res.cookie('adminSession', token, {
      httpOnly: true, sameSite: 'Strict', maxAge: 8 * 60 * 60 * 1000
    });

    res.json({ success: true, message: 'Admin login successful.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/admin/logout ───────────────────────────────
router.post('/logout', (req, res) => {
  res.clearCookie('adminSession');
  res.json({ success: true });
});

// ─── GET /api/admin/me ────────────────────────────────────
router.get('/me', requireAdmin, (req, res) => {
  res.json({ success: true, admin: req.user });
});

// ─── GET /api/admin/analytics ─────────────────────────────
router.get('/analytics', requireAdmin, async (req, res) => {
  try {
    const deposits = await Deposit.find().sort({ createdAt: -1 });
    const users = await User.find().select('_id username email status createdAt ib refPoints referrerId');

    let successV = 0, pendingV = 0, sCount = 0, pCount = 0, dCount = 0;
    let withdrawSuccessV = 0;

    deposits.forEach(d => {
      if (d.status === 'success') { successV += d.amount; sCount++; }
      else if (d.status === 'pending') { pendingV += d.amount; pCount++; }
      else dCount++;
    });

    const withdrawals = await Withdrawal.find({ status: 'success' });
    withdrawals.forEach(w => withdrawSuccessV += w.amount);

    res.json({
      success: true,
      stats: { successV, pendingV, sCount, pCount, dCount, totalUsers: users.length, withdrawSuccessV },
      deposits,
      users
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/admin/deposits ──────────────────────────────
router.get('/deposits', requireAdmin, async (req, res) => {
  try {
    const deposits = await Deposit.find().sort({ createdAt: -1 }).populate('userId', 'username email');
    res.json({ success: true, deposits });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT /api/admin/deposits/:id ─────────────────────────
// Approve or decline a deposit
router.put('/deposits/:id', requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const deposit = await Deposit.findById(req.params.id);
    if (!deposit) return res.status(404).json({ error: 'Deposit not found.' });

    deposit.status = status;
    await deposit.save();

    if (status === 'success') {
      await User.findByIdAndUpdate(deposit.userId, { $inc: { ib: deposit.amount } });
      await Notification.create({
        userId: deposit.userId,
        title: '💰 Wallet Credited',
        message: `Wallet credited with ₦${Number(deposit.amount).toLocaleString()}`
      });

      // Handle referral commission
      await handleReferralCommission(deposit.userId.toString(), deposit.amount, deposit._id.toString());
    }

    if (status === 'declined') {
      await Notification.create({
        userId: deposit.userId,
        title: '❌ Deposit Declined',
        message: `Your deposit of ₦${Number(deposit.amount).toLocaleString()} was declined.`
      });
    }

    res.json({ success: true, message: `Deposit ${status} successfully.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/admin/deposits/:id ──────────────────────
router.delete('/deposits/:id', requireAdmin, async (req, res) => {
  try {
    await Deposit.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/admin/withdrawals ───────────────────────────
router.get('/withdrawals', requireAdmin, async (req, res) => {
  try {
    const withdrawals = await Withdrawal.find().sort({ createdAt: -1 });
    res.json({ success: true, withdrawals });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT /api/admin/withdrawals/:id ──────────────────────
router.put('/withdrawals/:id', requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const withdrawal = await Withdrawal.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!withdrawal) return res.status(404).json({ error: 'Withdrawal not found.' });

    // If declined, refund the user
    if (status === 'declined') {
      await User.findByIdAndUpdate(withdrawal.userId, { $inc: { ib: withdrawal.amount } });
      await Notification.create({
        userId: withdrawal.userId,
        title: '❌ Withdrawal Declined',
        message: `Your withdrawal of ₦${withdrawal.amount.toLocaleString()} was declined. Balance restored.`
      });
    } else if (status === 'success') {
      await Notification.create({
        userId: withdrawal.userId,
        title: '✅ Withdrawal Approved',
        message: `Your withdrawal of ₦${withdrawal.netAmount?.toLocaleString()} has been sent.`
      });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/admin/withdrawals/:id ───────────────────
router.delete('/withdrawals/:id', requireAdmin, async (req, res) => {
  try {
    await Withdrawal.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/admin/users ─────────────────────────────────
router.get('/users', requireAdmin, async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    const deposits = await Deposit.find();

    // Build stats map
    const statsMap = {};
    deposits.forEach(d => {
      const uid = d.userId.toString();
      if (!statsMap[uid]) statsMap[uid] = { count: 0, total: 0 };
      statsMap[uid].count++;
      statsMap[uid].total += d.amount;
    });

    const usersWithStats = users.map(u => ({
      ...u.toObject(),
      transCount: statsMap[u._id.toString()]?.count || 0,
      transTotal: statsMap[u._id.toString()]?.total || 0
    }));

    res.json({ success: true, users: usersWithStats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/admin/users/:id ────────────────────────────
router.get('/users/:id', requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found.' });
    const deposits = await Deposit.find({ userId: user._id });
    const withdrawals = await Withdrawal.find({ userId: user._id });
    res.json({ success: true, user, deposits, withdrawals });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT /api/admin/users/:id ────────────────────────────
router.put('/users/:id', requireAdmin, async (req, res) => {
  try {
    const { status, ib, username } = req.body;
    const update = {};
    if (status !== undefined) update.status = status;
    if (ib !== undefined) update.ib = Number(ib);
    if (username) update.username = username;

    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true }).select('-password');
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/admin/users/adjust-balance ─────────────────
router.post('/users/adjust-balance', requireAdmin, async (req, res) => {
  try {
    const { userId, amount, action } = req.body; // action: 'credit' | 'debit'
    const change = action === 'credit' ? Number(amount) : -Number(amount);
    const user = await User.findByIdAndUpdate(userId, { $inc: { ib: change } }, { new: true }).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found.' });

    await Activity.create({ userId, type: action, amount, desc: `Admin ${action}` });
    await Notification.create({
      userId,
      title: action === 'credit' ? '💰 Balance Credited' : '💸 Balance Debited',
      message: `Admin ${action}ed ₦${Number(amount).toLocaleString()} ${action === 'credit' ? 'to' : 'from'} your account.`
    });

    res.json({ success: true, newBalance: user.ib });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/admin/create-user ─────────────────────────
router.post('/create-user', requireAdmin, async (req, res) => {
  try {
    const { username, email, password, role } = req.body;
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(400).json({ error: 'Email already in use.' });

    const hashed = await bcrypt.hash(password, 12);
    const user = await User.create({ username, email: email.toLowerCase(), password: hashed, role: role || 'user' });
    res.json({ success: true, user: { ...user.toObject(), password: undefined } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/admin/users/:id ─────────────────────────
// Cascade deletes user + ALL related documents across collections
router.delete('/users/:id', requireAdmin, async (req, res) => {
  try {
    const uid = req.params.id;

    await Promise.all([
      User.findByIdAndDelete(uid),
      Deposit.deleteMany({ userId: uid }),
      Withdrawal.deleteMany({ userId: uid }),
      Activity.deleteMany({ userId: uid }),
      Notification.deleteMany({ userId: uid }),
      PurchasedShare.deleteMany({ userId: uid }),
    ]);

    res.json({ success: true, message: 'User and all related data deleted.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ─── GET /api/admin/settings ─────────────────────────────
router.get('/settings', requireAdmin, async (req, res) => {
  try {
    const all = await Settings.find();
    const result = {};
    all.forEach(s => result[s.key] = s.value);
    res.json({ success: true, settings: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ─── UPDATED PUT /api/admin/settings/:key ────────────────
router.put('/settings/:key', requireAdmin, async (req, res) => {
  try {
    const { key } = req.params;
    const incomingData = req.body;
    
    // Create an update object using dot notation
    // This tells MongoDB: "Go into 'value' and only change the fields I sent"
    const updateObj = {};
    for (const field in incomingData) {
      updateObj[`value.${field}`] = incomingData[field];
    }

    await Settings.findOneAndUpdate(
      { key }, 
      { $set: updateObj }, // Use $set to only update specific fields
      { upsert: true, new: true }
    );

    res.json({ success: true, message: `Settings "${key}" updated.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ─── SHARES MANAGEMENT ────────────────────────────────────
router.get('/shares', requireAdmin, async (req, res) => {
  try {
    const shares = await Share.find().sort({ price: 1 });
    res.json({ success: true, shares });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/shares', requireAdmin, async (req, res) => {
  try {
    const share = await Share.create(req.body);
    res.json({ success: true, share });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/shares/:id', requireAdmin, async (req, res) => {
  try {
    const share = await Share.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, share });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/shares/:id', requireAdmin, async (req, res) => {
  try {
    await Share.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DEPOSIT AMOUNTS ──────────────────────────────────────
router.get('/deposit-amounts', requireAdmin, async (req, res) => {
  try {
    const amounts = await DepositAmt.find().sort({ amount: 1 });
    res.json({ success: true, amounts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/deposit-amounts', requireAdmin, async (req, res) => {
  try {
    const amt = await DepositAmt.create({ amount: req.body.amount });
    res.json({ success: true, amt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/deposit-amounts/:id', requireAdmin, async (req, res) => {
  try {
    await DepositAmt.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── REFERRAL COMMISSION HELPER ───────────────────────────
async function handleReferralCommission(depositorUid, depositAmount, tid) {
  try {
    const config = await Settings.findOne({ key: 'config' });
    let rates = [15, 4, 2];
    if (config?.value?.referralPercents) rates = config.value.referralPercents;

    const L1 = (rates[0] || 0) / 100;
    const L2 = (rates[1] || 0) / 100;
    const L3 = (rates[2] || 0) / 100;

    const user = await User.findById(depositorUid);
    if (!user || user.hasDeposited) return;

    await User.findByIdAndUpdate(depositorUid, { hasDeposited: true });

    const payReferrer = async (uid, bonus, level) => {
      await User.findByIdAndUpdate(uid, { $inc: { ib: bonus, refPoints: bonus } });
      console.log(`✅ ${level} Bonus of ₦${bonus} sent to ${uid}`);
    };

    if (user.referrerId) {
      const l1User = await User.findById(user.referrerId);
      if (l1User) {
        await payReferrer(l1User._id, depositAmount * L1, 'Level 1');
        if (l1User.referrerId) {
          const l2User = await User.findById(l1User.referrerId);
          if (l2User) {
            await payReferrer(l2User._id, depositAmount * L2, 'Level 2');
            if (l2User.referrerId) {
              const l3User = await User.findById(l2User.referrerId);
              if (l3User) await payReferrer(l3User._id, depositAmount * L3, 'Level 3');
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('Referral Commission Error:', err);
  }
}

// GET /api/admin/settings/apikeys
router.get('/settings/apikeys', requireAdmin, async (req, res) => {
  try {
    const doc = await Settings.findOne({ key: 'apikeys' });
    res.json({ success: true, apikeys: doc?.value || {} });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/settings/apikeys
router.put('/settings/apikeys', requireAdmin, async (req, res) => {
  try {
    const { imgbb, korapay_public, korapay_secret } = req.body;
    await Settings.findOneAndUpdate(
      { key: 'apikeys' },
      { key: 'apikeys', value: { imgbb, korapay_public, korapay_secret } },
      { upsert: true, new: true }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
