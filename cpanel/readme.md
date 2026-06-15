# 📢 User Campaign Feature — Integration Guide

## Overview
This feature lets users create their own "campaigns" (tasks for other users to complete) with a full approval flow, escrow fees, abuse protection, and admin monitoring.

---

## Files Delivered

| File | Purpose |
|------|---------|
| `campaign-backend-additions.js` | All backend routes + model schema |
| `admin-campaigns-additions.html` | Admin UI: User Campaigns tab + Settings card + JS |
| `user-campaigns-additions.html` | User UI: Campaign creation modal + review tabs + JS |

---

## Step 1 — Add Models

In `models/Models.js`, add:

```js
const UserCampaignSchema = new mongoose.Schema({
  creatorId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  creatorName:    String,
  title:          { type: String, required: true },
  description:    { type: String, required: true },
  instructions:   { type: String, default: '' },
  proofType:      { type: String, enum: ['screenshot','url','text','none'], default: 'screenshot' },
  taskLink:       { type: String, default: '' },
  platform:       { type: String, default: '' },
  category:       { type: String, default: 'General' },
  targetReach:    { type: Number, required: true },
  rewardPerUser:  { type: Number, required: true },
  creationFee:    { type: Number, default: 0 },
  reachFeeTotal:  { type: Number, default: 0 },
  totalCharged:   { type: Number, default: 0 },
  adminStatus:    { type: String, enum: ['pending','approved','declined'], default: 'pending' },
  adminNote:      { type: String, default: '' },
  reviewedAt:     Date,
  active:         { type: Boolean, default: false },
  expiresAt:      Date,
  totalDeclines:  { type: Number, default: 0 },
  warnedAt:       Date,
  declineBanUntil: Date,
}, { timestamps: true });

const UserCampaignSubmissionSchema = new mongoose.Schema({
  campaignId:   { type: mongoose.Schema.Types.ObjectId, ref: 'UserCampaign', required: true },
  doerId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  proof:        { type: String, default: '' },
  status:       { type: String, enum: ['pending','approved','declined'], default: 'pending' },
  creatorNote:  { type: String, default: '' },
  reviewedAt:   Date,
  rewarded:     { type: Boolean, default: false },
  rewardAmt:    { type: Number, default: 0 },
}, { timestamps: true });
UserCampaignSubmissionSchema.index({ campaignId: 1, doerId: 1 }, { unique: true });

module.exports.UserCampaign = mongoose.model('UserCampaign', UserCampaignSchema);
module.exports.UserCampaignSubmission = mongoose.model('UserCampaignSubmission', UserCampaignSubmissionSchema);
```

---

## Step 2 — Backend Routes

### User Server (`userRoutes.js` or similar)

Add to requires at top:
```js
const { UserCampaign, UserCampaignSubmission } = require('../models/Models');
```

Then paste all routes from **`campaign-backend-additions.js`** under section **"2. USER ROUTES"** into your user router file.

New endpoints added:
- `GET  /api/user/campaigns/settings`   — eligibility requirements
- `GET  /api/user/campaigns/eligibility` — check if user can create
- `POST /api/user/campaigns`            — create campaign (charges FEX)
- `GET  /api/user/campaigns/mine`       — creator's own campaigns
- `GET  /api/user/campaigns/active`     — live campaigns to do
- `GET  /api/user/campaigns/:id/submissions` — creator reviews submissions
- `PUT  /api/user/campaigns/:id/submissions/:subId` — approve/decline
- `POST /api/user/campaigns/:id/submit` — doer submits proof

### Admin Server (`adminRoutes.js`)

Add to requires:
```js
const { UserCampaign, UserCampaignSubmission } = require('../models/Models');
```

Paste all routes from **`campaign-backend-additions.js`** under section **"3. ADMIN ROUTES"** into your admin router.

New endpoints added:
- `GET    /api/admin/campaigns`          — all campaigns (filterable by status)
- `PUT    /api/admin/campaigns/:id`      — approve/decline (refunds on decline)
- `DELETE /api/admin/campaigns/:id`      — delete + refund
- `GET    /api/admin/campaigns/:id/submissions` — view submissions for a campaign
- `GET    /api/admin/campaigns/settings` — get campaign settings
- `PUT    /api/admin/campaigns/settings` — save campaign settings

