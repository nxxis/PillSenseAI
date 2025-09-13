import { GoogleGenerativeAI } from '@google/generative-ai';

function getGemini() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY missing');
  return new GoogleGenerativeAI(key);
}

/**
 * Ask Gemini Vision to read the image and return strict JSON.
 * @param {Buffer} buffer
 * @param {string} mimeType e.g. "image/jpeg" | "image/png"
 * @returns {Promise<{drug:string|null,doseMg:number|null,frequencyPerDay:number|null,uncertain:boolean,notes?:string}>}
 */
export async function extractFromImage(buffer, mimeType = 'image/jpeg') {
  const genAI = getGemini();
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const prompt = `
You are reading a prescription label or doctor's note image.
Return ONLY strict JSON:

{
  "drug": string|null,
  "doseMg": number|null,
  "frequencyPerDay": number|null,
  "uncertain": boolean
}

Rules:
- If text is unclear / not a prescription, set all fields to null and uncertain=true.
- Normalize dose to mg only (strip units).
- Map frequency text to number of times per day:
  - "once daily", "q24h" => 1
  - "twice daily", "BID", "2x/day" => 2
  - "TID" => 3
  - "QID" => 4
  - "every X hours" => round(24 / X), clamp 1..24
- Do not hallucinate drug names; if unsure, use null and uncertain=true.
`;

  const parts = [
    { text: prompt },
    {
      inlineData: {
        data: buffer.toString('base64'),
        mimeType: mimeType || 'image/jpeg',
      },
    },
  ];

  const res = await model.generateContent(parts);
  const raw = res.response.text().trim();

  // tolerate code fences
  const jsonStr = raw.replace(/```json|```/g, '').trim();

  try {
    const parsed = JSON.parse(jsonStr);
    // ensure shape
    return {
      drug: parsed?.drug ?? null,
      doseMg: parsed?.doseMg ?? null,
      frequencyPerDay: parsed?.frequencyPerDay ?? null,
      uncertain: Boolean(parsed?.uncertain),
    };
  } catch {
    // last resort: try to extract a JSON object substring
    const m = jsonStr.match(/\{[\s\S]*\}/);
    if (m) {
      const parsed = JSON.parse(m[0]);
      return {
        drug: parsed?.drug ?? null,
        doseMg: parsed?.doseMg ?? null,
        frequencyPerDay: parsed?.frequencyPerDay ?? null,
        uncertain: Boolean(parsed?.uncertain),
      };
    }
    return { drug: null, doseMg: null, frequencyPerDay: null, uncertain: true };
  }
}
