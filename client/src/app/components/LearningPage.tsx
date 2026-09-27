import { useState, useEffect, useRef } from 'react';
import {
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  CheckCircle,
  XCircle,
  BookOpen,
  Dumbbell,
  RefreshCw,
  Volume2,
  Lock,
} from 'lucide-react';

import { vocabularyData, courseSections, updateWordStats, userWordStats } from '../data/vocabulary';
import { colorsForSection, lessonColors } from '../data/sectionColors';
import SectionTestPage from '../components/SectionTestPage';

import { api } from '../../api/client';

interface LearningPageProps {
  onProgressUpdate: (updates: { wordsLearned?: number; correctAnswers?: number; studyStreak?: number }) => void;
}

type ViewMode = 'sections' | 'flashcards' | 'exercises' | 'results' | 'sectionTest';
type LessonType = `lesson${number}` | 'test';

type LessonStats = {
  completed: boolean;
  score: number;
  flashcardProgress: number;
};

type SectionTestScore = {
  best: number;
  latest: number;
};

export default function LearningPage({ onProgressUpdate }: LearningPageProps) {
  const [openSections, setOpenSections] = useState<Set<number>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>('sections');
  const [selectedSection, setSelectedSection] = useState<number>(1);
  const [selectedLesson, setSelectedLesson] = useState<LessonType>('lesson1');

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [studiedWords, setStudiedWords] = useState<Set<number>>(new Set());

  const [exerciseWords, setExerciseWords] = useState<typeof vocabularyData>([]);
  const [isReviewSession, setIsReviewSession] = useState(false);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string>('');
  const [answeredQuestions, setAnsweredQuestions] = useState<Map<number, boolean>>(new Map());
  const [incorrectWords, setIncorrectWords] = useState<Set<number>>(new Set());
  const [currentOptions, setCurrentOptions] = useState<string[]>([]);

  // track when the current exercise question was shown
  const shownAtMsRef = useRef<number>(Date.now());

  // Backend-loaded progress
  const [lessonStats, setLessonStats] = useState<Record<string, LessonStats>>({});
  const [sectionTestScores, setSectionTestScores] = useState<Record<number, SectionTestScore>>({});

  // Load progress from backend when entering LearningPage
  useEffect(() => {
    const load = async () => {
      try {
        const data: any = await api.getProgress();

        // lessonStats already keyed like "1-lesson1" in your backend
        setLessonStats(data.lessonStats ?? {});

        const sts: Record<number, SectionTestScore> = {};
        const raw = data.sectionTestScores ?? {};
        for (const k of Object.keys(raw)) {
          const value = raw[k];
          if (typeof value === 'number') {
            sts[Number(k)] = { best: value, latest: value };
          } else if (value && typeof value.best === 'number' && typeof value.latest === 'number') {
            sts[Number(k)] = { best: value.best, latest: value.latest };
          }
        }
        setSectionTestScores(sts);
      } catch (e) {
        console.error('Failed to load progress:', e);
      }
    };

    load();
  }, []);

  const playAudio = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ja-JP';
    utterance.rate = 0.8;
    window.speechSynthesis.speak(utterance);
  };

  const toggleSection = (section: number) => {
    const newOpenSections = new Set(openSections);
    if (newOpenSections.has(section)) newOpenSections.delete(section);
    else newOpenSections.add(section);
    setOpenSections(newOpenSections);
  };

  const lessonNumbersFor = (section: number) => {
    return [...new Set(vocabularyData.filter((word) => word.section === section).map((word) => word.lessonNum))].sort(
      (a, b) => a - b
    );
  };

  const getLessonWords = (section: number, lesson: LessonType) => {
    const sectionWords = vocabularyData.filter((w) => w.section === section);
    if (lesson === 'test') return sectionWords;
    const lessonNumber = Number(lesson.replace('lesson', ''));
    return sectionWords.filter((w) => w.lessonNum === lessonNumber);
  };

  const getFlashcardProgress = (section: number, lesson: LessonType): number => {
    const key = `${section}-${lesson}`;
    return lessonStats[key]?.flashcardProgress || 0;
  };

  const canStartExercises = (): boolean => {
    const progress = getFlashcardProgress(selectedSection, selectedLesson);
    return progress === 100;
  };

  const shuffleArray = <T,>(arr: T[]): T[] => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const startFlashcards = (section: number, lesson: LessonType, reviewWords?: typeof vocabularyData) => {
    setSelectedSection(section);
    setSelectedLesson(lesson);
    setCurrentIndex(0);
    setIsFlipped(false);
    setIsReviewSession(Boolean(reviewWords));

    const words = reviewWords || getLessonWords(section, lesson);

    if (reviewWords) {
      setStudiedWords(new Set());
      setExerciseWords(reviewWords);
    } else {
      const key = `${section}-${lesson}`;
      const existingProgress = lessonStats[key]?.flashcardProgress || 0;
      const existingStudiedCount = Math.floor((existingProgress / 100) * words.length);

      const initialStudied = new Set<number>();
      for (let i = 0; i < existingStudiedCount; i++) {
        if (words[i]) initialStudied.add(words[i].id);
      }
      setStudiedWords(initialStudied);
      setExerciseWords([]);
    }

    setViewMode('flashcards');
  };

  const generateMultipleChoiceOptions = (correctAnswer: string, section: number) => {
    const sectionTranslations = vocabularyData
      .filter((w) => w.section === section)
      .map((w) => w.translation)
      .filter((t) => t !== correctAnswer);

    const shuffled = shuffleArray(sectionTranslations);
    const distractors = shuffled.slice(0, 3);
    return shuffleArray([correctAnswer, ...distractors]);
  };

  const startExercises = () => {
    const words = getLessonWords(selectedSection, selectedLesson);
    const shuffledWords = shuffleArray(words);

    setExerciseWords(shuffledWords);
    setCurrentExerciseIndex(0);
    setSelectedAnswer('');
    setAnsweredQuestions(new Map());
    setIncorrectWords(new Set());

    if (shuffledWords.length > 0) {
      const firstOptions = generateMultipleChoiceOptions(shuffledWords[0].translation, selectedSection);
      setCurrentOptions(firstOptions);
    }

    // start timing when the first exercise question is shown
    shownAtMsRef.current = Date.now();

    setViewMode('exercises');
  };

  const getCurrentWords = () => {
    if (viewMode === 'exercises' || viewMode === 'results') return exerciseWords;
    return exerciseWords.length > 0 ? exerciseWords : getLessonWords(selectedSection, selectedLesson);
  };

  const currentWords = getCurrentWords();
  const currentWord =
    currentWords[viewMode === 'exercises' || viewMode === 'results' ? currentExerciseIndex : currentIndex];

  const handleNext = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev + 1) % currentWords.length);
  };

  const handlePrevious = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev - 1 + currentWords.length) % currentWords.length);
  };

  const handleFlip = () => setIsFlipped(!isFlipped);

  // Save lesson stats to backend (PATCH /api/progress/lesson)
  const updateLessonScores = async (lessonKey: string, stats: LessonStats) => {
    const [sectionStr, lesson] = lessonKey.split('-');
    const sectionNum = Number(sectionStr);

    try {
      await api.updateLesson({
        sectionNum,
        lesson,
        completed: stats.completed,
        score: stats.score,
        flashcardProgress: stats.flashcardProgress,
      });

      // trigger global refresh if parent wants
      onProgressUpdate({});
    } catch (e) {
      console.error('Failed to update lesson scores:', e);
    }
  };

  // Save section test score (PATCH /api/progress/section-test)
  const updateSectionTestScore = async (sectionNum: number, score: number) => {
    try {
      const saved = (await api.updateSectionTest({ sectionNum, score })) as {
        sectionNum: number;
        best: number;
        latest: number;
      };
      setSectionTestScores((prev) => ({
        ...prev,
        [sectionNum]: { best: saved.best, latest: saved.latest },
      }));
      onProgressUpdate({});
    } catch (e) {
      console.error('Failed to update section test score:', e);
    }
  };

  const markAsKnown = async () => {
    if (currentWord && !studiedWords.has(currentWord.id)) {
      const newStudiedWords = new Set(studiedWords);
      newStudiedWords.add(currentWord.id);
      setStudiedWords(newStudiedWords);

      if (!isReviewSession) {
        const progress = Math.round((newStudiedWords.size / currentWords.length) * 100);
        const key = `${selectedSection}-${selectedLesson}`;

        const updatedLesson: LessonStats = {
          ...(lessonStats[key] ?? { completed: false, score: 0, flashcardProgress: 0 }),
          flashcardProgress: progress,
        };

        setLessonStats((prev) => ({ ...prev, [key]: updatedLesson }));
        await updateLessonScores(key, updatedLesson);
      }

      const stats = userWordStats[currentWord.id];
      if (stats && stats.total === 1) {
        onProgressUpdate({ wordsLearned: 1, correctAnswers: 1 });
      }
    }
    handleNext();
  };

  const handleAnswerSelect = async (answer: string) => {
    if (answeredQuestions.has(currentExerciseIndex)) return;

    setSelectedAnswer(answer);
    const isCorrect = answer === currentWord.translation;

    const newAnswered = new Map(answeredQuestions);
    newAnswered.set(currentExerciseIndex, isCorrect);
    setAnsweredQuestions(newAnswered);

    // Only include responseTimeMs if correct
    if (isCorrect) {
      const responseTimeMs = Date.now() - shownAtMsRef.current;
      updateWordStats(currentWord.id, true, responseTimeMs);
    } else {
      updateWordStats(currentWord.id, false);
    }

    if (!isCorrect) {
      const newIncorrect = new Set(incorrectWords);
      newIncorrect.add(currentWord.id);
      setIncorrectWords(newIncorrect);
    } else {
      onProgressUpdate({ correctAnswers: 1 });
    }

    setTimeout(async () => {
      if (currentExerciseIndex < exerciseWords.length - 1) {
        const nextIndex = currentExerciseIndex + 1;
        setCurrentExerciseIndex(nextIndex);
        setSelectedAnswer('');

        const nextOptions = generateMultipleChoiceOptions(exerciseWords[nextIndex].translation, selectedSection);
        setCurrentOptions(nextOptions);

        // start timing for next question as it becomes active
        shownAtMsRef.current = Date.now();
      } else {
        const correct = Array.from(newAnswered.values()).filter((v) => v).length;
        const score = Math.round((correct / exerciseWords.length) * 100);
        const key = `${selectedSection}-${selectedLesson}`;

        const updatedLesson: LessonStats = {
          ...(lessonStats[key] ?? { completed: false, score: 0, flashcardProgress: 0 }),
          completed: true,
          score,
        };

        setLessonStats((prev) => ({ ...prev, [key]: updatedLesson }));
        await updateLessonScores(key, updatedLesson);

        // streak increment (daily logic is backend)
        try {
          await api.streakAction({ source: 'LESSON_EXERCISE' });
        } catch (e) {
          console.error('streakAction failed:', e);
        }

        onProgressUpdate({ studyStreak: 1 });
        setViewMode('results');
      }
    }, 1500);
  };

  const correctCount = Array.from(answeredQuestions.values()).filter((v) => v).length;
  const totalQuestions = exerciseWords.length;

  const backToSections = () => {
    setViewMode('sections');
    setExerciseWords([]);
    setIsReviewSession(false);
    setCurrentIndex(0);
    setCurrentExerciseIndex(0);
    setSelectedAnswer('');
    setAnsweredQuestions(new Map());
    setIncorrectWords(new Set());
    setStudiedWords(new Set());
  };

  const reviewMistakes = () => {
    const mistakeWords = shuffleArray(vocabularyData.filter((w) => incorrectWords.has(w.id)));
    startFlashcards(selectedSection, selectedLesson, mistakeWords);
  };

  const handleSectionTestComplete = async (score: number) => {
    await updateSectionTestScore(selectedSection, score);

    // streak increment
    try {
      await api.streakAction({ source: 'SECTION_TEST' });
      onProgressUpdate({ studyStreak: 1 });
    } catch (e) {
      console.error('streakAction failed:', e);
    }
  };

  const areAllLessonsComplete = (sectionNum: number): boolean => {
    const lessons = lessonNumbersFor(sectionNum);
    return lessons.length > 0 && lessons.every((lesson) => lessonStats[`${sectionNum}-lesson${lesson}`]?.completed);
  };

  const isSectionComplete = (sectionNum: number): boolean => {
    return areAllLessonsComplete(sectionNum) && sectionTestScores[sectionNum]?.best === 100;
  };

  if (viewMode === 'sectionTest') {
    return (
      <SectionTestPage
        sectionNum={selectedSection}
        onBack={backToSections}
        onProgressUpdate={onProgressUpdate}
        onTestComplete={handleSectionTestComplete}
      />
    );
  }

  if (viewMode === 'sections') {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Learning Mode</h1>
          <p className="text-lg text-gray-600">
            Choose a section and lesson to begin studying
          </p>
        </div>

        <div className="space-y-4">
          {courseSections.map((section) => {
            const sectionNum = section.sectionNum;
            const isOpen = openSections.has(sectionNum);
            const sectionWords = vocabularyData.filter(w => w.section === sectionNum);
            const colors = colorsForSection(sectionNum);
            const lessonNumbers = lessonNumbersFor(sectionNum);

            return (
              <div key={sectionNum} className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
                <button
                  onClick={() => toggleSection(sectionNum)}
                  className={`w-full px-6 py-4 flex items-center justify-between bg-gradient-to-r ${colors.header} hover:${colors.headerHover} transition-colors`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`${colors.badge} text-white px-3 py-1 rounded-lg font-semibold text-sm`}>
                      Section {sectionNum}
                    </div>
                    <h2 className="text-xl font-bold text-gray-900">
                      {section.name}
                    </h2>
                    <span className="text-sm text-gray-600">
                      ({sectionWords.length} words)
                    </span>
                    {/* Show "Section Completed" indicator on header */}
                    {isSectionComplete(sectionNum) && (
                      <span className="ml-2 bg-green-600 text-white px-3 py-1 rounded-lg font-semibold text-xs">
                        ✓ Section Completed
                      </span>
                    )}
                  </div>
                  <div className="text-gray-600">
                    {isOpen ? <ChevronUp className="size-6" /> : <ChevronDown className="size-6" />}
                  </div>
                </button>

                {isOpen && (
                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {lessonNumbers.map((lessonNum) => {
                        const lessonKey = `lesson${lessonNum}` as LessonType;
                        const style = lessonColors(sectionNum, lessonNum);
                        return (
                          <button
                            key={lessonKey}
                            onClick={() => startFlashcards(sectionNum, lessonKey)}
                            className={`bg-gradient-to-br ${style.card} rounded-lg p-6 hover:shadow-lg transition-all text-left group`}
                          >
                            <div className={`${style.icon} p-3 rounded-lg w-fit mb-3`}>
                              <BookOpen className="size-6 text-white" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 mb-1">Lesson {lessonNum}</h3>
                            <p className="text-sm text-gray-600 mb-2">
                              {getLessonWords(sectionNum, lessonKey).length} words
                            </p>
                            <div className="text-xs text-gray-700 mt-2 pt-2 border-t border-gray-300">
                              <div className="flex items-center justify-between mb-1">
                                <span>Flashcards</span>
                                <span className="font-semibold">{getFlashcardProgress(sectionNum, lessonKey)}%</span>
                              </div>
                              {lessonStats[`${sectionNum}-${lessonKey}`]?.completed && (
                                <div className="flex items-center justify-between">
                                  <span>✓ Exercise</span>
                                  <span className="font-semibold">{lessonStats[`${sectionNum}-${lessonKey}`].score}%</span>
                                </div>
                              )}
                              {getFlashcardProgress(sectionNum, lessonKey) === 100 &&
                               sectionTestScores[sectionNum]?.best === 100 && (
                                <div className="mt-1 text-green-600 font-semibold">
                                  ✓ Completed
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })}

                      {/* Section Test */}
                      <button
                        onClick={() => {
                          // Check if all lessons are complete before allowing section test
                          if (!areAllLessonsComplete(sectionNum)) {
                            alert('Finish every lesson in this section before taking the section test.');
                            return;
                          }
                          setSelectedSection(sectionNum);
                          setViewMode('sectionTest');
                        }}
                        className={`bg-gradient-to-br ${colors.test} rounded-lg p-6 transition-all text-left group relative ${
                          areAllLessonsComplete(sectionNum) 
                            ? 'hover:shadow-lg cursor-pointer' 
                            : 'opacity-50 cursor-not-allowed'
                        }`}
                      >
                        {/* Lock icon overlay when lessons are not complete */}
                        {!areAllLessonsComplete(sectionNum) && (
                          <div className="absolute top-3 right-3">
                            <Lock className="size-5 text-gray-600" />
                          </div>
                        )}
                        <div className={`${colors.testIcon} p-3 rounded-lg w-fit mb-3`}>
                          <Dumbbell className="size-6 text-white" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-1">Section Test</h3>
                        <p className="text-sm text-gray-600 mb-2">
                          All {sectionWords.length} words
                        </p>
                        {!areAllLessonsComplete(sectionNum) && (
                          <div className="text-xs text-red-600 font-semibold mt-2 pt-2 border-t border-gray-300">
                            Complete all lessons first
                          </div>
                        )}
                        {sectionTestScores[sectionNum] && (
                          <div className="text-xs text-gray-700 mt-2 pt-2 border-t border-gray-300">
                            <div className="flex items-center justify-between">
                              <span>Best</span>
                              <span className="font-semibold">{sectionTestScores[sectionNum].best}%</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>Latest</span>
                              <span className="font-semibold">{sectionTestScores[sectionNum].latest}%</span>
                            </div>
                          </div>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (viewMode === 'flashcards') {
    const flashcardProgress = currentWords.length === 0
      ? 0
      : Math.round((studiedWords.size / currentWords.length) * 100);
    const canDoExercises = isReviewSession
      ? getFlashcardProgress(selectedSection, selectedLesson) === 100
      : flashcardProgress === 100;

    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <button
            onClick={backToSections}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4"
          >
            <ChevronLeft className="size-5" />
            Back to Sections
          </button>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Section {selectedSection} - {selectedLesson === 'test' ? 'Section Test' : `Lesson ${selectedLesson.replace('lesson', '')}`}
          </h1>
          <p className="text-lg text-gray-600">
            Study {currentWords.length} words with flashcards
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Studying {currentWords.length} words • {studiedWords.size} marked as known
            </div>
            {canDoExercises ? (
              <button
                onClick={startExercises}
                className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
              >
                <Dumbbell className="size-5" />
                Start Exercises
              </button>
            ) : (
              <div className="flex items-center gap-2 bg-gray-300 text-gray-600 px-4 py-2 rounded-lg cursor-not-allowed">
                <Lock className="size-5" />
                Complete Flashcards First
              </div>
            )}
          </div>
        </div>

        <div className="mb-6">
          <div className="text-center mb-4 text-sm font-medium text-gray-600">
            Card {currentIndex + 1} of {currentWords.length}
          </div>
          
          <div 
            onClick={handleFlip}
            className="relative bg-white rounded-2xl shadow-2xl border-2 border-gray-200 cursor-pointer overflow-hidden transition-all hover:shadow-3xl"
            style={{ minHeight: '400px' }}
          >
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8">
              {!isFlipped ? (
                <div className="text-center">
                  <div className="text-sm font-medium text-gray-500 mb-4">
                    {currentWord.category} • Section {currentWord.section}
                  </div>
                  <div className="text-6xl font-bold text-blue-600 mb-6">
                    {currentWord.word}
                  </div>
                  <div className="mt-8 text-sm text-gray-500">
                    Click to reveal English meaning
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <div className="text-sm font-medium text-gray-500 mb-4">
                    English Meaning
                  </div>
                  <div className="text-6xl font-bold text-gray-900 mb-6">
                    {currentWord.translation}
                  </div>
                  <div className="text-3xl text-blue-400 mb-4">
                    {currentWord.word}
                  </div>
                  <div className="mt-8 text-sm text-gray-500">
                    Click to flip back
                  </div>
                </div>
              )}
            </div>

            <div className="absolute top-4 right-4 flex gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  playAudio(currentWord.word);
                }}
                className="bg-gray-100 p-2 rounded-full hover:bg-gray-200 transition-colors"
              >
                <Volume2 className="size-5 text-gray-600" />
              </button>
              <div className="bg-gray-100 p-2 rounded-full">
                <RotateCw className="size-5 text-gray-600" />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 mb-6">
          <button
            onClick={handlePrevious}
            className="flex items-center gap-2 px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
          >
            <ChevronLeft className="size-5" />
            Previous
          </button>

          <div className="flex gap-3">
            <button
              onClick={handleNext}
              className="flex items-center gap-2 px-6 py-3 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors border border-red-200"
            >
              <XCircle className="size-5" />
              Still Learning
            </button>
            <button
              onClick={markAsKnown}
              className="flex items-center gap-2 px-6 py-3 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors border border-green-200"
            >
              <CheckCircle className="size-5" />
              I Know This
            </button>
          </div>

          <button
            onClick={handleNext}
            className="flex items-center gap-2 px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
          >
            Next
            <ChevronRight className="size-5" />
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Learning Progress</span>
            <span className="text-sm font-medium text-gray-700">
              {flashcardProgress}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-blue-600 h-3 rounded-full transition-all duration-300"
              style={{ width: `${flashcardProgress}%` }}
            />
          </div>
          {flashcardProgress < 100 && (
            <p className="text-xs text-gray-500 mt-2">
              Complete all flashcards to unlock exercises
            </p>
          )}
        </div>
      </div>
    );
  }

  if (viewMode === 'exercises') {
    const options = currentOptions;
    const isAnswered = answeredQuestions.has(currentExerciseIndex);
    const isCorrect = answeredQuestions.get(currentExerciseIndex);

    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <button
            onClick={() => setViewMode('flashcards')}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4"
          >
            <ChevronLeft className="size-5" />
            Back to Flashcards
          </button>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Exercise Quiz
          </h1>
          <p className="text-lg text-gray-600">
            Question {currentExerciseIndex + 1} of {totalQuestions}
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-8 mb-6">
          <div className="text-center mb-8">
            <p className="text-sm text-gray-600 mb-4">What is the translation of:</p>
            <h2 className="text-5xl font-bold text-gray-900">{currentWord.word}</h2>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {options.map((option, index) => {
              const isSelected = selectedAnswer === option;
              const isCorrectOption = option === currentWord.translation;
              
              let buttonClass = 'w-full p-4 rounded-lg border-2 text-lg font-medium transition-all ';
              
              if (isAnswered) {
                if (isCorrectOption) {
                  buttonClass += 'bg-green-100 border-green-500 text-green-800';
                } else if (isSelected && !isCorrect) {
                  buttonClass += 'bg-red-100 border-red-500 text-red-800';
                } else {
                  buttonClass += 'bg-gray-100 border-gray-300 text-gray-500';
                }
              } else {
                buttonClass += 'bg-white border-gray-300 text-gray-900 hover:bg-blue-50 hover:border-blue-500';
              }

              return (
                <button
                  key={index}
                  onClick={() => handleAnswerSelect(option)}
                  disabled={isAnswered}
                  className={buttonClass}
                >
                  {option}
                  {isAnswered && isCorrectOption && (
                    <CheckCircle className="inline-block ml-2 size-5 text-green-600" />
                  )}
                  {isAnswered && isSelected && !isCorrect && (
                    <XCircle className="inline-block ml-2 size-5 text-red-600" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Progress</span>
            <span className="text-sm font-medium text-gray-700">
              {correctCount}/{totalQuestions} correct
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-green-600 h-3 rounded-full transition-all duration-300"
              style={{ width: `${(answeredQuestions.size / totalQuestions) * 100}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  if (viewMode === 'results') {
    const percentage = Math.round((correctCount / totalQuestions) * 100);

    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl shadow-md border-2 border-blue-300 p-12 text-center">
          <div className="bg-blue-100 p-6 rounded-full w-fit mx-auto mb-6">
            <CheckCircle className="size-16 text-blue-600" />
          </div>
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Exercise Complete!
          </h2>
          <p className="text-xl text-gray-700 mb-6">
            You got <span className="text-3xl font-bold text-blue-600">{correctCount}/{totalQuestions}</span> correct
          </p>
          <div className="text-2xl font-bold text-gray-900 mb-8">
            Score: {percentage}%
          </div>

          <div className="flex gap-4 justify-center">
            {incorrectWords.size > 0 && (
              <button
                onClick={reviewMistakes}
                className="inline-flex items-center gap-2 bg-orange-600 text-white px-6 py-3 rounded-lg hover:bg-orange-700 transition-colors shadow-lg"
              >
                <RefreshCw className="size-5" />
                Review Mistakes ({incorrectWords.size})
              </button>
            )}
            <button
              onClick={backToSections}
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors shadow-lg"
            >
              <ChevronLeft className="size-5" />
              Back to Sections
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}