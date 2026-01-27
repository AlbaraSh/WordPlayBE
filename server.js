import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import { openDb } from './db.js';
import { initSchemaAndSeed } from './schema-init.js';
import { demoUser } from './src/middleware/demoUser.js';

import { progressRouter } from './routes/progress.js';
import { eventsRouter } from './routes/events.js';
import { leaderboardRouter } from './routes/leaderboard.js';

dotenv.config();

// =====================
// Config
// =====================
const PORT = Number(process.env.PORT || 3001);
const DB_PATH = process.env.DB_PATH || './data/app.db';
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

// =====================
// App setup
// =====================
const app = express();

app.use(express.json());

app.use(
  cors({
    origin: CORS_ORIGIN,
    credentials: false,
  })
);

// =====================
// Database
// =====================
console.log('Opening database...');
const db = openDb(DB_PATH);

console.log('Initializing schema...');
initSchemaAndSeed(db);

// =====================
// Middleware
// =====================
app.use(demoUser); // reads x-user-id and sets req.user

// =====================
// Routes
// =====================
app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.use('/api/progress', progressRouter(db));
app.use('/api/events', eventsRouter(db));
app.use('/api/leaderboard', leaderboardRouter(db));

// =====================
// Start server
// =====================
app.listen(PORT, () => {
  console.log(`✅ API running on http://localhost:${PORT}`);
  console.log(`✅ SQLite DB at ${DB_PATH}`);
});