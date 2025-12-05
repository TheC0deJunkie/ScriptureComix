import { QuizResponse } from "../types";

// Groq integration helper
// NOTE: Never commit API keys into source. Set these in your environment or Vite .env files:
// VITE_GROQ_API_URL - base URL for Groq API (e.g. https://api.groq.example)
// VITE_GROQ_API_KEY - API key for Groq

const GROQ_API_URL = import.meta?.env?.VITE_GROQ_API_URL || import.meta?.env?.GROQ_API_URL || (typeof process !== 'undefined' ? process.env.GROQ_API_URL : undefined);
const GROQ_API_KEY = import.meta?.env?.VITE_GROQ_API_KEY || import.meta?.env?.GROQ_API_KEY || (typeof process !== 'undefined' ? process.env.GROQ_API_KEY : undefined);

if (!GROQ_API_URL || !GROQ_API_KEY) {
  // We don't throw at import time to allow server-side builds in environments
  // where the keys are intentionally absent. Callers should check and handle.
}

async function callGroq(prompt: string, opts: { maxTokens?: number; temperature?: number } = {}) {
  if (!GROQ_API_URL || !GROQ_API_KEY) {
    throw new Error('Missing Groq configuration. Set VITE_GROQ_API_URL and VITE_GROQ_API_KEY in your environment.');
  }

  const body = {
    prompt,
    max_tokens: opts.maxTokens || 512,
    temperature: typeof opts.temperature === 'number' ? opts.temperature : 0.2,
  };

  const res = await fetch(`${GROQ_API_URL.replace(/\/$/, '')}/v1/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Groq API error: ${res.status} ${text}`);
  }

  const data = await res.json();

  // Flexible parsing: some Groq endpoints return { choices: [{ text }] } or { output: '...' }
  if (data.choices && Array.isArray(data.choices) && data.choices[0]) {
    return data.choices[0].text || data.choices[0].message || JSON.stringify(data.choices[0]);
  }
  if (data.output_text) return data.output_text;
  if (data.output) return data.output;
  if (typeof data === 'string') return data;
  return JSON.stringify(data);
}

export const generateQuiz = async (book: string, chapter: number) : Promise<QuizResponse> => {
  const prompt = `Create a fun 3-question multiple-choice quiz for ${book} Chapter ${chapter}. Return JSON with the shape { "questions": [ { "question": "...", "options": ["a","b","c","d"], "correctAnswer": 1, "explanation": "..." } ] }`;
  const raw = await callGroq(prompt, { maxTokens: 400, temperature: 0.6 });
  try {
    return JSON.parse(raw) as QuizResponse;
  } catch (err) {
    // Fallback: try to extract JSON snippet
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]) as QuizResponse;
    throw new Error('Failed to parse Groq quiz response');
  }
};

export const explainText = async (text: string, context: string, type: string = 'simple'): Promise<string> => {
  const promptsMap = {
    historical: `Provide historical, cultural, and archaeological context for this text: "${text}". (Context: ${context}). Keep it interesting and under 100 words.`,
    theological: `Explain theological meaning and cross-references for: "${text}". (Context: ${context}). Keep it under 100 words.`,
    word_study: `Analyze key original language words in: "${text}". Explain their nuance. (Context: ${context}). Keep under 100 words.`,
    application: `Give a modern life application for: "${text}". (Context: ${context}). Keep it inspiring and under 80 words.`,
    deep: `Provide a deep-dive commentary explanation for: "${text}". (Context: ${context}).`,
    simple: `Explain simply for a modern reader: "${text}" (Context: ${context}). Keep it under 50 words.`
  } as Record<string, string>;

  const chosen = (promptsMap[type] as string) || promptsMap.simple;

  const raw = await callGroq(chosen, { maxTokens: 300, temperature: 0.2 });
  return raw;
};

export default { generateQuiz, explainText };
