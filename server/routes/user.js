const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { Resend } = require('resend');
const User = require('../models/User');
const {
  Deposit, Withdrawal, Notification, Activity,
  Share, PurchasedShare, Settings, DepositAmt,
  ChatSession, ChatMessage, Typing,
} = require('../models/Models');
const { requireAuth } = require('../middleware/auth');

// ─── TOP BANKS FOR AUTO-RESOLUTION ───────────────────────
const TOP_BANKS = [
  { code: '058', name: 'GTBank' },
  { code: '057', name: 'Zenith Bank' },
  { code: '044', name: 'Access Bank' },
  { code: '999992', name: 'OPay' },
  { code: '50515', name: 'Moniepoint' },
  { code: '50211', name: 'Kuda Bank' },
  { code: '011', name: 'First Bank' },
  { code: '033', name: 'UBA' },
  { code: '070', name: 'Fidelity Bank' },
  { code: '032', name: 'Union Bank' }
];

// ─── RESEND CLIENT ─────────────────────────────────────────
const resend = new Resend(process.env.RESEND_API_KEY);

// ─── HELPER: Email verification gate ──────────────────────
function requireVerified(req, res) {
  if (!req.user.emailVerified) {
    res.status(403).json({
      error: '📧 Email verification required!',
      unverified: true,
      message: 'Please verify your email to use this feature.'
    });
    return false;
  }
  return true;
}

// ─── GET /api/user/profile ─────────────────────────────────
router.get('/profile', requireAuth, async (req, res) => {
  res.json({ success: true, user: req.user });
});

