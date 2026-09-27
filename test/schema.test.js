import assert from 'node:assert/strict';
import test from 'node:test';
import { openDb } from '../db.js';
import { initSchemaAndSeed } from '../schema-init.js';

test('starting again does not erase accounts or progress', () => {
  const db = openDb(':memory:');
  initSchemaAndSeed(db);
  const user = db.prepare(`
    INSERT INTO users (email, password_hash, display_name, total_xp, words_learned)
    VALUES ('ada@example.com', 'hash', 'Ada', 40, 1)
  `).run();
  db.prepare(`
    INSERT INTO lesson_progress (user_id, course_id, section_num, lesson, flashcard_progress, score, completed)
    VALUES (?, 1, 1, 'lesson1', 100, 80, 1)
  `).run(user.lastInsertRowid);

  initSchemaAndSeed(db);

  const saved = db.prepare(`SELECT display_name, total_xp, words_learned FROM users WHERE email = ?`).get('ada@example.com');
  assert.equal(saved.display_name, 'Ada');
  assert.equal(saved.total_xp, 40);
  assert.equal(saved.words_learned, 1);
  const lesson = db.prepare(`SELECT score FROM lesson_progress WHERE user_id = ?`).get(user.lastInsertRowid);
  assert.equal(lesson.score, 80);
  assert.equal(db.prepare(`SELECT version FROM schema_meta`).get().version, 3);
  assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM words`).get().n, 64);
});
