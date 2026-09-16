/**
 * transformData.ts
 *
 * Data transformation script for ScriptureComix.
 * Reads all source datasets and writes per-book JSON files + canon manifests to public/data/.
 *
 * Run: npx tsx scripts/transformData.ts
 *
 * Output structure:
 *   public/data/protestant/{translation}/{slug}.json  — flat verse map { "1:1": "text" }
 *   public/data/catholic/nabre/{slug}.json
 *   public/data/ethiopian/kjv/{slug}.json
 *   public/data/quran/yusuf-ali/{slug}.json           — flat ayah map { "1": "text" }
 *   public/data/{tradition}/manifest.json             — CanonManifest
 */

import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Types (mirrors services/types.ts)
// ---------------------------------------------------------------------------

interface CanonManifest {
  tradition: 'protestant' | 'catholic' | 'ethiopian' | 'quran';
  displayName: string;
  basmala?: string; // Quran only — Al-Fatiha header
  books: ManifestBook[];
  translations: TranslationMeta[];
}

interface ManifestBook {
  slug: string;
  displayName: string;
  section?: string;
  chapters: number[]; // verse count per chapter; index 0 = chapter 1
}

interface TranslationMeta {
  id: string;
  displayName: string;
  copyright?: string;
  isPublicDomain: boolean;
}

// ---------------------------------------------------------------------------
// Canonical slug maps
// ---------------------------------------------------------------------------

const CANONICAL_SLUG_MAP: Record<string, string> = {
  'Genesis': 'genesis', 'Exodus': 'exodus', 'Leviticus': 'leviticus',
  'Numbers': 'numbers', 'Deuteronomy': 'deuteronomy', 'Joshua': 'joshua',
  'Judges': 'judges', 'Ruth': 'ruth', '1 Samuel': '1-samuel', '2 Samuel': '2-samuel',
  '1 Kings': '1-kings', '2 Kings': '2-kings', '1 Chronicles': '1-chronicles',
  '2 Chronicles': '2-chronicles', 'Ezra': 'ezra', 'Nehemiah': 'nehemiah',
  'Esther': 'esther', 'Job': 'job', 'Psalms': 'psalms',
  // Source variant: some translations use "Psalm" (singular)
  'Psalm': 'psalms',
  'Proverbs': 'proverbs',
  'Ecclesiastes': 'ecclesiastes', 'Song of Solomon': 'song-of-solomon',
  // Source variant: some translations use "Song Of Solomon" (different capitalization)
  'Song Of Solomon': 'song-of-solomon',
  'Isaiah': 'isaiah', 'Jeremiah': 'jeremiah', 'Lamentations': 'lamentations',
  'Ezekiel': 'ezekiel', 'Daniel': 'daniel', 'Hosea': 'hosea', 'Joel': 'joel',
  'Amos': 'amos', 'Obadiah': 'obadiah', 'Jonah': 'jonah', 'Micah': 'micah',
  'Nahum': 'nahum', 'Habakkuk': 'habakkuk', 'Zephaniah': 'zephaniah',
  'Haggai': 'haggai', 'Zechariah': 'zechariah', 'Malachi': 'malachi',
  'Matthew': 'matthew', 'Mark': 'mark', 'Luke': 'luke', 'John': 'john',
  'Acts': 'acts', 'Romans': 'romans', '1 Corinthians': '1-corinthians',
  '2 Corinthians': '2-corinthians', 'Galatians': 'galatians',
  'Ephesians': 'ephesians', 'Philippians': 'philippians',
  'Colossians': 'colossians', '1 Thessalonians': '1-thessalonians',
  '2 Thessalonians': '2-thessalonians', '1 Timothy': '1-timothy',
  '2 Timothy': '2-timothy', 'Titus': 'titus', 'Philemon': 'philemon',
  'Hebrews': 'hebrews', 'James': 'james', '1 Peter': '1-peter',
  '2 Peter': '2-peter', '1 John': '1-john', '2 John': '2-john',
  '3 John': '3-john', 'Jude': 'jude', 'Revelation': 'revelation',
};

// CANONICAL_BOOK_ORDER for Protestant (canonical 66-book order)
const PROTESTANT_BOOK_ORDER: string[] = [
  'genesis', 'exodus', 'leviticus', 'numbers', 'deuteronomy', 'joshua',
  'judges', 'ruth', '1-samuel', '2-samuel', '1-kings', '2-kings',
  '1-chronicles', '2-chronicles', 'ezra', 'nehemiah', 'esther', 'job',
  'psalms', 'proverbs', 'ecclesiastes', 'song-of-solomon', 'isaiah', 'jeremiah',
  'lamentations', 'ezekiel', 'daniel', 'hosea', 'joel', 'amos', 'obadiah',
  'jonah', 'micah', 'nahum', 'habakkuk', 'zephaniah', 'haggai', 'zechariah',
  'malachi', 'matthew', 'mark', 'luke', 'john', 'acts', 'romans',
  '1-corinthians', '2-corinthians', 'galatians', 'ephesians', 'philippians',
  'colossians', '1-thessalonians', '2-thessalonians', '1-timothy', '2-timothy',
  'titus', 'philemon', 'hebrews', 'james', '1-peter', '2-peter', '1-john',
  '2-john', '3-john', 'jude', 'revelation',
];

// Display names for Protestant books (indexed by slug)
const PROTESTANT_DISPLAY_NAMES: Record<string, string> = {
  'genesis': 'Genesis', 'exodus': 'Exodus', 'leviticus': 'Leviticus',
  'numbers': 'Numbers', 'deuteronomy': 'Deuteronomy', 'joshua': 'Joshua',
  'judges': 'Judges', 'ruth': 'Ruth', '1-samuel': '1 Samuel', '2-samuel': '2 Samuel',
  '1-kings': '1 Kings', '2-kings': '2 Kings', '1-chronicles': '1 Chronicles',
  '2-chronicles': '2 Chronicles', 'ezra': 'Ezra', 'nehemiah': 'Nehemiah',
  'esther': 'Esther', 'job': 'Job', 'psalms': 'Psalms', 'proverbs': 'Proverbs',
  'ecclesiastes': 'Ecclesiastes', 'song-of-solomon': 'Song of Solomon',
  'isaiah': 'Isaiah', 'jeremiah': 'Jeremiah', 'lamentations': 'Lamentations',
  'ezekiel': 'Ezekiel', 'daniel': 'Daniel', 'hosea': 'Hosea', 'joel': 'Joel',
  'amos': 'Amos', 'obadiah': 'Obadiah', 'jonah': 'Jonah', 'micah': 'Micah',
  'nahum': 'Nahum', 'habakkuk': 'Habakkuk', 'zephaniah': 'Zephaniah',
  'haggai': 'Haggai', 'zechariah': 'Zechariah', 'malachi': 'Malachi',
  'matthew': 'Matthew', 'mark': 'Mark', 'luke': 'Luke', 'john': 'John',
  'acts': 'Acts', 'romans': 'Romans', '1-corinthians': '1 Corinthians',
  '2-corinthians': '2 Corinthians', 'galatians': 'Galatians',
  'ephesians': 'Ephesians', 'philippians': 'Philippians',
  'colossians': 'Colossians', '1-thessalonians': '1 Thessalonians',
  '2-thessalonians': '2 Thessalonians', '1-timothy': '1 Timothy',
  '2-timothy': '2 Timothy', 'titus': 'Titus', 'philemon': 'Philemon',
  'hebrews': 'Hebrews', 'james': 'James', '1-peter': '1 Peter',
  '2-peter': '2 Peter', '1-john': '1 John', '2-john': '2 John',
  '3-john': '3 John', 'jude': 'Jude', 'revelation': 'Revelation',
};

