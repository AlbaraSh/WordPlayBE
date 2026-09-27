import { api, CourseSection, WordsResponse } from "../../api/client";

// Vocabulary word type
export interface VocabWord {
  id: number;
  word: string;
  translation: string;
  category: string;
  section: number;
  lessonNum: number;
}

type WordMasteryResponse = {
  mastery: Record<
    string,
    {
      total: number;
      correct: number;
      accuracy: number;
      firstCorrectAt: string | null;
      updatedAt: string;
    }
  >;
};

export function transformWordsToVocabData(response: WordsResponse): VocabWord[] {
  return response.words.map((word) => ({
    id: word.id,
    word: word.romaji,
    translation: word.english,
    category: word.category,
    section: word.sectionNum,
    lessonNum: word.lessonNum,
  }));
}

// Initialize as empty array
export let vocabularyData: VocabWord[] = [];
export let courseSections: CourseSection[] = [];
export let usingCustomVocab = false;

// Initialize function that fetches and populates vocabularyData
export async function initializeVocabularyData(): Promise<void> {
  try {
    console.log('Fetching words from API...');
    const response = await api.getWords();
    console.log('API response:', response);
    vocabularyData = transformWordsToVocabData(response);
    courseSections = response.sections ?? [];
    usingCustomVocab = Boolean(response.custom);
    console.log('Vocabulary data loaded:', vocabularyData.length, 'words');
  } catch (error) {
    console.error('Failed to load vocabulary data:', error);
    // Set to empty array on error so app can still load
    vocabularyData = [];
    courseSections = [];
    usingCustomVocab = false;
    throw error;
  }
}


// User word stats
export let userWordStats: Record<number, { correct: number; total: number }> = {};

// Initialize user word stats
export async function initializeUserWordStats(): Promise<void> {
  try {
    console.log('Fetching word stats from API...');
    const data = await api.getWordMastery();
    console.log('Word mastery data:', data);

    userWordStats = Object.fromEntries(
      Object.entries(data.mastery).map(([id, stats]) => [
        Number(id),
        { correct: stats.correct, total: stats.total },
      ])
    );

    console.log('User word stats loaded:', Object.keys(userWordStats).length, 'words');
  } catch (error) {
    console.error('Failed to load user word stats:', error);
    userWordStats = {};
    throw error;
  }
}

// Function to update word statistics.
export const updateWordStats = async (
  wordId: number, 
  isCorrect: boolean,
  responseTimeMs?: number
): Promise<void> => {
  try {
    await api.wordAnswered({
      wordId,
      isCorrect,
      responseTimeMs,
    });
  } catch (error) {
    console.error('Failed to update word stats:', error);
    throw error;
  }
};

export const sectionNames: Record<number, string> = {
  1: 'Weather',
  2: 'Colors',
  3: 'Numbers',
  4: 'Days & Months',
  5: 'Everyday',
  6: 'Adjectives',
};