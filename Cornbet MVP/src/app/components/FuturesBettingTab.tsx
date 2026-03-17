import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCw, Trophy, Wifi, WifiOff } from 'lucide-react';
import { publicAnonKey } from '@supabase/info';
import { API_BASE } from '../lib/apiBase';
import { BetSlip } from './BetSlip';
import { GlossButton } from './GlossButton';
import { useApp } from '../context/AppContext';

// ─── Types ────────────────────────────────────────────────────────────────────

type Tier = 'top' | 'strong' | 'mid' | 'longshot';

interface FutureTeam {
  id: string;
  name: string;
  abbr: string;
  odds: string;
  tier: Tier;
  isLive: boolean;
}

// ─── Tier config ──────────────────────────────────────────────────────────────

const TIER_CONFIG: Record<Tier, { label: string; emoji: string; color: string; dim: string; bg: string; border: string }> = {
  top:      { label: 'Top Contenders', emoji: '🏆', color: '#FFD54F', dim: 'rgba(255,213,79,0.6)',  bg: 'rgba(255,213,79,0.07)',  border: 'rgba(255,213,79,0.22)' },
  strong:   { label: 'Strong Teams',   emoji: '🔥', color: '#FFB300', dim: 'rgba(255,179,0,0.55)',  bg: 'rgba(255,179,0,0.07)',   border: 'rgba(255,179,0,0.2)'   },
  mid:      { label: 'Mid Tier',       emoji: '📈', color: '#FF8F00', dim: 'rgba(255,143,0,0.5)',   bg: 'rgba(255,143,0,0.06)',   border: 'rgba(255,143,0,0.18)'  },
  longshot: { label: 'Longshots',      emoji: '🎲', color: 'rgba(255,255,255,0.55)', dim: 'rgba(255,255,255,0.35)', bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.1)' },
};

function getTier(oddsStr: string): Tier {
  const n = parseInt(oddsStr.replace('+', ''));
  if (n < 2000)  return 'top';
  if (n < 5000)  return 'strong';
  if (n < 12000) return 'mid';
  return 'longshot';
}

// ─── Full NCAA tournament fallback field ──────────────────────────────────────
// 68-team style field; abbrs used for card display

