PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;
PRAGMA foreign_keys = ON;

-- ============================================================
-- USERS + USER STATS
-- ============================================================

CREATE TABLE IF NOT EXISTS badges (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  img_url TEXT,
  xp_threshold INTEGER NOT NULL CHECK (xp_threshold >= 0)
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,                 -- 'user1'..'user10'
  alias TEXT,
  start_date TEXT NOT NULL DEFAULT (datetime('now')),

  total_xp INTEGER NOT NULL DEFAULT 0 CHECK (total_xp >= 0),
  level INTEGER NOT NULL DEFAULT 1 CHECK (level >= 1),

  study_streak INTEGER NOT NULL DEFAULT 0 CHECK (study_streak >= 0),
  last_streak_date TEXT NULL,          -- 'YYYY-MM-DD' (daily streak tracking)

  words_learned INTEGER NOT NULL DEFAULT 0 CHECK (words_learned >= 0),
  correct_words INTEGER NOT NULL DEFAULT 0 CHECK (correct_words >= 0),
  completed_minigames INTEGER NOT NULL DEFAULT 0 CHECK (completed_minigames >= 0),

  current_badge_id INTEGER NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (current_badge_id) REFERENCES badges(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_users_badge ON users(current_badge_id);

-- Seed demo users (optional)
-- INSERT OR IGNORE INTO users (id) VALUES
-- ('user1'),('user2'),('user3'),('user4'),('user5'),
-- ('user6'),('user7'),('user8'),('user9'),('user10');

-- ============================================================
-- CURRICULUM STRUCTURE: SECTIONS -> LESSONS -> WORDS
-- ============================================================

CREATE TABLE IF NOT EXISTS sections (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS lessons (
  id INTEGER PRIMARY KEY,
  section_id INTEGER NOT NULL,
  name TEXT NOT NULL,

  FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_lessons_section ON lessons(section_id);

CREATE TABLE IF NOT EXISTS words (
  id INTEGER PRIMARY KEY,
  lesson_id INTEGER NOT NULL,
  romaji TEXT NOT NULL,
  english TEXT NOT NULL,
  audio_url TEXT,

  FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_words_lesson ON words(lesson_id);

-- ============================================================
-- LESSON PROGRESS (flashcards + exercise score)
-- Keyed by (user_id, section_num, lesson)
-- Note: lesson here is app lesson type, not lessons table row.
-- ============================================================

CREATE TABLE IF NOT EXISTS lesson_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,

  section_num INTEGER NOT NULL CHECK (section_num >= 1),
  lesson TEXT NOT NULL CHECK (lesson IN ('lesson1','lesson2','lesson3','test')),

  flashcard_progress INTEGER NOT NULL DEFAULT 0 CHECK (flashcard_progress BETWEEN 0 AND 100),
  score INTEGER NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
  completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0,1)),

  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  UNIQUE (user_id, section_num, lesson),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_lesson_progress_user ON lesson_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_user_section ON lesson_progress(user_id, section_num);

-- ============================================================
-- SECTION TEST SCORES (per user + section)
-- ============================================================

CREATE TABLE IF NOT EXISTS section_test_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  section_num INTEGER NOT NULL CHECK (section_num >= 1),
  score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
  completed_at TEXT NOT NULL DEFAULT (datetime('now')),

  UNIQUE (user_id, section_num),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_section_test_user ON section_test_scores(user_id);

-- ============================================================
-- DAILY WORD STATS (your request)
-- This stores per-day stats for analytics/progress:
-- - times_asked, times_correct, avg_response_time
-- - asked_today is implicit if a row exists for today
-- ============================================================

CREATE TABLE IF NOT EXISTS user_word_daily_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  word_id INTEGER NOT NULL,

  stat_date TEXT NOT NULL, -- 'YYYY-MM-DD'

  times_asked INTEGER NOT NULL DEFAULT 0 CHECK (times_asked >= 0),
  times_correct INTEGER NOT NULL DEFAULT 0 CHECK (times_correct >= 0),
  avg_response_time REAL NULL CHECK (avg_response_time IS NULL OR avg_response_time >= 0),

  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  UNIQUE (user_id, word_id, stat_date),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_word_daily_user_date ON user_word_daily_stats(user_id, stat_date);
CREATE INDEX IF NOT EXISTS idx_word_daily_word ON user_word_daily_stats(word_id);

-- ============================================================
-- WORD "MASTER" STATUS PER USER (minimal, not redundant)
-- This is needed to support:
-- - "Words learned (first time correct)" XP rule
-- Without this, you'd have to scan all daily rows.
-- ============================================================

CREATE TABLE IF NOT EXISTS user_word_mastery (
  user_id TEXT NOT NULL,
  word_id INTEGER NOT NULL,

  first_correct_at TEXT NULL,   -- set once when user gets first correct ever
  total_asked_lifetime INTEGER NOT NULL DEFAULT 0 CHECK (total_asked_lifetime >= 0),
  total_correct_lifetime INTEGER NOT NULL DEFAULT 0 CHECK (total_correct_lifetime >= 0),

  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  PRIMARY KEY (user_id, word_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_word_mastery_user ON user_word_mastery(user_id);

-- ============================================================
-- ACHIEVEMENTS + USER ACHIEVEMENTS (progress bars)
-- Achievements table is static definitions.
-- UserAchievements stores progress + unlocked state per user.
-- ============================================================

CREATE TABLE IF NOT EXISTS achievements (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  target_progress INTEGER NOT NULL DEFAULT 1 CHECK (target_progress >= 1) -- for progress bars
);

CREATE TABLE IF NOT EXISTS user_achievements (
  user_id TEXT NOT NULL,
  achievement_id INTEGER NOT NULL,

  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0),
  unlocked INTEGER NOT NULL DEFAULT 0 CHECK (unlocked IN (0,1)),
  unlocked_at TEXT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  PRIMARY KEY (user_id, achievement_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (achievement_id) REFERENCES achievements(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id);

-- ============================================================
-- STUDY SESSIONS (analytics only)
-- ============================================================

CREATE TABLE IF NOT EXISTS study_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,

  start_time TEXT NOT NULL,  -- datetime
  end_time TEXT NOT NULL,    -- datetime
  session_date TEXT NOT NULL, -- 'YYYY-MM-DD'

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_date ON study_sessions(user_id, session_date);

-- ============================================================
-- MINIGAME SCORES (leaderboard)
-- You want: score, date, section, difficulty; top 10 per user.
-- ============================================================

CREATE TABLE IF NOT EXISTS minigame_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,

  score INTEGER NOT NULL CHECK (score >= 0),
  difficulty TEXT NOT NULL,
  section_num INTEGER NULL CHECK (section_num IS NULL OR section_num >= 1),

  played_at TEXT NOT NULL DEFAULT (datetime('now')), -- datetime
  played_date TEXT NOT NULL DEFAULT (date('now')),   -- 'YYYY-MM-DD'

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_minigame_user_score ON minigame_scores(user_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_minigame_user_date ON minigame_scores(user_id, played_date);
CREATE INDEX IF NOT EXISTS idx_minigame_difficulty_score ON minigame_scores(difficulty, score DESC);
