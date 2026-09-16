
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  BookOpen, Sparkles, RefreshCw, Download, ChevronRight, ChevronLeft, 
  Trophy, Flame, Bookmark, Brain, X, Save, Edit3, HelpCircle, User,
  PlayCircle, Maximize2, Palette, Info, PauseCircle, Book, Globe, Lightbulb, Heart, Lock, Users, Compass, Archive, Library, Send
} from 'lucide-react';
import { generateComicScript, generatePanelImage, generateQuiz, explainText, generateSpeech } from './services/geminiService';
import { ComicPanel } from './components/ComicPanel';
import { Loader } from './components/Loader';
import { DonationBanner } from './components/DonationBanner';
import { MissionModal } from './components/MissionModal';
import { FounderStoryModal } from './components/FounderStoryModal';
import { CharacterLibrary } from './components/CharacterLibrary';
import { GuidedJourneysBoard } from './components/GuidedJourneys';
import { CollaborativeHub } from './components/CollaborativeHub';
import { CharacterBuilder } from './components/CharacterBuilder';
import { OfflinePackManager } from './components/OfflinePackManager';
import { GUIDED_JOURNEYS } from './data/guidedJourneys';
import { 
  ComicPanelData, BibleVersion, BIBLE_BOOKS, FREE_ALLOWED_BOOKS, BOOK_COLLECTIONS, UserStats, 
  QuizResponse, ArtStyle, CharacterProfile, UserTier, TIER_LIMITS, SUPPORTED_LANGUAGES, FREE_VERSIONS, EXPLORER_VERSIONS, FREE_STYLES, EXPLORER_STYLES,
  JourneyProgress, StudyGroup, CustomHero, OfflinePack, CachedChapter, ChapterVerse, TextCatalogEntry, ReaderProfile, ChapterProvenance,
  PassagePointer, ReflectionEntry
} from './types';
import type { VerseSelection, CompanionText } from './components/ScriptureReader';
import { sameChapter, versesOfKey } from './services/refs';
import { getCacheKey, loadCachedChapter, saveCachedChapter } from './services/cacheService';
import { loadChapter, prefetchNeighbours, loadTextCatalog, discoverScriptures, loadScriptureData, extractVersesFromScripture, ScriptureEntry, resolveBook } from './services/textLibrary';
import { getStoreStats, ScriptureStoreStats } from './services/scriptureStore';
import { getQuiz, QuizPick } from './services/quizBank';
import { getChapterContext, ContextResult } from './services/contextBank';
import { ChapterContextPanel } from './components/ChapterContextPanel';
import { ScriptureReader } from './components/ScriptureReader';
import { ScenesView } from './components/ScenesView';
import { getScenes, ensureSceneImages, SceneResult } from './services/sceneBank';
import { runtimeAIEnabled } from './services/runtimeConfig';
import { loadManifest } from './services/manifestService';
import { Tradition } from './services/types';
import { ScriptureSourceBar } from './components/ScriptureSourceBar';
import { PassagePicker } from './components/PassagePicker';
import { CirclePill, MemberAvatar } from './components/CirclePill';
import { StudyLibrary, OpenTarget } from './components/StudyLibrary';
import {
  UiProvider, useToast, useConfirm, Button, IconButton, Segmented, Popover, MenuItem, Select, Dialog, Drawer, TextArea, TextInput, Card, Eyebrow, Pill, EscapeLayer, cx,
} from './components/ui/primitives';
import { getLastRead, setLastRead as persistLastRead, LastRead, exportStudy, importStudy, downloadJson } from './services/studyLog';
import { generateCircleCode, decodeInvite, inviteUrl, takeInviteFromUrl } from './services/circles';
import { markChapterKey, migrateMarkStores, getVerseNotes } from './services/highlights';
import { translationLanguage, TranslationMeta } from './services/types';
import { AuthProvider, useAuth } from './components/AuthProvider';
import { AuthModal, type AuthReason } from './components/AuthModal';
import { signOutUser, providerLabel, currentUser } from './services/authService';
import { ensureUserDocument, loadUserData, saveUserProfile, saveUserStats, mergeStats } from './services/userStore';
import * as circleStore from './services/circleStore';
import type { CircleActor, CircleFocus } from './services/circleStore';
import { SupportModal } from './components/SupportModal';
import { readPaymentReturn, waitForSettlement } from './services/paymentsClient';
import { subscribeEntitlement, subscribeSponsorship, isSupporter, type Entitlement, type Sponsorship } from './services/entitlementStore';
import { sponsorshipKey, type ChapterRef } from './shared/products';

const DEFAULT_STATS: UserStats = {
  streak: 0,
  lastVisit: '',
  xp: 0,
  chaptersRead: 0,
  bookmarks: [],
  tier: UserTier.FREE,
  dailyAiUsage: 0,
  lastAiUsageDate: ''
};

const STORAGE_KEYS = {
  stats: 'scriptureComix_stats',
  notes: 'scriptureComix_notes',
  journeys: 'scriptureComix_journeys',
  activeJourney: 'scriptureComix_activeJourney',
  groups: 'scriptureComix_groups',
  heroes: 'scriptureComix_customHeroes',
  activeHeroes: 'scriptureComix_activeHeroes',
  offline: 'scriptureComix_offlinePacks',
  profile: 'scriptureComix_readerProfile',
  completed: 'scriptureComix_completed_v1',
  companion: 'scriptureComix_companion_v1',
};

const DEFAULT_TRANSLATION: Record<Tradition, string> = {
  protestant: 'nlt', catholic: 'drb', ethiopian: 'kjv', quran: 'yusuf-ali',
};

/** Safe localStorage read — returns fallback on missing, corrupt, or unparseable data */
function safeRead<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null || raw === '') return fallback;
    return JSON.parse(raw) as T;
  } catch {
    console.warn(`[storage] corrupt data at key "${key}", resetting to default`);
    return fallback;
  }
}

/** Safe localStorage write — logs warning on quota exceeded, does not crash */
function safeWrite(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`[storage] write failed for key "${key}"`, err);
  }
}

const HERO_LIMIT = 3;

const ArrowRightIcon = () => <span aria-hidden="true">→</span>;

/** Tiny "sign in" marker on a locked control. Tapping the control opens the sign-in dialog. */
const UnlockPill: React.FC<{ compact?: boolean }> = ({ compact }) => (
  <span
    aria-label="Sign in to unlock"
    className={cx(
      'ml-1 inline-flex items-center gap-0.5 rounded-full border-2 border-black bg-amber-300 text-black font-black uppercase tracking-wider leading-none shadow-[1px_1px_0_0_#000] normal-case',
      compact ? 'px-1 py-[2px] text-[8px]' : 'px-1.5 py-[3px] text-[9px]',
    )}
  >
    <Lock size={compact ? 8 : 9} strokeWidth={3} />
    {!compact && <span className="hidden lg:inline">Sign in</span>}
  </span>
);

/** What each locked feature says when it asks for an account. */
const UNLOCK: Record<'study' | 'comic' | 'quiz' | 'ai' | 'cast' | 'circle' | 'pay', AuthReason> = {
  study: { title: 'Unlock study tools', hint: 'Study mode is free with an account: verse-by-verse notes, context and highlights that follow you to every device.' },
  comic: { title: 'Unlock the comic', hint: 'The illustrated chapter is free with an account. Sign in and it opens right here.' },
  quiz: { title: 'Unlock quizzes', hint: 'Quizzes earn points and keep your streak. Sign in free and this quiz opens right away.' },
  ai: { title: 'Sign in to generate', hint: 'Generating a new comic costs real money, so it is tied to an account. Sign in free to continue.' },
  cast: { title: 'Unlock your cast', hint: 'Characters you invent are saved to your account so they can appear in every comic you generate.' },
  circle: { title: 'Sign in to read together', hint: 'Circles live online so reflections sync between members. Sign in free to start or join one.' },
  pay: { title: 'Sign in to support', hint: 'Payments are tied to an account, so what you unlock follows you to every device.' },
};

