# 🛍️ Flux Mall

A full-stack flash sales and investment platform built with **Node.js + Express + MongoDB**, migrated from Firebase. Features user authentication, wallet system, referral commissions, investment shares, spin wheel, admin panel and more.

---

## 🌐 Live Deployment

| Service | URL |
|---|---|
| Frontend (Netlify) | `https://your-site.netlify.app` |
| Backend API (Render) | `https://your-api.onrender.com` |
| Custom Domain | `https://www.yourdomain.com` |

---

## 📁 Project Structure

```
flux-mall/
├── account/
│   ├── account.html        ← Login, Signup, Forgot Password pages
│   ├── account.css         ← Account page styles
│   └── script.js           ← Auth API calls (no Firebase)
│
├── cpanel/
│   ├── admin.html          ← Admin dashboard
│   ├── style.css           ← Admin styles
│   └── script.js           ← Admin API calls
│
├── public/
│   ├── index.html          ← User dashboard
│   ├── style.css           ← Dashboard styles
│   └── script.js           ← Dashboard API calls
│
├── server/
│   ├── index.js            ← Express entry point
│   ├── models/
│   │   ├── User.js         ← User schema
│   │   └── Models.js       ← Deposit, Withdrawal, Share, Settings etc.
│   ├── routes/
│   │   ├── auth.js         ← Signup, Login, Logout, Password Reset
│   │   ├── user.js         ← Dashboard features
│   │   └── admin.js        ← Admin features
│   └── middleware/
│       └── auth.js         ← JWT middleware
│
├── .env                    ← Never push this to GitHub!
├── .gitignore
├── netlify.toml            ← Netlify proxy config
├── _redirects              ← Netlify redirect rules
└── package.json
```

---

## ⚙️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML, CSS, Vanilla JavaScript |
| Backend | Node.js, Express.js |
| Database | MongoDB Atlas (Mongoose) |
| Auth | JWT (httpOnly cookies) |
| Email | Nodemailer (Gmail) |
| Frontend Host | Netlify |
| Backend Host | Render |
| Domain | Hostinger |

---

## 🚀 Local Development Setup

### 1. Clone the repo
```bash
git clone https://github.com/YOURUSERNAME/flux-mall.git
cd flux-mall
```

### 2. Install dependencies
```bash
npm install
```

### 3. Create `.env` file
```env
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/flux-mall
JWT_SECRET=your_long_random_secret
ADMIN_JWT_SECRET=another_long_random_secret
PORT=3000
EMAIL_USER=youremail@gmail.com
EMAIL_PASS=your_gmail_app_password
APP_URL=http://localhost:3000
SESSION_HOURS=8
```

### 4. Start the server
```bash
# Development (auto-restart)
npm run dev

# Production
npm start
```

### 5. Open in browser
```
http://localhost:3000/account/account.html   ← Login/Signup
http://localhost:3000/index.html             ← User Dashboard
http://localhost:3000/cpanel/admin.html      ← Admin Panel
```

---

## ☁️ Deployment Guide

### Backend → Render

