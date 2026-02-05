import express from 'express';
import { calculateLevelFromXp, calculateBadgeIdFromLevel } from '../src/utils/levelCalculations.js';

// Badge is now derived from XP in frontend, but we still store current_badge_id.
// Rule: each badge = +150 XP
const BADGE_XP_STEP = 150;

function computeBadgeIdFromXp(totalXp) {
  if (!Number.isFinite(totalXp) || totalXp < 0) return 0;
  // Badge 0 means no badge yet; badge 1 unlocked at 150 XP, etc.
  return Math.floor(totalXp / BADGE_XP_STEP);
}

export function progressRouter(db) {
  const router = express.Router();
  router.get('/word-mastery', (req, res) => {
      try {
        const userId = req.user?.id;

        if (!userId) {
          return res.status(401).json({
            error: 'UNAUTHORIZED',
            message: 'Missing authenticated user (req.user)',
          });
        }

        const rows = db
          .prepare(
            `
            SELECT
              word_id AS wordId,
              total_asked_lifetime AS total,
              total_correct_lifetime AS correct,
              first_correct_at AS firstCorrectAt,
              updated_at AS updatedAt
            FROM user_word_mastery
            WHERE user_id = ?
            ORDER BY word_id ASC
            `
          )
          .all(userId);

        const mastery = {};
        for (const r of rows) {
          const total = Number(r.total ?? 0);
          const correct = Number(r.correct ?? 0);

          mastery[r.wordId] = {
            total,
            correct,
            accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
            firstCorrectAt: r.firstCorrectAt ?? null,
            updatedAt: r.updatedAt,
          };
        }

        return res.json({ mastery });
      } catch (err) {
        console.error('GET /api/progress/word-mastery failed:', err);
        return res.status(500).json({
          error: 'ERROR',
          message: 'Failed to load word mastery',
        });
      }
    });
  /**
   * GET /api/progress
   * Returns: lessonStats map, sectionTestScores map, userStats, achievements list
   */
    router.get('/', (req, res) => {
        const userId = req.user.id;

        const user = db
          .prepare(
            `SELECT
              id,
              total_xp,
              level,
              study_streak,
              last_streak_date,
              words_learned,
              correct_words,
              completed_minigames,
              current_badge_id,
              updated_at
            FROM users
            WHERE id = ?`
          )
          .get(userId);

        if (!user) {
          return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found' });
        }

        // ✅ Calculate level and badge from XP (source of truth)
        const calculatedLevel = calculateLevelFromXp(user.total_xp);
        const calculatedBadgeId = calculateBadgeIdFromLevel(calculatedLevel);
        
        // ✅ Update DB if level or badge changed
        let needsUpdate = false;
        let levelUpOccurred = false;
        
        if (user.level !== calculatedLevel) {
          const oldLevel = user.level;
          
          // Detect level-up for frontend celebration
          if (calculatedLevel > oldLevel) {
            levelUpOccurred = true;
          }
          
          user.level = calculatedLevel;
          needsUpdate = true;
        }
        
        if (user.current_badge_id !== calculatedBadgeId) {
          user.current_badge_id = calculatedBadgeId;
          needsUpdate = true;
        }
        
        // ✅ Save to DB if anything changed
        if (needsUpdate) {
          db.prepare(
            `UPDATE users 
            SET level = ?, current_badge_id = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?`
          ).run(user.level, user.current_badge_id, userId);
        }

        const lessonRows = db
          .prepare(
            `SELECT section_num, lesson, completed, score, flashcard_progress
            FROM lesson_progress
            WHERE user_id = ?`
          )
          .all(userId);

        const sectionRows = db
          .prepare(
            `SELECT section_num, score
            FROM section_test_scores
            WHERE user_id = ?`
          )
          .all(userId);

        const achievements = db
          .prepare(
            `SELECT
              achievement_id,
              title,
              description,
              progress_target,
              progress,
              unlocked,
              unlocked_date,
              updated_at
            FROM user_achievements
            WHERE user_id = ?
            ORDER BY achievement_id`
          )
          .all(userId);

        // Convert to frontend shapes
        const lessonStats = {};
        for (const r of lessonRows) {
          const key = `${r.section_num}-${r.lesson}`;
          lessonStats[key] = {
            completed: Boolean(r.completed),
            score: r.score,
            flashcardProgress: r.flashcard_progress,
          };
        }

        const sectionTestScores = {};
        for (const r of sectionRows) {
          sectionTestScores[String(r.section_num)] = r.score;
        }

        res.json({
          lessonStats,
          sectionTestScores,
          userStats: {
            userId: user.id,
            totalXp: user.total_xp,
            level: user.level,  // Now guaranteed to be correct
            studyStreak: user.study_streak,
            lastStreakDate: user.last_streak_date,
            wordsLearned: user.words_learned,
            correctWords: user.correct_words,
            completedMinigames: user.completed_minigames,
            currentBadgeId: user.current_badge_id,  // Now guaranteed to be correct
            updatedAt: user.updated_at,
          },
          achievements: achievements.map((a) => ({
            id: a.achievement_id,
            title: a.title,
            description: a.description,
            progressTarget: a.progress_target,
            progress: a.progress,
            unlocked: Boolean(a.unlocked),
            unlockedDate: a.unlocked_date,
            updatedAt: a.updated_at,
          })),
          levelUpOccurred,  // ✅ Frontend can show celebration if true
        });
      });

  /**
   * PATCH /api/progress/lesson
   * Upsert: { sectionNum, lesson, flashcardProgress, score, completed }
   */
  router.patch('/lesson', (req, res) => {
    const userId = req.user.id;
    const { sectionNum, lesson, flashcardProgress, score, completed } = req.body ?? {};

    if (!Number.isInteger(sectionNum) || sectionNum < 1) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'sectionNum must be an integer >= 1' });
    }
    if (!['lesson1', 'lesson2', 'lesson3', 'test'].includes(lesson)) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'lesson must be lesson1|lesson2|lesson3|test' });
    }
    if (!Number.isInteger(flashcardProgress) || flashcardProgress < 0 || flashcardProgress > 100) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'flashcardProgress must be 0..100' });
    }
    if (!Number.isInteger(score) || score < 0 || score > 100) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'score must be 0..100' });
    }
    if (typeof completed !== 'boolean') {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'completed must be boolean' });
    }

    db.prepare(`
      INSERT INTO lesson_progress (user_id, section_num, lesson, flashcard_progress, score, completed, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(user_id, section_num, lesson)
      DO UPDATE SET
        flashcard_progress = excluded.flashcard_progress,
        score = excluded.score,
        completed = excluded.completed,
        updated_at = datetime('now')
    `).run(userId, sectionNum, lesson, flashcardProgress, score, completed ? 1 : 0);

    const key = `${sectionNum}-${lesson}`;
    res.json({ key, stats: { completed, score, flashcardProgress } });
  });

  /**
   * PATCH /api/progress/section-test
   * Upsert: { sectionNum, score }
   */
  router.patch('/section-test', (req, res) => {
    const userId = req.user.id;
    const { sectionNum, score } = req.body ?? {};

    if (!Number.isInteger(sectionNum) || sectionNum < 1) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'sectionNum must be an integer >= 1' });
    }
    if (!Number.isInteger(score) || score < 0 || score > 100) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'score must be 0..100' });
    }

    db.prepare(`
      INSERT INTO section_test_scores (user_id, section_num, score, completed_at)
      VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(user_id, section_num)
      DO UPDATE SET
        score = excluded.score,
        completed_at = datetime('now')
    `).run(userId, sectionNum, score);

    res.json({ sectionNum, score });
  });

    /**
   * Get /api/progress/words
   * Get: { sectionNum, score }
   */
  router.get('/words', (req, res) => {
  const userId = req.user.id;

  const rows = db
    .prepare(
      `SELECT id, section_num, lesson_num, category, romaji, english
       FROM words
       ORDER BY section_num, lesson_num, id`
    )
    .all();

  res.json({
    userId,
    words: rows.map((r) => ({
      id: r.id,
      sectionNum: r.section_num,
      lessonNum: r.lesson_num,
      category: r.category,
      romaji: r.romaji,
      english: r.english,
    })),
  });
});

  return router;
}
