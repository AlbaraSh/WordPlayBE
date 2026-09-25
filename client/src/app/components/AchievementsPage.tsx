import { Badge, Star, Zap, Trophy, Flame, Crown, Target, Award, Sparkles, Shield, BookOpen, Gamepad2 } from 'lucide-react';
import { BADGE_LIST, type BadgeItem } from '../data/badges';
import { useEffect } from 'react';

interface AchievementsPageProps {
  progress: {
    wordsLearned: number;
    studyStreak: number;
    gamesPlayed: number;
    correctAnswers: number;
  };
  claimedAchievements: string[];
  onClaimAchievement: (achievementId: string, xpReward: number) => void;
  backendAchievements: Array<{
    id: string;
    title: string;
    description: string;
    progress: number;
    progressTarget: number;
    unlocked: boolean;
  }>;
  totalXp: number;
  currentLevel: number;
}

// Achievement type for UI definitions only
type AchievementUI = {
  id: string;
  icon: React.ReactNode;
  color: string;
  xpReward: number;
};

// ============================================================================
// ACHIEVEMENT UI DEFINITIONS
// ============================================================================
// 
// This list only contains UI-specific data (icons, colors, XP rewards).
// All other data (title, description, progress, requirement, unlocked status)
// comes from the backend via the getProgress endpoint.
//
// To add a new achievement:
// 1. Add it to the backend database with title, description, and tracking logic
// 2. Add ONLY the UI definition here with matching id
//
// ============================================================================

const ACHIEVEMENT_XP_REWARD = 30;

const ACHIEVEMENT_UI_LIST: AchievementUI[] = [
  {
    id: 'first_word',
    icon: <Star className="size-8" />,
    color: 'from-yellow-400 to-yellow-600',
    xpReward: ACHIEVEMENT_XP_REWARD,
  },
  {
    id: 'vocab_5',
    icon: <BookOpen className="size-8" />,
    color: 'from-blue-400 to-blue-600',
    xpReward: ACHIEVEMENT_XP_REWARD,
  },
  {
    id: 'vocab_10',
    icon: <BookOpen className="size-8" />,
    color: 'from-blue-500 to-blue-700',
    xpReward: ACHIEVEMENT_XP_REWARD,
  },
  {
    id: 'vocab_25',
    icon: <Award className="size-8" />,
    color: 'from-purple-400 to-purple-600',
    xpReward: ACHIEVEMENT_XP_REWARD,
  },
  {
    id: 'streak_3',
    icon: <Flame className="size-8" />,
    color: 'from-orange-400 to-red-600',
    xpReward: ACHIEVEMENT_XP_REWARD,
  },
  {
    id: 'streak_7',
    icon: <Flame className="size-8" />,
    color: 'from-orange-500 to-red-700',
    xpReward: ACHIEVEMENT_XP_REWARD,
  },
  {
    id: 'game_1',
    icon: <Gamepad2 className="size-8" />,
    color: 'from-green-400 to-green-600',
    xpReward: ACHIEVEMENT_XP_REWARD,
  },
  {
    id: 'game_5',
    icon: <Gamepad2 className="size-8" />,
    color: 'from-green-500 to-green-700',
    xpReward: ACHIEVEMENT_XP_REWARD,
  },
  {
    id: 'correct_10',
    icon: <Target className="size-8" />,
    color: 'from-indigo-400 to-indigo-600',
    xpReward: ACHIEVEMENT_XP_REWARD,
  },
  {
    id: 'correct_50',
    icon: <Zap className="size-8" />,
    color: 'from-indigo-500 to-indigo-700',
    xpReward: ACHIEVEMENT_XP_REWARD,
  },
  {
    id: 'vocab_master',
    icon: <Trophy className="size-8" />,
    color: 'from-yellow-500 to-orange-600',
    xpReward: ACHIEVEMENT_XP_REWARD,
  },
  {
    id: 'perfectionist',
    icon: <Award className="size-8" />,
    color: 'from-pink-400 to-pink-600',
    xpReward: ACHIEVEMENT_XP_REWARD,
  },
];

