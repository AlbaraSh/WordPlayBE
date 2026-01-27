import express from 'express';

export function leaderboardRouter(db) {
  const router = express.Router();

  // GET /api/leaderboard
  router.get('/', (req, res) => {
    res.json({ ok: true, message: 'leaderboardRouter working' });
  });

  return router;
}
