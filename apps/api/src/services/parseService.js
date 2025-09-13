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
    return [];
  }

  // require some RX signals
  if (!hasRxSignals(cleaned)) {
    return [];
  }

  // Improved: split by lines, extract meds per line
  const lines = cleaned
    .split(/\n|,|;/)
    .map((l) => l.trim())
    .filter(Boolean);
  const medRegex = /([A-Za-z][A-Za-z\-']{2,})[^\n]*?(\d{1,4})\s*mg\b([^\n]*)/i;
  const matches = [];
  for (const line of lines) {
    const match = medRegex.exec(line);
    if (match) {
      let drug = match[1].toLowerCase();
      let doseMg = Number(match[2]);
      let rest = match[3] || '';
      // Declare variables inside the loop
      let freqPerDay = 1;
      if (/once (?:daily|a day)/i.test(line)) freqPerDay = 1;
      else if (/(twice|bid|2x|2 times)/i.test(line)) freqPerDay = 2;
      else if (/(three times|tid|3x)/i.test(line)) freqPerDay = 3;
      else if (/(four times|qid|4x)/i.test(line)) freqPerDay = 4;
      else {
        const qh = /every\s+(\d{1,2})\s*(?:hours|hrs|h)/i.exec(line);
        if (qh) {
          const h = Number(qh[1]);
          if (h > 0 && h <= 24) freqPerDay = Math.max(1, Math.round(24 / h));
        }
      }
      let timing = null;
      if (/before meals?/i.test(line)) timing = 'before meals';
      else if (/after meals?/i.test(line)) timing = 'after meals';
      else if (/with food/i.test(line)) timing = 'with food';
      let flags = {};
      if (!COMMON_DRUGS.includes(drug)) {
        flags.unknownDrug = true;
      }
      matches.push({
        drug,
        doseMg,
        frequencyPerDay: freqPerDay,
        timing,
        flags,
      });
    }
  }

  // Fallback: if no matches, try single parse as before
  if (matches.length === 0) {
    // ...existing code for single parse...
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
    let drug = null;
    const nearMg = /([A-Za-z][A-Za-z\-']{2,})\s*\d{1,4}\s*mg/i.exec(cleaned);
    if (nearMg) drug = nearMg[1].toLowerCase();
    if (drug && !COMMON_DRUGS.includes(drug)) {
      drug = null;
    }
    let timing = null;
    if (/before meals?/i.test(cleaned)) timing = 'before meals';
    else if (/after meals?/i.test(cleaned)) timing = 'after meals';
    else if (/with food/i.test(cleaned)) timing = 'with food';
    if (drug || doseMatch) {
      matches.push({
        drug,
        doseMg: doseMatch ? Number(doseMatch[1]) : null,
        frequencyPerDay: freqPerDay,
        timing,
        flags: {},
      });
    }
  }

  // Only use Gemini if: key is set AND we already have signals
  // (Optional: you can extend this to support multiple meds with Gemini if needed)

  // If we still have nothing meaningful, mark low confidence
  if (matches.length === 0) {
    return [
      {
        drug: null,
        doseMg: null,
        frequencyPerDay: null,
        timing: null,
        flags: {
          lowConfidence: true,
          reason: 'no_strong_parse',
          confidence,
          wordsCount,
        },
      },
    ];
  }

  return matches;
}
