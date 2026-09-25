import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, SessionUser } from '../../api/client';

type AuthPageProps = {
  mode: 'login' | 'register';
  onAuthed: (user: SessionUser) => void;
};

export default function AuthPage({ mode, onAuthed }: AuthPageProps) {
  const navigate = useNavigate();
  const isRegister = mode === 'register';
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const result = isRegister
        ? await api.register({ email, password, displayName })
        : await api.login({ email, password });
      onAuthed(result.user);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-full flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <Link to="/" className="text-sm font-medium tracking-wide text-blue-800">WordPlay</Link>
          <h1 className="mt-2 text-4xl text-stone-900">
            {isRegister ? 'Create your account' : 'Welcome back'}
          </h1>
          <p className="mt-2 text-stone-600">
            {isRegister
              ? 'Start with the starter Japanese course. You can add your own lists later.'
              : 'Pick up your lessons, streaks, and scores.'}
          </p>
        </div>

        <form onSubmit={onSubmit} className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4">
          {isRegister && (
            <label className="block">
              <span className="text-sm font-medium text-stone-700">Display name</span>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-stone-900"
                autoComplete="nickname"
                required
              />
            </label>
          )}
          <label className="block">
            <span className="text-sm font-medium text-stone-700">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-stone-900"
              autoComplete="email"
              required
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-stone-700">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-stone-900"
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              minLength={8}
              required
            />
          </label>

          {error && <p className="text-sm text-red-700">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-blue-700 text-white py-2.5 font-medium hover:bg-blue-800 disabled:opacity-60"
          >
            {submitting ? 'Please wait…' : isRegister ? 'Create account' : 'Log in'}
          </button>
        </form>

        <p className="mt-4 text-sm text-stone-600">
          {isRegister ? (
            <>
              Already have an account?{' '}
              <Link className="text-blue-800 underline" to="/login">Log in</Link>
            </>
          ) : (
            <>
              New here?{' '}
              <Link className="text-blue-800 underline" to="/register">Create an account</Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
