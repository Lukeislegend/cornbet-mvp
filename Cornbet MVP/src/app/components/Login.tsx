import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Eye, EyeOff, Mail, Lock, User, Key, AlertCircle, CheckCircle } from 'lucide-react';
import { MobileContainer } from './MobileContainer';
import { Logo } from './Logo';
import { useApp } from '../context/AppContext';
import { router } from '../routes';

// ─── Shared input field ───────────────────────────────────────────────────────

interface FieldProps {
  id: string;
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  autoComplete?: string;
  icon: React.ReactNode;
  rightEl?: React.ReactNode;
  error?: string;
}

function Field({ id, label, type, value, onChange, placeholder, autoComplete, icon, rightEl, error }: FieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <label
        htmlFor={id}
        style={{
          display: 'block',
          color: 'rgba(255,255,255,0.45)',
          fontSize: '10px',
          fontWeight: '700',
          letterSpacing: '0.9px',
          textTransform: 'uppercase',
          marginBottom: '7px',
        }}
      >
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        {/* Leading icon */}
        <div style={{
          position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)',
          color: focused ? 'rgba(255,179,0,0.7)' : 'rgba(255,255,255,0.25)',
          pointerEvents: 'none', transition: 'color 0.2s',
        }}>
          {icon}
        </div>
        <input
          id={id}
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            width: '100%',
            padding: '13px 40px 13px 40px',
            borderRadius: '14px',
            background: focused ? 'rgba(255,179,0,0.08)' : 'rgba(255,255,255,0.04)',
            border: `1.5px solid ${error ? 'rgba(239,83,80,0.6)' : focused ? 'rgba(255,179,0,0.5)' : 'rgba(255,255,255,0.1)'}`,
            color: 'white',
            fontSize: '15px',
            outline: 'none',
            boxSizing: 'border-box',
            transition: 'background 0.2s, border 0.2s',
          }}
        />
        {/* Trailing element (e.g. show/hide password) */}
        {rightEl && (
          <div style={{
            position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
          }}>
            {rightEl}
          </div>
        )}
      </div>
      {error && (
        <p style={{ color: 'rgba(239,83,80,0.85)', fontSize: '11px', marginTop: '5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <AlertCircle size={10} /> {error}
        </p>
      )}
    </div>
  );
}

// ─── Password field with show/hide toggle ─────────────────────────────────────

interface PasswordFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  error?: string;
}

function PasswordField({ id, label, value, onChange, placeholder = '••••••••', autoComplete, error }: PasswordFieldProps) {
  const [show, setShow] = useState(false);
  return (
    <Field
      id={id}
      label={label}
      type={show ? 'text' : 'password'}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      autoComplete={autoComplete}
      icon={<Lock size={15} />}
      error={error}
      rightEl={
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShow(s => !s)}
          style={{ color: 'rgba(255,255,255,0.3)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex' }}
        >
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      }
    />
  );
}

// ─── Submit button ────────────────────────────────────────────────────────────

interface SubmitButtonProps {
  label: string;
  loading: boolean;
  disabled: boolean;
}

function SubmitButton({ label, loading, disabled }: SubmitButtonProps) {
  return (
    <motion.button
      type="submit"
      whileTap={disabled || loading ? {} : { scale: 0.97 }}
      disabled={disabled || loading}
      className="w-full py-4 rounded-2xl relative overflow-hidden"
      style={{
        background: disabled || loading
          ? 'rgba(255,179,0,0.2)'
          : 'linear-gradient(135deg, #FFB300 0%, #F9A825 100%)',
        boxShadow: disabled || loading ? 'none' : '0 4px 24px rgba(255,179,0,0.35)',
        border: 'none',
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        transition: 'background 0.25s, box-shadow 0.25s',
      }}
    >
      {/* Gloss sheen */}
      {!disabled && !loading && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '45%',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.18) 0%, transparent 100%)',
          pointerEvents: 'none',
        }} />
      )}
      <span style={{
        position: 'relative', zIndex: 1,
        fontSize: '16px', fontWeight: '800', letterSpacing: '0.4px',
        color: disabled || loading ? 'rgba(255,213,79,0.4)' : '#111111',
      }}>
        {loading ? (
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <motion.span
              animate={{ rotate: 360 }}
              transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
              style={{ display: 'inline-block', fontSize: '16px' }}
            >🌽</motion.span>
            {label.includes('Sign') ? 'Just a sec…' : 'Signing in…'}
          </span>
        ) : label}
      </span>
    </motion.button>
  );
}

// ─── Sign Up Form ─────────────────────────────────────────────────────────────