// Sections for Protestant books
const PROTESTANT_SECTIONS: Record<string, string> = {
  'genesis': 'Old Testament', 'exodus': 'Old Testament', 'leviticus': 'Old Testament',
  'numbers': 'Old Testament', 'deuteronomy': 'Old Testament', 'joshua': 'Old Testament',
  'judges': 'Old Testament', 'ruth': 'Old Testament', '1-samuel': 'Old Testament',
  '2-samuel': 'Old Testament', '1-kings': 'Old Testament', '2-kings': 'Old Testament',
  '1-chronicles': 'Old Testament', '2-chronicles': 'Old Testament', 'ezra': 'Old Testament',
  'nehemiah': 'Old Testament', 'esther': 'Old Testament', 'job': 'Old Testament',
  'psalms': 'Old Testament', 'proverbs': 'Old Testament', 'ecclesiastes': 'Old Testament',
  'song-of-solomon': 'Old Testament', 'isaiah': 'Old Testament', 'jeremiah': 'Old Testament',
  'lamentations': 'Old Testament', 'ezekiel': 'Old Testament', 'daniel': 'Old Testament',
  'hosea': 'Old Testament', 'joel': 'Old Testament', 'amos': 'Old Testament',
  'obadiah': 'Old Testament', 'jonah': 'Old Testament', 'micah': 'Old Testament',
  'nahum': 'Old Testament', 'habakkuk': 'Old Testament', 'zephaniah': 'Old Testament',
  'haggai': 'Old Testament', 'zechariah': 'Old Testament', 'malachi': 'Old Testament',
  'matthew': 'New Testament', 'mark': 'New Testament', 'luke': 'New Testament',
  'john': 'New Testament', 'acts': 'New Testament', 'romans': 'New Testament',
  '1-corinthians': 'New Testament', '2-corinthians': 'New Testament', 'galatians': 'New Testament',
  'ephesians': 'New Testament', 'philippians': 'New Testament', 'colossians': 'New Testament',
  '1-thessalonians': 'New Testament', '2-thessalonians': 'New Testament', '1-timothy': 'New Testament',
  '2-timothy': 'New Testament', 'titus': 'New Testament', 'philemon': 'New Testament',
  'hebrews': 'New Testament', 'james': 'New Testament', '1-peter': 'New Testament',
  '2-peter': 'New Testament', '1-john': 'New Testament', '2-john': 'New Testament',
  '3-john': 'New Testament', 'jude': 'New Testament', 'revelation': 'New Testament',
};

