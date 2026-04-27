const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Resend } = require('resend');
const User = require('../models/User');
const {
  Deposit,
  Withdrawal,
  Notification,
  Activity,
  Share,
  PurchasedShare,
  Settings,
  DepositAmt,
  ChatSession,
  ChatMessage,
  Typing,
  Task,
  UserCampaign,
  UserCampaignSubmission,
  TaskSubmission,
} = require('../models/Models');
const { requireAdmin } = require('../middleware/auth');

// ─── RESEND CLIENT ─────────────────────────────────────────
const resend = new Resend(process.env.RESEND_API_KEY);

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
      httpOnly: true,
      sameSite: 'Strict',
      maxAge: 8 * 60 * 60 * 1000
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
  console.log('[ADMIN ME] req.user:', req.user);
  res.json({ success: true, admin: req.user });
});

// ─── GET /api/admin/analytics ─────────────────────────────
router.get('/analytics', requireAdmin, async (req, res) => {
  try {
    const deposits = await Deposit.find().sort({ createdAt: -1 });
    const users = await User.find().select('_id username email status createdAt ib refPoints referrerId');
    
    let successV = 0,
      pendingV = 0,
      sCount = 0,
      pCount = 0,
      dCount = 0;
    let withdrawSuccessV = 0;
    
    deposits.forEach(d => {
      if (d.status === 'success') {
        successV += d.amount;
        sCount++;
      }
      else if (d.status === 'pending') {
        pendingV += d.amount;
        pCount++;
      }
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

// ─── GET /api/admin/tasks ─────────────────────────────────
// All tasks with completion counts
router.get('/tasks', requireAdmin, async (req, res) => {
  try {
    const tasks = await Task.find().sort({ createdAt: -1 });
    
    // Count completions per task
    const counts = await TaskSubmission.aggregate([
      { $group: { _id: '$taskId', total: { $sum: 1 }, approved: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } }, pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } } } }
    ]);
    const countMap = {};
    counts.forEach(c => { countMap[c._id.toString()] = c; });
    
    const tasksWithStats = tasks.map(t => ({
      ...t.toObject(),
      totalSubmissions: countMap[t._id.toString()]?.total || 0,
      approvedCount: countMap[t._id.toString()]?.approved || 0,
      pendingCount: countMap[t._id.toString()]?.pending || 0,
    }));
    
    res.json({ success: true, tasks: tasksWithStats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/admin/tasks ────────────────────────────────
// Create a new task
router.post('/tasks', requireAdmin, async (req, res) => {
  try {
    const { title, description, instructions, points, category, proofType, expiresAt, maxCompletions, taskLink, platform } = req.body;
    if (!title || !description || !points)
      return res.status(400).json({ error: 'Title, description and points are required.' });
    
    const task = await Task.create({
      title,
      description,
      instructions: instructions || '',
      points: Number(points),
      category: category || 'General',
      proofType: proofType || 'screenshot',
      expiresAt: expiresAt || null,
      maxCompletions: Number(maxCompletions) || 0,
      taskLink: taskLink || '',
      platform: platform || '',
      active: true,
    });
    
    res.json({ success: true, task });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT /api/admin/tasks/:id ─────────────────────────────
// Edit / toggle active status
router.put('/tasks/:id', requireAdmin, async (req, res) => {
  try {
    const task = await Task.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!task) return res.status(404).json({ error: 'Task not found.' });
    res.json({ success: true, task });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/admin/tasks/:id ──────────────────────────
router.delete('/tasks/:id', requireAdmin, async (req, res) => {
  try {
    await Task.findByIdAndDelete(req.params.id);
    await TaskSubmission.deleteMany({ taskId: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/admin/tasks/submissions ─────────────────────
// All submissions across all tasks — with optional filters
router.get('/tasks/submissions', requireAdmin, async (req, res) => {
  try {
    const { status, taskId, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (status && status !== 'all') filter.status = status;
    if (taskId) filter.taskId = taskId;
    
    const skip = (Number(page) - 1) * Number(limit);
    const [submissions, total] = await Promise.all([
      TaskSubmission.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate('userId', 'username email ib')
      .populate('taskId', 'title points category'),
      TaskSubmission.countDocuments(filter),
    ]);
    
    res.json({ success: true, submissions, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/admin/activity/clear-all ────────────────
// Permanently delete all activity logs
router.delete('/activity/clear-all', requireAdmin, async (req, res) => {
  try {
    // Deletes all documents in the Activity collection
    await Activity.deleteMany({});
    
    res.json({
      success: true,
      message: 'All activity logs cleared successfully.'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ─── PUT /api/admin/tasks/submissions/:id ─────────────────
// Approve or decline a submission
router.put('/tasks/submissions/:id', requireAdmin, async (req, res) => {
  try {
    const { status, adminNote } = req.body;
    if (!['approved', 'declined'].includes(status))
      return res.status(400).json({ error: 'Status must be approved or declined.' });
    
    const submission = await TaskSubmission.findById(req.params.id)
      .populate('userId', 'username email ib')
      .populate('taskId', 'title points');
    
    if (!submission) return res.status(404).json({ error: 'Submission not found.' });
    if (submission.status !== 'pending')
      return res.status(400).json({ error: 'Submission already reviewed.' });
    
    submission.status = status;
    submission.adminNote = adminNote || '';
    submission.reviewedAt = new Date();
    
    if (status === 'approved') {
      // Credit user with task points
      const points = submission.points || submission.taskId?.points || 0;
      await User.findByIdAndUpdate(submission.userId._id, { $inc: { ib: points } });
      
      await Activity.create({
        userId: submission.userId._id,
        type: 'Task',
        amount: points,
        desc: `Task approved: ${submission.taskId?.title || 'Task'}`,
      });
      
      await Notification.create({
        userId: submission.userId._id,
        title: '✅ Task Approved!',
        message: `Your submission for "${submission.taskId?.title}" was approved. 🪙${points} FEX credited!`,
      });
      
    } else {
      // Declined — deduct 5% penalty from user balance
      const userBalance = submission.userId.ib || 0;
      const penalty = parseFloat((userBalance * 0.05).toFixed(2));
      
      submission.penalty = penalty;
      
      if (penalty > 0) {
        await User.findByIdAndUpdate(submission.userId._id, { $inc: { ib: -penalty } });
        
        await Activity.create({
          userId: submission.userId._id,
          type: 'Task Penalty',
          amount: penalty,
          desc: `5% penalty — task declined: ${submission.taskId?.title || 'Task'}`,
        });
      }
      
      await Notification.create({
        userId: submission.userId._id,
        title: '❌ Task Declined',
        message: `Your submission for "${submission.taskId?.title}" was declined.${penalty > 0 ? ` 🪙${penalty} FEX (5%) deducted.` : ''} ${adminNote ? `Reason: ${adminNote}` : ''}`,
      });
    }
    
    await submission.save();
    res.json({ success: true, submission });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/admin/tasks/submissions/:id ──────────────
router.delete('/tasks/submissions/:id', requireAdmin, async (req, res) => {
  try {
    await TaskSubmission.findByIdAndDelete(req.params.id);
    res.json({ success: true });
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
// ─── PUT /api/admin/deposits/:id ─────────────────────────
router.put('/deposits/:id', requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const deposit = await Deposit.findById(req.params.id);
    if (!deposit) return res.status(404).json({ error: 'Deposit not found.' });
    
    deposit.status = status;
    await deposit.save();
    
    if (status === 'success') {
      await User.findByIdAndUpdate(deposit.userId, { $inc: { ib: deposit.amount } });
      
      await Activity.create({
        userId: deposit.userId,
        type: 'Deposit',
        amount: deposit.amount,
        desc: 'Deposit approved by admin'
      });
      
      await Notification.create({
        userId: deposit.userId,
        title: '💰 Deposit Approved!',
        message: `Your deposit of 🪙${Number(deposit.amount).toLocaleString()} FEX has been approved and credited to your wallet.`
      });
      
      // Handle referral commission + first deposit flat bonus
      await handleReferralCommission(deposit.userId.toString(), deposit.amount, deposit._id.toString());
    }
    
    if (status === 'declined') {
      await Notification.create({
        userId: deposit.userId,
        title: '❌ Deposit Declined',
        message: `Your deposit of 🪙${Number(deposit.amount).toLocaleString()} FEX was declined. Please contact support.`
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

// GET all purchased shares (all users)
router.get('/purchased-shares', requireAdmin, async (req, res) => {
  try {
    const investments = await PurchasedShare.find()
      .sort({ createdAt: -1 })
      .populate('userId', 'username email');
    res.json({ success: true, investments });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE a specific purchased share by ID
router.delete('/purchased-shares/:id', requireAdmin, async (req, res) => {
  try {
    await PurchasedShare.findByIdAndDelete(req.params.id);
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


// ─── GET /api/admin/activity ──────────────────────────────
// All users activity logs, newest first
router.get('/activity', requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50, type, userId } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    
    // Build filter — optional type and userId filters
    const filter = {};
    if (type) filter.type = type;
    if (userId) filter.userId = userId;
    
    const [activity, total] = await Promise.all([
      Activity.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate('userId', 'username email'),
      Activity.countDocuments(filter)
    ]);
    
    res.json({
      success: true,
      activity,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/admin/activity/:userId ─────────────────────
// Single user's full activity history
router.get('/activity/:userId', requireAdmin, async (req, res) => {
  try {
    const activity = await Activity.find({ userId: req.params.userId })
      .sort({ createdAt: -1 });
    
    res.json({ success: true, activity });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/admin/activity/:id ──────────────────────
// Delete a single activity log entry
router.delete('/activity/:id', requireAdmin, async (req, res) => {
  try {
    await Activity.findByIdAndDelete(req.params.id);
    res.json({ success: true });
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
    
    await Settings.findOneAndUpdate({ key }, { $set: updateObj }, // Use $set to only update specific fields
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
    if (!user) return;
    
    // ─── FLAT REFERRAL BONUS ON FIRST DEPOSIT ─────────────
    // Fires once: email verified + has referrer + not yet completed
    if (
      !user.referralCompleted &&
      user.emailVerified &&
      user.referrerId
    ) {
      const referralBonus = config?.value?.referralBonus || 840; // ~₦1200 at ₦0.7/FEX
      
      // Credit the referrer
      await User.findByIdAndUpdate(user.referrerId, {
        $inc: { ib: referralBonus }
      });
      
      // Mark referral as completed so it never fires again
      await User.findByIdAndUpdate(depositorUid, {
        referralCompleted: true
      });
      
      await Activity.create({
        userId: user.referrerId,
        type: 'Referral',
        amount: referralBonus,
        desc: `Referral bonus — ${user.username} made their first deposit`
      });
      
      await Notification.create({
        userId: user.referrerId,
        title: '🎉 Referral Bonus Credited!',
        message: `${user.username} just made their first deposit! 🪙${Number(referralBonus).toLocaleString()} FEX has been added to your balance.`
      });
      
      console.log(`✅ Flat referral bonus of 🪙${referralBonus} sent to referrer ${user.referrerId}`);
    }
    // ──────────────────────────────────────────────────────
    
    // ─── PERCENTAGE COMMISSION (existing logic) ────────────
    // Only fires on the very first deposit (hasDeposited guard)
    if (user.hasDeposited) return;
    await User.findByIdAndUpdate(depositorUid, { hasDeposited: true });
    
    const payReferrer = async (uid, bonus, level) => {
      await User.findByIdAndUpdate(uid, { $inc: { ib: bonus, refPoints: bonus } });
      console.log(`✅ ${level} Bonus of 🪙${bonus} sent to ${uid}`);
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
    // ──────────────────────────────────────────────────────
    
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
    await Settings.findOneAndUpdate({ key: 'apikeys' }, { key: 'apikeys', value: { imgbb, korapay_public, korapay_secret } }, { upsert: true, new: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
// ADMIN CHAT ROUTES
// ═══════════════════════════════════════════════════════════

// ─── GET /api/admin/chat/sessions ────────────────────────
router.get('/chat/sessions', requireAdmin, async (req, res) => {
  try {
    const sessions = await ChatSession.find().sort({ lastMessageAt: -1 }).populate('userId', 'username email ib status emailVerified createdAt refPoints referrerId');
    res.json({ success: true, sessions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/admin/chat/messages/:sessionId ─────────────
router.get('/chat/messages/:sessionId', requireAdmin, async (req, res) => {
  try {
    const messages = await ChatMessage.find({ sessionId: req.params.sessionId }).sort({ createdAt: 1 });
    // Mark user messages as read
    await ChatMessage.updateMany({ sessionId: req.params.sessionId, sender: 'user', read: false }, { read: true });
    await ChatSession.findByIdAndUpdate(req.params.sessionId, { unreadAdmin: 0 });
    res.json({ success: true, messages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/admin/chat/send ────────────────────────────
router.post('/chat/send', requireAdmin, async (req, res) => {
  try {
    const { sessionId, content, type, imageUrl, polarQuestion, replyTo } = req.body;
    if (!sessionId) return res.status(400).json({ error: 'sessionId required.' });
    
    const msg = await ChatMessage.create({
      sessionId,
      sender: 'admin',
      type: type || 'text',
      content: content || '',
      imageUrl: imageUrl || '',
      polarQuestion: polarQuestion || '',
      replyTo: replyTo || {},
    });
    
    const preview = type === 'image' ? '📷 Image' : type === 'polar' ? `❓ ${polarQuestion}` : content?.substring(0, 60) || '';
    await ChatSession.findByIdAndUpdate(sessionId, {
      lastMessage: preview,
      lastMessageAt: new Date(),
      $inc: { unreadUser: 1 }
    });
    
    res.json({ success: true, message: msg });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/admin/chat/session/:id ──────────────────
router.delete('/chat/session/:id', requireAdmin, async (req, res) => {
  try {
    await ChatMessage.deleteMany({ sessionId: req.params.id });
    await ChatSession.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT /api/admin/chat/session/:id/end ─────────────────
router.put('/chat/session/:id/end', requireAdmin, async (req, res) => {
  try {
    await ChatSession.findByIdAndUpdate(req.params.id, { status: 'ended' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/admin/chat/unread ───────────────────────────
router.get('/chat/unread', requireAdmin, async (req, res) => {
  try {
    const result = await ChatSession.aggregate([
      { $group: { _id: null, total: { $sum: '$unreadAdmin' } } }
    ]);
    res.json({ success: true, unread: result[0]?.total || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/admin/chat/settings ────────────────────────
router.get('/chat/settings', requireAdmin, async (req, res) => {
  try {
    const doc = await Settings.findOne({ key: 'chat' });
    res.json({ success: true, settings: doc?.value || {} });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT /api/admin/chat/settings ────────────────────────
router.put('/chat/settings', requireAdmin, async (req, res) => {
  try {
    const { available, autoReply, officeHours, sound, allowImages, autoClose, maxImageSize, requireVerified, charLimit } = req.body;
    await Settings.findOneAndUpdate({ key: 'chat' }, { key: 'chat', value: { available, autoReply, officeHours, sound, allowImages, autoClose, maxImageSize, requireVerified, charLimit } }, { upsert: true, new: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ─── POST /api/admin/chat/typing ─────────────────────────
router.post('/chat/typing', requireAdmin, async (req, res) => {
  try {
    const { sessionId } = req.body;
    await Typing.findOneAndUpdate({ sessionId, sender: 'admin' }, { sessionId, sender: 'admin', updatedAt: new Date() }, { upsert: true });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── GET /api/admin/chat/typing/:sessionId ────────────────
router.get('/chat/typing/:sessionId', requireAdmin, async (req, res) => {
  try {
    const t = await Typing.findOne({ sessionId: req.params.sessionId, sender: 'user' });
    const isTyping = t && (Date.now() - new Date(t.updatedAt).getTime() < 4000);
    res.json({ typing: !!isTyping });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── POST /api/admin/chat/react ───────────────────────────
router.post('/chat/react', requireAdmin, async (req, res) => {
  try {
    const { msgId, emoji } = req.body;
    const msg = await ChatMessage.findById(msgId);
    if (!msg) return res.status(404).json({ error: 'Message not found.' });
    const reactions = msg.reactions || {};
    if (!reactions[emoji]) reactions[emoji] = [];
    const idx = reactions[emoji].indexOf('admin');
    if (idx > -1) reactions[emoji].splice(idx, 1);
    else reactions[emoji].push('admin');
    if (!reactions[emoji].length) delete reactions[emoji];
    await ChatMessage.findByIdAndUpdate(msgId, { reactions });
    res.json({ success: true, reactions });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── DELETE /api/admin/chat/message/:id ──────────────────
router.delete('/chat/message/:id', requireAdmin, async (req, res) => {
  try {
    const msg = await ChatMessage.findById(req.params.id);
    if (!msg) return res.status(404).json({ error: 'Not found.' });
    await ChatMessage.findByIdAndUpdate(req.params.id, { deleted: true, content: 'This message was deleted.' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── PUT /api/admin/chat/message/:id ─────────────────────
router.put('/chat/message/:id', requireAdmin, async (req, res) => {
  try {
    const { content } = req.body;
    const msg = await ChatMessage.findById(req.params.id);
    if (!msg) return res.status(404).json({ error: 'Not found.' });
    if (msg.deleted) return res.status(400).json({ error: 'Cannot edit deleted message.' });
    await ChatMessage.findByIdAndUpdate(req.params.id, { content, edited: true });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// ─── PUT /api/admin/chat/session/:id/block ───────────────
// Quick block/unblock user directly from chat
router.put('/chat/session/:id/block', requireAdmin, async (req, res) => {
  try {
    const { block } = req.body; // true = block, false = unblock
    const session = await ChatSession.findById(req.params.id).populate('userId');
    if (!session?.userId) return res.status(404).json({ error: 'User not found.' });
    const newStatus = block ? 'blocked' : 'active';
    await User.findByIdAndUpdate(session.userId._id, { status: newStatus });
    // Also end the chat session if blocking
    if (block) await ChatSession.findByIdAndUpdate(req.params.id, { status: 'ended' });
    res.json({ success: true, userStatus: newStatus });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



// 3. ADMIN ROUTES — paste into admin server file
// ─── GET /api/admin/campaigns ────────────────────────────────────────────────
router.get('/campaigns', requireAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status && status !== 'all') filter.adminStatus = status;
    
    const campaigns = await UserCampaign.find(filter)
      .sort({ createdAt: -1 })
      .populate('creatorId', 'username email ib status');
    
    // Attach submission counts
    const counts = await UserCampaignSubmission.aggregate([
    {
      $group: {
        _id: '$campaignId',
        total: { $sum: 1 },
        pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
        approved: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } },
        declined: { $sum: { $cond: [{ $eq: ['$status', 'declined'] }, 1, 0] } },
      }
    }]);
    const cm = {};
    counts.forEach(c => cm[c._id.toString()] = c);
    
    const enriched = campaigns.map(c => ({
      ...c.toObject(),
      submissionStats: cm[c._id.toString()] || { total: 0, pending: 0, approved: 0, declined: 0 },
    }));
    
    res.json({ success: true, campaigns: enriched });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── PUT /api/admin/campaigns/:id ────────────────────────────────────────────
// Admin approves or declines a user campaign
router.put('/campaigns/:id', requireAdmin, async (req, res) => {
  try {
    const { adminStatus, adminNote } = req.body;
    if (!['approved', 'declined'].includes(adminStatus))
      return res.status(400).json({ error: 'adminStatus must be approved or declined.' });
    
    const campaign = await UserCampaign.findById(req.params.id)
      .populate('creatorId', 'username email ib');
    if (!campaign) return res.status(404).json({ error: 'Campaign not found.' });
    if (campaign.adminStatus !== 'pending')
      return res.status(400).json({ error: 'Campaign already reviewed.' });
    
    campaign.adminStatus = adminStatus;
    campaign.adminNote = adminNote || '';
    campaign.reviewedAt = new Date();
    
    if (adminStatus === 'approved') {
      campaign.active = true;
      
      await Notification.create({
        userId: campaign.creatorId._id,
        title: '✅ Campaign Approved!',
        message: `Your campaign "${campaign.title}" has been approved and is now live for other users to complete!`,
      });
      
    } else {
      // Declined — refund the creator
      campaign.active = false;
      await User.findByIdAndUpdate(campaign.creatorId._id, { $inc: { ib: campaign.totalCharged } });
      
      await Activity.create({
        userId: campaign.creatorId._id,
        type: 'Campaign Refund',
        amount: campaign.totalCharged,
        desc: `Campaign declined by admin — 🪙${campaign.totalCharged} FEX refunded`,
      });
      
      await Notification.create({
        userId: campaign.creatorId._id,
        title: '❌ Campaign Declined',
        message: `Your campaign "${campaign.title}" was declined by admin.${adminNote ? ` Reason: ${adminNote}` : ''} 🪙${campaign.totalCharged} FEX has been refunded to your wallet.`,
      });
    }
    
    await campaign.save();
    res.json({ success: true, campaign });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── DELETE /api/admin/campaigns/:id ─────────────────────────────────────────
// Admin deletes a campaign (refunds creator if active/pending)
router.delete('/campaigns/:id', requireAdmin, async (req, res) => {
  try {
    const campaign = await UserCampaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found.' });
    
    // Refund creator if campaign was pending or active (fees were already charged)
    if (['pending', 'approved'].includes(campaign.adminStatus) && campaign.totalCharged > 0) {
      await User.findByIdAndUpdate(campaign.creatorId, { $inc: { ib: campaign.totalCharged } });
      await Activity.create({
        userId: campaign.creatorId,
        type: 'Campaign Refund',
        amount: campaign.totalCharged,
        desc: `Campaign deleted by admin — 🪙${campaign.totalCharged} FEX refunded`,
      });
      await Notification.create({
        userId: campaign.creatorId,
        title: '🗑️ Campaign Deleted',
        message: `Your campaign "${campaign.title}" was removed by admin. 🪙${campaign.totalCharged} FEX has been refunded.`,
      });
    }
    
    await UserCampaignSubmission.deleteMany({ campaignId: campaign._id });
    await UserCampaign.findByIdAndDelete(req.params.id);
    
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── GET /api/admin/campaigns/settings ───────────────────────────────────────
router.get('/campaigns/settings', requireAdmin, async (req, res) => {
  try {
    const doc = await Settings.findOne({ key: 'campaignSettings' });
    res.json({ success: true, settings: doc?.value || {} });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── PUT /api/admin/campaigns/settings ───────────────────────────────────────
router.put('/campaigns/settings', requireAdmin, async (req, res) => {
  try {
    const {
      minReferrals,
      minShares,
      creationFee,
      reachFeePercent,
      maxDeclineBeforeBan,
      declineBanDays
    } = req.body;
    
    await Settings.findOneAndUpdate({ key: 'campaignSettings' },
    {
      key: 'campaignSettings',
      value: {
        minReferrals: Number(minReferrals) || 3,
        minShares: Number(minShares) || 2,
        creationFee: Number(creationFee) || 500,
        reachFeePercent: Number(reachFeePercent) || 10,
        maxDeclineBeforeBan: Number(maxDeclineBeforeBan) || 3,
        declineBanDays: Number(declineBanDays) || 7,
      }
    }, { upsert: true, new: true });
    
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});



module.exports = router;