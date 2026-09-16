
export interface SpeechBubble {
  speaker: string;
  text: string;
}

export interface CharacterProfile {
  name: string;
  role: string;
  description: string;
  key_verses?: string;
  symbolism?: string;
}

export interface ComicPanelData {
  id: number;
  narrative: string;
  speechBubbles: SpeechBubble[];
  visualPrompt: string;
  verseReference: string;
  imageUrl?: string;
  isLoadingImage?: boolean;
}

export interface ScriptResponse {
  title: string;
  summary: string;
  characters: CharacterProfile[];
  life_application: string;
  panels: Array<{
    narrative: string;
    speech_bubbles: Array<{ speaker: string; text: string }>;
    visual_prompt: string;
    verse_reference: string;
  }>;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number; // index
  explanation: string;
}

export interface QuizResponse {
  questions: QuizQuestion[];
}

// --- TIERS ---

export enum UserTier {
  FREE = 'Free Reader',
  EXPLORER = 'Explorer Plan',      // Plan 2
  SCHOLAR = 'Scholar Plan'         // Plan 3 (Premium)
}

export const TIER_LIMITS = {
  [UserTier.FREE]: { ai: 20 },
  [UserTier.EXPLORER]: { ai: 50 },
  [UserTier.SCHOLAR]: { ai: 9999 }
};

export interface UserStats {
  streak: number;
  lastVisit: string; // ISO date string
  xp: number;
  chaptersRead: number;
  bookmarks: string[]; // "Book Chapter"
  tier: UserTier;
  dailyAiUsage: number;
  lastAiUsageDate: string; // ISO date string
}

export interface JourneyChapter {
  book: string;
  chapter: number;
  focus: string;
  xpReward: number;
  prompt?: string;
}

export interface GuidedJourney {
  id: string;
  title: string;
  description: string;
  badge: string;
  duration: string;
  chapters: JourneyChapter[];
  recommendedTier?: UserTier;
}

export interface JourneyProgress {
  journeyId: string;
  currentIndex: number;
  completed: number[];
  startedAt: string;
  lastUpdated: string;
}

/** A passage a reflection points at — tappable, so the circle can jump straight to it. */
export interface PassagePointer {
  tradition?: string;
  book: string;
  chapter: number;
  verses: number[];   // [] means the whole chapter
  label: string;      // "Exodus 4:1-10"
}

export interface ReflectionEntry {
  id: string;
  author: string;
  text: string;
  createdAt: string;
  ref?: PassagePointer;
}

export type CircleStatus = 'active' | 'ended';

export interface StudyGroup {
  id: string;
  name: string;
  focus: string;
  code: string;
  members: string[];
  createdAt: string;
  /** Canon the shared chapter lives in (protestant when absent, for circles made before this field). */
  tradition?: string;
  targetBook?: string;
  targetChapter?: number;
  /** Verses the circle is focused on inside the chapter ([] or absent = whole chapter). */
  targetVerses?: number[];
  /** "Exodus 4:1-10" when verses are set. */
  targetLabel?: string;
  reflections: ReflectionEntry[];

  // --- Present only when the circle lives in Firestore (signed-in readers) ---
  cloud?: boolean;
  ownerUid?: string;
  memberUids?: string[];
  /** 'ended' locks the circle for everyone until the leader starts a new session. */
  status?: CircleStatus;
  currentSessionId?: string | null;
  sessionCount?: number;
  endedAt?: string;
}

/** One sitting of a circle: a start, a set of passages, reflections, and what was learnt. */
export interface StudySession {
  id: string;
  number: number;
  title: string;
  status: 'open' | 'closed';
  startedAt: string;
  startedBy: string;
  endedAt?: string;
  endedBy?: string;
  /** Every passage the circle focused on during the session, in order. */
  passages: PassagePointer[];
  summary: string;
  takeaways: string[];
  reflectionCount: number;
}

export interface CircleNote {
  id: string;
  authorUid: string;
  author: string;
  title: string;
  body: string;
  ref?: PassagePointer;
  createdAt: string;
  updatedAt: string;
}