const NABRE_SLUG_MAP: Record<string, { slug: string; displayName: string; section: string }> = {
  // Old Testament (39 books)
  'Genesis': { slug: 'genesis', displayName: 'Genesis', section: 'Old Testament' },
  'Exodus': { slug: 'exodus', displayName: 'Exodus', section: 'Old Testament' },
  'Leviticus': { slug: 'leviticus', displayName: 'Leviticus', section: 'Old Testament' },
  'Numbers': { slug: 'numbers', displayName: 'Numbers', section: 'Old Testament' },
  'Deuteronomy': { slug: 'deuteronomy', displayName: 'Deuteronomy', section: 'Old Testament' },
  'Joshua': { slug: 'joshua', displayName: 'Joshua', section: 'Old Testament' },
  'Judges': { slug: 'judges', displayName: 'Judges', section: 'Old Testament' },
  'Ruth': { slug: 'ruth', displayName: 'Ruth', section: 'Old Testament' },
  '1Samuel': { slug: '1-samuel', displayName: '1 Samuel', section: 'Old Testament' },
  '2Samuel': { slug: '2-samuel', displayName: '2 Samuel', section: 'Old Testament' },
  '1Kings': { slug: '1-kings', displayName: '1 Kings', section: 'Old Testament' },
  '2Kings': { slug: '2-kings', displayName: '2 Kings', section: 'Old Testament' },
  '1Chronicles': { slug: '1-chronicles', displayName: '1 Chronicles', section: 'Old Testament' },
  '2Chronicles': { slug: '2-chronicles', displayName: '2 Chronicles', section: 'Old Testament' },
  'Ezra': { slug: 'ezra', displayName: 'Ezra', section: 'Old Testament' },
  'Nehemiah': { slug: 'nehemiah', displayName: 'Nehemiah', section: 'Old Testament' },
  'Esther': { slug: 'esther', displayName: 'Esther', section: 'Old Testament' },
  'Job': { slug: 'job', displayName: 'Job', section: 'Old Testament' },
  'Psalms': { slug: 'psalms', displayName: 'Psalms', section: 'Old Testament' },
  'Proverbs': { slug: 'proverbs', displayName: 'Proverbs', section: 'Old Testament' },
  'Ecclesiastes': { slug: 'ecclesiastes', displayName: 'Ecclesiastes', section: 'Old Testament' },
  'SongofSongs': { slug: 'song-of-songs', displayName: 'Song of Songs', section: 'Old Testament' },
  'Isaiah': { slug: 'isaiah', displayName: 'Isaiah', section: 'Old Testament' },
  'Jeremiah': { slug: 'jeremiah', displayName: 'Jeremiah', section: 'Old Testament' },
  'Lamentations': { slug: 'lamentations', displayName: 'Lamentations', section: 'Old Testament' },
  'Ezekiel': { slug: 'ezekiel', displayName: 'Ezekiel', section: 'Old Testament' },
  'Daniel': { slug: 'daniel', displayName: 'Daniel', section: 'Old Testament' },
  'Hosea': { slug: 'hosea', displayName: 'Hosea', section: 'Old Testament' },
  'Joel': { slug: 'joel', displayName: 'Joel', section: 'Old Testament' },
  'Amos': { slug: 'amos', displayName: 'Amos', section: 'Old Testament' },
  'Obadiah': { slug: 'obadiah', displayName: 'Obadiah', section: 'Old Testament' },
  'Jonah': { slug: 'jonah', displayName: 'Jonah', section: 'Old Testament' },
  'Micah': { slug: 'micah', displayName: 'Micah', section: 'Old Testament' },
  'Nahum': { slug: 'nahum', displayName: 'Nahum', section: 'Old Testament' },
  'Habakkuk': { slug: 'habakkuk', displayName: 'Habakkuk', section: 'Old Testament' },
  'Zephaniah': { slug: 'zephaniah', displayName: 'Zephaniah', section: 'Old Testament' },
  'Haggai': { slug: 'haggai', displayName: 'Haggai', section: 'Old Testament' },
  'Zechariah': { slug: 'zechariah', displayName: 'Zechariah', section: 'Old Testament' },
  'Malachi': { slug: 'malachi', displayName: 'Malachi', section: 'Old Testament' },
  // Deuterocanonical (7 books)
  'Tobit': { slug: 'tobit', displayName: 'Tobit', section: 'Deuterocanonical' },
  'Judith': { slug: 'judith', displayName: 'Judith', section: 'Deuterocanonical' },
  '1Maccabees': { slug: '1-maccabees', displayName: '1 Maccabees', section: 'Deuterocanonical' },
  '2Maccabees': { slug: '2-maccabees', displayName: '2 Maccabees', section: 'Deuterocanonical' },
  'Wisdom': { slug: 'wisdom', displayName: 'Wisdom', section: 'Deuterocanonical' },
  'Sirach': { slug: 'sirach', displayName: 'Sirach', section: 'Deuterocanonical' },
  'Baruch': { slug: 'baruch', displayName: 'Baruch', section: 'Deuterocanonical' },
  // New Testament (27 books)
  'Matthew': { slug: 'matthew', displayName: 'Matthew', section: 'New Testament' },
  'Mark': { slug: 'mark', displayName: 'Mark', section: 'New Testament' },
  'Luke': { slug: 'luke', displayName: 'Luke', section: 'New Testament' },
  'John': { slug: 'john', displayName: 'John', section: 'New Testament' },
  'Acts': { slug: 'acts', displayName: 'Acts', section: 'New Testament' },
  'Romans': { slug: 'romans', displayName: 'Romans', section: 'New Testament' },
  '1Corinthians': { slug: '1-corinthians', displayName: '1 Corinthians', section: 'New Testament' },
  '2Corinthians': { slug: '2-corinthians', displayName: '2 Corinthians', section: 'New Testament' },
  'Galatians': { slug: 'galatians', displayName: 'Galatians', section: 'New Testament' },
  'Ephesians': { slug: 'ephesians', displayName: 'Ephesians', section: 'New Testament' },
  'Philippians': { slug: 'philippians', displayName: 'Philippians', section: 'New Testament' },
  'Colossians': { slug: 'colossians', displayName: 'Colossians', section: 'New Testament' },
  '1Thessalonians': { slug: '1-thessalonians', displayName: '1 Thessalonians', section: 'New Testament' },
  '2Thessalonians': { slug: '2-thessalonians', displayName: '2 Thessalonians', section: 'New Testament' },
  '1Timothy': { slug: '1-timothy', displayName: '1 Timothy', section: 'New Testament' },
  '2Timothy': { slug: '2-timothy', displayName: '2 Timothy', section: 'New Testament' },
  'Titus': { slug: 'titus', displayName: 'Titus', section: 'New Testament' },
  'Philemon': { slug: 'philemon', displayName: 'Philemon', section: 'New Testament' },
  'Hebrews': { slug: 'hebrews', displayName: 'Hebrews', section: 'New Testament' },
  'James': { slug: 'james', displayName: 'James', section: 'New Testament' },
  '1Peter': { slug: '1-peter', displayName: '1 Peter', section: 'New Testament' },
  '2Peter': { slug: '2-peter', displayName: '2 Peter', section: 'New Testament' },
  '1John': { slug: '1-john', displayName: '1 John', section: 'New Testament' },
  '2John': { slug: '2-john', displayName: '2 John', section: 'New Testament' },
  '3John': { slug: '3-john', displayName: '3 John', section: 'New Testament' },
  'Jude': { slug: 'jude', displayName: 'Jude', section: 'New Testament' },
  'Revelation': { slug: 'revelation', displayName: 'Revelation', section: 'New Testament' },
};

// NABRE canonical order for manifest (OT 39, Deut 7, NT 27)
const NABRE_BOOK_ORDER: string[] = [
  // Old Testament
  'genesis', 'exodus', 'leviticus', 'numbers', 'deuteronomy', 'joshua', 'judges', 'ruth',
  '1-samuel', '2-samuel', '1-kings', '2-kings', '1-chronicles', '2-chronicles',
  'ezra', 'nehemiah', 'esther', 'job', 'psalms', 'proverbs', 'ecclesiastes', 'song-of-songs',
  'isaiah', 'jeremiah', 'lamentations', 'ezekiel', 'daniel', 'hosea', 'joel', 'amos',
  'obadiah', 'jonah', 'micah', 'nahum', 'habakkuk', 'zephaniah', 'haggai', 'zechariah', 'malachi',
  // Deuterocanonical
  'tobit', 'judith', '1-maccabees', '2-maccabees', 'wisdom', 'sirach', 'baruch',
  // New Testament
  'matthew', 'mark', 'luke', 'john', 'acts', 'romans',
  '1-corinthians', '2-corinthians', 'galatians', 'ephesians', 'philippians',
  'colossians', '1-thessalonians', '2-thessalonians', '1-timothy', '2-timothy',
  'titus', 'philemon', 'hebrews', 'james', '1-peter', '2-peter',
  '1-john', '2-john', '3-john', 'jude', 'revelation',
];

