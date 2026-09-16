
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { ScriptResponse, QuizResponse, ArtStyle, CharacterProfile, CustomHero, ChapterContext, Scene } from "../types";
import { NEUTRAL_CHARTER } from "./neutrality";
// Optionally delegate explainText/generateQuiz to Groq when configured
import * as groqService from "./groqService";

// Helper to get a fresh client
const GEMINI_API_KEY =
  import.meta?.env?.VITE_GEMINI_API_KEY ||
  import.meta?.env?.GEMINI_API_KEY ||
  (typeof process !== 'undefined' ? process.env.GEMINI_API_KEY || process.env.API_KEY : undefined);

const getAiClient = () => {
  if (!GEMINI_API_KEY) {
    throw new Error(
      'Missing Gemini API key. Add VITE_GEMINI_API_KEY (or GEMINI_API_KEY) to your .env.local file.'
    );
  }
  return new GoogleGenAI({ apiKey: GEMINI_API_KEY });
};

export const generateComicScript = async (
  book: string,
  chapter: number,
  version: string,
  language: string = "English",
  customHeroes: CustomHero[] = []
): Promise<ScriptResponse> => {
  const ai = getAiClient();
  
  const systemInstruction = `
    You are a visual storyteller and theologian adapting religious texts into a graphic novel format.
    
    GUIDELINES:
    1. BREAKDOWN: Divide the chapter into 6-12 key panels that summarize the flow of events.
    2. VISUALS: For abstract concepts, use concrete, dramatic imagery.
    3. LANGUAGE: Output the 'narrative' and 'speech_bubbles' text strictly in ${language}.
    4. TRANSLATION: 
       - If the book/version exists in ${language}, use that text.
       - If not, translate the essence accurately into ${language}, preserving the cultural and scriptural nuance of the requested version (e.g., ${version}).
    5. TEXT SOURCE:
       - Handle inclusive canons (Bible, Quran, Gnostic texts, LDS, Apocrypha). 
       - For the Quran, treat 'Chapter' as 'Surah'.
       - For 'Lost Books' (Enoch, Philip, etc.), use standard academic translations.
    6. OUTPUT: Return strictly JSON.
  `;

  const heroInstruction = customHeroes.length
    ? `
      Include tasteful cameos of the following reader-created heroes. Honor their mission statements and sprinkle their catchphrases when it fits. 
      Heroes:
      ${customHeroes.map(hero => `- ${hero.name} (${hero.archetype}): mission "${hero.mission}". Traits: ${hero.traits.join(', ') || 'n/a'}. Catchphrase: ${hero.catchphrase || 'n/a'}`).join('\n')}
    `
    : "";

  const prompt = `Create a comic script for ${book} Chapter ${chapter}. Source Version: ${version}. Output Language: ${language}. ${heroInstruction}`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      systemInstruction: systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          summary: { type: Type.STRING },
          characters: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                role: { type: Type.STRING },
                description: { type: Type.STRING, description: "Short bio" }
              }
            }
          },
          life_application: { type: Type.STRING, description: "A paragraph on modern relevance." },
          panels: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                narrative: { type: Type.STRING },
                speech_bubbles: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      speaker: { type: Type.STRING },
                      text: { type: Type.STRING }
                    }
                  }
                },
                visual_prompt: { type: Type.STRING },
                verse_reference: { type: Type.STRING }
              },
              required: ["narrative", "visual_prompt", "verse_reference", "speech_bubbles"]
            }
          }
        },
        required: ["title", "summary", "panels", "characters", "life_application"]
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("No script generated");
  return JSON.parse(text) as ScriptResponse;
};

export const generateCharacterProfile = async (
  characterName: string,
  contextBook: string,
  language: string
): Promise<CharacterProfile> => {
  const ai = getAiClient();
  const prompt = `Generate a detailed profile for the religious/historical figure: "${characterName}" (Context: ${contextBook}). Language: ${language}.`;
  
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          role: { type: Type.STRING },
          description: { type: Type.STRING },
          key_verses: { type: Type.STRING, description: "Where they appear" },
          symbolism: { type: Type.STRING, description: "What they represent" }
        }
      }
    }
  });
  
  return JSON.parse(response.text!) as CharacterProfile;
};

