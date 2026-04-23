const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
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
  Task,
  TaskSubmission,
  ChatSession,
  ChatMessage,
  UserCampaign,
  UserCampaignSubmission,
  Typing,
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
    const config = await Settings.findOne({ key: 'config' });
    const payment = await Settings.findOne({ key: 'payment' });
    const maintenance = await Settings.findOne({ key: 'maintenance' });
    const wheel = await Settings.findOne({ key: 'wheel' });
    res.json({
      success: true,
      config: config?.value || {},
      payment: payment?.value || {},
      maintenance: maintenance?.value || { enabled: false },
      wheel: wheel?.value || { prizes: [] }
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
    const config = await Settings.findOne({ key: 'config' });
    const isMasterLocked = config?.value?.globalBankLock || false;
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


// 2. USER ROUTES  — paste into user server file
// ─── GET /api/user/campaigns/settings ────────────────────────────────────────
// Returns eligibility requirements so the UI can show live gating info
router.get('/campaigns/settings', requireAuth, async (req, res) => {
  try {
    const doc = await Settings.findOne({ key: 'campaignSettings' });
    const s = doc?.value || {};
    res.json({
      success: true,
      settings: {
        minReferrals:        s.minReferrals        || 3,
        minShares:           s.minShares           || 2,
        creationFee:         s.creationFee         || 500,   // FEX
        reachFeePercent:     s.reachFeePercent     || 10,    // % on top of rewardPerUser * targetReach
        maxDeclineWarning:   s.maxDeclineWarning   || 3,
        declineBanDays:      s.declineBanDays      || 7,
        maxDeclineBeforeBan: s.maxDeclineBeforeBan || 3,
      }
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── GET /api/user/campaigns/eligibility ─────────────────────────────────────
// Checks if logged-in user meets all requirements to create a campaign
router.get('/campaigns/eligibility', requireAuth, async (req, res) => {
  try {
    const doc = await Settings.findOne({ key: 'campaignSettings' });
    const s = doc?.value || {};
    const minReferrals = s.minReferrals || 3;
    const minShares    = s.minShares    || 2;

    const user = await User.findById(req.user._id).select('emailVerified ib referrerId');
    const refCount   = await User.countDocuments({ referrerId: req.user._id.toString() });
    const shareCount = await PurchasedShare.countDocuments({ userId: req.user._id });

    // Check if creator is currently banned
    const activeBan = await UserCampaign.findOne({
      creatorId:     req.user._id,
      declineBanUntil: { $gt: new Date() }
    }).sort({ declineBanUntil: -1 });

    const checks = {
      verified:   { pass: !!user.emailVerified,           required: true,         label: 'Email verified' },
      referrals:  { pass: refCount >= minReferrals,        required: minReferrals, actual: refCount,  label: `${minReferrals} referrals` },
      shares:     { pass: shareCount >= minShares,         required: minShares,    actual: shareCount, label: `${minShares} share packages` },
    };

    const eligible = Object.values(checks).every(c => c.pass) && !activeBan;

    res.json({
      success: true,
      eligible,
      banned: !!activeBan,
      banUntil: activeBan?.declineBanUntil || null,
      checks,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── POST /api/user/campaigns ────────────────────────────────────────────────
// Create a new user campaign (charges FEX, sends to admin for approval)
router.post('/campaigns', requireAuth, async (req, res) => {
  try {
    if (!requireVerified(req, res)) return;

    const { title, description, instructions, proofType, taskLink, platform,
            category, targetReach, rewardPerUser, expiresAt } = req.body;

    if (!title || !description || !targetReach || !rewardPerUser)
      return res.status(400).json({ error: 'Title, description, target reach and reward per user are required.' });

    // Load settings
    const doc = await Settings.findOne({ key: 'campaignSettings' });
    const s = doc?.value || {};
    const minReferrals        = s.minReferrals        || 3;
    const minShares           = s.minShares           || 2;
    const creationFee         = s.creationFee         || 500;
    const reachFeePercent     = s.reachFeePercent     || 10;
    const declineBanDays      = s.declineBanDays      || 7;

    // Eligibility checks
    const user      = await User.findById(req.user._id);
    const refCount  = await User.countDocuments({ referrerId: req.user._id.toString() });
    const shareCount = await PurchasedShare.countDocuments({ userId: req.user._id });

    if (!user.emailVerified)
      return res.status(403).json({ error: 'Email verification required to create campaigns.' });
    if (refCount < minReferrals)
      return res.status(403).json({ error: `You need at least ${minReferrals} referrals. You have ${refCount}.` });
    if (shareCount < minShares)
      return res.status(403).json({ error: `You need at least ${minShares} share packages. You have ${shareCount}.` });

    // Check ban
    const activeBan = await UserCampaign.findOne({
      creatorId:     req.user._id,
      declineBanUntil: { $gt: new Date() }
    }).sort({ declineBanUntil: -1 });
    if (activeBan) {
      const until = new Date(activeBan.declineBanUntil).toLocaleDateString();
      return res.status(403).json({ error: `You are banned from creating campaigns until ${until} due to excessive declines.` });
    }

    // Calculate fees
    const reachFeeTotal = Number(targetReach) * Number(rewardPerUser);
    const surcharge     = Math.ceil(reachFeeTotal * reachFeePercent / 100);
    const totalCharged  = creationFee + reachFeeTotal + surcharge;

    if (user.ib < totalCharged)
      return res.status(400).json({
        error: `Insufficient FEX balance. Required: 🪙${totalCharged.toLocaleString()} (${creationFee} creation fee + ${reachFeeTotal} reach pool + ${surcharge} platform fee). You have 🪙${user.ib}.`
      });

    // Deduct FEX immediately (held in escrow until approved/declined)
    await User.findByIdAndUpdate(req.user._id, { $inc: { ib: -totalCharged } });

    const campaign = await UserCampaign.create({
      creatorId:    req.user._id,
      creatorName:  user.username,
      title, description,
      instructions: instructions || '',
      proofType:    proofType    || 'screenshot',
      taskLink:     taskLink     || '',
      platform:     platform     || '',
      category:     category     || 'General',
      targetReach:  Number(targetReach),
      rewardPerUser: Number(rewardPerUser),
      creationFee,
      reachFeeTotal,
      totalCharged,
      expiresAt:    expiresAt ? new Date(expiresAt) : null,
      adminStatus:  'pending',
    });

    await Activity.create({
      userId: req.user._id,
      type: 'Campaign',
      amount: totalCharged,
      desc: `Campaign submitted for review: "${title}" — 🪙${totalCharged} FEX charged`,
    });

    await Notification.create({
      userId: req.user._id,
      title: '📋 Campaign Submitted',
      message: `Your campaign "${title}" has been submitted for admin review. 🪙${totalCharged} FEX has been held. You'll be notified once reviewed.`,
    });

    res.json({ success: true, campaign, totalCharged });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── GET /api/user/campaigns/mine ─────────────────────────────────────────────
// Campaigns created by the logged-in user
router.get('/campaigns/mine', requireAuth, async (req, res) => {
  try {
    const campaigns = await UserCampaign.find({ creatorId: req.user._id }).sort({ createdAt: -1 });

    // Attach submission counts
    const counts = await UserCampaignSubmission.aggregate([
      { $match: { campaignId: { $in: campaigns.map(c => c._id) } } },
      { $group: { _id: '$campaignId',
          total:    { $sum: 1 },
          pending:  { $sum: { $cond: [{ $eq: ['$status', 'pending']   }, 1, 0] } },
          approved: { $sum: { $cond: [{ $eq: ['$status', 'approved']  }, 1, 0] } },
          declined: { $sum: { $cond: [{ $eq: ['$status', 'declined']  }, 1, 0] } },
        }
      }
    ]);
    const cm = {};
    counts.forEach(c => cm[c._id.toString()] = c);

    const enriched = campaigns.map(c => ({
      ...c.toObject(),
      submissionStats: cm[c._id.toString()] || { total: 0, pending: 0, approved: 0, declined: 0 },
    }));

    res.json({ success: true, campaigns: enriched });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── GET /api/user/campaigns/active ───────────────────────────────────────────
// All live campaigns (admin-approved) available for other users to do
// Excludes campaigns created by the current user
router.get('/campaigns/active', requireAuth, async (req, res) => {
  try {
    const now = new Date();
    const campaigns = await UserCampaign.find({
      adminStatus: 'approved',
      active: true,
      creatorId: { $ne: req.user._id },
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    }).sort({ createdAt: -1 });

    // Mark which ones the current user already submitted
    const subs = await UserCampaignSubmission.find({ doerId: req.user._id })
      .select('campaignId status');
    const subMap = {};
    subs.forEach(s => subMap[s.campaignId.toString()] = s.status);

    const approvedCounts = await UserCampaignSubmission.aggregate([
      { $match: { status: 'approved' } },
      { $group: { _id: '$campaignId', count: { $sum: 1 } } }
    ]);
    const acMap = {};
    approvedCounts.forEach(c => acMap[c._id.toString()] = c.count);

    const enriched = campaigns.map(c => {
      const cid = c._id.toString();
      const filled = acMap[cid] || 0;
      return {
        ...c.toObject(),
        userStatus: subMap[cid] || null,
        spotsLeft: Math.max(0, c.targetReach - filled),
        canSubmit: !subMap[cid] || subMap[cid] === 'declined',
      };
    });

    res.json({ success: true, campaigns: enriched });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── GET /api/user/campaigns/:id/submissions ──────────────────────────────────
// Creator reviews their own campaign's submissions
router.get('/campaigns/:id/submissions', requireAuth, async (req, res) => {
  try {
    const campaign = await UserCampaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found.' });
    if (campaign.creatorId.toString() !== req.user._id.toString())
      return res.status(403).json({ error: 'Access denied.' });

    const submissions = await UserCampaignSubmission.find({ campaignId: req.params.id })
      .sort({ createdAt: -1 })
      .populate('doerId', 'username email');

    res.json({ success: true, submissions });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── PUT /api/user/campaigns/:id/submissions/:subId ───────────────────────────
// Creator approves or declines a submission on their own campaign
router.put('/campaigns/:id/submissions/:subId', requireAuth, async (req, res) => {
  try {
    const { status, note } = req.body;
    if (!['approved', 'declined'].includes(status))
      return res.status(400).json({ error: 'Status must be approved or declined.' });

    const campaign = await UserCampaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found.' });
    if (campaign.creatorId.toString() !== req.user._id.toString())
      return res.status(403).json({ error: 'Only the campaign creator can review submissions.' });

    const sub = await UserCampaignSubmission.findById(req.params.subId)
      .populate('doerId', 'username email ib');
    if (!sub)    return res.status(404).json({ error: 'Submission not found.' });
    if (sub.status !== 'pending')
      return res.status(400).json({ error: 'Submission already reviewed.' });

    sub.status     = status;
    sub.creatorNote = note || '';
    sub.reviewedAt = new Date();

    if (status === 'approved') {
      sub.rewarded  = true;
      sub.rewardAmt = campaign.rewardPerUser;

      // Credit doer
      await User.findByIdAndUpdate(sub.doerId._id, { $inc: { ib: campaign.rewardPerUser } });
      await Activity.create({
        userId: sub.doerId._id,
        type:   'Campaign Reward',
        amount: campaign.rewardPerUser,
        desc:   `Task approved: "${campaign.title}"`,
      });
      await Notification.create({
        userId: sub.doerId._id,
        title:  '✅ Campaign Task Approved!',
        message: `Your submission for "${campaign.title}" was approved! 🪙${campaign.rewardPerUser} FEX credited.`,
      });

    } else {
      // declined — track abuse
      const doc = await Settings.findOne({ key: 'campaignSettings' });
      const s = doc?.value || {};
      const maxDeclineBeforeBan = s.maxDeclineBeforeBan || 3;
      const declineBanDays      = s.declineBanDays      || 7;

      campaign.totalDeclines = (campaign.totalDeclines || 0) + 1;

      // Count across ALL campaigns by this creator this cycle
      const creatorDeclines = await UserCampaign.aggregate([
        { $match: { creatorId: campaign.creatorId } },
        { $group: { _id: null, total: { $sum: '$totalDeclines' } } }
      ]);
      const totalCreatorDeclines = (creatorDeclines[0]?.total || 0) + 1;

      if (totalCreatorDeclines >= maxDeclineBeforeBan) {
        // BAN
        const banUntil = new Date(Date.now() + declineBanDays * 24 * 60 * 60 * 1000);
        campaign.declineBanUntil = banUntil;

        await Notification.create({
          userId: campaign.creatorId,
          title:  '🚫 Campaign Creation Banned',
          message: `You have been banned from creating campaigns for ${declineBanDays} days due to repeatedly declining valid task submissions. Ban expires: ${banUntil.toLocaleDateString()}.`,
        });

        // Delete the campaign
        await UserCampaignSubmission.deleteMany({ campaignId: campaign._id });
        await campaign.save();
        await UserCampaign.findByIdAndDelete(campaign._id);

        return res.json({ success: true, banned: true, banUntil, message: 'Creator banned and campaign deleted.' });

      } else if (totalCreatorDeclines >= Math.floor(maxDeclineBeforeBan / 2)) {
        // WARN
        campaign.warnedAt = new Date();
        await Notification.create({
          userId: campaign.creatorId,
          title:  '⚠️ Campaign Warning',
          message: `Warning: You have declined ${totalCreatorDeclines} task submissions. If you reach ${maxDeclineBeforeBan} total declines, you will be banned from creating campaigns for ${declineBanDays} days.`,
        });
      }

      await Notification.create({
        userId: sub.doerId._id,
        title:  '❌ Campaign Task Declined',
        message: `Your submission for "${campaign.title}" was declined.${note ? ` Reason: ${note}` : ''} No FEX was deducted.`,
      });
    }

    await campaign.save();
    await sub.save();

    res.json({ success: true, submission: sub });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── POST /api/user/campaigns/:id/submit ─────────────────────────────────────
// Submit proof for a campaign task (doer)
router.post('/campaigns/:id/submit', requireAuth, async (req, res) => {
  try {
    const { proof } = req.body;
    const campaign = await UserCampaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found.' });
    if (!campaign.active || campaign.adminStatus !== 'approved')
      return res.status(400).json({ error: 'This campaign is not accepting submissions.' });
    if (campaign.creatorId.toString() === req.user._id.toString())
      return res.status(400).json({ error: 'You cannot submit to your own campaign.' });

    // Check expiry
    if (campaign.expiresAt && new Date() > campaign.expiresAt)
      return res.status(400).json({ error: 'This campaign has expired.' });

    // Check spots
    const approvedCount = await UserCampaignSubmission.countDocuments({
      campaignId: campaign._id,
      status: 'approved'
    });
    if (approvedCount >= campaign.targetReach)
      return res.status(400).json({ error: 'This campaign has reached its maximum completions.' });

    // Check existing
    const existing = await UserCampaignSubmission.findOne({
      campaignId: req.params.id,
      doerId: req.user._id
    });
    if (existing) {
      if (existing.status === 'pending')
        return res.status(400).json({ error: 'You already submitted. Awaiting creator review.' });
      if (existing.status === 'approved')
        return res.status(400).json({ error: 'You already completed this campaign task.' });
      // Resubmit after decline
      existing.proof     = proof || '';
      existing.status    = 'pending';
      existing.creatorNote = '';
      existing.reviewedAt  = null;
      await existing.save();
      return res.json({ success: true, submission: existing, message: 'Re-submitted for review!' });
    }

    if (campaign.proofType !== 'none' && !proof?.trim())
      return res.status(400).json({ error: 'Proof is required for this campaign.' });

    const sub = await UserCampaignSubmission.create({
      campaignId: campaign._id,
      doerId:     req.user._id,
      proof:      proof || '',
      rewardAmt:  campaign.rewardPerUser,
    });

    // Notify campaign creator
    await Notification.create({
      userId: campaign.creatorId,
      title:  '📥 New Campaign Submission',
      message: `Someone submitted proof for your campaign "${campaign.title}". Review it in your Tasks page.`,
    });

    res.json({ success: true, submission: sub, message: 'Submitted! Awaiting creator review.' });
  } catch (err) {
    if (err.code === 11000)
      return res.status(400).json({ error: 'You already submitted this campaign task.' });
    res.status(500).json({ error: err.message });
  }
});


// ─── GET /api/user/fex-rate ───────────────────────────────
router.get('/fex-rate', requireAuth, async (req, res) => {
  try {
    const config = await Settings.findOne({ key: 'config' });
    const fexRate = config?.value?.fexRate || 0.7;
    res.json({ success: true, fexRate });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/user/convert-fex ──────────────────────────
router.post('/convert-fex', requireAuth, async (req, res) => {
  try {
    const { fexAmount } = req.body;
    if (!fexAmount || isNaN(fexAmount) || Number(fexAmount) <= 0)
      return res.status(400).json({ error: 'Invalid FEX amount.' });
    const config = await Settings.findOne({ key: 'config' });
    const fexRate = config?.value?.fexRate || 0.7;
    const naira = parseFloat((Number(fexAmount) * fexRate).toFixed(2));
    res.json({
      success: true,
      fexAmount: parseFloat(fexAmount),
      fexRate,
      naira,
      summary: `🪙 ${fexAmount} FEX × ₦${fexRate} = ₦${naira.toLocaleString()}`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/user/initiate-korapay ─────────────────────
// Calls Korapay Collect API server-side — returns virtual bank
// account details so the frontend can show its OWN custom modal
// instead of Korapay's default popup widget.
router.post('/initiate-korapay', requireAuth, async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || Number(amount) <= 0)
      return res.status(400).json({ error: 'Invalid amount.' });
    
    const secretKey = process.env.KORAPAY_SECRET_KEY;
    if (!secretKey)
      return res.status(400).json({ error: 'Payment not configured.' });
    
    const reference = 'DEP_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
    const u = req.user;
    
    const response = await fetch('https://api.korapay.com/merchant/api/v1/charges/initialize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: Number(amount),
        currency: 'NGN',
        reference,
        customer: {
          name: u.username || 'User',
          email: u.email
        },
        channels: ['bank_transfer'],
        notification_url: process.env.KORAPAY_WEBHOOK_URL || `${process.env.APP_URL}/api/webhook/korapay`
      })
    });
    
    const result = await response.json();
    
    if (!result.status || !result.data) {
      console.error('[Korapay Init]', result);
      return res.status(400).json({ error: result.message || 'Failed to initialize payment. Try again.' });
    }
    
    const payData = result.data;
    const bankTransfer = payData.payment_options?.bank_transfer;
    
    res.json({
      success: true,
      reference: payData.reference,
      amount: payData.amount,
      currency: payData.currency,
      bankName: bankTransfer?.bank_name || null,
      accountNumber: bankTransfer?.account_number || null,
      accountName: bankTransfer?.account_name || u.username,
      expiresAt: bankTransfer?.expires_at || null,
    });
    
  } catch (err) {
    console.error('[Korapay Init Error]', err);
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
router.post('/withdraw', requireAuth, async (req, res) => {
  try {
    if (!requireVerified(req, res)) return;
    
    const { fexAmount } = req.body;
    const user = req.user;
    const config = await Settings.findOne({ key: 'config' });
    
    const fexRate = config?.value?.fexRate || 0.7;
    const minWithdraw = config?.value?.minWithdraw || 2000;
    const withdrawFee = config?.value?.withdrawFee || 0;
    
    if (!user.bankDetails?.accountNumber)
      return res.status(400).json({ error: 'Please bind your Bank Account first.' });
    if (!fexAmount || Number(fexAmount) <= 0)
      return res.status(400).json({ error: 'Invalid FEX amount.' });
    if (Number(fexAmount) > user.ib)
      return res.status(400).json({ error: 'Insufficient FEX balance.' });
    
    const nairaAmount = parseFloat((Number(fexAmount) * fexRate).toFixed(2));
    const minFex = Math.ceil(minWithdraw / fexRate);
    
    if (nairaAmount < minWithdraw)
      return res.status(400).json({
        error: `Minimum withdrawal is ₦${minWithdraw.toLocaleString()} (${minFex.toLocaleString()} FEX at current rate of ₦${fexRate}/FEX)`
      });
    
    const feeAmount = parseFloat(((nairaAmount * withdrawFee) / 100).toFixed(2));
    const netAmount = parseFloat((nairaAmount - feeAmount).toFixed(2));
    
    await User.findByIdAndUpdate(user._id, { $inc: { ib: -Number(fexAmount) } });
    
    await Activity.create({
      userId: user._id,
      type: 'Withdrawal',
      amount: fexAmount,
      desc: `Withdrawal — 🪙${fexAmount} FEX → ₦${netAmount.toLocaleString()} @ ₦${fexRate}/FEX`
    });
    
    const withdrawal = await Withdrawal.create({
      userId: user._id,
      username: user.username,
      amount: Number(fexAmount),
      nairaAmount,
      fexRate,
      fee: feeAmount,
      feePercentage: withdrawFee,
      netAmount,
      status: 'pending',
      bankDetails: user.bankDetails,
      remainingBalance: user.ib - Number(fexAmount)
    });
    
    res.json({
      success: true,
      message: `Withdrawal of 🪙${fexAmount} FEX (≈ ₦${netAmount.toLocaleString()}) submitted!`,
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
      userId: user._id,
      shareName: name,
      pricePaid: price,
      dailyIncome,
      duration,
      status: 'active',
      purchaseDate: new Date(),
      lastClaimDate: new Date()
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


// ─── GET /api/user/tasks ──────────────────────────────────
// All active tasks — with user's own submission status per task
router.get('/tasks', requireAuth, async (req, res) => {
  try {
    const now = new Date();
    
    // Only return active tasks that haven't expired
    const tasks = await Task.find({
      active: true,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    }).sort({ createdAt: -1 });
    
    // Fetch user's own submissions so we can mark done/pending tasks
    const userSubmissions = await TaskSubmission.find({ userId: req.user._id })
      .select('taskId status proof');
    
    const submissionMap = {};
    userSubmissions.forEach(s => { submissionMap[s.taskId.toString()] = s.status; });
    
    // Attach completion counts and user status to each task
    const counts = await TaskSubmission.aggregate([
      { $match: { taskId: { $in: tasks.map(t => t._id) }, status: 'approved' } },
      { $group: { _id: '$taskId', count: { $sum: 1 } } },
    ]);
    const countMap = {};
    counts.forEach(c => { countMap[c._id.toString()] = c.count; });
    
    const enriched = tasks.map(t => {
      const tid = t._id.toString();
      const completed = countMap[tid] || 0;
      const maxHit = t.maxCompletions > 0 && completed >= t.maxCompletions;
      const userStatus = submissionMap[tid] || null; // null = not submitted yet
      
      return {
        ...t.toObject(),
        completedCount: completed,
        maxReached: maxHit,
        userStatus, // 'pending' | 'approved' | 'declined' | null
        canSubmit: !maxHit && (!userStatus || userStatus === 'declined'), // allow resubmit after decline
      };
    });
    
    res.json({ success: true, tasks: enriched });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/user/tasks/my-submissions ───────────────────
// User's own submission history
router.get('/tasks/my-submissions', requireAuth, async (req, res) => {
  try {
    const submissions = await TaskSubmission.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .populate('taskId', 'title points category proofType platform taskLink');
    
    res.json({ success: true, submissions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/user/tasks/:id/submit ─────────────────────
// Submit proof of task completion
router.post('/tasks/:id/submit', requireAuth, async (req, res) => {
  try {
    const { proof } = req.body;
    const task = await Task.findById(req.params.id);
    
    if (!task) return res.status(404).json({ error: 'Task not found.' });
    if (!task.active) return res.status(400).json({ error: 'This task is no longer active.' });
    
    // Check expiry
    if (task.expiresAt && new Date() > task.expiresAt)
      return res.status(400).json({ error: 'This task has expired.' });
    
    // Check max completions
    if (task.maxCompletions > 0) {
      const approvedCount = await TaskSubmission.countDocuments({ taskId: task._id, status: 'approved' });
      if (approvedCount >= task.maxCompletions)
        return res.status(400).json({ error: 'This task has reached its maximum completions.' });
    }
    
    // Check if user already submitted
    const existing = await TaskSubmission.findOne({ taskId: task._id, userId: req.user._id });
    if (existing) {
      if (existing.status === 'pending')
        return res.status(400).json({ error: 'You already submitted this task. Awaiting review.' });
      if (existing.status === 'approved')
        return res.status(400).json({ error: 'You already completed this task.' });
      // If declined — allow re-submission by updating existing doc
      existing.proof = proof || '';
      existing.status = 'pending';
      existing.adminNote = '';
      existing.penalty = 0;
      existing.createdAt = new Date();
      await existing.save();
      
      await Activity.create({
        userId: req.user._id,
        type: 'Task',
        amount: 0,
        desc: `Re-submitted task: ${task.title}`,
      });
      
      return res.json({ success: true, submission: existing, message: 'Task re-submitted for review!' });
    }
    
    // Require proof if task demands it
    if (task.proofType !== 'none' && !proof?.trim())
      return res.status(400).json({ error: 'Please provide proof to submit this task.' });
    
    const submission = await TaskSubmission.create({
      taskId: task._id,
      userId: req.user._id,
      proof: proof || '',
      status: 'pending',
      points: task.points,
    });
    
    await Activity.create({
      userId: req.user._id,
      type: 'Task',
      amount: 0,
      desc: `Submitted task: ${task.title}`,
    });
    
    res.json({ success: true, submission, message: 'Task submitted! Awaiting admin review.' });
  } catch (err) {
    // Duplicate key error = already submitted
    if (err.code === 11000)
      return res.status(400).json({ error: 'You already submitted this task.' });
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/user/collect-earnings ─────────────────────
router.post('/collect-earnings', requireAuth, async (req, res) => {
  try {
    const uid = req.user._id;
    const investments = await PurchasedShare.find({ userId: uid, status: 'active' });
    if (!investments.length) return res.json({ success: true, credited: 0 });
    const now = new Date();
    let totalToCredit = 0;
    const updates = [];
    const toDelete = [];
    for (const share of investments) {
      const lastClaim = share.lastClaimDate || share.purchaseDate;
      const daysToClaim = Math.floor((now - lastClaim) / (1000 * 60 * 60 * 24));
      const daysPassed = Math.floor((now - share.purchaseDate) / (1000 * 60 * 60 * 24));
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
    const uid = req.user._id.toString();
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
      level1: { count: level1.length, users: level1 },
      level2: { count: level2Users.length, users: level2Users },
      level3: { count: level3Users.length, users: level3Users },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/user/spin ─────────────────────────────────
router.post('/spin', requireAuth, async (req, res) => {
  try {
    if (!requireVerified(req, res)) return;
    const user = await User.findById(req.user._id);
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
    const prizes = wheelSettings?.value?.prizes || [];
    const randomIndex = Math.floor(Math.random() * prizes.length);
    const win = prizes[randomIndex] || { value: 0, label: 'Empty' };
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
    const user = req.user;
    if (user.lastCheckIn === today)
      return res.status(400).json({ error: 'Already claimed today! Come back tomorrow.' });
    const config = await Settings.findOne({ key: 'config' });
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
    const verifyUrl = `${process.env.APP_URL}/api/auth/verify-email?token=${verifyToken}`;
    res.json({ success: true, message: 'Verification email sent! Check your inbox.' });
    resend.emails.send({
      from: process.env.EMAIL_FROM || 'Flux Mall <noreply@fluxmall.online>',
      to: user.email,
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
    const isAvailable = chatSettings?.value?.available !== false;
    const officeHours = chatSettings?.value?.officeHours;
    const autoReply = chatSettings?.value?.autoReply || '';
    if (!isAvailable)
      return res.json({ success: true, offline: true, offlineMsg: '🔒 Chat is currently unavailable. Please try again later.' });
    if (officeHours?.enabled) {
      const now = new Date();
      const hour = now.getHours();
      const open = parseInt(officeHours.open || '9');
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
    await ChatMessage.updateMany({ sessionId: session._id, sender: 'admin', read: false }, { read: true });
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
        sessionId: session._id,
        sender: 'user',
        type: 'text',
        content: content === 'yes' ? '✅ Yes' : '❌ No',
      });
      await ChatSession.findByIdAndUpdate(session._id, {
        lastMessage: content === 'yes' ? '✅ Yes' : '❌ No',
        lastMessageAt: new Date(),
        $inc: { unreadAdmin: 1 }
      });
      notifyAdmin(req.user.username, content === 'yes' ? '✅ Yes' : '❌ No').catch(() => {});
      return res.json({ success: true, message: msg });
    }
    const msg = await ChatMessage.create({
      sessionId: session._id,
      sender: 'user',
      type: type || 'text',
      content: content || '',
      imageUrl: imageUrl || '',
      replyTo: replyTo || {},
    });
    const preview = type === 'image' ? '📷 Image' : content?.substring(0, 60) || '';
    await ChatSession.findByIdAndUpdate(session._id, {
      lastMessage: preview,
      lastMessageAt: new Date(),
      $inc: { unreadAdmin: 1 }
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
    const config = await Settings.findOne({ key: 'config' });
    const siteName = config?.value?.siteName || 'Flux Mall';
    const adminPanelUrl = process.env.APP_URL ?
      `${process.env.APP_URL}/cpanel/admin.html` :
      'https://fluxmall.online/cpanel/admin.html';
    await resend.emails.send({
      from: process.env.EMAIL_FROM || `${siteName} <noreply@fluxmall.online>`,
      to: admin.email,
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
    const s = doc?.value || {};
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
    await Typing.findOneAndUpdate({ sessionId: session._id, sender: 'user' }, { sessionId: session._id, sender: 'user', updatedAt: new Date() }, { upsert: true });
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