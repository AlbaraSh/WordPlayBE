import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, Gamepad2, Trophy, Flame } from 'lucide-react';
import { api } from '../../api/client';

interface HomePageProps {
  progress: {
    wordsLearned: number;
    studyStreak: number;
    gamesPlayed: number;
    correctAnswers: number;
  };
}

type BackendProgress = {
  user?: {
    wordsLearned?: number;
    studyStreak?: number;
    completedMinigames?: number;
    correctWords?: number;
  };
  wordsLearned?: number;
  studyStreak?: number;
  completedMinigames?: number;
  correctWords?: number;
};

export default function HomePage({ progress }: HomePageProps) {
  const navigate = useNavigate();
  // Backend truth (optional). If backend fails, we fall back to props.
  const [backendProgress, setBackendProgress] = useState<BackendProgress | null>(null);
  const [loading, setLoading] = useState(false);

  const loadProgress = async () => {
    setLoading(true);
    try {
      const data: any = await api.getProgress();
      setBackendProgress(data);
    } catch (e) {
      console.error('Failed to load progress:', e);
      setBackendProgress(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProgress();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const displayProgress = useMemo(() => {
    // Support either { user: {...} } or flat responses.
    const u = backendProgress?.user ?? backendProgress ?? {};

    return {
      wordsLearned: (u.wordsLearned ?? progress.wordsLearned) as number,
      studyStreak: (u.studyStreak ?? progress.studyStreak) as number,
      gamesPlayed: (u.completedMinigames ?? progress.gamesPlayed) as number,
      correctAnswers: (u.correctWords ?? progress.correctAnswers) as number,
    };
  }, [backendProgress, progress]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      {/* Hero Section */}
      <div className="text-center mb-12">
        <h1 className="text-5xl text-stone-900 mb-3">Your study desk</h1>
        <p className="text-lg text-stone-600 mb-8">
          Lessons, a falling-words game, and a record of what you have actually learned.
        </p>
        <button
          onClick={() => navigate('/learn')}
          className="inline-flex items-center gap-2 bg-blue-600 text-white px-8 py-4 rounded-lg hover:bg-blue-700 transition-colors text-lg shadow-lg"
        >
          Start Learning
          <ArrowRight className="size-5" />
        </button>

        <div className="mt-4 flex items-center justify-center gap-3 text-sm text-gray-500">
          {loading ? <span>Syncing with backend…</span> : <span>Synced</span>}
          <button onClick={loadProgress} className="underline hover:text-gray-700">
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-12">
        <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-blue-100 p-3 rounded-lg">
              <BookOpen className="size-6 text-blue-600" />
            </div>
            <div>
              <div className="text-3xl font-bold text-gray-900">{displayProgress.wordsLearned}</div>
              <div className="text-sm text-gray-600">Words Learned</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-orange-100 p-3 rounded-lg">
              <Flame className="size-6 text-orange-600" />
            </div>
            <div>
              <div className="text-3xl font-bold text-gray-900">{displayProgress.studyStreak}</div>
              <div className="text-sm text-gray-600">Day Streak</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-green-100 p-3 rounded-lg">
              <Gamepad2 className="size-6 text-green-600" />
            </div>
            <div>
              <div className="text-3xl font-bold text-gray-900">{displayProgress.gamesPlayed}</div>
              <div className="text-sm text-gray-600">Games Played</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-purple-100 p-3 rounded-lg">
              <Trophy className="size-6 text-purple-600" />
            </div>
            <div>
              <div className="text-3xl font-bold text-gray-900">{displayProgress.correctAnswers}</div>
              <div className="text-sm text-gray-600">Correct Answers</div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <button
          onClick={() => navigate('/vocab')}
          className="bg-white rounded-xl p-8 shadow-md border border-gray-200 hover:shadow-lg transition-all text-left group"
        >
          <div className="bg-blue-100 p-4 rounded-lg w-fit mb-4 group-hover:bg-blue-200 transition-colors">
            <BookOpen className="size-8 text-blue-600" />
          </div>
          <h3 className="text-2xl font-semibold text-gray-900 mb-2">Vocabulary List</h3>
          <p className="text-gray-600 mb-4">
            Browse and review all available words organized by category and difficulty
          </p>
          <div className="flex items-center gap-2 text-blue-600 font-medium">
            Explore Vocabulary
            <ArrowRight className="size-5" />
          </div>
        </button>

        <button
          onClick={() => navigate('/game')}
          className="bg-white rounded-xl p-8 shadow-md border border-gray-200 hover:shadow-lg transition-all text-left group"
        >
          <div className="bg-green-100 p-4 rounded-lg w-fit mb-4 group-hover:bg-green-200 transition-colors">
            <Gamepad2 className="size-8 text-green-600" />
          </div>
          <h3 className="text-2xl font-semibold text-gray-900 mb-2">Play Minigame</h3>
          <p className="text-gray-600 mb-4">
            Test your knowledge with fun and interactive vocabulary matching games
          </p>
          <div className="flex items-center gap-2 text-green-600 font-medium">
            Start Playing
            <ArrowRight className="size-5" />
          </div>
        </button>

        <button
          onClick={() => navigate('/achievements')}
          className="bg-white rounded-xl p-8 shadow-md border border-gray-200 hover:shadow-lg transition-all text-left group"
        >
          <div className="bg-purple-100 p-4 rounded-lg w-fit mb-4 group-hover:bg-purple-200 transition-colors">
            <Trophy className="size-8 text-purple-600" />
          </div>
          <h3 className="text-2xl font-semibold text-gray-900 mb-2">Achievements</h3>
          <p className="text-gray-600 mb-4">
            Track your progress and unlock badges as you master new vocabulary
          </p>
          <div className="flex items-center gap-2 text-purple-600 font-medium">
            View Progress
            <ArrowRight className="size-5" />
          </div>
        </button>
      </div>
    </div>
  );
}