export const generatePanelImage = async (visualPrompt: string, style: ArtStyle = ArtStyle.COMIC_MODERN): Promise<string> => {
  const ai = getAiClient();
  
  let stylePrompt = "";
  switch (style) {
    case ArtStyle.COMIC_RETRO:
      stylePrompt = "Vintage 1940s comic book style, halftone dots, muted colors, paper texture, golden age comics.";
      break;
    case ArtStyle.REALISTIC:
      stylePrompt = "Cinematic photorealistic, 8k resolution, dramatic lighting, movie still, highly detailed.";
      break;
    case ArtStyle.WATERCOLOR:
      stylePrompt = "Soft watercolor painting, artistic, fluid strokes, pastel colors, storybook style.";
      break;
    case ArtStyle.PIXEL:
      stylePrompt = "16-bit pixel art, retro video game style, SNES era graphics, vibrant pixels.";
      break;
    case ArtStyle.MINIMALIST:
      stylePrompt = "Minimalist continuous line art, black ink on white paper, clean, elegant, modern illustration.";
      break;
    case ArtStyle.MANGA:
      stylePrompt = "Manga style, black and white ink, screentones, dramatic angles, expressive characters.";
      break;
    case ArtStyle.OIL_PAINT:
      stylePrompt = "Classical oil painting, renaissance style, rich textures, dramatic chiaroscuro lighting.";
      break;
    case ArtStyle.STAINED_GLASS:
      stylePrompt = "Medieval stained glass art, vibrant glowing colors, thick lead lines, religious iconography.";
      break;
    default:
      stylePrompt = "Modern American comic book style, masterpiece, thick ink lines, vibrant colors, cel shaded, dynamic composition.";
  }

  const enhancedPrompt = `
    ${stylePrompt}
    Scene Description: ${visualPrompt}
  `;

  try {
    const response = await ai.models.generateContent({
      // gemini-2.0-flash-preview-image-generation was retired; this is the
      // current image model available to the project key.
      model: "gemini-2.5-flash-image",
      contents: enhancedPrompt,
      config: {
        responseModalities: [Modality.IMAGE],
      },
    });

    const parts = response.candidates?.[0]?.content?.parts;
    if (!parts) throw new Error("No content in response");

    for (const part of parts) {
      if (part.inlineData && part.inlineData.data) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    
    throw new Error("No image data found");
  } catch (error) {
    console.error("Image gen error:", error);
    // Return a styled placeholder on failure
    return `https://placehold.co/800x800/EEE/31343C?text=Image+Generation+Failed`; 
  }
};

export const generateSpeech = async (text: string): Promise<ArrayBuffer> => {
  const ai = getAiClient();
  
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: { parts: [{ text }] },
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Puck' }, // 'Puck' is often good for storytelling
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) throw new Error("No audio generated");

  const binaryString = atob(base64Audio);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};

