import { useState, useRef, useEffect, useMemo } from "react";
import { ChevronLeft, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { vocabularyData, updateWordStats } from "../data/vocabulary";

interface SectionTestPageProps {
  sectionNum: number;
  onBack: () => void;
  onProgressUpdate: (updates: { correctAnswers?: number }) => void;
  onTestComplete: (score: number) => void;
}

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export default function SectionTestPage({
  sectionNum,
  onBack,
  onProgressUpdate,
  onTestComplete,
}: SectionTestPageProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userInput, setUserInput] = useState("");
  const [answerChecked, setAnswerChecked] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [flashColor, setFlashColor] = useState("");
  const [answeredQuestions, setAnsweredQuestions] = useState<Map<number, boolean>>(new Map());
  const [showResults, setShowResults] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // track when the current word became active (for response time)
  const shownAtMsRef = useRef<number>(Date.now());

  const sectionWordsBase = useMemo(
    () => vocabularyData.filter((w) => w.section === sectionNum),
    [sectionNum]
  );

  const [shuffledWords, setShuffledWords] = useState(() => shuffleArray(sectionWordsBase));

  useEffect(() => {
    setCurrentIndex(0);
    setUserInput("");
    setAnswerChecked(false);
    setIsCorrect(false);
    setAnsweredQuestions(new Map());
    setShowResults(false);
    setShuffledWords(shuffleArray(sectionWordsBase));

    //reset timer when test (re)starts
    shownAtMsRef.current = Date.now();
  }, [sectionWordsBase]);

  const currentWord = shuffledWords[currentIndex];

  useEffect(() => {
    inputRef.current?.focus();

    //start timing when the word changes / is shown
    shownAtMsRef.current = Date.now();
  }, [currentIndex]);

  useEffect(() => {
    if (flashColor) {
      const timer = setTimeout(() => setFlashColor(""), 500);
      return () => clearTimeout(timer);
    }
  }, [flashColor]);

  const correctCount = Array.from(answeredQuestions.values()).filter(Boolean).length;
  const percentage =
    shuffledWords.length === 0 ? 0 : Math.round((correctCount / shuffledWords.length) * 100);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (answerChecked || !currentWord) return;

    const trimmedInput = userInput.trim().toLowerCase();
    const correct = trimmedInput === currentWord.translation.toLowerCase();

    setIsCorrect(correct);
    setAnswerChecked(true);
    setFlashColor(correct ? "bg-green-200" : "bg-red-200");

    const newAnswered = new Map(answeredQuestions);
    newAnswered.set(currentWord.id, correct);
    setAnsweredQuestions(newAnswered);

    //only include responseTimeMs if correct
    if (correct) {
      const responseTimeMs = Date.now() - shownAtMsRef.current;
      updateWordStats(currentWord.id, true, responseTimeMs);
    } else {
      updateWordStats(currentWord.id, false);
    }

    if (correct) {
      onProgressUpdate({ correctAnswers: 1 });
    }
  };

  const handleNext = async () => {
    if (currentIndex < shuffledWords.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setUserInput("");
      setAnswerChecked(false);
      setIsCorrect(false);
    } else {
      // Test complete. The parent saves the score and records the daily streak.
      onTestComplete(percentage);
      setShowResults(true);
    }
  };

  const retryTest = () => {
    setCurrentIndex(0);
    setUserInput("");
    setAnswerChecked(false);
    setIsCorrect(false);
    setAnsweredQuestions(new Map());
    setShowResults(false);
    setShuffledWords(shuffleArray(sectionWordsBase));

    //reset timer on retry
    shownAtMsRef.current = Date.now();
  };

  if (showResults) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-2xl w-full bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl shadow-md border-2 border-blue-300 p-12 text-center">
          <div className="bg-blue-100 p-6 rounded-full w-fit mx-auto mb-6">
            <CheckCircle className="size-16 text-blue-600" />
          </div>
          <h2 className="text-4xl font-bold text-gray-900 mb-4">Section Test Complete!</h2>
          <p className="text-xl text-gray-700 mb-6">
            You got <span className="text-3xl font-bold text-blue-600">{correctCount}/{shuffledWords.length}</span> correct
          </p>
          <div className="text-2xl font-bold text-gray-900 mb-8">Score: {percentage}%</div>

          <div className="flex gap-4 justify-center">
            <button
              onClick={retryTest}
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors shadow-lg"
            >
              <RefreshCw className="size-5" />
              Retry Test
            </button>
            <button
              onClick={onBack}
              className="inline-flex items-center gap-2 bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-colors shadow-lg"
            >
              <ChevronLeft className="size-5" />
              Back to Sections
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Optional safety UI if section has no words
  if (!currentWord) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 text-center">
          <p className="text-gray-700 mb-4">No words found for section {sectionNum}.</p>
          <button onClick={onBack} className="text-blue-600 hover:text-blue-700 inline-flex items-center gap-2">
            <ChevronLeft className="size-5" />
            Back to Sections
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-screen flex items-center justify-center transition-colors duration-300 ${flashColor || "bg-gray-50"} p-4`}>
      <div className="max-w-3xl w-full">
        <button onClick={onBack} className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-6">
          <ChevronLeft className="size-5" />
          Back to Sections
        </button>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-gray-700 text-center">
            <span className="font-semibold">Complete the Section:</span> You need to score{" "}
            <span className="font-bold text-blue-600">100%</span> on this test to mark the section as completed.
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 mb-6">
          <div className="text-center mb-6">
            <div className="text-sm font-medium text-gray-500 mb-2">
              Question {currentIndex + 1} of {shuffledWords.length}
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${((currentIndex + 1) / shuffledWords.length) * 100}%` }}
              />
            </div>
          </div>

          <div className="text-center mb-8">
            <div className="text-sm font-medium text-gray-500 mb-4">Type the translation of:</div>
            <div className="text-6xl font-bold text-gray-900 mb-2">{currentWord.word}</div>
            {currentWord.category && <div className="text-sm text-gray-500">{currentWord.category}</div>}
          </div>

          <form onSubmit={handleSubmit} className="mb-6">
            <input
              ref={inputRef}
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              disabled={answerChecked}
              className="w-full px-6 py-4 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-2xl text-center font-semibold disabled:bg-gray-100"
              placeholder="Type your answer..."
              autoComplete="off"
            />
          </form>

          {answerChecked && (
            <div className={`mb-6 p-6 rounded-lg ${isCorrect ? "bg-green-50 border-2 border-green-300" : "bg-red-50 border-2 border-red-300"}`}>
              <div className="flex items-center justify-center gap-3 mb-2">
                {isCorrect ? (
                  <>
                    <CheckCircle className="size-8 text-green-600" />
                    <span className="text-2xl font-bold text-green-700">Correct!</span>
                  </>
                ) : (
                  <>
                    <XCircle className="size-8 text-red-600" />
                    <span className="text-2xl font-bold text-red-700">Incorrect</span>
                  </>
                )}
              </div>

              {!isCorrect && (
                <div className="text-center">
                  <p className="text-lg text-gray-700">
                    The correct answer is:{" "}
                    <span className="font-bold text-blue-600">{currentWord.translation}</span>
                  </p>
                </div>
              )}
            </div>
          )}

          {answerChecked ? (
            <div className="text-center">
              <button
                onClick={handleNext}
                className="inline-flex items-center gap-2 bg-blue-600 text-white px-8 py-4 rounded-lg hover:bg-blue-700 transition-colors shadow-lg text-lg font-semibold"
              >
                {currentIndex < shuffledWords.length - 1 ? "Next Question" : "View Results"}
                <ChevronLeft className="size-5 rotate-180" />
              </button>
            </div>
          ) : (
            <div className="text-center text-sm text-gray-500">Press Enter to submit your answer</div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Progress</span>
            <span className="text-sm font-medium text-gray-700">
              {answeredQuestions.size} answered • {correctCount} correct
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}