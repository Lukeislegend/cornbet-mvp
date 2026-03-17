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
  market: string;
  tier: Tier;
  isLive: boolean;
}

// ─── Market tabs ──────────────────────────────────────────────────────────────

const MARKET_TABS = [
  { key: 'championship',  label: 'Win Championship', emoji: '🏆', selectionSuffix: 'to Win Championship' },
  { key: 'finals',        label: 'Reach Finals',     emoji: '🏅', selectionSuffix: 'to Reach the Finals'  },
  { key: 'final_four',    label: 'Final Four',        emoji: '🎯', selectionSuffix: 'to Make Final Four'   },
  { key: 'elite_eight',   label: 'Elite Eight',       emoji: '⚡', selectionSuffix: 'to Make Elite Eight'  },
  { key: 'sweet_sixteen', label: 'Sweet 16',          emoji: '✨', selectionSuffix: 'to Make Sweet 16'     },
  { key: 'region',        label: 'Win Region',        emoji: '🗺️', selectionSuffix: 'to Win Their Region'  },
];

const REGION_MARKETS = new Set(['south_region', 'east_region', 'midwest_region', 'west_region']);

// ─── Tier config ──────────────────────────────────────────────────────────────

const TIER_CONFIG: Record<Tier, { label: string; emoji: string; color: string; dim: string; bg: string; border: string }> = {
  top:      { label: 'Top Contenders', emoji: '🏆', color: '#FFD54F', dim: 'rgba(255,213,79,0.6)',  bg: 'rgba(255,213,79,0.07)',  border: 'rgba(255,213,79,0.22)' },
  strong:   { label: 'Strong Teams',   emoji: '🔥', color: '#FFB300', dim: 'rgba(255,179,0,0.55)',  bg: 'rgba(255,179,0,0.07)',   border: 'rgba(255,179,0,0.2)'   },
  mid:      { label: 'Mid Tier',       emoji: '📈', color: '#FF8F00', dim: 'rgba(255,143,0,0.5)',   bg: 'rgba(255,143,0,0.06)',   border: 'rgba(255,143,0,0.18)'  },
  longshot: { label: 'Longshots',      emoji: '🎲', color: 'rgba(255,255,255,0.55)', dim: 'rgba(255,255,255,0.35)', bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.1)' },
};

function getTier(oddsStr: string): Tier {
  const n = parseInt(oddsStr.replace('+', ''));
  if (isNaN(n)) return 'longshot';
  if (n < 0)    return 'top';      // negative = heavy favourite (e.g. -600 Sweet 16)
  if (n < 1800) return 'top';
  if (n < 5000) return 'strong';
  if (n < 12000) return 'mid';
  return 'longshot';
}

// ─── Per-market fallback data (2026 NCAA Tournament) ─────────────────────────
// Approximate pre-tournament odds. Used when live ESPN data is unavailable.

type FallbackEntry = { id: string; name: string; abbr: string; odds: string };

