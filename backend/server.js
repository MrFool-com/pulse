require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const connectDB = require('./config/db');
const { startPinger } = require('./cron/pinger');

const app = express();

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || '*',
}));
app.use(express.json());

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/pulse/auth',    require('./routes/auth'));
app.use('/api/pulse/monitors', require('./routes/monitors'));
app.use('/api/pulse/admin',   require('./routes/admin'));

// ── Health check (for Koyeb) ──────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// ── Serve frontend ────────────────────────────────────────────────────────────
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));

app.get('/',          (req, res) => res.sendFile(path.join(publicDir, 'index.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(publicDir, 'dashboard.html')));
app.get('/admin',     (req, res) => res.sendFile(path.join(publicDir, 'admin.html')));
app.get('/admin/panel', (req, res) => res.sendFile(path.join(publicDir, 'admin.html')));

// Catch-all → login
app.get('*', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`[server] Pulse running on port ${PORT}`);
    startPinger();
  });
});