function SignUpForm({ onSuccess }: { onSuccess: () => void }) {
  const { signUp } = useApp();
  const [name,        setName]        = useState('');
  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [confirm,     setConfirm]     = useState('');
  const [inviteCode,  setInviteCode]  = useState('');
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [success,     setSuccess]     = useState(false);

  // Per-field errors
  const nameErr       = error?.toLowerCase().includes('display name') ? error : undefined;
  const emailErr      = !nameErr && error?.toLowerCase().includes('email') ? error : undefined;
  const inviteErr     = error?.toLowerCase().includes('invite') ? error : undefined;
  const passwordErr   = error && !nameErr && !emailErr && !inviteErr ? error : undefined;

  const valid =
    name.trim().length >= 2 &&
    email.trim() &&
    password.length >= 6 &&
    confirm === password &&
    inviteCode.trim().length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim())            return setError('Display name is required.');
    if (name.trim().length < 2)  return setError('Display name must be at least 2 characters.');
    if (name.trim().length > 20) return setError('Display name must be 20 characters or fewer.');
    if (!email.trim())           return setError('Please enter your email address.');
    if (password.length < 6)     return setError('Password must be at least 6 characters.');
    if (password !== confirm)    return setError('Passwords do not match.');
    if (!inviteCode.trim())      return setError('Invite code is required.');

    setLoading(true);
    try {
      await signUp(email.trim(), password, name.trim(), inviteCode.trim());
      setSuccess(true);
      setTimeout(onSuccess, 800);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sign-up failed. Please try again.';
      if (msg.includes('already registered') || msg.includes('already been registered') || msg.includes('User already registered')) {
        setError('An account with this email already exists. Try logging in instead.');
      } else {
        setError(msg);
      }
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Display name — first field */}
      <Field
        id="signup-name"
        label="Display Name"
        type="text"
        value={name}
        onChange={v => { setName(v); setError(null); }}
        placeholder="How your crew sees you"
        autoComplete="nickname"
        icon={<User size={15} />}
        error={nameErr}
      />

      <Field
        id="signup-email"
        label="Email Address"
        type="email"
        value={email}
        onChange={v => { setEmail(v); setError(null); }}
        placeholder="you@example.com"
        autoComplete="email"
        icon={<Mail size={15} />}
        error={emailErr}
      />

      <PasswordField
        id="signup-password"
        label="Password"
        value={password}
        onChange={v => { setPassword(v); setError(null); }}
        placeholder="Minimum 6 characters"
        autoComplete="new-password"
        error={!nameErr && !emailErr && passwordErr && !error?.includes('match') ? passwordErr : undefined}
      />

      <PasswordField
        id="signup-confirm"
        label="Confirm Password"
        value={confirm}
        onChange={v => { setConfirm(v); setError(null); }}
        placeholder="Repeat your password"
        autoComplete="new-password"
        error={error?.includes('match') ? error : undefined}
      />

      <Field
        id="signup-invite"
        label="Invite Code"
        type="text"
        value={inviteCode}
        onChange={v => { setInviteCode(v); setError(null); }}
        placeholder="Ask your group admin"
        autoComplete="off"
        icon={<Key size={15} />}
        error={inviteErr}
      />

      {/* Generic / server error */}
      {error && !nameErr && !emailErr && !inviteErr && !error?.includes('match') && !passwordErr?.includes('characters') && (
        <div style={{
          padding: '10px 14px', borderRadius: '12px',
          background: 'rgba(239,83,80,0.1)', border: '1px solid rgba(239,83,80,0.3)',
          display: 'flex', alignItems: 'flex-start', gap: '8px',
        }}>
          <AlertCircle size={14} style={{ color: 'rgba(239,83,80,0.8)', flexShrink: 0, marginTop: '1px' }} />
          <p style={{ fontSize: '12px', color: 'rgba(239,83,80,0.85)', lineHeight: '1.5' }}>{error}</p>
        </div>
      )}

      {/* Success flash */}
      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{
              padding: '10px 14px', borderRadius: '12px',
              background: 'rgba(102,187,106,0.1)', border: '1px solid rgba(102,187,106,0.3)',
              display: 'flex', alignItems: 'center', gap: '8px',
            }}
          >
            <CheckCircle size={14} style={{ color: '#66BB6A' }} />
            <p style={{ fontSize: '12px', color: '#66BB6A', fontWeight: '600' }}>
              Welcome, {name.trim()}! Entering the cornfield…
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <SubmitButton label="Create Account 🌽" loading={loading} disabled={!valid} />

      <p style={{ color: 'rgba(255,255,255,0.18)', fontSize: '10px', textAlign: 'center', lineHeight: '1.5' }}>
        Private group play only · no real money wagered
      </p>
    </form>
  );
}

// ─── Log In Form ──────────────────────────────────────────────────────────────

