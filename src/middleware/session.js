import crypto from 'crypto';

const COOKIE = 'sid';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export function loadSession(db) {
  return (req, res, next) => {
    const sid = req.cookies?.[COOKIE];
    if (!sid) {
      req.user = null;
      return next();
    }

    const row = db.prepare(`
      SELECT u.id, u.email, u.display_name
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.id = ?
        AND datetime(replace(replace(s.expires_at, 'T', ' '), 'Z', '')) > datetime('now')
    `).get(sid);

    req.user = row
      ? { id: row.id, email: row.email, displayName: row.display_name }
      : null;
    next();
  };
}

export function requireUser(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Login required',
    });
  }
  next();
}

function sqliteUtc(date) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

export function createSession(db, res, userId) {
  const sid = crypto.randomBytes(32).toString('hex');
  const expiresAt = sqliteUtc(new Date(Date.now() + THIRTY_DAYS_MS));
  db.prepare(`
    INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)
  `).run(sid, userId, expiresAt);

  res.cookie(COOKIE, sid, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: THIRTY_DAYS_MS,
    path: '/',
  });
}

export function clearSession(db, req, res) {
  const sid = req.cookies?.[COOKIE];
  if (sid) db.prepare(`DELETE FROM sessions WHERE id = ?`).run(sid);
  res.clearCookie(COOKIE, { path: '/' });
}
