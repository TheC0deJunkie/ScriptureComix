
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

export interface ReflectionEntry {
  id: string;
  author: string;
  text: string;
  createdAt: string;
}

export interface StudyGroup {
  id: string;
  name: string;
  focus: string;
  code: string;
  members: string[];
  createdAt: string;
  targetBook?: string;
  targetChapter?: number;
  reflections: ReflectionEntry[];
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

export interface ChapterVerse {
  verse: number;
  text: string;
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

export interface ChapterTextResult {
  entry: TextCatalogEntry;
  verses: ChapterVerse[];
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

export const FREE_VERSIONS = [BibleVersion.NIV, BibleVersion.KJV, BibleVersion.MSG];
export const EXPLORER_VERSIONS = [...FREE_VERSIONS, BibleVersion.ESV, BibleVersion.NLT, BibleVersion.NKJV, BibleVersion.NASB, BibleVersion.RSV];

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
