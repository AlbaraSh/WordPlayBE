import { useState, useEffect, useRef } from 'react';
import { Trophy, Timer, Medal, Target } from 'lucide-react';
import { type VocabWord, updateWordStats, vocabularyData, courseSections } from '../data/vocabulary';
import { api } from '../../api/client';

interface MinigamePageProps {
  onProgressUpdate: (updates: { gamesPlayed?: number; correctAnswers?: number; studyStreak?: number }) => void;
}

type FallingWord = {
  id: string;
  word: VocabWord;
  y: number;
  speed: number;
  prompt: string;
  answer: string;
  promptLang: 'jp' | 'en';
  shownAtMs: number; // <-- NEW: when this word was shown/spawned
};

type GameScore = {
  id: number;
  score: number;
  difficulty: string;
  section: string;
  date: string;
};

type Phase = 'start' | 'playing' | 'results';

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function toISODate(date: string | Date) {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().split('T')[0];
}

//  Display helper: if backend sends sectionNum=7, show "All"
function formatSectionLabel(sectionNum: number | null | undefined) {
  if (sectionNum === 7) return 'All';
  if (sectionNum == null) return 'All';
  return `Section ${sectionNum}`;
}

export default function MinigamePage({ onProgressUpdate }: MinigamePageProps) {
  const GAME_HEIGHT = 400;
  const GAME_SECONDS = 120;

  const [phase, setPhase] = useState<Phase>('start');
  const [difficulty, setDifficulty] = useState<'beginner' | 'intermediate' | 'master' | ''>('');
  const [section, setSection] = useState<number | 'all' | ''>('');

  const [timeLeft, setTimeLeft] = useState(GAME_SECONDS);
  const [score, setScore] = useState(0);
  const [fallingWords, setFallingWords] = useState<FallingWord[]>([]);
  const [userInput, setUserInput] = useState('');
  const [availableWords, setAvailableWords] = useState<VocabWord[]>([]);

  const [questionsAsked, setQuestionsAsked] = useState(0);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);

  const [rewardFlash, setRewardFlash] = useState(false);
  const rewardTimeoutRef = useRef<number | null>(null);

  const lastPromptRef = useRef<{ wordId: number; promptLang: 'jp' | 'en' } | null>(null);
  const wordDeckRef = useRef<VocabWord[]>([]);

  //   leaderboard now comes from backend
  const [leaderboard, setLeaderboard] = useState<GameScore[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const gameStarted = phase === 'playing';

  //  guard to prevent calling endGame twice
  const endedRef = useRef(false);

  const loadLeaderboard = async () => {
    setLoadingLeaderboard(true);
    try {
      const data: any = await api.getTop10();

      const items = Array.isArray(data)
        ? data
        : Array.isArray(data?.top10)
          ? data.top10
          : (data?.items ?? []);

      const mapped: GameScore[] = items.map((row: any, idx: number) => ({
        id: row.id ?? idx + 1,
        score: row.score,
        difficulty: row.difficulty,
        section: formatSectionLabel(row.sectionNum),
        date: toISODate(row.playedAt ?? row.date ?? new Date()),
      }));

      setLeaderboard(mapped);
    } catch (e) {
      console.error('Failed to load leaderboard:', e);
      setLeaderboard([]);
    } finally {
      setLoadingLeaderboard(false);
    }
  };

  useEffect(() => {
    loadLeaderboard();
  }, []);

  const getPointsForDifficulty = () => {
    if (difficulty === 'beginner') return 10;
    if (difficulty === 'intermediate') return 50;
    if (difficulty === 'master') return 100;
    return 0;
  };

  const getFallSpeed = () => {
    if (difficulty === 'beginner') return 1.6;
    if (difficulty === 'intermediate') return 2.6;
    return 3.6;
  };

  const triggerRewardEffect = () => {
    setRewardFlash(true);
    if (rewardTimeoutRef.current) window.clearTimeout(rewardTimeoutRef.current);
    rewardTimeoutRef.current = window.setTimeout(() => setRewardFlash(false), 180);
  };

  const focusInputNoScroll = () => {
    try {
      inputRef.current?.focus({ preventScroll: true } as any);
    } catch {
      inputRef.current?.focus();
    }
  };

  const accuracyPct = questionsAsked > 0 ? Math.round((correctAnswers / questionsAsked) * 100) : 0;

  const drawNextWord = () => {
    if (wordDeckRef.current.length === 0) {
      wordDeckRef.current = shuffleArray(availableWords);
    }
    const firstPick = wordDeckRef.current.pop();
    if (!firstPick) return null;

    const last = lastPromptRef.current;
    if (last && firstPick.id === last.wordId && wordDeckRef.current.length > 0) {
      const secondPick = wordDeckRef.current.pop()!;
      wordDeckRef.current.unshift(firstPick);
      return secondPick;
    }
    return firstPick;
  };

  //   FIX: interval only changes timeLeft; NO endGame() inside setTimeLeft updater
  useEffect(() => {
    if (!gameStarted) return;

    endedRef.current = false;

    const timer = window.setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [gameStarted]);

  //   NEW: end game when timeLeft reaches 0 (safe place for side effects)
  useEffect(() => {
    if (!gameStarted) return;
    if (timeLeft !== 0) return;
    if (endedRef.current) return;

    endedRef.current = true;
    endGame(false);
  }, [timeLeft, gameStarted]);

  useEffect(() => {
    if (!gameStarted || timeLeft === 0) return;

    const RED_LINE_HEIGHT = 8;
    const WORD_HIT_Y = GAME_HEIGHT - RED_LINE_HEIGHT;

    const moveWords = window.setInterval(() => {
      setFallingWords((prev) => {
        let missed = false;

        const next = prev
          .map((fw) => ({ ...fw, y: fw.y + fw.speed }))
          .filter((fw) => {
            if (fw.y >= WORD_HIT_Y) {
              missed = true;

              // record incorrect when word hits red line
              updateWordStats(fw.word.id, false);

              return false; // remove word
            }
            return true;
          });

        // streak resets whenever an incorrect is stored (red line miss)
        if (missed) setCurrentStreak(0);

        return next;
      });
    }, 50);

    return () => window.clearInterval(moveWords);
  }, [gameStarted, timeLeft]);

  useEffect(() => {
    if (!gameStarted || timeLeft === 0) return;
    if (availableWords.length === 0) return;
    if (fallingWords.length > 0) return;

    const randomWord = drawNextWord();
    if (!randomWord) return;

    let promptLang: 'jp' | 'en' = Math.random() > 0.5 ? 'jp' : 'en';

    const last = lastPromptRef.current;
    if (last && last.wordId === randomWord.id && last.promptLang === promptLang) {
      promptLang = promptLang === 'jp' ? 'en' : 'jp';
    }

    lastPromptRef.current = { wordId: randomWord.id, promptLang };

    const prompt = promptLang === 'jp' ? randomWord.word : randomWord.translation;
    const answer = promptLang === 'jp' ? randomWord.translation : randomWord.word;

    const newWord: FallingWord = {
      id: `${Date.now()}-${Math.random()}`,
      word: randomWord,
      y: 0,
      speed: getFallSpeed(),
      prompt,
      answer,
      promptLang,
      shownAtMs: Date.now(), // <-- NEW: start timing when word appears
    };

    setFallingWords([newWord]);
    setQuestionsAsked((prev) => prev + 1);

    focusInputNoScroll();
  }, [gameStarted, timeLeft, availableWords, difficulty, fallingWords.length]);

  const initializeGame = () => {
    if (!difficulty || !section) return;

    let filteredWords = vocabularyData;
    if (section !== 'all') {
      filteredWords = filteredWords.filter((w) => w.section === section);
    }

    if (filteredWords.length === 0) {
      alert('No words available for this section. Please select a different section.');
      return;
    }

    setAvailableWords(filteredWords);
    wordDeckRef.current = shuffleArray(filteredWords);

    setFallingWords([]);
    setScore(0);
    setTimeLeft(GAME_SECONDS);
    setUserInput('');

    setQuestionsAsked(0);
    setCorrectAnswers(0);
    setCurrentStreak(0);
    setBestStreak(0);
    lastPromptRef.current = null;

    setPhase('playing');
    setTimeout(() => focusInputNoScroll(), 50);
  };

  const resetToStartScreen = () => {
    setPhase('start');
    setTimeLeft(GAME_SECONDS);
    setDifficulty('');
    setSection('');
    setScore(0);
    setAvailableWords([]);
    setFallingWords([]);
    setUserInput('');

    setQuestionsAsked(0);
    setCorrectAnswers(0);
    setCurrentStreak(0);
    setBestStreak(0);
    lastPromptRef.current = null;

    wordDeckRef.current = [];
    endedRef.current = false;
  };

  const endGame = async (discardScore: boolean = false) => {
    setFallingWords([]);
    setUserInput('');

    if (discardScore) {
      resetToStartScreen();
      return;
    }

    onProgressUpdate({ gamesPlayed: 1, studyStreak: 1 });

    api.streakAction({ source: 'MINIGAME' }).catch((e: any) => console.error('streakAction failed:', e));

    try {
      if (score > 0) {
        const sectionNumToSave: number | undefined =
          section === '' ? undefined : section === 'all' ? 7 : section;

        await api.addScore({
          score,
          difficulty,
          sectionNum: sectionNumToSave,
        });
      }

      await loadLeaderboard();
    } catch (e) {
      console.error('Failed to save score or refresh leaderboard:', e);
    }

    setPhase('results');
  };

  const checkAnswer = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedInput = userInput.trim().toLowerCase();
    if (!trimmedInput) return;

    const activeWord = fallingWords[0];
    if (!activeWord) {
      setUserInput('');
      return;
    }

    const expected = activeWord.answer.trim().toLowerCase();

    if (expected === trimmedInput) {
      const points = getPointsForDifficulty();
      setScore((prev) => prev + points);

      setCorrectAnswers((prev) => prev + 1);
      setCurrentStreak((prev) => {
        const next = prev + 1;
        setBestStreak((best) => (next > best ? next : best));
        return next;
      });

      setFallingWords([]);

      //only include responseTimeMs when the answer is correct
      const responseTimeMs = Date.now() - activeWord.shownAtMs;
      updateWordStats(activeWord.word.id, true, responseTimeMs);

      onProgressUpdate({ correctAnswers: 1 });

      triggerRewardEffect();
    } else {
      //   Master: one chance — store incorrect, reset streak, and remove word
      //   Other modes: unlimited tries — do NOT store incorrect; do NOT reset streak; word stays falling
      if (difficulty === 'master') {
        updateWordStats(activeWord.word.id, false);

        //   streak resets whenever an incorrect is stored
        setCurrentStreak(0);

        // one chance: remove the word so the next one spawns
        setFallingWords([]);
      }
    }

    setUserInput('');
    focusInputNoScroll();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-full overflow-y-scroll overflow-x-hidden flex flex-col">
      <div className="max-w-7xl mx-auto px-4 py-6 w-full">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Falling Words Game</h1>
          <p className="text-sm text-gray-600">Type the opposite language before the word hits the red line!</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            {phase === 'start' ? (
              <div className="bg-white rounded-xl shadow-md border border-gray-200 p-8">
                <div className="bg-green-100 p-6 rounded-full w-fit mx-auto mb-6">
                  <Trophy className="size-16 text-green-600" />
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-4 text-center">Ready to Play?</h2>
                <p className="text-lg text-gray-600 mb-8 text-center">
                  You have 2 minutes to score as many points as possible!
                </p>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-3">Select Difficulty Level *</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => setDifficulty('beginner')}
                      className={`px-4 py-3 rounded-lg font-medium transition-colors ${
                        difficulty === 'beginner'
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Beginner
                    </button>
                    <button
                      onClick={() => setDifficulty('intermediate')}
                      className={`px-4 py-3 rounded-lg font-medium transition-colors ${
                        difficulty === 'intermediate'
                          ? 'bg-yellow-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Intermediate
                    </button>
                    <button
                      onClick={() => setDifficulty('master')}
                      className={`px-4 py-3 rounded-lg font-medium transition-colors ${
                        difficulty === 'master' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Master
                    </button>
                  </div>
                  <div className="mt-3 text-xs text-gray-500">
                    Scoring: Beginner +10 • Intermediate +50 • Master +100
                  </div>
                </div>

                <div className="mb-8">
                  <label className="block text-sm font-medium text-gray-700 mb-3">Select Section *</label>
                  <div className="grid grid-cols-4 gap-2">
                    {courseSections.map((courseSection) => (
                      <button
                        key={courseSection.sectionNum}
                        onClick={() => setSection(courseSection.sectionNum)}
                        className={`px-4 py-3 rounded-lg font-medium transition-colors ${
                          section === courseSection.sectionNum ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {courseSection.sectionNum}
                      </button>
                    ))}
                    <button
                      onClick={() => setSection('all')}
                      className={`px-4 py-3 rounded-lg font-medium transition-colors col-span-4 ${
                        section === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      All Sections
                    </button>
                  </div>
                </div>

                <button
                  onClick={initializeGame}
                  disabled={!difficulty || !section}
                  className={`w-full inline-flex items-center justify-center gap-2 px-8 py-4 rounded-lg transition-colors text-lg shadow-lg ${
                    difficulty && section
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  Start Game
                  <Trophy className="size-5" />
                </button>
              </div>
            ) : phase === 'playing' ? (
              <>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4">
                    <div className="flex items-center gap-2">
                      <div className="bg-purple-100 p-2 rounded-lg">
                        <Timer className="size-5 text-purple-600" />
                      </div>
                      <div>
                        <div className="text-xl font-bold text-gray-900">{formatTime(timeLeft)}</div>
                        <div className="text-xs text-gray-600">Time Left</div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4">
                    <div className="flex items-center gap-2">
                      <div className="bg-blue-100 p-2 rounded-lg">
                        <Target className="size-5 text-blue-600" />
                      </div>
                      <div>
                        <div className="text-xl font-bold text-gray-900">{score}</div>
                        <div className="text-xs text-gray-600">Score</div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4">
                    <div className="flex items-center gap-2">
                      <div className="bg-orange-100 p-2 rounded-lg">
                        <Trophy className="size-5 text-orange-600" />
                      </div>
                      <div>
                        <div className="text-xl font-bold text-gray-900">{currentStreak}</div>
                        <div className="text-xs text-gray-600">Streak</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  className="bg-gradient-to-b from-blue-50 to-blue-100 rounded-xl shadow-md border-2 border-blue-300 relative overflow-hidden mb-4"
                  style={{ height: `${GAME_HEIGHT}px` }}
                >
                  <div
                    className={`absolute inset-0 pointer-events-none transition-opacity duration-150 ${
                      rewardFlash ? 'opacity-100' : 'opacity-0'
                    }`}
                    style={{ background: 'rgba(34, 197, 94, 0.10)' }}
                  />

                  {fallingWords.map((fw) => (
                    <div
                      key={fw.id}
                      className="absolute left-1/2 transform -translate-x-1/2 px-4 py-2 bg-white rounded-lg shadow-lg border-2 border-blue-400 font-bold text-lg text-gray-900 whitespace-nowrap z-10"
                      style={{ top: `${fw.y}px` }}
                    >
                      {fw.prompt}
                    </div>
                  ))}

                  <div className="absolute bottom-0 left-0 right-0 h-2 bg-red-500" />

                  {fallingWords.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <p className="text-gray-500 text-sm">Next word loading...</p>
                    </div>
                  )}

                  {rewardFlash && (
                    <div className="absolute top-3 right-3 px-2 py-1 bg-green-600 text-white text-xs font-semibold rounded-md shadow">
                      +{getPointsForDifficulty()}
                    </div>
                  )}
                </div>

                <form onSubmit={checkAnswer} className="bg-white rounded-lg shadow-md border border-gray-200 p-4 mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Type the answer:</label>
                  <input
                    ref={inputRef}
                    type="text"
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        checkAnswer(e as any);
                      }
                    }}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                    placeholder="Enter answer..."
                    autoComplete="off"
                  />
                  {fallingWords[0] && (
                    <p className="text-xs text-gray-500 mt-2">
                      Prompt:{' '}
                      <span className="font-medium">{fallingWords[0].promptLang === 'jp' ? 'Japanese' : 'English'}</span>
                      {' — '}
                      Answer in{' '}
                      <span className="font-medium">{fallingWords[0].promptLang === 'jp' ? 'English' : 'Japanese'}</span>.
                    </p>
                  )}
                </form>

                <div className="text-center">
                  <button
                    onClick={() => endGame(true)}
                    className="inline-flex items-center gap-2 bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    End Game (Discard Score)
                  </button>
                </div>
              </>
            ) : (
              <div className="bg-white rounded-xl shadow-md border border-gray-200 p-8">
                <div className="bg-blue-100 p-5 rounded-full w-fit mx-auto mb-6">
                  <Trophy className="size-12 text-blue-600" />
                </div>

                <h2 className="text-3xl font-bold text-gray-900 mb-2 text-center">Game Results</h2>
                <p className="text-sm text-gray-600 mb-8 text-center">Nice run! Here’s how you did.</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                  <div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
                    <div className="text-xs text-gray-600">Final Score</div>
                    <div className="text-2xl font-bold text-gray-900">{score}</div>
                  </div>

                  <div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
                    <div className="text-xs text-gray-600">Questions Asked</div>
                    <div className="text-2xl font-bold text-gray-900">{questionsAsked}</div>
                  </div>

                  <div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
                    <div className="text-xs text-gray-600">Correct Answers</div>
                    <div className="text-2xl font-bold text-gray-900">{correctAnswers}</div>
                  </div>

                  <div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
                    <div className="text-xs text-gray-600">Best Streak</div>
                    <div className="text-2xl font-bold text-gray-900">{bestStreak}</div>
                  </div>

                  <div className="p-4 rounded-lg border border-gray-200 bg-gray-50 sm:col-span-2">
                    <div className="text-xs text-gray-600">Accuracy</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {accuracyPct}%{' '}
                      <span className="text-sm font-medium text-gray-600">
                        ({correctAnswers}/{questionsAsked})
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-center">
                  <button
                    onClick={resetToStartScreen}
                    className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors text-lg shadow-lg"
                  >
                    Back to Start
                    <Trophy className="size-5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 self-start">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-yellow-100 p-3 rounded-lg">
                <Medal className="size-6 text-yellow-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Leaderboard</h2>
              {loadingLeaderboard && <span className="text-xs text-gray-500">Loading…</span>}
            </div>

            <div className="space-y-3">
              {leaderboard.map((scoreEntry, index) => (
                <div
                  key={scoreEntry.id}
                  className={`flex items-center gap-3 p-4 rounded-lg border-2 ${
                    index === 0
                      ? 'bg-yellow-50 border-yellow-300'
                      : index === 1
                      ? 'bg-gray-50 border-gray-300'
                      : index === 2
                      ? 'bg-orange-50 border-orange-300'
                      : 'bg-white border-gray-200'
                  }`}
                >
                  <div className="flex-shrink-0 w-8 text-center">
                    {index === 0 ? (
                      <span className="text-2xl">🥇</span>
                    ) : index === 1 ? (
                      <span className="text-2xl">🥈</span>
                    ) : index === 2 ? (
                      <span className="text-2xl">🥉</span>
                    ) : (
                      <span className="text-lg font-bold text-gray-500">#{index + 1}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-2xl font-bold text-blue-600">{scoreEntry.score}</span>
                      <span className="text-xs text-gray-500">{scoreEntry.date}</span>
                    </div>
                    <div className="text-sm text-gray-700">
                      {scoreEntry.difficulty} • {scoreEntry.section}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {leaderboard.length === 0 && !loadingLeaderboard && (
              <div className="text-center py-8 text-gray-500">
                <p>No games played yet.</p>
                <p className="text-sm mt-2">Complete a game to see your scores here!</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
