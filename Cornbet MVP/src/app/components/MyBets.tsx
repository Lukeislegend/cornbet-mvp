import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router';
import { ArrowLeft, Clock, CheckCircle, XCircle } from 'lucide-react';
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

function BetCard({ bet, index }: { bet: PlacedBet; index: number }) {
  const colors = statusColors[bet.status];
  const Icon = statusIcons[bet.status];
  const isParlay = bet.type === 'Parlay';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="rounded-xl overflow-hidden mb-3"
      style={{ background: '#1A1600', border: `1px solid ${colors.border}` }}
    >
      {/* Header row */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid rgba(255,213,79,0.06)' }}
      >
        <div className="flex items-center gap-2">
          <span
            className="px-2 py-0.5 rounded-md"
            style={{ background: 'rgba(255,213,79,0.1)', color: '#FFD54F', fontSize: '10px', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase' }}
          >
            {bet.type}
          </span>
          {isParlay && (
            <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px' }}>
              {bet.legs.length} legs
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5" style={{ color: colors.text }}>
          <Icon size={13} />
          <span style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {bet.status}
          </span>
        </div>
      </div>

      {/* Legs */}
      <div className="px-4 py-3 space-y-2">
        {bet.legs.map((leg, i) => (
          <div key={leg.id} className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              {isParlay && (
                <p style={{ color: 'rgba(255,179,0,0.6)', fontSize: '10px', fontWeight: '600', marginBottom: '1px' }}>
                  Leg {i + 1}
                </p>
              )}
              <p style={{ color: 'white', fontSize: '13px', fontWeight: '600', lineHeight: '1.4' }}>
                {leg.selection}
              </p>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>
                {leg.type} · {leg.game}
              </p>
            </div>
            <span
              style={{
                color: leg.odds.startsWith('+') ? '#66BB6A' : '#FFD54F',
                fontSize: '13px',
                fontWeight: '700',
                flexShrink: 0,
              }}
            >
              {leg.odds}
            </span>
          </div>
        ))}
      </div>

      {/* Footer row */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderTop: '1px solid rgba(255,213,79,0.06)', background: 'rgba(0,0,0,0.2)' }}
      >
        <div className="flex items-center gap-4">
          <div>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Wager</p>
            <p style={{ color: 'white', fontSize: '13px', fontWeight: '700' }}>${bet.stake.toFixed(2)}</p>
          </div>
          {isParlay && (
            <div>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Combined</p>
              <p style={{ color: '#FFD54F', fontSize: '13px', fontWeight: '700' }}>{bet.combinedOdds}</p>
            </div>
          )}
        </div>
        <div className="text-right">
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {bet.status === 'won' ? 'Payout' : bet.status === 'lost' ? 'Result' : 'To Win'}
          </p>
          {bet.status === 'won' && (
            <p style={{ color: '#66BB6A', fontSize: '14px', fontWeight: '800' }}>
              +${(bet.payout ?? 0).toFixed(2)}
            </p>
          )}
          {bet.status === 'lost' && (
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '12px', fontStyle: 'italic' }}>
              → Corn Bank 🌽
            </p>
          )}
          {bet.status === 'pending' && (
            <p style={{ color: '#FFB300', fontSize: '13px', fontWeight: '700' }}>
              ${(bet.stake * parseFloat('1') || 0).toFixed(2)}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export function MyBets() {
  const { placedBets, displayName, user } = useApp();
  const [filter, setFilter] = useState<Filter>('all');

  const playerLabel = displayName
    ?? (user?.email ? user.email.split('@')[0] : 'My');

  const filtered = filter === 'all'
    ? placedBets
    : placedBets.filter(b => b.status === filter);

  const counts = {
    all:     placedBets.length,
    pending: placedBets.filter(b => b.status === 'pending').length,
    won:     placedBets.filter(b => b.status === 'won').length,
    lost:    placedBets.filter(b => b.status === 'lost').length,
  };

  const filters: { key: Filter; label: string }[] = [
    { key: 'all',     label: `All (${counts.all})`         },
    { key: 'pending', label: `Pending (${counts.pending})`  },
    { key: 'won',     label: `Won (${counts.won})`          },
    { key: 'lost',    label: `Lost (${counts.lost})`        },
  ];

  const totalWon   = placedBets.filter(b => b.status === 'won' ).reduce((s, b) => s + (b.payout ?? 0), 0);
  const totalLost  = placedBets.filter(b => b.status === 'lost').reduce((s, b) => s + b.stake, 0);
  const netResult  = totalWon - totalLost;

  return (
    <MobileContainer>
      <div className="flex flex-col h-full">
        <WalletBar />

        <div className="flex-1 overflow-y-auto">
          {/* Header */}
          <div className="px-5 pt-5 pb-3">
            <div className="flex items-center gap-3 mb-4">
              <Link to="/hub">
                <div
                  className="flex items-center justify-center rounded-full"
                  style={{ width: '32px', height: '32px', background: 'rgba(255,213,79,0.08)', border: '1px solid rgba(255,213,79,0.15)' }}
                >
                  <ArrowLeft size={15} style={{ color: '#FFD54F' }} />
                </div>
              </Link>
              <div>
                <h1 style={{ fontSize: '22px', fontWeight: '800', color: 'white' }}>My Bets 📋</h1>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>
                  {playerLabel} · March Madness 2026
                </p>
              </div>
            </div>

            {/* Summary row */}
            {placedBets.length > 0 && (
              <div
                className="flex gap-3 mb-4 p-3 rounded-xl"
                style={{ background: '#1A1600', border: '1px solid rgba(255,213,79,0.12)' }}
              >
                <div className="flex-1 text-center">
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Won</p>
                  <p style={{ color: '#66BB6A', fontSize: '15px', fontWeight: '800' }}>+${totalWon.toFixed(0)}</p>
                </div>
                <div style={{ width: '1px', background: 'rgba(255,213,79,0.1)' }} />
                <div className="flex-1 text-center">
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Lost</p>
                  <p style={{ color: '#EF5350', fontSize: '15px', fontWeight: '800' }}>-${totalLost.toFixed(0)}</p>
                </div>
                <div style={{ width: '1px', background: 'rgba(255,213,79,0.1)' }} />
                <div className="flex-1 text-center">
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Net</p>
                  <p style={{ color: netResult >= 0 ? '#66BB6A' : '#EF5350', fontSize: '15px', fontWeight: '800' }}>
                    {netResult >= 0 ? '+' : ''}${netResult.toFixed(0)}
                  </p>
                </div>
              </div>
            )}

            {/* Filter pills */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
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
                  <p style={{ fontSize: '36px', marginBottom: '12px' }}>🌽</p>
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
                  {[...filtered].reverse().map((bet, idx) => (
                    <BetCard key={bet.id} bet={bet} index={idx} />
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