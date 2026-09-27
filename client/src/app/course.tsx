import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, CourseSection, WordsResponse } from '../api/client';

export interface VocabWord {
  id: number;
  word: string;
  translation: string;
  category: string;
  section: number;
  lessonNum: number;
}

type WordStats = Record<number, { correct: number; total: number }>;

type CourseValue = {
  words: VocabWord[];
  sections: CourseSection[];
  custom: boolean;
  wordStats: WordStats;
  reload: () => Promise<void>;
  recordAnswer: (wordId: number, isCorrect: boolean, responseTimeMs?: number) => Promise<void>;
};

const CourseContext = createContext<CourseValue | null>(null);

function toWords(response: WordsResponse): VocabWord[] {
  return response.words.map((word) => ({
    id: word.id,
    word: word.romaji,
    translation: word.english,
    category: word.category,
    section: word.sectionNum,
    lessonNum: word.lessonNum,
  }));
}

export function CourseProvider({ children }: { children: ReactNode }) {
  const [words, setWords] = useState<VocabWord[] | null>(null);
  const [sections, setSections] = useState<CourseSection[]>([]);
  const [custom, setCustom] = useState(false);
  const [wordStats, setWordStats] = useState<WordStats>({});
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    setError('');
    const [wordList, mastery] = await Promise.all([api.getWords(), api.getWordMastery()]);
    setWords(toWords(wordList));
    setSections(wordList.sections ?? []);
    setCustom(Boolean(wordList.custom));
    setWordStats(
      Object.fromEntries(
        Object.entries(mastery.mastery).map(([id, stats]) => [
          Number(id),
          { correct: stats.correct, total: stats.total },
        ]),
      ),
    );
  }, []);

  useEffect(() => {
    reload().catch(() => setError('Could not load your course'));
  }, [reload]);

  const recordAnswer = useCallback(async (wordId: number, isCorrect: boolean, responseTimeMs?: number) => {
    await api.wordAnswered({ wordId, isCorrect, responseTimeMs });
    setWordStats((current) => {
      const previous = current[wordId] ?? { correct: 0, total: 0 };
      return {
        ...current,
        [wordId]: {
          total: previous.total + 1,
          correct: previous.correct + (isCorrect ? 1 : 0),
        },
      };
    });
  }, []);

  if (error) {
    return (
      <div className="p-8 text-stone-600">
        <p>{error}</p>
        <button type="button" onClick={() => reload().catch(() => setError('Could not load your course'))} className="mt-3 underline">
          Try again
        </button>
      </div>
    );
  }

  if (!words) {
    return <div className="p-8 text-stone-600">Loading your course…</div>;
  }

  return (
    <CourseContext.Provider value={{ words, sections, custom, wordStats, reload, recordAnswer }}>
      {children}
    </CourseContext.Provider>
  );
}

export function useCourse() {
  const course = useContext(CourseContext);
  if (!course) throw new Error('useCourse must be used inside CourseProvider');
  return course;
}