// ─── GET /api/user/config ──────────────────────────────────
router.get('/config', async (req, res) => {
  try {
    const config      = await Settings.findOne({ key: 'config' });
    const payment     = await Settings.findOne({ key: 'payment' });
    const maintenance = await Settings.findOne({ key: 'maintenance' });
    const wheel       = await Settings.findOne({ key: 'wheel' });
    res.json({
      success: true,
      config:      config?.value      || {},
      payment:     payment?.value     || {},
      maintenance: maintenance?.value || { enabled: false },
      wheel:       wheel?.value       || { prizes: [] }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/user/deposit-amounts ────────────────────────
router.get('/deposit-amounts', requireAuth, async (req, res) => {
  try {
    const amounts = await DepositAmt.find().sort({ amount: 1 });
    res.json({ success: true, amounts: amounts.map(a => a.amount) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT /api/user/bank-details ────────────────────────────
router.put('/bank-details', requireAuth, async (req, res) => {
  try {
    const { bankName, bankCode, accountNumber, accountName } = req.body;
    if (!bankName || accountNumber?.length < 10 || !accountName)
      return res.status(400).json({ error: 'Please fill all fields correctly.' });
    const config          = await Settings.findOne({ key: 'config' });
    const isMasterLocked  = config?.value?.globalBankLock || false;
    const hasExistingBank = req.user.bankDetails?.accountNumber;
    if (isMasterLocked && hasExistingBank)
      return res.status(403).json({ error: '⛔ System locked. Contact Admin to change bank details.' });
    await User.findByIdAndUpdate(req.user._id, {
      bankDetails: { bankName, bankCode, accountNumber, accountName, updatedAt: new Date() },
      canEditBank: true
    });
    res.json({ success: true, message: 'Bank details saved successfully!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/user/banks ──────────────────────────────────
router.get('/banks', requireAuth, async (req, res) => {
  try {
    const secretKey = process.env.KORAPAY_SECRET_KEY;
    if (!secretKey) return res.status(400).json({ error: 'Payment not configured.' });
    const response = await fetch('https://api.korapay.com/merchant/api/v1/misc/banks?countryCode=NG', {
      headers: { 'Authorization': `Bearer ${secretKey}`, 'Content-Type': 'application/json' }
    });
    const result = await response.json();
    if (result.status) {
      res.json({ success: true, banks: result.data });
    } else {
      res.status(400).json({ error: 'Failed to fetch banks.' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/user/verify-account ───────────────────────
router.post('/verify-account', requireAuth, async (req, res) => {
  try {
    const { accountNumber, bankCode } = req.body;
    if (!accountNumber || !bankCode)
      return res.status(400).json({ error: 'Account number and bank code required.' });
    const secretKey = process.env.KORAPAY_SECRET_KEY;
    if (!secretKey) return res.status(400).json({ error: 'Payment not configured.' });
    const response = await fetch('https://api.korapay.com/merchant/api/v1/misc/banks/resolve', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${secretKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ account_number: accountNumber, bank_code: bankCode })
    });
    const result = await response.json();
    if (result.status && result.data?.account_name) {
      res.json({ success: true, accountName: result.data.account_name });
    } else {
      res.status(400).json({ error: 'Could not verify account. Check number and bank.' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/user/resolve-account ──────────────────────
router.post('/resolve-account', requireAuth, async (req, res) => {
  try {
    const { accountNumber } = req.body;
    if (!accountNumber || accountNumber.length !== 10)
      return res.status(400).json({ error: 'Valid 10-digit account number required.' });
    const secretKey = process.env.KORAPAY_SECRET_KEY;
    if (!secretKey) return res.status(400).json({ error: 'Payment not configured.' });
    for (const bank of TOP_BANKS) {
      try {
        const response = await fetch('https://api.korapay.com/merchant/api/v1/misc/banks/resolve', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${secretKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ account_number: accountNumber, bank_code: bank.code })
        });
        const result = await response.json();
        if (result.status && result.data?.account_name) {
          return res.json({
            success: true,
            accountName: result.data.account_name,
            bankCode: bank.code,
            bankName: bank.name
          });
        }
      } catch (e) {
        continue;
      }
    }
    res.status(404).json({ error: 'Bank not detected. Please select your bank manually.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/user/fex-rate ───────────────────────────────
// Returns the current FEX → Naira conversion rate from config
router.get('/fex-rate', requireAuth, async (req, res) => {
  try {
    const config  = await Settings.findOne({ key: 'config' });
    const fexRate = config?.value?.fexRate || 0.7;
    res.json({ success: true, fexRate });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/user/convert-fex ──────────────────────────
// Called at withdrawal time — converts FEX to Naira at live rate
router.post('/convert-fex', requireAuth, async (req, res) => {
  try {
    const { fexAmount } = req.body;
    if (!fexAmount || isNaN(fexAmount) || Number(fexAmount) <= 0)
      return res.status(400).json({ error: 'Invalid FEX amount.' });
    const config  = await Settings.findOne({ key: 'config' });
    const fexRate = config?.value?.fexRate || 0.7;
    const naira   = parseFloat((Number(fexAmount) * fexRate).toFixed(2));
    res.json({
      success:   true,
      fexAmount: parseFloat(fexAmount),
      fexRate,
      naira,
      summary:   `🪙 ${fexAmount} FEX × ₦${fexRate} = ₦${naira.toLocaleString()}`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/user/deposit ───────────────────────────────
// Deposits are stored in FEX coins — amount field = FEX units
router.post('/deposit', requireAuth, async (req, res) => {
  try {
    const { amount, method, refCode, status } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount.' });
    const deposit = await Deposit.create({
      userId: req.user._id,
      amount: Number(amount),
      method: method || 'Bank Transfer',
      refCode,
      status: status || 'pending'
    });
    if (status === 'success') {
      await User.findByIdAndUpdate(req.user._id, { $inc: { ib: Number(amount) } });
      await Activity.create({ userId: req.user._id, type: 'Deposit', amount, desc: 'From Korapay' });
    }
    res.json({ success: true, deposit });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/user/deposits ───────────────────────────────
router.get('/deposits', requireAuth, async (req, res) => {
  try {
    const deposits = await Deposit.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, deposits });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/user/withdraw ──────────────────────────────
// Receives fexAmount — converts to Naira at live rate server-side
router.post('/withdraw', requireAuth, async (req, res) => {
  try {
    if (!requireVerified(req, res)) return;

    const { fexAmount } = req.body;
    const user   = req.user;
    const config = await Settings.findOne({ key: 'config' });

    const fexRate     = config?.value?.fexRate     || 0.7;
    const minWithdraw = config?.value?.minWithdraw  || 2000; // in Naira
    const withdrawFee = config?.value?.withdrawFee  || 0;

    if (!user.bankDetails?.accountNumber)
      return res.status(400).json({ error: 'Please bind your Bank Account first.' });
    if (!fexAmount || Number(fexAmount) <= 0)
      return res.status(400).json({ error: 'Invalid FEX amount.' });
    if (Number(fexAmount) > user.ib)
      return res.status(400).json({ error: 'Insufficient FEX balance.' });

    // Convert FEX → Naira at live rate
    const nairaAmount = parseFloat((Number(fexAmount) * fexRate).toFixed(2));
    const minFex      = Math.ceil(minWithdraw / fexRate);

    if (nairaAmount < minWithdraw)
      return res.status(400).json({
        error: `Minimum withdrawal is ₦${minWithdraw.toLocaleString()} (${minFex.toLocaleString()} FEX at current rate of ₦${fexRate}/FEX)`
      });

    const feeAmount = parseFloat(((nairaAmount * withdrawFee) / 100).toFixed(2));
    const netAmount = parseFloat((nairaAmount - feeAmount).toFixed(2));

    // Deduct FEX from wallet
    await User.findByIdAndUpdate(user._id, { $inc: { ib: -Number(fexAmount) } });

    await Activity.create({
      userId: user._id,
      type:   'Withdrawal',
      amount: fexAmount,
      desc:   `Withdrawal — 🪙${fexAmount} FEX → ₦${netAmount.toLocaleString()} @ ₦${fexRate}/FEX`
    });

    const withdrawal = await Withdrawal.create({
      userId:           user._id,
      username:         user.username,
      amount:           Number(fexAmount),  // stored in FEX
      nairaAmount,                          // naira equivalent at time of request
      fexRate,                              // rate snapshot
      fee:              feeAmount,
      feePercentage:    withdrawFee,
      netAmount,                            // naira the user actually receives
      status:           'pending',
      bankDetails:      user.bankDetails,
      remainingBalance: user.ib - Number(fexAmount)
    });

    res.json({
      success:    true,
      message:    `Withdrawal of 🪙${fexAmount} FEX (≈ ₦${netAmount.toLocaleString()}) submitted!`,
      withdrawal
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/user/withdrawals ────────────────────────────
router.get('/withdrawals', requireAuth, async (req, res) => {
  try {
    const withdrawals = await Withdrawal.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, withdrawals });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/user/notifications ─────────────────────────
router.get('/notifications', requireAuth, async (req, res) => {
  try {
    const notifs = await Notification.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(10);
    res.json({ success: true, notifications: notifs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/user/activity ───────────────────────────────
router.get('/activity', requireAuth, async (req, res) => {
  try {
    const activity = await Activity.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(12);
    res.json({ success: true, activity });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/user/activity ──────────────────────────────
router.post('/activity', requireAuth, async (req, res) => {
  try {
    const { type, amount, desc } = req.body;
    const log = await Activity.create({ userId: req.user._id, type, amount, desc });
    res.json({ success: true, log });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/user/shares ─────────────────────────────────
router.get('/shares', requireAuth, async (req, res) => {
  try {
    const shares = await Share.find().sort({ price: 1 });
    res.json({ success: true, shares });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/user/buy-share ─────────────────────────────
router.post('/buy-share', requireAuth, async (req, res) => {
  try {
    if (!requireVerified(req, res)) return;
    const { shareId, name, price, dailyIncome, duration } = req.body;
    const user = await User.findById(req.user._id);
    if (user.ib < price)
      return res.status(400).json({ error: 'Insufficient Balance!' });
    await User.findByIdAndUpdate(user._id, { $inc: { ib: -price, freeSpins: 2 } });
    const purchased = await PurchasedShare.create({
      userId: user._id, shareName: name, pricePaid: price,
      dailyIncome, duration, status: 'active',
      purchaseDate: new Date(), lastClaimDate: new Date()
    });
    await Activity.create({ userId: user._id, type: 'Shares', amount: name, desc: 'Investment purchased' });
    res.json({ success: true, message: 'Investment Active!', share: purchased });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/user/my-investments ────────────────────────
router.get('/my-investments', requireAuth, async (req, res) => {
  try {
    const investments = await PurchasedShare.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, investments });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/user/collect-earnings ─────────────────────
router.post('/collect-earnings', requireAuth, async (req, res) => {
  try {
    const uid         = req.user._id;
    const investments = await PurchasedShare.find({ userId: uid, status: 'active' });
    if (!investments.length) return res.json({ success: true, credited: 0 });
    const now = new Date();
    let totalToCredit = 0;
    const updates  = [];
    const toDelete = [];
    for (const share of investments) {
      const lastClaim   = share.lastClaimDate || share.purchaseDate;
      const daysToClaim = Math.floor((now - lastClaim) / (1000 * 60 * 60 * 24));
      const daysPassed  = Math.floor((now - share.purchaseDate) / (1000 * 60 * 60 * 24));
      if (daysPassed >= share.duration) { toDelete.push(share._id); continue; }
      if (daysToClaim <= 0) continue;
      totalToCredit += daysToClaim * Number(share.dailyIncome);
      const newClaimDate = new Date(lastClaim.getTime() + daysToClaim * 24 * 60 * 60 * 1000);
      updates.push(PurchasedShare.findByIdAndUpdate(share._id, { lastClaimDate: newClaimDate }));
    }
    if (toDelete.length) await PurchasedShare.deleteMany({ _id: { $in: toDelete } });
    await Promise.all(updates);
    if (totalToCredit > 0) {
      await User.findByIdAndUpdate(uid, { $inc: { ib: totalToCredit } });
      await Activity.create({ userId: uid, type: 'share', amount: totalToCredit, desc: 'Daily profit collected' });
    }
    res.json({ success: true, credited: totalToCredit });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/user/team ───────────────────────────────────
router.get('/team', requireAuth, async (req, res) => {
  try {
    const uid    = req.user._id.toString();
    const level1 = await User.find({ referrerId: uid }).select('username email createdAt ib');
    const level2Users = [];
    for (const l1 of level1) {
      const l2 = await User.find({ referrerId: l1._id.toString() }).select('username email');
      level2Users.push(...l2);
    }
    const level3Users = [];
    for (const l2 of level2Users) {
      const l3 = await User.find({ referrerId: l2._id.toString() }).select('username email');
      level3Users.push(...l3);
    }
    res.json({
      success: true,
      level1: { count: level1.length,      users: level1 },
      level2: { count: level2Users.length,  users: level2Users },
      level3: { count: level3Users.length,  users: level3Users },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/user/spin ─────────────────────────────────
router.post('/spin', requireAuth, async (req, res) => {
  try {
    if (!requireVerified(req, res)) return;
    const user  = await User.findById(req.user._id);
    const today = new Date().toISOString().split('T')[0];
    if (user.ib < 90)
      return res.status(400).json({ error: 'Insufficient balance. Need 🪙90 FEX to spin.' });
    const refCount = await User.countDocuments({ referrerId: user._id.toString() });
    if (refCount < 5)
      return res.status(400).json({ error: `5 Referrals needed. You have ${refCount}/5.` });
    const hasFreeSpins = user.freeSpins || 0;
    if (user.lastSpinDate === today && hasFreeSpins <= 0)
      return res.status(400).json({ error: 'Daily limit reached! Come back tomorrow.' });
    const update = { $inc: { ib: -90 } };
    if (hasFreeSpins > 0) { update.$inc.freeSpins = -1; }
    else { update.$set = { lastSpinDate: today }; }
    await User.findByIdAndUpdate(user._id, update);
    const wheelSettings = await Settings.findOne({ key: 'wheel' });
    const prizes      = wheelSettings?.value?.prizes || [];
    const randomIndex = Math.floor(Math.random() * prizes.length);
    const win         = prizes[randomIndex] || { value: 0, label: 'Empty' };
    if (win.value > 0) {
      await User.findByIdAndUpdate(user._id, { $inc: { ib: win.value } });
      await Activity.create({ userId: user._id, type: 'Won spin', amount: win.value, desc: `Won ${win.label}` });
    } else {
      await Activity.create({ userId: user._id, type: 'Spin Loss', amount: 0, desc: `Landed on ${win.label}` });
    }
    res.json({ success: true, prize: win, prizeIndex: randomIndex });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/user/checkin ──────────────────────────────
router.post('/checkin', requireAuth, async (req, res) => {
  try {
    if (!requireVerified(req, res)) return;
    const today = new Date().toDateString();
    const user  = req.user;
    if (user.lastCheckIn === today)
      return res.status(400).json({ error: 'Already claimed today! Come back tomorrow.' });
    const config       = await Settings.findOne({ key: 'config' });
    const checkInBonus = config?.value?.checkInBonus || 50;
    await User.findByIdAndUpdate(user._id, { lastCheckIn: today, $inc: { ib: checkInBonus } });
    await Activity.create({ userId: user._id, type: 'Check-in', amount: checkInBonus, desc: 'Daily check-in bonus' });
    res.json({ success: true, bonus: checkInBonus });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/user/resend-verification ──────────────────
router.post('/resend-verification', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    if (user.emailVerified)
      return res.status(400).json({ error: 'Your email is already verified.' });
    const verifyToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    const verifyUrl   = `${process.env.APP_URL}/api/auth/verify-email?token=${verifyToken}`;
    res.json({ success: true, message: 'Verification email sent! Check your inbox.' });
    resend.emails.send({
      from: process.env.EMAIL_FROM || 'Flux Mall <noreply@fluxmall.online>',
      to:   user.email,
      subject: 'Verify your email — Flux Mall',
      html: `
        <div style="font-family:Arial;max-width:500px;margin:auto;padding:32px;background:#fff;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.08)">
          <div style="background:linear-gradient(135deg,#4318ff,#868cff);padding:28px;border-radius:10px;text-align:center;margin-bottom:24px">
            <h2 style="color:#fff;margin:0;font-size:22px">✉️ Verify Your Email</h2>
          </div>
          <p style="color:#2b3674;font-size:16px">Hi <strong>${user.username}</strong>,</p>
          <p style="color:#6b7a99;font-size:15px;line-height:1.7">Click the button below to verify your email and unlock all Flux Mall features.</p>
          <div style="text-align:center;margin:28px 0">
            <a href="${verifyUrl}" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#4318ff,#868cff);color:#fff;border-radius:10px;text-decoration:none;font-size:16px;font-weight:600">
              ✅ Verify My Email
            </a>
          </div>
          <p style="color:#a3adc2;font-size:12px;text-align:center">Link expires in 24 hours.</p>
          <p style="color:#a3adc2;font-size:11px;text-align:center;word-break:break-all">
            Or copy: <a href="${verifyUrl}" style="color:#4318ff">${verifyUrl}</a>
          </p>
        </div>`
    }).then(() => {
      console.log(`[EMAIL] Verification sent to ${user.email}`);
    }).catch(err => {
      console.log(`[EMAIL] Resend failed:`, err.message);
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/user/apikeys ────────────────────────────────
router.get('/apikeys', requireAuth, async (req, res) => {
  try {
    const doc = await Settings.findOne({ key: 'apikeys' });
    res.json({ success: true, imgbb: doc?.value?.imgbb || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
// CHAT ROUTES
// ═══════════════════════════════════════════════════════════

// ─── GET /api/user/chat/session ───────────────────────────
router.get('/chat/session', requireAuth, async (req, res) => {
  try {
    const chatSettings = await Settings.findOne({ key: 'chat' });
    const isAvailable  = chatSettings?.value?.available !== false;
    const officeHours  = chatSettings?.value?.officeHours;
    const autoReply    = chatSettings?.value?.autoReply || '';
    if (!isAvailable)
      return res.json({ success: true, offline: true, offlineMsg: '🔒 Chat is currently unavailable. Please try again later.' });
    if (officeHours?.enabled) {
      const now   = new Date();
      const hour  = now.getHours();
      const open  = parseInt(officeHours.open  || '9');
      const close = parseInt(officeHours.close || '18');
      if (hour < open || hour >= close)
        return res.json({ success: true, offline: true, offlineMsg: officeHours.offlineMsg || "We're offline. Leave a message and we'll reply soon." });
    }
    let session = await ChatSession.findOne({ userId: req.user._id, status: 'active' });
    if (!session) {
      session = await ChatSession.create({ userId: req.user._id, username: req.user.username });
      if (autoReply) {
        await ChatMessage.create({ sessionId: session._id, sender: 'admin', type: 'text', content: autoReply });
        await ChatSession.findByIdAndUpdate(session._id, { lastMessage: autoReply, lastMessageAt: new Date(), unreadUser: 1 });
      }
    }
    res.json({ success: true, session, available: isAvailable });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/user/chat/messages ─────────────────────────
router.get('/chat/messages', requireAuth, async (req, res) => {
  try {
    const session = await ChatSession.findOne({ userId: req.user._id });
    if (!session) return res.json({ success: true, messages: [] });
    const messages = await ChatMessage.find({ sessionId: session._id }).sort({ createdAt: 1 });
    await ChatMessage.updateMany(
      { sessionId: session._id, sender: 'admin', read: false },
      { read: true }
    );
    await ChatSession.findByIdAndUpdate(session._id, { unreadUser: 0 });
    res.json({ success: true, messages, sessionId: session._id, sessionStatus: session.status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/user/chat/send ─────────────────────────────
router.post('/chat/send', requireAuth, async (req, res) => {
  try {
    const { content, type, imageUrl, polarAnswer, polarMsgId, replyTo } = req.body;
    const chatSettings = await Settings.findOne({ key: 'chat' });
    const cs = chatSettings?.value || {};
    if (cs.available === false)
      return res.status(403).json({ error: '🔒 Chat is currently unavailable.' });
    if (type === 'image' && cs.allowImages === false)
      return res.status(403).json({ error: '🚫 Image uploads are disabled.' });
    const session = await ChatSession.findOne({ userId: req.user._id, status: 'active' });
    if (!session) return res.status(400).json({ error: 'No active chat session.' });
    if (type === 'polar_answer') {
      if (!polarMsgId) return res.status(400).json({ error: 'Missing polar message ID.' });
      const polarMsg = await ChatMessage.findById(polarMsgId);
      if (!polarMsg) return res.status(404).json({ error: 'Polar question not found.' });
      if (polarMsg.polarAnswer) return res.status(400).json({ error: 'Already answered.' });
      await ChatMessage.findByIdAndUpdate(polarMsgId, { polarAnswer: content });
      const msg = await ChatMessage.create({
        sessionId: session._id, sender: 'user', type: 'text',
        content: content === 'yes' ? '✅ Yes' : '❌ No',
      });
      await ChatSession.findByIdAndUpdate(session._id, {
        lastMessage: content === 'yes' ? '✅ Yes' : '❌ No',
        lastMessageAt: new Date(), $inc: { unreadAdmin: 1 }
      });
      notifyAdmin(req.user.username, content === 'yes' ? '✅ Yes' : '❌ No').catch(() => {});
      return res.json({ success: true, message: msg });
    }
    const msg = await ChatMessage.create({
      sessionId: session._id, sender: 'user',
      type: type || 'text', content: content || '',
      imageUrl: imageUrl || '', replyTo: replyTo || {},
    });
    const preview = type === 'image' ? '📷 Image' : content?.substring(0, 60) || '';
    await ChatSession.findByIdAndUpdate(session._id, {
      lastMessage: preview, lastMessageAt: new Date(), $inc: { unreadAdmin: 1 }
    });
    res.json({ success: true, message: msg });
    notifyAdmin(req.user.username, preview).catch(() => {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── HELPER: Notify admin via email ──────────────────────
async function notifyAdmin(username, messagePreview) {
  try {
    const admin = await User.findOne({ role: 'admin' }).select('email');
    if (!admin?.email) return;
    const config       = await Settings.findOne({ key: 'config' });
    const siteName     = config?.value?.siteName || 'Flux Mall';
    const adminPanelUrl = process.env.APP_URL
      ? `${process.env.APP_URL}/cpanel/admin.html`
      : 'https://fluxmall.online/cpanel/admin.html';
    await resend.emails.send({
      from: process.env.EMAIL_FROM || `${siteName} <noreply@fluxmall.online>`,
      to:   admin.email,
      subject: `💬 New message from ${username} — ${siteName}`,
      html: `
        <div style="font-family:Arial;max-width:480px;margin:auto;padding:28px;background:#fff;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
          <div style="background:linear-gradient(135deg,#4318ff,#868cff);padding:22px;border-radius:10px;text-align:center;margin-bottom:20px;">
            <h2 style="color:#fff;margin:0;font-size:20px;">💬 New Chat Message</h2>
          </div>
          <p style="color:#2b3674;font-size:15px;margin-bottom:6px;"><strong>${username}</strong> sent you a message:</p>
          <div style="background:#f4f7fe;border-left:4px solid #4318ff;padding:12px 16px;border-radius:6px;margin:16px 0;color:#444;font-size:14px;">${messagePreview}</div>
          <div style="text-align:center;margin-top:24px;">
            <a href="${adminPanelUrl}" style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#4318ff,#868cff);color:#fff;border-radius:10px;text-decoration:none;font-size:15px;font-weight:600;">Open Admin Panel →</a>
          </div>
          <p style="color:#a3adc2;font-size:11px;text-align:center;margin-top:16px;">Reply via the admin chat panel</p>
        </div>`
    });
    console.log(`[CHAT] Admin notified of message from ${username}`);
  } catch (err) {
    console.log(`[CHAT] Admin email notify failed:`, err.message);
  }
}

// ─── GET /api/user/chat/unread ────────────────────────────
router.get('/chat/unread', requireAuth, async (req, res) => {
  try {
    const session = await ChatSession.findOne({ userId: req.user._id, status: 'active' });
    res.json({ success: true, unread: session?.unreadUser || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/user/chat/settings ─────────────────────────
router.get('/chat/settings', requireAuth, async (req, res) => {
  try {
    const doc = await Settings.findOne({ key: 'chat' });
    const s   = doc?.value || {};
    res.json({ success: true, settings: { sound: s.sound !== false, allowImages: s.allowImages !== false } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/user/chat/typing ───────────────────────────
router.post('/chat/typing', requireAuth, async (req, res) => {
  try {
    const session = await ChatSession.findOne({ userId: req.user._id, status: 'active' });
    if (!session) return res.json({ success: false });
    await Typing.findOneAndUpdate(
      { sessionId: session._id, sender: 'user' },
      { sessionId: session._id, sender: 'user', updatedAt: new Date() },
      { upsert: true }
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── GET /api/user/chat/typing ────────────────────────────
router.get('/chat/typing', requireAuth, async (req, res) => {
  try {
    const session = await ChatSession.findOne({ userId: req.user._id });
    if (!session) return res.json({ typing: false });
    const t = await Typing.findOne({ sessionId: session._id, sender: 'admin' });
    const isTyping = t && (Date.now() - new Date(t.updatedAt).getTime() < 4000);
    res.json({ typing: !!isTyping });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── POST /api/user/chat/react ────────────────────────────
router.post('/chat/react', requireAuth, async (req, res) => {
  try {
    const { msgId, emoji } = req.body;
    const msg = await ChatMessage.findById(msgId);
    if (!msg) return res.status(404).json({ error: 'Message not found.' });
    const reactions = msg.reactions || {};
    if (!reactions[emoji]) reactions[emoji] = [];
    const idx = reactions[emoji].indexOf('user');
    if (idx > -1) reactions[emoji].splice(idx, 1);
    else reactions[emoji].push('user');
    if (!reactions[emoji].length) delete reactions[emoji];
    await ChatMessage.findByIdAndUpdate(msgId, { reactions });
    res.json({ success: true, reactions });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── DELETE /api/user/chat/message/:id ───────────────────
router.delete('/chat/message/:id', requireAuth, async (req, res) => {
  try {
    const msg = await ChatMessage.findById(req.params.id);
    if (!msg) return res.status(404).json({ error: 'Not found.' });
    const session = await ChatSession.findOne({ userId: req.user._id });
    if (!session || msg.sessionId.toString() !== session._id.toString())
      return res.status(403).json({ error: 'Forbidden.' });
    if (msg.sender !== 'user') return res.status(403).json({ error: 'Cannot delete admin messages.' });
    await ChatMessage.findByIdAndUpdate(req.params.id, { deleted: true, content: 'This message was deleted.' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── PUT /api/user/chat/message/:id ──────────────────────
router.put('/chat/message/:id', requireAuth, async (req, res) => {
  try {
    const { content } = req.body;
    const msg = await ChatMessage.findById(req.params.id);
    if (!msg) return res.status(404).json({ error: 'Not found.' });
    const session = await ChatSession.findOne({ userId: req.user._id });
    if (!session || msg.sessionId.toString() !== session._id.toString())
      return res.status(403).json({ error: 'Forbidden.' });
    if (msg.sender !== 'user') return res.status(403).json({ error: 'Cannot edit admin messages.' });
    if (msg.deleted) return res.status(400).json({ error: 'Cannot edit deleted message.' });
    await ChatMessage.findByIdAndUpdate(req.params.id, { content, edited: true });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
