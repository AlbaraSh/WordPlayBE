import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import { loadSession, requireUser } from './middleware/session.js';
import { authRouter } from '../routes/auth.js';
import { progressRouter } from '../routes/progress.js';
import { eventsRouter } from '../routes/events.js';
import { leaderboardRouter } from '../routes/leaderboard.js';
import { vocabRouter } from '../routes/vocab.js';

const clientDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../client/dist');

export function createApp(db) {
  const app = express();
  const origin = process.env.CORS_ORIGIN || 'http://localhost:5173';

  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(cors({ origin, credentials: true }));
  app.use(loadSession(db));

  app.get('/api/health', (req, res) => {
    res.json({ ok: true });
  });

  app.use('/api/auth', authRouter(db));
  app.use('/api/progress', requireUser, progressRouter(db));
  app.use('/api/events', requireUser, eventsRouter(db));
  app.use('/api/leaderboard', requireUser, leaderboardRouter(db));
  app.use('/api/vocab', requireUser, vocabRouter(db));

  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  return app;
}
