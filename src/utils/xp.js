import { calculateBadgeIdFromLevel, calculateLevelFromXp } from './levelCalculations.js';

const ACHIEVEMENT_XP = 30;

export function awardXp(db, userId, amount) {
  const user = db.prepare(`SELECT total_xp FROM users WHERE id = ?`).get(userId);
  const totalXp = (user?.total_xp ?? 0) + amount;
  const level = calculateLevelFromXp(totalXp);
  const currentBadgeId = calculateBadgeIdFromLevel(level);

  db.prepare(`
    UPDATE users
    SET total_xp = ?, level = ?, current_badge_id = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(totalXp, level, currentBadgeId, userId);

  return { xpAwarded: amount, totalXp, level, currentBadgeId };
}

export function syncAchievements(db, userId) {
  const user = db.prepare(`
    SELECT words_learned, study_streak, completed_minigames, correct_words
    FROM users WHERE id = ?
  `).get(userId);

  const rows = db.prepare(`
    SELECT
      ua.achievement_id,
      ua.progress,
      ua.unlocked,
      a.progress_target,
      a.stat
    FROM user_achievements ua
    JOIN achievements a ON a.id = ua.achievement_id
    WHERE ua.user_id = ?
  `).all(userId);

  const update = db.prepare(`
    UPDATE user_achievements
    SET
      progress = ?,
      unlocked = ?,
      unlocked_date = CASE WHEN ? = 1 THEN COALESCE(unlocked_date, date('now')) ELSE NULL END,
      updated_at = datetime('now')
    WHERE user_id = ? AND achievement_id = ?
  `);

  const unlockedNow = [];
  for (const row of rows) {
    const value = Number(user?.[row.stat] ?? 0);
    const progress = Math.min(value, row.progress_target);
    const unlocked = value >= row.progress_target ? 1 : 0;
    if (unlocked && !row.unlocked) unlockedNow.push(row.achievement_id);
    update.run(progress, unlocked, unlocked, userId, row.achievement_id);
  }

  const xpAwarded = unlockedNow.length * ACHIEVEMENT_XP;
  const xp = awardXp(db, userId, xpAwarded);
  return { unlockedNow, ...xp, xpAwarded };
}