export const generateQuiz = async (book: string, chapter: number): Promise<QuizResponse> => {
  // If Groq is configured, prefer it for quizzes
  const GROQ_KEY = import.meta?.env?.VITE_GROQ_API_KEY || import.meta?.env?.GROQ_API_KEY || (typeof process !== 'undefined' ? process.env.GROQ_API_KEY : undefined);
  if (GROQ_KEY) {
    return groqService.generateQuiz(book, chapter);
  }

  const ai = getAiClient();
  const prompt = `Create a fun 3-question quiz for ${book} Chapter ${chapter}.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          questions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                correctAnswer: { type: Type.INTEGER },
                explanation: { type: Type.STRING }
              },
              required: ["question", "options", "correctAnswer", "explanation"]
            }
          }
        }
      }
    }
  });

  return JSON.parse(response.text!) as QuizResponse;
};

/**
 * A comprehension quiz grounded in the actual chapter text. Used by quizBank to
 * enrich the offline bank; results are stored forever, so this runs at most a
 * couple of times per chapter.
 */
export const generateGroundedQuiz = async (
  bookName: string,
  chapter: number,
  verses: { verse: number; text: string }[],
  isQuran: boolean = false
): Promise<QuizResponse> => {
  const label = isQuran ? 'Ayah' : 'Verse';
  const where = isQuran ? bookName : `${bookName} chapter ${chapter}`;
  let passage = verses.map(v => `${v.verse}. ${v.text}`).join('\n');
  if (passage.length > 9000) passage = passage.slice(0, 9000) + '\n…';

  const prompt = `Write a 5-question multiple-choice comprehension quiz on ${where}, using ONLY the passage below.
Rules:
- Every question must be answerable from the passage; do not rely on outside knowledge.
- Mix question types: what happened, who did or said what, why, and what a phrase means in context.
- Each question has exactly 4 options, one correct. Distractors must be plausible and drawn from the passage where possible.
- "explanation" cites the ${label.toLowerCase()} number(s) that answer it.
- Plain, friendly language a teenager understands. No trick questions.

Passage:
${passage}

Return JSON: {"questions": [{"question": "...", "options": ["a","b","c","d"], "correctAnswer": <0-3>, "explanation": "..."}]}`;

  const GROQ_KEY =
    import.meta?.env?.VITE_GROQ_API_KEY ||
    import.meta?.env?.GROQ_API_KEY ||
    (typeof process !== 'undefined' ? process.env.GROQ_API_KEY : undefined);

  let raw: string;
  if (!GEMINI_API_KEY && GROQ_KEY) {
    raw = await groqService.generateJson(prompt, 1500);
  } else {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        temperature: 0.7,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING },
                  options: { type: Type.ARRAY, items: { type: Type.STRING } },
                  correctAnswer: { type: Type.INTEGER },
                  explanation: { type: Type.STRING },
                },
                required: ['question', 'options', 'correctAnswer', 'explanation'],
              },
            },
          },
          required: ['questions'],
        },
      },
    });
    raw = response.text || '{}';
  }

  try {
    return JSON.parse(raw) as QuizResponse;
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]) as QuizResponse;
    throw new Error('Could not parse quiz response');
  }
};

/**
 * Neutral study context for a whole chapter, grounded in the passage and bound
 * by the neutrality charter. Generated once per chapter and stored forever.
 */
export const generateChapterContext = async (
  bookName: string,
  chapter: number,
  verses: { verse: number; text: string }[],
  tradition: string,
  isQuran: boolean = false
): Promise<ChapterContext> => {
  const label = isQuran ? 'ayah' : 'verse';
  const where = isQuran ? `Surah ${bookName}` : `${bookName} chapter ${chapter}`;
  let passage = verses.map(v => `${v.verse}. ${v.text}`).join('\n');
  if (passage.length > 14000) passage = passage.slice(0, 14000) + '\n…';

  const prompt = `${NEUTRAL_CHARTER}

Task: write a study context for ${where} (read here in the ${tradition} canon). Base every claim about the passage on the text below; cite ${label} numbers like "${isQuran ? 'ayah' : 'v.'} 3" or "${isQuran ? 'ayahs' : 'vv.'} 3–5".

Passage:
${passage}

Return JSON with exactly these fields:
- "summary": 3–5 plain sentences on what happens in this chapter.
- "setting": 2–4 sentences on when and where this is set and what the wider situation was, hedged where historians are unsure.
- "events": ordered list of {"ref", "what"} — each step of the story and how it leads to the next (4–10 items).
- "people": list of {"name", "role"} for people or groups in the chapter (role = what they do here, not who they are elsewhere).
- "terms": list of {"term", "meaning"} for words, customs, places or ideas a modern reader may not know (3–8 items).
- "readings": list of {"tradition", "view"} — how different traditions (e.g. Jewish, Catholic, Protestant, Orthodox, Muslim, historical-critical scholarship) read this chapter, each in one or two neutral sentences. Include at least three. Do not rank them.
- "oftenQuoted": list of {"ref", "caution"} — ${label}s from this chapter people often quote on their own, with one or two sentences on what the surrounding text is actually about. Empty list if none.`;

  const GROQ_KEY =
    import.meta?.env?.VITE_GROQ_API_KEY ||
    import.meta?.env?.GROQ_API_KEY ||
    (typeof process !== 'undefined' ? process.env.GROQ_API_KEY : undefined);

  let raw: string;
  let model = 'gemini-2.5-flash';
  if (!GEMINI_API_KEY && GROQ_KEY) {
    model = 'groq';
    raw = await groqService.generateJson(prompt, 3000);
  } else {
    const ai = getAiClient();
    const pair = (a: string, b: string) => ({
      type: Type.ARRAY,
      items: { type: Type.OBJECT, properties: { [a]: { type: Type.STRING }, [b]: { type: Type.STRING } }, required: [a, b] },
    });
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        temperature: 0.3,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            setting: { type: Type.STRING },
            events: pair('ref', 'what'),
            people: pair('name', 'role'),
            terms: pair('term', 'meaning'),
            readings: pair('tradition', 'view'),
            oftenQuoted: pair('ref', 'caution'),
          },
          required: ['summary', 'setting', 'events', 'people', 'terms', 'readings', 'oftenQuoted'],
        },
      },
    });
    raw = response.text || '{}';
  }

  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('Could not parse context response');
    parsed = JSON.parse(m[0]);
  }
  const list = (x: any) => (Array.isArray(x) ? x : []);
  return {
    summary: String(parsed.summary || ''),
    setting: String(parsed.setting || ''),
    events: list(parsed.events),
    people: list(parsed.people),
    terms: list(parsed.terms),
    readings: list(parsed.readings),
    oftenQuoted: list(parsed.oftenQuoted),
    generatedAt: new Date().toISOString(),
    model,
  };
};

/**
 * Break a chapter into story scenes — each a run of verses that gets ONE
 * picture. Neutral captions; visual prompts that respect every tradition
 * (no text in images, no depiction of God, and for the Quran no human
 * depiction of prophets or angels).
 */
export const generateScenePlan = async (
  bookName: string,
  chapter: number,
  verses: { verse: number; text: string }[],
  tradition: string,
  isQuran: boolean = false
): Promise<Omit<Scene, 'id'>[]> => {
  const label = isQuran ? 'ayah' : 'verse';
  const where = isQuran ? `Surah ${bookName}` : `${bookName} chapter ${chapter}`;
  let passage = verses.map(v => `${v.verse}. ${v.text}`).join('\n');
  if (passage.length > 14000) passage = passage.slice(0, 14000) + '\n…';
  const last = verses[verses.length - 1]?.verse ?? 1;

  const prompt = `${NEUTRAL_CHARTER}

Task: divide ${where} into story scenes for an illustrated edition. A scene is a run of consecutive ${label}s that shows ONE moment or beat of the story and will get ONE picture.

Rules:
- Between 3 and 8 scenes. Cover every ${label} from 1 to ${last} exactly once, in order, with no gaps and no overlaps.
- "title": 2–6 words, like a chapter heading in a graphic novel.
- "caption": 1–3 plain sentences saying what happens in these ${label}s, neutral, no interpretation.
- "visualPrompt": a concrete description of the picture — setting, time of day, who is present, what they are doing, mood. Historically plausible dress and places. No words, letters or numbers in the image. Never depict God. ${isQuran ? 'This is the Quran: never depict the Prophet Muhammad, any other prophet, or angels as human figures — show landscapes, objects, crowds from behind, symbolic imagery instead.' : 'Depict prophets and people respectfully.'} No gore.

Passage:
${passage}

Return JSON: {"scenes": [{"from": <first ${label}>, "to": <last ${label}>, "title": "...", "caption": "...", "visualPrompt": "..."}]}`;

  const GROQ_KEY =
    import.meta?.env?.VITE_GROQ_API_KEY ||
    import.meta?.env?.GROQ_API_KEY ||
    (typeof process !== 'undefined' ? process.env.GROQ_API_KEY : undefined);

  let raw: string;
  if (!GEMINI_API_KEY && GROQ_KEY) {
    raw = await groqService.generateJson(prompt, 2500);
  } else {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        temperature: 0.4,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            scenes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  from: { type: Type.INTEGER },
                  to: { type: Type.INTEGER },
                  title: { type: Type.STRING },
                  caption: { type: Type.STRING },
                  visualPrompt: { type: Type.STRING },
                },
                required: ['from', 'to', 'title', 'caption', 'visualPrompt'],
              },
            },
          },
          required: ['scenes'],
        },
      },
    });
    raw = response.text || '{}';
  }

  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('Could not parse scene plan');
    parsed = JSON.parse(m[0]);
  }
  const scenes: Omit<Scene, 'id'>[] = (Array.isArray(parsed?.scenes) ? parsed.scenes : [])
    .map((s: any) => ({
      from: Number(s.from),
      to: Number(s.to),
      title: String(s.title || '').trim(),
      caption: String(s.caption || '').trim(),
      visualPrompt: String(s.visualPrompt || '').trim(),
    }))
    .filter((s: any) => Number.isInteger(s.from) && Number.isInteger(s.to) && s.from >= 1 && s.to >= s.from && s.title && s.visualPrompt)
    .sort((a: any, b: any) => a.from - b.from);

  // Normalise to a gap-free, non-overlapping cover of 1..last
  let cursor = 1;
  for (const s of scenes) {
    if (s.from > cursor) s.from = cursor;
    if (s.from < cursor) s.from = cursor;
    if (s.to < s.from) s.to = s.from;
    cursor = s.to + 1;
  }
  if (scenes.length && scenes[scenes.length - 1].to < last) scenes[scenes.length - 1].to = last;
  return scenes.filter(s => s.from <= last);
};

export const explainText = async (text: string, context: string, type: string = "simple"): Promise<string> => {
  // If Groq is configured, delegate explain to it
  const GROQ_KEY = import.meta?.env?.VITE_GROQ_API_KEY || import.meta?.env?.GROQ_API_KEY || (typeof process !== 'undefined' ? process.env.GROQ_API_KEY : undefined);
  if (GROQ_KEY) {
    return groqService.explainText(text, context, type);
  }

  const ai = getAiClient();

  let task = "";
  switch (type) {
    case 'historical':
      task = `Give the historical, cultural, and geographical setting of this text: "${text}" (from ${context}). What was the world like for the people in it? Under 100 words.`;
      break;
    case 'theological':
      task = `Describe how the main traditions that read this text understand it: "${text}" (from ${context}). Name each tradition and its reading in one sentence each, in a neutral voice, endorsing none. Under 120 words.`;
      break;
    case 'word_study':
      task = `Explain the key original-language words (Hebrew, Greek, Aramaic, Ge'ez or Arabic as applicable) in: "${text}" (from ${context}). Give the plain meaning and any range of meaning scholars note. Under 100 words.`;
      break;
    case 'application':
      task = `Say what this text meant to its first audience and what questions it raises for a reader today: "${text}" (from ${context}). Do not tell the reader what to believe or do. Under 80 words.`;
      break;
    case 'deep':
      task = `Give a thorough, neutral commentary on: "${text}" (from ${context}). Cover what happens, what led to it, what follows, and where readings differ.`;
      break;
    default:
      task = `In plain words, what does this say and what is happening around it? "${text}" (from ${context}). Under 50 words.`;
  }

  const prompt = `${NEUTRAL_CHARTER}\n\nTask: ${task}`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
  });

  return response.text || "Could not explain this text.";
};