const FB_CHAMPIONSHIP: FallbackEntry[] = [
  { id: 'c-duke',  name: 'Duke Blue Devils',       abbr: 'DUKE', odds: '+350'  },
  { id: 'c-ariz',  name: 'Arizona Wildcats',        abbr: 'ARIZ', odds: '+600'  },
  { id: 'c-mich',  name: 'Michigan Wolverines',     abbr: 'MICH', odds: '+700'  },
  { id: 'c-fla',   name: 'Florida Gators',          abbr: 'FLA',  odds: '+800'  },
  { id: 'c-ucon',  name: 'UConn Huskies',           abbr: 'UCON', odds: '+1100' },
  { id: 'c-hou',   name: 'Houston Cougars',         abbr: 'HOU',  odds: '+1200' },
  { id: 'c-isu',   name: 'Iowa State Cyclones',     abbr: 'ISU',  odds: '+1400' },
  { id: 'c-pur',   name: 'Purdue Boilermakers',     abbr: 'PUR',  odds: '+1600' },
  { id: 'c-ten',   name: 'Tennessee Volunteers',    abbr: 'TENN', odds: '+2000' },
  { id: 'c-wis',   name: 'Wisconsin Badgers',       abbr: 'WIS',  odds: '+2500' },
  { id: 'c-uk',    name: 'Kentucky Wildcats',       abbr: 'UK',   odds: '+2800' },
  { id: 'c-stj',   name: "St. John's Red Storm",    abbr: 'STJ',  odds: '+3000' },
  { id: 'c-aub',   name: 'Auburn Tigers',           abbr: 'AUB',  odds: '+3500' },
  { id: 'c-marq',  name: 'Marquette Golden Eagles', abbr: 'MARQ', odds: '+4000' },
  { id: 'c-ttu',   name: 'Texas Tech Red Raiders',  abbr: 'TTU',  odds: '+4500' },
  { id: 'c-md',    name: 'Maryland Terrapins',      abbr: 'MD',   odds: '+5000' },
  { id: 'c-mem',   name: 'Memphis Tigers',          abbr: 'MEM',  odds: '+6000' },
  { id: 'c-gonz',  name: 'Gonzaga Bulldogs',        abbr: 'GONZ', odds: '+7000' },
  { id: 'c-unc',   name: 'North Carolina Tar Heels',abbr: 'UNC',  odds: '+8000' },
  { id: 'c-msu',   name: 'Michigan State Spartans', abbr: 'MSU',  odds: '+9000' },
];

const FB_FINALS: FallbackEntry[] = [
  { id: 'f-duke',  name: 'Duke Blue Devils',        abbr: 'DUKE', odds: '+175'  },
  { id: 'f-ariz',  name: 'Arizona Wildcats',        abbr: 'ARIZ', odds: '+250'  },
  { id: 'f-mich',  name: 'Michigan Wolverines',     abbr: 'MICH', odds: '+300'  },
  { id: 'f-fla',   name: 'Florida Gators',          abbr: 'FLA',  odds: '+350'  },
  { id: 'f-ucon',  name: 'UConn Huskies',           abbr: 'UCON', odds: '+500'  },
  { id: 'f-hou',   name: 'Houston Cougars',         abbr: 'HOU',  odds: '+550'  },
  { id: 'f-isu',   name: 'Iowa State Cyclones',     abbr: 'ISU',  odds: '+600'  },
  { id: 'f-pur',   name: 'Purdue Boilermakers',     abbr: 'PUR',  odds: '+700'  },
  { id: 'f-ten',   name: 'Tennessee Volunteers',    abbr: 'TENN', odds: '+900'  },
  { id: 'f-wis',   name: 'Wisconsin Badgers',       abbr: 'WIS',  odds: '+1100' },
  { id: 'f-uk',    name: 'Kentucky Wildcats',       abbr: 'UK',   odds: '+1200' },
  { id: 'f-stj',   name: "St. John's Red Storm",    abbr: 'STJ',  odds: '+1400' },
  { id: 'f-aub',   name: 'Auburn Tigers',           abbr: 'AUB',  odds: '+1600' },
  { id: 'f-marq',  name: 'Marquette Golden Eagles', abbr: 'MARQ', odds: '+1800' },
  { id: 'f-ttu',   name: 'Texas Tech Red Raiders',  abbr: 'TTU',  odds: '+2200' },
  { id: 'f-mem',   name: 'Memphis Tigers',          abbr: 'MEM',  odds: '+3000' },
];

