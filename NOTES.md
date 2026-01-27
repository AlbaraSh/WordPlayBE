A: GET /api/progress
SELECT
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
WHERE id = ?;

2) Lesson progress
SELECT
  section_num,
  lesson,
  completed,
  score,
  flashcard_progress
FROM lesson_progress
WHERE user_id = ?;

3) Section test scores
SELECT
  section_num,
  score
FROM section_test_scores
WHERE user_id = ?;

4) Achievements (definitions + user progress)
SELECT
  a.id AS achievement_id,
  a.name,
  a.description,
  a.target_progress,
  ua.progress,
  ua.unlocked,
  ua.unlocked_at,
  ua.updated_at
FROM achievements a
LEFT JOIN user_achievements ua
  ON ua.achievement_id = a.id
 AND ua.user_id = ?
ORDER BY a.id;

5) Badge info (optional, if you want to show badge details)
SELECT
  id,
  name,
  img_url,
  xp_threshold
FROM badges
ORDER BY xp_threshold ASC;



B: PATCH /api/progress/lesson
    Upsert lesson progress (flashcard progress + exercise score).

INSERT INTO lesson_progress
  (user_id, section_num, lesson, flashcard_progress, score, completed, updated_at)
VALUES
  (?, ?, ?, ?, ?, ?, datetime('now'))
ON CONFLICT(user_id, section_num, lesson)
DO UPDATE SET
  flashcard_progress = excluded.flashcard_progress,
  score = excluded.score,
  completed = excluded.completed,
  updated_at = datetime('now');


C: PATCH /api/progress/section-test
    Upsert section test score (and update completed timestamp)
INSERT INTO section_test_scores
  (user_id, section_num, score, completed_at)
VALUES
  (?, ?, ?, datetime('now'))
ON CONFLICT(user_id, section_num)
DO UPDATE SET
  score = excluded.score,
  completed_at = datetime('now');


D: Insert a minigame score
INSERT INTO minigame_scores
  (user_id, score, difficulty, section_num, played_at, played_date)
VALUES
  (?, ?, ?, ?, datetime('now'), date('now'));

E: “Top 10 scores of the user”
SELECT
  score,
  difficulty,
  section_num,
  played_at
FROM minigame_scores
WHERE user_id = ?
ORDER BY score DESC
LIMIT 10;



E: Daily Word Stats Update Logic (with correct avg response time)
    You wanted daily stats and XP for “first time correct ever”.

The clean approach is: when a user answers a word, you do one transaction that:
    Upserts/updates user_word_daily_stats for today
    Upserts/updates user_word_mastery lifetime totals
    If first correct ever → award XP + increment words_learned
    If correct (even not first) → increment correct_words (if you’re counting correct words)

Inputs you’ll have per answer
    userId
    wordId
    isCorrect (0/1)
    responseTimeSeconds (number)
    todayDate as 'YYYY-MM-DD' (you can use date('now') in SQL)
