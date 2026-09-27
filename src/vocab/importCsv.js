export const MAX_WORDS = 1000;
const LESSON_SIZE = 5;
const SECTION_SIZE = 15;

const TERM_HEADERS = new Set(['term', 'word', 'prompt', 'japanese', 'romaji']);
const TRANSLATION_HEADERS = new Set(['translation', 'answer', 'english', 'meaning']);
const SECTION_HEADERS = new Set(['section', 'category']);

function parseLine(line) {
  const cells = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      cells.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

function splitEvenly(items, size) {
  const count = Math.max(1, Math.ceil(items.length / size));
  const base = Math.floor(items.length / count);
  let extra = items.length % count;
  const groups = [];
  let index = 0;
  for (let group = 0; group < count; group++) {
    const take = base + (extra > 0 ? 1 : 0);
    if (extra > 0) extra -= 1;
    groups.push(items.slice(index, index + take));
    index += take;
  }
  return groups;
}

function headerIndexes(cells) {
  const lowered = cells.map((cell) => cell.toLowerCase());
  const term = lowered.findIndex((cell) => TERM_HEADERS.has(cell));
  const translation = lowered.findIndex((cell) => TRANSLATION_HEADERS.has(cell));
  if (term === -1 || translation === -1) return null;
  const section = lowered.findIndex((cell) => SECTION_HEADERS.has(cell));
  return { term, translation, section };
}

export function buildCourse(csv) {
  if (typeof csv !== 'string' || !csv.trim()) {
    const error = new Error('CSV is empty');
    error.status = 400;
    throw error;
  }

  const lines = csv.replace(/^\uFEFF/, '').split(/\r?\n/);
  const skipped = [];
  const records = [];
  const seen = new Set();
  let columns = { term: 0, translation: 1, section: 2 };
  let headerChecked = false;

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    if (!line.trim()) return;
    const cells = parseLine(line);
    if (!headerChecked) {
      headerChecked = true;
      const header = headerIndexes(cells);
      if (header) {
        columns = header;
        return;
      }
    }

    const term = cells[columns.term] ?? '';
    const translation = cells[columns.translation] ?? '';
    const section = columns.section >= 0 ? (cells[columns.section] ?? '') : '';
    if (!term || !translation) {
      skipped.push({ line: lineNumber, reason: 'Missing term or translation' });
      return;
    }
    const key = `${term.toLowerCase()}\0${translation.toLowerCase()}`;
    if (seen.has(key)) {
      skipped.push({ line: lineNumber, reason: 'Duplicate word' });
      return;
    }
    seen.add(key);
    records.push({ term, translation, section, line: lineNumber });
  });

  if (records.length === 0) {
    const error = new Error('No words found. Each row needs a term and a translation.');
    error.status = 400;
    throw error;
  }
  if (records.length > MAX_WORDS) {
    const error = new Error(`A list can contain at most ${MAX_WORDS} words`);
    error.status = 400;
    throw error;
  }

  const named = records.some((row) => row.section);
  let groups;
  if (named) {
    const byName = new Map();
    for (const row of records) {
      const name = row.section || 'Unsectioned';
      if (!byName.has(name)) byName.set(name, []);
      byName.get(name).push(row);
    }
    groups = [...byName.entries()].map(([name, words]) => ({ name, words }));
  } else {
    groups = splitEvenly(records, SECTION_SIZE).map((words, index) => ({
      name: `Section ${index + 1}`,
      words,
    }));
  }

  const sections = groups.map((group, index) => ({
    sectionNum: index + 1,
    name: group.name,
    lessons: splitEvenly(group.words, LESSON_SIZE).map((words, lessonIndex) => ({
      lessonNum: lessonIndex + 1,
      words: words.map((word) => ({ term: word.term, translation: word.translation })),
    })),
  }));

  return { wordCount: records.length, sections, skipped };
}
