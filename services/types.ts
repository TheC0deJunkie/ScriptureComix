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
  id: string;             // "kjv", "niv", "nabre", "yusuf-ali", "zul1893"
  displayName: string;    // "King James Version"
  copyright?: string | null; // attribution string shown before selection (null for PD)
  isPublicDomain: boolean;
  /** BCP-47 language tag ("en", "zu"). Groups the picker and sets `lang` on the text. English when absent. */
  language?: string;
}

/** The language a translation is in; older manifests carry no tag and are English. */
export const translationLanguage = (t: Pick<TranslationMeta, 'language'> | null | undefined): string => t?.language || 'en';

/** Human name for a language tag, for the picker's group headings. */
export const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English', zu: 'isiZulu', xh: 'isiXhosa', st: 'Sesotho', nso: 'Sepedi', tn: 'Setswana', af: 'Afrikaans', ar: 'Arabic', sw: 'Kiswahili',
};
export const languageName = (tag: string): string => LANGUAGE_NAMES[tag] || tag;

// All traditions in order for the switcher dropdown
export const TRADITIONS: Tradition[] = ['protestant', 'catholic', 'ethiopian', 'quran'];