function LogInForm({ onSuccess }: { onSuccess: () => void }) {
  const { signIn } = useApp();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const valid = email.trim() && password.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim()) return setError('Please enter your email address.');
    if (!password)     return setError('Please enter your password.');

    setLoading(true);
    try {
      await signIn(email.trim(), password);
      onSuccess();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sign-in failed. Please try again.';
      if (msg.includes('Invalid login') || msg.includes('invalid_credentials') || msg.includes('Invalid email or password')) {
        setError('Incorrect email or password. Please try again.');
      } else if (msg.includes('Email not confirmed')) {
        setError('Please confirm your email address before logging in.');
      } else {
        setError(msg);
      }
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field
        id="login-email"
        label="Email Address"
        type="email"
        value={email}
        onChange={setEmail}
        placeholder="you@example.com"
        autoComplete="email"
        icon={<Mail size={15} />}
      />

      <PasswordField
        id="login-password"
        label="Password"
        value={password}
        onChange={setPassword}
        autoComplete="current-password"
      />

      {error && (
        <div style={{
          padding: '10px 14px', borderRadius: '12px',
          background: 'rgba(239,83,80,0.1)', border: '1px solid rgba(239,83,80,0.3)',
          display: 'flex', alignItems: 'flex-start', gap: '8px',
        }}>
          <AlertCircle size={14} style={{ color: 'rgba(239,83,80,0.8)', flexShrink: 0, marginTop: '1px' }} />
          <p style={{ fontSize: '12px', color: 'rgba(239,83,80,0.85)', lineHeight: '1.5' }}>{error}</p>
        </div>
      )}

      <SubmitButton label="Enter the Cornfield 🌽" loading={loading} disabled={!valid} />
    </form>
  );
}

// ─── Main Login screen ────────────────────────────────────────────────────────

type Tab = 'login' | 'signup';

export function Login() {
  const [tab, setTab] = useState<Tab>('login');

  // After auth succeeds, App.tsx will detect the new user state and
  // swap out the Login screen for the router. We navigate via history push
  // so the router starts at the correct screen.
  const handleLoginSuccess = () => {
    router.navigate('/hub');
  };
  const handleSignupSuccess = () => {
    router.navigate('/welcome');
  };

  return (
    <MobileContainer>
      <div className="flex flex-col h-full">
        {/* ── Branding hero ─────────────────────────────────────────────── */}
        <div className="flex flex-col items-center justify-center flex-shrink-0 pt-12 pb-6">
          <Logo />

          <h1
            className="mt-5 mb-1"
            style={{
              fontSize: '34px',
              fontWeight: '800',
              color: '#FFD54F',
              letterSpacing: '3px',
              textShadow: '0 0 24px rgba(255,213,79,0.3)',
            }}
          >
            CORNBET
          </h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
            <div style={{ width: '28px', height: '1.5px', background: 'linear-gradient(90deg, transparent, rgba(255,179,0,0.5))' }} />
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', letterSpacing: '1.5px', textTransform: 'uppercase' }}>March Madness Pool</span>
            <div style={{ width: '28px', height: '1.5px', background: 'linear-gradient(90deg, rgba(255,179,0,0.5), transparent)' }} />
          </div>
        </div>

        {/* ── Tab switcher ──────────────────────────────────────────────── */}
        <div className="px-6 pb-5">
          <div
            style={{
              display: 'flex',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,213,79,0.1)',
              borderRadius: '16px',
              padding: '4px',
            }}
          >
            {(['login', 'signup'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="flex-1 py-2.5 rounded-xl transition-all duration-200 relative"
                style={{ border: 'none', background: 'none', cursor: 'pointer' }}
              >
                {tab === t && (
                  <motion.div
                    layoutId="tab-indicator"
                    style={{
                      position: 'absolute', inset: 0,
                      borderRadius: '12px',
                      background: 'linear-gradient(135deg, rgba(255,179,0,0.18) 0%, rgba(249,168,37,0.14) 100%)',
                      border: '1px solid rgba(255,179,0,0.3)',
                    }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <span style={{
                  position: 'relative', zIndex: 1,
                  fontSize: '13px',
                  fontWeight: tab === t ? '700' : '500',
                  color: tab === t ? '#FFD54F' : 'rgba(255,255,255,0.4)',
                  letterSpacing: '0.3px',
                }}>
                  {t === 'login' ? 'Log In' : 'Sign Up'}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Form area ─────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 pb-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, x: tab === 'login' ? -18 : 18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: tab === 'login' ? 18 : -18 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              {tab === 'login' ? (
                <>
                  <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', marginBottom: '20px', lineHeight: '1.6' }}>
                    Welcome back. Log in to check your balance, review your bets, and get in on the action.
                  </p>
                  <LogInForm onSuccess={handleLoginSuccess} />
                  <div className="mt-5 text-center">
                    <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)' }}>
                      No account yet?{' '}
                      <button
                        type="button"
                        onClick={() => setTab('signup')}
                        style={{ color: '#FFB300', fontWeight: '700', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px' }}
                      >
                        Sign up free
                      </button>
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', marginBottom: '20px', lineHeight: '1.6' }}>
                    Join the group. You'll start with{' '}
                    <span style={{ color: '#FFD54F', fontWeight: '700' }}>$500</span>
                    {' '}play balance and compete against your friends for the{' '}
                    <span style={{ color: '#FFB300', fontWeight: '700' }}>MaizeBank 🌽</span>
                  </p>
                  <SignUpForm onSuccess={handleSignupSuccess} />
                  <div className="mt-5 text-center">
                    <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)' }}>
                      Already have an account?{' '}
                      <button
                        type="button"
                        onClick={() => setTab('login')}
                        style={{ color: '#FFB300', fontWeight: '700', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px' }}
                      >
                        Log in
                      </button>
                    </p>
                  </div>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </MobileContainer>
  );
}