1. Go to [render.com](https://render.com) → **New Web Service**
2. Connect your GitHub repo
3. Configure:
   - **Build Command:** `npm install`
   - **Start Command:** `node server/index.js`
4. Add environment variables in Render dashboard:

| Key | Value |
|---|---|
| `MONGO_URI` | Your MongoDB Atlas URI |
| `JWT_SECRET` | Strong random string |
| `ADMIN_JWT_SECRET` | Strong random string |
| `EMAIL_USER` | Your Gmail address |
| `EMAIL_PASS` | Gmail App Password |
| `APP_URL` | Your Render URL |
| `NETLIFY_URL` | Your Netlify URL |
| `CUSTOM_DOMAIN` | Your custom domain |
| `SESSION_HOURS` | `8` |

5. Deploy and copy your Render URL

### Frontend → Netlify

1. Update `netlify.toml` and `_redirects` with your Render URL
2. Go to [netlify.com](https://netlify.com) → **Add new site** → **Import from GitHub**
3. Settings:
   - **Build command:** leave empty
   - **Publish directory:** `.`
4. Deploy!

### Custom Domain → Hostinger + Netlify

1. On **Netlify** → Domain settings → Add custom domain
2. On **Hostinger** → DNS → Change nameservers to:
```
dns1.p04.nsone.net
dns2.p04.nsone.net
dns3.p04.nsone.net
dns4.p04.nsone.net
```
3. Wait 24–48 hours for DNS propagation

---

## 🔗 API Reference

### Auth (Public)
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/signup` | Register new user |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/me` | Get current session |
| POST | `/api/auth/forgot-password` | Send reset email |
| POST | `/api/auth/reset-password` | Reset password |
| GET | `/api/auth/verify-email?token=` | Verify email |
| GET | `/api/auth/referrer/:id` | Get referrer username |

### User (🔒 Protected)
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/user/profile` | Get user profile |
| GET | `/api/user/config` | Site config, theme, announcement |
| POST | `/api/user/deposit` | Submit deposit |
| GET | `/api/user/deposits` | Get user deposits |
| POST | `/api/user/withdraw` | Request withdrawal |
| GET | `/api/user/withdrawals` | Get user withdrawals |
| PUT | `/api/user/bank-details` | Save bank details |
| GET | `/api/user/shares` | Get available shares |
| POST | `/api/user/buy-share` | Purchase a share |
| GET | `/api/user/my-investments` | Get user investments |
| POST | `/api/user/collect-earnings` | Auto-collect daily profits |
| GET | `/api/user/team` | Get referral team (3 levels) |
| GET | `/api/user/activity` | Activity history |
| GET | `/api/user/notifications` | Get notifications |
| POST | `/api/user/spin` | Execute spin wheel |
| POST | `/api/user/checkin` | Daily check-in bonus |
| GET | `/api/user/deposit-amounts` | Preset deposit amounts |

### Admin (🔒 Admin Only)
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/admin/login` | Admin login |
| GET | `/api/admin/analytics` | Full analytics + stats |
| GET | `/api/admin/deposits` | All deposits |
| PUT | `/api/admin/deposits/:id` | Approve / Decline deposit |
| DELETE | `/api/admin/deposits/:id` | Delete deposit |
| GET | `/api/admin/withdrawals` | All withdrawals |
| PUT | `/api/admin/withdrawals/:id` | Approve / Decline withdrawal |
| GET | `/api/admin/users` | All users with stats |
| PUT | `/api/admin/users/:id` | Update user |
| DELETE | `/api/admin/users/:id` | Delete user |
| POST | `/api/admin/users/adjust-balance` | Credit / Debit balance |
| POST | `/api/admin/create-user` | Create user as admin |
| GET | `/api/admin/settings` | Get all settings |
| PUT | `/api/admin/settings/:key` | Update setting |
| GET/POST/PUT/DELETE | `/api/admin/shares` | Manage shares |
| GET/POST/DELETE | `/api/admin/deposit-amounts` | Manage deposit amounts |

---

## ✨ Features

### User Features
- 🔐 Secure JWT authentication (httpOnly cookies)
- 📧 Email verification + password reset
- 💰 Wallet system (deposit, withdraw, balance)
- 🏦 Bank details management with admin lock
- 🎡 Spin wheel with configurable prizes
- 📈 Investment shares with auto daily profit collection
- 👥 3-level referral system with commission
- 📋 Daily check-in bonus
- 🔔 Real-time notifications (polling)
- 🌙 Dark / Light theme support

### Admin Features
- 📊 Analytics dashboard with charts
- ✅ Approve / decline deposits and withdrawals
- 👤 User management (ban, balance adjust, delete)
- ⚙️ Site settings (branding, theme, announcements)
- 💳 Payment config (Manual bank or Korapay)
- 🎡 Wheel prize configuration
- 📢 Global announcements
- 🔒 Global bank lock toggle
- 📤 CSV export
- 💸 3-level referral commission (configurable rates)

---

## 🔒 Security Notes

- Passwords hashed with **bcryptjs** (12 rounds)
- JWT stored in **httpOnly cookies** (not localStorage)
- **3 failed login attempts** → account auto-banned
- Admin uses a **separate JWT secret**
- `.env` is gitignored — never committed to GitHub
- MongoDB Atlas IP whitelist recommended for production

---

## 📧 Gmail App Password Setup

Gmail requires an App Password (not your real password):

1. Go to [myaccount.google.com](https://myaccount.google.com)
2. **Security** → Enable **2-Step Verification**
3. Search **App Passwords**
4. Generate for **Mail** → **Other**
5. Use the 16-character code as `EMAIL_PASS`

---

## 🛠️ Create First Admin

1. Sign up normally through the account page
2. Open MongoDB Compass or Atlas and run:
```js
db.users.updateOne(
  { email: "youremail@gmail.com" },
  { $set: { role: "admin" } }
)
```
3. Log into `/cpanel/admin.html` with that email

---

## 🤝 Firebase → MongoDB Migration Summary

| Firebase | MongoDB / Node.js |
|---|---|
| `user.uid` | `user._id` |
| `serverTimestamp()` | Auto `createdAt` via Mongoose |
| `onSnapshot()` | Polling every 15-30s |
| `increment(n)` | `$inc: { field: n }` |
| Firebase Auth session | JWT in httpOnly cookie |
| `sendEmailVerification()` | Nodemailer |
| `sendPasswordResetEmail()` | Nodemailer + JWT link |

---

## 📄 License

MIT — Built by Wisdom 🚀
