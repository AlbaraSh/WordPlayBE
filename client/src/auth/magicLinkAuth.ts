// Hardcoded mapping
const MAGIC_WORD_BY_USER: Record<string, string> = {
  user1: 'QmZtLpRkXs',
  user2: 'aHfTqWmNzP',
  user3: 'VrYcLdSeTu',
  user4: 'kPjRwXaMzL',
  user5: 'NqTbYvGhRe',
  user6: 'sXoLmQpZtA',
  user7: 'DfKuRnWyBc',
  user8: 'tMeZxPvLsQ',
  user9: 'HbRwTnKcYa',
  user10: 'LpVzQmTeXs',
};

const STORAGE_KEY = 'study_user_id';

function isValid(uid: string, mw: string): boolean {
  const expected = MAGIC_WORD_BY_USER[uid];
  return typeof expected === 'string' && mw === expected;
}

export type MagicAuthResult =
  | { ok: true; userId: string; from: 'url' | 'storage' }
  | { ok: false; reason: 'invalid_link' | 'not_logged_in' };

export function getMagicAuth(): MagicAuthResult {
  const params = new URLSearchParams(window.location.search);
  const uid = params.get('uid');
  const mw = params.get('mw');

  // If link contains uid+mw, validate
  if (uid && mw) {
    if (isValid(uid, mw)) {
      localStorage.setItem(STORAGE_KEY, uid);

      // Recommended: remove mw from URL after validation
      params.delete('mw');
      window.history.replaceState(
        {},
        '',
        `${window.location.pathname}?${params.toString()}`
      );

      return { ok: true, userId: uid, from: 'url' };
    }

    // Invalid pair -> clear stored user and report invalid
    localStorage.removeItem(STORAGE_KEY);
    return { ok: false, reason: 'invalid_link' };
  }

  // No uid+mw in URL -> fallback to storage
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) return { ok: true, userId: stored, from: 'storage' };

  return { ok: false, reason: 'not_logged_in' };
}
