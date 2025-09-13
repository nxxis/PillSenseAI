import { Router } from 'express';
import Joi from 'joi';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();

const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).max(100).required(),
  name: Joi.string().max(80).allow('', null),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).max(100).required(),
});

function signToken(user) {
  const payload = {
    sub: String(user._id),
    email: user.email,
    name: user.name || '',
  };
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
}

/**
 * POST /api/auth/register
 */
router.post('/register', async (req, res) => {
  try {
    const { error, value } = registerSchema.validate(req.body || {});
    if (error) return res.status(400).json({ ok: false, error: error.message });

    const email = String(value.email).toLowerCase().trim();
    const exists = await User.findOne({ email }).lean();
    if (exists)
      return res.status(409).json({ ok: false, error: 'email_in_use' });

    const passwordHash = await bcrypt.hash(value.password, 10);
    const user = await User.create({
      email,
      passwordHash,
      name: value.name || '',
    });

    const token = signToken(user);
    res.json({
      ok: true,
      token,
      user: { id: String(user._id), email: user.email, name: user.name },
    });
  } catch (e) {
    console.error('[auth/register]', e);
    res.status(500).json({ ok: false, error: 'register_failed' });
  }
});

/**
 * POST /api/auth/login
 */
router.post('/login', async (req, res) => {
  try {
    const { error, value } = loginSchema.validate(req.body || {});
    if (error) return res.status(400).json({ ok: false, error: error.message });

    const email = String(value.email).toLowerCase().trim();
    const user = await User.findOne({ email });
    if (!user)
      return res.status(401).json({ ok: false, error: 'invalid_credentials' });

    const ok = await bcrypt.compare(value.password, user.passwordHash);
    if (!ok)
      return res.status(401).json({ ok: false, error: 'invalid_credentials' });

    const token = signToken(user);
    res.json({
      ok: true,
      token,
      user: { id: String(user._id), email: user.email, name: user.name },
    });
  } catch (e) {
    console.error('[auth/login]', e);
    res.status(500).json({ ok: false, error: 'login_failed' });
  }
});

/**
 * GET /api/auth/me  (protected)
 */
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).lean();
    if (!user) return res.status(404).json({ ok: false, error: 'not_found' });
    res.json({
      ok: true,
      user: { id: String(user._id), email: user.email, name: user.name },
    });
  } catch (e) {
    console.error('[auth/me]', e);
    res.status(500).json({ ok: false, error: 'me_failed' });
  }
});

export default router;
