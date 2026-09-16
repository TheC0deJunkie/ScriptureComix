import { QuizResponse } from "../types";
import { NEUTRAL_CHARTER } from "./neutrality";

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
    historical: `Give the historical, cultural, and geographical setting of this text: "${text}" (from ${context}). Under 100 words.`,
    theological: `Describe how the main traditions that read this text understand it: "${text}" (from ${context}). One neutral sentence per tradition, endorsing none. Under 120 words.`,
    word_study: `Explain the key original-language words in: "${text}" (from ${context}). Plain meaning and any range of meaning scholars note. Under 100 words.`,
    application: `Say what this text meant to its first audience and what questions it raises for a reader today: "${text}" (from ${context}). Do not tell the reader what to believe or do. Under 80 words.`,
    deep: `Give a thorough, neutral commentary on: "${text}" (from ${context}). What happens, what led to it, what follows, where readings differ.`,
    simple: `In plain words, what does this say and what is happening around it? "${text}" (from ${context}). Under 50 words.`
  } as Record<string, string>;

  const chosen = `${NEUTRAL_CHARTER}\n\nTask: ${(promptsMap[type] as string) || promptsMap.simple}`;

  const raw = await callGroq(chosen, { maxTokens: 300, temperature: 0.2 });
  return raw;
};

/** Raw JSON-oriented completion (deterministic). Caller parses the result. */
export const generateJson = async (prompt: string, maxTokens: number = 2000): Promise<string> => {
  return callGroq(prompt, { maxTokens, temperature: 0 });
};

export default { generateQuiz, explainText, generateJson };