// ---------------------------------------------------------------------------
// Study circle session wrap-up: turns what members said into a short summary
// and a list of takeaways the circle can keep.
// ---------------------------------------------------------------------------

export interface SessionWrapUpDraft {
  summary: string;
  takeaways: string[];
}

export const summarizeStudySession = async (
  passages: string[],
  reflections: { author: string; text: string; ref?: string }[],
): Promise<SessionWrapUpDraft> => {
  const said = reflections.map(r => `- ${r.author}${r.ref ? ` (${r.ref})` : ''}: ${r.text}`).join('\n');
  const task = `A small study circle read ${passages.join(', ') || 'a passage'} together. Here is what members said:\n${said}\n\nWrite a neutral summary of the discussion in under 120 words (do not add teaching of your own), then list 3 to 6 short takeaways in the members' own terms. Reply with JSON only: {"summary": string, "takeaways": string[]}.`;
  const prompt = `${NEUTRAL_CHARTER}\n\nTask: ${task}`;

  const GROQ_KEY = import.meta?.env?.VITE_GROQ_API_KEY || import.meta?.env?.GROQ_API_KEY;
  let raw: string;
  if (GROQ_KEY) {
    raw = await groqService.generateJson(prompt, 800);
  } else {
    const response = await getAiClient().models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    });
    raw = response.text || '{}';
  }
  const match = raw.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(match ? match[0] : raw) as Partial<SessionWrapUpDraft>;
  return {
    summary: typeof parsed.summary === 'string' ? parsed.summary.trim() : '',
    takeaways: Array.isArray(parsed.takeaways) ? parsed.takeaways.filter(t => typeof t === 'string').map(t => t.trim()).filter(Boolean) : [],
  };
};

