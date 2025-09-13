import { Router } from 'express';
import Joi from 'joi';
import { User } from '../models/User.js';

const router = Router();

// Accept HTML date input format YYYY-MM-DD and a small set of genders
const schema = Joi.object({
  dobISO: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .required(), // e.g., 1995-06-15
  gender: Joi.string()
    .valid('male', 'female', 'other', 'unspecified')
    .required(),
});

function computeAgeYears(dobStr) {
  if (!dobStr) return null;
  const dob = new Date(dobStr);
  if (isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const m = now.getUTCMonth() - dob.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < dob.getUTCDate())) age--;
  return age >= 0 ? age : null;
}

// GET /api/profile
router.get('/', async (req, res) => {
  try {
    const user = await User.findById(req.user.id).lean();
    if (!user) return res.status(404).json({ ok: false, error: 'not_found' });
    const ageYears = computeAgeYears(user.dobISO);
    res.json({
      ok: true,
      profile: { dobISO: user.dobISO, gender: user.gender, ageYears },
    });
  } catch (e) {
    console.error('[profile/get]', e);
    res.status(500).json({ ok: false, error: 'profile_get_failed' });
  }
});

// PUT /api/profile
router.put('/', async (req, res) => {
  try {
    const { error, value } = schema.validate(req.body || {});
    if (error) return res.status(400).json({ ok: false, error: error.message });

    const updated = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { dobISO: value.dobISO, gender: value.gender } },
      { new: true }
    ).lean();

    if (!updated)
      return res.status(404).json({ ok: false, error: 'not_found' });

    const ageYears = computeAgeYears(updated.dobISO);
    res.json({
      ok: true,
      profile: { dobISO: updated.dobISO, gender: updated.gender, ageYears },
    });
  } catch (e) {
    console.error('[profile/put]', e);
    res.status(500).json({ ok: false, error: 'profile_put_failed' });
  }
});

export default router;
