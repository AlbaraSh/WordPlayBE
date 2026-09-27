import express from 'express';
import { getActiveCourseId } from '../schema-init.js';
import { calculateLevelFromXp, calculateBadgeIdFromLevel } from '../src/utils/levelCalculations.js';
import { syncAchievements } from '../src/utils/xp.js';

const XP_MINIGAME_COMPLETED = 20;

export function leaderboardRouter(db) {
  const router = express.Router();

  /**
   * GET /api/leaderboard/top10
   * Personal top 10
   */
  router.get('/top10', (req, res) => {
    const userId = req.user.id;

    const rows = db
      .prepare(
        `SELECT score, difficulty, section_num, played_at
         FROM minigame_scores
         WHERE user_id = ?
         ORDER BY score DESC
         LIMIT 10`
      )
      .all(userId);

    res.json({
      userId,
      top10: rows.map((r) => ({
        score: r.score,
        difficulty: r.difficulty,
        sectionNum: r.section_num,
        playedAt: r.played_at,
      })),
    });
  });

  /**
   * POST /api/leaderboard
   * Body: { score: number, difficulty: string, sectionNum?: number|null }
   */
  router.post('/', (req, res) => {
    const userId = req.user.id;
    const { score, difficulty, sectionNum } = req.body ?? {};

    if (!Number.isInteger(score) || score < 0) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'score must be a non-negative integer' });
    }
    if (!difficulty || typeof difficulty !== 'string') {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'difficulty must be a string' });
    }
    if (sectionNum != null && (!Number.isInteger(sectionNum) || sectionNum < 1)) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'sectionNum must be an integer >= 1 or null' });
    }

    const tx = db.transaction(() => {
      const courseId = getActiveCourseId(db, userId);
      const info = db.prepare(`
        INSERT INTO minigame_scores (user_id, course_id, score, difficulty, section_num, played_at, played_date)
        VALUES (?, ?, ?, ?, ?, datetime('now'), date('now'))
      `).run(userId, courseId, score, difficulty, sectionNum ?? null);

      const user = db.prepare(`SELECT total_xp FROM users WHERE id = ?`).get(userId);
      const newTotalXp = (user?.total_xp ?? 0) + XP_MINIGAME_COMPLETED;
      const newLevel = calculateLevelFromXp(newTotalXp);
      const newBadgeId = calculateBadgeIdFromLevel(newLevel);

      db.prepare(`
        UPDATE users
        SET
          total_xp = ?,
          level = ?,
          completed_minigames = completed_minigames + 1,
          current_badge_id = ?,
          updated_at = datetime('now')
        WHERE id = ?
      `).run(newTotalXp, newLevel, newBadgeId, userId);

      const synced = syncAchievements(db, userId);
      return {
        id: info.lastInsertRowid,
        userId,
        score,
        difficulty,
        sectionNum: sectionNum ?? null,
        xpAwarded: XP_MINIGAME_COMPLETED + synced.xpAwarded,
        totalXp: synced.totalXp,
        level: synced.level,
        currentBadgeId: synced.currentBadgeId,
        achievementsUnlocked: synced.unlockedNow,
      };
    });

    try {
      const result = tx();
      res.status(201).json(result);
    } catch (e) {
      res.status(500).json({ error: 'ERROR', message: String(e.message || e) });
    }
  });

  return router;
}
