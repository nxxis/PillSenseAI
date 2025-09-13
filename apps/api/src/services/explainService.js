import { GoogleGenerativeAI } from '@google/generative-ai';

export function getGeminiClient() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY missing');
  return new GoogleGenerativeAI(key);
}

/**
 * Turn rule messages into a plain-language paragraph via Gemini.
 * Falls back to a safe template if no API key.
 */
export async function explainMessages(messages = []) {
  if (!messages?.length)
    return 'No major interactions or overdose concerns detected based on current inputs.';

  const bulletList = messages.map((m) => `- ${m.message}`).join('\n');
  if (!process.env.GEMINI_API_KEY) {
    return `Based on your medicines, here’s what we found:\n${bulletList}\nPlease consult your healthcare provider for personal advice.`;
  }

  try {
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = `
Summarize these medication safety notes in friendly, plain language (max 3 sentences).
Avoid absolute directives; recommend consulting a clinician if serious.

Notes:
${bulletList}
`;
    const res = await model.generateContent(prompt);
    return res.response.text().trim();
  } catch {
    return `Based on your medicines, here’s what we found:\n${bulletList}\nPlease consult your healthcare provider for personal advice.`;
  }
}
