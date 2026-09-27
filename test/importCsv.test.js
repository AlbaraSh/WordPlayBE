import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCourse, MAX_WORDS } from '../src/vocab/importCsv.js';

test('named sections stay together and split into lessons of about five', () => {
  const rows = Array.from({ length: 12 }, (_, i) => `word${i},meaning${i},Weather`);
  const plan = buildCourse(['term,translation,section', ...rows].join('\n'));
  assert.equal(plan.sections.length, 1);
  assert.equal(plan.sections[0].name, 'Weather');
  assert.deepEqual(
    plan.sections[0].lessons.map((lesson) => lesson.words.length),
    [4, 4, 4]
  );
});

test('a file without sections is packed into sections and lessons', () => {
  const rows = Array.from({ length: 7 }, (_, i) => `word${i},meaning${i}`);
  const plan = buildCourse(rows.join('\n'));
  assert.equal(plan.sections.length, 1);
  assert.deepEqual(
    plan.sections[0].lessons.map((lesson) => lesson.words.length),
    [4, 3]
  );
});

test('sixteen unsectioned words become two sections', () => {
  const rows = Array.from({ length: 16 }, (_, i) => `word${i},meaning${i}`);
  const plan = buildCourse(rows.join('\n'));
  assert.equal(plan.sections.length, 2);
  assert.deepEqual(
    plan.sections.map((section) => section.lessons.reduce((sum, lesson) => sum + lesson.words.length, 0)),
    [8, 8]
  );
});

test('empty rows, missing fields, and duplicates are skipped', () => {
  const csv = [
    'word,answer',
    'kaze,wind',
    '',
    'ame',
    'kaze,wind',
    '"hello, world",greeting',
  ].join('\n');
  const plan = buildCourse(csv);
  assert.equal(plan.wordCount, 2);
  assert.equal(plan.sections[0].lessons[0].words[1].term, 'hello, world');
  assert.deepEqual(
    plan.skipped.map((row) => row.reason),
    ['Missing term or translation', 'Duplicate word']
  );
});

test('more than the word cap is rejected', () => {
  const rows = Array.from({ length: MAX_WORDS + 1 }, (_, i) => `word${i},meaning${i}`);
  assert.throws(() => buildCourse(rows.join('\n')), /at most 1000/);
});
