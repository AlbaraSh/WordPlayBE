import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { openDb } from '../db.js';
import { initSchemaAndSeed } from '../schema-init.js';
import { createApp } from '../src/createApp.js';

let server;
let base;
let db;

function cookieFrom(res) {
  const cookies = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  const line = cookies[0] || '';
  return line.split(';')[0];
}

async function api(path, { method = 'GET', body, cookie } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data, cookie: cookieFrom(res) || cookie };
}

before(async () => {
  db = openDb(':memory:');
  initSchemaAndSeed(db);
  server = createApp(db).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server?.close();
});

test('health is public and progress requires login', async () => {
  const health = await api('/api/health');
  assert.equal(health.status, 200);
  assert.equal(health.data.ok, true);

  const progress = await api('/api/progress');
  assert.equal(progress.status, 401);
});

test('register, login, and isolated progress', async () => {
  const registered = await api('/api/auth/register', {
    method: 'POST',
    body: { email: 'ada@example.com', password: 'password1', displayName: 'Ada' },
  });
  assert.equal(registered.status, 201);
  assert.equal(registered.data.user.displayName, 'Ada');
  assert.ok(registered.cookie.startsWith('sid='));

  const duplicate = await api('/api/auth/register', {
    method: 'POST',
    body: { email: 'ada@example.com', password: 'password1', displayName: 'Ada' },
  });
  assert.equal(duplicate.status, 409);

  const badLogin = await api('/api/auth/login', {
    method: 'POST',
    body: { email: 'ada@example.com', password: 'wrong-password' },
  });
  assert.equal(badLogin.status, 401);

  const words = await api('/api/progress/words', { cookie: registered.cookie });
  assert.equal(words.status, 200);
  assert.equal(words.data.sections.length, 6);
  assert.equal(words.data.words.length, 64);

  const first = await api('/api/events/word-answered', {
    method: 'POST',
    cookie: registered.cookie,
    body: { wordId: 1, isCorrect: true, responseTimeMs: 800 },
  });
  assert.equal(first.status, 200);
  assert.equal(first.data.wasFirstCorrectEver, true);
  assert.equal(first.data.xpAwarded, 40);
  assert.equal(first.data.level, 0);

  const second = await api('/api/events/word-answered', {
    method: 'POST',
    cookie: registered.cookie,
    body: { wordId: 1, isCorrect: true, responseTimeMs: 400 },
  });
  assert.equal(second.data.xpAwarded, 0);
  assert.equal(second.data.wasFirstCorrectEver, false);

  const low = await api('/api/progress/section-test', {
    method: 'PATCH',
    cookie: registered.cookie,
    body: { sectionNum: 1, score: 70 },
  });
  const lower = await api('/api/progress/section-test', {
    method: 'PATCH',
    cookie: registered.cookie,
    body: { sectionNum: 1, score: 40 },
  });
  assert.equal(lower.data.latest, 40);
  assert.equal(lower.data.best, 70);

  const other = await api('/api/auth/register', {
    method: 'POST',
    body: { email: 'bea@example.com', password: 'password1', displayName: 'Bea' },
  });
  const otherProgress = await api('/api/progress', { cookie: other.cookie });
  assert.equal(otherProgress.data.userStats.wordsLearned, 0);
  assert.deepEqual(otherProgress.data.sectionTestScores, {});

  const mine = await api('/api/progress', { cookie: registered.cookie });
  assert.equal(mine.data.userStats.wordsLearned, 1);
  assert.equal(mine.data.sectionTestScores['1'].best, 70);
  const master = mine.data.achievements.find((item) => item.id === 'vocab_master');
  assert.equal(master.progressTarget, 64);

  const loggedOut = await api('/api/auth/logout', { method: 'POST', cookie: registered.cookie });
  const after = await api('/api/auth/me', { cookie: loggedOut.cookie });
  assert.equal(after.status, 401);
});