export interface StudyPack {
  id: string;
  title: string;
  description: string;
  passages: PassagePointer[];
  questions: string[];
  notes: string;
  createdByUid: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomHero {
  id: string;
  name: string;
  archetype: string;
  mission: string;
  traits: string[];
  catchphrase?: string;
  artStyle?: ArtStyle;
  palette?: string;
  isActive?: boolean;
}

export interface OfflinePack {
  id: string;
  title: string;
  book: string;
  chapter: number;
  createdAt: string;
  summary: string;
  lifeApplication: string;
  panels: ComicPanelData[];
  artStyle: ArtStyle;
  language: string;
  version: BibleVersion;
  characters?: CharacterProfile[];
}

export interface CachedChapter {
  key: string;
  book: string;
  chapter: number;
  language: string;
  version: BibleVersion;
  artStyle: ArtStyle;
  title: string;
  summary: string;
  lifeApplication: string;
  characters: CharacterProfile[];
  panels: ComicPanelData[];
  updatedAt: string;
}

/** Where a verse's text came from. Anything but 'bundled' should be flagged to the reader. */
export type VerseTextSource = 'bundled' | 'borrowed' | 'reconstructed';

export interface ChapterVerse {
  verse: number;
  text: string;
  source?: VerseTextSource;
}

export interface ChapterProvenance {
  borrowed: number[];       // verse numbers filled from another public-domain translation
  reconstructed: number[];  // verse numbers reproduced by AI — not from a printed edition
  unresolved: number[];     // verse numbers still missing
}

export interface TextCatalogEntry {
  id: string;
  displayName: string;
  language: string;
  license: string;
  status: 'local' | 'external' | 'licensed';
  description?: string;
  versions?: string[];
  books?: string[];
  file?: string;
  groups?: string[];
  updatedAt?: string;
  notes?: string;
}

/**
 * Neutral, text-grounded study context for one chapter. Generated once,
 * stored forever, shipped to everyone. Descriptive, never devotional.
 */
export interface ChapterContext {
  summary: string;                                   // what happens, plainly
  setting: string;                                   // when / where, hedged where uncertain
  events: { ref: string; what: string }[];           // in order: what led to what
  people: { name: string; role: string }[];
  terms: { term: string; meaning: string }[];        // words or ideas a modern reader may miss
  readings: { tradition: string; view: string }[];   // how traditions read it — described, not endorsed
  oftenQuoted: { ref: string; caution: string }[];   // verses often quoted alone, and what surrounds them
  generatedAt: string;
  model?: string;
}

/**
 * A scene is a run of verses that tells one beat of the story and gets ONE
 * illustration (not one per verse). Plans and images are generated once and
 * shipped with the app.
 */
export interface Scene {
  id: string;            // "s1"
  from: number;          // first verse
  to: number;            // last verse
  title: string;         // "In the beginning"
  caption: string;       // what happens here, in plain neutral words
  visualPrompt: string;  // the picture to draw (no text, respectful, tradition-aware)
  image?: string;        // bundled path (/data/scenes/…png) or data: URL once generated
  imageSource?: 'bundled' | 'generated';
}

export interface ScenePlan {
  scenes: Scene[];
  style: string;         // art style the bundled images were drawn in
  generatedAt: string;
}

export interface ChapterTextResult {
  entry: TextCatalogEntry;
  verses: ChapterVerse[];
  tradition?: string;
  translationId?: string;
  bookSlug?: string;
  bookDisplayName?: string;
  chapter?: number;
  provenance?: ChapterProvenance;
  /** Set when gaps are being repaired in the background; resolves to the completed chapter. */
  pending?: Promise<ChapterTextResult | null>;
}

export type FaithTradition =
  | 'Christian'
  | 'Jewish'
  | 'Muslim'
  | 'Curious'
  | 'Mixed'
  | 'Other';

export type ExploreLevel = 'Low' | 'Medium' | 'High';

export interface ReaderProfile {
  displayName: string;
  faithTradition: FaithTradition;
  exploreLevel: ExploreLevel;
}

// --- VERSIONS ---

export enum BibleVersion {
  // Free
  NIV = 'NIV',
  KJV = 'KJV',
  MSG = 'The Message',
  // Explorer (+5)
  ESV = 'ESV',
  NLT = 'NLT',
  NKJV = 'NKJV',
  NASB = 'NASB',
  RSV = 'RSV',
  // Scholar (All)
  GENEVA = 'Geneva Bible',
  SEPTUAGINT = 'Septuagint (LXX)',
  VULGATE = 'Latin Vulgate',
  QURAN_SAHIH = 'Sahih International (Quran)',
  LDS_STANDARD = 'LDS Standard Works'
}

export const FREE_VERSIONS = [BibleVersion.NLT, BibleVersion.NIV, BibleVersion.KJV, BibleVersion.MSG];
export const EXPLORER_VERSIONS = [...FREE_VERSIONS, BibleVersion.ESV, BibleVersion.NKJV, BibleVersion.NASB, BibleVersion.RSV];

export const SUPPORTED_LANGUAGES = [
  "English", "Spanish", "French", "Portuguese", "German", 
  "Italian", "Chinese (Simplified)", "Chinese (Traditional)", 
  "Japanese", "Korean", "Russian", "Arabic", "Hindi", 
  "Swahili", "Amharic", "Hebrew", "Greek", "Latin", 
  "Tagalog", "Indonesian", "Dutch", "Zulu", "Xhosa"
];

// --- ART STYLES ---

export enum ArtStyle {
  COMIC_MODERN = 'Modern American Comic',
  // Explorer Styles
  COMIC_RETRO = 'Vintage 40s Comic',
  WATERCOLOR = 'Soft Watercolor',
  // Scholar Styles
  MINIMALIST = 'Minimalist Line Art',
  REALISTIC = 'Cinematic Realistic',
  PIXEL = 'Pixel Art 16-bit',
  MANGA = 'Manga Style',
  OIL_PAINT = 'Oil Painting',
  STAINED_GLASS = 'Medieval Stained Glass'
}

export const FREE_STYLES = [ArtStyle.COMIC_MODERN];
export const EXPLORER_STYLES = [ArtStyle.COMIC_MODERN, ArtStyle.COMIC_RETRO, ArtStyle.WATERCOLOR];

// --- BOOK COLLECTIONS STRUCTURE ---
// --- BOOK COLLECTIONS STRUCTURE ---

// Use the canonical Protestant Bible book list as the primary source for the app UI.
// These are the 66 books commonly present across the translation JSONs in
// the `bible-translations-master` dataset (OT + NT). We intentionally avoid
// showing the various alternative canons (Tanakh groupings, Deuterocanonical,
// later-day saint, or Quran) in the main Book selector per product request.
export const BOOK_COLLECTIONS = {
  "Old Testament": [
    "Genesis","Exodus","Leviticus","Numbers","Deuteronomy",
    "Joshua","Judges","Ruth","1 Samuel","2 Samuel","1 Kings","2 Kings",
    "1 Chronicles","2 Chronicles","Ezra","Nehemiah","Esther","Job","Psalms","Proverbs",
    "Ecclesiastes","Song of Solomon","Isaiah","Jeremiah","Lamentations","Ezekiel","Daniel",
    "Hosea","Joel","Amos","Obadiah","Jonah","Micah","Nahum","Habakkuk","Zephaniah","Haggai","Zechariah","Malachi"
  ],
  "New Testament": [
    "Matthew","Mark","Luke","John","Acts","Romans","1 Corinthians","2 Corinthians",
    "Galatians","Ephesians","Philippians","Colossians","1 Thessalonians","2 Thessalonians",
    "1 Timothy","2 Timothy","Titus","Philemon","Hebrews","James","1 Peter","2 Peter",
    "1 John","2 John","3 John","Jude","Revelation"
  ]
};

// Flattened list
export const BIBLE_BOOKS = Array.from(new Set(Object.values(BOOK_COLLECTIONS).flat()));

// Free tier allowed books: for now allow the entire standard Bible to be browsed locally.
export const FREE_ALLOWED_BOOKS = [...BIBLE_BOOKS];

// Re-export new type contracts from services/types.ts
// Keeps types.ts as the single import point for components
export { type Tradition, type CanonManifest, type ManifestBook, type TranslationMeta, TRADITIONS, TRADITION_LABELS, NAV_LABELS } from './services/types';