// ---------------------------------------------------------------------------
// Verse reconstruction — used by verseRepair when a verse is missing from the
// bundled dataset and no public-domain sibling translation carries it.
// One request per chapter gap list. Results are stored permanently by the
// caller and tagged 'reconstructed' so the reader is warned.
// ---------------------------------------------------------------------------
export interface ReconstructVersesArgs {
  tradition: string;
  translationName: string;
  bookName: string;
  chapter: number;
  verses: number[];
  isQuran: boolean;
  /** Verse count unknown: reproduce every verse of the chapter. `verses` is ignored. */
  wholeChapter?: boolean;
}

const parseVerseList = (raw: string, wanted: number[]): Record<number, string> => {
  const out: Record<number, string> = {};
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return out;
    try {
      parsed = JSON.parse(m[0]);
    } catch {
      return out;
    }
  }
  const list = parsed?.verses;
  const allowed = new Set(wanted);
  const accept = (n: number) => Number.isInteger(n) && n > 0 && (wanted.length === 0 || allowed.has(n));
  if (Array.isArray(list)) {
    for (const item of list) {
      const n = Number(item?.number);
      const text = typeof item?.text === 'string' ? item.text.trim() : '';
      if (accept(n) && text) out[n] = text;
    }
  } else if (list && typeof list === 'object') {
    for (const [k, v] of Object.entries(list)) {
      const n = Number(k);
      const text = typeof v === 'string' ? v.trim() : '';
      if (accept(n) && text) out[n] = text;
    }
  }
  return out;
};

