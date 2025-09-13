import { Router } from 'express';
import { runChecks } from '../services/interactionService.js';

const router = Router();

// POST /api/interactions/check
// body: { meds: [{drug,doseMg,frequencyPerDay}], foods?: [string] }
router.post('/check', async (req, res) => {
  try {
    const { meds = [], foods = [] } = req.body || {};
    const messages = runChecks({ meds, foods });
    res.json({ ok: true, messages });
  } catch (e) {
    console.error('[Interactions] error:', e);
    res.status(500).json({ ok: false, error: 'check_failed' });
  }
});

export default router;
