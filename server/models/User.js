const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, trim: true, minlength: 2, maxlength: 15 },
  email:    { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  role:     { type: String, default: 'user', enum: ['user', 'admin'] },

  // Wallet
  ib:        { type: Number, default: 1700 },
  refPoints: { type: Number, default: 0 },
  freeSpins: { type: Number, default: 1 },

  // Short User ID for referral links
  uid: { type: String, unique: true, sparse: true },

  // Referral System
  referrerId:      { type: String, default: null },
  referralAwarded: { type: Boolean, default: false },
  hasDeposited:    { type: Boolean, default: false },
  referralCompleted: { type: Boolean, default: false },

  // Account Status
  status:          { type: String, default: 'Active', enum: ['Active', 'Banned'] },
  banReason:       { type: String, default: null },
  emailVerified:   { type: Boolean, default: false },
  attempts:        { type: Number, default: 0 },

  // Bank Details
  bankDetails: {
    bankName:      { type: String, default: '' },
    accountNumber: { type: String, default: '' },
    accountName:   { type: String, default: '' },
    updatedAt:     { type: Date }
  },
  canEditBank: { type: Boolean, default: true },

  // Check-in / Spin
  lastCheckIn:  { type: String, default: null },
  lastSpinDate: { type: String, default: null },

}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);