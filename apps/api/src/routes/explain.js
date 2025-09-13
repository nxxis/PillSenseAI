import { Router } from 'express';
import { explainMessages } from '../services/explainService.js';

const router = Router();

// POST /api/explain
// body: { messages: [...] }
router.post('/', async (req, res) => {
  try {
    const { messages = [] } = req.body || {};
    const text = await explainMessages(messages);
    res.json({ ok: true, text });
  } catch (e) {
    console.error('[Explain] error:', e);
    res.status(500).json({ ok: false, error: 'explain_failed' });
  }
});

export default router;