const FB_FINAL_FOUR: FallbackEntry[] = [
  { id: 'ff-duke', name: 'Duke Blue Devils',        abbr: 'DUKE', odds: '+100'  },
  { id: 'ff-ariz', name: 'Arizona Wildcats',        abbr: 'ARIZ', odds: '+130'  },
  { id: 'ff-mich', name: 'Michigan Wolverines',     abbr: 'MICH', odds: '+155'  },
  { id: 'ff-fla',  name: 'Florida Gators',          abbr: 'FLA',  odds: '+175'  },
  { id: 'ff-ucon', name: 'UConn Huskies',           abbr: 'UCON', odds: '+250'  },
  { id: 'ff-hou',  name: 'Houston Cougars',         abbr: 'HOU',  odds: '+280'  },
  { id: 'ff-isu',  name: 'Iowa State Cyclones',     abbr: 'ISU',  odds: '+320'  },
  { id: 'ff-pur',  name: 'Purdue Boilermakers',     abbr: 'PUR',  odds: '+380'  },
  { id: 'ff-ten',  name: 'Tennessee Volunteers',    abbr: 'TENN', odds: '+450'  },
  { id: 'ff-wis',  name: 'Wisconsin Badgers',       abbr: 'WIS',  odds: '+550'  },
  { id: 'ff-uk',   name: 'Kentucky Wildcats',       abbr: 'UK',   odds: '+600'  },
  { id: 'ff-stj',  name: "St. John's Red Storm",    abbr: 'STJ',  odds: '+700'  },
  { id: 'ff-aub',  name: 'Auburn Tigers',           abbr: 'AUB',  odds: '+800'  },
  { id: 'ff-marq', name: 'Marquette Golden Eagles', abbr: 'MARQ', odds: '+900'  },
  { id: 'ff-ttu',  name: 'Texas Tech Red Raiders',  abbr: 'TTU',  odds: '+1100' },
  { id: 'ff-mem',  name: 'Memphis Tigers',          abbr: 'MEM',  odds: '+1400' },
  { id: 'ff-gonz', name: 'Gonzaga Bulldogs',        abbr: 'GONZ', odds: '+1800' },
  { id: 'ff-unc',  name: 'North Carolina Tar Heels',abbr: 'UNC',  odds: '+2000' },
];

const FB_ELITE_EIGHT: FallbackEntry[] = [
  { id: 'e8-duke', name: 'Duke Blue Devils',        abbr: 'DUKE', odds: '-280'  },
  { id: 'e8-ariz', name: 'Arizona Wildcats',        abbr: 'ARIZ', odds: '-230'  },
  { id: 'e8-mich', name: 'Michigan Wolverines',     abbr: 'MICH', odds: '-200'  },
  { id: 'e8-fla',  name: 'Florida Gators',          abbr: 'FLA',  odds: '-175'  },
  { id: 'e8-ucon', name: 'UConn Huskies',           abbr: 'UCON', odds: '-140'  },
  { id: 'e8-hou',  name: 'Houston Cougars',         abbr: 'HOU',  odds: '-120'  },
  { id: 'e8-isu',  name: 'Iowa State Cyclones',     abbr: 'ISU',  odds: '+100'  },
  { id: 'e8-pur',  name: 'Purdue Boilermakers',     abbr: 'PUR',  odds: '+120'  },
  { id: 'e8-ten',  name: 'Tennessee Volunteers',    abbr: 'TENN', odds: '+160'  },
  { id: 'e8-wis',  name: 'Wisconsin Badgers',       abbr: 'WIS',  odds: '+200'  },
  { id: 'e8-uk',   name: 'Kentucky Wildcats',       abbr: 'UK',   odds: '+220'  },
  { id: 'e8-stj',  name: "St. John's Red Storm",    abbr: 'STJ',  odds: '+260'  },
  { id: 'e8-aub',  name: 'Auburn Tigers',           abbr: 'AUB',  odds: '+300'  },
  { id: 'e8-marq', name: 'Marquette Golden Eagles', abbr: 'MARQ', odds: '+350'  },
  { id: 'e8-ttu',  name: 'Texas Tech Red Raiders',  abbr: 'TTU',  odds: '+400'  },
  { id: 'e8-md',   name: 'Maryland Terrapins',      abbr: 'MD',   odds: '+450'  },
  { id: 'e8-mem',  name: 'Memphis Tigers',          abbr: 'MEM',  odds: '+550'  },
  { id: 'e8-gonz', name: 'Gonzaga Bulldogs',        abbr: 'GONZ', odds: '+700'  },
  { id: 'e8-unc',  name: 'North Carolina Tar Heels',abbr: 'UNC',  odds: '+800'  },
  { id: 'e8-msu',  name: 'Michigan State Spartans', abbr: 'MSU',  odds: '+900'  },
];

