// Tradition identifiers — the four top-level canon groupings
export type Tradition = 'protestant' | 'catholic' | 'ethiopian' | 'quran';

// Display labels per tradition
export const TRADITION_LABELS: Record<Tradition, string> = {
  protestant: 'Protestant',
  catholic: 'Catholic',
  ethiopian: 'Ethiopian Orthodox',
  quran: 'Quran',
};

// Labels for the 3-level navigation per tradition
export const NAV_LABELS: Record<Tradition, { book: string; chapter: string; verse: string }> = {
  protestant: { book: 'Book', chapter: 'Chapter', verse: 'Verse' },
  catholic: { book: 'Book', chapter: 'Chapter', verse: 'Verse' },
  ethiopian: { book: 'Book', chapter: 'Chapter', verse: 'Verse' },
  quran: { book: 'Surah', chapter: 'Surah', verse: 'Ayah' },
};

// Canon manifest — loaded eagerly, one per tradition
export interface CanonManifest {
  tradition: Tradition;
  displayName: string;
  books: ManifestBook[];
  translations: TranslationMeta[];
}

// Single book entry in the manifest
export interface ManifestBook {
  slug: string;           // kebab-case file name, e.g. "genesis", "al-fatiha"
  displayName: string;    // human-readable, e.g. "Genesis", "Al-Fatiha"
  section?: string;       // e.g. "Old Testament", "Deuterocanonical", "Additional Books"
  chapters: number[];     // verse count per chapter; index 0 = chapter 1
}

// Translation metadata shown in picker
export interface TranslationMeta {
  id: string;             // "kjv", "niv", "nabre", "yusuf-ali"
  displayName: string;    // "King James Version"
  copyright?: string;     // attribution string shown before selection (null for PD)
  isPublicDomain: boolean;
}

// All traditions in order for the switcher dropdown
export const TRADITIONS: Tradition[] = ['protestant', 'catholic', 'ethiopian', 'quran'];
