import { useRef, useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, Volume2 } from 'lucide-react';
import { api, VocabPreview } from '../../api/client';
import {
  vocabularyData,
  userWordStats,
  courseSections,
  usingCustomVocab,
  initializeVocabularyData,
  initializeUserWordStats,
} from '../data/vocabulary';
import { colorsForSection } from '../data/sectionColors';

export default function VocabListPage() {
  const [openSections, setOpenSections] = useState<Set<number>>(new Set());
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [statsVersion, setStatsVersion] = useState(0); // Force re-render when stats load
  const [preview, setPreview] = useState<VocabPreview | null>(null);
  const [pendingCsv, setPendingCsv] = useState('');
  const [importError, setImportError] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadStats = async () => {
      try {
        await initializeUserWordStats();
        console.log('Word stats loaded:', userWordStats);
        setStatsVersion(v => v + 1); // Force re-render
      } catch (error) {
        console.error('Failed to load word stats:', error);
      } finally {
        setIsLoadingStats(false);
      }
    };

    loadStats();
  }, []); // Empty dependency array means this runs once when component mounts

  const reloadList = async () => {
    await initializeVocabularyData();
    await initializeUserWordStats();
    setStatsVersion((version) => version + 1);
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setImportError('');
    setPreview(null);
    try {
      const csv = await file.text();
      const next = await api.previewVocab(csv);
      setPendingCsv(csv);
      setPreview(next);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Could not read that file');
    }
  };

  const saveImport = async () => {
    if (!pendingCsv) return;
    if (preview?.replacesCustom || usingCustomVocab) {
      const ok = window.confirm(
        'This replaces your imported words and erases flashcard progress, quiz scores, section-test scores, and per-word accuracy for that list. XP, your streak, and minigame scores stay.'
      );
      if (!ok) return;
    }
    setBusy(true);
    setImportError('');
    try {
      await api.importVocab(pendingCsv);
      setPreview(null);
      setPendingCsv('');
      await reloadList();
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Import failed');
    } finally {
      setBusy(false);
    }
  };

  const resetVocab = async () => {
    const ok = window.confirm(
      'This removes your imported words and erases flashcard progress, quiz scores, section-test scores, and per-word accuracy for that list. XP, your streak, and minigame scores stay. The original starter vocabulary comes back.'
    );
    if (!ok) return;
    setBusy(true);
    setImportError('');
    try {
      await api.resetVocab();
      setPreview(null);
      setPendingCsv('');
      await reloadList();
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Reset failed');
    } finally {
      setBusy(false);
    }
  };

  const playAudio = (text: string) => {
    // Using Web Speech API for text-to-speech
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ja-JP'; // Japanese language code
    utterance.rate = 0.8; // Slightly slower for learning
    window.speechSynthesis.speak(utterance);
  };

  const toggleSection = (section: number) => {
    const newOpenSections = new Set(openSections);
    if (newOpenSections.has(section)) {
      newOpenSections.delete(section);
    } else {
      newOpenSections.add(section);
    }
    setOpenSections(newOpenSections);
  };

  const getWordsBySection = (section: number) => {
    return vocabularyData.filter(word => word.section === section);
  };

  //this is used to calculate the vocab stat.
  const calculatePercentage = (wordId: number): number => {
    const stats = userWordStats[wordId];
    if (!stats || stats.total === 0) return 0;
    return Math.round((stats.correct / stats.total) * 100);
  };

  const getPercentageColor = (percentage: number) => {
    if (percentage >= 80) return 'text-green-600';
    if (percentage >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Vocabulary List</h1>
        <p className="text-lg text-gray-600">
          Browse {vocabularyData.length} words organized into {courseSections.length} sections
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800"
          >
            Import vocabulary
          </button>
          {usingCustomVocab && (
            <button
              type="button"
              onClick={resetVocab}
              disabled={busy}
              className="px-4 py-2 rounded-lg border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              Reset to starter vocabulary
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              onFile(file);
            }}
          />
        </div>
        {importError && <p className="mt-3 text-sm text-red-600">{importError}</p>}
        {preview && (
          <div className="mt-4 bg-white border border-gray-200 rounded-xl p-4">
            <h2 className="text-lg font-bold text-gray-900">Preview</h2>
            <p className="text-sm text-gray-600 mt-1">
              {preview.wordCount} words in {preview.sections.length} sections.
              {preview.skipped.length > 0 ? ` ${preview.skipped.length} rows skipped.` : ''}
            </p>
            <ul className="mt-3 space-y-1 text-sm text-gray-700">
              {preview.sections.map((section) => (
                <li key={section.sectionNum}>
                  {section.name}: {section.lessons.length} lessons,{' '}
                  {section.lessons.reduce((sum, lesson) => sum + lesson.words.length, 0)} words
                </li>
              ))}
            </ul>
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={saveImport}
                disabled={busy}
                className="px-4 py-2 rounded-lg bg-green-700 text-white hover:bg-green-800 disabled:opacity-50"
              >
                Use this list
              </button>
              <button
                type="button"
                onClick={() => {
                  setPreview(null);
                  setPendingCsv('');
                }}
                className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Loading state */}
      {isLoadingStats && (
        <div className="text-center py-8 text-gray-600">
          Loading statistics...
        </div>
      )}

      {/* Sections */}
      <div className="space-y-4">
        {courseSections.map((section) => {
          const sectionNum = section.sectionNum;
          const words = getWordsBySection(sectionNum);
          const isOpen = openSections.has(sectionNum);
          const colors = colorsForSection(sectionNum);

          return (
            <div key={sectionNum} className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
              {/* Section Header */}
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
                    ({words.length} words)
                  </span>
                </div>
                <div className="text-gray-600">
                  {isOpen ? (
                    <ChevronUp className="size-6" />
                  ) : (
                    <ChevronDown className="size-6" />
                  )}
                </div>
              </button>

              {/* Section Content */}
              {isOpen && (
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {words.map(word => {
                      const percentage = calculatePercentage(word.id);
                      const stats = userWordStats[word.id];

                      return (
                        <div
                          key={word.id}
                          className="bg-gray-50 rounded-lg border border-gray-200 p-5 hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <h3 className="text-xl font-semibold text-blue-600 mb-1">
                                {word.word}
                              </h3>
                              <p className="text-lg text-gray-900">
                                {word.translation}
                              </p>
                            </div>
                            <button
                              onClick={() => playAudio(word.word)}
                              className="ml-3 bg-blue-100 p-2 rounded-full hover:bg-blue-200 transition-colors flex-shrink-0"
                              title="Play audio"
                            >
                              <Volume2 className="size-5 text-blue-600" />
                            </button>
                          </div>
                          
                          <div className="flex items-center gap-2 mb-3">
                            <span className="px-3 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full border border-blue-200">
                              Section {word.section}
                            </span>
                          </div>

                          {/* Statistics */}
                          <div className="pt-3 border-t border-gray-300">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <TrendingUp className="size-4" />
                                <span>Accuracy</span>
                              </div>
                              <div className="text-right">
                                <div className={`text-lg font-bold ${getPercentageColor(percentage)}`}>
                                  {percentage}%
                                </div>
                                {stats && (
                                  <div className="text-xs text-gray-500">
                                    {stats.correct}/{stats.total} correct
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
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