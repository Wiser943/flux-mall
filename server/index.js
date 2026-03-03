require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');

const app = express();

// ─── ALLOWED ORIGINS ──────────────────────────────────────
// Add your Netlify URL and custom domain here
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  process.env.NETLIFY_URL,       // e.g. https://flux-mall.netlify.app
  process.env.CUSTOM_DOMAIN,     // e.g. https://www.yourdomin.com
].filter(Boolean); // removes undefined entries

// ─── MIDDLEWARE ────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// ─── API ROUTES ───────────────────────────────────────────
app.use('/api/auth',  require('./routes/auth'));
app.use('/api/user',  require('./routes/user'));
app.use('/api/admin', require('./routes/admin'));
// ─── STATIC FILES (Local Development) ────────────────────
app.use(express.static(path.join(__dirname, '../')));
app.use('/account', express.static(path.join(__dirname, '../account')));
app.use('/cpanel', express.static(path.join(__dirname, '../cpanel')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../index.html'));
});
// ─── HEALTH CHECK (Render uses this to confirm server is up)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Flux Mall API is running' });
});

// ─── ROOT ─────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ message: 'Flux Mall API. Frontend is on Netlify.' });
});

// ─── MONGODB CONNECTION ───────────────────────────────────
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB Connected');
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });

module.exports = app;
