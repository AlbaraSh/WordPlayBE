1) Lesson progress (per userId + sectionNum + lesson)
Fields
    flashcardProgress (0–100)
    score (0–100)
    completed (boolean)
    updatedAt
Key (userId, sectionNum, lesson)

2) Section test scores (per userId + sectionNum)
Fields
    score (0–100)
    updatedAt
Key (userId, sectionNum)

3) User stats (per userId) These are global totals.
Fields
    totalXp (number)
    currentLevel (number)
    wordsLearned (number) ← count of first-time correct
    correctAnswers (number) ← total correct (or lifetime correct)
    completedMinigames (number)
    studyStreak (number) ← careful: define exact streak rule (daily? per lesson?)
    lastStudyDate (date) ← needed if streak is daily
Key (userId)

4) Achievements (per userId + achievementId)
Achievements are best modeled as a lookup + user progress.
Fields
    achievementId
    unlocked (boolean)
    progress (number)
    unlockedAt (date|null)
Key (userId, achievementId)

5) Badges (per userId + badgeId)
Fields
    badgeId
    unlocked (boolean)
    xpToNextBadge (number) ← or compute this from totalXp + badge thresholds
    unlockedAt (date|null)
Key (userId, badgeId)

6) Leaderboard entries (per run/attempt)
This is usually an append-only table.
Fields
    userId
    score (number)
    difficulty (string)
    completedAt (date)
Key id (PK), plus indexes on (difficulty, completedAt) and maybe (score)




Data Models:

LessonProgress
    Unique key: (userId, sectionNum, lesson)

    lesson: "lesson1" | "lesson2" | "lesson3" | "test"
    flashcardProgress: 0..100
    score: 0..100
    completed: boolean
    updatedAt: ISO string

SectionTestScore
    Unique key: (userId, sectionNum)

    score: 0..100
    completedAt: ISO string

UserStats
    Unique key: (userId)

    totalXp: number
    currentLevel: number
    studyStreak: number
    lastStreakDate: "YYYY-MM-DD" // UTC date string (or user-local if you prefer)
    wordsLearned: number
    correctAnswers: number
    completedMinigames: number
    updatedAt: ISO string

AchievementProgress
    Unique key: (userId, achievementId)

    achievementId: string
    unlocked: boolean
    progress: number
    unlockedAt: ISO string | null
    updatedAt: ISO string

BadgeProgress           Badges are derived from XP thresholds, but you can also persist unlocked status for quick reads.
    Unique key: (userId, badgeIndex) where badgeIndex is 1..10

    badgeIndex: 1..10
    unlocked: boolean
    unlockedAt: ISO string | null

LeaderboardEntry Append-only
    id: string
    score: number
    difficulty: string
    completedAt: ISO string



ENDPOINTS:

GET /api/progress
    Returns all progress data needed to hydrate the frontend.
Return Json
{
  "lessonStats": {
    "1-lesson1": { "completed": true, "score": 85, "flashcardProgress": 100 },
    "1-lesson2": { "completed": true, "score": 92, "flashcardProgress": 100 }
  },
  "sectionTestScores": {
    "1": 88,
    "2": 75
  },
  "userStats": {
    "totalXp": 420,
    "currentLevel": 3,
    "studyStreak": 5,
    "lastStreakDate": "2026-01-27",
    "wordsLearned": 120,
    "correctAnswers": 980,
    "completedMinigames": 12,
    "updatedAt": "2026-01-27T10:10:10.000Z"
  },
  "achievements": [
    { "achievementId": "first_lesson", "unlocked": true, "progress": 1, "unlockedAt": "2026-01-10T10:00:00.000Z", "updatedAt": "2026-01-10T10:00:00.000Z" }
  ],
  "badges": {
    "currentBadgeIndex": 4,
    "nextBadgeIndex": 5,
    "nextBadgeXpThreshold": 500,
    "xpToNextBadge": 80
  }
}


Update lesson progress      Upserts a lesson progress row.
    PATCH /api/progress/lesson
    {
        "sectionNum": 1,
        "lesson": "lesson1",
        "flashcardProgress": 100,
        "score": 85,
        "completed": true
    }
return json
{
  "key": "1-lesson1",
  "stats": { "completed": true, "score": 85, "flashcardProgress": 100 }
}


Update section test score      Upserts a section test score row.
    PATCH /api/progress/section-test
    { "sectionNum": 1, "score": 88 }
return json
Response 200  { "sectionNum": 1, "score": 88 }


Minigame completion
    POST /api/minigames/complete
    {
        "minigameId": "speed_match",
        "difficulty": "easy",
        "score": 2300,
        "completedAt": "2026-01-27T10:00:00.000Z",
        "createLeaderboardEntry": true
    }


XP / leveling / achievements updates
    POST /api/events
    {
        "type": "LESSON_EXERCISE_COMPLETED"
    }

    Other valid type values:
        MINIGAME_COMPLETED (includes minigameId, difficulty, score)
        SECTION_TEST_COMPLETED (includes sectionNum, score)
        WORD_ANSWERED (includes wordId, correct, firstTimeCorrect boolean if you want backend to decide instead)
response json
{
  "xpAwarded": 40,
  "userStats": { "totalXp": 560, "currentLevel": 3, "studyStreak": 6, "lastStreakDate": "2026-01-27" },
  "badges": { "currentBadgeIndex": 5, "nextBadgeXpThreshold": 700, "xpToNextBadge": 140 },
  "achievementsUnlocked": ["first_lesson"]
}


GET /api/leaderboard
response json
{
  "entries": [
    { "userId": "u1", "score": 4000, "completedAt": "2026-01-26T12:00:00.000Z", "section": "Section 1", "difficulty": "easy"}
  ]
}

POST /api/leaderboard
    { "difficulty": "easy", "score": 2300, "completedAt": "2026-01-27T10:00:00.000Z" }