// Quran surah slug map — all 114 entries
const QURAN_SLUG_MAP: Record<number, { slug: string; displayName: string }> = {
  1: { slug: 'al-fatiha', displayName: 'Al-Fatiha' },
  2: { slug: 'al-baqarah', displayName: 'Al-Baqarah' },
  3: { slug: 'al-imran', displayName: 'Al-Imran' },
  4: { slug: 'an-nisa', displayName: 'An-Nisa' },
  5: { slug: 'al-maidah', displayName: 'Al-Maidah' },
  6: { slug: 'al-anam', displayName: 'Al-Anam' },
  7: { slug: 'al-araf', displayName: 'Al-Araf' },
  8: { slug: 'al-anfal', displayName: 'Al-Anfal' },
  9: { slug: 'at-tawbah', displayName: 'At-Tawbah' },
  10: { slug: 'yunus', displayName: 'Yunus' },
  11: { slug: 'hud', displayName: 'Hud' },
  12: { slug: 'yusuf', displayName: 'Yusuf' },
  13: { slug: 'ar-rad', displayName: 'Ar-Rad' },
  14: { slug: 'ibrahim', displayName: 'Ibrahim' },
  15: { slug: 'al-hijr', displayName: 'Al-Hijr' },
  16: { slug: 'an-nahl', displayName: 'An-Nahl' },
  17: { slug: 'al-isra', displayName: 'Al-Isra' },
  18: { slug: 'al-kahf', displayName: 'Al-Kahf' },
  19: { slug: 'maryam', displayName: 'Maryam' },
  20: { slug: 'ta-ha', displayName: 'Ta-Ha' },
  21: { slug: 'al-anbiya', displayName: 'Al-Anbiya' },
  22: { slug: 'al-hajj', displayName: 'Al-Hajj' },
  23: { slug: 'al-muminun', displayName: 'Al-Muminun' },
  24: { slug: 'an-nur', displayName: 'An-Nur' },
  25: { slug: 'al-furqan', displayName: 'Al-Furqan' },
  26: { slug: 'ash-shuara', displayName: 'Ash-Shuara' },
  27: { slug: 'an-naml', displayName: 'An-Naml' },
  28: { slug: 'al-qasas', displayName: 'Al-Qasas' },
  29: { slug: 'al-ankabut', displayName: 'Al-Ankabut' },
  30: { slug: 'ar-rum', displayName: 'Ar-Rum' },
  31: { slug: 'luqman', displayName: 'Luqman' },
  32: { slug: 'as-sajdah', displayName: 'As-Sajdah' },
  33: { slug: 'al-ahzab', displayName: 'Al-Ahzab' },
  34: { slug: 'saba', displayName: 'Saba' },
  35: { slug: 'fatir', displayName: 'Fatir' },
  36: { slug: 'ya-sin', displayName: 'Ya-Sin' },
  37: { slug: 'as-saffat', displayName: 'As-Saffat' },
  38: { slug: 'sad', displayName: 'Sad' },
  39: { slug: 'az-zumar', displayName: 'Az-Zumar' },
  40: { slug: 'ghafir', displayName: 'Ghafir' },
  41: { slug: 'fussilat', displayName: 'Fussilat' },
  42: { slug: 'ash-shura', displayName: 'Ash-Shura' },
  43: { slug: 'az-zukhruf', displayName: 'Az-Zukhruf' },
  44: { slug: 'ad-dukhan', displayName: 'Ad-Dukhan' },
  45: { slug: 'al-jathiyah', displayName: 'Al-Jathiyah' },
  46: { slug: 'al-ahqaf', displayName: 'Al-Ahqaf' },
  47: { slug: 'muhammad', displayName: 'Muhammad' },
  48: { slug: 'al-fath', displayName: 'Al-Fath' },
  49: { slug: 'al-hujurat', displayName: 'Al-Hujurat' },
  50: { slug: 'qaf', displayName: 'Qaf' },
  51: { slug: 'adh-dhariyat', displayName: 'Adh-Dhariyat' },
  52: { slug: 'at-tur', displayName: 'At-Tur' },
  53: { slug: 'an-najm', displayName: 'An-Najm' },
  54: { slug: 'al-qamar', displayName: 'Al-Qamar' },
  55: { slug: 'ar-rahman', displayName: 'Ar-Rahman' },
  56: { slug: 'al-waqiah', displayName: 'Al-Waqiah' },
  57: { slug: 'al-hadid', displayName: 'Al-Hadid' },
  58: { slug: 'al-mujadila', displayName: 'Al-Mujadila' },
  59: { slug: 'al-hashr', displayName: 'Al-Hashr' },
  60: { slug: 'al-mumtahanah', displayName: 'Al-Mumtahanah' },
  61: { slug: 'as-saf', displayName: 'As-Saf' },
  62: { slug: 'al-jumuah', displayName: 'Al-Jumuah' },
  63: { slug: 'al-munafiqun', displayName: 'Al-Munafiqun' },
  64: { slug: 'at-taghabun', displayName: 'At-Taghabun' },
  65: { slug: 'at-talaq', displayName: 'At-Talaq' },
  66: { slug: 'at-tahrim', displayName: 'At-Tahrim' },
  67: { slug: 'al-mulk', displayName: 'Al-Mulk' },
  68: { slug: 'al-qalam', displayName: 'Al-Qalam' },
  69: { slug: 'al-haqqah', displayName: 'Al-Haqqah' },
  70: { slug: 'al-maarij', displayName: 'Al-Maarij' },
  71: { slug: 'nuh', displayName: 'Nuh' },
  72: { slug: 'al-jinn', displayName: 'Al-Jinn' },
  73: { slug: 'al-muzzammil', displayName: 'Al-Muzzammil' },
  74: { slug: 'al-muddaththir', displayName: 'Al-Muddaththir' },
  75: { slug: 'al-qiyamah', displayName: 'Al-Qiyamah' },
  76: { slug: 'al-insan', displayName: 'Al-Insan' },
  77: { slug: 'al-mursalat', displayName: 'Al-Mursalat' },
  78: { slug: 'an-naba', displayName: 'An-Naba' },
  79: { slug: 'an-naziat', displayName: 'An-Naziat' },
  80: { slug: 'abasa', displayName: 'Abasa' },
  81: { slug: 'at-takwir', displayName: 'At-Takwir' },
  82: { slug: 'al-infitar', displayName: 'Al-Infitar' },
  83: { slug: 'al-mutaffifin', displayName: 'Al-Mutaffifin' },
  84: { slug: 'al-inshiqaq', displayName: 'Al-Inshiqaq' },
  85: { slug: 'al-buruj', displayName: 'Al-Buruj' },
  86: { slug: 'at-tariq', displayName: 'At-Tariq' },
  87: { slug: 'al-ala', displayName: 'Al-Ala' },
  88: { slug: 'al-ghashiyah', displayName: 'Al-Ghashiyah' },
  89: { slug: 'al-fajr', displayName: 'Al-Fajr' },
  90: { slug: 'al-balad', displayName: 'Al-Balad' },
  91: { slug: 'ash-shams', displayName: 'Ash-Shams' },
  92: { slug: 'al-layl', displayName: 'Al-Layl' },
  93: { slug: 'ad-duha', displayName: 'Ad-Duha' },
  94: { slug: 'ash-sharh', displayName: 'Ash-Sharh' },
  95: { slug: 'at-tin', displayName: 'At-Tin' },
  96: { slug: 'al-alaq', displayName: 'Al-Alaq' },
  97: { slug: 'al-qadr', displayName: 'Al-Qadr' },
  98: { slug: 'al-bayyinah', displayName: 'Al-Bayyinah' },
  99: { slug: 'az-zalzalah', displayName: 'Az-Zalzalah' },
  100: { slug: 'al-adiyat', displayName: 'Al-Adiyat' },
  101: { slug: 'al-qariah', displayName: 'Al-Qariah' },
  102: { slug: 'at-takathur', displayName: 'At-Takathur' },
  103: { slug: 'al-asr', displayName: 'Al-Asr' },
  104: { slug: 'al-humazah', displayName: 'Al-Humazah' },
  105: { slug: 'al-fil', displayName: 'Al-Fil' },
  106: { slug: 'quraysh', displayName: 'Quraysh' },
  107: { slug: 'al-maun', displayName: 'Al-Maun' },
  108: { slug: 'al-kawthar', displayName: 'Al-Kawthar' },
  109: { slug: 'al-kafirun', displayName: 'Al-Kafirun' },
  110: { slug: 'an-nasr', displayName: 'An-Nasr' },
  111: { slug: 'al-masad', displayName: 'Al-Masad' },
  112: { slug: 'al-ikhlas', displayName: 'Al-Ikhlas' },
  113: { slug: 'al-falaq', displayName: 'Al-Falaq' },
  114: { slug: 'an-nas', displayName: 'An-Nas' },
};

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

