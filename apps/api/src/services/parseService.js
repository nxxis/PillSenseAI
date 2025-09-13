import { getGeminiClient } from './explainService.js';

// words that suggest a legit label
const RX_KEYWORDS = [
  'mg',
  'tablet',
  'capsule',
  'take',
  'rx',
  'dosage',
  'dose',
  'every',
  'daily',
  'twice',
  'bid',
  'tid',
  'qid',
  'refill',
  'quantity',
  'prescribed',
];

// very basic drug name whitelist (expand over time)
const COMMON_DRUGS = [
  'ibuprofen',
  'acetaminophen',
  'paracetamol',
  'warfarin',
  'aspirin',
  'simvastatin',
  'metformin',
  'amoxicillin',
  'atorvastatin',
  'omeprazole',
];

function hasRxSignals(text) {
  const t = text.toLowerCase();
  const hasKeyword = RX_KEYWORDS.some((k) => t.includes(k));
  const hasMg = /\b\d{1,4}\s*mg\b/i.test(text);
  return hasKeyword || hasMg;
}

/**
 * Parse with guardrails. If low confidence / no signals, return nulls.
 * Optionally refine with Gemini if enabled, but only when signals exist.
 */
export async function parsePrescriptionText(
  rawText,
  meta = { confidence: 0, wordsCount: 0 }
) {
  const cleaned = (rawText || '').replace(/\s+/g, ' ').trim();
  const { confidence = 0, wordsCount = 0 } = meta;

  // HARD STOPS: not enough OCR content
  if (!cleaned || cleaned.length < 12 || wordsCount < 3 || confidence < 55) {
    return {
      drug: null,
      doseMg: null,
      frequencyPerDay: null,
      flags: {
        lowConfidence: true,
        reason: 'low_ocr_signal',
        confidence,
        wordsCount,
      },
    };
  }

  // require some RX signals
  if (!hasRxSignals(cleaned)) {
    return {
      drug: null,
      doseMg: null,
      frequencyPerDay: null,
      flags: {
        lowConfidence: true,
        reason: 'no_rx_signals',
        confidence,
        wordsCount,
      },
    };
  }

  // heuristic parse
  const doseMatch = /(\d{1,4})\s*mg\b/i.exec(cleaned);
  let freqPerDay = 1;
  if (/once (?:daily|a day)/i.test(cleaned)) freqPerDay = 1;
  else if (/(twice|bid|2x|2 times)/i.test(cleaned)) freqPerDay = 2;
  else if (/(three times|tid|3x)/i.test(cleaned)) freqPerDay = 3;
  else if (/(four times|qid|4x)/i.test(cleaned)) freqPerDay = 4;
  else {
    const qh = /every\s+(\d{1,2})\s*(?:hours|hrs|h)/i.exec(cleaned);
    if (qh) {
      const h = Number(qh[1]);
      if (h > 0 && h <= 24) freqPerDay = Math.max(1, Math.round(24 / h));
    }
  }

  // try to pick a drug only if it matches a whitelist OR is near “mg”
  let drug = null;
  const nearMg = /([A-Za-z][A-Za-z\-']{2,})\s*\d{1,4}\s*mg/i.exec(cleaned);
  if (nearMg) drug = nearMg[1].toLowerCase();
  if (drug && !COMMON_DRUGS.includes(drug)) {
    drug = null; // don’t guess unknown names
  }

  let parsed = {
    drug,
    doseMg: doseMatch ? Number(doseMatch[1]) : null,
    frequencyPerDay: freqPerDay,
    flags: {},
  };

  // Only use Gemini if: key is set AND we already have signals
  if (process.env.GEMINI_API_KEY) {
    try {
      const genAI = getGeminiClient();
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const prompt = `
Extract a prescription from this text ONLY if it's clearly a medication label/prescription.
If uncertain, return {"drug":null,"doseMg":null,"frequencyPerDay":null,"uncertain":true}.

Text:
"""${cleaned}"""

Return ONLY JSON.`;
      const res = await model.generateContent(prompt);
      const json = res.response
        .text()
        .trim()
        .replace(/```json|```/g, '');
      const llm = JSON.parse(json);

      // If LLM is uncertain, don’t fill anything
      if (!llm.uncertain) {
        parsed = {
          drug: llm.drug ?? parsed.drug,
          doseMg: llm.doseMg ?? parsed.doseMg,
          frequencyPerDay: llm.frequencyPerDay ?? parsed.frequencyPerDay,
          flags: {},
        };
      } else {
        parsed.flags.llmUncertain = true;
      }
    } catch {
      // ignore LLM failures
      parsed.flags.llmError = true;
    }
  }

  // If we still have nothing meaningful, mark low confidence
  if (!parsed.drug && !parsed.doseMg) {
    parsed.flags.lowConfidence = true;
    parsed.flags.reason = 'no_strong_parse';
  }

  return parsed;
}
