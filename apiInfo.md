# 📘 WordPlay Backend API Documentation

Base URL:

```
http://localhost:3001
```

---

# 🔐 Authentication

This project uses **simple header-based user identification**.

All endpoints (except `/api/health`) require:

```
x-user-id: user1
```

Valid users:

```
user1 → user10
```

Example:

```bash
curl -H "x-user-id: user1" http://localhost:3001/api/progress
```

---

---

# 🟢 Health

## GET `/api/health`

### Description
Check that the server is running.

### Response
```json
{
  "ok": true
}
```

---

---

# 🟦 Progress Endpoints

Base path:

```
/api/progress
```

Used to load/save:

- lesson progress
- flashcards
- exercise scores
- section test scores
- user stats
- achievements

---

## GET `/api/progress`

### Description
Fetch **all progress data for the current user** in one request.

### Headers
```
x-user-id: user1
```

### Response
```json
{
  "lessonStats": {
    "1-lesson1": {
      "completed": true,
      "score": 85,
      "flashcardProgress": 100
    }
  },
  "sectionTestScores": {
    "1": 88
  },
  "userStats": {
    "totalXp": 250,
    "level": 2,
    "studyStreak": 3,
    "wordsLearned": 10,
    "correctWords": 25,
    "completedMinigames": 2,
    "currentBadgeId": 1
  },
  "achievements": [
    {
      "id": "first_word",
      "title": "First Steps",
      "description": "Learn your first word",
      "progress": 1,
      "progressTarget": 1,
      "unlocked": true,
      "unlockedDate": "2026-01-28"
    }
  ]
}
```

---

## PATCH `/api/progress/lesson`

### Description
Update flashcard completion and exercise score.

### Body
```json
{
  "sectionNum": 1,
  "lesson": "lesson1",
  "flashcardProgress": 100,
  "score": 85,
  "completed": true
}
```

### Response
```json
{
  "key": "1-lesson1",
  "stats": {
    "completed": true,
    "score": 85,
    "flashcardProgress": 100
  }
}
```

---

## PATCH `/api/progress/section-test`

### Description
Save section test score.

### Body
```json
{
  "sectionNum": 1,
  "score": 88
}
```

### Response
```json
{
  "sectionNum": 1,
  "score": 88
}
```

---

---

# 🟨 Event Endpoints

Base path:

```
/api/events
```

Handles:

- XP rewards
- streak logic
- achievements
- word analytics
- study sessions

---

## POST `/api/events/word-answered`

### Description
Called when a user answers a vocabulary question.

### Body
```json
{
  "wordId": 5,
  "isCorrect": true,
  "responseTimeSeconds": 1.2
}
```

### Effects
- updates daily word stats
- updates mastery
- increments correct counter
- awards +10 XP for first correct ever

### Response
```json
{
  "ok": true,
  "xpAwarded": 10,
  "wasFirstCorrectEver": true
}
```

---

## POST `/api/events/streak-action`

### Description
Called when a user completes:
- lesson exercise
- minigame
- section test

### Body
```json
{
  "source": "LESSON_EXERCISE"
}
```

### Effects
- increments daily streak (max once/day)
- awards +15 XP

### Response
```json
{
  "ok": true,
  "xpAwarded": 15,
  "studyStreak": 4,
  "streakChanged": true
}
```

---

## POST `/api/events/achievement-progress`

### Description
Update achievement progress.

### Body
```json
{
  "achievementId": "vocab_10",
  "progressDelta": 1
}
```

### Effects
- increments progress
- unlocks when target reached
- awards +30 XP on unlock

### Response
```json
{
  "ok": true,
  "achievementId": "vocab_10",
  "progress": 10,
  "progressTarget": 10,
  "unlockedNow": true,
  "xpAwarded": 30
}
```

---

## POST `/api/events/study-session`

### Description
Stores a study session for analytics.

Called when user closes the tab.

### Body
```json
{
  "startTime": "2026-01-28T14:00:00.000Z",
  "endTime": "2026-01-28T14:25:00.000Z"
}
```

### Effects
Inserts into:
```
study_sessions
```

### Response
```json
{
  "ok": true,
  "sessionId": 12
}
```

---

---

# 🟪 Leaderboard Endpoints

Base path:

```
/api/leaderboard
```

Personal leaderboard only.

---

## POST `/api/leaderboard`

### Description
Save a minigame score.

### Body
```json
{
  "score": 420,
  "difficulty": "easy",
  "sectionNum": 1
}
```

### Effects
- saves score
- awards +20 XP

### Response
```json
{
  "id": 15,
  "score": 420,
  "xpAwarded": 20
}
```

---

## GET `/api/leaderboard/top10`

### Description
Returns the user's top 10 scores.

### Response
```json
{
  "top10": [
    {
      "score": 500,
      "difficulty": "hard",
      "sectionNum": 3,
      "playedAt": "2026-01-28T12:00:00"
    }
  ]
}
```

---

---

# 📊 Endpoint Summary

## Health
```
GET    /api/health
```

## Progress
```
GET    /api/progress
PATCH  /api/progress/lesson
PATCH  /api/progress/section-test
```

## Events
```
POST   /api/events/word-answered
POST   /api/events/streak-action
POST   /api/events/achievement-progress
POST   /api/events/study-session
```

## Leaderboard
```
POST   /api/leaderboard
GET    /api/leaderboard/top10
```

---

# ✅ Total Endpoints
**10**
