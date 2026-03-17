import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { MobileContainer } from './MobileContainer';
import { WalletBar } from './WalletBar';
import { BetSlip } from './BetSlip';
import { ParlaySlip } from './ParlaySlip';
import { GlossButton } from './GlossButton';
import { Leaderboard } from './Leaderboard';
import { FuturesBettingTab } from './FuturesBettingTab';
import { useApp } from '../context/AppContext';
import type { BetLeg } from '../context/AppContext';
import { TrendingUp, ListOrdered, Layers, RefreshCw, Wifi, WifiOff, ChevronRight } from 'lucide-react';
import { publicAnonKey } from '@supabase/info';
import { API_BASE } from '../lib/apiBase';

interface BettingLine {
  id: string;
  type: string;
  team: string;
  odds: string;
  label: string;
  game: string;
}

interface GameData {
  id: string;
  home: string;
  away: string;
  time: string;
  lines: BettingLine[];
}

// ─── Fallback hardcoded games (used when API is unavailable) ────────────────
const FALLBACK_GAMES: GameData[] = [
  {
    id: 'g1',
    home: 'Duke',
    away: 'Kansas',
    time: 'Thu 7:00 PM ET · Elite 8',
    lines: [
      { id: 'g1-ml-duke',   type: 'Moneyline', team: 'Duke',   odds: '-130', label: 'Duke -130',          game: 'Kansas vs Duke' },
      { id: 'g1-ml-kansas', type: 'Moneyline', team: 'Kansas', odds: '+110', label: 'Kansas +110',        game: 'Kansas vs Duke' },
      { id: 'g1-sp-duke',   type: 'Spread',    team: 'Duke',   odds: '-110', label: 'Duke -2.5 (-110)',   game: 'Kansas vs Duke' },
      { id: 'g1-sp-kansas', type: 'Spread',    team: 'Kansas', odds: '-110', label: 'Kansas +2.5 (-110)', game: 'Kansas vs Duke' },
    ],
  },
  {
    id: 'g2',
    home: 'UNC',
    away: 'Kentucky',
    time: 'Thu 9:30 PM ET · Elite 8',
    lines: [
      { id: 'g2-ml-unc',  type: 'Moneyline', team: 'UNC',      odds: '+105', label: 'UNC +105',          game: 'Kentucky vs UNC' },
      { id: 'g2-ml-uk',   type: 'Moneyline', team: 'Kentucky', odds: '-125', label: 'Kentucky -125',     game: 'Kentucky vs UNC' },
      { id: 'g2-sp-uk',   type: 'Spread',    team: 'Kentucky', odds: '-110', label: 'Kentucky -3 (-110)',game: 'Kentucky vs UNC' },
      { id: 'g2-sp-unc',  type: 'Spread',    team: 'UNC',      odds: '-110', label: 'UNC +3 (-110)',     game: 'Kentucky vs UNC' },
    ],
  },
];