const FALLBACK_TEAMS: Omit<FutureTeam, 'tier' | 'isLive'>[] = [
  // Top contenders (+800 – +2000)
  { id: 'fb-duke',    name: 'Duke Blue Devils',         abbr: 'DUKE' , odds: '+800'   },
  { id: 'fb-aub',     name: 'Auburn Tigers',             abbr: 'AUB'  , odds: '+1000'  },
  { id: 'fb-hou',     name: 'Houston Cougars',           abbr: 'HOU'  , odds: '+1100'  },
  { id: 'fb-ten',     name: 'Tennessee Volunteers',      abbr: 'TENN' , odds: '+1200'  },
  { id: 'fb-fla',     name: 'Florida Gators',            abbr: 'FLA'  , odds: '+1400'  },
  { id: 'fb-uk',      name: 'Kentucky Wildcats',         abbr: 'UK'   , odds: '+1600'  },
  { id: 'fb-ku',      name: 'Kansas Jayhawks',           abbr: 'KU'   , odds: '+1800'  },
  { id: 'fb-ariz',    name: 'Arizona Wildcats',          abbr: 'ARIZ' , odds: '+2000'  },

  // Strong teams (+2000 – +5000)
  { id: 'fb-msu',     name: 'Michigan State Spartans',  abbr: 'MSU'  , odds: '+2200'  },
  { id: 'fb-marq',    name: 'Marquette Golden Eagles',  abbr: 'MARQ' , odds: '+2500'  },
  { id: 'fb-wis',     name: 'Wisconsin Badgers',        abbr: 'WIS'  , odds: '+3000'  },
  { id: 'fb-crei',    name: 'Creighton Bluejays',       abbr: 'CREI' , odds: '+3000'  },
  { id: 'fb-stj',     name: "St. John's Red Storm",     abbr: 'STJ'  , odds: '+3500'  },
  { id: 'fb-ttu',     name: 'Texas Tech Red Raiders',   abbr: 'TTU'  , odds: '+3500'  },
  { id: 'fb-unc',     name: 'UNC Tar Heels',            abbr: 'UNC'  , odds: '+4000'  },
  { id: 'fb-mem',     name: 'Memphis Tigers',           abbr: 'MEM'  , odds: '+4500'  },
  { id: 'fb-ala',     name: 'Alabama Crimson Tide',     abbr: 'ALA'  , odds: '+5000'  },

  // Mid tier (+5000 – +12000)
  { id: 'fb-pur',     name: 'Purdue Boilermakers',      abbr: 'PUR'  , odds: '+5500'  },
  { id: 'fb-ucla',    name: 'UCLA Bruins',              abbr: 'UCLA' , odds: '+6000'  },
  { id: 'fb-ill',     name: 'Illinois Fighting Illini', abbr: 'ILL'  , odds: '+6500'  },
  { id: 'fb-ark',     name: 'Arkansas Razorbacks',      abbr: 'ARK'  , odds: '+7000'  },
  { id: 'fb-gonz',    name: 'Gonzaga Bulldogs',         abbr: 'GONZ' , odds: '+7500'  },
  { id: 'fb-ore',     name: 'Oregon Ducks',             abbr: 'ORE'  , odds: '+8000'  },
  { id: 'fb-byu',     name: 'BYU Cougars',              abbr: 'BYU'  , odds: '+8500'  },
  { id: 'fb-lou',     name: 'Louisville Cardinals',     abbr: 'LOU'  , odds: '+9000'  },
  { id: 'fb-cin',     name: 'Cincinnati Bearcats',      abbr: 'CIN'  , odds: '+10000' },
  { id: 'fb-vill',    name: 'Villanova Wildcats',       abbr: 'VILL' , odds: '+11000' },
  { id: 'fb-osu',     name: 'Ohio State Buckeyes',      abbr: 'OSU'  , odds: '+12000' },

  // Longshots (+12000 – +25000)
  { id: 'fb-bay',     name: 'Baylor Bears',             abbr: 'BAY'  , odds: '+13000' },
  { id: 'fb-isu',     name: 'Iowa State Cyclones',      abbr: 'ISU'  , odds: '+15000' },
  { id: 'fb-miz',     name: 'Missouri Tigers',          abbr: 'MIZ'  , odds: '+17000' },
  { id: 'fb-usu',     name: 'Utah State Aggies',        abbr: 'USU'  , odds: '+19000' },
  { id: 'fb-lib',     name: 'Liberty Flames',           abbr: 'LIB'  , odds: '+20000' },
  { id: 'fb-mcn',     name: 'McNeese Cowboys',          abbr: 'MCN'  , odds: '+22000' },
  { id: 'fb-hpu',     name: 'High Point Panthers',      abbr: 'HPU'  , odds: '+25000' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Naive fuzzy match: does apiName overlap with any fallback name word? */
function matchFallback(
  apiName: string,
  fallbacks: Omit<FutureTeam, 'tier' | 'isLive'>[]
): Omit<FutureTeam, 'tier' | 'isLive'> | undefined {
  const api = apiName.toLowerCase();
  return fallbacks.find(fb => {
    const fb_lower = fb.name.toLowerCase();
    // Check if any 4+ letter word from either side appears in the other
    const apiWords = api.split(/\s+/).filter(w => w.length >= 4);
    return apiWords.some(w => fb_lower.includes(w));
  });
}

/** Build abbr from API team name (first word up to 4 chars) */
function buildAbbr(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0].slice(0, 5).toUpperCase();
  // e.g. "Duke Blue Devils" → "DUKE"
  return words[0].slice(0, 4).toUpperCase();
}

// ─── Fetch from server ────────────────────────────────────────────────────────

async function fetchFutures(): Promise<{ name: string; odds: string }[]> {
  const res = await fetch(
    `${API_BASE}/ncaab-futures`,
    { headers: { Authorization: `Bearer ${publicAnonKey}` } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data.teams) ? data.teams : [];
}

// ─── Merge API + fallback into final ordered list ─────────────────────────────

function buildTeamList(apiTeams: { name: string; odds: string }[]): FutureTeam[] {
  const used = new Set<string>(); // fallback ids that have been matched
  const result: FutureTeam[] = [];

  // 1. For each API team, try to match a fallback (to keep abbr + id consistent)
  for (const api of apiTeams) {
    const fb = matchFallback(api.name, FALLBACK_TEAMS);
    if (fb) {
      used.add(fb.id);
      const odds = api.odds;
      result.push({ ...fb, odds, tier: getTier(odds), isLive: true });
    } else {
      // Unmatched API team — create entry on the fly
      const odds = api.odds;
      result.push({
        id: `api-${api.name.toLowerCase().replace(/\s+/g, '-')}`,
        name: api.name,
        abbr: buildAbbr(api.name),
        odds,
        tier: getTier(odds),
        isLive: true,
      });
    }
  }

  // 2. Append fallback teams not matched by API
  for (const fb of FALLBACK_TEAMS) {
    if (used.has(fb.id)) continue;
    result.push({ ...fb, tier: getTier(fb.odds), isLive: false });
  }

  return result;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FuturesBettingTab() {
  const [teams,      setTeams]      = useState<FutureTeam[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [hasLive,    setHasLive]    = useState(false);
  const [betSlipOpen, setBetSlipOpen] = useState(false);
  const [selected,   setSelected]   = useState<FutureTeam | null>(null);

  const { placedBets } = useApp();
  const pendingCount = placedBets.filter(b => b.status === 'pending').length;

  const load = async () => {
    setLoading(true);
    try {
      const apiTeams = await fetchFutures();
      const merged   = buildTeamList(apiTeams);
      setTeams(merged);
      setHasLive(apiTeams.length > 0);
    } catch {
      setTeams(buildTeamList([]));
      setHasLive(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleBet = (team: FutureTeam) => {
    setSelected(team);
    setBetSlipOpen(true);
  };

  // Group by tier in display order
  const TIER_ORDER: Tier[] = ['top', 'strong', 'mid', 'longshot'];
  const grouped = TIER_ORDER.map(tier => ({
    tier,
    teams: teams.filter(t => t.tier === tier),
  })).filter(g => g.teams.length > 0);

  return (
    <div className="px-4 py-5">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-1">
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '800', color: 'white' }}>
            Futures 🔮
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', marginTop: '2px' }}>
            NCAA Championship · 2026
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Live/sample badge */}
          <div
            className="flex items-center gap-1 px-2 py-1 rounded-full"
            style={{
              background: hasLive ? 'rgba(102,187,106,0.1)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${hasLive ? 'rgba(102,187,106,0.3)' : 'rgba(255,255,255,0.1)'}`,
            }}
          >
            {hasLive
              ? <Wifi size={9} style={{ color: '#66BB6A' }} />
              : <WifiOff size={9} style={{ color: 'rgba(255,255,255,0.25)' }} />}
            <span style={{ fontSize: '9px', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase', color: hasLive ? '#66BB6A' : 'rgba(255,255,255,0.25)' }}>
              {hasLive ? 'Live' : 'Sample'}
            </span>
          </div>
          {/* Refresh */}
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center justify-center rounded-full transition-all active:scale-90"
            style={{ width: '30px', height: '30px', background: 'rgba(255,179,0,0.08)', border: '1px solid rgba(255,179,0,0.2)' }}
          >
            <motion.div
              animate={loading ? { rotate: 360 } : { rotate: 0 }}
              transition={loading ? { duration: 0.8, repeat: Infinity, ease: 'linear' } : {}}
            >
              <RefreshCw size={13} style={{ color: '#FFB300' }} />
            </motion.div>
          </button>
        </div>
      </div>

      <p className="mb-5" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', lineHeight: '1.5' }}>
        Bet stays <span style={{ color: 'rgba(255,213,79,0.7)', fontWeight: '600' }}>pending</span> until the tournament ends · losses go to the Group Bank 🌽
      </p>

      {/* ── Loading skeletons ──────────────────────────────────────────── */}
      {loading ? (
        <div>
          {[0, 1, 2].map(gi => (
            <div key={gi} className="mb-7">
              {/* Section header skeleton */}
              <motion.div
                animate={{ opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 1.3, repeat: Infinity, delay: gi * 0.2 }}
                className="mb-3 rounded"
                style={{ width: '130px', height: '14px', background: 'rgba(255,213,79,0.15)' }}
              />
              <div className="grid grid-cols-2 gap-3">
                {[0, 1, 2, 3].map(ci => (
                  <motion.div
                    key={ci}
                    animate={{ opacity: [0.2, 0.45, 0.2] }}
                    transition={{ duration: 1.3, repeat: Infinity, delay: ci * 0.12 + gi * 0.15 }}
                    className="rounded-2xl"
                    style={{ height: '120px', background: 'rgba(255,213,79,0.06)', border: '1px solid rgba(255,213,79,0.08)' }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* ── Tier groups ────────────────────────────────────────────────── */
        <div>
          {grouped.map((group, gi) => {
            const cfg = TIER_CONFIG[group.tier];
            return (
              <motion.div
                key={group.tier}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: gi * 0.08 }}
                className="mb-7"
              >
                {/* Section label */}
                <div className="flex items-center gap-2 mb-3">
                  <span style={{ fontSize: '13px' }}>{cfg.emoji}</span>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: '700',
                      color: cfg.color,
                      letterSpacing: '0.8px',
                      textTransform: 'uppercase',
                    }}
                  >
                    {cfg.label}
                  </span>
                  <div className="flex-1 h-px" style={{ background: cfg.border }} />
                  <span style={{ fontSize: '10px', color: cfg.dim, fontWeight: '600' }}>
                    {group.teams.length} teams
                  </span>
                </div>

                {/* 2-column grid */}
                <div className="grid grid-cols-2 gap-3">
                  {group.teams.map((team, ti) => (
                    <TeamCard
                      key={team.id}
                      team={team}
                      cfg={cfg}
                      delay={gi * 0.08 + ti * 0.04}
                      onBet={() => handleBet(team)}
                    />
                  ))}
                </div>
              </motion.div>
            );
          })}

          {/* Results CTA */}
          {pendingCount > 0 && (
            <motion.div className="mt-2 mb-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <GlossButton to="/results" variant="ghost">
                Check Results ({pendingCount} pending) →
              </GlossButton>
            </motion.div>
          )}
        </div>
      )}

      {/* ── Bet Slip ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {selected && (
          <BetSlip
            isOpen={betSlipOpen}
            onClose={() => setBetSlipOpen(false)}
            betType="Futures"
            selection={`${selected.name} to Win Championship`}
            odds={selected.odds}
            game="NCAA Championship 2026"
            team={selected.name}
            lineId={selected.id}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Team Card ────────────────────────────────────────────────────────────────

interface TeamCardProps {
  team: FutureTeam;
  cfg: typeof TIER_CONFIG[Tier];
  delay: number;
  onBet: () => void;
}

function TeamCard({ team, cfg, delay, onBet }: TeamCardProps) {
  const [pressed, setPressed] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.25 }}
      className="relative flex flex-col rounded-2xl overflow-hidden"
      style={{
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        minHeight: '130px',
      }}
    >
      {/* Live pip */}
      {team.isLive && (
        <div
          className="absolute top-2 right-2 rounded-full"
          style={{ width: '6px', height: '6px', background: '#66BB6A', boxShadow: '0 0 6px rgba(102,187,106,0.6)' }}
        />
      )}

      {/* Card body */}
      <div className="flex-1 flex flex-col items-center justify-center pt-4 pb-2 px-2">
        {/* Abbr badge */}
        <div
          className="flex items-center justify-center rounded-xl mb-2"
          style={{
            width: '52px',
            height: '40px',
            background: 'rgba(0,0,0,0.35)',
            border: `1px solid ${cfg.border}`,
          }}
        >
          <span
            style={{
              fontSize: team.abbr.length > 4 ? '10px' : '13px',
              fontWeight: '900',
              color: cfg.color,
              letterSpacing: '0.5px',
              lineHeight: 1,
            }}
          >
            {team.abbr}
          </span>
        </div>

        {/* Team name */}
        <p
          style={{
            color: 'rgba(255,255,255,0.75)',
            fontSize: '10px',
            fontWeight: '600',
            textAlign: 'center',
            lineHeight: '1.3',
            maxWidth: '100%',
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {team.name}
        </p>

        {/* Odds */}
        <div className="mt-2 mb-3">
          <span
            style={{
              fontSize: '15px',
              fontWeight: '800',
              color: cfg.color,
            }}
          >
            {team.odds}
          </span>
        </div>
      </div>

      {/* Bet button */}
      <button
        onPointerDown={() => setPressed(true)}
        onPointerUp={() => setPressed(false)}
        onPointerLeave={() => setPressed(false)}
        onClick={onBet}
        className="w-full py-2 flex items-center justify-center gap-1 transition-all"
        style={{
          background: pressed ? cfg.color : 'rgba(0,0,0,0.3)',
          borderTop: `1px solid ${cfg.border}`,
        }}
      >
        <Trophy size={10} style={{ color: pressed ? '#111111' : cfg.color }} />
        <span
          style={{
            fontSize: '11px',
            fontWeight: '700',
            color: pressed ? '#111111' : cfg.color,
            letterSpacing: '0.3px',
          }}
        >
          Bet
        </span>
      </button>
    </motion.div>
  );
}
