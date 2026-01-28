import fs from 'fs';
import path from 'path';
import { vocabularyData } from './seed/words.js';

const ALLOWED_USERS = Array.from({ length: 10 }, (_, i) => `user${i + 1}`);

const SECTION_NAMES = {
  1: 'Weather',
  2: 'Colors',
  3: 'Numbers',
  4: 'Days & Months',
  5: 'Everyday',
  6: 'Adjectives',
};

// Achievement definitions (seeded into user_achievements for each user)
const ACHIEVEMENTS = [
  { id: 'first_word',     title: 'First Steps',         description: 'Learn your first word',                target: 1 },
  { id: 'vocab_5',        title: 'Word Explorer',       description: 'Learn 5 words',                       target: 5 },
  { id: 'vocab_10',       title: 'Vocabulary Builder',  description: 'Learn 10 words',                      target: 10 },
  { id: 'vocab_25',       title: 'Language Enthusiast', description: 'Learn 25 words',                      target: 25 },
  { id: 'streak_3',       title: 'Consistent Learner',  description: 'Maintain a 3-day study streak',       target: 3 },
  { id: 'streak_7',       title: 'Week Warrior',        description: 'Maintain a 7-day study streak',       target: 7 },
  { id: 'game_1',         title: 'Game On',             description: 'Complete your first game',            target: 1 },
  { id: 'game_5',         title: 'Game Master',         description: 'Complete 5 games',                    target: 5 },
  { id: 'correct_10',     title: 'Sharp Mind',          description: 'Get 10 correct answers',              target: 10 },
  { id: 'correct_50',     title: 'Accuracy Expert',     description: 'Get 50 correct answers',              target: 50 },
  { id: 'vocab_master',   title: 'Vocabulary Master',   description: 'Learn all 28 words',                  target: 28 },
  { id: 'perfectionist',  title: 'Perfectionist',       description: 'Get 100 correct answers',             target: 100 },
];

export function initSchemaAndSeed(db) {
  const schemaPath = path.join(process.cwd(), 'sql', 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf-8');

  // Create tables
  db.exec(schemaSql);

  // Users
  const insertUser = db.prepare(`
    INSERT OR IGNORE INTO users (id)
    VALUES (?)
  `);

  // Sections
  const insertSection = db.prepare(`
    INSERT OR IGNORE INTO sections (id, name)
    VALUES (?, ?)
  `);

  // Words
  const insertWord = db.prepare(`
    INSERT OR IGNORE INTO words
      (id, section_num, lesson_num, category, romaji, english)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  // Achievements per user
  const insertUserAchievement = db.prepare(`
    INSERT OR IGNORE INTO user_achievements
      (user_id, achievement_id, title, description, progress_target, progress, unlocked, unlocked_date, updated_at)
    VALUES
      (?, ?, ?, ?, ?, 0, 0, NULL, datetime('now'))
  `);

  const tx = db.transaction(() => {
    // 1) Seed users
    for (const id of ALLOWED_USERS) {
      insertUser.run(id);
    }

    // 2) Seed sections + words
    for (const w of vocabularyData) {
      const sectionName = SECTION_NAMES[w.section] ?? `Section ${w.section}`;
      insertSection.run(w.section, sectionName);

      insertWord.run(
        w.id,
        w.section,
        w.lessonNum,
        w.category,
        w.word,
        w.translation
      );
    }

    // 3) Seed achievements for every user (progress=0, unlocked=0)
    for (const userId of ALLOWED_USERS) {
      for (const a of ACHIEVEMENTS) {
        insertUserAchievement.run(
          userId,
          a.id,
          a.title,
          a.description,
          a.target
        );
      }
    }
  });

  tx();

  console.log(`✅ Seeded ${ALLOWED_USERS.length} users`);
  console.log(`✅ Seeded ${vocabularyData.length} words`);
  console.log(`✅ Seeded ${ALLOWED_USERS.length * ACHIEVEMENTS.length} user_achievement rows`);
}
