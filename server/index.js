require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const cors = require('cors');

const app = express();

// ─── MIDDLEWARE ────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      'http://localhost:3000',
'http://localhost:7700',
      'http://127.0.0.1:3000',
      'https://fluxmall.online',
      'https://www.fluxmall.online',
      process.env.NETLIFY_URL,
      process.env.CUSTOM_DOMAIN,
    ].filter(Boolean);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// ─── API ROUTES ───────────────────────────────────────────
app.use('/api/auth',  require('./routes/auth'));
app.use('/api/user',  require('./routes/user'));
app.use('/api/admin', require('./routes/admin'));

// ─── HEALTH CHECK ─────────────────────────────────────────
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