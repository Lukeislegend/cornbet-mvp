import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router';
import { ChevronLeft, ChevronDown, Trophy, Zap, X } from 'lucide-react';
import { MobileContainer } from './MobileContainer';
import { WalletBar } from './WalletBar';
import { BetSlip } from './BetSlip';
import { publicAnonKey } from '@supabase/info';
import { API_BASE } from '../lib/apiBase';

// ─── Layout constants ─────────────────────────────────────────────────────────
const CARD_H  = 60;   // height of one matchup card (px)
const GAP     = 4;    // gap between R64 cards
const UNIT    = CARD_H + GAP;   // 64px — one vertical slot
const CARD_W  = 148;  // width of one matchup card
const COL_GAP = 10;   // horizontal gap between columns
const PAD_TOP = 14;
const PAD_L   = 14;

// Pre-computed top offsets per round (0-indexed):
// R64 (8 games): every UNIT
// R32 (4 games): midpoint between pairs → (2i+1)*UNIT/2
// S16 (2 games): midpoint of pairs of R32 → (4i+1.5)*UNIT/2 etc.
// Derived as: top(round, i) = ((2^round * i) + (2^round - 1) / 2) * UNIT - (CARD_H/2) + UNIT/2
// Simplified → below array:
const TOPS: number[][] = [
  // R64 (round 0)
  [0,1,2,3,4,5,6,7].map(i => PAD_TOP + i * UNIT),
  // R32 (round 1) — centered between pairs
  [0,1,2,3].map(i => PAD_TOP + (2 * i + 0.5) * UNIT),
  // S16 (round 2)
  [0,1].map(i => PAD_TOP + (4 * i + 1.5) * UNIT),
  // E8 (round 3)
  [PAD_TOP + 3.5 * UNIT],
];

const COL_LEFT = [0, 1, 2, 3].map(c => PAD_L + c * (CARD_W + COL_GAP));

const CONTAINER_H = PAD_TOP * 2 + 8 * UNIT;   // ~540px
const CONTAINER_W = PAD_L * 2 + 4 * (CARD_W + COL_GAP) - COL_GAP;

// ─── Types ────────────────────────────────────────────────────────────────────

interface BTeam {
  name: string;
  seed: number;
  score?: number;
}

interface BMatchup {
  id: string;
  team1?: BTeam;
  team2?: BTeam;
  winner?: 1 | 2;
  gameTime?: string;
  status: 'upcoming' | 'live' | 'final';
  // Attached after API fetch:
  mlOdds?: { t1: string; t2: string };
  spreadLine?: { t1: string; t2: string; pts: number };
}

type RegionName = 'South' | 'East' | 'Midwest' | 'West';

interface BRegion {
  name: RegionName;
  // rounds[0]=R64 (8 games), rounds[1]=R32 (4), rounds[2]=S16 (2), rounds[3]=E8 (1)
  rounds: BMatchup[][];
}

interface FinalFour {
  semi1: BMatchup; // South champ vs Midwest champ
  semi2: BMatchup; // East champ vs West champ
  championship: BMatchup;
}

// ─── 2026 Bracket Data ────────────────────────────────────────────────────────

function makeTeam(name: string, seed: number): BTeam { return { name, seed }; }

