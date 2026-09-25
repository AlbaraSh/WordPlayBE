import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { openDb } from '../db.js';
import { initSchemaAndSeed } from '../schema-init.js';
import { createApp } from '../src/createApp.js';

let server;
let base;

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
  const db = openDb(':memory:');
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
