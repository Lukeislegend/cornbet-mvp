import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router';
import { Trash2, RefreshCw } from 'lucide-react';
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

interface AdminBet {
  _kvKey: string;
  _dbType: string;
  _userName: string;
  userId: string;
  type: string;
  status: string;
  stake: number;
  selection?: string;
  team?: string;
  odds?: string;
  combinedOdds?: string;
  placedAt?: number;
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

  // Admin bets management
  const [adminBets,     setAdminBets]     = useState<AdminBet[]>([]);
  const [betsLoading,   setBetsLoading]   = useState(false);
  const [deletingKey,   setDeletingKey]   = useState<string | null>(null);
  const [deleteMsg,     setDeleteMsg]     = useState<string | null>(null);
  const [betsExpanded,  setBetsExpanded]  = useState(false);

  // Admin players management
  interface AdminPlayer { userId: string; displayName: string; joinedAt: number; balance: number; }
  const [adminPlayers,      setAdminPlayers]      = useState<AdminPlayer[]>([]);
  const [playersLoading,    setPlayersLoading]    = useState(false);
  const [deletingPlayer,    setDeletingPlayer]    = useState<string | null>(null);
  const [playerMsg,         setPlayerMsg]         = useState<string | null>(null);
  const [playersExpanded,   setPlayersExpanded]   = useState(false);

  // Invite code management
  const [inviteExpanded,    setInviteExpanded]    = useState(false);
  const [currentCode,       setCurrentCode]       = useState<string | null>(null);
  const [codeInput,         setCodeInput]         = useState('');
  const [codeLoading,       setCodeLoading]       = useState(false);
  const [codeMsg,           setCodeMsg]           = useState<string | null>(null);

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

  // ── load all bets ──────────────────────────────────────────────────────────

  const loadAdminBets = useCallback(async () => {
    if (!session?.access_token) return;
    setBetsLoading(true);
    try {
      const res = await fetch(`${BASE}/admin/bets`, {
        headers: authHeaders(session.access_token),
      });
      if (res.ok) {
        const data = await res.json();
        setAdminBets(Array.isArray(data.bets) ? data.bets : []);
      }
    } finally {
      setBetsLoading(false);
    }
  }, [session?.access_token]);

  // ── delete a bet ───────────────────────────────────────────────────────────

  const handleDeleteBet = async (kvKey: string, betStatus: string) => {
    if (!session?.access_token) return;
    setDeletingKey(kvKey);
    setDeleteMsg(null);
    try {
      const res = await fetch(`${BASE}/admin/bets`, {
        method: 'DELETE',
        headers: authHeaders(session.access_token),
        body: JSON.stringify({ kvKey }),
      });
      const data = await res.json();
      if (res.ok) {
        setAdminBets(prev => prev.filter(b => b._kvKey !== kvKey));
        const refund = data.refundedAmount > 0 ? ` · $${data.refundedAmount} refunded` : '';
        setDeleteMsg(`✓ Bet deleted${refund}`);
        setTimeout(() => setDeleteMsg(null), 3000);
      } else {
        setDeleteMsg(data.error ?? 'Delete failed');
      }
    } finally {
      setDeletingKey(null);
    }
  };

  // ── load all players ───────────────────────────────────────────────────────

  const loadAdminPlayers = useCallback(async () => {
    if (!session?.access_token) return;
    setPlayersLoading(true);
    try {
      const res = await fetch(`${BASE}/admin/players`, {
        headers: authHeaders(session.access_token),
      });
      if (res.ok) {
        const data = await res.json();
        setAdminPlayers(Array.isArray(data.players) ? data.players : []);
      }
    } finally {
      setPlayersLoading(false);
    }
  }, [session?.access_token]);

  // ── remove a player from registry ─────────────────────────────────────────