function writeJson(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function cleanQuranText(raw: string): string {
  // Remove footnote markers: digit-only sequences adjacent to non-digit chars
  // e.g. "Allah,1Lord" → "Allah,Lord"
  let cleaned = raw.replace(/(?<=[^\d])\d+(?=[^\d])/g, '');
  // Also handle leading digits at start or end
  cleaned = cleaned.replace(/^\d+/, '').replace(/\d+$/, '');
  // Truncate at newline if remaining text after newline is long (footnote body)
  const newlineIdx = cleaned.indexOf('\n');
  if (newlineIdx !== -1 && cleaned.slice(newlineIdx + 1).length > 50) {
    cleaned = cleaned.slice(0, newlineIdx);
  }
  return cleaned.trim();
}

// ---------------------------------------------------------------------------
// Task 1: Bible translations (Protestant — KJV, WEB, NIV, NLT, NKJV, NASB, GNV)
// ---------------------------------------------------------------------------

type BibleSource = Record<string, Record<string, Record<string, string>>>;

interface TranslationConfig {
  id: string;
  sourceFile: string;
  outputDir: string;
}

const ROOT = path.resolve('C:/Users/khule/OneDrive/Desktop/ScriptureComix');
const PUBLIC_DATA = path.join(ROOT, 'public', 'data');

const PROTESTANT_TRANSLATIONS: TranslationConfig[] = [
  {
    id: 'kjv',
    sourceFile: path.join(ROOT, 'bible-translations-master', 'bible-translations-master', 'KJV', 'KJV_bible.json'),
    outputDir: path.join(PUBLIC_DATA, 'protestant', 'kjv'),
  },
  {
    id: 'web',
    sourceFile: path.join(ROOT, 'bible-translations-master', 'bible-translations-master', 'WEB', 'WEB_bible.json'),
    outputDir: path.join(PUBLIC_DATA, 'protestant', 'web'),
  },
  {
    id: 'niv',
    sourceFile: path.join(ROOT, 'bible-translations-master', 'bible-translations-master', 'NIV', 'NIV_bible.json'),
    outputDir: path.join(PUBLIC_DATA, 'protestant', 'niv'),
  },
  {
    id: 'nlt',
    sourceFile: path.join(ROOT, 'bible-translations-master', 'bible-translations-master', 'NLT', 'NLT_bible.json'),
    outputDir: path.join(PUBLIC_DATA, 'protestant', 'nlt'),
  },
  {
    id: 'nkjv',
    sourceFile: path.join(ROOT, 'bible-translations-master', 'bible-translations-master', 'NKJV', 'NKJV_bible.json'),
    outputDir: path.join(PUBLIC_DATA, 'protestant', 'nkjv'),
  },
  {
    id: 'nasb',
    sourceFile: path.join(ROOT, 'bible-translations-master', 'bible-translations-master', 'NASB', 'NASB_bible.json'),
    outputDir: path.join(PUBLIC_DATA, 'protestant', 'nasb'),
  },
  {
    id: 'gnv',
    sourceFile: path.join(ROOT, 'bible-translations-master', 'bible-translations-master', 'GNV', 'GNV_bible.json'),
    outputDir: path.join(PUBLIC_DATA, 'protestant', 'gnv'),
  },
];

/**
 * Transform a bible-translations-master book into a flat verse map.
 * Input: { "1": { "1": "text", "2": "text" }, "2": {...} }
 * Output: { "1:1": "text", "1:2": "text", "2:1": "text" }
 */
function transformBibleBook(
  sourceBook: Record<string, Record<string, string>>
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [chapter, verses] of Object.entries(sourceBook)) {
    for (const [verse, text] of Object.entries(verses)) {
      result[`${chapter}:${verse}`] = text;
    }
  }
  return result;
}

/**
 * Compute chapter verse counts from a flat verse map.
 * Returns array indexed 0 = chapter 1, value = number of verses.
 */
function computeChapterCounts(verseMap: Record<string, string>): number[] {
  const chapterMap: Record<number, number> = {};
  for (const key of Object.keys(verseMap)) {
    const [ch] = key.split(':');
    const chNum = parseInt(ch, 10);
    chapterMap[chNum] = (chapterMap[chNum] ?? 0) + 1;
  }
  const maxChapter = Math.max(...Object.keys(chapterMap).map(Number));
  const result: number[] = [];
  for (let i = 1; i <= maxChapter; i++) {
    result.push(chapterMap[i] ?? 0);
  }
  return result;
}

