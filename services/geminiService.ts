
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { ScriptResponse, QuizResponse, ArtStyle, CharacterProfile, CustomHero } from "../types";

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
      model: "gemini-2.5-flash-image",
      contents: enhancedPrompt,
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

export const explainText = async (text: string, context: string, type: string = "simple"): Promise<string> => {
  const ai = getAiClient();
  
  let prompt = "";
  
  switch(type) {
    case 'historical':
      prompt = `Provide historical, cultural, and archaeological context for this text: "${text}". (Context: ${context}). Keep it interesting and under 100 words.`;
      break;
    case 'theological':
      prompt = `Explain the deep theological meaning and cross-references for: "${text}". (Context: ${context}). Keep it under 100 words.`;
      break;
    case 'word_study':
      prompt = `Analyze key Hebrew, Greek, or Arabic words in this text: "${text}". Explain their original meaning and nuance. (Context: ${context}). Keep it under 100 words.`;
      break;
    case 'application':
      prompt = `Give a practical "Life Application" for modern readers based on: "${text}". (Context: ${context}). Keep it inspiring and under 80 words.`;
      break;
    case 'deep':
      prompt = `Provide a deep-dive commentary explanation for: "${text}". (Context: ${context}).`;
      break;
    default:
      prompt = `Explain this simply for a modern reader: "${text}" (Context: ${context}). Keep it under 50 words.`;
  }

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
  });

  return response.text || "Could not explain this text.";
};
