import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../context/AppContext';
import { MaizeBankCard } from './MaizeBankCard';
import { API_BASE } from '../lib/apiBase';

interface LeaderboardPlayer {
  userId:        string;
  displayName:   string;
  balance:       number;
  joinedAt:      number;
  isCurrentUser: boolean;
}

const BASE = API_BASE;

// Rank emoji helpers
const rankMedal = (i: number) =>
  i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;

export function Leaderboard() {
  const { playWallet, session } = useApp();
  const [players,     setPlayers]     = useState<LeaderboardPlayer[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [fetchErr,    setFetchErr]    = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameInput,   setNameInput]   = useState('');
  const [nameSaving,  setNameSaving]  = useState(false);
  const [nameError,   setNameError]   = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!session?.access_token) return;

    let cancelled = false;

    async function fetchLeaderboard() {
      setLoading(true);
      setFetchErr(null);
      try {
        const res = await fetch(`${BASE}/leaderboard`, {
          headers: {
            'Content-Type':  'application/json',
            Authorization:   `Bearer ${session!.access_token}`,
          },
        });
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(`Leaderboard fetch failed (${res.status}): ${txt}`);
        }
        const data: LeaderboardPlayer[] = await res.json();
        if (!cancelled) setPlayers(data);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('Leaderboard fetch error:', msg);
        if (!cancelled) setFetchErr(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchLeaderboard();
    return () => { cancelled = true; };
  }, [session?.access_token]);

  const handleStartEdit = (currentName: string) => {
    setNameInput(currentName === 'name' ? '' : currentName);
    setNameError(null);
    setEditingName(true);
    setTimeout(() => inputRef.current?.focus(), 80);
  };

  const handleSaveName = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed || trimmed.length < 2) { setNameError('At least 2 characters'); return; }
    if (trimmed.length > 20)            { setNameError('Max 20 characters');       return; }
    setNameSaving(true);
    setNameError(null);
    try {
      const res = await fetch(`${BASE}/player-profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session!.access_token}` },
        body: JSON.stringify({ displayName: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to save');
      setPlayers(prev => prev.map(p => p.isCurrentUser ? { ...p, displayName: data.displayName } : p));
      setEditingName(false);
    } catch (err) {
      setNameError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setNameSaving(false);
    }
  };

  // Optimistically update the current user's balance from local wallet state
  const displayedPlayers = players.map(p =>
    p.isCurrentUser ? { ...p, balance: playWallet } : p
  ).sort((a, b) => b.balance - a.balance);

  const maxBalance = displayedPlayers.length > 0
    ? Math.max(...displayedPlayers.map(p => p.balance), 500)
    : 500;

  return (
    <div>
      <h1
        className="mb-1"
        style={{ fontSize: '22px', fontWeight: '800', color: 'white' }}
      >
        Standings 🏆
      </h1>
      <p className="mb-5" style={{ color: 'rgba(255, 255, 255, 0.45)', fontSize: '13px' }}>
        Group: DraftHaus · March Madness 2026
      </p>

      {/* MaizeBank Growth Card */}
      <div className="mb-6">
        <MaizeBankCard />
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-10 gap-3">
          <motion.span
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            style={{ display: 'inline-block', fontSize: '28px' }}
          >
            🌽
          </motion.span>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '13px' }}>
            Fetching standings…
          </p>
        </div>
      )}

      {/* Error state */}
      {!loading && fetchErr && (
        <div
          className="p-4 rounded-xl mb-4"
          style={{ background: 'rgba(239,83,80,0.08)', border: '1px solid rgba(239,83,80,0.25)' }}
        >
          <p style={{ color: 'rgba(239,83,80,0.85)', fontSize: '12px', lineHeight: '1.5' }}>
            Could not load standings. {fetchErr}
          </p>
        </div>
      )}

      {/* Empty state */}
      {!loading && !fetchErr && displayedPlayers.length === 0 && (
        <div className="text-center py-10">
          <p style={{ fontSize: '28px', marginBottom: '8px' }}>🌽</p>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>
            No players registered yet.
          </p>
        </div>
      )}

      {/* Player list */}
      {!loading && displayedPlayers.length > 0 && (
        <div className="space-y-2">
          {displayedPlayers.map((player, index) => {
            const barWidth  = (player.balance / maxBalance) * 100;
            const medal     = rankMedal(index);
            const isUp      = player.balance >= 500;

            return (
              <motion.div
                key={player.userId}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.07 }}
                className="p-4 rounded-xl"
                style={{
                  background: player.isCurrentUser ? 'rgba(255, 213, 79, 0.08)' : '#1A1600',
                  border: player.isCurrentUser
                    ? '1px solid rgba(255, 213, 79, 0.3)'
                    : '1px solid rgba(255, 213, 79, 0.08)',
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span style={{ fontSize: '16px', minWidth: '24px', flexShrink: 0 }}>{medal}</span>

                    {player.isCurrentUser && editingName ? (
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          ref={inputRef}
                          value={nameInput}
                          onChange={e => { setNameInput(e.target.value); setNameError(null); }}
                          onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false); }}
                          maxLength={20}
                          placeholder="Your name…"
                          className="flex-1 px-2 py-1 rounded-lg"
                          style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,213,79,0.4)', color: 'white', fontSize: '13px', outline: 'none', minWidth: 0 }}
                        />
                        <button
                          onClick={handleSaveName}
                          disabled={nameSaving}
                          style={{ color: '#66BB6A', fontSize: '11px', fontWeight: '700', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}
                        >
                          {nameSaving ? '…' : 'Save'}
                        </button>
                        <button
                          onClick={() => setEditingName(false)}
                          style={{ color: 'rgba(255,255,255,0.35)', fontSize: '16px', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, lineHeight: 1 }}
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <>
                        <span
                          style={{ color: player.isCurrentUser ? '#FFD54F' : 'white', fontSize: '15px', fontWeight: player.isCurrentUser ? '700' : '600' }}
                        >
                          {player.displayName}
                        </span>
                        {player.isCurrentUser && (
                          <>
                            <span className="px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,213,79,0.15)', color: '#FFD54F', fontSize: '10px', fontWeight: '700', flexShrink: 0 }}>
                              YOU
                            </span>
                            <button
                              onClick={() => handleStartEdit(player.displayName)}
                              style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}
                            >
                              ✏️
                            </button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                  <div className="text-right">
                    <span
                      style={{
                        color:      isUp ? '#66BB6A' : '#EF5350',
                        fontSize:   '16px',
                        fontWeight: '700',
                      }}
                    >
                      ${player.balance.toFixed(0)}
                    </span>
                    <p style={{ color: 'rgba(255, 255, 255, 0.35)', fontSize: '10px' }}>
                      {isUp
                        ? `+$${(player.balance - 500).toFixed(0)}`
                        : `-$${(500 - player.balance).toFixed(0)}`}
                    </p>
                  </div>
                </div>

                {/* Name error */}
                <AnimatePresence>
                  {player.isCurrentUser && nameError && (
                    <motion.p
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      style={{ color: 'rgba(239,83,80,0.8)', fontSize: '11px', marginBottom: '6px' }}
                    >
                      {nameError}
                    </motion.p>
                  )}
                </AnimatePresence>

                {/* Balance bar */}
                <div
                  className="rounded-full"
                  style={{ background: 'rgba(255, 255, 255, 0.06)', height: '4px' }}
                >
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${barWidth}%` }}
                    transition={{ duration: 0.6, delay: index * 0.07 + 0.2 }}
                    className="rounded-full"
                    style={{
                      height: '4px',
                      background: player.isCurrentUser
                        ? 'linear-gradient(90deg, #FFB300, #FFD54F)'
                        : isUp
                          ? 'rgba(102, 187, 106, 0.6)'
                          : 'rgba(239, 83, 80, 0.5)',
                    }}
                  />
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Bank note */}
      <p
        className="text-center mt-6"
        style={{ fontSize: '12px', fontStyle: 'italic', lineHeight: '1.6', color: 'rgba(255,255,255,0.45)' }}
      >
        Your losses grow the{' '}
        <span style={{ color: '#FFB300', fontWeight: '700', fontStyle: 'normal' }}>MaizeBank</span>
        {' '}— final amount funds{' '}
        <span style={{ color: '#FFB300', fontWeight: '700', fontStyle: 'normal' }}>DraftHaus 2026</span>.
      </p>
    </div>
  );
}
