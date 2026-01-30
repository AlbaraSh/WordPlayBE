// routes/events.js
import express from 'express';

const XP = {
  NEW_WORD_LEARNED: 10,
  STREAK_INCREMENT: 15,
  ACHIEVEMENT_UNLOCK: 30,
  MINIGAME_COMPLETED: 20, // (kept here in case you use it elsewhere)
};

const BADGE_XP_STEP = 150;

function badgeIdFromXp(totalXp) {
  return Math.floor(Math.max(0, totalXp) / BADGE_XP_STEP);
}

function computeLevel(totalXp) {
  // Simple leveling rule (adjust if you want)
  return 1 + Math.floor(Math.max(0, totalXp) / 500);
}

function isoDateUTC() {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayUTC() {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function applyDailyStreak(lastStreakDate, studyStreak) {
  const today = isoDateUTC();
  const yesterday = yesterdayUTC();

  if (lastStreakDate === today) {
    // Already incremented today
    return { changed: false, newStreak: studyStreak, newLastDate: today };
  }
  if (lastStreakDate === yesterday) {
    // Continue streak
    return { changed: true, newStreak: studyStreak + 1, newLastDate: today };
  }
  // Reset streak
  return { changed: true, newStreak: 1, newLastDate: today };
}

// Very light validation for ISO timestamps.
// (We mostly just need something Date.parse can handle.)
function isValidDateTime(value) {
  if (typeof value !== 'string') return false;
  const t = Date.parse(value);
  return Number.isFinite(t);
}
// Very light validation for duration timestamps.
function isValidDuration(value) {
  if (typeof value !== 'string') return false;

  value = value.trim();

  // hh:mm:ss (00–23 : 00–59 : 00–59)
  const regex = /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/;

  return regex.test(value);
}

export function eventsRouter(db) {
  const router = express.Router();

  // Prepared statements
  const wordExistsStmt = db.prepare(`SELECT 1 FROM words WHERE id = ?`);

  const insertDailyNoRTStmt = db.prepare(`
    INSERT INTO user_word_daily_stats
      (user_id, word_id, stat_date, times_asked, times_correct, avg_response_time, updated_at)
    VALUES
      (?, ?, date('now'), 1, ?, NULL, datetime('now'))
    ON CONFLICT(user_id, word_id, stat_date)
    DO UPDATE SET
      times_asked = user_word_daily_stats.times_asked + 1,
      times_correct = user_word_daily_stats.times_correct + excluded.times_correct,
      updated_at = datetime('now')
  `);

  const insertDailyWithRTStmt = db.prepare(`
    INSERT INTO user_word_daily_stats
      (user_id, word_id, stat_date, times_asked, times_correct, avg_response_time, updated_at)
    VALUES
      (?, ?, date('now'), 1, ?, ?, datetime('now'))
    ON CONFLICT(user_id, word_id, stat_date)
    DO UPDATE SET
      avg_response_time =
        CASE
          WHEN user_word_daily_stats.avg_response_time IS NULL
            THEN excluded.avg_response_time
          ELSE
            (user_word_daily_stats.avg_response_time * user_word_daily_stats.times_asked + excluded.avg_response_time)
            / (user_word_daily_stats.times_asked + 1)
        END,
      times_asked = user_word_daily_stats.times_asked + 1,
      times_correct = user_word_daily_stats.times_correct + excluded.times_correct,
      updated_at = datetime('now')
  `);

  const getMasteryStmt = db.prepare(`
    SELECT first_correct_at
    FROM user_word_mastery
    WHERE user_id = ? AND word_id = ?
  `);

  const upsertMasteryStmt = db.prepare(`
    INSERT INTO user_word_mastery
      (user_id, word_id, first_correct_at, total_asked_lifetime, total_correct_lifetime, updated_at)
    VALUES
      (?, ?, CASE WHEN ? = 1 THEN datetime('now') ELSE NULL END, 1, CASE WHEN ? = 1 THEN 1 ELSE 0 END, datetime('now'))
    ON CONFLICT(user_id, word_id)
    DO UPDATE SET
      total_asked_lifetime = user_word_mastery.total_asked_lifetime + 1,
      total_correct_lifetime = user_word_mastery.total_correct_lifetime + CASE WHEN excluded.total_correct_lifetime = 1 THEN 1 ELSE 0 END,
      first_correct_at =
        CASE
          WHEN user_word_mastery.first_correct_at IS NULL AND excluded.first_correct_at IS NOT NULL
            THEN excluded.first_correct_at
          ELSE user_word_mastery.first_correct_at
        END,
      updated_at = datetime('now')
  `);

  const getUserXpStmt = db.prepare(`SELECT total_xp FROM users WHERE id = ?`);

  const updateUserStatsStmt = db.prepare(`
    UPDATE users
    SET
      total_xp = ?,
      level = ?,
      words_learned = words_learned + ?,
      correct_words = correct_words + ?,
      completed_minigames = completed_minigames + ?,
      study_streak = ?,
      last_streak_date = ?,
      current_badge_id = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `);

  const getUserStreakStmt = db.prepare(`
    SELECT total_xp, level, study_streak, last_streak_date, current_badge_id
    FROM users
    WHERE id = ?
  `);

  const getUserAchievementStmt = db.prepare(`
    SELECT progress, unlocked, progress_target, unlocked_date
    FROM user_achievements
    WHERE user_id = ? AND achievement_id = ?
  `);

  const incUserAchievementProgressStmt = db.prepare(`
    UPDATE user_achievements
    SET
      progress = progress + ?,
      updated_at = datetime('now')
    WHERE user_id = ? AND achievement_id = ?
  `);

  const unlockAchievementStmt = db.prepare(`
    UPDATE user_achievements
    SET
      unlocked = 1,
      unlocked_date = date('now'),
      updated_at = datetime('now')
    WHERE user_id = ? AND achievement_id = ?
  `);

  const insertStudySessionStmt = db.prepare(`
    INSERT INTO study_sessions (user_id, start_time, end_time, total_duration, session_date)
    VALUES (?, ?, ?, ?, date(?))
  `);

  /**
   * POST /api/events/word-answered
   * Body: { wordId: number, isCorrect: boolean, responseTimeSeconds?: number }
   */
  router.post('/word-answered', (req, res) => {
    const userId = req.user.id;
    const { wordId, isCorrect, responseTimeSeconds } = req.body ?? {};

    if (!Number.isInteger(wordId)) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'wordId must be an integer' });
    }
    if (typeof isCorrect !== 'boolean') {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'isCorrect must be boolean' });
    }

    const rt = responseTimeSeconds == null ? null : Number(responseTimeSeconds);
    if (rt != null && (!Number.isFinite(rt) || rt < 0)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'responseTimeSeconds must be a non-negative number',
      });
    }

    // Prevent FK errors
    const wordExists = wordExistsStmt.get(wordId);
    if (!wordExists) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: `wordId ${wordId} does not exist in words table.`,
      });
    }

    const tx = db.transaction(() => {
      // Determine if this is "first correct ever"
      const masteryBefore = getMasteryStmt.get(userId, wordId);
      const wasFirstCorrectEver = isCorrect && (!masteryBefore || masteryBefore.first_correct_at == null);

      // 1) Daily stats
      const dailyCorrectDelta = isCorrect ? 1 : 0;
      if (rt == null) {
        insertDailyNoRTStmt.run(userId, wordId, dailyCorrectDelta);
      } else {
        insertDailyWithRTStmt.run(userId, wordId, dailyCorrectDelta, rt);
      }

      // 2) Mastery totals
      upsertMasteryStmt.run(userId, wordId, isCorrect ? 1 : 0, isCorrect ? 1 : 0);

      // 3) Award XP & counters
      let xpAwarded = 0;
      let wordsLearnedDelta = 0;
      const correctWordsDelta = isCorrect ? 1 : 0;

      if (wasFirstCorrectEver) {
        xpAwarded += XP.NEW_WORD_LEARNED;
        wordsLearnedDelta += 1;
      }

      if (xpAwarded !== 0 || wordsLearnedDelta !== 0 || correctWordsDelta !== 0) {
        const user = getUserXpStmt.get(userId);
        const newTotalXp = (user?.total_xp ?? 0) + xpAwarded;
        const newLevel = computeLevel(newTotalXp);
        const newBadgeId = badgeIdFromXp(newTotalXp);

        // Keep streak fields unchanged here (read current then write same)
        const u = getUserStreakStmt.get(userId);
        updateUserStatsStmt.run(
          newTotalXp,
          newLevel,
          wordsLearnedDelta,
          correctWordsDelta,
          0, // completed_minigames delta
          u?.study_streak ?? 0,
          u?.last_streak_date ?? null,
          newBadgeId,
          userId
        );

        return {
          xpAwarded,
          wasFirstCorrectEver,
          totalXp: newTotalXp,
          level: newLevel,
          currentBadgeId: newBadgeId,
        };
      }

      return { xpAwarded: 0, wasFirstCorrectEver: false };
    });

    try {
      const result = tx();
      res.json({ ok: true, ...result });
    } catch (e) {
      res.status(500).json({ error: 'ERROR', message: String(e.message || e) });
    }
  });

  /**
   * POST /api/events/streak-action
   * Body: { source: "LESSON_EXERCISE"|"SECTION_TEST"|"MINIGAME" }
   * Increments daily streak (at most once per day) and awards +15 XP when streak changes.
   */
  router.post('/streak-action', (req, res) => {
    const userId = req.user.id;
    const { source } = req.body ?? {};

    if (!['LESSON_EXERCISE', 'SECTION_TEST', 'MINIGAME'].includes(source)) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Invalid source' });
    }

    const tx = db.transaction(() => {
      const user = getUserStreakStmt.get(userId);
      if (!user) throw new Error('User not found');

      const streakResult = applyDailyStreak(user.last_streak_date, user.study_streak);

      let xpAwarded = 0;
      let newTotalXp = user.total_xp;
      let newLevel = user.level;

      if (streakResult.changed) {
        xpAwarded = XP.STREAK_INCREMENT;
        newTotalXp = user.total_xp + xpAwarded;
        newLevel = computeLevel(newTotalXp);
      }

      const newBadgeId = badgeIdFromXp(newTotalXp);

      // Update users row; other counters unchanged
      updateUserStatsStmt.run(
        newTotalXp,
        newLevel,
        0, // words_learned delta
        0, // correct_words delta
        0, // completed_minigames delta
        streakResult.newStreak,
        streakResult.newLastDate,
        newBadgeId,
        userId
      );

      return {
        xpAwarded,
        streakChanged: streakResult.changed,
        studyStreak: streakResult.newStreak,
        lastStreakDate: streakResult.newLastDate,
        totalXp: newTotalXp,
        level: newLevel,
        currentBadgeId: newBadgeId,
      };
    });

    try {
      const result = tx();
      res.json({ ok: true, ...result });
    } catch (e) {
      res.status(500).json({ error: 'ERROR', message: String(e.message || e) });
    }
  });

  /**
   * POST /api/events/achievement-progress
   * Body: { achievementId: string, progressDelta: number }
   *
   * Uses progress_target stored in user_achievements.
   * If reaches target and was locked -> unlocked_date = date('now') and +30 XP.
   */
  router.post('/achievement-progress', (req, res) => {
    const userId = req.user.id;
    const { achievementId, progressDelta } = req.body ?? {};

    if (typeof achievementId !== 'string' || !achievementId.trim()) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'achievementId must be a non-empty string' });
    }
    const delta = Number(progressDelta);
    if (!Number.isFinite(delta) || delta <= 0) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'progressDelta must be a positive number' });
    }

    const tx = db.transaction(() => {
      const row = getUserAchievementStmt.get(userId, achievementId);
      if (!row) {
        throw new Error(
          `Achievement ${achievementId} not found for user (did you seed user_achievements?)`
        );
      }

      // Increment progress
      incUserAchievementProgressStmt.run(delta, userId, achievementId);

      const updated = getUserAchievementStmt.get(userId, achievementId);

      let xpAwarded = 0;
      let unlockedNow = false;

      if (!updated.unlocked && updated.progress >= updated.progress_target) {
        unlockAchievementStmt.run(userId, achievementId);

        xpAwarded = XP.ACHIEVEMENT_UNLOCK;
        unlockedNow = true;

        const user = getUserXpStmt.get(userId);
        const newTotalXp = (user?.total_xp ?? 0) + xpAwarded;
        const newLevel = computeLevel(newTotalXp);
        const newBadgeId = badgeIdFromXp(newTotalXp);

        // Keep streak + counters unchanged
        const u = getUserStreakStmt.get(userId);
        updateUserStatsStmt.run(
          newTotalXp,
          newLevel,
          0,
          0,
          0,
          u?.study_streak ?? 0,
          u?.last_streak_date ?? null,
          newBadgeId,
          userId
        );

        const finalRow = getUserAchievementStmt.get(userId, achievementId);

        return {
          achievementId,
          progress: finalRow.progress,
          progressTarget: finalRow.progress_target,
          unlockedNow,
          unlockedDate: finalRow.unlocked_date,
          xpAwarded,
          totalXp: newTotalXp,
          level: newLevel,
          currentBadgeId: newBadgeId,
        };
      }

      return {
        achievementId,
        progress: updated.progress,
        progressTarget: updated.progress_target,
        unlockedNow,
        unlockedDate: updated.unlocked_date,
        xpAwarded: 0,
      };
    });

    try {
      const result = tx();
      res.json({ ok: true, ...result });
    } catch (e) {
      res.status(500).json({ error: 'ERROR', message: String(e.message || e) });
    }
  });

  /**
   * POST /api/events/study-session
   * Body: { startTime: string(ISO), endTime: string(ISO) }
   *
   * Called by frontend when tab closes to store analytics.
   */
  router.post('/study-session', (req, res) => {
    const userId = req.user.id;
    const { startTime, endTime, totalDuration } = req.body ?? {};

    if (!isValidDateTime(startTime) || !isValidDateTime(endTime)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'startTime and endTime must be valid ISO datetime strings',
      });
    }

    if (!isValidDuration(totalDuration)){
      console.log(totalDuration);
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'totalDuration must be valid HH:MM:SS string',
      });
    }

    const startMs = Date.parse(startTime);
    const endMs = Date.parse(endTime);

    if (endMs < startMs) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'endTime must be >= startTime',
      });
    }

    // Optional: ignore extremely short sessions (uncomment if you want)
    if (endMs - startMs < 5000) {
      return res.status(200).json({ ok: true, ignored: true, reason: 'Session < 5 seconds' });
    }

    try {
      const info = insertStudySessionStmt.run(userId, startTime, endTime, totalDuration, endTime);
      res.status(201).json({
        ok: true,
        sessionId: info.lastInsertRowid,
      });
    } catch (e) {
      res.status(500).json({ error: 'ERROR', message: String(e.message || e) });
    }
  });

  return router;
}