const BRACKET_DATA: BRegion[] = [
  {
    name: 'South',
    rounds: [
      // R64 — 8 matchups (seeding: 1v16, 8v9, 5v12, 4v13, 6v11, 3v14, 7v10, 2v15)
      // 1-seed: Florida · Friday Tampa; 2-seed: Houston · Thursday OKC
      [
        { id: 's-r1-0', team1: makeTeam('Florida', 1),        team2: makeTeam('PVA&M/Lehigh', 16),     gameTime: 'Fri Mar 20 · 12:15 PM ET', status: 'upcoming' },
        { id: 's-r1-1', team1: makeTeam('Clemson', 8),        team2: makeTeam('Iowa', 9),               gameTime: 'Fri Mar 20 · 2:45 PM ET',  status: 'upcoming' },
        { id: 's-r1-2', team1: makeTeam('Vanderbilt', 5),     team2: makeTeam('McNeese', 12),           gameTime: 'Thu Mar 19 · 12:15 PM ET', status: 'upcoming' },
        { id: 's-r1-3', team1: makeTeam('Nebraska', 4),       team2: makeTeam('Troy', 13),              gameTime: 'Thu Mar 19 · 2:45 PM ET',  status: 'upcoming' },
        { id: 's-r1-4', team1: makeTeam('North Carolina', 6), team2: makeTeam('VCU', 11),               gameTime: 'Thu Mar 19 · 7:10 PM ET',  status: 'upcoming' },
        { id: 's-r1-5', team1: makeTeam('Illinois', 3),       team2: makeTeam('Penn', 14),              gameTime: 'Thu Mar 19 · 9:40 PM ET',  status: 'upcoming' },
        { id: 's-r1-6', team1: makeTeam("Saint Mary's", 7),   team2: makeTeam('Texas A&M', 10),         gameTime: 'Thu Mar 19 · 7:35 PM ET',  status: 'upcoming' },
        { id: 's-r1-7', team1: makeTeam('Houston', 2),        team2: makeTeam('Idaho', 15),             gameTime: 'Thu Mar 19 · 9:55 PM ET',  status: 'upcoming' },
      ],
      // R32 — TBD
      [
        { id: 's-r2-0', status: 'upcoming', gameTime: 'Sat Mar 21' },
        { id: 's-r2-1', status: 'upcoming', gameTime: 'Sat Mar 21' },
        { id: 's-r2-2', status: 'upcoming', gameTime: 'Sun Mar 22' },
        { id: 's-r2-3', status: 'upcoming', gameTime: 'Sun Mar 22' },
      ],
      // S16 — TBD
      [
        { id: 's-r3-0', status: 'upcoming', gameTime: 'Thu Mar 26' },
        { id: 's-r3-1', status: 'upcoming', gameTime: 'Thu Mar 26' },
      ],
      // E8 — TBD
      [
        { id: 's-r4-0', status: 'upcoming', gameTime: 'Sat Mar 28' },
      ],
    ],
  },
  {
    name: 'East',
    rounds: [
      // 1-seed: Duke · Thursday Greenville; 2-seed: UConn · Friday Philadelphia
      [
        { id: 'e-r1-0', team1: makeTeam('Duke', 1),           team2: makeTeam('Siena', 16),             gameTime: 'Thu Mar 19 · 12:40 PM ET', status: 'upcoming' },
        { id: 'e-r1-1', team1: makeTeam('Ohio State', 8),     team2: makeTeam('TCU', 9),                gameTime: 'Thu Mar 19 · 3:10 PM ET',  status: 'upcoming' },
        { id: 'e-r1-2', team1: makeTeam("St. John's", 5),     team2: makeTeam('Northern Iowa', 12),     gameTime: 'Fri Mar 20 · 12:40 PM ET', status: 'upcoming' },
        { id: 'e-r1-3', team1: makeTeam('Kansas', 4),         team2: makeTeam('Cal Baptist', 13),       gameTime: 'Fri Mar 20 · 3:10 PM ET',  status: 'upcoming' },
        { id: 'e-r1-4', team1: makeTeam('Louisville', 6),     team2: makeTeam('USF', 11),               gameTime: 'Thu Mar 19 · 7:35 PM ET',  status: 'upcoming' },
        { id: 'e-r1-5', team1: makeTeam('Michigan State', 3), team2: makeTeam('North Dakota St', 14),   gameTime: 'Thu Mar 19 · 10:05 PM ET', status: 'upcoming' },
        { id: 'e-r1-6', team1: makeTeam('UCLA', 7),           team2: makeTeam('UCF', 10),               gameTime: 'Fri Mar 20 · 7:35 PM ET',  status: 'upcoming' },
        { id: 'e-r1-7', team1: makeTeam('UConn', 2),          team2: makeTeam('Furman', 15),            gameTime: 'Fri Mar 20 · 10:05 PM ET', status: 'upcoming' },
      ],
      [
        { id: 'e-r2-0', status: 'upcoming', gameTime: 'Sat Mar 21' },
        { id: 'e-r2-1', status: 'upcoming', gameTime: 'Sat Mar 21' },
        { id: 'e-r2-2', status: 'upcoming', gameTime: 'Sun Mar 22' },
        { id: 'e-r2-3', status: 'upcoming', gameTime: 'Sun Mar 22' },
      ],
      [
        { id: 'e-r3-0', status: 'upcoming', gameTime: 'Fri Mar 27' },
        { id: 'e-r3-1', status: 'upcoming', gameTime: 'Fri Mar 27' },
      ],
      [
        { id: 'e-r4-0', status: 'upcoming', gameTime: 'Sun Mar 29' },
      ],
    ],
  },
  {
    name: 'Midwest',
    rounds: [
      // 1-seed: Michigan · Thursday Buffalo; 2-seed: Iowa State · Friday St. Louis
      [
        { id: 'mw-r1-0', team1: makeTeam('Michigan', 1),      team2: makeTeam('UMBC/Howard', 16),       gameTime: 'Thu Mar 19 · 1:00 PM ET',  status: 'upcoming' },
        { id: 'mw-r1-1', team1: makeTeam('Georgia', 8),       team2: makeTeam('Saint Louis', 9),        gameTime: 'Thu Mar 19 · 3:30 PM ET',  status: 'upcoming' },
        { id: 'mw-r1-2', team1: makeTeam('Texas Tech', 5),    team2: makeTeam('Akron', 12),             gameTime: 'Fri Mar 20 · 1:00 PM ET',  status: 'upcoming' },
        { id: 'mw-r1-3', team1: makeTeam('Alabama', 4),       team2: makeTeam('Hofstra', 13),           gameTime: 'Fri Mar 20 · 3:30 PM ET',  status: 'upcoming' },
        { id: 'mw-r1-4', team1: makeTeam('Tennessee', 6),     team2: makeTeam('SMU/Miami OH', 11),      gameTime: 'Fri Mar 20 · 8:00 PM ET',  status: 'upcoming' },
        { id: 'mw-r1-5', team1: makeTeam('Virginia', 3),      team2: makeTeam('Wright State', 14),      gameTime: 'Fri Mar 20 · 10:30 PM ET', status: 'upcoming' },
        { id: 'mw-r1-6', team1: makeTeam('Kentucky', 7),      team2: makeTeam('Santa Clara', 10),       gameTime: 'Fri Mar 20 · 8:00 PM ET',  status: 'upcoming' },
        { id: 'mw-r1-7', team1: makeTeam('Iowa State', 2),    team2: makeTeam('Tennessee State', 15),   gameTime: 'Fri Mar 20 · 10:30 PM ET', status: 'upcoming' },
      ],
      [
        { id: 'mw-r2-0', status: 'upcoming', gameTime: 'Sat Mar 21' },
        { id: 'mw-r2-1', status: 'upcoming', gameTime: 'Sat Mar 21' },
        { id: 'mw-r2-2', status: 'upcoming', gameTime: 'Sun Mar 22' },
        { id: 'mw-r2-3', status: 'upcoming', gameTime: 'Sun Mar 22' },
      ],
      [
        { id: 'mw-r3-0', status: 'upcoming', gameTime: 'Thu Mar 26' },
        { id: 'mw-r3-1', status: 'upcoming', gameTime: 'Thu Mar 26' },
      ],
      [
        { id: 'mw-r4-0', status: 'upcoming', gameTime: 'Sat Mar 28' },
      ],
    ],
  },
  {
    name: 'West',
    rounds: [
      // 1-seed: Arizona · Friday San Diego; 2-seed: Purdue · Friday St. Louis
      [
        { id: 'w-r1-0', team1: makeTeam('Arizona', 1),        team2: makeTeam('LIU', 16),               gameTime: 'Fri Mar 20 · 1:30 PM ET',  status: 'upcoming' },
        { id: 'w-r1-1', team1: makeTeam('Villanova', 8),      team2: makeTeam('Utah State', 9),         gameTime: 'Fri Mar 20 · 4:00 PM ET',  status: 'upcoming' },
        { id: 'w-r1-2', team1: makeTeam('Wisconsin', 5),      team2: makeTeam('High Point', 12),        gameTime: 'Thu Mar 19 · 1:30 PM ET',  status: 'upcoming' },
        { id: 'w-r1-3', team1: makeTeam('Arkansas', 4),       team2: makeTeam('Hawaii', 13),            gameTime: 'Thu Mar 19 · 4:00 PM ET',  status: 'upcoming' },
        { id: 'w-r1-4', team1: makeTeam('BYU', 6),            team2: makeTeam('NC St/Texas', 11),       gameTime: 'Thu Mar 19 · 8:30 PM ET',  status: 'upcoming' },
        { id: 'w-r1-5', team1: makeTeam('Gonzaga', 3),        team2: makeTeam('Kennesaw St', 14),       gameTime: 'Thu Mar 19 · 11:00 PM ET', status: 'upcoming' },
        { id: 'w-r1-6', team1: makeTeam('Miami FL', 7),       team2: makeTeam('Missouri', 10),          gameTime: 'Fri Mar 20 · 8:30 PM ET',  status: 'upcoming' },
        { id: 'w-r1-7', team1: makeTeam('Purdue', 2),         team2: makeTeam('Queens', 15),            gameTime: 'Fri Mar 20 · 11:00 PM ET', status: 'upcoming' },
      ],
      [
        { id: 'w-r2-0', status: 'upcoming', gameTime: 'Sat Mar 21' },
        { id: 'w-r2-1', status: 'upcoming', gameTime: 'Sat Mar 21' },
        { id: 'w-r2-2', status: 'upcoming', gameTime: 'Sun Mar 22' },
        { id: 'w-r2-3', status: 'upcoming', gameTime: 'Sun Mar 22' },
      ],
      [
        { id: 'w-r3-0', status: 'upcoming', gameTime: 'Fri Mar 27' },
        { id: 'w-r3-1', status: 'upcoming', gameTime: 'Fri Mar 27' },
      ],
      [
        { id: 'w-r4-0', status: 'upcoming', gameTime: 'Sun Mar 29' },
      ],
    ],
  },
];

