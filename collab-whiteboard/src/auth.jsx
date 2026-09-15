import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

function Auth({ onAuthChange }) {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState('login'); // 'login' or 'signup'
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      onAuthChange(session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      onAuthChange(session);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
    }
  }

  async function handleGoogleLogin() {
    await supabase.auth.signInWithOAuth({ provider: 'google' });
  }

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  if (session) {
    return (
      <div style={{ marginBottom: 10 }}>
        <span>Logged in as {session.user.email}</span>
        {' '}
        <button onClick={handleLogout}>Log out</button>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 10 }}>
      <form onSubmit={handleSubmit} style={{ display: 'inline' }}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit">{mode === 'login' ? 'Log In' : 'Sign Up'}</button>
      </form>
      {' '}
      <button onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
        {mode === 'login' ? 'Need an account? Sign up' : 'Have an account? Log in'}
      </button>
      {' '}
      <button onClick={handleGoogleLogin}>Sign in with Google</button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
}

export default Auth;