import express from 'express';
import { buildCourse } from '../src/vocab/importCsv.js';
import { getActiveCourseId, getDefaultCourseId, getOwnedCourseId } from '../schema-init.js';

function planFromBody(body) {
  return buildCourse(body?.csv);
}

function saveCourse(db, userId, plan) {
  const defaultCourseId = getDefaultCourseId(db);
  const ownedCourseId = getOwnedCourseId(db, userId);

  const insertCourse = db.prepare(`
    INSERT INTO courses (name, is_default, owner_user_id) VALUES ('Imported', 0, ?)
  `);
  const insertSection = db.prepare(`
    INSERT INTO sections (course_id, section_num, name) VALUES (?, ?, ?)
  `);
  const insertWord = db.prepare(`
    INSERT INTO words (course_id, section_num, lesson_num, category, romaji, english)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const moveScores = db.prepare(`UPDATE minigame_scores SET course_id = ? WHERE course_id = ?`);
  const deleteCourse = db.prepare(`DELETE FROM courses WHERE id = ?`);

  const tx = db.transaction(() => {
    if (ownedCourseId) {
      moveScores.run(defaultCourseId, ownedCourseId);
      deleteCourse.run(ownedCourseId);
    }
    const course = insertCourse.run(userId);
    const courseId = Number(course.lastInsertRowid);
    for (const section of plan.sections) {
      insertSection.run(courseId, section.sectionNum, section.name);
      for (const lesson of section.lessons) {
        for (const word of lesson.words) {
          insertWord.run(courseId, section.sectionNum, lesson.lessonNum, section.name, word.term, word.translation);
        }
      }
    }
    return courseId;
  });

  return tx();
}

export function vocabRouter(db) {
  const router = express.Router();

  router.post('/preview', (req, res) => {
    try {
      const plan = planFromBody(req.body);
      res.json({
        ...plan,
        replacesCustom: Boolean(getOwnedCourseId(db, req.user.id)),
      });
    } catch (err) {
      res.status(err.status || 400).json({ error: 'VALIDATION_ERROR', message: err.message });
    }
  });

  router.post('/import', (req, res) => {
    try {
      const plan = planFromBody(req.body);
      const courseId = saveCourse(db, req.user.id, plan);
      res.json({
        courseId,
        wordCount: plan.wordCount,
        sections: plan.sections.map((section) => ({
          sectionNum: section.sectionNum,
          name: section.name,
          lessonCount: section.lessons.length,
        })),
      });
    } catch (err) {
      res.status(err.status || 400).json({ error: 'VALIDATION_ERROR', message: err.message });
    }
  });

  router.post('/reset', (req, res) => {
    const ownedCourseId = getOwnedCourseId(db, req.user.id);
    if (!ownedCourseId) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'No imported vocabulary to reset' });
    }
    const defaultCourseId = getDefaultCourseId(db);
    const tx = db.transaction(() => {
      db.prepare(`UPDATE minigame_scores SET course_id = ? WHERE course_id = ?`).run(defaultCourseId, ownedCourseId);
      db.prepare(`DELETE FROM courses WHERE id = ?`).run(ownedCourseId);
    });
    tx();
    res.json({ courseId: getActiveCourseId(db, req.user.id) });
  });

  return router;
}
