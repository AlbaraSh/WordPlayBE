PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_meta (
  version INTEGER PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  total_xp INTEGER NOT NULL DEFAULT 0 CHECK (total_xp >= 0),
  level INTEGER NOT NULL DEFAULT 0 CHECK (level >= 0),
  study_streak INTEGER NOT NULL DEFAULT 0 CHECK (study_streak >= 0),
  last_streak_date TEXT,
  words_learned INTEGER NOT NULL DEFAULT 0 CHECK (words_learned >= 0),
  correct_words INTEGER NOT NULL DEFAULT 0 CHECK (correct_words >= 0),
  completed_minigames INTEGER NOT NULL DEFAULT 0 CHECK (completed_minigames >= 0),
  current_badge_id INTEGER,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS courses (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1))
);

CREATE TABLE IF NOT EXISTS sections (
  course_id INTEGER NOT NULL,
  section_num INTEGER NOT NULL CHECK (section_num >= 1),
  name TEXT NOT NULL,
  PRIMARY KEY (course_id, section_num),
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS words (
  id INTEGER PRIMARY KEY,
  course_id INTEGER NOT NULL,
  section_num INTEGER NOT NULL,
  lesson_num INTEGER NOT NULL CHECK (lesson_num BETWEEN 1 AND 3),
  category TEXT NOT NULL,
  romaji TEXT NOT NULL,
  english TEXT NOT NULL,
  FOREIGN KEY (course_id, section_num) REFERENCES sections(course_id, section_num) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_words_course_section ON words(course_id, section_num, lesson_num);

CREATE TABLE IF NOT EXISTS lesson_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  course_id INTEGER NOT NULL,
  section_num INTEGER NOT NULL CHECK (section_num >= 1),
  lesson TEXT NOT NULL CHECK (lesson IN ('lesson1', 'lesson2', 'lesson3', 'test')),
  flashcard_progress INTEGER NOT NULL DEFAULT 0 CHECK (flashcard_progress BETWEEN 0 AND 100),
  score INTEGER NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
  completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, course_id, section_num, lesson),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS section_test_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  course_id INTEGER NOT NULL,
  section_num INTEGER NOT NULL CHECK (section_num >= 1),
  score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
  best_score INTEGER NOT NULL DEFAULT 0 CHECK (best_score BETWEEN 0 AND 100),
  completed_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, course_id, section_num),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_word_daily_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  word_id INTEGER NOT NULL,
  stat_date TEXT NOT NULL,
  times_asked INTEGER NOT NULL DEFAULT 0 CHECK (times_asked >= 0),
  times_correct INTEGER NOT NULL DEFAULT 0 CHECK (times_correct >= 0),
  avg_response_time REAL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, word_id, stat_date),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_word_mastery (
  user_id INTEGER NOT NULL,
  word_id INTEGER NOT NULL,
  first_correct_at TEXT,
  total_asked_lifetime INTEGER NOT NULL DEFAULT 0 CHECK (total_asked_lifetime >= 0),
  total_correct_lifetime INTEGER NOT NULL DEFAULT 0 CHECK (total_correct_lifetime >= 0),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, word_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS achievements (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  progress_target INTEGER NOT NULL CHECK (progress_target >= 1),
  stat TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_achievements (
  user_id INTEGER NOT NULL,
  achievement_id TEXT NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0),
  unlocked INTEGER NOT NULL DEFAULT 0 CHECK (unlocked IN (0, 1)),
  unlocked_date TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, achievement_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (achievement_id) REFERENCES achievements(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS study_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  total_duration TEXT NOT NULL,
  session_date TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS minigame_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  course_id INTEGER NOT NULL,
  score INTEGER NOT NULL CHECK (score >= 0),
  difficulty TEXT NOT NULL,
  section_num INTEGER,
  played_at TEXT NOT NULL DEFAULT (datetime('now')),
  played_date TEXT NOT NULL DEFAULT (date('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_minigame_user_score ON minigame_scores(user_id, score DESC);
