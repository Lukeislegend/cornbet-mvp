import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { MobileContainer } from './MobileContainer';
import { WalletBar } from './WalletBar';
import { GlossButton } from './GlossButton';
import { useApp } from '../context/AppContext';
import { projectId } from '/utils/supabase/info';

interface GameData {
  id: string;
  home: string;
  away: string;
  time: string;
}

const BASE = `https://${projectId}.supabase.co/functions/v1/make-server-55aa94ce`;

export function AdminResults() {
  const { session, gameResults, refreshGameResults } = useApp();
  const [games, setGames] = useState<GameData[]>([]);
  const [formData, setFormData] = useState<Record<string, { winner: string; total: string; spreadWinners: string }>>({});
  const [champion, setChampion] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Fetch games from odds API
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${BASE}/ncaab-odds`, {
          headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setGames(data);
          } else {
            setGames([
              { id: 'g1', home: 'Duke', away: 'Kansas', time: 'Sample' },
              { id: 'g2', home: 'Kentucky', away: 'UNC', time: 'Sample' },
            ]);
          }
        }
      } catch (e) {
        setGames([
          { id: 'g1', home: 'Duke', away: 'Kansas', time: 'Sample' },
          { id: 'g2', home: 'Kentucky', away: 'UNC', time: 'Sample' },
        ]);
      }
    }
    if (session?.access_token) load();
  }, [session?.access_token]);

  // Fetch current champion
  useEffect(() => {
    async function load() {
      if (!session?.access_token) return;
      try {
        const res = await fetch(`${BASE}/futures/champion`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const d = await res.json();
          setChampion(d.champion ?? '');
        }
      } catch {
        // ignore
      }
    }
    load();
  }, [session?.access_token]);

  const gameKey = (g: GameData) => `${g.away} vs ${g.home}`;

  const handleGameChange = (key: string, field: 'winner' | 'total' | 'spreadWinners', value: string) => {
    const existing = gameResults[key];
    const base = formData[key] ?? {
      winner: existing?.winner ?? '',
      total: existing?.total?.toString() ?? '',
      spreadWinners: (existing?.spreadWinners ?? []).join(', '),
    };
    setFormData(prev => ({
      ...prev,
      [key]: { ...base, ...(prev[key] ?? {}), [field]: value },
    }));
  };

  const handleSaveResults = async () => {
    if (!session?.access_token) return;
    setSaving(true);
    setSaved(false);
    try {
      const updates: Record<string, { winner: string; total: number; spreadWinners: string[] }> = {};
      for (const [key, data] of Object.entries(formData)) {
        if (data?.winner?.trim() && data?.total?.trim()) {
          const total = parseFloat(data.total);
          if (!isNaN(total)) {
            const spreadWinners = (data.spreadWinners ?? '')
              .split(/[,;]/)
              .map(s => s.trim())
              .filter(Boolean);
            updates[key] = { winner: data.winner.trim(), total, spreadWinners };
          }
        }
      }
      if (Object.keys(updates).length > 0) {
        const res = await fetch(`${BASE}/game-results`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(updates),
        });
        if (res.ok) {
          await refreshGameResults();
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSaveChampion = async () => {
    if (!session?.access_token || !champion.trim()) return;
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(`${BASE}/futures/champion`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ champion: champion.trim() }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <MobileContainer>
      <div className="flex flex-col h-full">
        <WalletBar />

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <h1 style={{ fontSize: '22px', fontWeight: '800', color: 'white', marginBottom: '4px' }}>
            Admin · Game Results
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '13px', marginBottom: '20px' }}>
            Enter final scores and champion to resolve bets.
          </p>

          {/* Game results form */}
          <div className="space-y-4 mb-8">
            {games.map(g => {
              const key = gameKey(g);
              const existing = gameResults[key];
              const data = formData[key] ?? {
                winner: existing?.winner ?? '',
                total: existing?.total?.toString() ?? '',
                spreadWinners: (existing?.spreadWinners ?? []).join(', '),
              };
              return (
                <div
                  key={g.id}
                  className="p-4 rounded-xl"
                  style={{ background: '#1A1600', border: '1px solid rgba(255,213,79,0.15)' }}
                >
                  <p style={{ color: '#FFD54F', fontSize: '14px', fontWeight: '700', marginBottom: '12px' }}>
                    {key}
                  </p>
                  <div className="space-y-3">
                    <div>
                      <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px', display: 'block', marginBottom: '4px' }}>Winner</label>
                      <input
                        value={data.winner}
                        onChange={e => handleGameChange(key, 'winner', e.target.value)}
                        placeholder="e.g. Duke"
                        className="w-full px-3 py-2 rounded-lg"
                        style={{ background: '#0A0900', border: '1px solid rgba(255,213,79,0.2)', color: 'white' }}
                      />
                    </div>
                    <div>
                      <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px', display: 'block', marginBottom: '4px' }}>Total points</label>
                      <input
                        type="number"
                        value={data.total}
                        onChange={e => handleGameChange(key, 'total', e.target.value)}
                        placeholder="e.g. 149"
                        className="w-full px-3 py-2 rounded-lg"
                        style={{ background: '#0A0900', border: '1px solid rgba(255,213,79,0.2)', color: 'white' }}
                      />
                    </div>
                    <div>
                      <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px', display: 'block', marginBottom: '4px' }}>Spread winners (comma-separated)</label>
                      <input
                        value={data.spreadWinners}
                        onChange={e => handleGameChange(key, 'spreadWinners', e.target.value)}
                        placeholder="e.g. Duke"
                        className="w-full px-3 py-2 rounded-lg"
                        style={{ background: '#0A0900', border: '1px solid rgba(255,213,79,0.2)', color: 'white' }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={handleSaveResults}
            disabled={saving}
            className="w-full py-3 px-6 rounded-xl font-bold transition-all"
            style={{
              background: saved ? 'rgba(102,187,106,0.3)' : 'rgba(255,179,0,0.15)',
              border: `1px solid ${saved ? 'rgba(102,187,106,0.5)' : 'rgba(255,213,79,0.3)'}`,
              color: saved ? '#66BB6A' : '#FFD54F',
            }}
          >
            {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save game results'}
          </button>

          {/* Champion section */}
          <div className="mt-8 p-4 rounded-xl" style={{ background: '#1A1600', border: '1px solid rgba(255,213,79,0.15)' }}>
            <p style={{ color: '#FFD54F', fontSize: '14px', fontWeight: '700', marginBottom: '12px' }}>
              Tournament champion (for futures)
            </p>
            <input
              value={champion}
              onChange={e => setChampion(e.target.value)}
              placeholder="e.g. UConn"
              className="w-full px-3 py-2 rounded-lg mb-3"
              style={{ background: '#0A0900', border: '1px solid rgba(255,213,79,0.2)', color: 'white' }}
            />
            <button
              onClick={handleSaveChampion}
              disabled={saving || !champion.trim()}
              className="w-full py-2 rounded-lg font-bold"
              style={{
                background: 'rgba(255,179,0,0.15)',
                border: '1px solid rgba(255,213,79,0.3)',
                color: '#FFD54F',
              }}
            >
              Set champion
            </button>
          </div>

          <div className="mt-8">
            <GlossButton to="/hub">Back to betting</GlossButton>
          </div>
        </div>
      </div>
    </MobileContainer>
  );
}