// ─── Fetch live NCAAB games from server ──────────────────────────────────────
async function fetchNcaabGames(): Promise<GameData[]> {
  const res = await fetch(
    `${API_BASE}/ncaab-odds`,
    { headers: { Authorization: `Bearer ${publicAnonKey}` } }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ncaab-odds ${res.status}: ${text}`);
  }
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error('Unexpected response from ncaab-odds');
  return data as GameData[];
}

type Tab  = 'games' | 'futures' | 'leaderboard';
type Mode = 'single' | 'parlay';

export function SuperBowlHub() {
  const [activeTab,   setActiveTab]   = useState<Tab>('games');
  const [mode,        setMode]        = useState<Mode>('single');
  const [betSlipOpen, setBetSlipOpen] = useState(false);
  const [parlayOpen,  setParlayOpen]  = useState(false);
  const [selectedBet, setSelectedBet] = useState<BettingLine | null>(null);
  const [parlayLegs,  setParlayLegs]  = useState<BetLeg[]>([]);

  // ─── Live games state ─────────────────────────────────────────────────────
  const [games,       setGames]       = useState<GameData[]>([]);
  const [oddsLoading, setOddsLoading] = useState(true);
  const [oddsError,   setOddsError]   = useState<string | null>(null);
  const [isLive,      setIsLive]      = useState(false);

  const { placedBets } = useApp();
  const pendingCount = placedBets.filter(b => b.status === 'pending').length;

  // Fetch live odds on mount (and allow manual refresh)
  const loadOdds = async () => {
    setOddsLoading(true);
    setOddsError(null);
    try {
      const liveGames = await fetchNcaabGames();
      if (liveGames.length > 0) {
        setGames(liveGames);
        setIsLive(true);
      } else {
        // API returned empty (off-season / no upcoming games)
        setGames(FALLBACK_GAMES);
        setIsLive(false);
        setOddsError('No upcoming NCAAB games found. Showing sample matchups.');
      }
    } catch (err) {
      console.error('Failed to load NCAAB odds:', err);
      setGames(FALLBACK_GAMES);
      setIsLive(false);
      setOddsError('Could not load live odds. Showing sample matchups.');
    } finally {
      setOddsLoading(false);
    }
  };

  useEffect(() => { loadOdds(); }, []);

  // ─── Single mode handler ──────────────────────────────────────────────────
  const handleSingleClick = (bet: BettingLine) => {
    setSelectedBet(bet);
    setBetSlipOpen(true);
  };

  // ─── Parlay mode handler ──────────────────────────────────────────────────
  const handleParlayToggle = (bet: BettingLine) => {
    setParlayLegs(prev => {
      const exists = prev.find(l => l.id === bet.id);
      if (exists) return prev.filter(l => l.id !== bet.id);
      return [...prev, {
        id: bet.id,
        type: bet.type,
        selection: bet.label,
        odds: bet.odds,
        game: bet.game,
        team: bet.team,
      }];
    });
  };

  const isParlaySelected = (id: string) => parlayLegs.some(l => l.id === id);

  const handleParlayClose = () => {
    setParlayOpen(false);
    setParlayLegs([]);
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'games',       label: 'Matchups'  },
    { key: 'futures',     label: 'Futures'   },
    { key: 'leaderboard', label: 'Standings' },
  ];

  const renderBetButton = (bet: BettingLine) => {
    const inParlay = isParlaySelected(bet.id);
    return (
      <button
        key={bet.id}
        onClick={() => mode === 'single' ? handleSingleClick(bet) : handleParlayToggle(bet)}
        className="p-3 transition-all active:scale-[0.97] text-left"
        style={{
          background: inParlay && mode === 'parlay' ? 'rgba(255,213,79,0.12)' : '#1A1600',
          borderTop: inParlay && mode === 'parlay' ? '2px solid rgba(255,213,79,0.5)' : '2px solid transparent',
        }}
      >
        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '11px', marginBottom: '3px' }}>
          {bet.type}
        </p>
        <p style={{ color: inParlay && mode === 'parlay' ? '#FFD54F' : 'white', fontSize: '13px', fontWeight: '600', lineHeight: '1.3' }}>
          {bet.label.split(' ')[0]}{' '}
          <span style={{ color: bet.odds.startsWith('+') ? '#66BB6A' : '#FFD54F', fontWeight: '700' }}>
            {bet.label.split(' ').slice(1).join(' ')}
          </span>
        </p>
        {inParlay && mode === 'parlay' && (
          <p style={{ color: 'rgba(255,213,79,0.6)', fontSize: '10px', marginTop: '2px', fontWeight: '600' }}>✓ Added</p>
        )}
      </button>
    );
  };

  return (
    <MobileContainer>
      <div className="flex flex-col h-full">
        <WalletBar />

        {/* Tab Bar */}
        <div className="flex px-4 pt-3 pb-0 gap-1" style={{ background: 'rgba(20,16,0,0.6)' }}>
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="flex-1 py-2 rounded-t-xl transition-all duration-200"
              style={{
                background: activeTab === tab.key ? '#1A1600' : 'transparent',
                border: activeTab === tab.key ? '1px solid rgba(255,213,79,0.2)' : '1px solid transparent',
                borderBottom: 'none',
                color: activeTab === tab.key ? '#FFD54F' : 'rgba(255,255,255,0.4)',
                fontSize: '13px',
                fontWeight: activeTab === tab.key ? '700' : '500',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div
          className="flex-1 overflow-y-auto"
          style={{
            background: '#111111',
            paddingBottom: (activeTab === 'games' && mode === 'parlay' && parlayLegs.length >= 2) || pendingCount > 0 ? '80px' : '0',
          }}
        >
          <AnimatePresence mode="wait">

            {/* ─── Games Tab ──────────────────────────────────────────────── */}
            {activeTab === 'games' && (
              <motion.div
                key="games"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="px-5 py-5"
              >
                {/* Header Row — title + refresh only */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h1 style={{ fontSize: '22px', fontWeight: '800', color: 'white' }}>
                      March Madness 🏀
                    </h1>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '13px' }}>
                        NCAA Men's Basketball · 2026
                      </p>
                      <div
                        className="flex items-center gap-1 px-2 py-0.5 rounded-full"
                        style={{
                          background: isLive ? 'rgba(102,187,106,0.12)' : 'rgba(255,255,255,0.06)',
                          border: `1px solid ${isLive ? 'rgba(102,187,106,0.3)' : 'rgba(255,255,255,0.1)'}`,
                        }}
                      >
                        {isLive ? <Wifi size={9} style={{ color: '#66BB6A' }} /> : <WifiOff size={9} style={{ color: 'rgba(255,255,255,0.3)' }} />}
                        <span style={{ fontSize: '9px', fontWeight: '700', color: isLive ? '#66BB6A' : 'rgba(255,255,255,0.3)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                          {isLive ? 'Live' : 'Sample'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={loadOdds}
                    disabled={oddsLoading}
                    className="flex items-center justify-center rounded-full transition-all active:scale-90"
                    style={{ width: '34px', height: '34px', background: 'rgba(255,179,0,0.08)', border: '1px solid rgba(255,179,0,0.2)' }}
                  >
                    <motion.div
                      animate={oddsLoading ? { rotate: 360 } : { rotate: 0 }}
                      transition={oddsLoading ? { duration: 0.8, repeat: Infinity, ease: 'linear' } : {}}
                    >
                      <RefreshCw size={14} style={{ color: '#FFB300' }} />
                    </motion.div>
                  </button>
                </div>

                {/* Bracket Hero Banner */}
                <Link to="/bracket">
                  <motion.div
                    whileTap={{ scale: 0.98 }}
                    className="flex items-center justify-between mb-4 px-4 py-4 rounded-2xl"
                    style={{
                      background: 'linear-gradient(135deg, rgba(255,179,0,0.18) 0%, rgba(255,213,79,0.08) 100%)',
                      border: '1px solid rgba(255,213,79,0.35)',
                    }}
                  >
                    <div>
                      <p style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '1px', textTransform: 'uppercase', color: 'rgba(255,213,79,0.6)', marginBottom: '2px' }}>
                        NCAA Tournament 2026
                      </p>
                      <p style={{ fontSize: '18px', fontWeight: '800', color: '#FFD54F' }}>
                        🏆 Tournament Bracket
                      </p>
                      <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>
                        Bet on matchups · Buy futures
                      </p>
                    </div>
                    <ChevronRight size={22} style={{ color: '#FFB300', flexShrink: 0 }} />
                  </motion.div>
                </Link>

                {/* Quick links — My Bets + Stats */}
                <div className="grid grid-cols-2 gap-2 mb-5">
                  <Link to="/my-bets">
                    <div
                      className="flex items-center gap-2 px-3 py-3 rounded-xl"
                      style={{ background: 'rgba(255,179,0,0.07)', border: '1px solid rgba(255,179,0,0.18)' }}
                    >
                      <ListOrdered size={15} style={{ color: '#FFB300', flexShrink: 0 }} />
                      <span style={{ color: '#FFB300', fontSize: '13px', fontWeight: '600' }}>
                        My Bets{pendingCount > 0 ? ` (${pendingCount})` : ''}
                      </span>
                    </div>
                  </Link>
                  <Link to="/performance">
                    <div
                      className="flex items-center gap-2 px-3 py-3 rounded-xl"
                      style={{ background: 'rgba(255,179,0,0.07)', border: '1px solid rgba(255,179,0,0.18)' }}
                    >
                      <TrendingUp size={15} style={{ color: '#FFB300', flexShrink: 0 }} />
                      <span style={{ color: '#FFB300', fontSize: '13px', fontWeight: '600' }}>Stats</span>
                    </div>
                  </Link>
                </div>

                {/* Offline / error notice */}
                {oddsError && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 mb-4 px-3 py-2 rounded-xl"
                    style={{ background: 'rgba(255,179,0,0.07)', border: '1px solid rgba(255,213,79,0.15)' }}
                  >
                    <WifiOff size={12} style={{ color: '#FFB300', flexShrink: 0 }} />
                    <p style={{ color: 'rgba(255,213,79,0.7)', fontSize: '11px', lineHeight: '1.4' }}>
                      {oddsError}
                    </p>
                  </motion.div>
                )}

                {/* Mode Toggle: Single / Parlay */}
                <div
                  className="flex mb-5 p-1 rounded-xl"
                  style={{ background: 'rgba(255,213,79,0.06)', border: '1px solid rgba(255,213,79,0.1)' }}
                >
                  {(['single', 'parlay'] as Mode[]).map(m => (
                    <button
                      key={m}
                      onClick={() => { setMode(m); if (m === 'single') setParlayLegs([]); }}
                      className="flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all duration-200"
                      style={{
                        background: mode === m ? '#FFB300' : 'transparent',
                        color: mode === m ? '#111111' : 'rgba(255,255,255,0.45)',
                        fontSize: '13px',
                        fontWeight: '700',
                      }}
                    >
                      {m === 'parlay' && <Layers size={13} />}
                      {m === 'single' ? 'Single Bet' : `Parlay${parlayLegs.length > 0 ? ` (${parlayLegs.length})` : ''}`}
                    </button>
                  ))}
                </div>

                {/* Parlay banner */}
                {mode === 'parlay' && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-4 px-4 py-3 rounded-xl"
                    style={{ background: 'rgba(255,179,0,0.08)', border: '1px solid rgba(255,213,79,0.2)' }}
                  >
                    <p style={{ color: '#FFD54F', fontSize: '12px', fontWeight: '600' }}>
                      🏀 Tap any line to add it to your parlay. Min 2 legs required.
                    </p>
                  </motion.div>
                )}

                {/* Loading skeleton */}
                {oddsLoading ? (
                  <div className="space-y-5">
                    {[0, 1, 2].map(i => (
                      <div key={i} className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,213,79,0.08)' }}>
                        <div className="px-4 py-3" style={{ background: '#1A1600' }}>
                          <div className="flex justify-between items-center">
                            <motion.div
                              animate={{ opacity: [0.3, 0.6, 0.3] }}
                              transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.2 }}
                              className="rounded"
                              style={{ width: '160px', height: '16px', background: 'rgba(255,213,79,0.12)' }}
                            />
                            <motion.div
                              animate={{ opacity: [0.3, 0.6, 0.3] }}
                              transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.2 + 0.3 }}
                              className="rounded"
                              style={{ width: '80px', height: '12px', background: 'rgba(255,213,79,0.08)' }}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-px" style={{ background: 'rgba(255,213,79,0.06)' }}>
                          {[0, 1, 2, 3].map(j => (
                            <motion.div
                              key={j}
                              animate={{ opacity: [0.2, 0.45, 0.2] }}
                              transition={{ duration: 1.4, repeat: Infinity, delay: j * 0.1 + i * 0.15 }}
                              className="p-3"
                              style={{ background: '#1A1600', height: '58px' }}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* ── Games list ─────────────────────────────────────────── */
                  <div className="space-y-5">
                    {games.map((game, gi) => (
                      <motion.div
                        key={game.id}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: gi * 0.07 }}
                      >
                        {/* Game header */}
                        <div
                          className="px-4 py-3 rounded-t-xl"
                          style={{ background: '#1A1600', border: '1px solid rgba(255,213,79,0.12)', borderBottom: 'none' }}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '10px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '3px' }}>
                                Away
                              </p>
                              <p style={{ color: 'white', fontSize: '14px', fontWeight: '700' }}>
                                {game.away}
                              </p>
                            </div>
                            <div className="flex flex-col items-center px-3">
                              <span style={{ color: 'rgba(255,213,79,0.4)', fontSize: '13px', fontWeight: '700' }}>@</span>
                              <span style={{ color: 'rgba(255,213,79,0.4)', fontSize: '9px', marginTop: '2px', letterSpacing: '0.3px' }}>
                                {game.time}
                              </span>
                            </div>
                            <div className="text-right">
                              <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '10px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '3px' }}>
                                Home
                              </p>
                              <p style={{ color: 'white', fontSize: '14px', fontWeight: '700' }}>
                                {game.home}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Betting lines grid */}
                        <div
                          className="rounded-b-xl overflow-hidden"
                          style={{ border: '1px solid rgba(255,213,79,0.12)', borderTop: 'none' }}
                        >
                          <div className="grid grid-cols-2 gap-px" style={{ background: 'rgba(255,213,79,0.06)' }}>
                            {game.lines.map(bet => renderBetButton(bet))}
                          </div>
                        </div>
                      </motion.div>
                    ))}

                    {games.length === 0 && !oddsLoading && (
                      <div className="text-center py-12">
                        <p style={{ fontSize: '36px', marginBottom: '12px' }}>🏀</p>
                        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>
                          No upcoming games found.
                        </p>
                      </div>
                    )}
                  </div>
                )}

              </motion.div>
            )}

            {/* ─── Futures Tab ────────────────────────────────────────────── */}
            {activeTab === 'futures' && (
              <motion.div
                key="futures"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <FuturesBettingTab />
              </motion.div>
            )}

            {/* ─── Leaderboard Tab ────────────────────────────────────────── */}
            {activeTab === 'leaderboard' && (
              <motion.div
                key="leaderboard"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="px-5 py-5"
              >
                <Leaderboard />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Sticky footer CTAs — inside flex column so they pin to bottom */}
        <AnimatePresence>
        {activeTab === 'games' && mode === 'parlay' && parlayLegs.length >= 2 && (
          <motion.div
            key="parlay-cta"
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="flex-shrink-0 px-5 pt-3 pb-5"
            style={{ background: '#111111', borderTop: '1px solid rgba(255,213,79,0.12)' }}
          >
            <motion.div
              animate={{
                boxShadow: [
                  '0 0 20px rgba(255,179,0,0.3)',
                  '0 0 35px rgba(255,179,0,0.55)',
                  '0 0 20px rgba(255,179,0,0.3)',
                ],
              }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <GlossButton onClick={() => setParlayOpen(true)}>
                Build Parlay ({parlayLegs.length} legs) 🏀
              </GlossButton>
            </motion.div>
          </motion.div>
        )}
        {(activeTab !== 'games' || mode !== 'parlay' || parlayLegs.length < 2) && pendingCount > 0 && (
          <motion.div
            key="results-cta"
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="flex-shrink-0 px-5 pt-3 pb-5"
            style={{ background: '#111111', borderTop: '1px solid rgba(255,213,79,0.12)' }}
          >
            <GlossButton to="/results" variant="ghost">
              Check Results ({pendingCount} pending) →
            </GlossButton>
          </motion.div>
        )}
      </AnimatePresence>
      </div>

      {/* Single Bet Slip */}
      {selectedBet && (
        <BetSlip
          isOpen={betSlipOpen}
          onClose={() => setBetSlipOpen(false)}
          betType={selectedBet.type}
          selection={selectedBet.label}
          odds={selectedBet.odds}
          game={selectedBet.game}
          team={selectedBet.team}
          lineId={selectedBet.id}
        />
      )}

      {/* Parlay Slip */}
      <ParlaySlip
        isOpen={parlayOpen}
        onClose={handleParlayClose}
        legs={parlayLegs}
        onRemoveLeg={id => setParlayLegs(prev => prev.filter(l => l.id !== id))}
      />
    </MobileContainer>
  );
}