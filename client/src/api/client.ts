export type SessionUser = {
  id: number;
  email: string;
  displayName: string;
};

export type CourseSection = {
  sectionNum: number;
  name: string;
};

export type WordMasteryResponse = {
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

export type VocabPreview = {
  wordCount: number;
  replacesCustom: boolean;
  skipped: { line: number; reason: string }[];
  sections: {
    sectionNum: number;
    name: string;
    lessons: { lessonNum: number; words: { term: string; translation: string }[] }[];
  }[];
};

export interface WordsResponse {
  userId: number;
  courseId: number;
  custom: boolean;
  sections: CourseSection[];
  words: {
    id: number;
    sectionNum: number;
    lessonNum: number;
    category: string;
    romaji: string;
    english: string;
  }[];
}
const BASE_URL = import.meta.env.VITE_API_URL ?? '';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    let msg = `API error ${res.status}`;
    try {
      const data: any = await res.json();
      if (data?.message) msg = data.message;
      else if (data?.error) msg = data.error;
    } catch {
      // ignore JSON parse errors
    }
    throw new Error(msg);
  }

  // Some endpoints might return 204 No Content
  if (res.status === 204) return undefined as T;

  return res.json();
}

export const api = {
  register: (body: { email: string; password: string; displayName: string }) =>
    request<{ user: SessionUser }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  login: (body: { email: string; password: string }) =>
    request<{ user: SessionUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  logout: () => request('/api/auth/logout', { method: 'POST' }),

  me: async (): Promise<SessionUser | null> => {
    const res = await fetch(`${BASE_URL}/api/auth/me`, { credentials: 'include' });
    if (res.status === 401) return null;
    if (!res.ok) throw new Error('Could not load your account');
    const data = await res.json();
    return data.user as SessionUser;
  },

  // ========================
  // PROGRESS
  // ========================

  getProgress: () => request('/api/progress'),

  updateLesson: (body: {
    sectionNum: number;
    lesson: string;
    completed?: boolean;
    score?: number;
    flashcardProgress?: number;
  }) =>
    request('/api/progress/lesson', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  updateSectionTest: (body: { sectionNum: number; score: number }) =>
    request('/api/progress/section-test', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  getWordMastery: (): Promise<WordMasteryResponse> =>
    request('/api/progress/word-mastery') as Promise<WordMasteryResponse>,

  getWords: (): Promise<WordsResponse> =>
    request('/api/progress/words') as Promise<WordsResponse>,

  wordAnswered: (body: { wordId: number; isCorrect: boolean; responseTimeMs?: number }) =>
    request('/api/events/word-answered', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  streakAction: (body: { source: string }) =>
    request('/api/events/streak-action', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  achievementProgress: () =>
    request('/api/events/achievement-progress', {
      method: 'POST',
      body: JSON.stringify({}),
    }),

  studySession: (body: { startTime: string; endTime: string; totalDuration: string }) =>
    request('/api/events/study-session', {
      method: 'POST',
      body: JSON.stringify(body),
      keepalive: true,
    }),

  // ========================
  // LEADERBOARD
  // ========================

  previewVocab: (csv: string) =>
    request<VocabPreview>('/api/vocab/preview', {
      method: 'POST',
      body: JSON.stringify({ csv }),
    }),

  importVocab: (csv: string) =>
    request('/api/vocab/import', {
      method: 'POST',
      body: JSON.stringify({ csv }),
    }),

  resetVocab: () => request('/api/vocab/reset', { method: 'POST' }),

  addScore: (body: { score: number; difficulty: string; sectionNum?: number | null }) =>
    request('/api/leaderboard', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  getTop10: () => request('/api/leaderboard/top10'),
};
