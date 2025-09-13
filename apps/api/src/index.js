// apps/api/src/index.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import { rateLimit, ipKeyGenerator } from 'express-rate-limit'; // <-- use named imports
import { connectDb } from './db.js';

import authRouter from './routes/auth.js';
import ocrRouter from './routes/ocr.js';
import interactionsRouter from './routes/interactions.js';
import explainRouter from './routes/explain.js';
import remindersRouter, { startReminderScheduler } from './routes/reminders.js';
import wss from './ws-server.js';
import profileRouter from './routes/profile.js';
import prescriptionsRouter from './routes/prescriptions.js';
import { requireAuth } from './middleware/requireAuth.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5050;
const isProd = process.env.NODE_ENV === 'production';

// ---------------- Security & CORS ----------------
app.use(helmet());
app.use(
  cors({
    origin: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(','),
    credentials: true,
  })
);

// If you run behind a proxy/load balancer, uncomment this so req.ip is correct
// app.set('trust proxy', 1);

// ---------------- Body Parsers ----------------
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ---------------- Route-Specific Rate Limiters ----------------
// Auth endpoints (protect against brute force; generous in dev)
// NOTE: no custom keyGenerator here -> default safely handles IPv6
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isProd ? 60 : 5000,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res
      .status(429)
      .json({ ok: false, error: 'rate_limited_auth', path: req.originalUrl });
  },
});

// OCR endpoints (heavier CPU; prefer per-user limiting, else per-IP with IPv6-safe helper)
const ocrLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isProd ? 30 : 5000,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req /*, res*/) => {
    return req.user?.id ? `user:${req.user.id}` : ipKeyGenerator(req.ip);
  },
  handler: (req, res) => {
    res
      .status(429)
      .json({ ok: false, error: 'rate_limited_ocr', path: req.originalUrl });
  },
});

// ---------------- Public Routes ----------------
app.use('/api/auth', authLimiter, authRouter); // /auth/register, /auth/login

// ---------------- Protected Routes ----------------
app.use('/api', requireAuth);

// Health (protected — move above requireAuth if you want it public)
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, env: process.env.NODE_ENV || 'dev' });
});

// Feature routes (all protected)
app.use('/api/profile', profileRouter); // GET/PUT profile (dobISO, gender, age)
app.use('/api/prescriptions', prescriptionsRouter); // active meds, end med
app.use('/api/ocr', ocrLimiter, ocrRouter); // OCR job + autosave + risk msgs
app.use('/api/interactions', interactionsRouter);
app.use('/api/explain', explainRouter);
app.use('/api/reminders', remindersRouter); // POST/GET/DELETE + /due

// ---------------- Start Server ----------------
(async () => {
  try {
    await connectDb();
    startReminderScheduler();
    // Start WebSocket server
    console.log('WebSocket server running at ws://localhost:5051');

    app.listen(PORT, () => {
      console.log(`API server running at http://localhost:${PORT}`);
    });
  } catch (e) {
    console.error('Failed to start server:', e);
    process.exit(1);
  }
})();
