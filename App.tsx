
import React, { useState, useEffect, useRef } from 'react';
import { 
  BookOpen, Sparkles, RefreshCw, Download, ChevronRight, ChevronLeft, 
  Trophy, Flame, Bookmark, Brain, X, Save, Edit3, HelpCircle, User,
  PlayCircle, Maximize2, Palette, Info, PauseCircle, Book, Globe, Lightbulb, Heart, Lock, Shield, Crown, Users, Compass, Archive, MapPinned
} from 'lucide-react';
import { generateComicScript, generatePanelImage, generateQuiz, explainText, generateSpeech } from './services/geminiService';
import { ComicPanel } from './components/ComicPanel';
import { Loader } from './components/Loader';
import { DonationBanner } from './components/DonationBanner';
import { MembershipModal } from './components/MembershipModal';
import { UrgentDonationModal } from './components/UrgentDonationModal';
import { MissionModal } from './components/MissionModal';
import { FounderStoryModal } from './components/FounderStoryModal';
import { CharacterLibrary } from './components/CharacterLibrary';
import { Leaderboard } from './components/Leaderboard';
import { GuidedJourneysBoard } from './components/GuidedJourneys';
import { CollaborativeHub } from './components/CollaborativeHub';
import { CharacterBuilder } from './components/CharacterBuilder';
import { OfflinePackManager } from './components/OfflinePackManager';
import { GUIDED_JOURNEYS } from './data/guidedJourneys';
import { 
  ComicPanelData, BibleVersion, BIBLE_BOOKS, FREE_ALLOWED_BOOKS, BOOK_COLLECTIONS, UserStats, 
  QuizResponse, ArtStyle, CharacterProfile, UserTier, TIER_LIMITS, SUPPORTED_LANGUAGES, FREE_VERSIONS, EXPLORER_VERSIONS, FREE_STYLES, EXPLORER_STYLES,
  JourneyProgress, StudyGroup, CustomHero, OfflinePack, CachedChapter, ChapterVerse, TextCatalogEntry, ReaderProfile
} from './types';
import { getCacheKey, loadCachedChapter, saveCachedChapter } from './services/cacheService';
import { loadChapterText, loadTextCatalog } from './services/textLibrary';

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
  profile: 'scriptureComix_readerProfile'
};

const HERO_LIMIT = 3;