export default function AchievementsPage({ 
  progress, 
  claimedAchievements, 
  onClaimAchievement, 
  backendAchievements,
  totalXp,
  currentLevel,
}: AchievementsPageProps) {
  
  // XP required per level
  const XP_PER_LEVEL_1_6 = 200;
  const XP_PER_LEVEL_7_PLUS = 300;

  // User starts at level 0
  // Level 0 = 0 XP, Level 1 = 200 XP, Level 2 = 400 XP, etc.
  
  // Current badge corresponds to current level
  const currentBadge = currentLevel > 0 
    ? BADGE_LIST.find(badge => badge.level === currentLevel) || null
    : null;
  
  // Next badge is at currentLevel + 1 (unless already at max level 10)
  const nextBadge = currentLevel < 10 ? BADGE_LIST.find(badge => badge.level === currentLevel + 1) : null;

  // XP CALCULATION (0-indexed levels)
  // Calculate total XP required to reach current level
  // Level 0 = 0 XP, Level 1 = 200 XP, Level 2 = 400 XP, Level 7 = 1500 XP
  const xpRequiredForCurrentLevel = currentLevel <= 6 
    ? currentLevel * XP_PER_LEVEL_1_6  // levels 0-6: level * 200
    : (6 * XP_PER_LEVEL_1_6) + ((currentLevel - 6) * XP_PER_LEVEL_7_PLUS); // level 7+: 1200 + (level-6) * 300

  // XP progress within current level (toward next level)
  const xpInCurrentLevel = totalXp - xpRequiredForCurrentLevel;

  // XP required for next level
  const xpRequiredForNextLevel = (currentLevel + 1) <= 6 ? XP_PER_LEVEL_1_6 : XP_PER_LEVEL_7_PLUS;

  // XP remaining until next level
  const xpUntilNextLevel = xpRequiredForNextLevel - xpInCurrentLevel;

  // Percentage progress to next level
  const progressPercentage = (xpInCurrentLevel / xpRequiredForNextLevel) * 100;

  // Merge backend achievement data with frontend UI definitions
  const achievements = backendAchievements.map(backendAchievement => {
    const uiData = ACHIEVEMENT_UI_LIST.find(ui => ui.id === backendAchievement.id);
    
    return {
      id: backendAchievement.id,
      title: backendAchievement.title,
      description: backendAchievement.description,
      current: backendAchievement.progress,
      requirement: backendAchievement.progressTarget,
      unlocked: backendAchievement.unlocked,
      // UI data from frontend
      icon: uiData?.icon || <Award className="size-8" />,
      color: uiData?.color || 'from-gray-400 to-gray-600',
      xpReward: uiData?.xpReward || ACHIEVEMENT_XP_REWARD,
    };
  });

  // Claim achievements that are unlocked but not yet claimed
  useEffect(() => {
    achievements.forEach(achievement => {
      if (achievement.unlocked && !claimedAchievements.includes(achievement.id)) {
        onClaimAchievement(achievement.id, achievement.xpReward);
      }
    });
  }, [achievements, claimedAchievements, onClaimAchievement]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Badge Collection</h1>
        <p className="text-lg text-gray-600">
          Level up to unlock new profile badges
        </p>
      </div>

      {/* How to Earn XP Section */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl shadow-md border border-green-200 p-6 mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">How to Earn XP</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white rounded-lg p-4 border border-green-200">
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="size-5 text-green-600" />
              <span className="font-semibold text-gray-900">Learn Words</span>
            </div>
            <p className="text-sm text-gray-600">+10 XP the first time you get a word right</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-green-200">
            <div className="flex items-center gap-2 mb-2">
              <Flame className="size-5 text-orange-600" />
              <span className="font-semibold text-gray-900">Study Streak</span>
            </div>
            <p className="text-sm text-gray-600">+15 XP per day of streak</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-green-200">
            <div className="flex items-center gap-2 mb-2">
              <Gamepad2 className="size-5 text-blue-600" />
              <span className="font-semibold text-gray-900">Play Games</span>
            </div>
            <p className="text-sm text-gray-600">+20 XP per game completed</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-green-200">
            <div className="flex items-center gap-2 mb-2">
              <Target className="size-5 text-purple-600" />
              <span className="font-semibold text-gray-900">Correct Answers</span>
            </div>
            <p className="text-sm text-gray-600">Tracked for achievements. XP is only awarded once per word</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-green-200">
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="size-5 text-yellow-600" />
              <span className="font-semibold text-gray-900">Achievements</span>
            </div>
            <p className="text-sm text-gray-600">+{ACHIEVEMENT_XP_REWARD} XP per achievement</p>
          </div>
        </div>
      </div>

      {/* Current Badge Display */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl shadow-md border border-purple-200 p-8 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Current Badge */}
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Current Badge</h2>
            {currentBadge ? (
              <div className="bg-white rounded-xl p-6 shadow-lg">
                <div className={`bg-gradient-to-br ${currentBadge.color} text-white p-6 rounded-xl w-fit mx-auto mb-4`}>
                  {currentBadge.icon}
                </div>
                <div className="text-center">
                  <h3 className="text-2xl font-bold text-gray-900 mb-1">{currentBadge.name}</h3>
                  <p className="text-sm text-gray-600">Level {currentBadge.level}</p>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl p-6 shadow-lg text-center">
                <div className="bg-gray-200 text-gray-400 p-6 rounded-xl w-fit mx-auto mb-4">
                  <Badge className="size-12" />
                </div>
                <p className="text-gray-600">No badge unlocked yet</p>
                <p className="text-sm text-gray-500 mt-2">Earn 200 XP to unlock your first badge!</p>
              </div>
            )}
          </div>

          {/* Next Badge Progress */}
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {currentLevel >= 10 ? 'Level Progress' : 'Next Badge'}
            </h2>
            {nextBadge ? (
              <div className="bg-white rounded-xl p-6 shadow-lg">
                <div className="bg-gray-100 p-6 rounded-xl w-fit mx-auto mb-4">
                  <div className={`bg-gradient-to-br ${nextBadge.color} text-white p-4 rounded-xl opacity-50`}>
                    {nextBadge.icon}
                  </div>
                </div>
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold text-gray-900 mb-1">{nextBadge.name}</h3>
                  <p className="text-sm text-gray-600">Level {nextBadge.level}</p>
                </div>

                {/* XP Progress Bar */}
                <div className="mb-4">
                  <div className="flex items-center justify-between text-sm text-gray-700 mb-2">
                    <span className="font-semibold">XP Progress</span>
                    <span className="font-semibold">{xpInCurrentLevel}/{xpRequiredForNextLevel} XP</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-purple-600 to-blue-600 h-4 rounded-full transition-all duration-500"
                      style={{ width: `${progressPercentage}%` }}
                    />
                  </div>
                  <p className="text-center text-sm text-gray-600 mt-2">
                    <span className="font-semibold text-purple-600">{xpUntilNextLevel} XP</span> until badge unlock
                  </p>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-gray-700 text-center">
                    Once unlocked, this badge will automatically become your profile picture!
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl p-6 shadow-lg text-center">
                {currentLevel >= 10 ? (
                  <>
                    <div className="bg-gradient-to-br from-yellow-400 to-orange-600 text-white p-6 rounded-xl w-fit mx-auto mb-4">
                      <Trophy className="size-12" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">Maximum Badge Unlocked!</h3>
                    <p className="text-gray-600 mb-4">You've unlocked all available badges!</p>
                    
                    {/* XP Progress Bar for level 10+ */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between text-sm text-gray-700 mb-2">
                        <span className="font-semibold">XP Progress</span>
                        <span className="font-semibold">{xpInCurrentLevel}/{xpRequiredForNextLevel} XP</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-purple-600 to-blue-600 h-4 rounded-full transition-all duration-500"
                          style={{ width: `${progressPercentage}%` }}
                        />
                      </div>
                      <p className="text-center text-sm text-gray-600 mt-2">
                        <span className="font-semibold text-purple-600">{xpUntilNextLevel} XP</span> until level {currentLevel + 1}
                      </p>
                    </div>
                    
                    <p className="text-sm text-gray-500">Keep learning to increase your level! 🎉</p>
                  </>
                ) : (
                  <>
                    <div className="bg-gray-200 text-gray-400 p-6 rounded-xl w-fit mx-auto mb-4">
                      <Badge className="size-12" />
                    </div>
                    <p className="text-gray-600">No next badge available</p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Level & Total XP Info */}
        <div className="mt-6 pt-6 border-t border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Current Level</p>
              <p className="text-2xl font-bold text-gray-900">Level {currentLevel}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">XP Until Next Level</p>
              <p className="text-2xl font-bold text-purple-600">{xpUntilNextLevel} XP</p>
            </div>
          </div>
        </div>
      </div>

      {/* All Badges Grid */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">All Badges</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {BADGE_LIST.map(badge => {
            const isUnlocked = badge.level <= currentLevel;
            const isCurrent = badge.level === currentLevel;
            const isNext = badge.level === currentLevel + 1;

            return (
              <div
                key={badge.id}
                className={`
                  rounded-xl shadow-md p-6 transition-all
                  ${isUnlocked 
                    ? 'bg-white border-2 border-gray-200' 
                    : 'bg-gray-50 border-2 border-gray-200 opacity-60'
                  }
                  ${isCurrent ? 'ring-4 ring-purple-400' : ''}
                  ${isNext ? 'ring-4 ring-blue-400' : ''}
                `}
              >
                <div
                  className={`
                    p-4 rounded-xl mx-auto mb-3 w-fit
                    ${isUnlocked 
                      ? `bg-gradient-to-br ${badge.color} text-white` 
                      : 'bg-gray-200 text-gray-400'
                    }
                  `}
                >
                  {badge.icon}
                </div>
                <div className="text-center">
                  <h3 className="font-bold text-gray-900 mb-1 text-sm">{badge.name}</h3>
                  <p className="text-xs text-gray-600">Level {badge.level}</p>
                  {isUnlocked && (
                    <div className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-green-600">
                      <Badge className="size-3" />
                      Unlocked
                    </div>
                  )}
                  {isCurrent && (
                    <div className="mt-2 text-xs font-semibold text-purple-600">
                      Current
                    </div>
                  )}
                  {isNext && (
                    <div className="mt-2 text-xs font-semibold text-blue-600">
                      Next
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Achievements Grid */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Achievements</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {achievements.map(achievement => {
            const isUnlocked = achievement.unlocked;
            const progressPercentage = Math.min((achievement.current / achievement.requirement) * 100, 100);

            return (
              <div
                key={achievement.id}
                className={`
                  rounded-xl shadow-md p-6 transition-all
                  ${isUnlocked 
                    ? 'bg-white border-2 border-gray-200' 
                    : 'bg-gray-50 border-2 border-gray-200 opacity-60'
                  }
                `}
              >
                <div
                  className={`
                    p-4 rounded-xl mx-auto mb-3 w-fit
                    ${isUnlocked 
                      ? `bg-gradient-to-br ${achievement.color} text-white` 
                      : 'bg-gray-200 text-gray-400'
                    }
                  `}
                >
                  {achievement.icon}
                </div>
                <div className="text-center mb-4">
                  <h3 className="font-bold text-gray-900 mb-1 text-sm">{achievement.title}</h3>
                  <p className="text-xs text-gray-600">{achievement.description}</p>
                </div>

                {/* Progress Bar */}
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-gray-700 mb-2">
                    <span className="font-semibold">Progress</span>
                    <span className="font-semibold">
                      {achievement.current}/{achievement.requirement}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${
                        isUnlocked 
                          ? `bg-gradient-to-r ${achievement.color.replace('from-', 'from-').replace('to-', 'to-')}` 
                          : 'bg-gray-400'
                      }`}
                      style={{ width: `${progressPercentage}%` }}
                    />
                  </div>
                  {isUnlocked && (
                    <div className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-green-600">
                      <Badge className="size-3" />
                      Unlocked • +{achievement.xpReward} XP
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}