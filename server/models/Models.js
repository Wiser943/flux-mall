const mongoose = require('mongoose');

// ─── DEPOSIT ───────────────────────────────────────────────
const depositSchema = new mongoose.Schema({
  userId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount:  { type: Number, required: true },
  method:  { type: String, default: 'Bank Transfer' },
  refCode: { type: String, required: true },
  status:  { type: String, default: 'pending', enum: ['pending', 'success', 'declined'] },
}, { timestamps: true });

// ─── WITHDRAWAL ────────────────────────────────────────────
const withdrawalSchema = new mongoose.Schema({
  userId:           { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  username:         { type: String },
  amount:           { type: Number, required: true },
  fee:              { type: Number, default: 0 },
  feePercentage:    { type: Number, default: 0 },
  netAmount:        { type: Number },
  status:           { type: String, default: 'pending', enum: ['pending', 'success', 'declined'] },
  bankDetails:      { type: Object },
  remainingBalance: { type: Number },
}, { timestamps: true });

// ─── NOTIFICATION ──────────────────────────────────────────
const notificationSchema = new mongoose.Schema({
  userId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title:   { type: String, required: true },
  message: { type: String, required: true },
  read:    { type: Boolean, default: false },
}, { timestamps: true });

// ─── ACTIVITY LOG ──────────────────────────────────────────
const activitySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type:   { type: String },
  amount: { type: mongoose.Schema.Types.Mixed },
  desc:   { type: String },
}, { timestamps: true });

// ─── SHARE (Products Admin creates) ────────────────────────
const shareSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  price:       { type: Number, required: true },
  dailyIncome: { type: Number, required: true },
  duration:    { type: Number, required: true },
  img:         { type: String, default: '' },
}, { timestamps: true });

// ─── PURCHASED SHARE ───────────────────────────────────────
const purchasedShareSchema = new mongoose.Schema({
  userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  shareName:    { type: String },
  pricePaid:    { type: Number },
  dailyIncome:  { type: Number },
  duration:     { type: Number },
  status:       { type: String, default: 'active' },
  lastClaimDate:{ type: Date, default: Date.now },
  purchaseDate: { type: Date, default: Date.now },
}, { timestamps: true });

// ─── SETTINGS (single doc approach) ────────────────────────
const settingsSchema = new mongoose.Schema({
  key:   { type: String, unique: true, required: true },
  value: { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });

// ─── DEPOSIT AMOUNTS ───────────────────────────────────────
const depositAmtSchema = new mongoose.Schema({
  amount: { type: Number, required: true },
}, { timestamps: true });

module.exports = {
  Deposit:        mongoose.model('Deposit', depositSchema),
  Withdrawal:     mongoose.model('Withdrawal', withdrawalSchema),
  Notification:   mongoose.model('Notification', notificationSchema),
  Activity:       mongoose.model('Activity', activitySchema),
  Share:          mongoose.model('Share', shareSchema),
  PurchasedShare: mongoose.model('PurchasedShare', purchasedShareSchema),
  Settings:       mongoose.model('Settings', settingsSchema),
  DepositAmt:     mongoose.model('DepositAmt', depositAmtSchema),
};