const FALLBACK_VERSION_PRIORITY: BibleVersion[] = [
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
  // Reading State
  const [selectedBook, setSelectedBook] = useState('Genesis');
  const [selectedChapter, setSelectedChapter] = useState(1);
  const [version, setVersion] = useState<BibleVersion>(BibleVersion.NIV);
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
  const [dailyChallenge, setDailyChallenge] = useState<{book: string, chapter: number} | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState<{[key: string]: string}>({}); 
  const [currentNote, setCurrentNote] = useState('');
  
  // Modals & Overlays
  const [quizData, setQuizData] = useState<QuizResponse | null>(null);
  const [showQuiz, setShowQuiz] = useState(false);
  const [showMembershipModal, setShowMembershipModal] = useState(false);
  const [showUrgentModal, setShowUrgentModal] = useState(false);
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
  const [journeyProgress, setJourneyProgress] = useState<Record<string, JourneyProgress>>({});
  const [activeJourneyId, setActiveJourneyId] = useState<string | null>(null);
  const [pendingJourneyAction, setPendingJourneyAction] = useState<{ journeyId: string; chapterIndex: number } | null>(null);
  const [studyGroups, setStudyGroups] = useState<StudyGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [pendingGroupSync, setPendingGroupSync] = useState<{ groupId: string } | null>(null);
  const [profile, setProfile] = useState<ReaderProfile>({
    displayName: 'Pilgrim',
    faithTradition: 'Curious',
    exploreLevel: 'Medium'
  });

  // Custom Heroes
  const [customHeroes, setCustomHeroes] = useState<CustomHero[]>([]);
  const [activeHeroIds, setActiveHeroIds] = useState<string[]>([]);

  // Offline Packs
  const [offlinePacks, setOfflinePacks] = useState<OfflinePack[]>([]);

  // Native Text Library
  const [chapterText, setChapterText] = useState<ChapterVerse[] | null>(null);
  const [chapterTextSource, setChapterTextSource] = useState<TextCatalogEntry | null>(null);
  const [isChapterTextLoading, setIsChapterTextLoading] = useState(false);
  const [chapterTextError, setChapterTextError] = useState<string | null>(null);

  // UI Overlays
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [localVersionSet, setLocalVersionSet] = useState<Set<BibleVersion>>(new Set());

  // --- INIT & PERSISTENCE ---
  useEffect(() => {
    const savedStats = localStorage.getItem(STORAGE_KEYS.stats);
    if (savedStats) {
      const parsed = JSON.parse(savedStats);
      if (!parsed.tier) parsed.tier = UserTier.FREE;
      if (typeof parsed.dailyAiUsage === 'undefined') parsed.dailyAiUsage = 0;
      setStats(parsed);
    }
    const savedNotes = localStorage.getItem(STORAGE_KEYS.notes);
    if (savedNotes) setNotes(JSON.parse(savedNotes));
    const savedJourneys = localStorage.getItem(STORAGE_KEYS.journeys);
    if (savedJourneys) setJourneyProgress(JSON.parse(savedJourneys));
    const savedActiveJourney = localStorage.getItem(STORAGE_KEYS.activeJourney);
    if (savedActiveJourney) setActiveJourneyId(savedActiveJourney);
    const savedGroups = localStorage.getItem(STORAGE_KEYS.groups);
    if (savedGroups) setStudyGroups(JSON.parse(savedGroups));
    const savedHeroes = localStorage.getItem(STORAGE_KEYS.heroes);
    if (savedHeroes) setCustomHeroes(JSON.parse(savedHeroes));
    const savedActiveHeroes = localStorage.getItem(STORAGE_KEYS.activeHeroes);
    if (savedActiveHeroes) setActiveHeroIds(JSON.parse(savedActiveHeroes));
    const savedOfflinePacks = localStorage.getItem(STORAGE_KEYS.offline);
    if (savedOfflinePacks) setOfflinePacks(JSON.parse(savedOfflinePacks));
    const savedProfile = localStorage.getItem(STORAGE_KEYS.profile);
    if (savedProfile) {
      try {
        const parsed = JSON.parse(savedProfile);
        if (parsed.displayName) {
          setProfile({
            displayName: parsed.displayName,
            faithTradition: parsed.faithTradition || 'Curious',
            exploreLevel: parsed.exploreLevel || 'Medium'
          });
        }
      } catch {
        // ignore old shape
      }
    }
    
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
      
      localStorage.setItem(STORAGE_KEYS.stats, JSON.stringify(updated));
      return updated;
    });

    const randomBook = BIBLE_BOOKS[Math.floor(Math.random() * 50)]; // Limit random to standard books roughly
    const randomChapter = Math.floor(Math.random() * 20) + 1;
    setDailyChallenge({ book: randomBook, chapter: randomChapter });

    // --- URGENT DONATION MODAL LOGIC (FIRST VISIT) ---
    const hasSeenDonation = localStorage.getItem('scriptureComix_hasSeenUrgentDonation');
    if (!hasSeenDonation) {
       setTimeout(() => {
          const s = JSON.parse(localStorage.getItem(STORAGE_KEYS.stats) || '{}');
          if (!s.tier || s.tier === UserTier.FREE) {
            setShowUrgentModal(true);
            localStorage.setItem('scriptureComix_hasSeenUrgentDonation', 'true');
          }
       }, 2500);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.notes, JSON.stringify(notes));
  }, [notes]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.journeys, JSON.stringify(journeyProgress));
  }, [journeyProgress]);

  useEffect(() => {
    if (activeJourneyId) {
      localStorage.setItem(STORAGE_KEYS.activeJourney, activeJourneyId);
    } else {
      localStorage.removeItem(STORAGE_KEYS.activeJourney);
    }
  }, [activeJourneyId]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.groups, JSON.stringify(studyGroups));
  }, [studyGroups]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.heroes, JSON.stringify(customHeroes));
  }, [customHeroes]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.activeHeroes, JSON.stringify(activeHeroIds));
  }, [activeHeroIds]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.offline, JSON.stringify(offlinePacks));
  }, [offlinePacks]);

  useEffect(() => {
    if (profile.displayName.trim()) {
      localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(profile));
    } else {
      localStorage.removeItem(STORAGE_KEYS.profile);
    }
  }, [profile]);

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

  useEffect(() => {
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
    loadChapterText(version, selectedBook, selectedChapter)
      .then(result => {
        if (cancelled) return;
        if (result) {
          setChapterText(result.verses);
          setChapterTextSource(result.entry);
          setChapterTextError(null);
        } else {
          setChapterText(null);
          setChapterTextSource(null);
          setChapterTextError('This translation is not cached locally yet.');
        }
      })
      .catch(err => {
        console.warn('Chapter text load failed', err);
        if (cancelled) return;
        setChapterText(null);
        setChapterTextSource(null);
        setChapterTextError('Unable to load native text.');
      })
      .finally(() => {
        if (!cancelled) setIsChapterTextLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedBook, selectedChapter, version]);

  // --- MONETIZATION HANDLERS ---
  const handleDonation = (amount: number, isMonthly: boolean) => {
    // In real app, trigger Stripe.
    const newTier = (isMonthly && amount >= 5) ? UserTier.EXPLORER : UserTier.FREE;
    if (amount >= 5) {
       handleUpgrade(UserTier.EXPLORER);
    } else {
       alert("Thank you for your support! You are helping us stay online.");
       setShowUrgentModal(false);
    }
  };

  const handleUpgrade = (tier: UserTier) => {
    const newStats = { ...stats, tier };
    setStats(newStats);
    localStorage.setItem(STORAGE_KEYS.stats, JSON.stringify(newStats));
    setShowMembershipModal(false);
    alert(`Welcome to ${tier}! Thank you for your support.`);
  };

  const checkFeatureLock = (feature: 'art' | 'book' | 'version' | 'ai' | 'download' | 'language', value?: any): boolean => {
    const tier = stats.tier;

    // 1. BOOKS LOCKING
    if (feature === 'book') {
      // Free users can access standard canon AND specific free lost books
      if (tier === UserTier.FREE) {
         if (FREE_ALLOWED_BOOKS.includes(value)) return true;
         setShowMembershipModal(true);
         return false;
      }
      // Explorer and Scholar get EVERYTHING
      return true;
    }

    // 2. TRANSLATIONS / VERSIONS
    if (feature === 'version') {
      if (tier === UserTier.FREE) {
        if (FREE_VERSIONS.includes(value)) return true;
        setShowMembershipModal(true);
        return false;
      }
      if (tier === UserTier.EXPLORER) {
        if (EXPLORER_VERSIONS.includes(value)) return true;
        setShowMembershipModal(true);
        return false;
      }
      return true; // Scholar gets all
    }

    // 3. ART STYLES
    if (feature === 'art') {
      if (tier === UserTier.FREE) {
         if (FREE_STYLES.includes(value)) return true;
         setShowMembershipModal(true);
         return false;
      }
      if (tier === UserTier.EXPLORER) {
        if (EXPLORER_STYLES.includes(value)) return true;
        setShowMembershipModal(true);
        return false;
      }
      return true; // Scholar gets all
    }

    // 4. AI USAGE
    if (feature === 'ai') {
       const limit = TIER_LIMITS[tier]?.ai || 20;
       if (stats.dailyAiUsage < limit) {
         const newStats = { 
           ...stats, 
           dailyAiUsage: stats.dailyAiUsage + 1,
           lastAiUsageDate: new Date().toISOString()
         };
         setStats(newStats);
        localStorage.setItem(STORAGE_KEYS.stats, JSON.stringify(newStats));
         return true;
       }
       setShowMembershipModal(true);
       return false;
    }

    // 5. DOWNLOAD PDF
    if (feature === 'download') {
      if (tier === UserTier.SCHOLAR) return true;
      setShowMembershipModal(true);
      return false;
    }

    // 6. LANGUAGES
    if (feature === 'language') {
      if (tier === UserTier.SCHOLAR) return true;
      if (value === 'English') return true;
      // Maybe Explorer gets a few, but Scholar gets ALL. 
      // For now, let's keep languages open for Explorer or just Scholar.
      // Prompt says Scholar gets "ALL Languages".
      if (tier === UserTier.EXPLORER) return true; // Let Explorer try langs for now to add value
      if (tier === UserTier.FREE) {
         setShowMembershipModal(true);
         return false;
      }
    }

    return true;
  };

  const awardXp = (amount: number) => {
    if (!amount) return;
    setStats(prev => {
      const updated = { ...prev, xp: prev.xp + amount };
      localStorage.setItem(STORAGE_KEYS.stats, JSON.stringify(updated));
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
    setSelectedBook(chapter.book);
    setSelectedChapter(chapter.chapter);
    handleGenerate(undefined, { book: chapter.book, chapter: chapter.chapter });
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
        alert(`Journey completed! You earned the ${journey.badge} badge.`);
      }
      return merged;
    });
    const reward = journey.chapters[chapterIndex]?.xpReward || 0;
    awardXp(reward);
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
      localStorage.setItem(STORAGE_KEYS.stats, JSON.stringify(updated));
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

  const generateGroupCode = () => {
    if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
      const bytes = new Uint8Array(4);
      crypto.getRandomValues(bytes);
      return Array.from(bytes)
        .map(b => (b % 36).toString(36))
        .join('')
        .toUpperCase()
        .slice(0, 6);
    }
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const handleCreateGroup = (name: string, focus: string) => {
    const alias = profile.displayName.trim() || 'You';
    const newGroup: StudyGroup = {
      id: `group-${Date.now()}`,
      name,
      focus,
      code: generateGroupCode(),
      members: [alias, 'Guest Chaplain'],
      createdAt: new Date().toISOString(),
      reflections: [{
        id: `reflection-${Date.now()}`,
        author: 'System',
        text: `${alias} launched this circle.`,
        createdAt: new Date().toISOString()
      }]
    };
    setStudyGroups(prev => [...prev, newGroup]);
    setSelectedGroupId(newGroup.id);
  };

  const handleSelectGroup = (groupId: string) => {
    setSelectedGroupId(groupId);
    const group = studyGroups.find(g => g.id === groupId);
    if (group?.targetBook && group.targetChapter) {
      setSelectedBook(group.targetBook);
      setSelectedChapter(group.targetChapter);
    }
  };

  const handleJoinGroup = (code: string) => {
    const alias = profile.displayName.trim() || 'You';
    const existing = studyGroups.find(group => group.code === code);
    if (existing) {
      setSelectedGroupId(existing.id);
      if (!existing.members.includes(alias)) {
        setStudyGroups(prev => prev.map(group => group.id === existing.id ? { ...group, members: [...group.members, alias] } : group));
      }
      return;
    }
    const remoteGroup: StudyGroup = {
      id: `group-${Date.now()}`,
      name: `Partner Hub ${code}`,
      focus: 'Remote collaboration',
      code,
      members: [alias, 'Remote Host'],
      createdAt: new Date().toISOString(),
      reflections: [{
        id: `reflection-${Date.now()}`,
        author: 'Remote Host',
        text: `Welcome ${alias}! Drop your insights any time.`,
        createdAt: new Date().toISOString()
      }]
    };
    setStudyGroups(prev => [...prev, remoteGroup]);
    setSelectedGroupId(remoteGroup.id);
  };

  const handleSetGroupTarget = (groupId: string, book: string, chapter: number) => {
    setStudyGroups(prev => prev.map(group => group.id === groupId ? { ...group, targetBook: book, targetChapter: chapter } : group));
    setSelectedBook(book);
    setSelectedChapter(chapter);
    setPendingGroupSync({ groupId });
    handleGenerate(undefined, { book, chapter });
  };

  const handleAddReflection = (groupId: string, text: string) => {
    const alias = profile.displayName.trim() || 'You';
    const entry = { id: `reflection-${Date.now()}`, author: alias, text, createdAt: new Date().toISOString() };
    setStudyGroups(prev => prev.map(group => group.id === groupId ? { ...group, reflections: [...group.reflections, entry] } : group));
    awardXp(25);
  };

  const handleLeaveGroup = (groupId: string) => {
    const alias = profile.displayName.trim() || 'You';
    setStudyGroups(prev => prev
      .map(group => group.id === groupId ? { ...group, members: group.members.filter(m => m !== alias) } : group)
      .filter(group => group.members.length > 0));
    if (selectedGroupId === groupId) setSelectedGroupId(null);
  };

  const acknowledgeGroupSync = (groupId: string) => {
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
        alert(`Hero saved! You can keep ${HERO_LIMIT} heroes active at once—deactivate one to spotlight ${newHero.name}.`);
        return prev;
      }
      return [...prev, newHero.id];
    });
  };

  const handleToggleHero = (heroId: string) => {
    setActiveHeroIds(prev => {
      if (prev.includes(heroId)) return prev.filter(id => id !== heroId);
      if (prev.length >= HERO_LIMIT) {
        alert(`You can only keep ${HERO_LIMIT} heroes active for story generation.`);
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
    alert('Offline pack loaded. Images use cached data URIs.');
  };

  const handleDeleteOfflinePack = (packId: string) => {
    setOfflinePacks(prev => prev.filter(pack => pack.id !== packId));
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

  const handleBookChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const book = e.target.value;
    if (checkFeatureLock('book', book)) {
      setSelectedBook(book);
    }
  };

  const handleVersionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value as BibleVersion;
    if (!localVersionSet.has(v)) {
      const fallback = findFallbackVersion(localVersionSet);
      if (version !== fallback) {
        setVersion(fallback);
      }
      return;
    }
    if (checkFeatureLock('version', v)) {
      setVersion(v);
    }
  };

  const handleArtStyleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const s = e.target.value as ArtStyle;
    if (checkFeatureLock('art', s)) {
      setArtStyle(s);
    }
  };

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const l = e.target.value;
    if (checkFeatureLock('language', l)) {
      setLanguage(l);
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
    const bookToUse = override?.book || selectedBook;
    const chapterToUse = override?.chapter || selectedChapter;
    
    if (!checkFeatureLock('book', bookToUse)) return;

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
    const cacheKey = getCacheKey(bookToUse, chapterToUse, version, language, artStyle);

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
      // Prefer native text when available
      const localText = await loadChapterText(version, bookToUse, chapterToUse);

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
          title: `${bookToUse} ${chapterToUse}`,
          summary: '',
          lifeApplication: '',
          characters: [],
          panels: generatedPanels,
          updatedAt: new Date().toISOString(),
        };

        applyChapterResult(payload);
        if (canUseCache) {
          saveCachedChapter(payload);
        }
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

  const handleQuiz = async () => {
    if (quizData) { setShowQuiz(true); return; }
    setIsGeneratingScript(true);
    try {
      const q = await generateQuiz(selectedBook, selectedChapter);
      setQuizData(q);
      setShowQuiz(true);
    } catch (e) { alert("Could not create quiz."); } finally { setIsGeneratingScript(false); }
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
    localStorage.setItem(STORAGE_KEYS.stats, JSON.stringify({ ...stats, bookmarks: newBookmarks }));
  };

  const saveNote = () => {
    const key = `${selectedBook} ${selectedChapter}`;
    setNotes(prev => ({ ...prev, [key]: currentNote }));
    setShowNotes(false);
  };

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

  return (
    <div className="min-h-screen pb-20 bg-yellow-50 font-sans">
      
      {/* --- DONATION BANNER --- */}
      {!isPaid && (
        <DonationBanner onDonate={() => setShowUrgentModal(true)} />
      )}

      {/* --- FLOATING HEART BUTTON --- */}
      {!isPaid && (
        <button 
          onClick={() => setShowUrgentModal(true)}
          className="fixed bottom-6 right-6 z-40 bg-red-600 text-white p-3 rounded-full shadow-xl hover:scale-110 transition-transform border-4 border-white animate-bounce-slow print:hidden"
          title="Support the Mission"
        >
          <Heart fill="currentColor" size={24} />
        </button>
      )}

      {/* --- MODALS --- */}
      {showUrgentModal && <UrgentDonationModal onClose={() => setShowUrgentModal(false)} onDonate={handleDonation} />}
      {showMembershipModal && <MembershipModal currentTier={stats.tier} onClose={() => setShowMembershipModal(false)} onUpgrade={handleUpgrade} />}
      {showMissionModal && <MissionModal onClose={() => setShowMissionModal(false)} />}
      {showFounderModal && <FounderStoryModal onClose={() => setShowFounderModal(false)} onDonate={() => { setShowFounderModal(false); setShowUrgentModal(true); }} />}
      {showCharacterLibrary && <CharacterLibrary onClose={() => setShowCharacterLibrary(false)} tier={stats.tier} onUpgrade={() => setShowMembershipModal(true)} currentBook={selectedBook} />}
      {showOfflineManager && (
        <OfflinePackManager
          packs={offlinePacks}
          onClose={() => setShowOfflineManager(false)}
          onLoad={handleLoadOfflinePack}
          onDelete={handleDeleteOfflinePack}
          onExport={handleExportOfflinePack}
        />
      )}
      {showLeaderboard && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowLeaderboard(false)}
          ></div>
          <div className="relative bg-white w-full max-w-xl rounded-3xl border-4 border-black shadow-[14px_14px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white border-b-4 border-black">
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Community</p>
                <h2 className="comic-font text-2xl">Streak Leaderboard</h2>
              </div>
              <button onClick={() => setShowLeaderboard(false)} className="text-white/70 hover:text-white">
                <X size={24} />
              </button>
            </div>
            <div className="p-4">
              <Leaderboard profile={profile} stats={stats} />
            </div>
          </div>
        </div>
      )}

      {/* --- HERO DASHBOARD --- */}
      <div className="bg-slate-900 text-white print:hidden">
        <div className="container mx-auto max-w-6xl p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
               <div className="bg-yellow-400 p-2 border-2 border-white rounded transform -rotate-2">
                 <BookOpen className="text-black" size={24} />
               </div>
               <div>
                 <h1 className="text-2xl font-black italic tracking-wider text-yellow-400">SCRIPTURE<span className="text-white">COMIX</span></h1>
                 <div className="flex flex-wrap items-center gap-2">
                   <p className="text-xs text-gray-400 uppercase tracking-widest flex items-center gap-2">
                      Interactive Bible Adventures 
                      {stats.tier !== UserTier.FREE && (
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] flex items-center gap-1 shadow-glow animate-pulse ${stats.tier === UserTier.SCHOLAR ? 'bg-yellow-500 text-black' : 'bg-blue-500 text-white'}`}>
                          {stats.tier === UserTier.SCHOLAR ? <Crown size={10} fill="currentColor"/> : <Compass size={10} fill="currentColor"/>} 
                          {stats.tier}
                        </span>
                      )}
                   </p>
                   <button onClick={() => setShowMissionModal(true)} className="text-[10px] bg-slate-800 hover:bg-slate-700 px-2 py-0.5 rounded text-gray-300 border border-slate-600">Our Mission</button>
                   <button onClick={() => setShowFounderModal(true)} className="text-[10px] bg-slate-800 hover:bg-slate-700 px-2 py-0.5 rounded text-gray-300 border border-slate-600 flex items-center gap-1"><User size={10}/> About Founder</button>
                   <button onClick={() => setShowCharacterLibrary(true)} className="text-[10px] bg-purple-900 hover:bg-purple-800 text-purple-100 px-2 py-0.5 rounded border border-purple-700 flex items-center gap-1"><Users size={10}/> Character Library</button>
                 </div>
               </div>
            </div>
            <div className="flex items-center gap-4 bg-slate-800 p-2 rounded-lg border border-slate-700">
               {/* Language Selector in Header */}
               <div className="flex items-center gap-2 px-3 border-r border-slate-600">
                  <Globe size={16} className="text-blue-400" />
                  <select 
                    value={language} 
                    onChange={handleLanguageChange} 
                    className="bg-transparent text-sm font-bold outline-none text-white max-w-[80px]"
                  >
                    {SUPPORTED_LANGUAGES.map(lang => (
                      <option key={lang} value={lang} className="text-black">{lang}</option>
                    ))}
                  </select>
               </div>

               <div className="flex items-center gap-2 px-3 border-r border-slate-600" title="Daily Streak">
                  <Flame className="text-orange-500 fill-orange-500" size={20} />
                  <div><span className="text-lg font-bold">{stats.streak}</span><span className="text-[10px] text-gray-400 block uppercase">Day Streak</span></div>
               </div>
               <div className="flex items-center gap-2 px-3 border-r border-slate-600" title="Spirit Power (XP)">
                  <Sparkles className="text-purple-400" size={20} />
                  <div><span className="text-lg font-bold">{stats.xp}</span><span className="text-[10px] text-gray-400 block uppercase">XP</span></div>
               </div>
               <div className="flex items-center gap-2 px-3" title="Chapters Read">
                  <Trophy className="text-yellow-400" size={20} />
                  <div><span className="text-lg font-bold">{stats.chaptersRead}</span><span className="text-[10px] text-gray-400 block uppercase">Chapters</span></div>
               </div>
               <button
                 onClick={() => setShowLeaderboard(true)}
                 className="hidden md:flex items-center gap-1 px-3 py-1 bg-slate-700 text-xs uppercase tracking-[0.25em] rounded-full border border-slate-500 hover:bg-slate-600"
                 title="View streak leaderboard"
               >
                 <Trophy size={14} className="text-yellow-300" /> Board
               </button>
               {stats.tier === UserTier.SCHOLAR && (
                 <button
                   onClick={() => setShowOfflineManager(true)}
                   className="flex items-center gap-2 px-3 py-1 bg-yellow-400 text-black font-black rounded border-2 border-black text-xs uppercase tracking-widest hover:bg-yellow-300"
                 >
                   <Archive size={14} /> Offline {offlinePacks.length}
                 </button>
               )}
            </div>
          </div>
          {dailyChallenge && (
            <div className="mt-4 bg-gradient-to-r from-blue-900 to-slate-800 p-3 rounded border border-blue-700 flex items-center justify-between">
               <div className="flex items-center gap-3">
                 <div className="bg-blue-500 p-1 rounded text-xs font-bold uppercase">Daily Quest</div>
                 <p className="text-sm">Read <span className="font-bold text-yellow-300">{dailyChallenge.book} Chapter {dailyChallenge.chapter}</span> for +100 XP</p>
               </div>
               <button onClick={() => { setSelectedBook(dailyChallenge.book); setSelectedChapter(dailyChallenge.chapter); handleGenerate(undefined, dailyChallenge); }} className="text-xs bg-white text-blue-900 px-3 py-1 rounded font-bold hover:bg-blue-100 transition-colors">ACCEPT</button>
            </div>
          )}
          {activeJourney && activeJourneyProgress && (
            <div className="mt-4 bg-white text-slate-900 p-4 rounded-2xl border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,0.7)] flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="bg-slate-900 text-white p-2 rounded-full border-2 border-black">
                  <MapPinned size={20} />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Journey Active</p>
                  <h4 className="comic-font text-2xl">{activeJourney.title}</h4>
                  <p className="text-sm text-slate-600">
                    {journeyComplete
                      ? 'All checkpoints cleared—replay to keep the badge glowing.'
                      : nextJourneyChapter
                        ? `Next: ${nextJourneyChapter.book} ${nextJourneyChapter.chapter} (${nextJourneyChapter.focus})`
                        : 'Choose any checkpoint from the grid below.'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 flex-wrap">
                <div className="w-44">
                  <div className="h-2 bg-slate-100 rounded-full border border-slate-200 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-yellow-300 via-orange-400 to-red-500" style={{ width: `${activeJourneyPercent}%` }}></div>
                  </div>
                  <p className="text-xs font-bold text-slate-500 mt-1">{activeJourneyPercent}% complete</p>
                </div>
                {journeyComplete ? (
                  <button
                    onClick={() => {
                      handleJourneyReset(activeJourney.id);
                      handleJourneyStartAndLaunch(activeJourney.id);
                    }}
                    className="px-4 py-2 bg-yellow-400 text-black font-black rounded-full border-2 border-black uppercase tracking-widest text-xs hover:bg-yellow-300"
                  >
                    Replay Journey
                  </button>
                ) : nextJourneyChapter ? (
                  <button
                    onClick={() => triggerJourneyChapter(activeJourney.id, nextJourneyChapterIndex)}
                    className="px-4 py-2 bg-slate-900 text-white font-black rounded-full border-2 border-black uppercase tracking-widest text-xs hover:bg-slate-800"
                  >
                    Continue Journey
                  </button>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* --- MAIN CONTROLS --- */}
      <header className="sticky top-0 z-40 bg-white border-b-4 border-black shadow-md print:hidden">
        <div className="container mx-auto max-w-6xl p-3 flex flex-col xl:flex-row items-center justify-between gap-3">
          <div className="flex flex-wrap items-center justify-center gap-2 w-full xl:w-auto">
             
             {/* BOOK SELECTOR (GROUPED) */}
             <select value={selectedBook} onChange={handleBookChange} className="px-2 py-2 border-2 border-black font-bold focus:bg-yellow-100 rounded bg-gray-50 max-w-[200px]">
                {Object.entries(BOOK_COLLECTIONS).map(([group, books]) => (
                   <optgroup key={group} label={group}>
                      {books.map(b => {
                        // Logic: Free users can access FREE_ALLOWED_BOOKS. Explorer+ access ALL.
                        const isLocked = stats.tier === UserTier.FREE && !FREE_ALLOWED_BOOKS.includes(b);
                        return <option key={b} value={b}>{isLocked ? `🔒 ${b}` : b}</option>
                      })}
                   </optgroup>
                ))}
             </select>

             <div className="flex items-center border-2 border-black rounded bg-white">
               <button onClick={() => setSelectedChapter(c => Math.max(1, c - 1))} className="px-2 py-2 hover:bg-gray-100 border-r-2 border-black"><ChevronLeft size={18} /></button>
               <div className="px-4 font-black text-lg min-w-[3rem] text-center">{selectedChapter}</div>
               <button onClick={() => setSelectedChapter(c => c + 1)} className="px-2 py-2 hover:bg-gray-100 border-l-2 border-black"><ChevronRight size={18} /></button>
             </div>
              
              {/* VERSION SELECTOR */}
              <select value={version} onChange={handleVersionChange} className="px-2 py-2 border-2 border-black font-bold bg-gray-50 text-sm rounded max-w-[120px]">
                 {Object.values(BibleVersion).map(v => {
                    let locked = false;
                    if (stats.tier === UserTier.FREE && !FREE_VERSIONS.includes(v)) locked = true;
                    if (stats.tier === UserTier.EXPLORER && !EXPLORER_VERSIONS.includes(v)) locked = true;
                    const labelBase = locked ? `🔒 ${v}` : v;
                    const label = localVersionSet.has(v) ? labelBase : `${labelBase} (not installed)`;
                    return <option key={v} value={v}>{label}</option>;
                 })}
              </select>
              
              {/* ART STYLE SELECTOR */}
              <div className="flex items-center gap-1 border-2 border-purple-500 rounded bg-purple-50 px-2 py-1 relative">
                 <Palette size={16} className="text-purple-600"/>
                 <select 
                    value={artStyle} 
                    onChange={handleArtStyleChange} 
                    className="bg-transparent font-bold text-sm text-purple-900 outline-none w-24 md:w-auto relative z-0"
                 >
                    {Object.values(ArtStyle).map(s => {
                       let locked = false;
                       if (stats.tier === UserTier.FREE && !FREE_STYLES.includes(s)) locked = true;
                       if (stats.tier === UserTier.EXPLORER && !EXPLORER_STYLES.includes(s)) locked = true;
                       return <option key={s} value={s}>{locked ? `🔒 ${s}` : s}</option>;
                    })}
                 </select>
              </div>
          </div>
          <div className="flex gap-2 w-full md:w-auto justify-center">
             <button onClick={(e) => handleGenerate(e)} disabled={isGeneratingScript} className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-6 border-2 border-black uppercase tracking-wider shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none transition-all flex items-center gap-2 disabled:opacity-50">
              {isGeneratingScript ? <RefreshCw className="animate-spin" size={20} /> : "GENERATE COMIC"}
            </button>
          </div>
        </div>
      </header>

      {/* --- JOURNEYS & COMMUNITY --- */}
      <section className="container mx-auto max-w-6xl px-4 md:px-8 py-8 space-y-6 print:hidden">
        <GuidedJourneysBoard
          journeys={GUIDED_JOURNEYS}
          progressMap={journeyProgress}
          activeJourneyId={activeJourneyId}
          onStart={handleJourneyStartAndLaunch}
          onResume={handleJourneyResume}
          onJumpToChapter={triggerJourneyChapter}
          onAbandon={handleJourneyReset}
        />
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <CollaborativeHub
            groups={studyGroups}
            selectedGroupId={selectedGroupId}
            displayName={profile.displayName}
            onCreate={handleCreateGroup}
            onJoin={handleJoinGroup}
            onSelect={handleSelectGroup}
            onSetTarget={handleSetGroupTarget}
            onAddReflection={handleAddReflection}
            onLeave={handleLeaveGroup}
            onDisplayNameChange={(name) => setProfile(prev => ({ ...prev, displayName: name }))}
          />
          <CharacterBuilder
            heroes={customHeroes}
            activeHeroIds={activeHeroIds}
            onCreate={handleCreateHero}
            onToggle={handleToggleHero}
            onDelete={handleDeleteHero}
          />
        </div>
      </section>

      {/* --- MAIN CONTENT --- */}
      <main className="container mx-auto max-w-6xl p-4 md:p-8 min-h-[60vh]">
        {error && <div className="bg-red-100 border-l-8 border-red-600 p-6 mb-8 rounded shadow text-red-700 font-bold">{error}</div>}

        {!isGeneratingScript && panels.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-20 text-center opacity-60">
             <div className="bg-white p-8 rounded-full border-4 border-dashed border-gray-300 mb-6"><BookOpen size={64} className="text-gray-300" /></div>
             <h2 className="comic-font text-4xl text-gray-400 mb-2">Ready to Read?</h2>
             <p className="text-gray-500 max-w-md">Select a book, chapter, and art style above.</p>
          </div>
        )}

        {isGeneratingScript && <div className="flex flex-col items-center justify-center py-20"><Loader text={`Visualizing ${selectedBook} ${selectedChapter}...`} /></div>}

        {panels.length > 0 && !isGeneratingScript && (
          <div className="animate-fade-in pb-10">
            {/* Title & Toolbar */}
            <div className="text-center mb-12 mt-4 relative">
               <div className="absolute top-0 right-0 flex gap-2 print:hidden z-10">
                 {/* STORY MODE BUTTON */}
                 <button 
                    onClick={() => {
                        setStoryModeIndex(0);
                    }} 
                    className="p-2 bg-blue-500 text-white border-2 border-black rounded shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-blue-600 relative group" 
                    title="Story Mode (Movie)"
                 >
                    <Maximize2 size={20} />
                 </button>
                 
                 {characters.length > 0 && (
                   <button onClick={() => setShowCharacters(true)} className="p-2 bg-pink-100 text-pink-900 border-2 border-black rounded shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-pink-200" title="Chapter Characters"><User size={20} /></button>
                 )}
                 <button onClick={toggleBookmark} className={`p-2 border-2 border-black rounded shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${isBookmarked ? 'bg-yellow-400' : 'bg-white hover:bg-gray-100'}`} title="Bookmark"><Bookmark size={20} fill={isBookmarked ? "black" : "none"} /></button>
                 <button onClick={() => setShowNotes(true)} className="p-2 bg-white border-2 border-black rounded shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-100" title="Notes"><Edit3 size={20} /></button>
                 <button onClick={handleQuiz} className="p-2 bg-purple-100 border-2 border-black rounded shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-purple-200 text-purple-900" title="Quiz"><Brain size={20} /></button>
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

            {/* Panels Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 print:block print:columns-2">
              {panels.map((panel, idx) => (
                <div key={panel.id} className="print:mb-8 print:break-inside-avoid">
                  <ComicPanel data={panel} index={idx} onExplain={handleOpenExplain} />
                </div>
              ))}
            </div>

            {/* Life Application Section */}
            {lifeApplication && (
               <div className="mt-16 bg-blue-50 border-4 border-black p-8 rounded-xl shadow-[8px_8px_0px_0px_#1e3a8a] relative print:break-inside-avoid">
                  <div className="absolute -top-6 left-10 bg-blue-800 text-white px-4 py-2 border-2 border-black font-bold uppercase tracking-widest text-lg rotate-1">
                     Why This Matters Today
                  </div>
                  <p className="text-xl font-medium leading-relaxed font-serif text-blue-900 mt-4">
                     {lifeApplication}
                  </p>
               </div>
            )}

            {/* Bottom Actions */}
            <div className="mt-16 flex flex-col items-center gap-6 print:hidden">
               <button onClick={handleQuiz} className="bg-purple-600 text-white font-black py-4 px-10 rounded-full border-4 border-black hover:bg-purple-500 transition-transform hover:scale-105 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] uppercase text-xl flex items-center gap-3">
                  <Brain size={24} /> Test Your Knowledge
               </button>
               <div className="flex gap-4">
                  <button onClick={handleDownload} className="bg-white px-4 py-2 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] font-bold flex items-center gap-2 hover:bg-gray-50 relative">
                    <Download size={18} /> Save PDF
                    {stats.tier !== UserTier.SCHOLAR && <div className="absolute -top-2 -right-2 bg-slate-900 text-white rounded-full p-1"><Lock size={10}/></div>}
                  </button>
                  {stats.tier === UserTier.SCHOLAR && (
                    <button onClick={handleSaveOfflinePack} className="bg-slate-900 text-white px-4 py-2 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] font-bold flex items-center gap-2 hover:bg-slate-800">
                      <Archive size={18} /> Save Offline Pack
                    </button>
                  )}
                  <button onClick={() => { setSelectedChapter(c => c + 1); window.scrollTo(0,0); }} className="bg-yellow-400 px-6 py-2 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] font-bold flex items-center gap-2 hover:bg-yellow-300">Next Chapter <ChevronRight size={18} /></button>
               </div>
            </div>
          </div>
        )}
      </main>

      {/* --- STORY MODE OVERLAY --- */}
      {storyModeIndex !== null && panels.length > 0 && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4">
           {/* Top Controls */}
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
                     {isStoryPlaying ? <><PauseCircle size={20}/> Playing...</> : <><PlayCircle size={20}/> Play Movie</>}
                  </button>
                  <button onClick={() => { setIsStoryPlaying(false); setStoryModeIndex(null); }} className="text-white hover:text-red-400 p-2"><X size={32}/></button>
              </div>
           </div>
           
           <div className="flex-grow flex items-center justify-center w-full max-w-5xl relative">
              {/* Prev Button */}
              {storyModeIndex > 0 && (
                <button 
                  onClick={() => { setIsStoryPlaying(false); setStoryModeIndex(i => i! - 1); }} 
                  className="absolute left-0 p-4 text-white/50 hover:text-white hover:bg-white/10 rounded-full z-20"
                >
                  <ChevronLeft size={48} />
                </button>
              )}

              {/* Main Card */}
              <div className="w-full max-h-[85vh] bg-white rounded-lg overflow-hidden flex flex-col shadow-2xl animate-fade-in duration-500">
                 <div className="bg-yellow-100 p-6 border-b-2 border-black text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-2 h-full bg-red-500"></div>
                    <p className="font-comic font-bold text-xl md:text-3xl text-slate-900 leading-snug">
                       {panels[storyModeIndex].narrative}
                    </p>
                 </div>
                 
                 <div className="flex-grow bg-slate-900 flex items-center justify-center overflow-hidden relative">
                    {panels[storyModeIndex].isLoadingImage ? (
                        <div className="text-white comic-font text-2xl animate-pulse">Painting Scene...</div>
                    ) : (
                        <img 
                          src={panels[storyModeIndex].imageUrl} 
                          className="max-h-full max-w-full object-contain shadow-lg" 
                          alt="Scene"
                        />
                    )}
                    {/* Verse overlay */}
                    <div className="absolute bottom-4 right-4 bg-black/70 text-white px-3 py-1 rounded text-xs font-bold uppercase backdrop-blur-sm">
                       {panels[storyModeIndex].verseReference}
                    </div>
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
                    ) : <p className="text-gray-400 italic text-center py-4">...Visual Scene...</p>}
                 </div>
              </div>

              {/* Next Button */}
              {storyModeIndex < panels.length - 1 && (
                <button 
                  onClick={() => { setIsStoryPlaying(false); setStoryModeIndex(i => i! + 1); }} 
                  className="absolute right-0 p-4 text-white/50 hover:text-white hover:bg-white/10 rounded-full z-20"
                >
                  <ChevronRight size={48} />
                </button>
              )}
           </div>
        </div>
      )}

      {/* --- CHARACTER CARD MODAL (Quick View) --- */}
      {showCharacters && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowCharacters(false)}></div>
          <div className="relative bg-white w-full max-w-3xl rounded-xl border-4 border-black p-8 max-h-[80vh] overflow-y-auto">
             <button onClick={() => setShowCharacters(false)} className="absolute top-4 right-4"><X size={24}/></button>
             <h2 className="text-3xl comic-font mb-6 border-b-4 border-yellow-400 inline-block">Chapter Figures</h2>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {characters.map((char, idx) => (
                   <div key={idx} className="bg-slate-50 border-2 border-black p-4 rounded-lg shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] flex gap-4">
                      <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center border-2 border-black flex-shrink-0">
                         <User size={32} />
                      </div>
                      <div>
                         <h3 className="font-bold text-xl uppercase">{char.name}</h3>
                         <span className="text-xs font-bold text-white bg-blue-600 px-2 py-0.5 rounded">{char.role}</span>
                         <p className="text-sm mt-2 text-gray-700">{char.description}</p>
                      </div>
                   </div>
                ))}
             </div>
          </div>
        </div>
      )}

      {/* --- EXPLAIN MODAL ENHANCED --- */}
      {explanation && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setExplanation(null)}></div>
          <div className="relative bg-white w-full max-w-2xl rounded-xl border-4 border-black shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] flex flex-col overflow-hidden max-h-[90vh]">
            
            <div className="bg-blue-600 p-4 text-white flex justify-between items-center border-b-4 border-black">
                <div className="flex items-center gap-2">
                   <Lightbulb className="fill-yellow-400 text-yellow-400" size={28} />
                   <h3 className="comic-font text-2xl tracking-wide">Context Booster</h3>
                </div>
                <button onClick={() => setExplanation(null)} className="hover:text-red-300"><X size={24}/></button>
            </div>

            <div className="p-6 overflow-y-auto">
                <div className="bg-yellow-50 p-4 border-l-4 border-yellow-400 mb-6 italic text-gray-700">
                    "{explanation.targetText}"
                </div>
                
                {stats.tier === UserTier.FREE && stats.dailyAiUsage >= TIER_LIMITS[UserTier.FREE].ai && (
                    <div className="mb-4 bg-red-100 text-red-800 p-3 rounded text-sm border border-red-200 flex items-center gap-2">
                        <Lock size={16}/> Daily limit reached ({stats.dailyAiUsage}/{TIER_LIMITS[UserTier.FREE].ai}). 
                        <button onClick={() => setShowMembershipModal(true)} className="underline font-bold">Upgrade for more.</button>
                    </div>
                )}
                
                {stats.tier === UserTier.EXPLORER && stats.dailyAiUsage >= TIER_LIMITS[UserTier.EXPLORER].ai && (
                    <div className="mb-4 bg-red-100 text-red-800 p-3 rounded text-sm border border-red-200 flex items-center gap-2">
                        <Lock size={16}/> Explorer limit reached ({stats.dailyAiUsage}/{TIER_LIMITS[UserTier.EXPLORER].ai}). 
                        <button onClick={() => setShowMembershipModal(true)} className="underline font-bold">Go Unlimited.</button>
                    </div>
                )}

                {!explanation.activeType ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <button onClick={() => handleFetchExplanation('simple')} className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-left group">
                            <div className="bg-blue-100 p-2 rounded-full group-hover:bg-blue-200"><Info size={20} className="text-blue-600"/></div>
                            <div><div className="font-bold">Simple Summary</div><div className="text-xs text-gray-500">Plain language explanation</div></div>
                        </button>
                        <button onClick={() => handleFetchExplanation('deep')} className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-all text-left group">
                            <div className="bg-purple-100 p-2 rounded-full group-hover:bg-purple-200"><Book size={20} className="text-purple-600"/></div>
                            <div><div className="font-bold">Deep Context</div><div className="text-xs text-gray-500">Theological commentary</div></div>
                        </button>
                        <button onClick={() => handleFetchExplanation('historical')} className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-lg hover:border-amber-500 hover:bg-amber-50 transition-all text-left group">
                            <div className="bg-amber-100 p-2 rounded-full group-hover:bg-amber-200"><User size={20} className="text-amber-600"/></div>
                            <div><div className="font-bold">History & Culture</div><div className="text-xs text-gray-500">Background of the time</div></div>
                        </button>
                        <button onClick={() => handleFetchExplanation('word_study')} className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-lg hover:border-teal-500 hover:bg-teal-50 transition-all text-left group">
                            <div className="bg-teal-100 p-2 rounded-full group-hover:bg-teal-200"><Globe size={20} className="text-teal-600"/></div>
                            <div><div className="font-bold">Word Study</div><div className="text-xs text-gray-500">Hebrew/Greek meanings</div></div>
                        </button>
                        <button onClick={() => handleFetchExplanation('application')} className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition-all text-left group md:col-span-2">
                            <div className="bg-green-100 p-2 rounded-full group-hover:bg-green-200"><Sparkles size={20} className="text-green-600"/></div>
                            <div><div className="font-bold">Life Application</div><div className="text-xs text-gray-500">How to apply this today</div></div>
                        </button>
                    </div>
                ) : (
                    <div className="animate-fade-in">
                        {explanation.loading ? (
                            <Loader text="Analyzing..." />
                        ) : (
                            <div>
                                <h4 className="font-bold text-lg mb-4 capitalize border-b pb-2">{explanation.activeType.replace('_', ' ')}</h4>
                                <p className="text-lg leading-relaxed font-serif text-slate-800">
                                    {explanation.result}
                                </p>
                                <button 
                                    onClick={() => setExplanation(prev => ({ ...prev!, activeType: '' }))}
                                    className="mt-6 text-sm text-blue-600 hover:underline flex items-center gap-1"
                                >
                                    <ChevronLeft size={16} /> Choose another topic
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
          </div>
        </div>
      )}
      
      {/* --- QUIZ MODAL --- */}
      {showQuiz && quizData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowQuiz(false)}></div>
          <div className="relative bg-white w-full max-w-2xl rounded-xl border-4 border-black shadow-[10px_10px_0px_0px_#7c3aed] p-8 max-h-[90vh] overflow-y-auto">
             <button onClick={() => setShowQuiz(false)} className="absolute top-4 right-4"><X size={24}/></button>
             <div className="text-center mb-8">
               <Brain size={48} className="mx-auto text-purple-600 mb-2" />
               <h2 className="comic-font text-4xl mb-2">Knowledge Check!</h2>
               <p className="text-gray-500">Earn +20 XP for every correct answer.</p>
             </div>
             <div className="space-y-8">
               {quizData.questions.map((q, qIdx) => (
                 <div key={qIdx} className="bg-slate-50 p-6 rounded-lg border-2 border-slate-200">
                   <h4 className="font-bold text-xl mb-4">{qIdx + 1}. {q.question}</h4>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                     {q.options.map((opt, oIdx) => (
                       <button key={oIdx} onClick={(e) => {
                          const btn = e.currentTarget;
                          if (oIdx === q.correctAnswer) {
                            btn.classList.add('bg-green-500', 'text-white', 'border-green-700');
                            const xpGain = { ...stats, xp: stats.xp + 20 };
                            setStats(xpGain);
                            localStorage.setItem(STORAGE_KEYS.stats, JSON.stringify(xpGain));
                          } else {
                            btn.classList.add('bg-red-500', 'text-white', 'border-red-700');
                          }
                       }} className="text-left p-3 bg-white border-2 border-gray-300 rounded font-medium hover:border-purple-500 transition-colors">{opt}</button>
                     ))}
                   </div>
                   <details className="mt-4 text-sm text-gray-600 cursor-pointer">
                     <summary className="font-bold text-purple-600 hover:underline">See Explanation</summary>
                     <p className="mt-2 p-3 bg-purple-50 rounded italic">{q.explanation}</p>
                   </details>
                 </div>
               ))}
             </div>
          </div>
        </div>
      )}

      {/* --- NOTES MODAL --- */}
      {showNotes && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowNotes(false)}></div>
          <div className="relative w-full max-w-md bg-yellow-50 h-full shadow-2xl p-6 border-l-4 border-black flex flex-col">
            <div className="flex justify-between items-center mb-6"><h3 className="comic-font text-2xl">My Notes</h3><button onClick={() => setShowNotes(false)}><X size={24} /></button></div>
            <div className="mb-2 font-bold text-gray-500 uppercase text-xs">{selectedBook} {selectedChapter}</div>
            <textarea className="flex-grow w-full p-4 border-2 border-black rounded bg-white font-handwriting text-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-none shadow-inner" placeholder="Write your reflections here..." value={currentNote} onChange={(e) => setCurrentNote(e.target.value)} />
            <button onClick={saveNote} className="mt-4 w-full bg-green-500 text-white font-bold py-3 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none flex items-center justify-center gap-2"><Save size={20} /> Save Note</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
