import bcrypt from 'bcryptjs';
import express from 'express';
import { createUserAchievements } from '../schema-init.js';
import { clearSession, createSession } from '../src/middleware/session.js';

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function publicUser(row) {
  return { id: row.id, email: row.email, displayName: row.display_name };
}

export function authRouter(db) {
  const router = express.Router();

  router.post('/register', (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const password = req.body?.password;
    const displayName = typeof req.body?.displayName === 'string' ? req.body.displayName.trim() : '';

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Enter a valid email' });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Password must be at least 8 characters' });
    }
    if (displayName.length < 1 || displayName.length > 40) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Display name must be 1 to 40 characters' });
    }

    const existing = db.prepare(`SELECT id FROM users WHERE email = ?`).get(email);
    if (existing) {
      return res.status(409).json({ error: 'CONFLICT', message: 'An account with that email already exists' });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const user = db.transaction(() => {
      const info = db.prepare(`
        INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)
      `).run(email, passwordHash, displayName);
      createUserAchievements(db, info.lastInsertRowid);
      return db.prepare(`SELECT id, email, display_name FROM users WHERE id = ?`).get(info.lastInsertRowid);
    })();

    createSession(db, res, user.id);
    res.status(201).json({ user: publicUser(user) });
  });

  router.post('/login', (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const password = req.body?.password;
    const user = db.prepare(`SELECT id, email, display_name, password_hash FROM users WHERE email = ?`).get(email);

    if (!user || typeof password !== 'string' || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Email or password is incorrect' });
    }

    createSession(db, res, user.id);
    res.json({ user: publicUser(user) });
  });

  router.post('/logout', (req, res) => {
    clearSession(db, req, res);
    res.json({ ok: true });
  });

  router.get('/me', (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Login required' });
    }
    res.json({ user: req.user });
  });

  return router;
}