/**
 * Process all Protestant translations.
 * Returns a map of slug -> chapter verse counts (from KJV, used for manifest).
 */
function processProtestantTranslations(): Map<string, number[]> {
  const kjvChapterCounts = new Map<string, number[]>();

  for (const translation of PROTESTANT_TRANSLATIONS) {
    if (!fs.existsSync(translation.sourceFile)) {
      console.warn(`  [WARN] Source file not found, skipping: ${translation.sourceFile}`);
      continue;
    }

    console.log(`  Processing ${translation.id.toUpperCase()}...`);
    const source = JSON.parse(fs.readFileSync(translation.sourceFile, 'utf-8')) as BibleSource;

    let bookCount = 0;
    for (const [bookName, bookData] of Object.entries(source)) {
      const slug = CANONICAL_SLUG_MAP[bookName];
      if (!slug) {
        console.warn(`    [WARN] No slug mapping for book: "${bookName}" in ${translation.id}`);
        continue;
      }

      const verseMap = transformBibleBook(bookData);
      const outPath = path.join(translation.outputDir, `${slug}.json`);
      writeJson(outPath, verseMap);
      bookCount++;

      // Collect chapter counts from KJV for use in manifest
      if (translation.id === 'kjv') {
        kjvChapterCounts.set(slug, computeChapterCounts(verseMap));
      }
    }

    console.log(`    ${bookCount} books written to ${translation.outputDir}`);
  }

  return kjvChapterCounts;
}

// ---------------------------------------------------------------------------
// Task 1: NABRE (Catholic)
// ---------------------------------------------------------------------------

interface NabreBookFile {
  book: string;
  chapters: Array<{
    chapter: number;
    verses: Array<{ verse: number; text: string }>;
  }>;
}

/**
 * Transform NABRE book data into flat verse map.
 * Input: chapters array from NABRE JSON
 * Output: { "1:1": "text", ... }
 */
function transformNabreBook(
  chapters: NabreBookFile['chapters']
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const ch of chapters) {
    for (const v of ch.verses) {
      result[`${ch.chapter}:${v.verse}`] = v.text;
    }
  }
  return result;
}

/**
 * Process NABRE dataset.
 * Returns map of slug -> chapter verse counts.
 */