/** "Thandi", "Thandi and Sipho", "Thandi, Sipho and 2 others" */
const formatNames = (names: string[]): string => {
  if (names.length <= 1) return names[0] ?? '';
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names[0]}, ${names[1]} and ${names.length - 2} other${names.length - 2 === 1 ? '' : 's'}`;
};

const FALLBACK_VERSION_PRIORITY: BibleVersion[] = [
  BibleVersion.NLT,
  BibleVersion.KJV,
  BibleVersion.NIV,
  BibleVersion.MSG
];

const findFallbackVersion = (available: Set<BibleVersion>): BibleVersion => {
  for (const preferred of FALLBACK_VERSION_PRIORITY) {
    if (available.has(preferred)) return preferred;
  }
  const iterator = available.values().next();
  return iterator.value || BibleVersion.KJV;
};

const App: React.FC = () => {
  const toast = useToast();
  const confirm = useConfirm();
  // Open where the reader left off; Genesis 1 only on a brand-new device.
  const initialRead = useRef<LastRead | null>(getLastRead()).current;

  // Reading State
  const [selectedBook, setSelectedBook] = useState(initialRead?.bookName || 'Genesis');
  const [selectedChapter, setSelectedChapter] = useState(initialRead?.chapter || 1);
  // `version` can be a builtin `BibleVersion` or a discovered scripture id string
  // in the form `SCRIPTURE::<id>`.
  const [version, setVersion] = useState<string | BibleVersion>(BibleVersion.NLT);

  // Tradition switcher state (Plan 01-04)
  const [tradition, setTradition] = useState<Tradition>((initialRead?.tradition as Tradition) || 'protestant');
  const [selectedBookSlug, setSelectedBookSlug] = useState<string | null>(initialRead?.bookSlug ?? 'genesis');
  const [selectedTranslation, setSelectedTranslation] = useState<string | null>(initialRead?.translationId ?? 'nlt');
  const [lastRead, setLastReadState] = useState<LastRead | null>(initialRead);
  // A second language under every verse, remembered per canon ("scriptureComix_companion_v1")
  const [companionByTradition, setCompanionByTradition] = useState<Record<string, string | null>>(() => safeRead<Record<string, string | null>>(STORAGE_KEYS.companion, {}));
  const [companionText, setCompanionText] = useState<CompanionText | null>(null);
  const [translationMeta, setTranslationMeta] = useState<{ primary: TranslationMeta | null; companion: TranslationMeta | null }>({ primary: null, companion: null });
  // Chapters the reader has marked as read (key → ISO date), so XP is earned once
  const [completedChapters, setCompletedChapters] = useState<Record<string, string>>(() => safeRead(STORAGE_KEYS.completed, {}));
  const [showStudyLibrary, setShowStudyLibrary] = useState(false);
  const [focusVerses, setFocusVerses] = useState<number[] | null>(null);
  const focusVerseRef = useRef<number[] | null>(null);
  focusVerseRef.current = focusVerses;
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const chapterLoads = useRef(0);
  // "Share these verses with my circle" — a small dialog over the text, never a page change
  const [shareSelection, setShareSelection] = useState<VerseSelection | null>(null);
  const [shareDraft, setShareDraft] = useState('');
  const [railDraft, setRailDraft] = useState('');
  // The rail composer attaches the current selection unless the reader detaches it (×)
  const [railAttach, setRailAttach] = useState(true);
  // "For the circle": when on, changing chapter moves the circle's chapter too
  const [followCircle, setFollowCircle] = useState(false);
  // What the reader has selected right now (one verse or "4:1-10"), mirrored so circle notes can point at it
  const [readerSelection, setReaderSelection] = useState<VerseSelection | null>(null);
  // Where the current chapter's text came from (borrowed / AI-reconstructed verses) and
  // how much scripture is stored permanently on this device
  const [chapterProvenance, setChapterProvenance] = useState<ChapterProvenance | null>(null);
  const [storeStats, setStoreStats] = useState<ScriptureStoreStats | null>(null);
  const [artStyle, setArtStyle] = useState<ArtStyle>(ArtStyle.COMIC_MODERN);
  const [language, setLanguage] = useState("English");
  
  // Content State
  const [comicTitle, setComicTitle] = useState('');
  const [comicSummary, setComicSummary] = useState('');
  const [panels, setPanels] = useState<ComicPanelData[]>([]);
  const [characters, setCharacters] = useState<CharacterProfile[]>([]);
  const [lifeApplication, setLifeApplication] = useState('');
  
  // App Logic State
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Features State
  const [stats, setStats] = useState<UserStats>(DEFAULT_STATS);
  const [showNotes, setShowNotes] = useState(false);
  // Everything that is persisted is read once, up front. Reading it in an effect
  // raced the write-back effects (in StrictMode the write of an empty value won)
  // and silently emptied notes, circles and journeys on every reload.
  const [notes, setNotes] = useState<{[key: string]: string}>(() => safeRead<Record<string, string>>(STORAGE_KEYS.notes, {}));
  const [currentNote, setCurrentNote] = useState('');
  
  // Modals & Overlays
  const [quizData, setQuizData] = useState<QuizResponse | null>(null);
  const [quizPick, setQuizPick] = useState<QuizPick | null>(null);
  const [showQuiz, setShowQuiz] = useState(false);
  const [chapterContext, setChapterContext] = useState<ContextResult | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  // Read = flowing text like a printed Bible; Study = verse by verse with notes,
  // comparisons and the neutral context; Comic = the illustrated version.
  const [readerMode, setReaderMode] = useState<'read' | 'study' | 'comic'>(() =>
    safeRead<'read' | 'study' | 'comic'>('scriptureComix_readerMode', 'read')
  );
  const [chapterCount, setChapterCount] = useState<number>(1);
  // The order of books in the current canon, so "next" can cross into the next book or surah
  const [bookOrder, setBookOrder] = useState<{ slug: string; displayName: string; chapters: number }[]>([]);
  useEffect(() => {
    let cancelled = false;
    loadManifest(tradition)
      .then(m => { if (!cancelled) setBookOrder(m.books.map(b => ({ slug: b.slug, displayName: b.displayName, chapters: tradition === 'quran' ? 1 : b.chapters.length }))); })
      .catch(() => { if (!cancelled) setBookOrder([]); });
    return () => { cancelled = true; };
  }, [tradition]);
  // Journeys, study circle and heroes live in a slide-over, not in the reading flow
  const [communityDrawer, setCommunityDrawer] = useState<'circle' | 'journeys' | 'forge' | null>(null);
  const [showCommunityMenu, setShowCommunityMenu] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { user: authUser, configured: authConfigured, loading: authLoading } = useAuth();

  // --- SIGN-IN GATE ---------------------------------------------------------
  // Reading is always open. Study, Comic, quizzes, AI generation, the cast and
  // circles need a (free) account, but only once sign-in is actually possible
  // on this build: with Firebase unconfigured (local dev) nothing is locked.
  const gated = authConfigured && !authLoading && !authUser;
  const [authReason, setAuthReason] = useState<AuthReason | null>(null);
  const afterSignIn = useRef<(() => void) | null>(null);
  /** True when the reader may proceed. Otherwise opens the sign-in dialog and remembers `action` to run once they are in. */
  const requireSignIn = (reason: AuthReason, action?: () => void): boolean => {
    if (!gated) return true;
    afterSignIn.current = action ?? null;
    setAuthReason(reason);
    setShowProfileMenu(false);
    setShowAuthModal(true);
    return false;
  };
  useEffect(() => {
    if (!authUser) return;
    const run = afterSignIn.current;
    afterSignIn.current = null;
    setAuthReason(null);
    if (run) run();
  }, [authUser]);
  const openCast = () => { if (requireSignIn(UNLOCK.cast, () => setCommunityDrawer('forge'))) setCommunityDrawer('forge'); };
  // A device that last used Study or Comic while signed in falls back to Read when signed out.
  useEffect(() => {
    if (gated && readerMode !== 'read') { setReaderMode('read'); safeWrite('scriptureComix_readerMode', 'read'); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gated]);
  // Cloud sync only starts once this device's data has been merged with the account's.
  const [cloudReadyFor, setCloudReadyFor] = useState<string | null>(null);
  // Illustrated edition: one picture per scene, generated once and shipped
  const [sceneResult, setSceneResult] = useState<SceneResult | null>(null);
  const [scenesLoading, setScenesLoading] = useState(false);
  const [illustrating, setIllustrating] = useState(false);
  const sceneRunKey = useRef('');

  /**
   * Load (and, when allowed or forced by the reader, draw) the scenes of a
   * chapter. Only the latest run for a chapter may touch state, and the final
   * state is re-read from the store so nothing drawn is ever lost.
   */
  const runScenesFor = async (
    r: { verses: ChapterVerse[]; translationId?: string; bookSlug?: string; bookName: string; chapter: number },
    force: boolean
  ) => {
    if (!r.verses.length) return;
    const req = {
      tradition,
      translationId: r.translationId || selectedTranslation || 'default',
      bookSlug: r.bookSlug || selectedBookSlug || selectedBook,
      bookName: r.bookName,
      chapter: r.chapter,
      verses: r.verses,
      isQuran: tradition === 'quran',
      style: artStyle,
    };
    const key = `${req.tradition}/${req.translationId}/${req.bookSlug}/${req.chapter}/${artStyle}/${force ? 'force' : 'auto'}`;
    sceneRunKey.current = key;
    const alive = () => sceneRunKey.current === key;
    const allowAI = force ? true : undefined;
    setScenesLoading(true);
    try {
      let res = await getScenes({ ...req, allowAI });
      if (!alive()) return;
      setSceneResult(res);
      setScenesLoading(false);
      if (res.status === 'ready' && res.missingImages > 0 && (force || runtimeAIEnabled())) {
        setIllustrating(true);
        await ensureSceneImages({ ...req, allowAI }, (scene, idx) => {
          if (!alive()) return;
          setSceneResult(prev => prev ? { ...prev, scenes: prev.scenes.map((s, i) => (i === idx ? scene : s)), missingImages: Math.max(0, prev.missingImages - 1) } : prev);
        });
        if (!alive()) return;
        res = await getScenes({ ...req, allowAI: false });
        if (alive()) setSceneResult(res);
      }
    } catch (err) {
      console.warn('Scenes failed', err);
      if (alive()) setSceneResult({ scenes: [], planSource: null, status: 'unavailable', missingImages: 0 });
    } finally {
      if (alive()) {
        setScenesLoading(false);
        setIllustrating(false);
      }
    }
  };

  /** Reader-triggered: draw this chapter now, even in production. */
  const illustrateCurrentChapter = () => {
    if (!chapterText || !chapterText.length) return;
    runScenesFor(
      { verses: chapterText, translationId: chapterTextSource?.versions?.[0], bookSlug: selectedBookSlug || undefined, bookName: selectedBook, chapter: tradition === 'quran' ? 1 : selectedChapter },
      true
    );
  };
  const switchMode = (m: 'read' | 'study' | 'comic', scrollTop: boolean = true) => {
    if (m !== 'read' && !requireSignIn(UNLOCK[m], () => switchMode(m, scrollTop))) return;
    setReaderMode(m);
    safeWrite('scriptureComix_readerMode', m);
    if (scrollTop) window.scrollTo({ top: 0, behavior: 'auto' });
  };
  const [showMembershipModal, setShowMembershipModal] = useState(false);
  const [showMissionModal, setShowMissionModal] = useState(false);
  const [showFounderModal, setShowFounderModal] = useState(false);
  const [showCharacterLibrary, setShowCharacterLibrary] = useState(false);
  const [showOfflineManager, setShowOfflineManager] = useState(false);
  
  // Context Booster State
  const [explanation, setExplanation] = useState<{
    targetText: string;
    result: string;
    loading: boolean;
    activeType: string;
  } | null>(null);

  // Story Mode State
  const [storyModeIndex, setStoryModeIndex] = useState<number | null>(null); // null = off
  const [isStoryPlaying, setIsStoryPlaying] = useState(false);
  const storyAudioRef = useRef<HTMLAudioElement | null>(null);
  const [showCharacters, setShowCharacters] = useState(false);
  
  // Journeys & Collaboration
  const [journeyProgress, setJourneyProgress] = useState<Record<string, JourneyProgress>>(() => safeRead<Record<string, JourneyProgress>>(STORAGE_KEYS.journeys, {}));
  const [activeJourneyId, setActiveJourneyId] = useState<string | null>(() => { try { return localStorage.getItem(STORAGE_KEYS.activeJourney); } catch { return null; } });
  const [pendingJourneyAction, setPendingJourneyAction] = useState<{ journeyId: string; chapterIndex: number } | null>(null);
  const [studyGroups, setStudyGroups] = useState<StudyGroup[]>(() => safeRead<StudyGroup[]>(STORAGE_KEYS.groups, []));
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(() => safeRead<StudyGroup[]>(STORAGE_KEYS.groups, [])[0]?.id ?? null);
  const [pendingGroupSync, setPendingGroupSync] = useState<{ groupId: string } | null>(null);
  // Signed-in readers: circles live in Firestore and sync between members and devices.
  const [cloudGroups, setCloudGroups] = useState<StudyGroup[]>([]);
  const [cloudReflections, setCloudReflections] = useState<ReflectionEntry[]>([]);
  const [pendingInvite, setPendingInvite] = useState<string | null>(null);
  const [profile, setProfile] = useState<ReaderProfile>(() => {
    const saved = safeRead<Partial<ReaderProfile> | null>(STORAGE_KEYS.profile, null);
    return {
      displayName: saved?.displayName || 'Pilgrim',
      faithTradition: saved?.faithTradition || 'Curious',
      exploreLevel: saved?.exploreLevel || 'Medium',
    };
  });

  // Custom Heroes
  const [customHeroes, setCustomHeroes] = useState<CustomHero[]>(() => safeRead<CustomHero[]>(STORAGE_KEYS.heroes, []));
  const [activeHeroIds, setActiveHeroIds] = useState<string[]>(() => safeRead<string[]>(STORAGE_KEYS.activeHeroes, []));

  // Offline Packs
  const [offlinePacks, setOfflinePacks] = useState<OfflinePack[]>(() => safeRead<OfflinePack[]>(STORAGE_KEYS.offline, []));

  // Native Text Library
  const [chapterText, setChapterText] = useState<ChapterVerse[] | null>(null);
  const [chapterTextSource, setChapterTextSource] = useState<TextCatalogEntry | null>(null);
  const [isChapterTextLoading, setIsChapterTextLoading] = useState(false);
  const [chapterTextError, setChapterTextError] = useState<string | null>(null);

  // UI Overlays
  const [localVersionSet, setLocalVersionSet] = useState<Set<BibleVersion>>(new Set());
  
  // Scripture Discovery & Selection
  const [scriptureEntries, setScriptureEntries] = useState<ScriptureEntry[]>([]);
  const [selectedScripture, setSelectedScripture] = useState<ScriptureEntry | null>(null);
  const [scriptureData, setScriptureData] = useState<any>(null);

  // --- INIT & PERSISTENCE ---
  useEffect(() => {
    const savedStats = safeRead<UserStats | null>(STORAGE_KEYS.stats, null);
    if (savedStats) {
      if (!savedStats.tier) savedStats.tier = UserTier.FREE;
      if (typeof savedStats.dailyAiUsage === 'undefined') savedStats.dailyAiUsage = 0;
      setStats(savedStats);
    }
    const savedProfile = safeRead<Partial<ReaderProfile> | null>(STORAGE_KEYS.profile, null);

    // Date Logic for Streak and AI Usage Reset
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    setStats(prev => {
      let newStreak = prev.streak;
      const last = prev.lastVisit ? new Date(prev.lastVisit).toISOString().split('T')[0] : null;
      
      // Update Streak
      if (last !== today && last && new Date(now.getTime() - 86400000).toISOString().split('T')[0] === last) {
        newStreak++;
      } else if (last !== today) {
        newStreak = 1;
      }

      // Reset Daily AI Usage
      const lastAi = prev.lastAiUsageDate ? new Date(prev.lastAiUsageDate).toISOString().split('T')[0] : null;
      const newUsage = lastAi !== today ? 0 : prev.dailyAiUsage;

      const updated = { 
        ...prev, 
        streak: newStreak, 
        lastVisit: now.toISOString(),
        dailyAiUsage: newUsage,
        lastAiUsageDate: now.toISOString()
      };
      
      safeWrite(STORAGE_KEYS.stats, updated);
      return updated;
    });

    // Marks made before they were owned by the verse are folded into the new shape once
    migrateMarkStores();

    // A circle invite in the URL (?circle=…) joins it and opens the circle once we know who the reader is
    const invite = takeInviteFromUrl();
    if (invite) setPendingInvite(invite);
  }, []);

  useEffect(() => {
    if (!pendingInvite || authLoading) return;
    const invite = pendingInvite;
    setPendingInvite(null);
    joinFromInvite(invite).then(ok => {
      if (ok) setCommunityDrawer('circle');
      else toast({ title: 'That invite could not be read', description: 'Ask the person who sent it for a fresh link.', tone: 'error' });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingInvite, authLoading]);

  // --- CLOUD CIRCLES ---
  const circleActor: CircleActor | null = authUser
    ? { uid: authUser.uid, alias: profile.displayName.trim() || authUser.displayName || 'Member' }
    : null;

  useEffect(() => {
    if (!authUser) { setCloudGroups([]); return; }
    return circleStore.subscribeMyCircles(authUser.uid, setCloudGroups);
  }, [authUser]);

  const selectedCloudGroup = authUser ? cloudGroups.find(g => g.id === selectedGroupId) ?? null : null;
  const selectedCloudSessionId = selectedCloudGroup?.currentSessionId ?? null;
  useEffect(() => {
    if (!selectedCloudGroup || !selectedCloudSessionId) { setCloudReflections([]); return; }
    return circleStore.subscribeReflections(selectedCloudGroup.id, selectedCloudSessionId, setCloudReflections);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser, selectedGroupId, selectedCloudSessionId]);

  // When the cloud list arrives, make sure something sensible is selected.
  useEffect(() => {
    if (!authUser || cloudGroups.length === 0) return;
    if (!cloudGroups.some(g => g.id === selectedGroupId)) setSelectedGroupId(cloudGroups[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser, cloudGroups]);

  /** The circles the reader sees: cloud when signed in, this device otherwise. */
  const groups: StudyGroup[] = useMemo(() => {
    if (!authUser) return studyGroups;
    return cloudGroups.map(g => (g.id === selectedGroupId ? { ...g, reflections: cloudReflections } : g));
  }, [authUser, studyGroups, cloudGroups, selectedGroupId, cloudReflections]);

  const circleFail = (title: string) => (err: unknown) => {
    console.warn('[circles]', title, err);
    toast({ title, description: err instanceof Error ? err.message : 'Check your connection and try again.', tone: 'error' });
  };

  // Back to the top whenever the passage changes — a new chapter starts at verse 1
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [selectedBook, selectedChapter, tradition]);

  useEffect(() => {
    safeWrite(STORAGE_KEYS.completed, completedChapters);
  }, [completedChapters]);

  useEffect(() => {
    safeWrite(STORAGE_KEYS.notes, notes);
  }, [notes]);

  useEffect(() => {
    safeWrite(STORAGE_KEYS.journeys, journeyProgress);
  }, [journeyProgress]);

  useEffect(() => {
    if (activeJourneyId) {
      safeWrite(STORAGE_KEYS.activeJourney, activeJourneyId);
    } else {
      localStorage.removeItem(STORAGE_KEYS.activeJourney);
    }
  }, [activeJourneyId]);

  useEffect(() => {
    safeWrite(STORAGE_KEYS.groups, studyGroups);
  }, [studyGroups]);

  useEffect(() => {
    safeWrite(STORAGE_KEYS.heroes, customHeroes);
  }, [customHeroes]);

  useEffect(() => {
    safeWrite(STORAGE_KEYS.activeHeroes, activeHeroIds);
  }, [activeHeroIds]);

  useEffect(() => {
    safeWrite(STORAGE_KEYS.offline, offlinePacks);
  }, [offlinePacks]);

  useEffect(() => {
    if (profile.displayName.trim()) {
      safeWrite(STORAGE_KEYS.profile, profile);
    } else {
      localStorage.removeItem(STORAGE_KEYS.profile);
    }
  }, [profile]);

  // --- FIREBASE SYNC ---
  // On sign-in: register the account doc, then fold cloud data into this device's.
  useEffect(() => {
    if (!authUser) { setCloudReadyFor(null); return; }
    let cancelled = false;
    (async () => {
      try {
        await ensureUserDocument(authUser);
        const cloud = await loadUserData(authUser.uid);
        if (cancelled) return;
        setStats(prev => {
          const merged = mergeStats(prev, cloud.stats);
          safeWrite(STORAGE_KEYS.stats, merged);
          return merged;
        });
        setProfile(prev => {
          const cloudName = cloud.profile?.displayName?.trim();
          const localNamed = prev.displayName.trim() && prev.displayName.trim() !== 'Pilgrim';
          return {
            displayName: localNamed ? prev.displayName : (cloudName || authUser.displayName || prev.displayName),
            faithTradition: cloud.profile?.faithTradition || prev.faithTradition,
            exploreLevel: cloud.profile?.exploreLevel || prev.exploreLevel,
          };
        });
        setCloudReadyFor(authUser.uid);
      } catch (err) {
        console.warn('[firebase] could not load account data', err);
        if (!cancelled) setCloudReadyFor(authUser.uid);
      }
    })();
    return () => { cancelled = true; };
  }, [authUser]);

  // After the merge, mirror stats and profile to Firestore (debounced).
  useEffect(() => {
    if (!authUser || cloudReadyFor !== authUser.uid) return;
    const t = setTimeout(() => {
      saveUserStats(authUser.uid, stats).catch(err => console.warn('[firebase] stats sync failed', err));
    }, 1500);
    return () => clearTimeout(t);
  }, [authUser, cloudReadyFor, stats]);

  useEffect(() => {
    if (!authUser || cloudReadyFor !== authUser.uid) return;
    const t = setTimeout(() => {
      saveUserProfile(authUser.uid, profile).catch(err => console.warn('[firebase] profile sync failed', err));
    }, 1500);
    return () => clearTimeout(t);
  }, [authUser, cloudReadyFor, profile]);

  const handleSignOut = async () => {
    setShowProfileMenu(false);
    try {
      await signOutUser();
      toast({ title: 'Signed out', description: 'Your reading stays on this device. Sign in again to sync.' });
    } catch (err) {
      console.warn('[firebase] sign-out failed', err);
      toast({ title: 'Could not sign out', description: 'Check your connection and try again.' });
    }
  };

  useEffect(() => {
    let cancelled = false;
    loadTextCatalog()
      .then(entries => {
        if (cancelled) return;
        const available = new Set<BibleVersion>();
        entries.forEach(entry => {
          if (entry.status === 'local' && entry.versions) {
            entry.versions.forEach(v => {
              if ((Object.values(BibleVersion) as string[]).includes(v)) {
                available.add(v as BibleVersion);
              }
            });
          }
        });
        if (available.size === 0) {
          available.add(BibleVersion.KJV);
        }
        setLocalVersionSet(available);
      })
      .catch(() => {
        if (cancelled) return;
        setLocalVersionSet(new Set([BibleVersion.KJV]));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Discover all available scripture sources (Bible, Quran, Deuterocanonical)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const entries = await discoverScriptures();
        if (cancelled) return;
        setScriptureEntries(entries);
      } catch (err) {
        console.warn('Failed to discover scriptures:', err);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    // If the current selection is a discovered SCRIPTURE entry (stored as a
    // 'SCRIPTURE::id' string in `version`), don't force a fallback to a builtin
    // version when the localVersionSet changes. Only enforce fallback for
    // builtin BibleVersion values.
    try {
      const verStr = (version as unknown as string) || '';
      if (typeof verStr === 'string' && verStr.startsWith('SCRIPTURE::')) {
        return;
      }
    } catch {
      // ignore and continue to fallback enforcement
    }

    if (localVersionSet.size > 0 && !localVersionSet.has(version)) {
      const fallback = findFallbackVersion(localVersionSet);
      if (version !== fallback) {
        setVersion(fallback);
      }
    }
  }, [localVersionSet, version]);

  useEffect(() => {
    const key = `${selectedBook} ${selectedChapter}`;
    setCurrentNote(notes[key] || '');
  }, [selectedBook, selectedChapter, notes]);

  useEffect(() => {
    let cancelled = false;
    setIsChapterTextLoading(true);
    setChapterTextError(null);

    // If a scripture is selected, prefer loading from it
    if (selectedScripture && scriptureData) {
      // For Quran datasets, the 'book' selection will be the surah number.
      let queryBook = selectedBook;
      let queryChapter = selectedChapter;
      if (selectedScripture.group === 'Quran') {
        const num = Number(selectedBook);
        if (!Number.isNaN(num) && num > 0) {
          queryChapter = num;
          queryBook = String(num);
        }
      }
      const verses = extractVersesFromScripture(scriptureData, queryBook, queryChapter);
      if (cancelled) return;
      if (verses) {
        setChapterText(verses);
        setChapterTextSource({
          id: selectedScripture.id,
          displayName: selectedScripture.displayName,
          language: 'Unknown',
          license: 'Bundled',
          status: 'local',
        } as TextCatalogEntry);
        setChapterTextError(null);
      } else {
        setChapterText(null);
        setChapterTextSource(null);
        setChapterTextError(`Chapter not found in ${selectedScripture.displayName}`);
      }
      setIsChapterTextLoading(false);
      return () => { cancelled = true; };
    }

    // Otherwise, load through the permanent scripture store. Books are fetched
    // once per device; missing verses are borrowed or reconstructed and kept.
    const bookRef = selectedBookSlug || selectedBook;
    // Reading is never slowed by generation: stored text shows at once and any
    // gap repair runs behind it, swapping the completed chapter in when done.
    loadChapter(tradition, selectedTranslation, bookRef, selectedChapter, { repair: 'background' })
      .then(result => {
        if (cancelled) return;
        if (result) {
          const loadContextFor = (r: typeof result) => {
            if (!r.verses.length) return;
            runScenesFor({ verses: r.verses, translationId: r.translationId, bookSlug: r.bookSlug || bookRef, bookName: r.bookDisplayName || selectedBook, chapter: r.chapter || selectedChapter }, false);
            setContextLoading(true);
            getChapterContext({
              tradition,
              translationId: r.translationId || selectedTranslation || 'default',
              bookSlug: r.bookSlug || bookRef,
              bookName: r.bookDisplayName || selectedBook,
              chapter: r.chapter || selectedChapter,
              verses: r.verses,
              isQuran: tradition === 'quran',
            })
              .then(ctx => { if (!cancelled) setChapterContext(ctx); })
              .catch(() => { if (!cancelled) setChapterContext({ context: null, source: null, status: 'unavailable' }); })
              .finally(() => { if (!cancelled) setContextLoading(false); });
          };

          setChapterText(result.verses);
          setChapterTextSource(result.entry);
          setChapterProvenance(result.provenance ?? null);
          setChapterTextError(result.verses.length ? null : 'Preparing this chapter for the first time…');
          // The text just changed under the reader: start them at verse 1 (unless a verse jump is pending)
          if (!focusVerseRef.current?.length) requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'auto' }));
          if (result.verses.length) {
            const lr = {
              tradition,
              bookSlug: result.bookSlug || bookRef,
              bookName: result.bookDisplayName || selectedBook,
              chapter: result.chapter || selectedChapter,
              translationId: result.translationId || selectedTranslation,
            };
            persistLastRead(lr);
            setLastReadState({ ...lr, at: new Date().toISOString() });
            // Ask for support only after the reader has actually read a few chapters
            chapterLoads.current += 1;
            if (chapterLoads.current === 3 && !safeRead<string | null>('scriptureComix_hasSeenUrgentDonation', null)) {
              const s = safeRead<any>(STORAGE_KEYS.stats, {});
              if (!s.tier || s.tier === UserTier.FREE) {
                openSupport();
                safeWrite('scriptureComix_hasSeenUrgentDonation', 'true');
              }
            }
          }
          // A new chapter means a new quiz bank entry and a new study context
          setQuizData(null);
          setQuizPick(null);
          setShowQuiz(false);
          setChapterContext(null);
          setSceneResult(null);
          loadContextFor(result);

          if (result.pending) {
            result.pending.then(repaired => {
              if (cancelled || !repaired) return;
              setChapterText(repaired.verses);
              setChapterProvenance(repaired.provenance ?? null);
              setChapterTextError(null);
              if (!result.verses.length) loadContextFor(repaired);
              getStoreStats().then(s => { if (!cancelled) setStoreStats(s); }).catch(() => {});
            });
          }
          if (result.bookSlug && result.bookSlug !== selectedBookSlug) setSelectedBookSlug(result.bookSlug);
          if (result.bookDisplayName && result.bookDisplayName !== selectedBook) setSelectedBook(result.bookDisplayName);
          loadManifest(tradition)
            .then(m => { const b = m.books.find(x => x.slug === result.bookSlug); if (!cancelled && b) setChapterCount(tradition === 'quran' ? 1 : b.chapters.length); })
            .catch(() => {});
          // Warm the neighbouring books while the reader is busy with this one
          const idle = (window as any).requestIdleCallback || ((fn: () => void) => setTimeout(fn, 800));
          idle(() => prefetchNeighbours(tradition, result.translationId || '', result.bookSlug || ''));
        } else {
          setChapterText(null);
          setChapterTextSource(null);
          setChapterProvenance(null);
          setChapterTextError(`${bookRef} ${selectedChapter} is not in this canon. Pick a book above.`);
        }
        getStoreStats().then(s => { if (!cancelled) setStoreStats(s); }).catch(() => {});
      })
      .catch(err => {
        console.warn('Chapter text load failed', err);
        if (cancelled) return;
        setChapterText(null);
        setChapterTextSource(null);
        setChapterProvenance(null);
        setChapterTextError('Unable to load scripture text.');
      })
      .finally(() => {
        if (!cancelled) setIsChapterTextLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedBook, selectedBookSlug, selectedChapter, tradition, selectedTranslation, selectedScripture, scriptureData]);

  // --- ENTITLEMENTS -----------------------------------------------------------
  // What the reader has paid for. Written only by the Yoco webhook (Admin SDK);
  // the browser listens. The tier is derived from it, never from a button.
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  useEffect(() => {
    if (!authUser) { setEntitlement(null); return; }
    return subscribeEntitlement(authUser.uid, setEntitlement);
  }, [authUser]);
  const supporter = Boolean(authUser) && isSupporter(entitlement);
  useEffect(() => {
    if (authLoading) return;
    const tier = supporter ? UserTier.SCHOLAR : UserTier.FREE;
    setStats(prev => {
      if (prev.tier === tier) return prev;
      const next = { ...prev, tier };
      safeWrite(STORAGE_KEYS.stats, next);
      return next;
    });
  }, [authLoading, supporter]);

  const [supportGift, setSupportGift] = useState<number | null>(null);
  /** Opens the support dialog, optionally on the gift card with an amount (cents) preselected. */
  const openSupport = (giftCents?: number) => { setSupportGift(giftCents ?? null); setShowMembershipModal(true); };

  // The chapter on screen, as a sponsorship target, and who has sponsored it.
  const chapterRef: ChapterRef | null = selectedBookSlug
    ? { tradition, bookSlug: selectedBookSlug, bookName: selectedBook, chapter: tradition === 'quran' ? 1 : selectedChapter }
    : null;
  const [sponsorship, setSponsorship] = useState<Sponsorship | null>(null);
  useEffect(() => {
    if (!chapterRef) { setSponsorship(null); return; }
    return subscribeSponsorship(sponsorshipKey(chapterRef), setSponsorship);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tradition, selectedBookSlug, selectedChapter]);

  // Back from Yoco with ?pay=ok|cancel|fail&ref=… The webhook settles the
  // purchase; this only reports. The entitlement listener updates the UI.
  useEffect(() => {
    const ret = readPaymentReturn();
    if (!ret) return;
    if (ret.outcome === 'cancel') { toast({ title: 'No charge was made', description: 'You can come back to this any time.' }); return; }
    if (ret.outcome === 'fail') { toast({ title: 'The payment did not go through', description: 'Your card was not charged. Try again or use another card.' }); return; }
    let cancelled = false;
    toast({ title: 'Thank you', description: 'Confirming your payment with Yoco…' });
    waitForSettlement(ret.reference).then(st => {
      if (cancelled) return;
      if (st.status === 'paid') {
        toast({ title: 'Payment confirmed', description: st.sku === 'sponsor-chapter' ? 'Your name is on the chapter. Thank you for keeping this free.' : 'Thank you for keeping ScriptureComix free for everyone.' });
      } else if (st.status === 'failed') {
        toast({ title: 'Payment not confirmed', description: `Yoco reported a problem. If you were charged, write to us with reference ${ret.reference}.` });
      } else {
        toast({ title: 'Still confirming', description: 'Your payment is being confirmed and will show in your profile shortly.' });
      }
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkFeatureLock = (feature: 'art' | 'book' | 'version' | 'ai' | 'download' | 'language', value?: any): boolean => {
    // Reading is free: every book, translation and language, for everyone.
    if (feature === 'book' || feature === 'version' || feature === 'language') return true;

    // The generated extras are what a Supporter pays for.
    if (feature === 'art') {
      if (supporter || FREE_STYLES.includes(value)) return true;
      openSupport();
      return false;
    }
    if (feature === 'download') {
      if (supporter) return true;
      openSupport();
      return false;
    }

    // AI usage: a daily allowance per tier (generation itself is off in production builds).
    if (feature === 'ai') {
      const limit = TIER_LIMITS[stats.tier]?.ai || 20;
      if (stats.dailyAiUsage < limit) {
        const newStats = {
          ...stats,
          dailyAiUsage: stats.dailyAiUsage + 1,
          lastAiUsageDate: new Date().toISOString(),
        };
        setStats(newStats);
        safeWrite(STORAGE_KEYS.stats, newStats);
        return true;
      }
      openSupport();
      return false;
    }

    return true;
  };

  const awardXp = (amount: number) => {
    if (!amount) return;
    setStats(prev => {
      const updated = { ...prev, xp: prev.xp + amount };
      safeWrite(STORAGE_KEYS.stats, updated);
      return updated;
    });
  };

  const handleJourneyStart = (journeyId: string) => {
    const now = new Date().toISOString();
    setJourneyProgress(prev => ({
      ...prev,
      [journeyId]: { journeyId, currentIndex: 0, completed: [], startedAt: now, lastUpdated: now }
    }));
    setActiveJourneyId(journeyId);
  };

  const handleJourneyStartAndLaunch = (journeyId: string) => {
    handleJourneyStart(journeyId);
    triggerJourneyChapter(journeyId, 0);
  };

  const triggerJourneyChapter = (journeyId: string, chapterIndex: number) => {
    const journey = GUIDED_JOURNEYS.find(j => j.id === journeyId);
    if (!journey) return;
    const chapter = journey.chapters[chapterIndex];
    if (!chapter) return;
    setActiveJourneyId(journeyId);
    setPendingJourneyAction({ journeyId, chapterIndex });
    // Journeys are in the Protestant canon; open the chapter to read, not to generate a comic
    if (tradition !== 'protestant') { setTradition('protestant'); setSelectedTranslation(DEFAULT_TRANSLATION.protestant); }
    setSelectedBookSlug(null);
    setSelectedBook(chapter.book);
    setSelectedChapter(chapter.chapter);
    switchMode('read');
  };

  const handleJourneyResume = (journeyId: string) => {
    const journey = GUIDED_JOURNEYS.find(j => j.id === journeyId);
    const progress = journeyProgress[journeyId];
    if (!journey || !progress) {
      handleJourneyStart(journeyId);
      triggerJourneyChapter(journeyId, 0);
      return;
    }
    const nextIndex = journey.chapters.findIndex((_, idx) => !progress.completed.includes(idx));
    triggerJourneyChapter(journeyId, nextIndex === -1 ? 0 : nextIndex);
  };

  const handleJourneyReset = (journeyId: string) => {
    setJourneyProgress(prev => {
      const clone = { ...prev };
      delete clone[journeyId];
      return clone;
    });
    if (activeJourneyId === journeyId) setActiveJourneyId(null);
  };

  const completeJourneyChapter = (journeyId: string, chapterIndex: number) => {
    const journey = GUIDED_JOURNEYS.find(j => j.id === journeyId);
    if (!journey) return;
    setJourneyProgress(prev => {
      const existing = prev[journeyId];
      const completedSet = new Set<number>(existing?.completed || []);
      completedSet.add(chapterIndex);
      const updated: JourneyProgress = {
        journeyId,
        currentIndex: chapterIndex,
        completed: Array.from(completedSet).sort((a, b) => a - b),
        startedAt: existing?.startedAt || new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      };
      const merged = { ...prev, [journeyId]: updated };
      const finished = updated.completed.length === journey.chapters.length;
      if (finished) {
        setTimeout(() => toast({ title: `You finished ${journey.title}`, description: `You earned the ${journey.badge} badge.`, duration: 7000 }), 0);
      }
      return merged;
    });
    const reward = journey.chapters[chapterIndex]?.xpReward || 0;
    awardXp(reward);
  };

  /** The key under which "I read this" is remembered for the open chapter. */
  const currentChapterKey = `${tradition}/${selectedBookSlug || selectedBook}/${tradition === 'quran' ? 1 : selectedChapter}`;
  const currentChapterDone = !!completedChapters[currentChapterKey];

  /** Reader says "I have read this chapter": counts once, pays journey and circle steps. */
  const markChapterRead = () => {
    if (currentChapterDone) return;
    setCompletedChapters(prev => ({ ...prev, [currentChapterKey]: new Date().toISOString() }));
    setStats(prev => {
      const updated = { ...prev, xp: prev.xp + 50, chaptersRead: prev.chaptersRead + 1 };
      safeWrite(STORAGE_KEYS.stats, updated);
      return updated;
    });
    let msg = `${selectedBook}${tradition === 'quran' ? '' : ` ${selectedChapter}`} marked as read · +50 XP`;
    if (pendingJourneyAction) {
      const j = GUIDED_JOURNEYS.find(x => x.id === pendingJourneyAction.journeyId);
      const ch = j?.chapters[pendingJourneyAction.chapterIndex];
      if (ch && ch.book === selectedBook && ch.chapter === selectedChapter) {
        completeJourneyChapter(pendingJourneyAction.journeyId, pendingJourneyAction.chapterIndex);
        setPendingJourneyAction(null);
        msg = `Step done on ${j!.title} · +${50 + (ch.xpReward || 0)} XP`;
      }
    }
    if (pendingGroupSync) {
      acknowledgeGroupSync(pendingGroupSync.groupId);
      setPendingGroupSync(null);
    }
    toast({ title: msg });
  };

  /**
   * Open a passage from anywhere (study library, circle, journey). When the
   * target does not say which canon it belongs to, find the first one that
   * has the book — starting with the one the reader is in.
   */
  const openPassage = async (t: OpenTarget) => {
    let targetTradition = (t.tradition as Tradition | undefined) ?? null;
    // Keep the slug stable when we already know it: flipping it to null would reload
    // the same chapter under a new key and wipe the reader's selection.
    let slug = t.bookSlug
      ?? ((!targetTradition || targetTradition === tradition) ? bookOrder.find(b => b.displayName === t.bookName || b.slug === t.bookName)?.slug ?? null : null);
    if (!targetTradition) {
      const order: Tradition[] = [tradition, 'protestant', 'catholic', 'ethiopian', 'quran'];
      for (const tr of order) {
        try {
          const m = await loadManifest(tr);
          const found = resolveBook(m, slug || t.bookName);
          if (found) { targetTradition = tr; slug = found.slug; break; }
        } catch { /* try the next canon */ }
      }
      if (!targetTradition) {
        toast({ title: `Could not find ${t.bookName}`, description: 'It is not in any canon on this device.', tone: 'error' });
        return;
      }
    }
    if (targetTradition !== tradition) {
      setTradition(targetTradition);
      setSelectedTranslation(t.translationId || DEFAULT_TRANSLATION[targetTradition] || null);
    } else if (t.translationId) {
      setSelectedTranslation(t.translationId);
    }
    setSelectedBookSlug(slug);
    setSelectedBook(t.bookName);
    setSelectedChapter(t.chapter);
    if (t.mode) switchMode(t.mode);
    setFocusVerses(t.verses?.length ? t.verses : t.verse != null ? [t.verse] : null);
    setShowStudyLibrary(false);
    setCommunityDrawer(null);
  };

  /** Jump to a passage a circle reflection points at. */
  const openPointer = (p: PassagePointer) => {
    void openPassage({ tradition: p.tradition, bookName: p.book, chapter: p.chapter, verses: p.verses, mode: 'read' });
  };

  const handleExportStudy = () => {
    downloadJson(`scripturecomix-study-${new Date().toISOString().slice(0, 10)}.json`, exportStudy());
    toast({ title: 'Study file saved', description: 'Keep it somewhere safe, or load it on another device.' });
  };

  const handleImportStudy = async (file: File) => {
    try {
      const json = JSON.parse(await file.text());
      const ok = await confirm({
        title: 'Load this study file?',
        description: 'Highlights, notes, bookmarks, circles and progress in the file will replace the ones on this device.',
        confirmLabel: 'Load it',
      });
      if (!ok) return;
      const n = importStudy(json);
      toast({ title: 'Study loaded', description: `${n} parts restored. Reloading…` });
      setTimeout(() => window.location.reload(), 900);
    } catch {
      toast({ title: 'That is not a study file', description: 'Choose a file saved from “My study”.', tone: 'error' });
    }
  };

  const applyChapterResult = (payload: CachedChapter) => {
    setComicTitle(payload.title);
    setComicSummary(payload.summary);
    setLifeApplication(payload.lifeApplication);
    setCharacters(payload.characters || []);
    setPanels(payload.panels.map(panel => ({ ...panel, isLoadingImage: false })));
  };

  const finalizeChapterSession = () => {
    setStats(prev => {
      const updated = { ...prev, xp: prev.xp + 50, chaptersRead: prev.chaptersRead + 1 };
      safeWrite(STORAGE_KEYS.stats, updated);
      return updated;
    });

    if (pendingJourneyAction) {
      completeJourneyChapter(pendingJourneyAction.journeyId, pendingJourneyAction.chapterIndex);
      setPendingJourneyAction(null);
    }

    if (pendingGroupSync) {
      acknowledgeGroupSync(pendingGroupSync.groupId);
      setPendingGroupSync(null);
    }
  };

  const currentCircleFocus = (): CircleFocus => {
    const chapter = tradition === 'quran' ? 1 : selectedChapter;
    const sel = selectionPointer();
    if (sel && sel.book === selectedBook && sel.chapter === chapter) {
      return { tradition, book: selectedBook, chapter, verses: sel.verses, label: sel.label };
    }
    return { tradition, book: selectedBook, chapter, verses: [], label: `${selectedBook}${tradition === 'quran' ? '' : ` ${chapter}`}` };
  };

  const handleCreateGroup = (name: string, focus: string) => {
    if (!requireSignIn(UNLOCK.circle, () => handleCreateGroup(name, focus))) return;
    if (circleActor) {
      circleStore.createCircle(circleActor, name, focus, currentCircleFocus())
        .then(id => { setSelectedGroupId(id); toast({ title: `${name} is ready`, description: 'Copy the invite so others can read along. It syncs for everyone who signs in.' }); })
        .catch(circleFail('Could not create the circle'));
      return;
    }
    const alias = profile.displayName.trim() || 'You';
    const newGroup: StudyGroup = {
      id: `group-${Date.now()}`,
      name,
      focus,
      code: generateCircleCode(),
      members: [alias],
      createdAt: new Date().toISOString(),
      tradition,
      targetBook: selectedBook,
      targetChapter: tradition === 'quran' ? 1 : selectedChapter,
      reflections: [{
        id: `reflection-${Date.now()}`,
        author: 'System',
        text: `${alias} started this circle on ${selectedBook}${tradition === 'quran' ? '' : ` ${selectedChapter}`}.`,
        createdAt: new Date().toISOString()
      }]
    };
    setStudyGroups(prev => [...prev, newGroup]);
    setSelectedGroupId(newGroup.id);
    toast({ title: `${name} is ready`, description: 'Copy the invite so others can read along.' });
  };

  const handleSelectGroup = (groupId: string) => {
    setSelectedGroupId(groupId);
  };

  /** Join from an invite string or link. Resolves false when it cannot be read or found. */
  const joinFromInvite = async (invite: string, aliasOverride?: string): Promise<boolean> => {
    const decoded = decodeInvite(invite);
    if (!decoded) return false;
    if (circleActor) {
      try {
        const { id, group } = await circleStore.joinCircleByCode(circleActor, decoded.code);
        setSelectedGroupId(id);
        if (group.targetBook && group.targetChapter) {
          void openPassage({ tradition: group.tradition, bookName: group.targetBook, chapter: group.targetChapter, mode: 'read' });
        }
        toast({ title: `You joined ${group.name}`, description: group.targetLabel ? `Everyone is reading ${group.targetLabel}.` : undefined });
        return true;
      } catch (err) {
        if (err instanceof circleStore.CircleNotFoundError) return false;
        circleFail('Could not join the circle')(err);
        return false;
      }
    }
    const alias = (aliasOverride ?? profile.displayName).trim() || 'You';
    setStudyGroups(prev => {
      const existing = prev.find(g => g.code === decoded.code);
      if (existing) {
        setSelectedGroupId(existing.id);
        return prev.map(g => g.id === existing.id
          ? { ...g, tradition: decoded.tradition ?? g.tradition, targetBook: decoded.targetBook ?? g.targetBook, targetChapter: decoded.targetChapter ?? g.targetChapter, members: g.members.includes(alias) ? g.members : [...g.members, alias] }
          : g);
      }
      const joined: StudyGroup = {
        id: `group-${decoded.code}`,
        name: decoded.name,
        focus: decoded.focus,
        code: decoded.code,
        members: [alias],
        createdAt: new Date().toISOString(),
        tradition: decoded.tradition,
        targetBook: decoded.targetBook,
        targetChapter: decoded.targetChapter,
        reflections: [{ id: `reflection-${Date.now()}`, author: 'System', text: `${alias} joined from an invite.`, createdAt: new Date().toISOString() }],
      };
      setSelectedGroupId(joined.id);
      return [...prev, joined];
    });
    if (decoded.targetBook && decoded.targetChapter) {
      void openPassage({ tradition: decoded.tradition, bookName: decoded.targetBook, chapter: decoded.targetChapter, mode: 'read' });
    }
    toast({ title: `You joined ${decoded.name}`, description: decoded.targetBook ? `Everyone is reading ${decoded.targetBook} ${decoded.targetChapter}.` : undefined });
    return true;
  };

  const handleJoinGroup = (invite: string) => {
    if (!requireSignIn(UNLOCK.circle, () => { void joinFromInvite(invite); })) return;
    return joinFromInvite(invite);
  };

  const handleInviteGroup = async (groupId: string) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;
    const url = inviteUrl(group);
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: 'Invite link copied', description: 'Send it to anyone. Opening it joins the circle on their device.' });
    } catch {
      toast({ title: 'Copy this invite', description: url, duration: 15000, tone: 'info' });
    }
  };

  const handleSetGroupTarget = (groupId: string, book: string, chapter: number, quiet = false) => {
    const label = `${book}${tradition === 'quran' ? '' : ` ${chapter}`}`;
    if (circleActor) {
      const focus: CircleFocus = book === selectedBook && chapter === (tradition === 'quran' ? 1 : selectedChapter)
        ? currentCircleFocus()
        : { tradition, book, chapter, verses: [], label };
      circleStore.setCircleFocus(circleActor, groupId, focus)
        .then(() => { if (!quiet) toast({ title: `Circle set to ${focus.label}`, description: 'Everyone in the circle sees it now.' }); })
        .catch(circleFail('Could not move the circle'));
      return;
    }
    setStudyGroups(prev => prev.map(group => group.id === groupId
      ? { ...group, tradition, targetBook: book, targetChapter: chapter, reflections: [...group.reflections, { id: `reflection-${Date.now()}`, author: 'System', text: `Now reading ${label}.`, createdAt: new Date().toISOString() }] }
      : group));
    if (!quiet) toast({ title: `Circle set to ${label}`, description: 'Copy a fresh invite so others land here too.' });
  };

  const handleSetGroupTargetToCurrent = (groupId: string) =>
    handleSetGroupTarget(groupId, selectedBook, tradition === 'quran' ? 1 : selectedChapter);

  const handleRenameGroup = (groupId: string, name: string, focus: string) => {
    if (circleActor) {
      circleStore.renameCircle(groupId, name, focus)
        .then(() => toast({ title: `Renamed to ${name}`, description: 'Existing invite links keep working.' }))
        .catch(circleFail('Could not rename the circle'));
      return;
    }
    setStudyGroups(prev => prev.map(group => group.id === groupId ? { ...group, name, focus } : group));
    toast({ title: `Renamed to ${name}`, description: 'Existing invite links keep working.' });
  };

  const handleGoToGroupTarget = (groupId: string) => {
    const group = groups.find(g => g.id === groupId);
    if (!group?.targetBook || !group.targetChapter) return;
    setPendingGroupSync({ groupId });
    void openPassage({ tradition: group.tradition, bookName: group.targetBook, chapter: group.targetChapter, mode: 'read' });
  };

  const handleAddReflection = (groupId: string, text: string, ref?: PassagePointer) => {
    if (circleActor) {
      const group = groups.find(g => g.id === groupId);
      if (!group) return;
      circleStore.addReflection(circleActor, group, text, ref)
        .then(() => awardXp(25))
        .catch(err => {
          if (err instanceof circleStore.SessionLockedError) toast({ title: 'Session ended', description: err.message, tone: 'error' });
          else circleFail('Could not share the reflection')(err);
        });
      return;
    }
    const alias = profile.displayName.trim() || 'You';
    const entry: ReflectionEntry = { id: `reflection-${Date.now()}`, author: alias, text, createdAt: new Date().toISOString(), ...(ref ? { ref } : {}) };
    setStudyGroups(prev => prev.map(group => group.id === groupId ? { ...group, reflections: [...group.reflections, entry] } : group));
    awardXp(25);
  };

  const handleLeaveGroup = async (groupId: string) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;
    const leadingOthers = !!circleActor && group.ownerUid === circleActor.uid && (group.memberUids?.length ?? 0) > 1;
    const ok = await confirm({
      title: `Leave ${group.name}?`,
      description: circleActor
        ? `You drop out of the circle on every device.${leadingOthers ? ' Leadership passes to the next member.' : ''} An invite link brings you back.`
        : 'The circle and your reflections in it are removed from this device. An invite link brings it back.',
      confirmLabel: 'Leave circle',
      tone: 'danger',
    });
    if (!ok) return;
    if (circleActor) {
      circleStore.leaveCircle(circleActor, groupId).catch(circleFail('Could not leave the circle'));
      if (selectedGroupId === groupId) setSelectedGroupId(null);
      return;
    }
    setStudyGroups(prev => prev.filter(g => g.id !== groupId));
    if (selectedGroupId === groupId) setSelectedGroupId(null);
  };

  /** Leader ends the open session: the circle locks for everyone until the next one starts. */
  const handleEndSessionQuick = async (groupId: string) => {
    const group = groups.find(g => g.id === groupId);
    if (!group || !circleActor) return;
    const ok = await confirm({
      title: `End the session for ${group.name}?`,
      description: 'Everyone is locked out of adding reflections until you start the next session. Write the summary from the circle page if you want one; you can add it later under History too.',
      confirmLabel: 'End session for everyone',
      tone: 'danger',
    });
    if (!ok) return;
    circleStore.endSession(circleActor, groupId, { summary: '', takeaways: [] })
      .then(() => toast({ title: 'Session ended', description: 'The circle is locked. Start the next session from the circle page.' }))
      .catch(circleFail('Could not end the session'));
  };

  const acknowledgeGroupSync = (groupId: string) => {
    if (circleActor) { awardXp(60); return; }
    setStudyGroups(prev => prev.map(group => {
      if (group.id !== groupId) return group;
      const systemEntry = {
        id: `reflection-${Date.now()}`,
        author: 'System',
        text: `Synced chapter ${selectedBook} ${selectedChapter}.`,
        createdAt: new Date().toISOString()
      };
      return { ...group, reflections: [...group.reflections, systemEntry] };
    }));
    awardXp(60);
  };

  const handleCreateHero = (heroData: Omit<CustomHero, 'id'>) => {
    const newHero: CustomHero = { ...heroData, id: `hero-${Date.now()}` };
    setCustomHeroes(prev => [...prev, newHero]);
    setActiveHeroIds(prev => {
      if (prev.length >= HERO_LIMIT) {
        setTimeout(() => toast({ title: `${newHero.name} saved`, description: `Only ${HERO_LIMIT} characters can be in the cast at once. Swap one out to use them.`, tone: 'info' }), 0);
        return prev;
      }
      return [...prev, newHero.id];
    });
  };

  const handleToggleHero = (heroId: string) => {
    setActiveHeroIds(prev => {
      if (prev.includes(heroId)) return prev.filter(id => id !== heroId);
      if (prev.length >= HERO_LIMIT) {
        setTimeout(() => toast({ title: `The cast is full`, description: `Up to ${HERO_LIMIT} characters appear in a comic. Take one out first.`, tone: 'warning' }), 0);
        return prev;
      }
      return [...prev, heroId];
    });
  };

  const handleDeleteHero = (heroId: string) => {
    setCustomHeroes(prev => prev.filter(hero => hero.id !== heroId));
    setActiveHeroIds(prev => prev.filter(id => id !== heroId));
  };

  const handleSaveOfflinePack = () => {
    if (stats.tier !== UserTier.SCHOLAR) {
      setShowMembershipModal(true);
      return;
    }
    if (!panels.length) return;
    const hydratedPanels = panels.map(panel => ({ ...panel, isLoadingImage: false }));
    const pack: OfflinePack = {
      id: `pack-${Date.now()}`,
      title: comicTitle || `${selectedBook} ${selectedChapter}`,
      book: selectedBook,
      chapter: selectedChapter,
      createdAt: new Date().toISOString(),
      summary: comicSummary,
      lifeApplication,
      panels: hydratedPanels,
      artStyle,
      language,
      version,
      characters
    };
    setOfflinePacks(prev => [pack, ...prev]);
    setShowOfflineManager(true);
  };

  const handleLoadOfflinePack = (packId: string) => {
    const pack = offlinePacks.find(p => p.id === packId);
    if (!pack) return;
    setSelectedBook(pack.book);
    setSelectedChapter(pack.chapter);
    setComicTitle(pack.title);
    setComicSummary(pack.summary);
    setLifeApplication(pack.lifeApplication);
    setPanels(pack.panels);
    setCharacters(pack.characters || []);
    setVersion(pack.version);
    setLanguage(pack.language);
    setIsGeneratingScript(false);
    setShowOfflineManager(false);
    switchMode('comic');
    toast({ title: `${pack.title} opened from your offline packs` });
  };

  const handleDeleteOfflinePack = async (packId: string) => {
    const pack = offlinePacks.find(p => p.id === packId);
    if (!pack) return;
    if (!(await confirm({ title: `Remove ${pack.title}?`, description: 'The saved pictures for this chapter are deleted from this device.', confirmLabel: 'Remove', tone: 'danger' }))) return;
    setOfflinePacks(prev => prev.filter(p => p.id !== packId));
  };

  const handleExportOfflinePack = (packId: string) => {
    const pack = offlinePacks.find(p => p.id === packId);
    if (!pack) return;
    const data = JSON.stringify(pack, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${pack.book}-${pack.chapter}-offline-pack.json`.replace(/\s+/g, '-');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleArtStyleChange = (s: ArtStyle) => {
    if (checkFeatureLock('art', s)) {
      setArtStyle(s);
    }
  };

  const handleLanguageChange = (l: string) => {
    if (!checkFeatureLock('language', l)) return;
    setLanguage(l);
    // A reader who chooses isiZulu almost certainly wants the isiZulu Bible too.
    if (l === 'Zulu' && tradition === 'protestant' && selectedTranslation !== 'zul1883') {
      setSelectedTranslation('zul1883');
      if (companionId === 'zul1883') setCompanionId(null);
      toast({ title: 'Ufunda ngesiZulu', description: 'The chapter now shows the isiZulu Bible (1883). Comics and explanations are written in Zulu when they are generated. Pick "Also show underneath" to keep English alongside.' });
    }
  };

  const handleDownload = () => {
    if (checkFeatureLock('download')) {
      window.print();
    }
  };

  // --- STORY MODE AUDIO PLAYER ---
  useEffect(() => {
    return () => {
      if (storyAudioRef.current) {
        storyAudioRef.current.pause();
        storyAudioRef.current = null;
      }
    };
  }, []);

  const playPanelAudio = async (index: number) => {
    if (!panels[index]) return;
    if (storyAudioRef.current) storyAudioRef.current.pause();

    try {
      const panel = panels[index];
      const textToRead = `${panel.narrative}. ${panel.speechBubbles.map(b => `${b.speaker} says: ${b.text}`).join('. ')}`;
      const audioBuffer = await generateSpeech(textToRead);
      
      const blob = new Blob([audioBuffer], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      storyAudioRef.current = audio;
      
      audio.onended = () => {
        if (index < panels.length - 1) {
           setStoryModeIndex(index + 1);
        } else {
           setIsStoryPlaying(false);
        }
      };
      
      await audio.play();
    } catch (e) {
      console.error("Audio playback error", e);
      setIsStoryPlaying(false);
    }
  };

  useEffect(() => {
    if (isStoryPlaying && storyModeIndex !== null) {
      playPanelAudio(storyModeIndex);
    } else {
      if (storyAudioRef.current) storyAudioRef.current.pause();
    }
  }, [storyModeIndex, isStoryPlaying]);

  // --- HANDLERS ---
  const handleGenerate = async (e?: React.FormEvent, override?: {book: string, chapter: number}) => {
    if (e) e.preventDefault();
    if (!requireSignIn(UNLOCK.ai, () => { void handleGenerate(undefined, override); })) return;
    const bookToUse = override?.book || selectedBook;
    const chapterToUse = override?.chapter || selectedChapter;

    if (!checkFeatureLock('book', bookToUse)) return;

    switchMode('comic');
    setError(null);
    setIsGeneratingScript(true);
    setPanels([]);
    setCharacters([]);
    setLifeApplication('');
    setComicTitle('');
    setComicSummary('');
    setQuizData(null);
    setShowQuiz(false);

    const canUseCache = activeHeroIds.length === 0;
    const cacheKey = getCacheKey(bookToUse, chapterToUse, `${tradition}:${selectedTranslation || 'default'}`, language, artStyle);

    if (canUseCache) {
      const cached = loadCachedChapter(cacheKey);
      if (cached) {
        applyChapterResult(cached);
        setIsGeneratingScript(false);
        finalizeChapterSession();
        return;
      }
    }

    try {
      // If a discovered scripture (Quran/Deuterocanonical) is active, prefer its bundled text
      if (selectedScripture && scriptureData) {
        const verses = extractVersesFromScripture(scriptureData, bookToUse, chapterToUse);
        if (verses && verses.length > 0) {
          const basePanels: ComicPanelData[] = verses.map((v, index) => ({
            id: index,
            narrative: v.text,
            speechBubbles: [],
            visualPrompt: `Comic illustration of ${selectedScripture.displayName} ${bookToUse} ${chapterToUse}:${v.verse} - "${v.text}"`,
            verseReference: `${selectedScripture.displayName} ${bookToUse} ${chapterToUse}:${v.verse}`,
            isLoadingImage: true,
          }));

          setComicTitle(`${bookToUse} ${chapterToUse}`);
          setComicSummary('');
          setCharacters([]);
          setLifeApplication('');
          setPanels(basePanels);

          const generatedPanels = await Promise.all(
            basePanels.map(async (panel) => {
              try {
                const imageUrl = await generatePanelImage(panel.visualPrompt, artStyle);
                return { ...panel, imageUrl, isLoadingImage: false };
              } catch {
                return { ...panel, isLoadingImage: false };
              }
            })
          );

          const payload: CachedChapter = {
            key: cacheKey,
            book: bookToUse,
            chapter: chapterToUse,
            language,
            version,
            artStyle,
            title: `${selectedScripture.displayName} ${bookToUse} ${chapterToUse}`,
            summary: '',
            lifeApplication: '',
            characters: [],
            panels: generatedPanels,
            updatedAt: new Date().toISOString(),
          };

          applyChapterResult(payload);
          if (canUseCache) saveCachedChapter(payload);
          finalizeChapterSession();
          setIsGeneratingScript(false);
          return;
        }
      }

      // Prefer native text from the permanent scripture store (tradition-aware, gap-repaired)
      const localText = await loadChapter(
        tradition,
        selectedTranslation,
        override?.book ? override.book : (selectedBookSlug || bookToUse),
        chapterToUse
      );
      if (localText?.provenance) setChapterProvenance(localText.provenance);

      if (localText && localText.verses.length > 0) {
        const verses = localText.verses;
        const basePanels: ComicPanelData[] = verses.map((v, index) => ({
          id: index,
          narrative: v.text,
          speechBubbles: [],
          visualPrompt: `Comic illustration of ${bookToUse} ${chapterToUse}:${v.verse} - "${v.text}"`,
          verseReference: `${bookToUse} ${chapterToUse}:${v.verse}`,
          isLoadingImage: true,
        }));

        setComicTitle(`${bookToUse} ${chapterToUse}`);
        setComicSummary('');
        setCharacters([]);
        setLifeApplication('');
        setPanels(basePanels);

        const generatedPanelsLocal = await Promise.all(
          basePanels.map(async (panel) => {
            try {
              const imageUrl = await generatePanelImage(panel.visualPrompt, artStyle);
              return { ...panel, imageUrl, isLoadingImage: false };
            } catch {
              return { ...panel, isLoadingImage: false };
            }
          })
        );

        const payloadLocal: CachedChapter = {
          key: cacheKey,
          book: bookToUse,
          chapter: chapterToUse,
          language,
          version,
          artStyle,
          title: `${bookToUse} ${chapterToUse}`,
          summary: '',
          lifeApplication: '',
          characters: [],
          panels: generatedPanelsLocal,
          updatedAt: new Date().toISOString(),
        };

        applyChapterResult(payloadLocal);
        if (canUseCache) saveCachedChapter(payloadLocal);
        finalizeChapterSession();
        setIsGeneratingScript(false);
        return;

      }

      // Fallback to AI script only when no local text is available
      const heroesForRun = customHeroes.filter(hero => activeHeroIds.includes(hero.id));
      const script = await generateComicScript(bookToUse, chapterToUse, version, language, heroesForRun);
      
      setComicTitle(script.title);
      setComicSummary(script.summary);
      setCharacters(script.characters || []);
      setLifeApplication(script.life_application || "");

      const basePanels: ComicPanelData[] = script.panels.map((p, index) => ({
        id: index,
        narrative: p.narrative,
        speechBubbles: p.speech_bubbles || [],
        visualPrompt: p.visual_prompt,
        verseReference: p.verse_reference,
        isLoadingImage: true,
      }));

      setPanels(basePanels);

      const generatedPanels = await Promise.all(
        basePanels.map(async (panel) => {
          try {
            const imageUrl = await generatePanelImage(panel.visualPrompt, artStyle);
            return { ...panel, imageUrl, isLoadingImage: false };
          } catch {
            return { ...panel, isLoadingImage: false };
          }
        })
      );

      const payload: CachedChapter = {
        key: cacheKey,
        book: bookToUse,
        chapter: chapterToUse,
        language,
        version,
        artStyle,
        title: script.title,
        summary: script.summary,
        lifeApplication: script.life_application || "",
        characters: script.characters || [],
        panels: generatedPanels,
        updatedAt: new Date().toISOString(),
      };

      applyChapterResult(payload);

      if (canUseCache) {
        saveCachedChapter(payload);
      }

      finalizeChapterSession();
      setIsGeneratingScript(false);

    } catch (err) {
      console.error(err);
      setError("Could not create the comic. Please check connection.");
      setIsGeneratingScript(false);
    }
  };

  // Quizzes come from the permanent quiz bank: built from the chapter text
  // (instant, offline) and enriched with stored comprehension quizzes.
  const handleQuiz = async (fresh: boolean = false) => {
    if (!requireSignIn(UNLOCK.quiz, () => { void handleQuiz(fresh); })) return;
    if (quizData && !fresh) { setShowQuiz(true); return; }
    if (!chapterText || chapterText.length === 0) {
      setError('Load a chapter first, then test your knowledge.');
      return;
    }
    try {
      const pick = await getQuiz(
        {
          tradition,
          translationId: chapterTextSource?.versions?.[0] || selectedTranslation || 'default',
          bookSlug: selectedBookSlug || selectedBook,
          bookName: selectedBook,
          chapter: selectedChapter,
          verses: chapterText,
          verseLabel: tradition === 'quran' ? 'Ayah' : 'Verse',
          isQuran: tradition === 'quran',
        },
        { fresh, excludeId: quizPick?.set.id }
      );
      setQuizData(pick.quiz);
      setQuizPick(pick);
      setQuizAnswers({});
      setShowQuiz(true);
    } catch (e) {
      console.warn('Quiz failed', e);
      setError('Could not build a quiz for this chapter.');
    }
  };

  const handleOpenExplain = (text: string) => {
     setExplanation({
       targetText: text,
       result: '',
       loading: false,
       activeType: ''
     });
  };

  const handleFetchExplanation = async (type: string) => {
    if (!explanation) return;
    if (!checkFeatureLock('ai')) return;

    setExplanation(prev => ({ ...prev!, loading: true, activeType: type }));
    try {
      const result = await explainText(explanation.targetText, `${selectedBook} ${selectedChapter}`, type);
      setExplanation(prev => ({ ...prev!, result, loading: false }));
    } catch (e) {
      setExplanation(prev => ({ ...prev!, result: 'Error fetching explanation.', loading: false }));
    }
  };

  const toggleBookmark = () => {
    const key = `${selectedBook} ${selectedChapter}`;
    const newBookmarks = stats.bookmarks.includes(key) 
      ? stats.bookmarks.filter(b => b !== key)
      : [...stats.bookmarks, key];
    setStats({ ...stats, bookmarks: newBookmarks });
    safeWrite(STORAGE_KEYS.stats, { ...stats, bookmarks: newBookmarks });
  };

  const saveNote = () => {
    const key = `${selectedBook} ${selectedChapter}`;
    setNotes(prev => ({ ...prev, [key]: currentNote }));
    setShowNotes(false);
  };

  const selectedGroup = selectedGroupId ? groups.find(g => g.id === selectedGroupId) || null : null;
  const activeJourney = activeJourneyId ? GUIDED_JOURNEYS.find(j => j.id === activeJourneyId) : null;
  const activeJourneyProgress = activeJourneyId ? journeyProgress[activeJourneyId] : null;
  const activeJourneyPercent = activeJourney && activeJourneyProgress
    ? Math.round((activeJourneyProgress.completed.length / activeJourney.chapters.length) * 100)
    : 0;
  const nextJourneyChapterIndex = activeJourney && activeJourneyProgress
    ? activeJourney.chapters.findIndex((_, idx) => !activeJourneyProgress.completed.includes(idx))
    : -1;
  const nextJourneyChapter = activeJourney && activeJourneyProgress && nextJourneyChapterIndex >= 0
    ? activeJourney.chapters[nextJourneyChapterIndex]
    : null;
  const journeyComplete = activeJourney && activeJourneyProgress && nextJourneyChapterIndex === -1;

  const isBookmarked = stats.bookmarks.includes(`${selectedBook} ${selectedChapter}`);
  const isPaid = stats.tier === UserTier.EXPLORER || stats.tier === UserTier.SCHOLAR;
  const passageLabel = tradition === 'quran' ? selectedBook : `${selectedBook} ${selectedChapter}`;

  /* ---- The circle and where it is ---- */
  const currentChapterNo = tradition === 'quran' ? 1 : selectedChapter;
  const circleIsQuran = (selectedGroup?.tradition ?? tradition) === 'quran';
  const circleLabel = selectedGroup?.targetBook ? `${selectedGroup.targetBook}${circleIsQuran ? '' : ` ${selectedGroup.targetChapter}`}` : null;
  const circleOnChapter = !!selectedGroup?.targetBook && selectedGroup.targetBook === selectedBook && (circleIsQuran || selectedGroup.targetChapter === currentChapterNo);
  const circleDrifted = !!circleLabel && !circleOnChapter;
  useEffect(() => {
    if (!followCircle || !selectedGroup || circleOnChapter) return;
    handleSetGroupTarget(selectedGroup.id, selectedBook, currentChapterNo, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followCircle, selectedGroup?.id, selectedBook, currentChapterNo, tradition]);
  useEffect(() => { setRailAttach(true); }, [readerSelection?.key]);
  const selectionPointer = (): PassagePointer | undefined => readerSelection
    ? { tradition, book: selectedBook, chapter: currentChapterNo, verses: readerSelection.verses, label: readerSelection.label }
    : undefined;

  /* ---- Two languages on one page ---- */
  const effectiveTranslation = chapterTextSource?.versions?.[0] || selectedTranslation || null;
  const companionId = (companionByTradition[tradition] ?? null) === effectiveTranslation ? null : (companionByTradition[tradition] ?? null);
  const setCompanionId = (id: string | null) => {
    setCompanionByTradition(prev => {
      const next = { ...prev, [tradition]: id };
      safeWrite(STORAGE_KEYS.companion, next);
      return next;
    });
  };
  /** The small language becomes the big one and vice versa. Marks stay where they are — they belong to the verse. */
  const swapCompanion = () => {
    if (!companionId || !effectiveTranslation) return;
    setSelectedTranslation(companionId);
    setCompanionId(effectiveTranslation);
  };
  useEffect(() => {
    let cancelled = false;
    loadManifest(tradition)
      .then(m => {
        if (cancelled) return;
        setTranslationMeta({
          primary: m.translations.find(t => t.id === effectiveTranslation) ?? null,
          companion: companionId ? m.translations.find(t => t.id === companionId) ?? null : null,
        });
      })
      .catch(() => { if (!cancelled) setTranslationMeta({ primary: null, companion: null }); });
    return () => { cancelled = true; };
  }, [tradition, effectiveTranslation, companionId]);
  useEffect(() => {
    if (!companionId || !chapterText?.length) { setCompanionText(null); return; }
    let cancelled = false;
    const bookRef = selectedBookSlug || selectedBook;
    loadChapter(tradition, companionId, bookRef, selectedChapter, { repair: 'none', allowAI: false })
      .then(r => {
        if (cancelled) return;
        if (!r) { setCompanionText(null); return; }
        setCompanionText({ id: companionId, name: r.entry.displayName, language: translationMeta.companion?.language, verses: r.verses });
      })
      .catch(() => { if (!cancelled) setCompanionText(null); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tradition, companionId, selectedBookSlug, selectedBook, selectedChapter, chapterText, translationMeta.companion?.language]);
  const comicNotes = useMemo(
    () => (readerMode === 'comic' ? getVerseNotes(markChapterKey(tradition, selectedBookSlug || selectedBook, tradition === 'quran' ? 1 : selectedChapter)) : {}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [readerMode, tradition, selectedBookSlug, selectedBook, selectedChapter],
  );
  const chapterNoteKey = `${selectedBook} ${selectedChapter}`;
  const saveChapterNote = (text: string) => {
    setNotes(prev => {
      const next = { ...prev };
      if (text.trim()) next[chapterNoteKey] = text;
      else delete next[chapterNoteKey];
      return next;
    });
  };

  // What comes before and after this chapter — across book boundaries, so a
  // reader is never left at a dead end (a surah is one chapter, so "next" is
  // the next surah; the last chapter of Genesis leads into Exodus 1).
  type Passage = { bookSlug: string; bookName: string; chapter: number; label: string };
  const bookIdx = bookOrder.findIndex(b => b.slug === selectedBookSlug || b.displayName === selectedBook);
  const labelFor = (b: { displayName: string }, ch: number) => (tradition === 'quran' ? b.displayName : `${b.displayName} ${ch}`);
  const nextPassage: Passage | null = (() => {
    if (tradition !== 'quran' && selectedChapter < chapterCount) {
      return { bookSlug: selectedBookSlug || selectedBook, bookName: selectedBook, chapter: selectedChapter + 1, label: `${selectedBook} ${selectedChapter + 1}` };
    }
    const b = bookIdx >= 0 ? bookOrder[bookIdx + 1] : undefined;
    return b ? { bookSlug: b.slug, bookName: b.displayName, chapter: 1, label: labelFor(b, 1) } : null;
  })();
  const prevPassage: Passage | null = (() => {
    if (tradition !== 'quran' && selectedChapter > 1) {
      return { bookSlug: selectedBookSlug || selectedBook, bookName: selectedBook, chapter: selectedChapter - 1, label: `${selectedBook} ${selectedChapter - 1}` };
    }
    const b = bookIdx > 0 ? bookOrder[bookIdx - 1] : undefined;
    return b ? { bookSlug: b.slug, bookName: b.displayName, chapter: b.chapters, label: labelFor(b, b.chapters) } : null;
  })();
  const goTo = (p: Passage | null) => {
    if (!p) return;
    setSelectedBookSlug(p.bookSlug);
    setSelectedBook(p.bookName);
    setSelectedChapter(p.chapter);
  };
  const goNext = () => goTo(nextPassage);
  const goPrev = () => goTo(prevPassage);
  const communityBtnRef = useRef<HTMLButtonElement>(null);
  const profileBtnRef = useRef<HTMLButtonElement>(null);
  const quizScore = quizData ? quizData.questions.reduce((n, q, i) => n + (quizAnswers[i] === q.correctAnswer ? 1 : 0), 0) : 0;
  const quizAnswered = quizData ? Object.keys(quizAnswers).length : 0;
  const quizTotal = quizData?.questions.length ?? 0;

  const answerQuiz = (qIdx: number, oIdx: number) => {
    if (!quizData || quizAnswers[qIdx] != null) return;
    setQuizAnswers(prev => ({ ...prev, [qIdx]: oIdx }));
    if (oIdx === quizData.questions[qIdx].correctAnswer) awardXp(20);
  };

  const artStyleOptions = Object.values(ArtStyle).map(s => {
    let locked = false;
    if (stats.tier === UserTier.FREE && !FREE_STYLES.includes(s)) locked = true;
    if (stats.tier === UserTier.EXPLORER && !EXPLORER_STYLES.includes(s)) locked = true;
    return { value: s, label: s, locked, hint: locked ? 'Upgrade to unlock' : undefined };
  });

  /* Right-rail cards: your path, your circle */
  const railCards = (
    <>
      {activeJourney && activeJourneyProgress ? (
        <Card tone="blue" className="p-3">
          <Eyebrow className="text-blue-100" icon={<Compass size={12} />}>Your path · {activeJourneyPercent}%</Eyebrow>
          <p className="font-black text-sm leading-tight mt-0.5">{activeJourney.title}</p>
          <div className="mt-2 h-1.5 bg-blue-900/50 rounded-full overflow-hidden"><div className="h-full bg-yellow-300" style={{ width: `${activeJourneyPercent}%` }} /></div>
          {journeyComplete ? (
            <p className="text-[11px] text-blue-100 mt-2">Finished. Badge earned: {activeJourney.badge}.</p>
          ) : nextJourneyChapter && (nextJourneyChapter.book !== selectedBook || nextJourneyChapter.chapter !== selectedChapter) ? (
            <button onClick={() => triggerJourneyChapter(activeJourney.id, nextJourneyChapterIndex)} className="mt-2 w-full text-left text-[11px] bg-white/15 hover:bg-white/25 rounded-lg px-2 py-1.5 font-bold">
              Next: {nextJourneyChapter.book} {nextJourneyChapter.chapter} →
            </button>
          ) : (
            <p className="text-[11px] text-blue-100 mt-2">This is your next step. Mark it read at the end of the chapter.</p>
          )}
        </Card>
      ) : (
        <Card className="p-3">
          <Eyebrow icon={<Compass size={12} />}>Reading path</Eyebrow>
          <p className="text-[11px] text-slate-600 mt-1">Not sure where to go next? Follow a short path of chapters that build on each other.</p>
          <Button size="xs" variant="primary" block className="mt-2" onClick={() => setCommunityDrawer('journeys')}>Pick a path</Button>
        </Card>
      )}
      <Card tone="dark" className="p-3">
        <div className="flex items-center justify-between gap-2">
          <Eyebrow className="text-green-300" icon={<Users size={12} />}>Study circle</Eyebrow>
          {selectedGroup && (
            <button onClick={() => setCommunityDrawer('circle')} className="text-[10px] font-black uppercase tracking-wider text-slate-300 hover:text-white" title="Invite people, switch circle">Manage</button>
          )}
        </div>
        {selectedGroup ? (
          <>
            <p className="font-black text-sm leading-tight mt-0.5">{selectedGroup.name}</p>
            {circleDrifted ? (
              <button onClick={() => handleGoToGroupTarget(selectedGroup.id)} className="mt-2 w-full text-left text-[11px] bg-white/10 hover:bg-white/20 rounded-lg px-2 py-1.5">
                Circle is on <b>{circleLabel}</b> · Go there →
              </button>
            ) : (
              <p className="text-[11px] text-green-200 mt-0.5">Reading {passageLabel} together</p>
            )}
            {/* Reflections live here, next to the text — not in a drawer */}
            <ul className="mt-2 space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
              {selectedGroup.reflections.filter(r => r.author !== 'System').slice(-4).reverse().map(r => (
                <li key={r.id} className="bg-white/10 rounded-lg px-2 py-1.5">
                  <p className="text-[10px] font-black uppercase tracking-wider text-green-300 flex items-center gap-1.5 flex-wrap">
                    {r.author}
                    {r.ref && (
                      <button
                        type="button"
                        onClick={() => openPointer(r.ref!)}
                        title={sameChapter(r.ref, selectedBook, selectedChapter) ? 'Select these verses' : 'Open this passage'}
                        className="normal-case tracking-normal font-black text-[10px] px-1.5 py-0.5 rounded bg-yellow-300 text-black hover:bg-yellow-200"
                      >
                        {r.ref.label}
                      </button>
                    )}
                  </p>
                  <p className="text-[11px] leading-snug text-slate-100">{r.text}</p>
                </li>
              ))}
              {selectedGroup.reflections.filter(r => r.author !== 'System').length === 0 && (
                <li className="text-[11px] text-slate-400">Nothing shared yet. Select verses and choose Share, or write below.</li>
              )}
            </ul>
            <form
              className="mt-2 flex flex-col gap-1"
              onSubmit={e => {
                e.preventDefault();
                if (!railDraft.trim()) return;
                handleAddReflection(selectedGroup.id, railDraft.trim(), railAttach ? selectionPointer() : undefined);
                setRailDraft('');
              }}
            >
              {readerSelection && railAttach && (
                <p className="text-[10px] font-bold text-slate-300 flex items-center gap-1">
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-yellow-300 text-black font-black">
                    {readerSelection.label}
                    <button type="button" onClick={() => setRailAttach(false)} aria-label="Do not attach these verses" title="Detach" className="rounded hover:bg-yellow-200"><X size={11} /></button>
                  </span>
                  will be attached
                </p>
              )}
              {readerSelection && !railAttach && (
                <button type="button" onClick={() => setRailAttach(true)} className="text-left text-[10px] font-bold text-slate-400 underline">Attach {readerSelection.label}</button>
              )}
              <div className="flex gap-1">
              <input
                value={railDraft}
                onChange={e => setRailDraft(e.target.value)}
                placeholder={readerSelection && railAttach ? 'Say something about it…' : 'What stood out?'}
                aria-label="Share a reflection with your circle"
                className="min-w-0 flex-1 bg-white text-slate-900 text-xs font-bold rounded-lg px-2 py-1.5 border-2 border-black placeholder:font-medium placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-green-300"
              />
              <button type="submit" disabled={!railDraft.trim()} aria-label="Share" className="shrink-0 w-8 h-8 rounded-lg bg-green-400 border-2 border-black text-black disabled:opacity-40 flex items-center justify-center"><Send size={14} /></button>
              </div>
            </form>
          </>
        ) : (
          <>
            <p className="text-[11px] text-slate-300 mt-1">Read the same chapter as a friend and share what stood out, right here next to the text.</p>
            <Button size="xs" variant="success" block className="mt-2" onClick={() => setCommunityDrawer('circle')}>Start or join</Button>
          </>
        )}
      </Card>
    </>
  );

  return (
    <div className="min-h-screen pb-20 bg-yellow-50 font-sans">

      {!isPaid && <DonationBanner onDonate={(cents) => openSupport(cents)} />}

      {/* --- Self-contained overlays (Escape closes them) --- */}
      <SupportModal
        open={showMembershipModal}
        onClose={() => setShowMembershipModal(false)}
        chapter={chapterRef}
        supporterUntil={entitlement?.supporterUntil ?? null}
        displayName={profile.displayName}
        initialGift={supportGift}
        signedIn={Boolean(authUser)}
        onNeedSignIn={() => { setShowMembershipModal(false); requireSignIn(UNLOCK.pay, () => setShowMembershipModal(true)); }}
      />
      {showMissionModal && <EscapeLayer onClose={() => setShowMissionModal(false)}><MissionModal onClose={() => setShowMissionModal(false)} /></EscapeLayer>}
      <AuthModal
        open={showAuthModal}
        reason={authReason}
        onClose={() => {
          setShowAuthModal(false);
          // Closed without signing in: forget the action that was waiting on it.
          if (!currentUser()) { afterSignIn.current = null; setAuthReason(null); }
        }}
      />
      {showFounderModal && <EscapeLayer onClose={() => setShowFounderModal(false)}><FounderStoryModal onClose={() => setShowFounderModal(false)} onDonate={() => { setShowFounderModal(false); openSupport(); }} /></EscapeLayer>}
      {showCharacterLibrary && <EscapeLayer onClose={() => setShowCharacterLibrary(false)}><CharacterLibrary onClose={() => setShowCharacterLibrary(false)} tier={stats.tier} onUpgrade={() => setShowMembershipModal(true)} currentBook={selectedBook} /></EscapeLayer>}
      {showOfflineManager && (
        <EscapeLayer onClose={() => setShowOfflineManager(false)}>
          <OfflinePackManager packs={offlinePacks} onClose={() => setShowOfflineManager(false)} onLoad={handleLoadOfflinePack} onDelete={handleDeleteOfflinePack} onExport={handleExportOfflinePack} />
        </EscapeLayer>
      )}

      <StudyLibrary
        open={showStudyLibrary}
        onClose={() => setShowStudyLibrary(false)}
        stats={stats}
        lastRead={lastRead}
        chapterNotes={notes}
        onOpen={openPassage}
        onExport={handleExportStudy}
        onImportFile={handleImportStudy}
      />

      {/* --- TOP BAR: what am I reading · how do I want it · with whom · who am I --- */}
      <header className="sticky top-0 z-40 bg-white border-b-4 border-black shadow-md print:hidden">
        <div className="mx-auto max-w-[1440px] px-3 py-2 flex flex-wrap items-center gap-x-3 gap-y-2">

          <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex items-center gap-2 shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-300" title="ScriptureComix">
            <span className="bg-yellow-400 p-1.5 border-2 border-black rounded -rotate-3"><BookOpen size={18} className="text-black" /></span>
            <span className="font-black italic tracking-wider text-lg leading-none hidden xl:inline">SCRIPTURE<span className="text-yellow-500">COMIX</span></span>
          </button>

          <PassagePicker
            tradition={tradition}
            onTraditionChange={(t) => {
              setTradition(t);
              setSelectedBookSlug(null);
              setSelectedTranslation(DEFAULT_TRANSLATION[t]);
            }}
            selectedBook={selectedBookSlug}
            selectedBookName={selectedBook}
            selectedChapter={selectedChapter}
            selectedTranslation={selectedTranslation}
            onBookChange={(slug, displayName) => { setSelectedBookSlug(slug); setSelectedBook(displayName); }}
            onChapterChange={(ch) => setSelectedChapter(ch)}
            onTranslationChange={(translationId) => { setSelectedTranslation(translationId); if (translationId === companionId) setCompanionId(null); }}
            companionTranslation={companionId}
            onCompanionChange={setCompanionId}
            canOpenBook={(displayName) => checkFeatureLock('book', displayName)}
            chapterCount={chapterCount}
            canPrev={!!prevPassage}
            canNext={!!nextPassage}
            onPrev={goPrev}
            onNext={goNext}
          />

          {selectedGroup && (
            <CirclePill
              group={selectedGroup}
              you={profile.displayName.trim() || 'You'}
              circleLabel={circleLabel}
              onChapter={circleOnChapter}
              currentLabel={passageLabel}
              onGoThere={() => handleGoToGroupTarget(selectedGroup.id)}
              onSetToCurrent={() => handleSetGroupTargetToCurrent(selectedGroup.id)}
              onCopyInvite={() => handleInviteGroup(selectedGroup.id)}
              onManage={() => setCommunityDrawer('circle')}
              followCircle={followCircle}
              onFollowCircleChange={setFollowCircle}
              onOpenPointer={openPointer}
              onAddReflection={(text, ref) => handleAddReflection(selectedGroup.id, text, ref)}
              attachable={readerSelection ? { label: readerSelection.label, pointer: selectionPointer()! } : null}
            />
          )}

          <div className="ml-auto flex items-center gap-2">
            {/* On phones these live in the bottom bar */}
            <div className="hidden md:flex items-center gap-2">
            <Segmented
              ariaLabel="How to read"
              value={readerMode}
              onChange={(m) => switchMode(m)}
              items={[
                { value: 'read', label: 'Read', icon: <BookOpen size={14} />, title: 'Read the chapter like a book', hideLabelBelow: 'md' },
                { value: 'study', label: 'Study', icon: <Brain size={14} />, title: gated ? 'Sign in to unlock Study' : 'Verse by verse, with notes and context', hideLabelBelow: 'md', badge: gated ? <UnlockPill /> : undefined },
                { value: 'comic', label: 'Comic', icon: <Palette size={14} />, title: gated ? 'Sign in to unlock the comic' : 'The illustrated chapter', hideLabelBelow: 'md', badge: gated ? <UnlockPill /> : undefined },
              ]}
            />
            <Button
              variant="accent"
              size="sm"
              onClick={() => handleQuiz()}
              disabled={!chapterText || chapterText.length === 0 || isChapterTextLoading}
              title={gated ? 'Sign in to unlock quizzes' : 'Test yourself on this chapter'}
              className="py-2"
            >
              <Brain size={14} /> <span className="hidden md:inline">Quiz</span>{gated && <UnlockPill compact />}
            </Button>
            </div>

            {/* Together */}
            <button
              ref={communityBtnRef}
              onClick={() => { setShowCommunityMenu(v => !v); setShowProfileMenu(false); }}
              aria-haspopup="menu"
              aria-expanded={showCommunityMenu}
              className={cx('hidden md:flex items-center gap-1.5 font-black uppercase tracking-wider text-xs py-2 px-3 border-[3px] border-black rounded-full shadow-[3px_3px_0_0_#000] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-300', showCommunityMenu ? 'bg-green-300' : 'bg-white hover:bg-green-50')}
              title="Read with others"
            >
              <Users size={14} /> <span className="hidden lg:inline">Together</span>
            </button>
            <Popover open={showCommunityMenu} onClose={() => setShowCommunityMenu(false)} anchorRef={communityBtnRef} align="end" width={300} role="menu" label="Read with others" className="p-2">
              <MenuItem icon={<Users size={16} />} title="Study circle" hint={selectedGroup ? `${selectedGroup.name} · ${selectedGroup.reflections.filter(r => r.author !== 'System').length} reflections` : 'Read the same chapter as friends'} onClick={() => { setShowCommunityMenu(false); setCommunityDrawer('circle'); }} />
              {groups.length > 0 && (
                <ul className="mx-1 mb-1 space-y-1 border-2 border-slate-200 rounded-xl p-1.5 bg-slate-50" aria-label="Your circles">
                  {groups.slice(0, 6).map(g => {
                    const active = g.id === selectedGroupId;
                    const ended = g.cloud && g.status === 'ended';
                    const leads = !!circleActor && g.ownerUid === circleActor.uid;
                    const label = g.targetLabel || (g.targetBook ? `${g.targetBook}${(g.tradition ?? 'protestant') === 'quran' ? '' : ` ${g.targetChapter}`}` : null);
                    return (
                      <li key={g.id} className={cx('rounded-lg px-2 py-1.5 text-xs', active ? 'bg-white border-2 border-black' : 'border-2 border-transparent')}>
                        <div className="flex items-center justify-between gap-2">
                          <button type="button" onClick={() => { setSelectedGroupId(g.id); setShowCommunityMenu(false); setCommunityDrawer('circle'); }} className="min-w-0 flex-1 text-left font-black truncate hover:underline" title="Open this circle">
                            {g.name}
                          </button>
                          {ended ? <Pill tone="red"><Lock size={10} /> Ended</Pill> : label ? <span className="text-[10px] text-slate-500 truncate max-w-[7rem]" title={label}>{label}</span> : null}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {!active && <button type="button" onClick={() => setSelectedGroupId(g.id)} className="rounded border border-slate-300 bg-white px-1.5 py-0.5 font-bold hover:bg-slate-100">Switch to</button>}
                          {label && <button type="button" onClick={() => { setSelectedGroupId(g.id); setShowCommunityMenu(false); handleGoToGroupTarget(g.id); }} className="rounded border border-slate-300 bg-white px-1.5 py-0.5 font-bold hover:bg-slate-100">Go back to {g.cloud && g.targetVerses?.length ? 'verses' : 'chapter'}</button>}
                          {g.cloud && leads && !ended && <button type="button" onClick={() => { setShowCommunityMenu(false); handleEndSessionQuick(g.id); }} className="rounded border border-red-300 bg-red-50 text-red-800 px-1.5 py-0.5 font-bold hover:bg-red-100">End session</button>}
                          <button type="button" onClick={() => { setShowCommunityMenu(false); handleLeaveGroup(g.id); }} className="rounded border border-slate-300 bg-white px-1.5 py-0.5 font-bold hover:bg-slate-100">Exit</button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              <MenuItem icon={<Compass size={16} />} title="Reading paths" hint={activeJourney ? `${activeJourney.title} · ${activeJourneyPercent}%` : 'Short chapter sequences that build understanding'} onClick={() => { setShowCommunityMenu(false); setCommunityDrawer('journeys'); }} />
              <MenuItem icon={<Sparkles size={16} />} title="Your cast" hint={customHeroes.length ? `${customHeroes.length} character${customHeroes.length === 1 ? '' : 's'} for your comics` : 'Characters who appear in comics you generate'} onClick={() => { setShowCommunityMenu(false); openCast(); }} />
            </Popover>

            {/* You */}
            <button
              ref={profileBtnRef}
              onClick={() => { setNameDraft(profile.displayName || ''); setShowProfileMenu(v => !v); setShowCommunityMenu(false); }}
              aria-haspopup="menu"
              aria-expanded={showProfileMenu}
              className={cx('flex items-center gap-1.5 py-1 pl-1 pr-2 border-[3px] border-black rounded-full shadow-[3px_3px_0_0_#000] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-300', showProfileMenu ? 'bg-yellow-200' : 'bg-white hover:bg-yellow-50')}
              title="You: your name, streak, and everything you have marked"
            >
              <MemberAvatar name={profile.displayName || 'Pilgrim'} size="md" className="w-7 h-7" />
              <span className="hidden md:inline text-xs font-black truncate max-w-[7rem]">{profile.displayName || 'Pilgrim'}</span>
              {stats.streak > 0 && (
                <span className="hidden xl:inline-flex items-center gap-0.5 text-[10px] font-black text-orange-800 bg-orange-100 border border-orange-300 rounded-full px-1.5 py-0.5" title="Days in a row you have read something">
                  <Flame size={11} className="text-orange-500 fill-orange-500" />{stats.streak}-day streak
                </span>
              )}
            </button>
            <Popover open={showProfileMenu} onClose={() => setShowProfileMenu(false)} anchorRef={profileBtnRef} align="end" width={300} role="menu" label="You" className="p-3 space-y-3 text-sm">
              <form
                className="space-y-1"
                onSubmit={e => { e.preventDefault(); const n = nameDraft.trim(); setProfile(prev => ({ ...prev, displayName: n })); toast({ title: n ? `You are ${n}` : 'Name cleared', description: 'This is how circles see you and how your notes are signed.' }); }}
              >
                <label htmlFor="your-name" className="text-[10px] font-black uppercase tracking-widest text-slate-500">Your name · how circles see you</label>
                <div className="flex gap-1">
                  <TextInput id="your-name" value={nameDraft} onChange={e => setNameDraft(e.target.value)} placeholder="Pilgrim" className="min-w-0 flex-1" />
                  <Button type="submit" size="sm" variant="dark" disabled={nameDraft.trim() === (profile.displayName || '').trim()}>Save</Button>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-slate-500">{supporter && entitlement?.supporterUntil ? `Supporter until ${new Date(entitlement.supporterUntil).toLocaleDateString()}` : 'Free reader'}</p>
                  <Button size="xs" variant="primary" onClick={() => { setShowProfileMenu(false); openSupport(); }}>{supporter ? 'Extend' : 'Support'}</Button>
                </div>
              </form>
              {authConfigured && (
                authUser ? (
                  <div className="flex items-center justify-between gap-2 rounded-lg border-2 border-green-300 bg-green-50 px-2 py-1.5">
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-widest text-green-800">Synced · {providerLabel(authUser)}</p>
                      <p className="text-xs font-bold truncate" title={authUser.email || authUser.phoneNumber || undefined}>{authUser.email || authUser.phoneNumber || authUser.displayName || 'Signed in'}</p>
                    </div>
                    <Button size="xs" variant="secondary" onClick={handleSignOut}>Sign out</Button>
                  </div>
                ) : (
                  <MenuItem icon={<Lock size={16} />} title="Sign in" hint="Keep your streak, points and bookmarks on every device" onClick={() => { setShowProfileMenu(false); setShowAuthModal(true); }} />
                )
              )}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-orange-50 rounded-lg p-2" title="Read something on consecutive days to keep it going">
                  <p className="font-black text-lg leading-none flex items-center justify-center gap-0.5"><Flame size={14} className="text-orange-500 fill-orange-500" />{stats.streak}</p>
                  <p className="text-[10px] uppercase text-slate-500 mt-0.5">day{stats.streak === 1 ? '' : 's'} in a row</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-2" title="Points for reading, marking and answering quizzes"><p className="font-black text-lg leading-none">{stats.xp}</p><p className="text-[10px] uppercase text-slate-500 mt-0.5">points</p></div>
                <div className="bg-slate-50 rounded-lg p-2" title="Chapters you marked as read"><p className="font-black text-lg leading-none">{stats.chaptersRead}</p><p className="text-[10px] uppercase text-slate-500 mt-0.5">chapters read</p></div>
              </div>
              <MenuItem icon={<Library size={16} />} title="My study" hint="Highlights, notes, bookmarks, where you left off" tone="accent" onClick={() => { setShowProfileMenu(false); setShowStudyLibrary(true); }} />
              <div className="flex items-center justify-between gap-2 text-xs font-bold px-1">
                <span className="flex items-center gap-1"><Globe size={14} className="text-blue-500" /> Language</span>
                <Select<string>
                  ariaLabel="Language"
                  size="sm"
                  align="end"
                  width={220}
                  searchable
                  value={language}
                  onChange={handleLanguageChange}
                  options={SUPPORTED_LANGUAGES.map(l => ({ value: l, label: l, locked: stats.tier === UserTier.FREE && l !== 'English' && l !== 'Zulu' }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-1 text-xs font-bold">
                <button onClick={() => { setShowProfileMenu(false); setShowCharacterLibrary(true); }} className="rounded-lg border-2 border-black px-2 py-1.5 hover:bg-slate-100 flex items-center gap-1"><User size={12} /> Who's who</button>
                {stats.tier === UserTier.SCHOLAR && (
                  <button onClick={() => { setShowProfileMenu(false); setShowOfflineManager(true); }} className="rounded-lg border-2 border-black px-2 py-1.5 hover:bg-slate-100 flex items-center gap-1"><Archive size={12} /> Offline packs {offlinePacks.length}</button>
                )}
                <button onClick={() => { setShowProfileMenu(false); setShowMissionModal(true); }} className="rounded-lg border-2 border-black px-2 py-1.5 hover:bg-slate-100 flex items-center gap-1"><Heart size={12} className="text-red-500" /> Our mission</button>
                <button onClick={() => { setShowProfileMenu(false); setShowFounderModal(true); }} className="rounded-lg border-2 border-black px-2 py-1.5 hover:bg-slate-100 flex items-center gap-1"><User size={12} /> The founder</button>
                {!isPaid && <button onClick={() => { setShowProfileMenu(false); openSupport(); }} className="rounded-lg border-2 border-black px-2 py-1.5 hover:bg-slate-100 flex items-center gap-1"><Heart size={12} className="text-red-500 fill-red-500" /> Support</button>}
              </div>
            </Popover>
          </div>

          {/* You have wandered from the circle's chapter — the one line people look for, where they look for it */}
          {selectedGroup && circleDrifted && (
            <p className="w-full -mb-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-bold text-amber-900 bg-amber-100 border-2 border-amber-400 rounded-lg px-3 py-1.5">
              <Users size={13} className="shrink-0" />
              <span className="min-w-0 truncate"><b>{selectedGroup.name}</b> is reading <b>{circleLabel}</b> right now.</span>
              <button type="button" onClick={() => handleGoToGroupTarget(selectedGroup.id)} className="ml-auto inline-flex items-center gap-1 font-black underline underline-offset-2 hover:text-amber-700">Read with them <ArrowRightIcon /></button>
              <button type="button" onClick={() => handleSetGroupTargetToCurrent(selectedGroup.id)} className="font-black underline underline-offset-2 hover:text-amber-700" title={`Move the circle to ${passageLabel} so everyone reads it with you`}>Bring them to {passageLabel}</button>
            </p>
          )}
        </div>
      </header>

      {/* Phone toolbar: the reading controls sit under the thumb instead of crowding the top bar */}
      <nav
        aria-label="Reading controls"
        className="md:hidden fixed inset-x-0 bottom-0 z-40 bg-white border-t-4 border-black print:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="px-3 py-2 flex items-center gap-2">
          <Segmented
            ariaLabel="How to read"
            value={readerMode}
            onChange={(m) => switchMode(m)}
            className="flex-1"
            items={[
              { value: 'read', label: 'Read', icon: <BookOpen size={14} /> },
              { value: 'study', label: 'Study', icon: <Brain size={14} />, badge: gated ? <UnlockPill compact /> : undefined },
              { value: 'comic', label: 'Comic', icon: <Palette size={14} />, badge: gated ? <UnlockPill compact /> : undefined },
            ]}
          />
          <IconButton
            label="Quiz on this chapter"
            variant="accent"
            onClick={() => handleQuiz()}
            disabled={!chapterText || chapterText.length === 0 || isChapterTextLoading}
          >
            <Brain size={18} />
          </IconButton>
          <IconButton
            label="Read with others"
            variant={selectedGroup ? 'success' : 'secondary'}
            onClick={() => setCommunityDrawer('circle')}
          >
            <Users size={18} />
          </IconButton>
        </div>
      </nav>

      <ScriptureSourceBar
        label={passageLabel}
        source={chapterTextSource}
        provenance={chapterProvenance}
        verseCount={chapterText?.length ?? 0}
        loading={isChapterTextLoading}
        error={chapterTextError}
        stats={storeStats}
      />
      {sponsorship && sponsorship.names.length > 0 && (
        <div className="container mx-auto max-w-[1440px] px-4 md:px-8 pt-3 print:hidden">
          <Pill tone="amber" className="border-2 border-black shadow-[2px_2px_0_0_#000] normal-case" title={sponsorship.entries.map(e => e.message).filter(Boolean).join(' · ') || undefined}>
            <Heart size={11} className="fill-red-500 text-red-500" /> Pictures for this chapter made possible by {formatNames(sponsorship.names)}
          </Pill>
        </div>
      )}

      {/* --- MAIN CONTENT --- */}
      <main className={cx('container mx-auto p-4 md:p-8 min-h-[60vh]', readerMode === 'comic' ? 'max-w-7xl' : 'max-w-[1440px]')}>
        {error && (
          <div role="alert" className="bg-red-100 border-l-8 border-red-600 p-4 mb-6 rounded shadow text-red-800 font-bold flex items-start justify-between gap-3">
            <span>{error}</span>
            <IconButton label="Dismiss" size="sm" onClick={() => setError(null)}><X size={14} /></IconButton>
          </div>
        )}

        {/* Comic toolbar: art style, your cast, the AI verse-by-verse generator */}
        {readerMode === 'comic' && (
          <div className="flex flex-wrap items-center justify-center gap-2 mb-6 print:hidden">
            <Select<ArtStyle>
              ariaLabel="Art style"
              size="sm"
              width={280}
              icon={<Palette size={14} className="text-purple-600" />}
              value={artStyle}
              onChange={handleArtStyleChange}
              options={artStyleOptions}
              buttonClassName="border-purple-500 text-purple-900 bg-purple-50 hover:bg-purple-100"
            />
            <Button size="sm" variant="secondary" onClick={openCast}>
              <Users size={14} /> Cast{activeHeroIds.length ? ` · ${activeHeroIds.length}` : ''}
            </Button>
            <Button size="sm" variant="danger" onClick={(e) => handleGenerate(e)} disabled={isGeneratingScript} title="An AI-written script with one panel per verse. Uses AI credits.">
              {isGeneratingScript ? <RefreshCw className="animate-spin" size={14} /> : <Sparkles size={14} />} Generate verse-by-verse comic
            </Button>
            {panels.length > 0 && (
              <Button size="sm" variant="ghost" onClick={() => setPanels([])}>Back to scenes</Button>
            )}
          </div>
        )}

        {/* Read / Study */}
        {readerMode !== 'comic' && chapterText && chapterText.length > 0 && (
          <ScriptureReader
            mode={readerMode}
            chapterKey={markChapterKey(tradition, selectedBookSlug || selectedBook, tradition === 'quran' ? 1 : selectedChapter)}
            label={passageLabel}
            translationName={chapterTextSource?.displayName || ''}
            license={chapterTextSource?.license || ''}
            verses={chapterText}
            verseLabel={tradition === 'quran' ? 'Ayah' : 'Verse'}
            isQuran={tradition === 'quran'}
            canPrev={!!prevPassage}
            canNext={!!nextPassage}
            onPrev={goPrev}
            onNext={goNext}
            scenes={sceneResult?.status === 'ready' ? sceneResult.scenes : []}
            illustrating={illustrating || scenesLoading}
            onIllustrate={illustrateCurrentChapter}
            contextSummary={chapterContext?.context?.summary}
            context={chapterContext?.context ?? null}
            onQuiz={() => handleQuiz()}
            nextLabel={nextPassage?.label}
            onReflect={() => setShowNotes(true)}
            chapterNote={notes[chapterNoteKey] || ''}
            onSaveChapterNote={saveChapterNote}
            author={profile.displayName.trim() || undefined}
            language={translationLanguage(translationMeta.primary)}
            companion={companionText}
            onSwapCompanion={companionText ? swapCompanion : undefined}
            onCompanionOff={companionText ? () => setCompanionId(null) : undefined}
            circleName={selectedGroup?.name}
            onShareSelection={selectedGroup ? (sel) => { setShareSelection(sel); setShareDraft(''); } : undefined}
            onSelectionChange={setReaderSelection}
            onModeChange={(m) => switchMode(m, false)}
            chapterCount={chapterCount}
            currentChapter={selectedChapter}
            extraRail={railCards}
            focusVerses={focusVerses}
            onFocusVersesHandled={() => setFocusVerses(null)}
            completed={currentChapterDone}
            onComplete={markChapterRead}
            compareTranslations={async (verse) => {
              const manifest = await loadManifest(tradition);
              const current = chapterTextSource?.versions?.[0] || selectedTranslation;
              const others = manifest.translations.filter(t => t.isPublicDomain && t.id !== current);
              const rows = await Promise.all(others.map(async t => {
                try {
                  const r = await loadChapter(tradition, t.id, selectedBookSlug || selectedBook, selectedChapter, { allowAI: false });
                  const v = r?.verses.find(x => x.verse === verse);
                  return v ? { name: t.displayName, text: v.text } : null;
                } catch { return null; }
              }));
              return rows.filter((r): r is { name: string; text: string } => !!r);
            }}
          />
        )}
        {readerMode !== 'comic' && isChapterTextLoading && (
          <div className="flex justify-center py-16"><Loader text={`Opening ${selectedBook}…`} /></div>
        )}
        {readerMode !== 'comic' && !isChapterTextLoading && (!chapterText || chapterText.length === 0) && (
          <div className="text-center py-16 text-slate-500 font-bold">{chapterTextError || 'Pick a book above to start reading.'}</div>
        )}

        {readerMode === 'study' && chapterText && chapterText.length > 0 && !isGeneratingScript && (
          <ChapterContextPanel
            label={passageLabel}
            context={chapterContext?.context ?? null}
            source={chapterContext?.source ?? null}
            status={contextLoading ? 'loading' : (chapterContext?.status ?? 'unavailable')}
          />
        )}

        {/* Comic: the illustrated edition */}
        {readerMode === 'comic' && chapterText && chapterText.length > 0 && !isGeneratingScript && panels.length === 0 && (
          <ScenesView
            label={passageLabel}
            verseLabel={tradition === 'quran' ? 'Ayah' : 'Verse'}
            scenes={sceneResult?.scenes ?? []}
            verses={chapterText}
            status={scenesLoading || (!sceneResult && isChapterTextLoading) ? 'loading' : (sceneResult?.status ?? 'unavailable')}
            illustrating={illustrating}
            onIllustrate={illustrateCurrentChapter}
            canNext={!!nextPassage}
            onNext={goNext}
            onQuiz={() => handleQuiz()}
            nextLabel={nextPassage?.label}
            onReflect={() => setShowNotes(true)}
            completed={currentChapterDone}
            onComplete={markChapterRead}
            notes={comicNotes}
            onOpenNote={(key) => { void openPassage({ tradition, bookSlug: selectedBookSlug ?? undefined, bookName: selectedBook, chapter: tradition === 'quran' ? 1 : selectedChapter, verses: versesOfKey(key), mode: 'read' }); }}
          />
        )}

        {readerMode === 'comic' && !isGeneratingScript && panels.length === 0 && !error && (!chapterText || chapterText.length === 0) && (
          <div className="flex flex-col items-center justify-center py-20 text-center opacity-60">
            <div className="bg-white p-8 rounded-full border-4 border-dashed border-gray-300 mb-6"><BookOpen size={64} className="text-gray-300" /></div>
            <h2 className="comic-font text-4xl text-gray-400 mb-2">Ready to read?</h2>
            <p className="text-gray-500 max-w-md">Pick a book and chapter at the top.</p>
          </div>
        )}

        {isGeneratingScript && <div className="flex flex-col items-center justify-center py-20"><Loader text={`Visualizing ${passageLabel}...`} /></div>}

        {readerMode === 'comic' && panels.length > 0 && !isGeneratingScript && (
          <div className="animate-fade-in pb-10">
            <div className="text-center mb-12 mt-4 relative">
              <div className="absolute top-0 right-0 flex gap-2 print:hidden z-10">
                <IconButton label="Story mode (full screen)" variant="secondary" onClick={() => setStoryModeIndex(0)} className="bg-blue-500 text-white hover:bg-blue-600"><Maximize2 size={18} /></IconButton>
                {characters.length > 0 && <IconButton label="Chapter characters" onClick={() => setShowCharacters(true)} className="bg-pink-100 text-pink-900 hover:bg-pink-200"><User size={18} /></IconButton>}
                <IconButton label={isBookmarked ? 'Remove bookmark' : 'Bookmark this chapter'} onClick={toggleBookmark} className={isBookmarked ? 'bg-yellow-400' : ''}><Bookmark size={18} fill={isBookmarked ? 'black' : 'none'} /></IconButton>
                <IconButton label="Chapter notes" onClick={() => setShowNotes(true)}><Edit3 size={18} /></IconButton>
              </div>

              <div className="inline-block bg-white border-4 border-black p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transform -rotate-1 relative max-w-2xl">
                <div className="absolute -top-3 -left-3 w-6 h-6 rounded-full bg-red-500 border-2 border-black print:hidden"></div>
                <div className="absolute -top-3 -right-3 w-6 h-6 rounded-full bg-red-500 border-2 border-black print:hidden"></div>
                <h2 className="text-4xl md:text-6xl comic-font uppercase text-slate-900 tracking-wider">{selectedBook} <span className="text-red-600">{selectedChapter}</span></h2>
                <div className="w-16 h-1 bg-black my-4"></div>
                <p className="text-2xl comic-font text-slate-800">{comicTitle}</p>
                <p className="text-lg text-slate-600 italic mt-2 font-serif">{comicSummary}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 print:block print:columns-2">
              {panels.map((panel, idx) => (
                <div key={panel.id} className="print:mb-8 print:break-inside-avoid">
                  <ComicPanel data={panel} index={idx} onExplain={handleOpenExplain} />
                </div>
              ))}
            </div>

            {lifeApplication && (
              <div className="mt-16 bg-blue-50 border-4 border-black p-8 rounded-xl shadow-[8px_8px_0px_0px_#1e3a8a] relative print:break-inside-avoid">
                <div className="absolute -top-6 left-10 bg-blue-800 text-white px-4 py-2 border-2 border-black font-bold uppercase tracking-widest text-lg rotate-1">
                  Why this matters today
                </div>
                <p className="text-xl font-medium leading-relaxed font-serif text-blue-900 mt-4">{lifeApplication}</p>
              </div>
            )}

            <div className="mt-16 flex flex-col items-center gap-6 print:hidden">
              <Button variant="accent" size="lg" onClick={() => handleQuiz()}><Brain size={22} /> Test your knowledge</Button>
              <div className="flex flex-wrap justify-center gap-3">
                <Button variant="secondary" square onClick={handleDownload} className="relative">
                  <Download size={18} /> Save PDF
                  {stats.tier !== UserTier.SCHOLAR && <span className="absolute -top-2 -right-2 bg-slate-900 text-white rounded-full p-1"><Lock size={10} /></span>}
                </Button>
                {stats.tier === UserTier.SCHOLAR && (
                  <Button variant="dark" square onClick={handleSaveOfflinePack}><Archive size={18} /> Save offline pack</Button>
                )}
                <Button variant="primary" square onClick={goNext} disabled={!nextPassage}>{nextPassage ? `Next: ${nextPassage.label}` : 'Last chapter'} <ChevronRight size={18} /></Button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* --- TOGETHER DRAWER: circle, paths, cast --- */}
      <Drawer
        open={communityDrawer !== null}
        onClose={() => setCommunityDrawer(null)}
        label="Read with others"
        header={
          <Segmented<'circle' | 'journeys' | 'forge'>
            ariaLabel="Section"
            size="sm"
            value={communityDrawer ?? 'circle'}
            onChange={(k) => setCommunityDrawer(k)}
            items={[
              { value: 'circle', label: 'Circle', icon: <Users size={12} /> },
              { value: 'journeys', label: 'Paths', icon: <Compass size={12} /> },
              { value: 'forge', label: 'Cast', icon: <Sparkles size={12} /> },
            ]}
          />
        }
      >
        {communityDrawer === 'journeys' && (
          <GuidedJourneysBoard
            journeys={GUIDED_JOURNEYS}
            progressMap={journeyProgress}
            activeJourneyId={activeJourneyId}
            onStart={(id) => { handleJourneyStartAndLaunch(id); setCommunityDrawer(null); }}
            onResume={(id) => { handleJourneyResume(id); setCommunityDrawer(null); }}
            onJumpToChapter={(id, idx) => { triggerJourneyChapter(id, idx); setCommunityDrawer(null); }}
            onAbandon={handleJourneyReset}
          />
        )}
        {communityDrawer === 'circle' && (
          <CollaborativeHub
            groups={groups}
            selectedGroupId={selectedGroupId}
            displayName={profile.displayName}
            tradition={tradition}
            currentPassage={{ book: selectedBook, chapter: tradition === 'quran' ? 1 : selectedChapter, label: passageLabel }}
            attachable={selectionPointer() ?? null}
            actor={circleActor}
            onSignIn={authConfigured ? () => { setCommunityDrawer(null); setShowAuthModal(true); } : undefined}
            onCreate={handleCreateGroup}
            onJoin={handleJoinGroup}
            onSelect={handleSelectGroup}
            onRename={handleRenameGroup}
            onSetTargetToCurrent={handleSetGroupTargetToCurrent}
            onSetTarget={handleSetGroupTarget}
            onGoToTarget={handleGoToGroupTarget}
            onInvite={handleInviteGroup}
            onAddReflection={handleAddReflection}
            onOpenPointer={openPointer}
            onLeave={handleLeaveGroup}
            onDisplayNameChange={(name) => setProfile(prev => ({ ...prev, displayName: name }))}
          />
        )}
        {communityDrawer === 'forge' && (
          <CharacterBuilder
            heroes={customHeroes}
            activeHeroIds={activeHeroIds}
            heroLimit={HERO_LIMIT}
            onCreate={handleCreateHero}
            onToggle={handleToggleHero}
            onDelete={handleDeleteHero}
          />
        )}
      </Drawer>

      {/* --- STORY MODE --- */}
      {storyModeIndex !== null && panels.length > 0 && (
        <EscapeLayer onClose={() => { setIsStoryPlaying(false); setStoryModeIndex(null); }}>
        <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Story mode">
          <div className="absolute top-4 left-4 right-4 flex justify-between items-start z-10">
            <div className="text-white">
              <h3 className="comic-font text-2xl tracking-widest">{selectedBook} {selectedChapter}</h3>
              <p className="text-gray-400 text-sm">Panel {storyModeIndex + 1} of {panels.length}</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setIsStoryPlaying(!isStoryPlaying)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold border-2 border-white transition-all ${isStoryPlaying ? 'bg-red-600 text-white animate-pulse' : 'bg-transparent text-white hover:bg-white/20'}`}
              >
                {isStoryPlaying ? <><PauseCircle size={20} /> Playing…</> : <><PlayCircle size={20} /> Play with narration</>}
              </button>
              <IconButton label="Close story mode" onClick={() => { setIsStoryPlaying(false); setStoryModeIndex(null); }} className="bg-white/10 text-white border-white hover:bg-white/20 shadow-none"><X size={20} /></IconButton>
            </div>
          </div>

          <div className="flex-grow flex items-center justify-center w-full max-w-5xl relative">
            {storyModeIndex > 0 && (
              <button onClick={() => { setIsStoryPlaying(false); setStoryModeIndex(i => i! - 1); }} className="absolute left-0 p-4 text-white/50 hover:text-white hover:bg-white/10 rounded-full z-20" aria-label="Previous panel">
                <ChevronLeft size={48} />
              </button>
            )}
            <div className="w-full max-h-[85vh] bg-white rounded-lg overflow-hidden flex flex-col shadow-2xl animate-fade-in">
              <div className="bg-yellow-100 p-6 border-b-2 border-black text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-2 h-full bg-red-500"></div>
                <p className="font-comic font-bold text-xl md:text-3xl text-slate-900 leading-snug">{panels[storyModeIndex].narrative}</p>
              </div>
              <div className="flex-grow bg-slate-900 flex items-center justify-center overflow-hidden relative">
                {panels[storyModeIndex].isLoadingImage ? (
                  <div className="text-white comic-font text-2xl animate-pulse">Painting scene…</div>
                ) : (
                  <img src={panels[storyModeIndex].imageUrl} className="max-h-full max-w-full object-contain shadow-lg" alt="Scene" />
                )}
                <div className="absolute bottom-4 right-4 bg-black/70 text-white px-3 py-1 rounded text-xs font-bold uppercase backdrop-blur-sm">{panels[storyModeIndex].verseReference}</div>
              </div>
              <div className="p-6 bg-white border-t-2 border-black min-h-[120px]">
                {panels[storyModeIndex].speechBubbles.length > 0 ? (
                  <div className="space-y-3">
                    {panels[storyModeIndex].speechBubbles.map((b, i) => (
                      <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                        <div className={`max-w-[80%] rounded-2xl px-4 py-2 border-2 border-black ${i % 2 === 0 ? 'bg-white rounded-bl-none' : 'bg-blue-50 rounded-br-none'}`}>
                          <span className="block text-[10px] font-bold uppercase text-gray-500 mb-1">{b.speaker}</span>
                          <p className="font-comic text-xl">{b.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-gray-400 italic text-center py-4">…</p>}
              </div>
            </div>
            {storyModeIndex < panels.length - 1 && (
              <button onClick={() => { setIsStoryPlaying(false); setStoryModeIndex(i => i! + 1); }} className="absolute right-0 p-4 text-white/50 hover:text-white hover:bg-white/10 rounded-full z-20" aria-label="Next panel">
                <ChevronRight size={48} />
              </button>
            )}
          </div>
        </div>
        </EscapeLayer>
      )}

      {/* --- CHAPTER CHARACTERS --- */}
      <Dialog open={showCharacters} onClose={() => setShowCharacters(false)} title="Who is in this chapter" size="lg">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {characters.map((char, idx) => (
            <div key={idx} className="bg-slate-50 border-2 border-black p-4 rounded-xl flex gap-4">
              <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center border-2 border-black flex-shrink-0 font-black text-xl">{char.name.charAt(0)}</div>
              <div>
                <h3 className="font-black text-lg leading-tight">{char.name}</h3>
                <Pill tone="blue">{char.role}</Pill>
                <p className="text-sm mt-2 text-gray-700">{char.description}</p>
              </div>
            </div>
          ))}
        </div>
      </Dialog>

      {/* --- EXPLAIN (Context Booster) --- */}
      <Dialog open={!!explanation} onClose={() => setExplanation(null)} title="Understand this" eyebrow="Context booster" tone="purple" icon={<Lightbulb className="fill-yellow-300 text-yellow-300" size={26} />}>
        {explanation && (
          <>
            <div className="bg-yellow-50 p-4 border-l-4 border-yellow-400 mb-6 italic text-gray-700">“{explanation.targetText}”</div>
            {stats.tier === UserTier.FREE && stats.dailyAiUsage >= TIER_LIMITS[UserTier.FREE].ai && (
              <div className="mb-4 bg-red-100 text-red-800 p-3 rounded text-sm border border-red-200 flex items-center gap-2">
                <Lock size={16} /> Daily limit reached ({stats.dailyAiUsage}/{TIER_LIMITS[UserTier.FREE].ai}).
                <button onClick={() => setShowMembershipModal(true)} className="underline font-bold">Upgrade for more.</button>
              </div>
            )}
            {stats.tier === UserTier.EXPLORER && stats.dailyAiUsage >= TIER_LIMITS[UserTier.EXPLORER].ai && (
              <div className="mb-4 bg-red-100 text-red-800 p-3 rounded text-sm border border-red-200 flex items-center gap-2">
                <Lock size={16} /> Explorer limit reached ({stats.dailyAiUsage}/{TIER_LIMITS[UserTier.EXPLORER].ai}).
                <button onClick={() => setShowMembershipModal(true)} className="underline font-bold">Go unlimited.</button>
              </div>
            )}
            {!explanation.activeType ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {([
                  ['simple', 'Plain words', 'What this says, simply', <Info size={20} className="text-blue-600" />, 'blue'],
                  ['deep', 'Deeper meaning', 'What readers have drawn from it', <Book size={20} className="text-purple-600" />, 'purple'],
                  ['historical', 'History & culture', 'The world it was written in', <User size={20} className="text-amber-600" />, 'amber'],
                  ['word_study', 'Word study', 'Hebrew and Greek behind the words', <Globe size={20} className="text-teal-600" />, 'teal'],
                  ['application', 'For my life', 'How people apply this today', <Sparkles size={20} className="text-green-600" />, 'green'],
                ] as const).map(([type, title, sub, icon, tone]) => (
                  <button
                    key={type}
                    onClick={() => handleFetchExplanation(type)}
                    className={cx('flex items-center gap-3 p-4 border-[3px] border-slate-200 rounded-2xl text-left transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-300', `hover:border-${tone}-500 hover:bg-${tone}-50`, type === 'application' && 'md:col-span-2')}
                  >
                    <span className={`bg-${tone}-100 p-2 rounded-full`}>{icon}</span>
                    <span><span className="block font-black">{title}</span><span className="block text-xs text-gray-500">{sub}</span></span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="animate-fade-in">
                {explanation.loading ? (
                  <Loader text="Thinking…" />
                ) : (
                  <div>
                    <h4 className="font-black text-lg mb-4 capitalize border-b pb-2">{explanation.activeType.replace('_', ' ')}</h4>
                    <p className="text-lg leading-relaxed font-serif text-slate-800 whitespace-pre-line">{explanation.result}</p>
                    <Button variant="ghost" size="sm" className="mt-6 text-purple-700" onClick={() => setExplanation(prev => ({ ...prev!, activeType: '' }))}><ChevronLeft size={16} /> Ask something else</Button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </Dialog>

      {/* --- QUIZ --- */}
      <Dialog
        open={showQuiz && !!quizData}
        onClose={() => setShowQuiz(false)}
        title={`Quiz · ${passageLabel}`}
        eyebrow={quizPick ? (quizPick.set.source === 'generated' ? 'Built from the text · works offline' : 'Comprehension quiz · stored offline') : undefined}
        icon={<Brain size={26} className="text-purple-600" />}
        footer={
          quizData && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-black text-sm">
                {quizAnswered < quizTotal ? `${quizAnswered} of ${quizTotal} answered` : quizScore === quizTotal ? `Perfect · ${quizScore}/${quizTotal}` : `You got ${quizScore} of ${quizTotal}`}
                <span className="text-slate-500 font-bold"> · +20 XP per correct answer</span>
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => handleQuiz(true)}><RefreshCw size={14} /> Another quiz</Button>
                {quizAnswered >= quizTotal && <Button size="sm" variant="primary" onClick={() => setShowQuiz(false)}>Back to reading</Button>}
              </div>
            </div>
          )
        }
      >
        {quizData && (
          <div className="space-y-6" key={quizPick?.set.id ?? 'quiz'}>
            {quizData.questions.map((q, qIdx) => {
              const chosen = quizAnswers[qIdx];
              const answered = chosen != null;
              return (
                <div key={qIdx} className="bg-slate-50 p-5 rounded-2xl border-2 border-slate-200">
                  <h4 className="font-black text-lg mb-3">{qIdx + 1}. {q.question}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2" role="group" aria-label={`Question ${qIdx + 1}`}>
                    {q.options.map((opt, oIdx) => {
                      const isCorrect = oIdx === q.correctAnswer;
                      const isChosen = chosen === oIdx;
                      return (
                        <button
                          key={oIdx}
                          type="button"
                          disabled={answered}
                          aria-pressed={isChosen}
                          onClick={() => answerQuiz(qIdx, oIdx)}
                          className={cx(
                            'text-left p-3 border-[3px] rounded-xl font-bold transition-colors flex items-start gap-2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-300',
                            !answered && 'bg-white border-slate-300 hover:border-purple-500 hover:bg-purple-50',
                            answered && isCorrect && 'bg-green-500 text-white border-green-700',
                            answered && isChosen && !isCorrect && 'bg-red-500 text-white border-red-700',
                            answered && !isChosen && !isCorrect && 'bg-white border-slate-200 text-slate-400',
                          )}
                        >
                          <span className="w-6 h-6 rounded-full border-2 border-current flex items-center justify-center text-[11px] shrink-0">{String.fromCharCode(65 + oIdx)}</span>
                          <span>{opt}</span>
                        </button>
                      );
                    })}
                  </div>
                  {answered && (
                    <div className={cx('mt-3 p-3 rounded-xl text-sm border-2 animate-fade-in', chosen === q.correctAnswer ? 'bg-green-50 border-green-300 text-green-900' : 'bg-amber-50 border-amber-300 text-amber-900')}>
                      <p className="font-black">{chosen === q.correctAnswer ? 'Right.' : `Not quite — it was ${String.fromCharCode(65 + q.correctAnswer)}.`}</p>
                      <p className="mt-1">{q.explanation}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Dialog>

      {/* --- SHARE A VERSE WITH THE CIRCLE (stays on the page) --- */}
      <Dialog
        open={!!shareSelection && !!selectedGroup}
        onClose={() => setShareSelection(null)}
        size="sm"
        eyebrow={selectedGroup ? `To ${selectedGroup.name}` : undefined}
        title={shareSelection?.label ?? ''}
        icon={<Users size={22} className="text-green-600" />}
        footer={
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="secondary" onClick={() => setShareSelection(null)}>Cancel</Button>
            <Button
              size="sm"
              variant="success"
              onClick={() => {
                if (!shareSelection || !selectedGroup) return;
                const clip = (t: string) => (t.length > 160 ? t.slice(0, 160).trim() + '…' : t);
                const quote = shareSelection.companion
                  ? `“${clip(shareSelection.text)}” (${chapterTextSource?.displayName || ''}) · “${clip(shareSelection.companion.text)}” (${shareSelection.companion.name})`
                  : `“${clip(shareSelection.text)}”`;
                const ref: PassagePointer = { tradition, book: selectedBook, chapter: tradition === 'quran' ? 1 : selectedChapter, verses: shareSelection.verses, label: shareSelection.label };
                handleAddReflection(selectedGroup.id, `${shareDraft.trim() ? shareDraft.trim() + ' ' : ''}— ${quote}`, ref);
                setShareSelection(null);
                toast({ title: `Shared ${shareSelection.label} with ${selectedGroup.name}`, description: 'It sits in the circle card beside the text.' });
              }}
            >
              <Send size={14} /> Share
            </Button>
          </div>
        }
      >
        {shareSelection && (
          <div className="space-y-3">
            <blockquote className="bg-amber-50 border-l-4 border-amber-400 px-3 py-2 text-sm italic text-slate-700 max-h-40 overflow-y-auto">
              “{shareSelection.text}”
              {shareSelection.companion && <span className="block mt-1.5 text-xs not-italic text-slate-500"><b>{shareSelection.companion.name}:</b> {shareSelection.companion.text}</span>}
            </blockquote>
            <TextArea
              data-autofocus
              value={shareDraft}
              onChange={e => setShareDraft(e.target.value)}
              placeholder="Why this one? (optional)"
              className="min-h-[72px]"
              onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') (e.currentTarget.closest('[role=dialog]')?.querySelector('button.bg-green-400') as HTMLButtonElement | null)?.click(); }}
            />
          </div>
        )}
      </Dialog>

      {/* --- CHAPTER NOTES --- */}
      <Drawer open={showNotes} onClose={() => setShowNotes(false)} width="md" label="Chapter notes" header={
        <div>
          <p className="comic-font text-2xl leading-none">Chapter notes</p>
          <p className="text-[11px] text-slate-500 font-bold">{passageLabel}</p>
        </div>
      }>
        <div className="flex flex-col h-full gap-3">
          <TextArea
            className="flex-1 min-h-[50vh] text-lg"
            placeholder="What stood out? What do you want to remember?"
            value={currentNote}
            onChange={(e) => setCurrentNote(e.target.value)}
            data-autofocus
          />
          <Button variant="success" block onClick={() => { saveNote(); toast({ title: 'Note saved', description: `Find it under My study → ${passageLabel}.` }); }}><Save size={18} /> Save note</Button>
        </div>
      </Drawer>
    </div>
  );
};

const AppRoot: React.FC = () => (
  <UiProvider>
    <AuthProvider>
      <App />
    </AuthProvider>
  </UiProvider>
);

export default AppRoot;
