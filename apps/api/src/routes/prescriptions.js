import { Router } from 'express';
import Joi from 'joi';
import { Prescription } from '../models/Prescription.js';
import { llmExtractFromText } from '../services/llmExtract.js';

const router = Router();

/**
 * POST /api/prescriptions/note
 * Get a Gemini-generated note for a medication name.
 * Body: { drug: string }
 */
import { GoogleGenerativeAI } from '@google/generative-ai';

router.post('/note', async (req, res) => {
  try {
    const { drug } = req.body || {};
    if (!drug || typeof drug !== 'string') {
      return res.status(400).json({ ok: false, error: 'Missing drug name.' });
    }
    // Use Gemini with a direct prompt for notes
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey)
      return res
        .status(500)
        .json({ ok: false, error: 'Missing Gemini API key.' });
    const genai = new GoogleGenerativeAI(apiKey);
    const model = genai.getGenerativeModel({
      model: process.env.GEMINI_TEXT_MODEL || 'gemini-1.5-flash',
    });
    const prompt = `Give a short, patient-friendly note about the medication '${drug}'. Limit to 2 sentences.`;
    try {
      const r = await model.generateContent([{ text: prompt }]);
      const note = r.response.text().trim();
      res.json({ ok: true, note });
    } catch (e) {
      // Detect Gemini quota error (429)
      if (e && e.status === 429) {
        console.error('[Prescriptions] Gemini quota error:', e);
        return res.status(429).json({ ok: false, error: 'quota_exceeded' });
      }
      // Detect Gemini model overload error (503)
      if (e && e.status === 503) {
        console.error('[Prescriptions] Gemini model overloaded:', e);
        return res.status(503).json({ ok: false, error: 'model_overloaded' });
      }
      console.error('[Prescriptions] note error:', e);
      res.status(500).json({ ok: false, error: 'note_failed' });
    }
  } catch (e) {
    console.error('[Prescriptions] note error:', e);
    res.status(500).json({ ok: false, error: 'note_failed' });
  }
});

/**
 * PATCH /api/prescriptions/:id/reactivate
 * Reactivate an ended prescription (set endsAt to null).
 */
const reactivateSchema = Joi.object({
  reason: Joi.string().max(200).optional(),
});
router.patch('/:id/reactivate', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId)
      return res.status(401).json({ ok: false, error: 'unauthorized' });

    const { error } = reactivateSchema.validate(req.body || {});
    if (error) return res.status(400).json({ ok: false, error: error.message });

    const doc = await Prescription.findOne({ _id: req.params.id, userId });
    if (!doc) return res.status(404).json({ ok: false, error: 'not_found' });

    if (!doc.endsAt) {
      // already active
      return res.json({ ok: true, data: doc });
    }

    doc.endsAt = null;
    doc.flags = {
      ...(doc.flags || {}),
      reactivateReason: req.body?.reason || 'reactivated_by_user',
    };
    await doc.save();

    res.json({ ok: true, data: doc });
  } catch (e) {
    console.error('[Prescriptions] reactivate error:', e);
    res.status(500).json({ ok: false, error: 'reactivate_failed' });
  }
});

/**
 * GET /api/prescriptions/all
 * List all prescriptions (active and ended) for the logged-in user.
 */
router.get('/all', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId)
      return res.status(401).json({ ok: false, error: 'unauthorized' });

    const docs = await Prescription.find({ userId })
      .sort({ createdAt: -1 })
      .lean();

    res.json({ ok: true, data: docs });
  } catch (e) {
    console.error('[Prescriptions] all error:', e);
    res.status(500).json({ ok: false, error: 'list_failed' });
  }
});

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
  timing: Joi.string().max(40).allow(null).optional(),
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
      timing: value.timing || null,
    }).lean();

    if (existing) {
      return res.json({ ok: true, duplicate: true, data: existing });
    }

    const doc = await Prescription.create({
      userId,
      drug: value.drug,
      drugKey,
      doseMg: value.doseMg,
      frequencyPerDay: value.frequencyPerDay,
      timing: value.timing || null,
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
