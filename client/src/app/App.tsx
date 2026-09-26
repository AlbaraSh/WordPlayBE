import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import HomePage from './components/HomePage';
import VocabListPage from './components/VocabListPage';
import LearningPage from './components/LearningPage';
import MinigamePage from './components/MinigamePage';
import AchievementsPage from './components/AchievementsPage';
import AuthPage from './components/AuthPage';
import LandingPage from './components/LandingPage';
import UserProfile from './components/UserProfile';
import { BADGE_LIST } from './data/badges';
import { Trophy, Home, GraduationCap, BookOpen, Gamepad2 } from 'lucide-react';
import { api, SessionUser } from '../api/client';
import { initializeVocabularyData } from './data/vocabulary';

type UserProgress = {
  wordsLearned: number;
  studyStreak: number;
  gamesPlayed: number;
  correctAnswers: number;
};

type BackendProgress = {
  lessonStats: Record<string, { completed: boolean; score: number; flashcardProgress: number }>;
  sectionTestScores: Record<string, { best: number; latest: number }>;
  userStats: {
    totalXp: number;
    level: number;
    studyStreak: number;
    wordsLearned: number;
    correctWords: number;
    completedMinigames: number;
    currentBadgeId: number | null;
  };
  achievements: Array<{
    id: string;
    title: string;
    description: string;
    progress: number;
    progressTarget: number;
    unlocked: boolean;
    unlockedDate: string | null;
  }>;
};

function LoggedOutGate() {
  const location = useLocation();
  if (location.pathname !== '/') return <Navigate to="/" replace />;
  return <LandingPage />;
}

