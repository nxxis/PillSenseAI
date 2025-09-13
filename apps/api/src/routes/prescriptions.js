// apps/api/src/routes/prescriptions.js
import { Router } from 'express';
import Joi from 'joi';
import { Prescription } from '../models/Prescription.js';

const router = Router();

/**
 * GET /api/prescriptions/active
 * List active prescriptions for the logged-in user.
 */
router.get('/active', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId)
      return res.status(401).json({ ok: false, error: 'unauthorized' });

    const docs = await Prescription.find({ userId, endsAt: null })
      .sort({ createdAt: -1 })
      .lean();

    res.json({ ok: true, data: docs });
  } catch (e) {
    console.error('[Prescriptions] active error:', e);
    res.status(500).json({ ok: false, error: 'list_failed' });
  }
});

/**
 * PATCH /api/prescriptions/:id/end
 * End a prescription (mark inactive).
 */
const endSchema = Joi.object({
  reason: Joi.string().max(200).optional(),
});
router.patch('/:id/end', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId)
      return res.status(401).json({ ok: false, error: 'unauthorized' });

    const { error } = endSchema.validate(req.body || {});
    if (error) return res.status(400).json({ ok: false, error: error.message });

    const doc = await Prescription.findOne({ _id: req.params.id, userId });
    if (!doc) return res.status(404).json({ ok: false, error: 'not_found' });

    if (doc.endsAt) {
      // already ended
      return res.json({ ok: true, data: doc });
    }

    doc.endsAt = new Date();
    doc.flags = {
      ...(doc.flags || {}),
      endReason: req.body?.reason || 'ended_by_user',
    };
    await doc.save();

    res.json({ ok: true, data: doc });
  } catch (e) {
    console.error('[Prescriptions] end error:', e);
    res.status(500).json({ ok: false, error: 'end_failed' });
  }
});

/**
 * (Optional) POST /api/prescriptions
 * Manually add a prescription; prevents duplicates by (drugKey, doseMg, frequencyPerDay).
 */
const createSchema = Joi.object({
  drug: Joi.string().required(),
  doseMg: Joi.number().min(0).required(),
  frequencyPerDay: Joi.number().min(1).max(24).required(),
  startedAt: Joi.string().isoDate().optional(),
});
router.post('/', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId)
      return res.status(401).json({ ok: false, error: 'unauthorized' });

    const { error, value } = createSchema.validate(req.body || {});
    if (error) return res.status(400).json({ ok: false, error: error.message });

    const drugKey = (value.drug || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');

    const existing = await Prescription.findOne({
      userId,
      drugKey,
      doseMg: value.doseMg,
      frequencyPerDay: value.frequencyPerDay,
      endsAt: null,
    }).lean();

    if (existing) {
      return res.json({ ok: true, duplicate: true, data: existing });
    }

    const doc = await Prescription.create({
      userId,
      drug: value.drug,
      doseMg: value.doseMg,
      frequencyPerDay: value.frequencyPerDay,
      startedAt: value.startedAt ? new Date(value.startedAt) : new Date(),
      flags: {},
      source: 'manual',
    });

    res.json({ ok: true, data: doc });
  } catch (e) {
    console.error('[Prescriptions] create error:', e);
    res.status(500).json({ ok: false, error: 'create_failed' });
  }
});

export default router;
