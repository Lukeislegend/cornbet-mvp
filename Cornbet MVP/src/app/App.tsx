import { RouterProvider } from 'react-router';
import { router } from './routes';
import { AppProvider, useApp } from './context/AppContext';
import { Login } from './components/Login';
import { motion, AnimatePresence } from 'motion/react';
import { useState } from 'react';

// ─── DB error banner ──────────────────────────────────────────────────────────
// Must be rendered INSIDE AppProvider (uses useApp)

function DbErrorBanner() {
  const { dbError } = useApp();
  const [dismissed, setDismissed] = useState(false);

  if (!dbError || dismissed) return null;

  const short = dbError.length > 140 ? dbError.slice(0, 140) + '…' : dbError;

  return (
    <AnimatePresence>
      <motion.div
        key="db-error-banner"
        initial={{ opacity: 0, y: -24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -24 }}
        className="fixed top-0 left-0 right-0 z-[999] px-4 py-2"
        style={{
          background: 'rgba(160,36,36,0.97)',
          backdropFilter: 'blur(8px)',
          maxWidth: '393px',
          margin: '0 auto',
        }}
      >
        <div className="flex items-start justify-between gap-2">
          <p style={{ fontSize: '10px', color: 'white', fontWeight: '600', lineHeight: '1.5', flex: 1 }}>
            ⚠️ DB sync issue — running offline.{' '}
            <span style={{ opacity: 0.7, fontWeight: '400' }}>{short}</span>
          </p>
          <button
            onClick={() => setDismissed(true)}
            style={{
              color: 'rgba(255,255,255,0.55)',
              fontSize: '18px',
              lineHeight: 1,
              flexShrink: 0,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Loading spinner ──────────────────────────────────────────────────────────
// Standalone — does NOT use useApp

function LoadingScreen() {
  return (
    <div
      className="flex flex-col items-center justify-center"
      style={{ width: '393px', height: '852px', background: '#111111', margin: '0 auto' }}
    >
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
        style={{ fontSize: '48px', marginBottom: '22px' }}
      >
        🌽
      </motion.div>
      <p style={{ color: 'rgba(255,213,79,0.7)', fontSize: '14px', fontWeight: '700', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
        Loading CornBet
      </p>
      <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '11px', marginTop: '6px' }}>
        Checking your session…
      </p>
    </div>
  );
}

// ─── Auth-gated app shell ─────────────────────────────────────────────────────
// Rendered INSIDE AppProvider — safe to call useApp()
//
//  isLoading  → show spinning corn while restoring Supabase session
//  !user      → show Login (Sign Up / Log In)
//  user       → show full router + DB error banner

function AppShell() {
  const { isLoading, user } = useApp();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Login />;
  }

  return (
    <>
      <DbErrorBanner />
      <RouterProvider router={router} />
    </>
  );
}

// ─── Root export ──────────────────────────────────────────────────────────────
// AppProvider wraps everything — AppShell and DbErrorBanner are safe to use
// useApp() because they are children of AppProvider.

function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}

export default App;