---

## Step 3 — Admin Panel (admin.html)

### 3a. Add sidebar nav item
Find the sidebar `<ul class="side-menu">` and add:
```html
<li><a class="nav-item" href="#tasks"><i class='bx bx-megaphone'></i><span>Campaigns</span></a></li>
```
(Or reuse the existing tasks nav and add the tab inside)

### 3b. Fix/add User Campaigns tab button
Inside the `#tasks` page, inside `<div class="tabs-header">`, replace the broken third tab with:
```html
<button class="tab-btn" onclick="switchTab('tasks-usercampaigns',this)">
  <i class="ri-megaphone-line"></i><span>User Campaigns</span>
  <span class="tab-count" id="atTcUserCampaigns">0</span>
</button>
```

### 3c. Add tab panel
After the `#panel-tasks-submissions` closing div, add the User Campaigns panel from **`admin-campaigns-additions.html`** (the `<div class="tab-panel" id="panel-tasks-usercampaigns">` block).

### 3d. Add campaign settings card
Inside the Settings page, paste the Campaign Settings card from **`admin-campaigns-additions.html`** into any `settings-grid` div (recommended: under "Platform Controls").

### 3e. Add JavaScript
Paste the `<script id="admin-campaigns-js">` block from **`admin-campaigns-additions.html`** before `</body>` in admin.html.

### 3f. Call loaders in your existing init
In your `refreshAll()` or page init function, add:
```js
atLoadUserCampaigns();
loadCampaignSettings();
```

---

## Step 4 — User Panel (user.html)

### 4a. Replace tasks tab buttons
Find `<div class="main-tabs">` inside the `#tasks` page and replace with the extended version from **`user-campaigns-additions.html`** (adds "Campaigns" and "My Campaigns" tabs).

### 4b. Add new tab panels
After the existing `#ut-panel-history` closing div, add the two new panels from **`user-campaigns-additions.html`**.

### 4c. Add modals
Paste the two modal divs (`#utCampaignModal` and `#utCampSubsModal`) anywhere inside `<body>`.

### 4d. Add JavaScript
Paste the `<script>` block from **`user-campaigns-additions.html`** before `</body>`.

---

## How the Feature Works (Full Flow)

```
User wants to create a campaign
  → Opens "My Campaigns" tab → clicks "Create Campaign"
  → Modal checks eligibility via /api/user/campaigns/eligibility
    ✗ Not verified? → blocked with message
    ✗ < minReferrals? → blocked with count shown
    ✗ < minShares? → blocked with count shown
    ✗ Currently banned? → blocked with ban expiry date
  → User fills form → fee preview updates live
  → Submit → FEX deducted immediately → adminStatus: 'pending'

Admin reviews in Tasks → User Campaigns tab
  → Approve → campaign goes live (active: true)
             → creator notified
  → Decline → creator refunded fully
             → creator notified with reason

Campaign live for other users (not creator)
  → Appears in "Campaigns" tab
  → Spots tracker shows remaining slots
  → User submits proof → status: 'pending'
  → Creator gets notification

Creator reviews in "My Campaigns" tab
  → Approve submission → doer gets rewardPerUser FEX
  → Decline submission → no FEX lost by doer
                       → creator's decline counter incremented
                       → at ½ maxDeclineBeforeBan → WARNING notification
                       → at maxDeclineBeforeBan → BANNED (days set by admin)
                                                → campaign DELETED
                                                → creator notified

Admin can at any point:
  → View all campaigns + submission counts
  → Delete any campaign (refunds creator)
  → Adjust all settings (fees, requirements, ban days)
```

---

## Default Settings (configurable in Admin → Settings → User Campaign Settings)

| Setting | Default | Description |
|---------|---------|-------------|
| Min Referrals | 3 | Referrals needed to create a campaign |
| Min Shares | 2 | Share packages needed |
| Creation Fee | 500 FEX | One-time fee on submission |
| Platform Fee | 10% | % on top of reach pool |
| Max Declines Before Ban | 3 | Total declines triggering ban |
| Ban Duration | 7 days | How long the creator is banned |
