import express from 'express';

export function eventsRouter(db) {
  const router = express.Router();

  // POST /api/events
  router.post('/', (req, res) => {
    res.json({ ok: true, message: 'eventsRouter working' });
  });

  return router;
}