const FINAL_FOUR_DATA: FinalFour = {
  semi1: {
    id: 'ff-1',
    gameTime: 'Sat Apr 4 · 6:09 PM ET',
    status: 'upcoming',
  },
  semi2: {
    id: 'ff-2',
    gameTime: 'Sat Apr 4 · 8:49 PM ET',
    status: 'upcoming',
  },
  championship: {
    id: 'ncg',
    gameTime: 'Mon Apr 6 · 9:20 PM ET',
    status: 'upcoming',
  },
};

// ─── API helpers ──────────────────────────────────────────────────────────────

interface ApiGame {
  id: string;
  home: string;
  away: string;
  time: string;
  lines: { id: string; type: string; team: string; odds: string; label: string; game: string }[];
}

async function fetchApiGames(): Promise<ApiGame[]> {
  try {
    const res = await fetch(
      `${API_BASE}/ncaab-odds`,
      { headers: { Authorization: `Bearer ${publicAnonKey}` } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/** Fuzzy match: do two team name strings share a 3+ char word? */
function teamsMatch(a: string, b: string): boolean {
  const aL = a.toLowerCase().replace(/[^a-z ]/g, '');
  const bL = b.toLowerCase().replace(/[^a-z ]/g, '');
  return aL.split(' ').filter(w => w.length >= 3).some(w => bL.includes(w));
}

/** Try to attach API odds to a bracket matchup */
function attachOdds(matchup: BMatchup, apiGames: ApiGame[]): BMatchup {
  if (!matchup.team1 || !matchup.team2) return matchup;
  const apiGame = apiGames.find(g =>
    (teamsMatch(g.home, matchup.team1!.name) || teamsMatch(g.away, matchup.team1!.name)) &&
    (teamsMatch(g.home, matchup.team2!.name) || teamsMatch(g.away, matchup.team2!.name))
  );
  if (!apiGame) return matchup;

  const t1Name = matchup.team1.name;
  const t2Name = matchup.team2.name;
  const mlLines = apiGame.lines.filter(l => l.type === 'Moneyline');
  const spLines = apiGame.lines.filter(l => l.type === 'Spread');

  const ml1 = mlLines.find(l => teamsMatch(l.team, t1Name))?.odds;
  const ml2 = mlLines.find(l => teamsMatch(l.team, t2Name))?.odds;
  const sp1 = spLines.find(l => teamsMatch(l.team, t1Name));
  const sp2 = spLines.find(l => teamsMatch(l.team, t2Name));

  return {
    ...matchup,
    mlOdds: ml1 && ml2 ? { t1: ml1, t2: ml2 } : undefined,
    spreadLine: sp1 && sp2
      ? { t1: sp1.odds, t2: sp2.odds, pts: parseFloat(sp1.label.split(' ')[1] ?? '0') }
      : undefined,
  };
}

// ─── Connector lines SVG ─────────────────────────────────────────────────────

/** Draws connector lines between round columns */
function ConnectorLines({ round, count }: { round: number; count: number }) {
  if (round >= 3) return null;
  const nextCount = count / 2;
  const lines: JSX.Element[] = [];

  for (let i = 0; i < count; i++) {
    const topA = TOPS[round][i];
    const parentIdx = Math.floor(i / 2);
    const topB = TOPS[round + 1]?.[parentIdx];
    if (topB == null) continue;

    const y1 = topA + CARD_H / 2;
    const y2 = topB + CARD_H / 2;
    const x1 = CARD_W;
    const x2 = CARD_W + COL_GAP;
    const mx = x1 + COL_GAP / 2;

    lines.push(
      <path
        key={`conn-${round}-${i}`}
        d={`M ${x1} ${y1} L ${mx} ${y1} L ${mx} ${y2} L ${x2} ${y2}`}
        fill="none"
        stroke="rgba(255,213,79,0.12)"
        strokeWidth="1.5"
      />
    );
  }

  return (
    <svg
      style={{
        position: 'absolute',
        left: COL_LEFT[round],
        top: 0,
        width: CARD_W + COL_GAP,
        height: CONTAINER_H,
        pointerEvents: 'none',
        overflow: 'visible',
      }}
    >
      {lines}
    </svg>
  );
}

// ─── Team Bet Sheet ───────────────────────────────────────────────────────────

interface BetOption {
  id: string;
  label: string;
  sublabel: string;
  odds: string;
  type: 'matchup' | 'futures';
}

// Ordered futures categories always shown (odds or "Coming Soon")
const FUTURES_CATEGORIES = [
  { market: 'championship',  label: 'Win Championship',      sublabel: 'NCAA Tournament Winner',   icon: '🏆' },
  { market: '__region__',    label: 'Win __Region__ Region', sublabel: '__Region__ Regional Champ', icon: '🗺️' },
  { market: 'final_four',    label: 'Make the Final Four',   sublabel: 'Reach the Final Four',      icon: '🎯' },
  { market: 'elite_eight',   label: 'Make the Elite Eight',  sublabel: 'Reach the Elite Eight',     icon: '⚡' },
  { market: 'sweet_sixteen', label: 'Make the Sweet 16',     sublabel: 'Reach the Sweet 16',        icon: '✨' },
];

interface TeamBetSheetProps {
  isOpen: boolean;
  onClose: () => void;
  team: BTeam;
  options: BetOption[];
  regionMarket: string | null;   // e.g. 'east_region', null for Final Four games
  onSelect: (opt: BetOption) => void;
}

function TeamBetSheet({ isOpen, onClose, team, options, regionMarket, onSelect }: TeamBetSheetProps) {
  const [expandedMarket, setExpandedMarket] = useState<string | null>(null);

  // Reset expanded state when sheet opens/closes
  useEffect(() => { if (!isOpen) setExpandedMarket(null); }, [isOpen]);

  const mlOption = options.find(o => o.type === 'matchup');

  // Build the ordered futures list, substituting __region__ with the real region market
  const regionLabel = regionMarket
    ? regionMarket.replace('_region', '').charAt(0).toUpperCase() + regionMarket.replace('_region', '').slice(1)
    : '';

  const categories = FUTURES_CATEGORIES
    .filter(cat => cat.market !== '__region__' || regionMarket)
    .map(cat => {
      if (cat.market !== '__region__') return cat;
      return {
        market: regionMarket!,
        label: `Win ${regionLabel} Region`,
        sublabel: `${regionLabel} Regional Champion`,
        icon: '🗺️',
      };
    });

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(0,0,0,0.75)' }}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl"
            style={{
              background: '#1A1600',
              maxWidth: '393px',
              margin: '0 auto',
              border: '1px solid rgba(255,213,79,0.2)',
              borderBottom: 'none',
              maxHeight: '88vh',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-4 pb-2 flex-shrink-0">
              <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'rgba(255,213,79,0.2)' }} />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pb-3 flex-shrink-0">
              <div>
                <p style={{ fontSize: '11px', fontWeight: '600', color: 'rgba(255,213,79,0.5)', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '2px' }}>
                  Seed #{team.seed}
                </p>
                <h2 style={{ fontSize: '22px', fontWeight: '800', color: 'white' }}>
                  {team.name}
                </h2>
              </div>
              <button
                onClick={onClose}
                className="flex items-center justify-center rounded-full"
                style={{ width: '32px', height: '32px', background: 'rgba(255,255,255,0.08)', flexShrink: 0 }}
              >
                <X size={15} style={{ color: 'rgba(255,255,255,0.5)' }} />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="overflow-y-auto px-4 pb-8" style={{ flex: 1 }}>

              {/* ── Moneyline section ── */}
              {mlOption && (
                <div className="mb-4">
                  <p style={{ fontSize: '9px', fontWeight: '700', color: 'rgba(255,213,79,0.4)', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '8px' }}>
                    This Matchup
                  </p>
                  <button
                    onClick={() => onSelect(mlOption)}
                    disabled={mlOption.odds === '—'}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-2xl active:scale-[0.98] transition-transform"
                    style={{
                      background: 'rgba(0,0,0,0.35)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      opacity: mlOption.odds === '—' ? 0.45 : 1,
                      cursor: mlOption.odds === '—' ? 'default' : 'pointer',
                    }}
                  >
                    <div className="text-left">
                      <p style={{ fontSize: '14px', fontWeight: '700', color: 'white', marginBottom: '2px' }}>{mlOption.label}</p>
                      <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>{mlOption.sublabel}</p>
                    </div>
                    <span style={{
                      fontSize: '16px', fontWeight: '800', flexShrink: 0, marginLeft: '12px',
                      color: mlOption.odds === '—' ? 'rgba(255,255,255,0.3)' : mlOption.odds.startsWith('+') ? '#66BB6A' : '#FFD54F',
                    }}>
                      {mlOption.odds}
                    </span>
                  </button>
                </div>
              )}

              {/* ── Futures section ── */}
              <div>
                <p style={{ fontSize: '9px', fontWeight: '700', color: 'rgba(255,213,79,0.4)', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '8px' }}>
                  Futures Markets
                </p>

                <div className="space-y-2">
                  {categories.map(({ market, label, sublabel, icon }, i) => {
                    const opt = options.find(o => o.type === 'futures' && o.id === `future-${market}-${team.name}`);
                    const hasOdds = !!opt && opt.odds !== '—';
                    const isExpanded = expandedMarket === market;

                    return (
                      <motion.div
                        key={market}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                      >
                        {/* Category row header */}
                        <button
                          onClick={() => hasOdds && setExpandedMarket(isExpanded ? null : market)}
                          disabled={!hasOdds}
                          className="w-full flex items-center justify-between px-4 py-3 active:scale-[0.98] transition-transform"
                          style={{
                            background: hasOdds
                              ? isExpanded ? 'rgba(255,213,79,0.12)' : 'rgba(255,213,79,0.07)'
                              : 'rgba(255,255,255,0.03)',
                            border: `1px solid ${hasOdds ? 'rgba(255,213,79,0.22)' : 'rgba(255,255,255,0.07)'}`,
                            borderRadius: isExpanded ? '14px 14px 0 0' : '14px',
                            cursor: hasOdds ? 'pointer' : 'default',
                            opacity: hasOdds ? 1 : 0.5,
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <span style={{ fontSize: '18px', lineHeight: 1 }}>{icon}</span>
                            <div className="text-left">
                              <p style={{ fontSize: '14px', fontWeight: '700', color: hasOdds ? 'white' : 'rgba(255,255,255,0.4)', marginBottom: '1px' }}>
                                {label}
                              </p>
                              <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>
                                {sublabel}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                            {hasOdds ? (
                              <>
                                <span style={{
                                  fontSize: '15px', fontWeight: '800',
                                  color: opt!.odds.startsWith('+') ? '#66BB6A' : '#FFD54F',
                                }}>
                                  {opt!.odds}
                                </span>
                                <ChevronDown
                                  size={15}
                                  style={{
                                    color: 'rgba(255,213,79,0.5)',
                                    transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                    transition: 'transform 0.2s ease',
                                  }}
                                />
                              </>
                            ) : (
                              <span style={{
                                fontSize: '10px', fontWeight: '600',
                                color: 'rgba(255,255,255,0.2)',
                                background: 'rgba(255,255,255,0.06)',
                                padding: '3px 8px', borderRadius: '20px',
                              }}>
                                Coming Soon
                              </span>
                            )}
                          </div>
                        </button>

                        {/* Expanded: Place Bet panel */}
                        <AnimatePresence>
                          {isExpanded && opt && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2, ease: 'easeInOut' }}
                              style={{ overflow: 'hidden' }}
                            >
                              <button
                                onClick={() => onSelect(opt)}
                                className="w-full flex items-center justify-between px-4 py-3 active:scale-[0.98] transition-transform"
                                style={{
                                  background: 'rgba(255,213,79,0.12)',
                                  border: '1px solid rgba(255,213,79,0.3)',
                                  borderTop: 'none',
                                  borderRadius: '0 0 14px 14px',
                                }}
                              >
                                <span style={{ fontSize: '13px', fontWeight: '700', color: '#FFD54F' }}>
                                  Place Bet · {team.name}
                                </span>
                                <span style={{
                                  fontSize: '16px', fontWeight: '800',
                                  color: opt.odds.startsWith('+') ? '#66BB6A' : '#FFD54F',
                                }}>
                                  {opt.odds}
                                </span>
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Matchup Card ─────────────────────────────────────────────────────────────

interface CardProps {
  matchup: BMatchup;
  onTeamClick: (team: BTeam, matchup: BMatchup) => void;
}

function MatchupCard({ matchup, onTeamClick }: CardProps) {
  const hasBothTeams = matchup.team1 && matchup.team2;
  const hasOdds = !!matchup.mlOdds;

  const teamRow = (
    team: BTeam | undefined,
    side: 'team1' | 'team2',
    isWinner: boolean | undefined
  ) => {
    const isLoser = matchup.winner !== undefined && !isWinner;
    return (
      <div
        key={side}
        className="flex items-center justify-between px-2 h-[27px] gap-1 cursor-pointer active:opacity-70 transition-opacity"
        onClick={() => team && hasBothTeams && onTeamClick(team, matchup)}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          {team ? (
            <>
              <span
                style={{
                  fontSize: '9px',
                  fontWeight: '700',
                  color: isWinner ? '#FFD54F' : 'rgba(255,213,79,0.35)',
                  minWidth: '14px',
                  textAlign: 'center',
                }}
              >
                {team.seed}
              </span>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: isWinner ? '700' : '500',
                  color: isLoser
                    ? 'rgba(255,255,255,0.3)'
                    : isWinner
                    ? '#FFD54F'
                    : 'rgba(255,255,255,0.88)',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                  maxWidth: '95px',
                }}
              >
                {team.name}
              </span>
              {isWinner && (
                <Trophy size={8} style={{ color: '#FFD54F', flexShrink: 0 }} />
              )}
            </>
          ) : (
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)', fontStyle: 'italic' }}>
              TBD
            </span>
          )}
        </div>
        {/* Odds pill */}
        {team && matchup.mlOdds && (
          <span
            style={{
              fontSize: '9px',
              fontWeight: '700',
              color:
                (side === 'team1' ? matchup.mlOdds.t1 : matchup.mlOdds.t2).startsWith('+')
                  ? '#66BB6A'
                  : '#FFD54F',
              background: 'rgba(0,0,0,0.35)',
              borderRadius: '4px',
              padding: '1px 4px',
              flexShrink: 0,
            }}
          >
            {side === 'team1' ? matchup.mlOdds.t1 : matchup.mlOdds.t2}
          </span>
        )}
        {team && team.score !== undefined && (
          <span style={{ fontSize: '11px', fontWeight: '700', color: isWinner ? '#FFD54F' : 'rgba(255,255,255,0.4)', flexShrink: 0 }}>
            {team.score}
          </span>
        )}
      </div>
    );
  };

  return (
    <div
      style={{
        width: CARD_W,
        height: CARD_H,
        borderRadius: '10px',
        overflow: 'hidden',
        border: `1px solid ${hasOdds ? 'rgba(255,213,79,0.25)' : 'rgba(255,213,79,0.1)'}`,
        background: '#1A1600',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      {/* Live odds indicator */}
      {hasOdds && (
        <div
          style={{
            position: 'absolute',
            top: 2,
            right: 4,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <Zap size={7} style={{ color: '#FFB300' }} />
        </div>
      )}

      {/* Team rows */}
      <div className="flex-1 flex flex-col justify-center">
        {teamRow(matchup.team1, 'team1', matchup.winner === 1)}
        {/* Divider */}
        <div style={{ height: '1px', background: 'rgba(255,213,79,0.07)', marginLeft: 6, marginRight: 6 }} />
        {teamRow(matchup.team2, 'team2', matchup.winner === 2)}
      </div>

      {/* Game time bar */}
      {matchup.gameTime && (
        <div
          style={{
            padding: '2px 6px',
            background: 'rgba(0,0,0,0.3)',
            borderTop: '1px solid rgba(255,213,79,0.06)',
          }}
        >
          <p style={{ fontSize: '8px', color: 'rgba(255,255,255,0.3)', lineHeight: 1.3, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
            {matchup.status === 'final' ? '⚡ Final' : matchup.gameTime}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Regional Bracket ─────────────────────────────────────────────────────────

const ROUND_LABELS = ['Round of 64', 'Round of 32', 'Sweet 16', 'Elite 8'];

interface RegionalProps {
  region: BRegion;
  onTeamClick: (team: BTeam, matchup: BMatchup) => void;
}

function RegionalBracket({ region, onTeamClick }: RegionalProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={scrollRef}
      className="overflow-x-auto"
      style={{ paddingBottom: 16, cursor: 'grab' }}
    >
      <div
        style={{
          position: 'relative',
          width: CONTAINER_W,
          height: CONTAINER_H,
          minWidth: CONTAINER_W,
        }}
      >
        {/* Round label headers */}
        {ROUND_LABELS.map((label, ri) => (
          <div
            key={label}
            style={{
              position: 'absolute',
              top: 0,
              left: COL_LEFT[ri],
              width: CARD_W,
              textAlign: 'center',
            }}
          >
            <span
              style={{
                fontSize: '8px',
                fontWeight: '700',
                letterSpacing: '0.6px',
                textTransform: 'uppercase',
                color: 'rgba(255,213,79,0.4)',
              }}
            >
              {label}
            </span>
          </div>
        ))}

        {/* Connector lines */}
        {[0, 1, 2].map(ri => (
          <ConnectorLines key={ri} round={ri} count={region.rounds[ri]?.length ?? 0} />
        ))}

        {/* Game cards */}
        {region.rounds.map((roundGames, ri) =>
          roundGames.map((matchup, gi) => {
            const top = TOPS[ri]?.[gi];
            if (top == null) return null;
            return (
              <motion.div
                key={matchup.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: gi * 0.03 + ri * 0.06, duration: 0.22 }}
                style={{
                  position: 'absolute',
                  top,
                  left: COL_LEFT[ri],
                }}
              >
                <MatchupCard matchup={matchup} onTeamClick={onTeamClick} />
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── Final Four View ──────────────────────────────────────────────────────────

function FinalFourView({ data, onTeamClick }: { data: FinalFour; onTeamClick: (team: BTeam, matchup: BMatchup) => void }) {
  const SEMI_W = CARD_W;
  const CHAMP_W = CARD_W + 20;
  const ROW_H  = CARD_H;

  return (
    <div className="px-4 py-4">
      <p style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '1px', textTransform: 'uppercase', color: 'rgba(255,213,79,0.5)', marginBottom: '16px' }}>
        Final Four · Indianapolis, IN
      </p>

      {/* Semis */}
      <div className="flex gap-3 mb-6">
        {[{ m: data.semi1, label: 'Semi 1 · S vs MW' }, { m: data.semi2, label: 'Semi 2 · E vs W' }].map(({ m, label }) => (
          <div key={m.id} className="flex-1">
            <p style={{ fontSize: '8px', fontWeight: '700', color: 'rgba(255,213,79,0.4)', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '6px', textAlign: 'center' }}>
              {label}
            </p>
            <MatchupCard matchup={m} onTeamClick={onTeamClick} />
          </div>
        ))}
      </div>

      {/* Championship */}
      <div className="flex flex-col items-center">
        <p style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '1px', textTransform: 'uppercase', color: 'rgba(255,213,79,0.6)', marginBottom: '8px' }}>
          🏆 National Championship · Apr 6
        </p>
        <div style={{ width: CHAMP_W }}>
          <MatchupCard matchup={data.championship} onTeamClick={onTeamClick} />
        </div>
        <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '10px', textAlign: 'center', lineHeight: '1.5' }}>
          Regional champions advance here.{'\n'}Games unlock as bracket progresses.
        </p>
      </div>
    </div>
  );
}

// ─── Main BracketView ─────────────────────────────────────────────────────────

type RegionTab = RegionName | 'Final Four';
const REGION_TABS: RegionTab[] = ['South', 'East', 'Midwest', 'West', 'Final Four'];

export function BracketView() {
  const [activeRegion, setActiveRegion] = useState<RegionTab>('South');
  const [bracket, setBracket]           = useState<BRegion[]>(BRACKET_DATA);
  const [finalFour, setFinalFour]       = useState<FinalFour>(FINAL_FOUR_DATA);
  const [apiLoading, setApiLoading]     = useState(true);
  // Map: teamName → [{odds, market}]
  const [futureOdds, setFutureOdds]     = useState<Map<string, { odds: string; market: string }[]>>(new Map());

  // Team bet sheet state
  const [sheetTeam, setSheetTeam]             = useState<BTeam | null>(null);
  const [sheetOptions, setSheetOptions]       = useState<BetOption[]>([]);
  const [sheetRegionMarket, setSheetRegion]   = useState<string | null>(null);
  const [sheetOpen, setSheetOpen]             = useState(false);

  // Bet slip state (opened from sheet selection)
  const [betSlipOpen, setBetSlipOpen]   = useState(false);
  const [activeBet, setActiveBet]       = useState<{
    type: string; selection: string; odds: string; game: string; team: string; lineId: string;
  } | null>(null);

  // Load API odds + futures
  useEffect(() => {
    (async () => {
      setApiLoading(true);
      const [apiGames, futuresRes] = await Promise.all([
        fetchApiGames(),
        fetch(`${API_BASE}/ncaab-futures`, {
          headers: { 'apikey': publicAnonKey, 'Authorization': `Bearer ${publicAnonKey}` },
        }).then(r => r.ok ? r.json() : { teams: [] }).catch(() => ({ teams: [] })),
      ]);
      if (apiGames.length > 0) {
        setBracket(prev =>
          prev.map(region => ({
            ...region,
            rounds: region.rounds.map(roundGames =>
              roundGames.map(m => attachOdds(m, apiGames))
            ),
          }))
        );
      }
      const map = new Map<string, { odds: string; market: string }[]>();
      for (const t of (futuresRes.teams ?? [])) {
        if (!t.name || !t.odds || !t.market) continue;
        const existing = map.get(t.name) ?? [];
        existing.push({ odds: t.odds, market: t.market });
        map.set(t.name, existing);
      }
      setFutureOdds(map);
      setApiLoading(false);
    })();
  }, []);

  /** Derive tournament round from matchup ID (e.g. 's-r1-0' → 'Round of 64') */
  const getMatchupRound = (id: string): string => {
    if (id === 'ncg')  return 'Championship';
    if (id.startsWith('ff')) return 'Final Four';
    const rMatch = id.match(/r(\d+)-/);
    if (!rMatch) return 'NCAA Tournament';
    switch (rMatch[1]) {
      case '1': return 'Round of 64';
      case '2': return 'Round of 32';
      case '3': return 'Sweet 16';
      case '4': return 'Elite Eight';
      default:  return 'NCAA Tournament';
    }
  };

  // Build and open the team options sheet
  const handleTeamClick = (team: BTeam, matchup: BMatchup) => {
    const options: BetOption[] = [];
    const opponent = matchup.team1?.name === team.name ? matchup.team2 : matchup.team1;
    const round = getMatchupRound(matchup.id);

    // Determine which region market applies to this team
    const regionMarket = matchup.id.startsWith('mw-') ? 'midwest_region'
      : matchup.id.startsWith('e-')  ? 'east_region'
      : matchup.id.startsWith('w-')  ? 'west_region'
      : matchup.id.startsWith('s-')  ? 'south_region'
      : null; // Final Four / championship games have no region

    // Option 1: Win this matchup (moneyline)
    if (opponent && matchup.mlOdds) {
      const side = matchup.team1?.name === team.name ? 'team1' : 'team2';
      const ml = side === 'team1' ? matchup.mlOdds.t1 : matchup.mlOdds.t2;
      options.push({
        id: `ml-${matchup.id}`,
        label: `Beat ${opponent.name}`,
        sublabel: `Moneyline · ${round}`,
        odds: ml,
        type: 'matchup',
      });
    } else if (opponent) {
      options.push({
        id: `ml-${matchup.id}`,
        label: `Beat ${opponent.name}`,
        sublabel: `Moneyline · ${round} · Odds pending`,
        odds: '—',
        type: 'matchup',
      });
    }

    // Options 2+: All available futures for this team (stored by market key)
    const futEntry = [...futureOdds.entries()].find(([k]) => teamsMatch(k, team.name));
    if (futEntry) {
      const [, markets] = futEntry;
      for (const { odds, market } of markets) {
        options.push({
          id: `future-${market}-${team.name}`,
          label: market,
          sublabel: 'Futures',
          odds,
          type: 'futures',
        });
      }
    }

    setSheetTeam(team);
    setSheetOptions(options);
    setSheetRegion(regionMarket);
    setSheetOpen(true);
  };

  // When user picks an option from the sheet
  const handleOptionSelect = (opt: BetOption) => {
    if (!sheetTeam) return;
    if (opt.odds === '—') return;
    setSheetOpen(false);

    // For futures opts, the label is the market key — resolve the human label
    const marketKey = opt.id.startsWith('future-')
      ? opt.id.replace(`future-`, '').replace(`-${sheetTeam.name}`, '')
      : null;
    const futureCat = marketKey
      ? FUTURES_CATEGORIES.find(c => c.market === marketKey || c.market === '__region__' && sheetRegionMarket === marketKey)
      : null;
    const humanLabel = futureCat
      ? futureCat.label
          .replace('__Region__', sheetRegionMarket?.replace('_region','').charAt(0).toUpperCase()! + sheetRegionMarket?.replace('_region','').slice(1)!)
      : opt.label;

    const gameLabel = opt.type === 'futures'
      ? humanLabel
      : opt.label.replace('Beat ', `${sheetTeam.name} vs `);

    setActiveBet({
      type: opt.type === 'futures' ? 'Futures' : 'Moneyline',
      selection: opt.type === 'futures'
        ? `${sheetTeam.name} — ${humanLabel}`
        : `${sheetTeam.name} ML`,
      odds: opt.odds,
      game: gameLabel,
      team: sheetTeam.name,
      lineId: opt.id,
    });
    setBetSlipOpen(true);
  };

  // Back from BetSlip → reopen the team sheet
  const handleBetSlipBack = () => {
    setBetSlipOpen(false);
    setSheetOpen(true);
  };

  const liveCount = bracket.reduce((acc, r) =>
    acc + r.rounds[0].filter(m => m.mlOdds).length, 0
  );

  return (
    <MobileContainer>
      <div className="flex flex-col h-full">
        <WalletBar />

        {/* Header */}
        <div
          className="flex items-center gap-3 px-4 pt-3 pb-2"
          style={{ background: 'rgba(20,16,0,0.7)', borderBottom: '1px solid rgba(255,213,79,0.1)' }}
        >
          <Link to="/hub" className="flex items-center">
            <ChevronLeft size={20} style={{ color: '#FFB300' }} />
          </Link>
          <div className="flex-1">
            <h1 style={{ fontSize: '17px', fontWeight: '800', color: 'white', lineHeight: 1.2 }}>
              Tournament Bracket 🏆
            </h1>
            <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>
              NCAA Men's Basketball · March Madness 2026
            </p>
          </div>
          {liveCount > 0 && (
            <div
              className="flex items-center gap-1 px-2 py-1 rounded-full"
              style={{ background: 'rgba(102,187,106,0.12)', border: '1px solid rgba(102,187,106,0.3)' }}
            >
              <Zap size={9} style={{ color: '#66BB6A' }} />
              <span style={{ fontSize: '9px', fontWeight: '700', color: '#66BB6A' }}>
                {liveCount} Live
              </span>
            </div>
          )}
        </div>

        {/* Region Tab Bar (horizontal scroll) */}
        <div
          className="flex overflow-x-auto"
          style={{
            background: 'rgba(20,16,0,0.5)',
            borderBottom: '1px solid rgba(255,213,79,0.1)',
            scrollbarWidth: 'none',
          }}
        >
          {REGION_TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveRegion(tab)}
              className="flex-shrink-0 px-4 py-2.5 transition-all duration-200"
              style={{
                fontSize: '12px',
                fontWeight: activeRegion === tab ? '700' : '500',
                color: activeRegion === tab ? '#FFD54F' : 'rgba(255,255,255,0.4)',
                borderBottom: activeRegion === tab ? '2px solid #FFB300' : '2px solid transparent',
                whiteSpace: 'nowrap',
              }}
            >
              {tab === 'Final Four' ? '🏆 Final Four' : tab}
            </button>
          ))}
        </div>

        {/* Bracket content */}
        <div className="flex-1 overflow-y-auto" style={{ background: '#111111' }}>
          <AnimatePresence mode="wait">
            {activeRegion !== 'Final Four' ? (
              <motion.div
                key={activeRegion}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.18 }}
                className="px-2 pt-4 pb-6"
              >
                {/* Region label */}
                <div className="flex items-center gap-2 mb-3 px-2">
                  <span style={{ fontSize: '16px', fontWeight: '800', color: '#FFD54F' }}>
                    {activeRegion} Region
                  </span>
                  <div style={{ flex: 1, height: '1px', background: 'rgba(255,213,79,0.1)' }} />
                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>
                    → scroll right
                  </span>
                </div>

                {/* Hint for tapping */}
                <p style={{ fontSize: '10px', color: 'rgba(255,213,79,0.45)', paddingLeft: '8px', marginBottom: '10px' }}>
                  ⚡ Tap a team to see betting options
                </p>

                {(() => {
                  const region = bracket.find(r => r.name === activeRegion);
                  return region
                    ? <RegionalBracket region={region} onTeamClick={handleTeamClick} />
                    : null;
                })()}
              </motion.div>
            ) : (
              <motion.div
                key="final-four"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.18 }}
              >
                <FinalFourView data={finalFour} onTeamClick={handleTeamClick} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Team Bet Options Sheet */}
      {sheetTeam && (
        <TeamBetSheet
          isOpen={sheetOpen}
          onClose={() => setSheetOpen(false)}
          team={sheetTeam}
          options={sheetOptions}
          regionMarket={sheetRegionMarket}
          onSelect={handleOptionSelect}
        />
      )}

      {/* Bet Slip (opened from sheet) */}
      {activeBet && (
        <BetSlip
          isOpen={betSlipOpen}
          onClose={() => setBetSlipOpen(false)}
          onBack={handleBetSlipBack}
          betType={activeBet.type}
          selection={activeBet.selection}
          odds={activeBet.odds}
          game={activeBet.game}
          team={activeBet.team}
          lineId={activeBet.lineId}
        />
      )}
    </MobileContainer>
  );
}
