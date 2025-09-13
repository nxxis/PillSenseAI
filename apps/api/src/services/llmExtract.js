// apps/api/src/services/llmExtract.js
import { GoogleGenerativeAI } from '@google/generative-ai';

const MODEL_TEXT = process.env.GEMINI_TEXT_MODEL || 'gemini-1.5-flash';
const MODEL_VISION = process.env.GEMINI_VISION_MODEL || 'gemini-1.5-flash';

const sysPrompt = `
You extract medications from prescriptions.
Return JSON ONLY with the shape:
{"medications":[{"drug":"string","doseMg":number,"frequencyPerDay":number}]}

Rules:
- drug: generic/brand name, lowercase
- doseMg: convert g/mcg to mg (e.g., 0.5 g -> 500 mg, 500 mcg -> 0.5 mg -> 1 if integer needed)
- frequencyPerDay: 1 for qd/once daily; 2=bid; 3=tid; 4=qid; "every X hours" => round(24/X)
- If multiple meds, include them all. If none, return {"medications":[]}.
- No text outside JSON.
`;

function toBase64(buffer) {
  return Buffer.isBuffer(buffer) ? buffer.toString('base64') : buffer;
}

function safeParseJSON(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

export async function llmExtractFromText(ocrText) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const genai = new GoogleGenerativeAI(apiKey);
  const model = genai.getGenerativeModel({
    model: MODEL_TEXT,
    systemInstruction: sysPrompt,
  });

  const r = await model.generateContent([
    { text: `OCR_TEXT:\n${ocrText}\n\nReturn JSON only.` },
  ]);
  const out = r.response.text().trim();
  return safeParseJSON(out);
}

export async function llmExtractFromImage(imageBuffer, mime = 'image/jpeg') {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const genai = new GoogleGenerativeAI(apiKey);
  const model = genai.getGenerativeModel({
    model: MODEL_VISION,
    systemInstruction: sysPrompt,
  });

  const r = await model.generateContent([
    { text: 'Extract all medications. Return JSON only.' },
    {
      inlineData: {
        mimeType: mime,
        data: toBase64(imageBuffer),
      },
    },
  ]);
  const out = r.response.text().trim();
  return safeParseJSON(out);
}