  const handleDeletePlayer = async (userId: string, displayName: string) => {
    if (!session?.access_token) return;
    setDeletingPlayer(userId);
    setPlayerMsg(null);
    try {
      const res = await fetch(`${BASE}/admin/registry`, {
        method: 'DELETE',
        headers: authHeaders(session.access_token),
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (res.ok) {
        setAdminPlayers(prev => prev.filter(p => p.userId !== userId));
        setPlayerMsg(`✓ ${data.removedName ?? displayName} removed from leaderboard`);
        setTimeout(() => setPlayerMsg(null), 3000);
      } else {
        setPlayerMsg(data.error ?? 'Remove failed');
      }
    } finally {
      setDeletingPlayer(null);
    }
  };

  // ── load + save invite code ────────────────────────────────────────────────

  const loadInviteCode = useCallback(async () => {
    if (!session?.access_token) return;
    setCodeLoading(true);
    try {
      const res = await fetch(`${BASE}/admin/invite-code`, {
        headers: authHeaders(session.access_token),
      });
      const data = await res.json();
      if (res.ok) {
        setCurrentCode(data.code ?? null);
        setCodeInput(data.code ?? '');
      }
    } finally {
      setCodeLoading(false);
    }
  }, [session?.access_token]);

  const handleSaveCode = async () => {
    if (!session?.access_token) return;
    setCodeLoading(true);
    setCodeMsg(null);
    try {
      const res = await fetch(`${BASE}/admin/invite-code`, {
        method: 'POST',
        headers: authHeaders(session.access_token),
        body: JSON.stringify({ code: codeInput.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setCurrentCode(data.code ?? null);
        setCodeMsg(data.code ? `✓ Code set to "${data.code}"` : '✓ Invite code disabled — anyone can sign up');
        setTimeout(() => setCodeMsg(null), 3500);
      } else {
        setCodeMsg(data.error ?? 'Save failed');
      }
    } finally {
      setCodeLoading(false);
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

          {/* ── Manage bets ──────────────────────────────────────────── */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{ border: '1px solid rgba(255,255,255,0.08)' }}
          >
            {/* Collapsible header */}
            <button
              onClick={() => {
                const opening = !betsExpanded;
                setBetsExpanded(opening);
                if (opening && adminBets.length === 0) loadAdminBets();
              }}
              className="w-full flex items-center justify-between px-4 py-3"
              style={{ background: 'rgba(255,255,255,0.04)' }}
            >
              <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', fontWeight: '700' }}>
                🗑️ Manage bets
              </span>
              <div className="flex items-center gap-2">
                {adminBets.length > 0 && (
                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', fontWeight: '600' }}>
                    {adminBets.length} bets
                  </span>
                )}
                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '16px', lineHeight: 1 }}>
                  {betsExpanded ? '▲' : '▼'}
                </span>
              </div>
            </button>

            <AnimatePresence>
              {betsExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  style={{ overflow: 'hidden' }}
                >
                  <div className="px-4 pb-4 pt-2">
                    {/* Refresh + status */}
                    <div className="flex items-center justify-between mb-3">
                      <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px' }}>
                        Delete a bet — refunds stake if still pending
                      </p>
                      <button
                        onClick={loadAdminBets}
                        disabled={betsLoading}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg"
                        style={{ background: 'rgba(255,179,0,0.08)', border: '1px solid rgba(255,213,79,0.15)' }}
                      >
                        <motion.div
                          animate={betsLoading ? { rotate: 360 } : { rotate: 0 }}
                          transition={betsLoading ? { duration: 0.8, repeat: Infinity, ease: 'linear' } : {}}
                        >
                          <RefreshCw size={11} style={{ color: '#FFB300' }} />
                        </motion.div>
                        <span style={{ fontSize: '10px', color: '#FFB300', fontWeight: '600' }}>Refresh</span>
                      </button>
                    </div>

                    <AnimatePresence>
                      {deleteMsg && (
                        <motion.p
                          initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                          className="mb-3 text-center text-xs"
                          style={{ color: deleteMsg.startsWith('✓') ? '#66BB6A' : '#EF9A9A' }}
                        >
                          {deleteMsg}
                        </motion.p>
                      )}
                    </AnimatePresence>

                    {betsLoading && adminBets.length === 0 ? (
                      <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', textAlign: 'center', paddingTop: '8px' }}>
                        Loading bets…
                      </p>
                    ) : adminBets.length === 0 ? (
                      <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', textAlign: 'center', paddingTop: '8px' }}>
                        No bets found
                      </p>
                    ) : (
                      <div className="space-y-2" style={{ maxHeight: '320px', overflowY: 'auto' }}>
                        {adminBets.map(bet => (
                          <div
                            key={bet._kvKey}
                            className="flex items-start justify-between gap-2 px-3 py-2 rounded-xl"
                            style={{
                              background: bet.status === 'pending'
                                ? 'rgba(255,213,79,0.05)'
                                : 'rgba(255,255,255,0.03)',
                              border: `1px solid ${bet.status === 'pending' ? 'rgba(255,213,79,0.12)' : 'rgba(255,255,255,0.06)'}`,
                            }}
                          >
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <span style={{
                                  fontSize: '9px', fontWeight: '700', letterSpacing: '0.4px',
                                  color: bet.status === 'pending' ? '#FFD54F'
                                       : bet.status === 'won' ? '#66BB6A' : 'rgba(255,255,255,0.3)',
                                  textTransform: 'uppercase',
                                }}>
                                  {bet.status}
                                </span>
                                <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.25)' }}>·</span>
                                <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontWeight: '600' }}>
                                  {bet._userName}
                                </span>
                                <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.25)' }}>·</span>
                                <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.35)' }}>
                                  {bet.type} · ${bet.stake}
                                </span>
                              </div>
                              <p style={{
                                fontSize: '11px', color: 'rgba(255,255,255,0.65)', fontWeight: '600',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              }}>
                                {bet.selection ?? bet.team ?? '—'}
                              </p>
                              <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>
                                {bet.odds ?? bet.combinedOdds ?? ''}
                                {bet.placedAt ? ` · ${new Date(bet.placedAt).toLocaleDateString()}` : ''}
                              </p>
                            </div>
                            <button
                              onClick={() => handleDeleteBet(bet._kvKey, bet.status)}
                              disabled={deletingKey === bet._kvKey}
                              className="flex-shrink-0 flex items-center justify-center rounded-lg transition-all active:scale-90"
                              style={{
                                width: '30px', height: '30px',
                                background: 'rgba(239,154,154,0.08)',
                                border: '1px solid rgba(239,154,154,0.2)',
                              }}
                            >
                              {deletingKey === bet._kvKey
                                ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}>
                                    <RefreshCw size={12} style={{ color: '#EF9A9A' }} />
                                  </motion.div>
                                : <Trash2 size={12} style={{ color: '#EF9A9A' }} />
                              }
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Manage players ───────────────────────────────────────── */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{ border: '1px solid rgba(255,255,255,0.08)' }}
          >
            {/* Collapsible header */}
            <button
              onClick={() => {
                const opening = !playersExpanded;
                setPlayersExpanded(opening);
                if (opening && adminPlayers.length === 0) loadAdminPlayers();
              }}
              className="w-full flex items-center justify-between px-4 py-3"
              style={{ background: 'rgba(255,255,255,0.04)' }}
            >
              <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', fontWeight: '700' }}>
                👥 Manage players
              </span>
              <div className="flex items-center gap-2">
                {adminPlayers.length > 0 && (
                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', fontWeight: '600' }}>
                    {adminPlayers.length} players
                  </span>
                )}
                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '16px', lineHeight: 1 }}>
                  {playersExpanded ? '▲' : '▼'}
                </span>
              </div>
            </button>

            <AnimatePresence>
              {playersExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  style={{ overflow: 'hidden' }}
                >
                  <div className="px-4 pb-4 pt-2">
                    {/* Refresh + description */}
                    <div className="flex items-center justify-between mb-3">
                      <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px' }}>
                        Remove a player from the leaderboard
                      </p>
                      <button
                        onClick={loadAdminPlayers}
                        disabled={playersLoading}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg"
                        style={{ background: 'rgba(255,179,0,0.08)', border: '1px solid rgba(255,213,79,0.15)' }}
                      >
                        <motion.div
                          animate={playersLoading ? { rotate: 360 } : { rotate: 0 }}
                          transition={playersLoading ? { duration: 0.8, repeat: Infinity, ease: 'linear' } : {}}
                        >
                          <RefreshCw size={11} style={{ color: '#FFB300' }} />
                        </motion.div>
                        <span style={{ fontSize: '10px', color: '#FFB300', fontWeight: '600' }}>Refresh</span>
                      </button>
                    </div>

                    <AnimatePresence>
                      {playerMsg && (
                        <motion.p
                          initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                          className="mb-3 text-center text-xs"
                          style={{ color: playerMsg.startsWith('✓') ? '#66BB6A' : '#EF9A9A' }}
                        >
                          {playerMsg}
                        </motion.p>
                      )}
                    </AnimatePresence>

                    {playersLoading && adminPlayers.length === 0 ? (
                      <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', textAlign: 'center', paddingTop: '8px' }}>
                        Loading players…
                      </p>
                    ) : adminPlayers.length === 0 ? (
                      <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', textAlign: 'center', paddingTop: '8px' }}>
                        No players found
                      </p>
                    ) : (
                      <div className="space-y-2" style={{ maxHeight: '320px', overflowY: 'auto' }}>
                        {adminPlayers.map(player => (
                          <div
                            key={player.userId}
                            className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl"
                            style={{
                              background: 'rgba(255,255,255,0.03)',
                              border: '1px solid rgba(255,255,255,0.06)',
                            }}
                          >
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{
                                fontSize: '13px', color: 'rgba(255,255,255,0.8)', fontWeight: '700',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              }}>
                                {player.displayName}
                              </p>
                              <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)' }}>
                                ${player.balance.toFixed(0)} balance
                                {player.joinedAt ? ` · joined ${new Date(player.joinedAt).toLocaleDateString()}` : ''}
                              </p>
                            </div>
                            <button
                              onClick={() => handleDeletePlayer(player.userId, player.displayName)}
                              disabled={deletingPlayer === player.userId}
                              className="flex-shrink-0 flex items-center justify-center rounded-lg transition-all active:scale-90"
                              style={{
                                width: '30px', height: '30px',
                                background: 'rgba(239,154,154,0.08)',
                                border: '1px solid rgba(239,154,154,0.2)',
                              }}
                            >
                              {deletingPlayer === player.userId
                                ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}>
                                    <RefreshCw size={12} style={{ color: '#EF9A9A' }} />
                                  </motion.div>
                                : <Trash2 size={12} style={{ color: '#EF9A9A' }} />
                              }
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── 🔑 Invite code ──────────────────────────────────────── */}
          <div style={{ border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', overflow: 'hidden' }}>
            {/* Collapsible header */}
            <button
              onClick={() => {
                const opening = !inviteExpanded;
                setInviteExpanded(opening);
                if (opening && currentCode === null) loadInviteCode();
              }}
              className="w-full flex items-center justify-between px-4 py-3"
              style={{ background: 'rgba(255,255,255,0.04)' }}
            >
              <div className="flex items-center gap-2">
                <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.75)', fontWeight: '700' }}>🔑 Invite code</span>
                {currentCode && (
                  <span style={{ fontSize: '10px', background: 'rgba(102,187,106,0.15)', color: '#66BB6A', border: '1px solid rgba(102,187,106,0.3)', borderRadius: '6px', padding: '1px 7px', fontWeight: '700' }}>
                    ON
                  </span>
                )}
              </div>
              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '16px', lineHeight: 1 }}>
                {inviteExpanded ? '▲' : '▼'}
              </span>
            </button>

            <AnimatePresence>
              {inviteExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  style={{ overflow: 'hidden' }}
                >
                  <div className="px-4 py-4 space-y-3">
                    <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', lineHeight: '1.5' }}>
                      Set a code that new members must enter to create an account. Leave blank to allow open signups.
                    </p>

                    {/* Status pill */}
                    <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
                      Current:{' '}
                      {codeLoading
                        ? <span style={{ color: 'rgba(255,255,255,0.3)' }}>loading…</span>
                        : currentCode
                          ? <span style={{ color: '#FFD54F', fontWeight: '700', fontFamily: 'monospace' }}>{currentCode}</span>
                          : <span style={{ color: 'rgba(255,255,255,0.3)' }}>disabled (open signup)</span>
                      }
                    </div>

                    {/* Input + save */}
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        value={codeInput}
                        onChange={e => setCodeInput(e.target.value)}
                        placeholder="e.g. CORNFAM2025"
                        style={{
                          flex: 1,
                          padding: '9px 12px',
                          borderRadius: '10px',
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.12)',
                          color: 'white',
                          fontSize: '13px',
                          fontFamily: 'monospace',
                          outline: 'none',
                        }}
                      />
                      <button
                        onClick={handleSaveCode}
                        disabled={codeLoading}
                        style={{
                          padding: '9px 14px',
                          borderRadius: '10px',
                          background: 'rgba(255,179,0,0.15)',
                          border: '1px solid rgba(255,213,79,0.3)',
                          color: '#FFD54F',
                          fontSize: '12px',
                          fontWeight: '700',
                          cursor: codeLoading ? 'not-allowed' : 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {codeLoading ? '…' : 'Save'}
                      </button>
                    </div>

                    <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', lineHeight: '1.4' }}>
                      Tip: clear the field and save to disable the code requirement.
                    </p>

                    {/* Feedback message */}
                    {codeMsg && (
                      <p style={{
                        fontSize: '12px',
                        color: codeMsg.startsWith('✓') ? '#66BB6A' : 'rgba(239,83,80,0.85)',
                        fontWeight: '600',
                      }}>
                        {codeMsg}
                      </p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

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