const FB_SWEET_16: FallbackEntry[] = [
  { id: 's16-duke', name: 'Duke Blue Devils',        abbr: 'DUKE', odds: '-600'  },
  { id: 's16-ariz', name: 'Arizona Wildcats',        abbr: 'ARIZ', odds: '-500'  },
  { id: 's16-mich', name: 'Michigan Wolverines',     abbr: 'MICH', odds: '-450'  },
  { id: 's16-fla',  name: 'Florida Gators',          abbr: 'FLA',  odds: '-400'  },
  { id: 's16-ucon', name: 'UConn Huskies',           abbr: 'UCON', odds: '-350'  },
  { id: 's16-hou',  name: 'Houston Cougars',         abbr: 'HOU',  odds: '-300'  },
  { id: 's16-isu',  name: 'Iowa State Cyclones',     abbr: 'ISU',  odds: '-270'  },
  { id: 's16-pur',  name: 'Purdue Boilermakers',     abbr: 'PUR',  odds: '-240'  },
  { id: 's16-ten',  name: 'Tennessee Volunteers',    abbr: 'TENN', odds: '-150'  },
  { id: 's16-wis',  name: 'Wisconsin Badgers',       abbr: 'WIS',  odds: '-130'  },
  { id: 's16-uk',   name: 'Kentucky Wildcats',       abbr: 'UK',   odds: '-110'  },
  { id: 's16-stj',  name: "St. John's Red Storm",    abbr: 'STJ',  odds: '+110'  },
  { id: 's16-aub',  name: 'Auburn Tigers',           abbr: 'AUB',  odds: '+130'  },
  { id: 's16-marq', name: 'Marquette Golden Eagles', abbr: 'MARQ', odds: '+150'  },
  { id: 's16-ttu',  name: 'Texas Tech Red Raiders',  abbr: 'TTU',  odds: '+175'  },
  { id: 's16-md',   name: 'Maryland Terrapins',      abbr: 'MD',   odds: '+200'  },
  { id: 's16-mem',  name: 'Memphis Tigers',          abbr: 'MEM',  odds: '+250'  },
  { id: 's16-gonz', name: 'Gonzaga Bulldogs',        abbr: 'GONZ', odds: '+300'  },
  { id: 's16-unc',  name: 'North Carolina Tar Heels',abbr: 'UNC',  odds: '+350'  },
  { id: 's16-msu',  name: 'Michigan State Spartans', abbr: 'MSU',  odds: '+400'  },
];

