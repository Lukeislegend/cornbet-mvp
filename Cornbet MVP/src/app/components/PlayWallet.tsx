import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router';
import { ArrowLeft, Clock, CheckCircle, XCircle, TrendingUp } from 'lucide-react';
import { MobileContainer } from './MobileContainer';
import { WalletBar } from './WalletBar';
import { useApp } from '../context/AppContext';
import type { PlacedBet } from '../context/AppContext';

type Filter = 'all' | 'pending' | 'won' | 'lost';

const statusColors: Record<PlacedBet['status'], { text: string; bg: string; border: string }> = {
  pending: { text: '#FFB300',  bg: 'rgba(255,179,0,0.12)',   border: 'rgba(255,179,0,0.3)'   },
  won:     { text: '#66BB6A',  bg: 'rgba(102,187,106,0.12)', border: 'rgba(102,187,106,0.35)' },
  lost:    { text: '#EF5350',  bg: 'rgba(239,83,80,0.12)',   border: 'rgba(239,83,80,0.3)'   },
};

const statusIcons = {
  pending: Clock,
  won:     CheckCircle,
  lost:    XCircle,
};

function BetRow({ bet, index }: { bet: PlacedBet; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const colors = statusColors[bet.status];
  const Icon = statusIcons[bet.status];
  const isParlay = bet.type === 'Parlay';

  const primaryLabel = isParlay
    ? `${bet.legs.length}-leg Parlay`
    : bet.legs[0]?.selection ?? bet.type;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="rounded-xl overflow-hidden mb-2"
      style={{ background: '#1A1600', border: `1px solid ${colors.border}` }}
    >
      {/* Main row — tap to expand */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        style={{ background: 'none', border: 'none', cursor: 'pointer' }}
      >
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div
            className="flex items-center justify-center rounded-full flex-shrink-0"
            style={{ width: '28px', height: '28px', background: colors.bg, border: `1px solid ${colors.border}` }}
          >
            <Icon size={13} style={{ color: colors.text }} />
          </div>
          <div className="flex-1 min-w-0">
            <p style={{ color: 'white', fontSize: '13px', fontWeight: '600', lineHeight: 1.3 }} className="truncate">
              {primaryLabel}
            </p>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '10px' }}>
              {bet.type}{isParlay ? '' : ` · ${bet.legs[0]?.game ?? ''}`}
            </p>
          </div>
        </div>
        <div className="text-right flex-shrink-0 ml-3">
          {bet.status === 'won' && (
            <p style={{ color: '#66BB6A', fontSize: '14px', fontWeight: '800' }}>+${(bet.payout ?? 0).toFixed(2)}</p>
          )}
          {bet.status === 'lost' && (
            <p style={{ color: '#EF5350', fontSize: '14px', fontWeight: '800' }}>-${bet.stake.toFixed(2)}</p>
          )}
          {bet.status === 'pending' && (
            <p style={{ color: '#FFB300', fontSize: '14px', fontWeight: '800' }}>${bet.stake.toFixed(2)}</p>
          )}
          <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '10px', textTransform: 'capitalize' }}>
            {bet.status}
          </p>
        </div>
      </button>

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ borderTop: '1px solid rgba(255,213,79,0.08)', overflow: 'hidden' }}
          >
            <div className="px-4 py-3 space-y-1.5">
              {bet.legs.map((leg, i) => (
                <div key={leg.id} className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    {isParlay && (
                      <p style={{ color: 'rgba(255,179,0,0.6)', fontSize: '10px', fontWeight: '600' }}>Leg {i + 1}</p>
                    )}
                    <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '12px', fontWeight: '500' }}>{leg.selection}</p>
                    <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px' }}>{leg.type} · {leg.game}</p>
                  </div>
                  <span style={{ color: leg.odds.startsWith('+') ? '#66BB6A' : '#FFD54F', fontSize: '12px', fontWeight: '700', flexShrink: 0 }}>
                    {leg.odds}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-1.5 mt-1.5" style={{ borderTop: '1px solid rgba(255,213,79,0.06)' }}>
                <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px' }}>
                  Wagered ${bet.stake.toFixed(2)} · {isParlay ? `Combined ${bet.combinedOdds}` : `Odds ${bet.legs[0]?.odds ?? ''}`}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function PlayWallet() {
  const { placedBets, playWallet, displayName, user } = useApp();
  const [filter, setFilter] = useState<Filter>('all');

  const playerLabel = displayName ?? (user?.email ? user.email.split('@')[0] : 'My');

  const won    = placedBets.filter(b => b.status === 'won');
  const lost   = placedBets.filter(b => b.status === 'lost');
  const pending = placedBets.filter(b => b.status === 'pending');

  const totalWon  = won.reduce((s, b) => s + (b.payout ?? 0), 0);
  const totalLost = lost.reduce((s, b) => s + b.stake, 0);
  const netResult = totalWon - totalLost;

  const filtered = filter === 'all'
    ? [...pending, ...won, ...lost]   // pending first
    : placedBets.filter(b => b.status === filter);

  const filters: { key: Filter; label: string }[] = [
    { key: 'all',     label: `All (${placedBets.length})` },
    { key: 'pending', label: `Pending (${pending.length})` },
    { key: 'won',     label: `Won (${won.length})` },
    { key: 'lost',    label: `Lost (${lost.length})` },
  ];

  return (
    <MobileContainer>
      <div className="flex flex-col h-full">
        <WalletBar />

        <div className="flex-1 overflow-y-auto">
          <div className="px-5 pt-5 pb-3">
            {/* Header */}
            <div className="flex items-center gap-3 mb-5">
              <Link to="/hub">
                <div
                  className="flex items-center justify-center rounded-full"
                  style={{ width: '32px', height: '32px', background: 'rgba(255,213,79,0.08)', border: '1px solid rgba(255,213,79,0.15)' }}
                >
                  <ArrowLeft size={15} style={{ color: '#FFD54F' }} />
                </div>
              </Link>
              <div>
                <h1 style={{ fontSize: '22px', fontWeight: '800', color: 'white' }}>Play Wallet 💰</h1>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>{playerLabel} · March Madness 2026</p>
              </div>
            </div>

            {/* Hero balance */}
            <motion.div
              className="p-5 rounded-2xl mb-4 text-center relative overflow-hidden"
              style={{ background: '#1A1600', border: '1px solid rgba(255,213,79,0.2)' }}
            >
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(255,213,79,0.07) 0%, transparent 70%)' }}
              />
              <p style={{ color: 'rgba(255,213,79,0.5)', fontSize: '10px', fontWeight: '700', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>
                Available Balance
              </p>
              <motion.p
                key={playWallet}
                initial={{ scale: 1.05 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.3 }}
                style={{ fontSize: '38px', fontWeight: '800', color: '#FFD54F', textShadow: '0 0 20px rgba(255,213,79,0.3)', lineHeight: 1.1 }}
              >
                ${playWallet.toFixed(2)}
              </motion.p>
              {pending.length > 0 && (
                <p style={{ color: 'rgba(255,179,0,0.55)', fontSize: '11px', marginTop: '6px' }}>
                  {pending.length} bet{pending.length > 1 ? 's' : ''} pending · ${pending.reduce((s, b) => s + b.stake, 0).toFixed(2)} at risk
                </p>
              )}
            </motion.div>

            {/* Stats row */}
            {placedBets.length > 0 && (
              <div
                className="grid grid-cols-3 gap-2 mb-5"
              >
                {[
                  { label: 'Total Won', value: `+$${totalWon.toFixed(0)}`, color: '#66BB6A', icon: '📈' },
                  { label: 'Total Lost', value: `-$${totalLost.toFixed(0)}`, color: '#EF5350', icon: '📉' },
                  { label: 'Net P&L', value: `${netResult >= 0 ? '+' : ''}$${netResult.toFixed(0)}`, color: netResult >= 0 ? '#66BB6A' : '#EF5350', icon: netResult >= 0 ? '🟢' : '🔴' },
                ].map(stat => (
                  <div
                    key={stat.label}
                    className="p-3 rounded-xl text-center"
                    style={{ background: '#1A1600', border: '1px solid rgba(255,213,79,0.1)' }}
                  >
                    <p style={{ fontSize: '14px', marginBottom: '2px' }}>{stat.icon}</p>
                    <p style={{ color: stat.color, fontSize: '13px', fontWeight: '800' }}>{stat.value}</p>
                    <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{stat.label}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Filter pills */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide mb-4">
              {filters.map(f => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className="flex-shrink-0 px-3 py-1.5 rounded-full transition-all"
                  style={{
                    background: filter === f.key ? '#FFB300' : 'rgba(255,213,79,0.07)',
                    border: `1px solid ${filter === f.key ? '#FFB300' : 'rgba(255,213,79,0.15)'}`,
                    color: filter === f.key ? '#111111' : 'rgba(255,255,255,0.55)',
                    fontSize: '12px',
                    fontWeight: '700',
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Bet list */}
          <div className="px-5 pb-8">
            <AnimatePresence mode="wait">
              {filtered.length === 0 ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-16"
                >
                  <p style={{ fontSize: '36px', marginBottom: '12px' }}>💸</p>
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '15px' }}>
                    {placedBets.length === 0 ? 'No bets placed yet.' : `No ${filter} bets.`}
                  </p>
                  {placedBets.length === 0 && (
                    <Link to="/hub">
                      <p className="mt-3" style={{ color: '#FFB300', fontSize: '13px', fontWeight: '600' }}>
                        Head to the hub to start betting →
                      </p>
                    </Link>
                  )}
                </motion.div>
              ) : (
                <motion.div key={filter} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  {filtered.map((bet, idx) => (
                    <BetRow key={bet.id} bet={bet} index={idx} />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </MobileContainer>
  );
}
