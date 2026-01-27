import express from 'express';

export function progressRouter(db) {
  const router = express.Router();

  // GET /api/progress
  router.get('/', (req, res) => {
    res.json({ ok: true, message: 'progressRouter working' });
  });

  return router;
}