const FALLBACK_BY_MARKET: Record<string, FallbackEntry[]> = {
  championship: FB_CHAMPIONSHIP,
  finals:       FB_FINALS,
  final_four:   FB_FINAL_FOUR,
  elite_eight:  FB_ELITE_EIGHT,
  sweet_sixteen: FB_SWEET_16,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildAbbr(name: string): string {
  const words = name.trim().split(/\s+/);
  return words[0].slice(0, 4).toUpperCase();
}

function matchFallback(apiName: string, fallbacks: FallbackEntry[]): FallbackEntry | undefined {
  const api = apiName.toLowerCase();
  return fallbacks.find(fb => {
    const words = api.split(/\s+/).filter(w => w.length >= 3);
    return words.some(w => fb.name.toLowerCase().includes(w));
  });
}

// ─── Fetch ────────────────────────────────────────────────────────────────────

async function fetchFutures(): Promise<{ name: string; odds: string; market: string }[]> {
  const res = await fetch(
    `${API_BASE}/ncaab-futures`,
    { headers: { Authorization: `Bearer ${publicAnonKey}` } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data.teams) ? data.teams : [];
}

// ─── Build team list ──────────────────────────────────────────────────────────
// For each market: use live API data when available, fallback otherwise.
// Deduplicate within each market, and cap at 24 teams per market for readability.

const MARKET_CAP = 24;

function buildTeamList(apiTeams: { name: string; odds: string; market: string }[]): FutureTeam[] {
  const result: FutureTeam[] = [];

  // Group API teams by market
  const apiByMarket = new Map<string, { name: string; odds: string }[]>();
  for (const t of apiTeams) {
    if (!t.name || !t.odds || !t.market) continue;
    const existing = apiByMarket.get(t.market) ?? [];
    existing.push({ name: t.name, odds: t.odds });
    apiByMarket.set(t.market, existing);
  }

  const marketsToProcess = ['championship', 'finals', 'final_four', 'elite_eight', 'sweet_sixteen'];

  for (const market of marketsToProcess) {
    const liveTeams = apiByMarket.get(market) ?? [];
    const fallback = FALLBACK_BY_MARKET[market] ?? [];
    const usedFallbackIds = new Set<string>();
    const marketEntries: FutureTeam[] = [];

    if (liveTeams.length > 0) {
      // Use live data — match to fallback to get abbr/id, or auto-generate
      for (const t of liveTeams) {
        const fb = matchFallback(t.name, fallback);
        if (fb) {
          usedFallbackIds.add(fb.id);
          marketEntries.push({ ...fb, market, odds: t.odds, tier: getTier(t.odds), isLive: true });
        } else {
          marketEntries.push({
            id: `api-${market}-${t.name.toLowerCase().replace(/\s+/g, '-')}`,
            name: t.name, abbr: buildAbbr(t.name),
            odds: t.odds, market,
            tier: getTier(t.odds), isLive: true,
          });
        }
      }
    } else {
      // No live data — use all fallback entries for this market
      for (const fb of fallback) {
        marketEntries.push({ ...fb, market, tier: getTier(fb.odds), isLive: false });
        usedFallbackIds.add(fb.id);
      }
    }

    // Sort by implied probability (negative first, then lowest positive)
    marketEntries.sort((a, b) => {
      const na = parseInt(a.odds.replace('+', ''));
      const nb = parseInt(b.odds.replace('+', ''));
      return na - nb;
    });

    // Cap at MARKET_CAP teams
    result.push(...marketEntries.slice(0, MARKET_CAP));
  }

  return result;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FuturesBettingTab() {
  const [allTeams,    setAllTeams]    = useState<FutureTeam[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [hasLive,     setHasLive]     = useState(false);
  const [activeTab,   setActiveTab]   = useState('championship');
  const [betSlipOpen, setBetSlipOpen] = useState(false);
  const [selected,    setSelected]    = useState<FutureTeam | null>(null);

  const { placedBets } = useApp();
  const pendingCount = placedBets.filter(b => b.status === 'pending').length;

  const load = async () => {
    setLoading(true);
    try {
      const apiTeams = await fetchFutures();
      setAllTeams(buildTeamList(apiTeams));
      setHasLive(apiTeams.length > 0);
    } catch {
      setAllTeams(buildTeamList([]));
      setHasLive(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Teams for the active tab
  const visibleTeams = activeTab === 'region'
    ? allTeams.filter(t => REGION_MARKETS.has(t.market))
    : allTeams.filter(t => t.market === activeTab);

  // Group by tier
  const TIER_ORDER: Tier[] = ['top', 'strong', 'mid', 'longshot'];
  const grouped = TIER_ORDER
    .map(tier => ({ tier, teams: visibleTeams.filter(t => t.tier === tier) }))
    .filter(g => g.teams.length > 0);

  const activeTabConfig = MARKET_TABS.find(t => t.key === activeTab)!;
  const selectionLabel = selected ? `${selected.name} ${activeTabConfig.selectionSuffix}` : '';

  return (
    <div className="px-4 py-5">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-1">
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '800', color: 'white' }}>
            Futures 🔮
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', marginTop: '2px' }}>
            NCAA Tournament 2026
          </p>
        </div>
        <div className="flex items-center gap-2">
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
            <span style={{
              fontSize: '9px', fontWeight: '700', letterSpacing: '0.5px',
              textTransform: 'uppercase',
              color: hasLive ? '#66BB6A' : 'rgba(255,255,255,0.25)',
            }}>
              {hasLive ? 'Live' : 'Sample'}
            </span>
          </div>
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

      <p className="mb-4" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', lineHeight: '1.5' }}>
        Bet stays <span style={{ color: 'rgba(255,213,79,0.7)', fontWeight: '600' }}>pending</span> until resolved · losses go to the MaizeBank 🌽
      </p>

      {/* ── Market tabs ────────────────────────────────────────────────── */}
      <div className="mb-5">
        {/* Row 1: Championship + Finals */}
        <div className="flex gap-2 mb-2">
          {MARKET_TABS.slice(0, 2).map(tab => (
            <MarketTab
              key={tab.key}
              tab={tab}
              isActive={activeTab === tab.key}
              teamCount={allTeams.filter(t => t.market === tab.key).length}
              liveCount={allTeams.filter(t => t.market === tab.key && t.isLive).length}
              onClick={() => setActiveTab(tab.key)}
            />
          ))}
        </div>
        {/* Row 2: Final Four + Elite 8 + Sweet 16 */}
        <div className="flex gap-2 mb-2">
          {MARKET_TABS.slice(2, 5).map(tab => (
            <MarketTab
              key={tab.key}
              tab={tab}
              isActive={activeTab === tab.key}
              teamCount={allTeams.filter(t => t.market === tab.key).length}
              liveCount={allTeams.filter(t => t.market === tab.key && t.isLive).length}
              onClick={() => setActiveTab(tab.key)}
            />
          ))}
        </div>
        {/* Row 3: Win Region */}
        <div className="flex gap-2">
          {MARKET_TABS.slice(5).map(tab => (
            <MarketTab
              key={tab.key}
              tab={tab}
              isActive={activeTab === tab.key}
              teamCount={allTeams.filter(t => REGION_MARKETS.has(t.market)).length}
              liveCount={allTeams.filter(t => REGION_MARKETS.has(t.market) && t.isLive).length}
              onClick={() => setActiveTab(tab.key)}
            />
          ))}
        </div>
      </div>

      {/* ── Loading skeletons ──────────────────────────────────────────── */}
      {loading ? (
        <div>
          {[0, 1].map(gi => (
            <div key={gi} className="mb-7">
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
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16 }}
          >
            {grouped.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center py-16 rounded-2xl"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <span style={{ fontSize: '36px', marginBottom: '12px' }}>{activeTabConfig.emoji}</span>
                <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '13px', fontWeight: '600' }}>
                  {activeTab === 'region' ? 'Regional markets opening soon' : 'Odds not yet available'}
                </p>
                <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '11px', marginTop: '4px' }}>
                  Check back as the tournament progresses
                </p>
              </div>
            ) : (
              <div>
                {grouped.map((group, gi) => {
                  const cfg = TIER_CONFIG[group.tier];
                  return (
                    <motion.div
                      key={group.tier}
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: gi * 0.06 }}
                      className="mb-7"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <span style={{ fontSize: '13px' }}>{cfg.emoji}</span>
                        <span style={{
                          fontSize: '11px', fontWeight: '700', color: cfg.color,
                          letterSpacing: '0.8px', textTransform: 'uppercase',
                        }}>
                          {cfg.label}
                        </span>
                        <div className="flex-1 h-px" style={{ background: cfg.border }} />
                        <span style={{ fontSize: '10px', color: cfg.dim, fontWeight: '600' }}>
                          {group.teams.length} teams
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        {group.teams.map((team, ti) => (
                          <TeamCard
                            key={team.id}
                            team={team}
                            cfg={cfg}
                            delay={gi * 0.06 + ti * 0.03}
                            onBet={() => { setSelected(team); setBetSlipOpen(true); }}
                          />
                        ))}
                      </div>
                    </motion.div>
                  );
                })}

                {pendingCount > 0 && (
                  <motion.div className="mt-2 mb-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <GlossButton to="/results" variant="ghost">
                      Check Results ({pendingCount} pending) →
                    </GlossButton>
                  </motion.div>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      )}

      {/* ── Bet Slip ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {selected && (
          <BetSlip
            isOpen={betSlipOpen}
            onClose={() => setBetSlipOpen(false)}
            betType="Futures"
            selection={selectionLabel}
            odds={selected.odds}
            game="NCAA Tournament 2026"
            team={selected.name}
            lineId={selected.id}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Market Tab Button ────────────────────────────────────────────────────────

interface MarketTabProps {
  tab: typeof MARKET_TABS[0];
  isActive: boolean;
  teamCount: number;
  liveCount: number;
  onClick: () => void;
}

function MarketTab({ tab, isActive, teamCount, liveCount, onClick }: MarketTabProps) {
  return (
    <button
      onClick={onClick}
      className="flex-1 flex flex-col items-center justify-center py-2.5 px-2 rounded-2xl transition-all active:scale-95"
      style={{
        background: isActive ? 'rgba(255,213,79,0.14)' : 'rgba(255,255,255,0.04)',
        border: `1.5px solid ${isActive ? 'rgba(255,213,79,0.5)' : 'rgba(255,255,255,0.07)'}`,
        boxShadow: isActive ? '0 0 12px rgba(255,213,79,0.08)' : 'none',
        minHeight: '60px',
      }}
    >
      <span style={{ fontSize: '18px', marginBottom: '3px', lineHeight: 1 }}>{tab.emoji}</span>
      <span style={{
        fontSize: '10px',
        fontWeight: '700',
        color: isActive ? '#FFD54F' : 'rgba(255,255,255,0.4)',
        textAlign: 'center',
        lineHeight: '1.2',
        letterSpacing: '0.1px',
      }}>
        {tab.label}
      </span>
      {teamCount > 0 && (
        <span style={{
          fontSize: '8px',
          fontWeight: '700',
          marginTop: '3px',
          color: liveCount > 0
            ? (isActive ? 'rgba(102,187,106,0.9)' : 'rgba(102,187,106,0.55)')
            : (isActive ? 'rgba(255,213,79,0.5)' : 'rgba(255,255,255,0.2)'),
        }}>
          {liveCount > 0 ? `${liveCount} live` : `${teamCount} teams`}
        </span>
      )}
    </button>
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
      transition={{ delay, duration: 0.22 }}
      className="relative flex flex-col rounded-2xl overflow-hidden"
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, minHeight: '130px' }}
    >
      {team.isLive && (
        <div
          className="absolute top-2 right-2 rounded-full"
          style={{ width: '6px', height: '6px', background: '#66BB6A', boxShadow: '0 0 6px rgba(102,187,106,0.6)' }}
        />
      )}

      <div className="flex-1 flex flex-col items-center justify-center pt-4 pb-2 px-2">
        <div
          className="flex items-center justify-center rounded-xl mb-2"
          style={{ width: '52px', height: '40px', background: 'rgba(0,0,0,0.35)', border: `1px solid ${cfg.border}` }}
        >
          <span style={{
            fontSize: team.abbr.length > 4 ? '10px' : '13px',
            fontWeight: '900', color: cfg.color, letterSpacing: '0.5px', lineHeight: 1,
          }}>
            {team.abbr}
          </span>
        </div>

        <p style={{
          color: 'rgba(255,255,255,0.75)', fontSize: '10px', fontWeight: '600',
          textAlign: 'center', lineHeight: '1.3', maxWidth: '100%',
          overflow: 'hidden', display: '-webkit-box',
          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        }}>
          {team.name}
        </p>

        <div className="mt-2 mb-3">
          <span style={{ fontSize: '15px', fontWeight: '800', color: cfg.color }}>
            {team.odds}
          </span>
        </div>
      </div>

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
        <span style={{
          fontSize: '11px', fontWeight: '700',
          color: pressed ? '#111111' : cfg.color, letterSpacing: '0.3px',
        }}>
          Bet
        </span>
      </button>
    </motion.div>
  );
}