function toHHMMSS(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const h = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const s = String(totalSeconds % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

const NAV = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/vocab', label: 'Vocabulary', icon: BookOpen, end: false },
  { to: '/learn', label: 'Learn', icon: GraduationCap, end: false },
  { to: '/game', label: 'Game', icon: Gamepad2, end: false },
  { to: '/achievements', label: 'Achievements', icon: Trophy, end: false },
];

export default function App() {
  const navigate = useNavigate();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [backendProgress, setBackendProgress] = useState<BackendProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [vocabularyLoaded, setVocabularyLoaded] = useState(false);
  const [claimedAchievements, setClaimedAchievements] = useState<string[]>([]);

  const INACTIVITY_MS = 30 * 60 * 1000;
  const sessionStartMsRef = useRef<number | null>(null);
  const lastInteractMsRef = useRef<number>(Date.now());
  const endedRef = useRef(false);

  const sendStudySession = useCallback((startMs: number, endMs: number) => {
    api.studySession({
      startTime: new Date(startMs).toISOString(),
      endTime: new Date(endMs).toISOString(),
      totalDuration: toHHMMSS(endMs - startMs),
    }).catch(() => {});
  }, []);

  const endCurrentSession = useCallback((reason: 'inactivity' | 'unload') => {
    if (endedRef.current) return;
    const startMs = sessionStartMsRef.current;
    if (startMs == null) return;
    endedRef.current = true;
    sendStudySession(startMs, Date.now());
    if (reason === 'inactivity') {
      sessionStartMsRef.current = null;
      endedRef.current = false;
    }
  }, [sendStudySession]);

  const loadProgress = useCallback(async () => {
    const data = await api.getProgress();
    setBackendProgress(data as BackendProgress);
  }, []);

  useEffect(() => {
    document.title = 'WordPlay';
    api.me()
      .then((me) => setUser(me))
      .finally(() => setAuthChecked(true));
  }, []);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      setVocabularyLoaded(false);
      setBackendProgress(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        await initializeVocabularyData();
        if (cancelled) return;
        setVocabularyLoaded(true);
        await loadProgress();
      } catch (error) {
        console.error('Failed to initialize app:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    sessionStartMsRef.current = Date.now();
    lastInteractMsRef.current = Date.now();
    endedRef.current = false;

    const onInteract = () => {
      lastInteractMsRef.current = Date.now();
      if (sessionStartMsRef.current == null) {
        sessionStartMsRef.current = Date.now();
        endedRef.current = false;
      }
    };
    const events: Array<keyof WindowEventMap> = ['mousedown', 'keydown', 'pointerdown', 'touchstart'];
    events.forEach((ev) => window.addEventListener(ev, onInteract, { passive: true }));

    const inactivityTimer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      if (sessionStartMsRef.current != null && Date.now() - lastInteractMsRef.current >= INACTIVITY_MS) {
        endCurrentSession('inactivity');
      }
    }, 15_000);

    const onHide = () => endCurrentSession('unload');
    window.addEventListener('pagehide', onHide);
    window.addEventListener('beforeunload', onHide);

    return () => {
      cancelled = true;
      events.forEach((ev) => window.removeEventListener(ev, onInteract));
      window.removeEventListener('pagehide', onHide);
      window.removeEventListener('beforeunload', onHide);
      window.clearInterval(inactivityTimer);
    };
  }, [user, endCurrentSession, loadProgress]);

  const userProgress: UserProgress = useMemo(() => {
    if (!backendProgress) {
      return { wordsLearned: 0, studyStreak: 0, gamesPlayed: 0, correctAnswers: 0 };
    }
    return {
      wordsLearned: backendProgress.userStats.wordsLearned ?? 0,
      studyStreak: backendProgress.userStats.studyStreak ?? 0,
      gamesPlayed: backendProgress.userStats.completedMinigames ?? 0,
      correctAnswers: backendProgress.userStats.correctWords ?? 0,
    };
  }, [backendProgress]);

  const currentBadge = useMemo(() => {
    const lvl = backendProgress?.userStats.level ?? 0;
    if (lvl <= 0) return null;
    if (lvl >= 10) return BADGE_LIST.find((b) => b.level === 10) ?? null;
    const unlocked = BADGE_LIST.filter((badge) => badge.level <= lvl);
    return unlocked.length > 0 ? unlocked[unlocked.length - 1] : null;
  }, [backendProgress]);

  const updateProgress = async () => {
    await loadProgress();
  };

  const claimAchievement = (achievementId: string) => {
    setClaimedAchievements((prev) => (prev.includes(achievementId) ? prev : [...prev, achievementId]));
  };

  const logout = async () => {
    endCurrentSession('unload');
    await api.logout();
    setUser(null);
    navigate('/');
  };

  if (!authChecked) {
    return <div className="p-8 text-stone-600">Checking your account…</div>;
  }

  return (
    <div className="size-full flex flex-col">
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <AuthPage mode="login" onAuthed={setUser} />} />
        <Route path="/register" element={user ? <Navigate to="/" replace /> : <AuthPage mode="register" onAuthed={setUser} />} />
        <Route
          path="*"
          element={
            user ? (
              <>
                <nav className="bg-white border-b border-stone-200">
                  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16 gap-4">
                      <div className="flex items-center gap-2 shrink-0">
                        <GraduationCap className="size-7 text-blue-800" />
                        <span className="text-2xl text-stone-900">WordPlay</span>
                      </div>
                      <div className="flex gap-1 overflow-x-auto">
                        {NAV.map(({ to, label, icon: Icon, end }) => (
                          <NavLink
                            key={to}
                            to={to}
                            end={end}
                            className={({ isActive }) =>
                              `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${
                                isActive ? 'bg-blue-50 text-blue-900' : 'text-stone-600 hover:bg-stone-100'
                              }`
                            }
                          >
                            <Icon className="size-4" />
                            <span className="hidden sm:inline">{label}</span>
                          </NavLink>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <UserProfile
                          username={user.displayName}
                          totalXp={backendProgress?.userStats.totalXp ?? 0}
                          level={backendProgress?.userStats.level ?? 0}
                          badgeIcon={currentBadge?.icon}
                          badgeColor={currentBadge?.color}
                        />
                        <button onClick={logout} className="text-sm text-stone-500 hover:text-stone-800 px-2">
                          Log out
                        </button>
                      </div>
                    </div>
                  </div>
                </nav>
                <div className="flex-1 overflow-auto">
                  {(loading && !backendProgress) || !vocabularyLoaded ? (
                    <div className="p-8 text-stone-600">Loading your course…</div>
                  ) : (
                    <Routes>
                      <Route path="/" element={<HomePage progress={userProgress} />} />
                      <Route path="/vocab" element={<VocabListPage />} />
                      <Route path="/learn" element={<LearningPage onProgressUpdate={updateProgress} />} />
                      <Route path="/game" element={<MinigamePage onProgressUpdate={updateProgress} />} />
                      <Route
                        path="/achievements"
                        element={
                          <AchievementsPage
                            progress={userProgress}
                            claimedAchievements={claimedAchievements}
                            onClaimAchievement={claimAchievement}
                            backendAchievements={backendProgress?.achievements ?? []}
                            totalXp={backendProgress?.userStats.totalXp ?? 0}
                            currentLevel={backendProgress?.userStats.level ?? 0}
                          />
                        }
                      />
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                  )}
                </div>
              </>
            ) : (
              <LoggedOutGate />
            )
          }
        />
      </Routes>
    </div>
  );
}
