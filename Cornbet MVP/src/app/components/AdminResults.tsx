import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router';
import { MobileContainer } from './MobileContainer';
import { WalletBar } from './WalletBar';
import { useApp } from '../context/AppContext';
import { API_BASE } from '../lib/apiBase';

const BASE = API_BASE;

// ─── helpers ─────────────────────────────────────────────────────────────────

function authHeaders(token: string) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

// ─── types ────────────────────────────────────────────────────────────────────

interface StoredResult {
  winner: string;
  total: number;
  spreadWinners: string[];
}

interface FreeformEntry {
  gameKey: string;
  winner: string;
  total: string;
  spreadWinners: string;
}

const EMPTY_ENTRY: FreeformEntry = { gameKey: '', winner: '', total: '', spreadWinners: '' };

// ─── component ────────────────────────────────────────────────────────────────

export function AdminResults() {
  const { session, gameResults, refreshGameResults, resolveGameResults, placedBets } = useApp();
  const navigate = useNavigate();

  // Freeform entries — start with one blank row
  const [entries, setEntries] = useState<FreeformEntry[]>([{ ...EMPTY_ENTRY }]);

  // Champion
  const [champion, setChampion] = useState('');
  const [championSaved, setChampionSaved] = useState(false);

  // Action states
  const [saving,    setSaving]    = useState(false);
  const [resolving, setResolving] = useState(false);
  const [saveMsg,   setSaveMsg]   = useState<string | null>(null);
  const [resolveMsg, setResolveMsg] = useState<string | null>(null);

  // Load existing champion on mount
  useEffect(() => {
    if (!session?.access_token) return;
    fetch(`${BASE}/futures/champion`, { headers: { Authorization: `Bearer ${session.access_token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.champion) setChampion(d.champion); })
      .catch(() => {});
  }, [session?.access_token]);

  const pendingCount = placedBets.filter(b => b.status === 'pending').length;
  const storedGames  = Object.entries(gameResults as Record<string, StoredResult>);

  // ── entry helpers ──────────────────────────────────────────────────────────

  const updateEntry = (i: number, field: keyof FreeformEntry, val: string) => {
    setEntries(prev => prev.map((e, idx) => idx === i ? { ...e, [field]: val } : e));
  };

  const addRow = () => setEntries(prev => [...prev, { ...EMPTY_ENTRY }]);

  const removeRow = (i: number) => setEntries(prev => prev.filter((_, idx) => idx !== i));

  // ── save results ───────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!session?.access_token) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const updates: Record<string, { winner: string; total: number; spreadWinners: string[] }> = {};

      for (const e of entries) {
        const key = e.gameKey.trim();
        if (!key || !e.winner.trim() || !e.total.trim()) continue;
        const total = parseFloat(e.total);
        if (isNaN(total)) continue;
        updates[key] = {
          winner: e.winner.trim(),
          total,
          spreadWinners: e.spreadWinners.split(/[,;]/).map(s => s.trim()).filter(Boolean),
        };
      }

      if (Object.keys(updates).length === 0) {
        setSaveMsg('Fill in at least one complete game row first.');
        return;
      }

      const res = await fetch(`${BASE}/game-results`, {
        method: 'PUT',
        headers: authHeaders(session.access_token),
        body: JSON.stringify(updates),
      });

      if (res.ok) {
        await refreshGameResults();
        setSaveMsg(`✓ Saved ${Object.keys(updates).length} game result${Object.keys(updates).length > 1 ? 's' : ''}`);
        // Clear saved rows
        setEntries([{ ...EMPTY_ENTRY }]);
      } else {
        setSaveMsg('Save failed — try again');
      }
    } finally {
      setSaving(false);
    }
  };

  // ── resolve all users ──────────────────────────────────────────────────────

  const handleResolveAll = async () => {
    if (!session?.access_token) return;
    setResolving(true);
    setResolveMsg(null);
    try {
      const res = await fetch(`${BASE}/bets/resolve-all`, {
        method: 'POST',
        headers: authHeaders(session.access_token),
      });
      const data = await res.json();
      if (res.ok) {
        setResolveMsg(
          data.resolved > 0
            ? `✓ Resolved ${data.resolved} bet${data.resolved > 1 ? 's' : ''} across ${data.users} player${data.users > 1 ? 's' : ''}`
            : 'No pending bets matched stored results'
        );
        // Refresh local state
        await refreshGameResults();
        await resolveGameResults();
      } else {
        setResolveMsg(data.error ?? 'Resolve failed');
      }
    } catch (err) {
      setResolveMsg('Network error — try again');
    } finally {
      setResolving(false);
    }
  };

  // ── save champion ──────────────────────────────────────────────────────────

  const handleSaveChampion = async () => {
    if (!session?.access_token || !champion.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`${BASE}/futures/champion`, {
        method: 'PUT',
        headers: authHeaders(session.access_token),
        body: JSON.stringify({ champion: champion.trim() }),
      });
      if (res.ok) {
        setChampionSaved(true);
        setTimeout(() => setChampionSaved(false), 2500);
      }
    } finally {
      setSaving(false);
    }
  };

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <MobileContainer>
      <div className="flex flex-col h-full">
        <WalletBar />

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">

          {/* Header */}
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: '800', color: 'white', marginBottom: '2px' }}>
              Admin · Results
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>
              Enter game results and resolve all bets in one tap.
            </p>
          </div>

          {/* Pending bets badge */}
          {pendingCount > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl"
              style={{ background: 'rgba(255,179,0,0.1)', border: '1px solid rgba(255,213,79,0.25)' }}
            >
              <span style={{ fontSize: '16px' }}>⏳</span>
              <span style={{ color: '#FFD54F', fontSize: '13px', fontWeight: '600' }}>
                {pendingCount} pending bet{pendingCount > 1 ? 's' : ''} waiting to resolve
              </span>
            </motion.div>
          )}

          {/* ── Enter game results ───────────────────────────────────────── */}
          <div>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', fontWeight: '700',
              letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '12px' }}>
              Enter game results
            </p>

            <div className="space-y-3">
              {entries.map((entry, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 rounded-2xl relative"
                  style={{ background: '#1A1600', border: '1px solid rgba(255,213,79,0.15)' }}
                >
                  {entries.length > 1 && (
                    <button
                      onClick={() => removeRow(i)}
                      className="absolute top-3 right-3"
                      style={{ color: 'rgba(255,255,255,0.3)', fontSize: '16px', lineHeight: 1 }}
                    >
                      ×
                    </button>
                  )}

                  {/* Game key */}
                  <div className="mb-3">
                    <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', display: 'block', marginBottom: '4px' }}>
                      Game key <span style={{ color: 'rgba(255,255,255,0.3)' }}>(Away vs Home — exact match)</span>
                    </label>
                    <input
                      value={entry.gameKey}
                      onChange={e => updateEntry(i, 'gameKey', e.target.value)}
                      placeholder="e.g. Duke Blue Devils vs Kansas Jayhawks"
                      className="w-full px-3 py-2 rounded-lg text-sm"
                      style={{ background: '#0A0900', border: '1px solid rgba(255,213,79,0.2)', color: 'white' }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {/* Winner */}
                    <div>
                      <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', display: 'block', marginBottom: '4px' }}>
                        Winner
                      </label>
                      <input
                        value={entry.winner}
                        onChange={e => updateEntry(i, 'winner', e.target.value)}
                        placeholder="e.g. Duke Blue Devils"
                        className="w-full px-3 py-2 rounded-lg text-sm"
                        style={{ background: '#0A0900', border: '1px solid rgba(255,213,79,0.2)', color: 'white' }}
                      />
                    </div>
                    {/* Total */}
                    <div>
                      <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', display: 'block', marginBottom: '4px' }}>
                        Total points
                      </label>
                      <input
                        type="number"
                        value={entry.total}
                        onChange={e => updateEntry(i, 'total', e.target.value)}
                        placeholder="e.g. 149"
                        className="w-full px-3 py-2 rounded-lg text-sm"
                        style={{ background: '#0A0900', border: '1px solid rgba(255,213,79,0.2)', color: 'white' }}
                      />
                    </div>
                  </div>

                  {/* Spread winners */}
                  <div>
                    <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', display: 'block', marginBottom: '4px' }}>
                      Spread winner(s) <span style={{ color: 'rgba(255,255,255,0.3)' }}>(comma-separated, if applicable)</span>
                    </label>
                    <input
                      value={entry.spreadWinners}
                      onChange={e => updateEntry(i, 'spreadWinners', e.target.value)}
                      placeholder="e.g. Duke Blue Devils"
                      className="w-full px-3 py-2 rounded-lg text-sm"
                      style={{ background: '#0A0900', border: '1px solid rgba(255,213,79,0.2)', color: 'white' }}
                    />
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Add row */}
            <button
              onClick={addRow}
              className="mt-2 px-4 py-2 rounded-xl text-sm font-semibold w-full"
              style={{ background: 'rgba(255,213,79,0.06)', border: '1px dashed rgba(255,213,79,0.2)', color: 'rgba(255,213,79,0.6)' }}
            >
              + Add another game
            </button>

            {/* Save button */}
            <button
              onClick={handleSave}
              disabled={saving}
              className="mt-3 w-full py-3 rounded-xl font-bold text-sm transition-all active:scale-95"
              style={{ background: 'rgba(255,179,0,0.15)', border: '1px solid rgba(255,213,79,0.3)', color: '#FFD54F' }}
            >
              {saving ? 'Saving…' : 'Save results'}
            </button>

            <AnimatePresence>
              {saveMsg && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="mt-2 text-center text-sm"
                  style={{ color: saveMsg.startsWith('✓') ? '#66BB6A' : '#EF9A9A' }}
                >
                  {saveMsg}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          {/* ── Resolve all bets ─────────────────────────────────────────── */}
          <div
            className="p-4 rounded-2xl"
            style={{ background: 'rgba(255,179,0,0.06)', border: '1px solid rgba(255,213,79,0.2)' }}
          >
            <p style={{ color: '#FFD54F', fontSize: '14px', fontWeight: '700', marginBottom: '4px' }}>
              Resolve all pending bets
            </p>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', marginBottom: '14px' }}>
              Uses stored results to settle bets for every player. Save results first.
            </p>
            <button
              onClick={handleResolveAll}
              disabled={resolving}
              className="w-full py-3 rounded-xl font-bold text-sm transition-all active:scale-95"
              style={{
                background: resolving ? 'rgba(255,179,0,0.08)' : 'rgba(255,179,0,0.2)',
                border: '1px solid rgba(255,213,79,0.4)',
                color: '#FFD54F',
              }}
            >
              {resolving ? 'Resolving…' : '⚡ Resolve all players\' bets'}
            </button>

            <AnimatePresence>
              {resolveMsg && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="mt-2 text-center text-sm"
                  style={{ color: resolveMsg.startsWith('✓') ? '#66BB6A' : 'rgba(255,255,255,0.5)' }}
                >
                  {resolveMsg}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          {/* ── Tournament champion ──────────────────────────────────────── */}
          <div
            className="p-4 rounded-2xl"
            style={{ background: '#1A1600', border: '1px solid rgba(255,213,79,0.15)' }}
          >
            <p style={{ color: '#FFD54F', fontSize: '14px', fontWeight: '700', marginBottom: '4px' }}>
              Tournament champion
            </p>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', marginBottom: '12px' }}>
              Set once the NCAA champion is crowned. Resolves futures bets.
            </p>
            <input
              value={champion}
              onChange={e => setChampion(e.target.value)}
              placeholder="e.g. UConn Huskies"
              className="w-full px-3 py-2 rounded-lg mb-3 text-sm"
              style={{ background: '#0A0900', border: '1px solid rgba(255,213,79,0.2)', color: 'white' }}
            />
            <button
              onClick={handleSaveChampion}
              disabled={saving || !champion.trim()}
              className="w-full py-2 rounded-xl font-bold text-sm transition-all active:scale-95"
              style={{
                background: championSaved ? 'rgba(102,187,106,0.2)' : 'rgba(255,179,0,0.15)',
                border: `1px solid ${championSaved ? 'rgba(102,187,106,0.4)' : 'rgba(255,213,79,0.3)'}`,
                color: championSaved ? '#66BB6A' : '#FFD54F',
              }}
            >
              {championSaved ? '✓ Champion saved' : 'Set champion'}
            </button>
          </div>

          {/* ── Stored results (read-only preview) ──────────────────────── */}
          {storedGames.length > 0 && (
            <div>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', fontWeight: '700',
                letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '10px' }}>
                Stored results ({storedGames.length})
              </p>
              <div className="space-y-2">
                {storedGames.map(([key, result]) => (
                  <div
                    key={key}
                    className="px-3 py-3 rounded-xl"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', fontWeight: '600', marginBottom: '2px' }}>{key}</p>
                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>
                      Winner: {result.winner} · Total: {result.total}
                      {result.spreadWinners.length > 0 && ` · Spread: ${result.spreadWinners.join(', ')}`}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Back */}
          <button
            onClick={() => navigate('/hub')}
            className="w-full py-3 rounded-xl font-bold text-sm"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}
          >
            ← Back to betting
          </button>

        </div>
      </div>
    </MobileContainer>
  );
}
