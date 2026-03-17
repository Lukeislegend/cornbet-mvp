import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LogOut, User } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useApp } from '../context/AppContext';

export function WalletBar() {
  const { playWallet, groupBank, user, displayName, signOut } = useApp();
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const navigate = useNavigate();

  const handleSignOutPress = () => {
    if (confirmingSignOut) {
      signOut();
    } else {
      setConfirmingSignOut(true);
      // Auto-cancel after 3 seconds
      setTimeout(() => setConfirmingSignOut(false), 3000);
    }
  };

  // Prefer stored displayName; fall back to email prefix for legacy accounts
  const nameLabel = displayName
    ?? (user?.email ? user.email.split('@')[0] : null);

  return (
    <div
      style={{
        background: 'rgba(20, 16, 0, 0.95)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid rgba(255, 213, 79, 0.1)',
      }}
    >
      {/* ── Main balance row ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-3">
        {/* Play Balance — tappable → /wallet */}
        <button
          onClick={() => navigate('/wallet')}
          className="flex flex-col text-left active:scale-95 transition-transform"
          style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
        >
          <span
            style={{
              fontSize: '9px',
              color: 'rgba(255, 213, 79, 0.55)',
              fontWeight: '700',
              letterSpacing: '0.9px',
              textTransform: 'uppercase',
            }}
          >
            Play Balance ›
          </span>
          <motion.span
            key={playWallet}
            initial={{ opacity: 0.5, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            style={{
              fontSize: '19px',
              color: '#FFD54F',
              fontWeight: '700',
              textShadow: '0 0 10px rgba(255, 213, 79, 0.3)',
              lineHeight: 1.2,
            }}
          >
            ${playWallet.toFixed(2)}
          </motion.span>
        </button>

        {/* Center: group tag */}
        <div
          className="px-3 py-1 rounded-full"
          style={{
            background: 'rgba(255, 179, 0, 0.07)',
            border: '1px solid rgba(255, 179, 0, 0.15)',
          }}
        >
          <span style={{ color: 'rgba(255, 179, 0, 0.5)', fontSize: '9px', fontWeight: '700', letterSpacing: '0.6px' }}>
            DraftHaus
          </span>
        </div>

        {/* Corn Bank — tappable → /corn-bank */}
        <button
          onClick={() => navigate('/corn-bank')}
          className="flex flex-col items-end active:scale-95 transition-transform"
          style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
        >
          <span
            style={{
              fontSize: '9px',
              color: 'rgba(249, 168, 37, 0.55)',
              fontWeight: '700',
              letterSpacing: '0.9px',
              textTransform: 'uppercase',
            }}
          >
            Corn Bank 🌽 ‹
          </span>
          <motion.span
            key={groupBank}
            initial={{ opacity: 0.5, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            style={{
              fontSize: '19px',
              color: '#F9A825',
              fontWeight: '700',
              textShadow: '0 0 10px rgba(249, 168, 37, 0.3)',
              lineHeight: 1.2,
            }}
          >
            ${groupBank.toFixed(2)}
          </motion.span>
        </button>
      </div>

      {/* ── User row ─────────────────────────────────────────────────── */}
      {user && (
        <div
          className="flex items-center justify-between px-5 pb-2"
          style={{ borderTop: '1px solid rgba(255,213,79,0.06)' }}
        >
          {/* User identity */}
          <div className="flex items-center gap-1.5">
            <div
              style={{
                width: '18px', height: '18px', borderRadius: '50%',
                background: 'rgba(255,179,0,0.15)',
                border: '1px solid rgba(255,179,0,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <User size={10} style={{ color: 'rgba(255,179,0,0.6)' }} />
            </div>
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontWeight: '500' }}>
              {nameLabel ?? user.email}
            </span>
          </div>

          {/* Sign out */}
          <AnimatePresence mode="wait">
            <motion.button
              key={confirmingSignOut ? 'confirm' : 'idle'}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.15 }}
              onClick={handleSignOutPress}
              className="flex items-center gap-1 px-2 py-0.5 rounded-lg transition-all active:scale-95"
              style={{
                background: confirmingSignOut ? 'rgba(239,83,80,0.15)' : 'transparent',
                border: `1px solid ${confirmingSignOut ? 'rgba(239,83,80,0.4)' : 'rgba(255,255,255,0.08)'}`,
                cursor: 'pointer',
              }}
            >
              <LogOut size={9} style={{ color: confirmingSignOut ? 'rgba(239,83,80,0.8)' : 'rgba(255,255,255,0.3)' }} />
              <span style={{
                fontSize: '9px',
                fontWeight: '600',
                color: confirmingSignOut ? 'rgba(239,83,80,0.85)' : 'rgba(255,255,255,0.3)',
              }}>
                {confirmingSignOut ? 'Tap again to confirm' : 'Sign out'}
              </span>
            </motion.button>
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}