# WordPlay

WordPlay is a vocabulary study app. You work through flashcards, a lesson quiz, and a typed section test, then play a two-minute falling-words game. Streaks, XP, levels, badges, and achievements are updated on the server. The starter course is Japanese (6 sections, 64 words). You can replace it with a CSV of your own.

## Stack

- React, Vite, and Tailwind on the client
- Express 5 and SQLite (`better-sqlite3`) on the server
- httpOnly session cookies and bcrypt password hashes
- `node:test` for the API, schema, and CSV importer

One Node process serves the API. In production it also serves the built client.

## Run it

Requires Node 20 or newer.

```bash
npm install
npm install --prefix client
cp .env.example .env
npm run dev
```

On Windows, copy the example env file instead of using `cp`:

```powershell
Copy-Item .env.example .env
```

- App: http://localhost:5173
- API: http://localhost:3001

The Vite dev server proxies `/api` to the API. Register an account in the browser. The SQLite file is created at `data/app.db` and is not committed.

Production:

```bash
npm install
npm install --prefix client
npm run build
npm start
```

`npm start` serves the API and `client/dist` on `PORT` (default 3001).

## Tests

```bash
npm test
```

## What the server owns

XP, level, badge, and achievements are derived from counters inside a transaction. The first time you answer a word correctly is worth 10 XP. A study streak is worth 15 XP, once per UTC day. Finishing a minigame is worth 20 XP. Unlocking an achievement is worth 30 XP. Level and badge are computed from total XP.

Minigame scores are a personal best list. The browser reports the score for a finished game. The API accepts `beginner`, `intermediate`, and `master`, and rejects scores outside `0..30000`. It does not replay the game.

Importing a CSV previews the list, packs words into sections of about 15 and lessons of about 5, skips duplicates, and caps a list at 1,000 words. Replacing a list removes that list's lesson progress and per-word accuracy. XP, streak, and minigame scores stay. Reset restores the starter course.

Schema startup applies `sql/schema.sql` with `CREATE TABLE IF NOT EXISTS` and reseeds reference data with `INSERT OR IGNORE`. It does not drop an existing database when the process restarts.

## API

All routes except `GET /api/health` and `POST /api/auth/*` require the `sid` session cookie.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/auth/register` | Create an account and start a session |
| POST | `/api/auth/login` | Start a session |
| POST | `/api/auth/logout` | End the session |
| GET | `/api/auth/me` | Current account |
| GET | `/api/progress` | Lessons, scores, stats, achievements, study time |
| PATCH | `/api/progress/lesson` | Save flashcard progress and a quiz score |
| PATCH | `/api/progress/section-test` | Save a section test, keeping the best score |
| GET | `/api/progress/words` | Active course |
| GET | `/api/progress/word-mastery` | Per-word accuracy |
| POST | `/api/events/word-answered` | Record an answer and award first-time XP |
| POST | `/api/events/streak-action` | Count a study day |
| POST | `/api/events/study-session` | Store time spent, ignoring sessions under 5 seconds |
| POST | `/api/leaderboard` | Save a personal minigame score |
| GET | `/api/leaderboard/top10` | This account's 10 best scores |
| POST | `/api/vocab/preview` | Parse a CSV without saving it |
| POST | `/api/vocab/import` | Replace the starter list |
| POST | `/api/vocab/reset` | Restore the starter list |

`sample-vocab.csv` is a small file you can import from the vocabulary page.