function processNabre(): Map<string, { info: { slug: string; displayName: string; section: string }; counts: number[] }> {
  const nabreDir = path.join(
    ROOT,
    'bible-nabre-json-dataset-including-deutoronocanical',
    'bible-nabre-json-dataset-master',
    'generated_data',
    'books'
  );
  const nabreOutDir = path.join(PUBLIC_DATA, 'catholic', 'nabre');
  const ethiopianOutDir = path.join(PUBLIC_DATA, 'ethiopian', 'kjv');

  const result = new Map<string, { info: { slug: string; displayName: string; section: string }; counts: number[] }>();
  const unmatched: string[] = [];

  const files = fs.readdirSync(nabreDir).filter(f => f.endsWith('.json'));
  console.log(`  Found ${files.length} NABRE source files`);

  for (const filename of files) {
    const bookKey = filename.replace('.json', '');
    const mapping = NABRE_SLUG_MAP[bookKey];

    if (!mapping) {
      console.warn(`  [WARN] No NABRE mapping for: "${bookKey}" — skipping`);
      unmatched.push(bookKey);
      continue;
    }

    const sourceData = JSON.parse(
      fs.readFileSync(path.join(nabreDir, filename), 'utf-8')
    ) as NabreBookFile;

    const verseMap = transformNabreBook(sourceData.chapters);
    const outPath = path.join(nabreOutDir, `${mapping.slug}.json`);
    writeJson(outPath, verseMap);

    // Also write deuterocanonical books to Ethiopian directory
    if (mapping.section === 'Deuterocanonical') {
      const ethPath = path.join(ethiopianOutDir, `${mapping.slug}.json`);
      writeJson(ethPath, verseMap);
    }

    result.set(mapping.slug, {
      info: mapping,
      counts: computeChapterCounts(verseMap),
    });
  }

  if (unmatched.length > 0) {
    console.warn(`  [WARN] ${unmatched.length} NABRE files unmatched: ${unmatched.join(', ')}`);
  }

  console.log(`  ${result.size} NABRE books written to ${nabreOutDir}`);

  if (result.size !== 73) {
    console.warn(`  [WARN] Expected 73 NABRE books, got ${result.size}`);
    // Find which expected keys were not found
    const slugsFound = new Set(result.keys());
    const expected = Object.values(NABRE_SLUG_MAP).map(m => m.slug);
    const missing = expected.filter(s => !slugsFound.has(s));
    if (missing.length > 0) {
      console.warn(`  [WARN] Missing expected slugs: ${missing.join(', ')}`);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Task 1: Ethiopian Orthodox
// ---------------------------------------------------------------------------

function processEthiopian(
  kjvChapterCounts: Map<string, number[]>,
  kjvSourceData: BibleSource
): void {
  const ethiopianOutDir = path.join(PUBLIC_DATA, 'ethiopian', 'kjv');

  // Copy all 66 Protestant KJV books
  let kjvCopied = 0;
  for (const slug of PROTESTANT_BOOK_ORDER) {
    const srcPath = path.join(PUBLIC_DATA, 'protestant', 'kjv', `${slug}.json`);
    const destPath = path.join(ethiopianOutDir, `${slug}.json`);
    if (fs.existsSync(srcPath)) {
      // idempotent: read then write (copy content)
      const content = fs.readFileSync(srcPath, 'utf-8');
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.writeFileSync(destPath, content, 'utf-8');
      kjvCopied++;
    }
  }
  console.log(`  Copied ${kjvCopied} KJV books to Ethiopian directory`);

  // Enoch placeholder
  const enochPath = path.join(ethiopianOutDir, '1-enoch.json');
  writeJson(enochPath, { '1:1': '[Text pending -- R.H. Charles 1912 translation to be sourced]' });
  console.warn('  [WARN] 1 Enoch: placeholder stub written (real text not yet sourced)');

  // Jubilees placeholder
  const jubileesPath = path.join(ethiopianOutDir, 'jubilees.json');
  writeJson(jubileesPath, { '1:1': '[Text pending -- R.H. Charles 1913 translation to be sourced]' });
  console.warn('  [WARN] Jubilees: placeholder stub written (real text not yet sourced)');
  // Deuterocanonical books are written by processNabre() already
}

// ---------------------------------------------------------------------------
// Task 1: Quran
// ---------------------------------------------------------------------------

interface QuranSource {
  total_surahs: number;
  total_verses: number;
  chapters: Record<string, {
    id: number;
    surah_name: string;
    surah_name_ar: string;
    translation: string;
    type: string;
    total_verses: number;
    verses: Record<string, {
      id: number;
      content: string;
      translation_eng: string;
      transliteration: string;
    }>;
  }>;
}

/**
 * Process Quran dataset.
 * Returns map of surah number -> { basmala?, verseCount, slug }.
 */
function processQuran(): { basmala: string; surahData: Map<number, { slug: string; verseCount: number }> } {
  const quranFile = path.join(
    ROOT,
    'AL-QURAN_WITH_TRANSLATION_AND_TRANSLITERATION',
    'ad8cb85f6a92c08f7acf50d245524a5f-62f4b52cbd394de8499e54f3c65617774bc0edb5',
    'AL-QURAN_WITH_TRANSLATION_AND_TRANSLITERATION.json'
  );
  const quranOutDir = path.join(PUBLIC_DATA, 'quran', 'yusuf-ali');

  const source = JSON.parse(fs.readFileSync(quranFile, 'utf-8')) as QuranSource;

  let totalAyahs = 0;
  let basmalaText = '';
  const surahData = new Map<number, { slug: string; verseCount: number }>();

  for (let surahNum = 1; surahNum <= 114; surahNum++) {
    const surah = source.chapters[String(surahNum)];
    if (!surah) {
      console.warn(`  [WARN] Surah ${surahNum} not found in source`);
      continue;
    }

    const surahInfo = QURAN_SLUG_MAP[surahNum];
    if (!surahInfo) {
      console.warn(`  [WARN] No slug mapping for surah ${surahNum}`);
      continue;
    }

    const verseMap: Record<string, string> = {};

    if (surahNum === 1) {
      // Al-Fatiha: remap Basmala as header, renumber verses 2-7 to 1-6
      const verses = surah.verses;
      basmalaText = cleanQuranText(verses['1'].translation_eng);
      for (let i = 2; i <= 7; i++) {
        const v = verses[String(i)];
        if (v) {
          verseMap[String(i - 1)] = cleanQuranText(v.translation_eng);
        }
      }
    } else {
      // All other surahs: use verse numbers as-is
      for (const [verseNumStr, verseData] of Object.entries(surah.verses)) {
        verseMap[verseNumStr] = cleanQuranText(verseData.translation_eng);
      }
    }

    const verseCount = Object.keys(verseMap).length;
    totalAyahs += verseCount;

    const outPath = path.join(quranOutDir, `${surahInfo.slug}.json`);
    writeJson(outPath, verseMap);

    surahData.set(surahNum, { slug: surahInfo.slug, verseCount });
  }

  console.log(`  Al-Fatiha ayah count: ${surahData.get(1)?.verseCount} (must be 6)`);
  console.log(`  Total Quran ayahs: ${totalAyahs} (must be 6236)`);

  if (surahData.get(1)?.verseCount !== 6) {
    console.warn(`  [WARN] Al-Fatiha has ${surahData.get(1)?.verseCount} ayahs, expected 6`);
  }
  if (totalAyahs !== 6236) {
    console.warn(`  [WARN] Total Quran ayahs: ${totalAyahs}, expected 6236`);
  }

  console.log(`  114 surah files written to ${quranOutDir}`);
  return { basmala: basmalaText, surahData };
}

// ---------------------------------------------------------------------------
// Task 2: Generate canon manifests
// ---------------------------------------------------------------------------

function generateProtestantManifest(kjvChapterCounts: Map<string, number[]>): void {
  const books: ManifestBook[] = PROTESTANT_BOOK_ORDER.map(slug => ({
    slug,
    displayName: PROTESTANT_DISPLAY_NAMES[slug] ?? slug,
    section: PROTESTANT_SECTIONS[slug],
    chapters: kjvChapterCounts.get(slug) ?? [],
  }));

  const manifest: CanonManifest = {
    tradition: 'protestant',
    displayName: 'Protestant',
    books,
    translations: [
      { id: 'kjv', displayName: 'King James Version', isPublicDomain: true },
      { id: 'web', displayName: 'World English Bible', isPublicDomain: true },
      { id: 'gnv', displayName: 'Geneva Bible (1599)', isPublicDomain: true },
      {
        id: 'niv',
        displayName: 'New International Version',
        copyright: 'Scripture taken from the Holy Bible, NEW INTERNATIONAL VERSION. Copyright 1973, 1978, 1984, 2011 by Biblica, Inc. Used by permission.',
        isPublicDomain: false,
      },
      {
        id: 'nlt',
        displayName: 'New Living Translation',
        copyright: 'Scripture quotations are taken from the Holy Bible, New Living Translation, copyright 1996, 2004, 2015 by Tyndale House Foundation. Used by permission.',
        isPublicDomain: false,
      },
      {
        id: 'nkjv',
        displayName: 'New King James Version',
        copyright: 'Scripture taken from the New King James Version. Copyright 1982 by Thomas Nelson. Used by permission.',
        isPublicDomain: false,
      },
      {
        id: 'nasb',
        displayName: 'New American Standard Bible',
        copyright: 'Scripture quotations taken from the (NASB) New American Standard Bible, Copyright 1960, 1971, 1977, 1995, 2020 by The Lockman Foundation. Used by permission.',
        isPublicDomain: false,
      },
    ],
  };

  writeJson(path.join(PUBLIC_DATA, 'protestant', 'manifest.json'), manifest);
  console.log(`  Protestant manifest: ${manifest.books.length} books, ${manifest.translations.length} translations`);
}

function generateCatholicManifest(
  nabreData: Map<string, { info: { slug: string; displayName: string; section: string }; counts: number[] }>
): void {
  const books: ManifestBook[] = NABRE_BOOK_ORDER
    .map(slug => {
      const entry = nabreData.get(slug);
      if (!entry) return null;
      return {
        slug: entry.info.slug,
        displayName: entry.info.displayName,
        section: entry.info.section,
        chapters: entry.counts,
      } as ManifestBook;
    })
    .filter((b): b is ManifestBook => b !== null);

  const manifest: CanonManifest = {
    tradition: 'catholic',
    displayName: 'Catholic',
    books,
    translations: [
      {
        id: 'nabre',
        displayName: 'New American Bible Revised Edition',
        copyright: 'Scripture texts used in this work are taken from the New American Bible, Revised Edition, copyright 2010, 1991, 1986, 1970 by the Confraternity of Christian Doctrine, Washington, D.C.',
        isPublicDomain: false,
      },
    ],
  };

  writeJson(path.join(PUBLIC_DATA, 'catholic', 'manifest.json'), manifest);
  console.log(`  Catholic manifest: ${manifest.books.length} books, ${manifest.translations.length} translations`);
}

function generateEthiopianManifest(
  kjvChapterCounts: Map<string, number[]>,
  nabreData: Map<string, { info: { slug: string; displayName: string; section: string }; counts: number[] }>
): void {
  const books: ManifestBook[] = [];

  // Protestant 66 books (OT + NT)
  for (const slug of PROTESTANT_BOOK_ORDER) {
    books.push({
      slug,
      displayName: PROTESTANT_DISPLAY_NAMES[slug] ?? slug,
      section: PROTESTANT_SECTIONS[slug],
      chapters: kjvChapterCounts.get(slug) ?? [],
    });
  }

  // Deuterocanonical (7 books from NABRE)
  const deutSlugOrder = ['tobit', 'judith', '1-maccabees', '2-maccabees', 'wisdom', 'sirach', 'baruch'];
  for (const slug of deutSlugOrder) {
    const entry = nabreData.get(slug);
    if (entry) {
      books.push({
        slug: entry.info.slug,
        displayName: entry.info.displayName,
        section: 'Deuterocanonical',
        chapters: entry.counts,
      });
    }
  }

  // Additional Books (Enoch + Jubilees stubs). Chapter counts are real
  // (Charles 1912/1913); a verse count of 0 means "unknown" — the app fills
  // such chapters whole (borrow or AI) and learns the count on first read.
  books.push({
    slug: '1-enoch',
    displayName: '1 Enoch',
    section: 'Additional Books',
    chapters: Array(108).fill(0),
  });
  books.push({
    slug: 'jubilees',
    displayName: 'Jubilees',
    section: 'Additional Books',
    chapters: Array(50).fill(0),
  });

  const manifest: CanonManifest = {
    tradition: 'ethiopian',
    displayName: 'Ethiopian Orthodox',
    books,
    translations: [
      {
        id: 'kjv',
        displayName: 'King James Version / Public Domain',
        isPublicDomain: true,
      },
    ],
  };

  writeJson(path.join(PUBLIC_DATA, 'ethiopian', 'manifest.json'), manifest);
  console.log(`  Ethiopian manifest: ${manifest.books.length} books, ${manifest.translations.length} translations`);
}

function generateQuranManifest(
  basmala: string,
  surahData: Map<number, { slug: string; verseCount: number }>
): void {
  const books: ManifestBook[] = [];

  for (let i = 1; i <= 114; i++) {
    const surahInfo = QURAN_SLUG_MAP[i];
    const data = surahData.get(i);
    if (!surahInfo || !data) continue;
    books.push({
      slug: surahInfo.slug,
      displayName: surahInfo.displayName,
      chapters: [data.verseCount],
    });
  }

  const manifest: CanonManifest & { basmala: string } = {
    tradition: 'quran',
    displayName: 'Quran',
    basmala,
    books,
    translations: [
      {
        id: 'yusuf-ali',
        displayName: 'English Translation',
        isPublicDomain: true,
      },
    ],
  };

  writeJson(path.join(PUBLIC_DATA, 'quran', 'manifest.json'), manifest);
  const totalAyahs = books.reduce((sum, b) => sum + b.chapters[0], 0);
  console.log(`  Quran manifest: ${manifest.books.length} surahs, ${manifest.translations.length} translation, Al-Fatiha ayahs: ${books[0]?.chapters[0]}, total ayahs: ${totalAyahs}`);
}

// ---------------------------------------------------------------------------
// Task 2: .gitignore entries
// ---------------------------------------------------------------------------

function updateGitignore(): void {
  const gitignorePath = path.join(ROOT, '.gitignore');
  const current = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf-8') : '';

  const entriesToAdd = [
    'public/data/protestant/niv/',
    'public/data/protestant/nlt/',
    'public/data/protestant/nkjv/',
    'public/data/protestant/nasb/',
    'public/data/catholic/nabre/',
  ];

  const newEntries = entriesToAdd.filter(e => !current.includes(e));

  if (newEntries.length > 0) {
    const addition = '\n# Copyrighted Bible translations — generated locally, not committed\n' +
      newEntries.join('\n') + '\n';
    fs.writeFileSync(gitignorePath, current + addition, 'utf-8');
    console.log(`  Added ${newEntries.length} entries to .gitignore`);
  } else {
    console.log('  .gitignore already up to date');
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('=== ScriptureComix Data Transformation ===\n');

  // Protestant translations
  console.log('[1/4] Processing Protestant translations (KJV, WEB, NIV, NLT, NKJV, NASB, GNV)...');
  const kjvChapterCounts = processProtestantTranslations();
  console.log(`  Total Protestant book slugs tracked: ${kjvChapterCounts.size}\n`);

  // NABRE (Catholic)
  console.log('[2/4] Processing NABRE (Catholic, 73 books)...');
  const nabreData = processNabre();
  console.log();

  // Ethiopian Orthodox
  console.log('[3/4] Processing Ethiopian Orthodox...');
  processEthiopian(kjvChapterCounts, {} as BibleSource);
  console.log();

  // Quran
  console.log('[4/4] Processing Quran (114 surahs)...');
  const { basmala, surahData } = processQuran();
  console.log();

  // Manifests
  console.log('[5/5] Generating canon manifests...');
  generateProtestantManifest(kjvChapterCounts);
  generateCatholicManifest(nabreData);
  generateEthiopianManifest(kjvChapterCounts, nabreData);
  generateQuranManifest(basmala, surahData);
  console.log();

  // .gitignore
  console.log('[6/6] Updating .gitignore...');
  updateGitignore();
  console.log();

  // Summary
  console.log('=== Transformation Complete ===');
  console.log(`Protestant: ${kjvChapterCounts.size} books (KJV source), 7 translations`);
  console.log(`Catholic: ${nabreData.size} books, 1 translation (NABRE)`);
  const ethBookCount = 66 + 7 + 2; // protestant + deuterocanonical + stubs
  console.log(`Ethiopian: ${ethBookCount} books, 1 translation (KJV/NABRE/stubs)`);
  const totalQuranAyahs = Array.from(surahData.values()).reduce((s, d) => s + d.verseCount, 0);
  console.log(`Quran: 114 surahs, 1 translation, total ayahs: ${totalQuranAyahs}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
