// apps/api/src/routes/ocr.js
import { Router } from 'express';
import multer from 'multer';

import { ocrImageBufferWithProgress } from '../services/ocrService.js';
import { parsePrescriptionText } from '../services/parseService.js';
import { extractFromImage } from '../services/geminiVision.js'; // requires GEMINI_API_KEY in .env

import { Prescription } from '../models/Prescription.js';
import { runChecks } from '../services/interactionService.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// In-memory job store (sufficient for hackathon/demo)
const jobs = new Map();
function newId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * POST /api/ocr/start
 * form-data: image (file)
 * Starts OCR in the background and immediately returns { jobId }.
 * Frontend should poll: GET /api/ocr/status/:jobId  -> { percent, status, done, data? }
 */
router.post('/start', upload.single('image'), async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ ok: false, error: 'image_required' });
    }

    const jobId = newId();
    jobs.set(jobId, {
      percent: 0,
      status: 'queued',
      done: false,
      error: null,
      data: null,
    });

    // Run OCR in the background (do not await)
    (async () => {
      try {
        // mark processing
        jobs.set(jobId, {
          ...jobs.get(jobId),
          status: 'processing',
          percent: 1,
        });

        // 1) OCR with progress (multi-variant, multi-psm/oem)
        const { text, confidence, wordsCount } =
          await ocrImageBufferWithProgress(
            req.file.buffer,
            (p /* 0..100 */) => {
              const cur = jobs.get(jobId);
              if (!cur || cur.done) return;
              jobs.set(jobId, {
                ...cur,
                percent: Math.max(cur.percent, Math.round(p)),
                status: 'processing', // keep it clean (no internal stage names)
              });
            }
          );

        // 2) Guardrailed parse (heuristics + optional Gemini text refine inside)
        let parsed = await parsePrescriptionText(text, {
          confidence,
          wordsCount,
        });

        // Is it usable enough to act on?
        let usable =
          (parsed.drug || parsed.doseMg || parsed.frequencyPerDay > 1) &&
          !parsed.flags?.lowConfidence;

        // 3) Gemini Vision fallback (for handwriting / poor OCR) — only if unusable and key exists
        if (!usable && process.env.GEMINI_API_KEY) {
          try {
            const mime = req.file.mimetype || 'image/jpeg';
            const g = await extractFromImage(req.file.buffer, mime);
            if (
              !g.uncertain &&
              (g.drug ||
                g.doseMg ||
                (g.frequencyPerDay && g.frequencyPerDay > 0))
            ) {
              parsed = {
                drug: g.drug,
                doseMg: g.doseMg,
                frequencyPerDay: g.frequencyPerDay || 1,
                flags: { ...(parsed.flags || {}), geminiVision: true },
              };
              usable = true;
            } else {
              parsed.flags = { ...(parsed.flags || {}), geminiUncertain: true };
            }
          } catch (e) {
            // Don't fail job on Gemini errors; record a flag and continue with OCR result
            parsed.flags = { ...(parsed.flags || {}), geminiError: true };
          }
        }

        let messages = [];
        let medsOut = [];
        if (usable && parsed) {
          if (Array.isArray(parsed)) {
            medsOut = parsed.filter((m) => m.drug && m.doseMg != null);
          } else if (parsed.drug && parsed.doseMg != null) {
            medsOut = [parsed];
          }
        }
        // Optionally run interaction/overdose checks for all parsed meds
        if (medsOut.length > 0) {
          messages = runChecks({ meds: medsOut });
        }

        // 5) Finalize job
        jobs.set(jobId, {
          ...jobs.get(jobId),
          percent: 100,
          status: 'done',
          done: true,
          data: {
            meds: medsOut,
            raw: { text, confidence, wordsCount },
            usable: Boolean(usable),
            messages,
          },
        });
      } catch (e) {
        console.error('[OCR job] error:', e);
        const cur = jobs.get(jobId) || {};
        jobs.set(jobId, {
          ...cur,
          status: 'error',
          done: true,
          error: 'ocr_failed',
        });
      }
    })();

    // respond immediately with job id
    res.json({ ok: true, jobId });
  } catch (e) {
    console.error('[OCR] start error:', e);
    res.status(500).json({ ok: false, error: 'start_failed' });
  }
});

/**
 * GET /api/ocr/status/:jobId
 * Returns: { ok, jobId, percent, status, done, data?, error? }
 */
router.get('/status/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ ok: false, error: 'not_found' });
  res.json({ ok: true, jobId: req.params.jobId, ...job });
});

export default router;