export const reconstructVerses = async (args: ReconstructVersesArgs): Promise<Record<number, string>> => {
  const { tradition, translationName, bookName, chapter, verses, isQuran } = args;
  const wholeChapter = !!args.wholeChapter;
  if (!verses.length && !wholeChapter) return {};

  const unit = isQuran ? 'ayah' : 'verse';
  const where = isQuran ? `Surah ${bookName}` : `${bookName} chapter ${chapter}`;
  const which = wholeChapter ? `every ${unit} in order, from the first to the last` : `${unit}s ${verses.join(', ')}`;
  const prompt = `You are a scripture archivist. Reproduce, word for word, the public-domain English text of ${where}, ${which}, as printed in the ${translationName} (${tradition} canon).

Rules:
- Quote the established published text exactly. Do not paraphrase, modernise, summarise, or add commentary or verse numbers inside the text.
- If the ${translationName} does not contain this book, use the standard public-domain English translation of it (for example R.H. Charles 1912/1913 for 1 Enoch and Jubilees, Brenton 1851 for Septuagint-only books).
- If you cannot reproduce a ${unit} faithfully, omit it rather than guess.

Return JSON of the form {"verses": [{"number": <${unit} number>, "text": "<exact text>"}]}.`;

  const GROQ_KEY =
    import.meta?.env?.VITE_GROQ_API_KEY ||
    import.meta?.env?.GROQ_API_KEY ||
    (typeof process !== 'undefined' ? process.env.GROQ_API_KEY : undefined);

  let raw: string;
  if (!GEMINI_API_KEY && GROQ_KEY) {
    raw = await groqService.generateJson(prompt);
  } else {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        temperature: 0,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            verses: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  number: { type: Type.INTEGER },
                  text: { type: Type.STRING },
                },
                required: ['number', 'text'],
              },
            },
          },
          required: ['verses'],
        },
      },
    });
    raw = response.text || '{}';
  }

  return parseVerseList(raw, wholeChapter ? [] : verses);
};
