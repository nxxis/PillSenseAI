import { Router } from 'express';
import { runChecks } from '../services/interactionService.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const router = Router();

// POST /api/interactions/ai-check
// body: { meds: [{drug:string}] }
router.post('/ai-check', async (req, res) => {
  try {
    const { meds = [] } = req.body || {};
    if (!Array.isArray(meds) || meds.length === 0) {
      return res
        .status(400)
        .json({ ok: false, error: 'No medications provided.' });
    }
    const drugList = meds
      .map((m) => m.drug)
      .filter(Boolean)
      .join(', ');
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res
        .status(500)
        .json({ ok: false, error: 'Missing Gemini API key.' });
    }
    const genai = new GoogleGenerativeAI(apiKey);
    const model = genai.getGenerativeModel({
      model: process.env.GEMINI_TEXT_MODEL || 'gemini-1.5-flash',
    });
    const prompt = `Summarize in 1–2 short sentences, for a patient, any important risks or interactions between these medications: ${drugList}. If none, say 'No known interactions.'`;
    let tries = 0;
    let explanation = '';
    while (tries < 2) {
      try {
        const r = await model.generateContent([{ text: prompt }]);
        explanation = r.response.text().trim();
        return res.json({ ok: true, explanation });
      } catch (e) {
        if (e && e.status === 429) {
          return res.status(429).json({ ok: false, error: 'quota_exceeded' });
        }
        if (e && e.status === 503) {
          // Model overloaded, retry once after short delay
          tries++;
          if (tries < 2) {
            await new Promise((resolve) => setTimeout(resolve, 1500));
            continue;
          }
          return res.status(503).json({ ok: false, error: 'model_overloaded' });
        }
        return res.status(500).json({ ok: false, error: 'ai_check_failed' });
      }
    }
  } catch (e) {
    res.status(500).json({ ok: false, error: 'ai_check_failed' });
  }
});

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