test('import replaces the starter list and reset restores it', async () => {
  const user = await api('/api/auth/register', {
    method: 'POST',
    body: { email: 'cara@example.com', password: 'password1', displayName: 'Cara' },
  });
  const learned = await api('/api/events/word-answered', {
    method: 'POST',
    cookie: user.cookie,
    body: { wordId: 2, isCorrect: true, responseTimeMs: 500 },
  });
  assert.equal(learned.status, 200);
  const xpBeforeImport = learned.data.totalXp;

  const csv = ['term,translation,section', ...Array.from({ length: 16 }, (_, i) => `t${i},m${i},Food`)].join('\n');
  const preview = await api('/api/vocab/preview', { method: 'POST', cookie: user.cookie, body: { csv } });
  assert.equal(preview.status, 200);
  assert.equal(preview.data.wordCount, 16);
  assert.equal(preview.data.sections[0].lessons.length, 4);
  assert.equal(preview.data.replacesCustom, false);

  const stillStarter = await api('/api/progress/words', { cookie: user.cookie });
  assert.equal(stillStarter.data.words.length, 64);
  assert.equal(stillStarter.data.custom, false);

  const imported = await api('/api/vocab/import', { method: 'POST', cookie: user.cookie, body: { csv } });
  assert.equal(imported.status, 200);

  const words = await api('/api/progress/words', { cookie: user.cookie });
  assert.equal(words.data.custom, true);
  assert.equal(words.data.words.length, 16);
  assert.equal(words.data.sections[0].name, 'Food');
  assert.equal(Math.max(...words.data.words.map((word) => word.lessonNum)), 4);

  const hidden = await api('/api/events/word-answered', {
    method: 'POST',
    cookie: user.cookie,
    body: { wordId: 2, isCorrect: true, responseTimeMs: 100 },
  });
  assert.equal(hidden.status, 400);

  const customWordId = words.data.words[0].id;
  const answered = await api('/api/events/word-answered', {
    method: 'POST',
    cookie: user.cookie,
    body: { wordId: customWordId, isCorrect: true, responseTimeMs: 300 },
  });
  assert.equal(answered.status, 200);
  assert.equal(answered.data.wasFirstCorrectEver, true);

  const lesson = await api('/api/progress/lesson', {
    method: 'PATCH',
    cookie: user.cookie,
    body: { sectionNum: 1, lesson: 'lesson4', flashcardProgress: 100, score: 80, completed: true },
  });
  assert.equal(lesson.status, 200);

  const score = await api('/api/leaderboard', {
    method: 'POST',
    cookie: user.cookie,
    body: { score: 30, difficulty: 'beginner', sectionNum: null },
  });
  assert.equal(score.status, 201);
  assert.equal(score.data.sectionNum, null);

  const other = await api('/api/auth/login', {
    method: 'POST',
    body: { email: 'bea@example.com', password: 'password1' },
  });
  const otherWords = await api('/api/progress/words', { cookie: other.cookie });
  assert.equal(otherWords.data.words.length, 64);
  assert.equal(otherWords.data.custom, false);

  const replaced = await api('/api/vocab/import', {
    method: 'POST',
    cookie: user.cookie,
    body: { csv: 'alpha,one\nbeta,two\n' },
  });
  assert.equal(replaced.status, 200);
  const afterReplace = await api('/api/progress/words', { cookie: user.cookie });
  assert.equal(afterReplace.data.words.length, 2);
  assert.equal(afterReplace.data.words.some((word) => word.romaji === 't0'), false);
  assert.equal(afterReplace.data.words.some((word) => word.romaji === 'alpha'), true);

  const reset = await api('/api/vocab/reset', { method: 'POST', cookie: user.cookie });
  assert.equal(reset.status, 200);
  const restored = await api('/api/progress/words', { cookie: user.cookie });
  assert.equal(restored.data.custom, false);
  assert.equal(restored.data.words.length, 64);

  const progress = await api('/api/progress', { cookie: user.cookie });
  assert.ok(progress.data.userStats.totalXp > xpBeforeImport);
  assert.equal(progress.data.userStats.wordsLearned, 2);
  assert.equal(progress.data.sectionTestScores['1'], undefined);
  assert.equal(progress.data.lessonStats['1-lesson4'], undefined);

  const board = await api('/api/leaderboard/top10', { cookie: user.cookie });
  assert.equal(board.data.top10.some((row) => row.score === 30 && row.sectionNum == null), true);

  const again = await api('/api/vocab/reset', { method: 'POST', cookie: user.cookie });
  assert.equal(again.status, 400);

  const empty = await api('/api/vocab/preview', { method: 'POST', cookie: user.cookie, body: { csv: 'term,translation\n' } });
  assert.equal(empty.status, 400);

  const absurd = await api('/api/leaderboard', {
    method: 'POST',
    cookie: user.cookie,
    body: { score: 999999, difficulty: 'godmode', sectionNum: null },
  });
  assert.equal(absurd.status, 400);
});

test('study time is returned with progress', async () => {
  const user = await api('/api/auth/register', {
    method: 'POST',
    body: { email: 'dora@example.com', password: 'password1', displayName: 'Dora' },
  });
  const session = await api('/api/events/study-session', {
    method: 'POST',
    cookie: user.cookie,
    body: {
      startTime: '2026-01-28T14:00:00.000Z',
      endTime: '2026-01-28T14:25:00.000Z',
      totalDuration: '00:25:00',
    },
  });
  assert.equal(session.status, 201);

  const progress = await api('/api/progress', { cookie: user.cookie });
  assert.equal(progress.data.study.sessionCount, 1);
  assert.equal(progress.data.study.totalSeconds, 25 * 60);
});

test('expired sessions are rejected, including legacy ISO timestamps', async () => {
  const user = await api('/api/auth/register', {
    method: 'POST',
    body: { email: 'erin@example.com', password: 'password1', displayName: 'Erin' },
  });
  const sid = user.cookie.slice('sid='.length);

  db.prepare(`UPDATE sessions SET expires_at = ? WHERE id = ?`).run('2000-01-01T00:00:00.000Z', sid);
  const expired = await api('/api/auth/me', { cookie: user.cookie });
  assert.equal(expired.status, 401);

  db.prepare(`UPDATE sessions SET expires_at = ? WHERE id = ?`).run('2099-01-01T00:00:00.000Z', sid);
  const legacy = await api('/api/auth/me', { cookie: user.cookie });
  assert.equal(legacy.status, 200);
  assert.equal(legacy.data.user.displayName, 'Erin');
});
