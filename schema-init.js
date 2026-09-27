import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { vocabularyData } from './seed/words.js';

const SCHEMA_VERSION = 3;

const SECTION_NAMES = {
  1: 'Weather',
  2: 'Colors',
  3: 'Numbers',
  4: 'Days & Months',
  5: 'Everyday',
  6: 'Adjectives',
};

const WORD_COUNT = vocabularyData.length;

export const ACHIEVEMENTS = [
  { id: 'first_word', title: 'First Steps', description: 'Learn your first word', target: 1, stat: 'words_learned' },
  { id: 'vocab_5', title: 'Word Explorer', description: 'Learn 5 words', target: 5, stat: 'words_learned' },
  { id: 'vocab_10', title: 'Vocabulary Builder', description: 'Learn 10 words', target: 10, stat: 'words_learned' },
  { id: 'vocab_25', title: 'Language Enthusiast', description: 'Learn 25 words', target: 25, stat: 'words_learned' },
  { id: 'streak_3', title: 'Consistent Learner', description: 'Maintain a 3-day study streak', target: 3, stat: 'study_streak' },
  { id: 'streak_7', title: 'Week Warrior', description: 'Maintain a 7-day study streak', target: 7, stat: 'study_streak' },
  { id: 'game_1', title: 'Game On', description: 'Complete your first game', target: 1, stat: 'completed_minigames' },
  { id: 'game_5', title: 'Game Master', description: 'Complete 5 games', target: 5, stat: 'completed_minigames' },
  { id: 'correct_10', title: 'Sharp Mind', description: 'Get 10 correct answers', target: 10, stat: 'correct_words' },
  { id: 'correct_50', title: 'Accuracy Expert', description: 'Get 50 correct answers', target: 50, stat: 'correct_words' },
  { id: 'vocab_master', title: 'Vocabulary Master', description: `Learn all ${WORD_COUNT} words`, target: WORD_COUNT, stat: 'words_learned' },
  { id: 'perfectionist', title: 'Perfectionist', description: 'Get 100 correct answers', target: 100, stat: 'correct_words' },
];

export function createUserAchievements(db, userId) {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO user_achievements (user_id, achievement_id)
    VALUES (?, ?)
  `);
  for (const achievement of ACHIEVEMENTS) insert.run(userId, achievement.id);
}

function currentVersion(db) {
  const exists = db.prepare(`
    SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'schema_meta'
  `).get();
  if (!exists) return 0;
  return db.prepare(`SELECT version FROM schema_meta LIMIT 1`).get()?.version ?? 0;
}

function applySchema(db) {
  const schemaPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'sql', 'schema.sql');
  db.exec(fs.readFileSync(schemaPath, 'utf-8'));
}

export function initSchemaAndSeed(db) {
  // Additive only. A version bump must not drop user data.
  applySchema(db);

  const insertCourse = db.prepare(`INSERT OR IGNORE INTO courses (id, name, is_default) VALUES (1, 'Starter', 1)`);
  const insertSection = db.prepare(`
    INSERT OR IGNORE INTO sections (course_id, section_num, name) VALUES (1, ?, ?)
  `);
  const insertWord = db.prepare(`
    INSERT OR IGNORE INTO words (id, course_id, section_num, lesson_num, category, romaji, english)
    VALUES (?, 1, ?, ?, ?, ?, ?)
  `);
  const insertAchievement = db.prepare(`
    INSERT INTO achievements (id, title, description, progress_target, stat)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      description = excluded.description,
      progress_target = excluded.progress_target,
      stat = excluded.stat
  `);

  const tx = db.transaction(() => {
    insertCourse.run();
    for (const word of vocabularyData) {
      insertSection.run(word.section, SECTION_NAMES[word.section] ?? `Section ${word.section}`);
      insertWord.run(word.id, word.section, word.lessonNum, word.category, word.word, word.translation);
    }
    for (const achievement of ACHIEVEMENTS) {
      insertAchievement.run(achievement.id, achievement.title, achievement.description, achievement.target, achievement.stat);
    }
  });
  tx();

  if (currentVersion(db) !== SCHEMA_VERSION) {
    db.prepare(`DELETE FROM schema_meta`).run();
    db.prepare(`INSERT INTO schema_meta (version) VALUES (?)`).run(SCHEMA_VERSION);
  }
}

export function getDefaultCourseId(db) {
  const row = db.prepare(`SELECT id FROM courses WHERE is_default = 1 ORDER BY id LIMIT 1`).get();
  if (!row) throw new Error('No default course');
  return row.id;
}

export function getOwnedCourseId(db, userId) {
  const row = db.prepare(`SELECT id FROM courses WHERE owner_user_id = ?`).get(userId);
  return row?.id ?? null;
}

export function getActiveCourseId(db, userId) {
  return getOwnedCourseId(db, userId) ?? getDefaultCourseId(db);
}
