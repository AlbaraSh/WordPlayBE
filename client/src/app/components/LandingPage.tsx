import { Link } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-full flex flex-col">
      <header className="border-b border-stone-200 bg-white">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GraduationCap className="size-7 text-blue-800" />
            <span className="text-2xl text-stone-900">WordPlay</span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/login" className="px-3 py-2 text-sm font-medium text-stone-700 hover:text-stone-900">
              Log in
            </Link>
            <Link to="/register" className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-700 text-white hover:bg-blue-800">
              Create account
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto px-4 py-16 sm:py-24">
        <p className="text-sm font-medium tracking-wide text-blue-800">Japanese vocabulary</p>
        <h1 className="mt-3 text-5xl text-stone-900 max-w-xl">Practice words until they stick.</h1>
        <p className="mt-5 max-w-xl text-lg text-stone-600 leading-relaxed">
          WordPlay is a study app for a starter Japanese course. Work through flashcards and
          lesson quizzes, take a section test when the lessons are done, and play a short
          falling-words game. Your streak, scores, and words learned stay on your account.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/register" className="px-5 py-3 rounded-lg bg-blue-700 text-white font-medium hover:bg-blue-800">
            Create account
          </Link>
          <Link to="/login" className="px-5 py-3 rounded-lg border border-stone-300 bg-white text-stone-800 font-medium hover:bg-stone-50">
            Log in
          </Link>
        </div>
        <ul className="mt-12 max-w-xl text-stone-700 space-y-2 border-t border-stone-200 pt-6">
          <li>Six sections, from weather and colors through everyday words.</li>
          <li>Flashcards first, then a quiz, then a typed section test.</li>
          <li>A two-minute game and a personal record of your best scores.</li>
        </ul>
      </main>
    </div>
  );
}
