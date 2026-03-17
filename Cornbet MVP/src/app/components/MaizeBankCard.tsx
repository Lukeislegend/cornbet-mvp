import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../context/AppContext';

const STARTING_VALUE = 1000;
const GOAL_VALUE     = 5000;

interface CoinBurst {
  id: number;
  x: number;
  y: number;
}

interface MaizeBankCardProps {
  /** Set true from Results page to trigger coin burst animation on mount */
  showCoinBurst?: boolean;
  /** Number of coins to burst (one per lost bet) */
  coinCount?: number;
  compact?: boolean;
}

export function MaizeBankCard({ showCoinBurst = false, coinCount = 1, compact = false }: MaizeBankCardProps) {
  const { groupBank } = useApp();
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const [coins, setCoins] = useState<CoinBurst[]>([]);
  const coinIdRef = useRef(0);
  const cardRef   = useRef<HTMLDivElement>(null);

  const growth        = Math.max(0, groupBank - STARTING_VALUE);
  const growthPct     = ((growth / STARTING_VALUE) * 100).toFixed(1);
  const fillPct       = Math.min(((groupBank - STARTING_VALUE) / (GOAL_VALUE - STARTING_VALUE)) * 100, 100);
  const hasGrown      = groupBank > STARTING_VALUE;

  // Trigger a coin burst (called externally via ref or from parent effect)
  const triggerCoin = () => {
    const id = ++coinIdRef.current;
    setCoins(prev => [...prev, { id, x: Math.random() * 60 - 30, y: 0 }]);
    setTimeout(() => setCoins(prev => prev.filter(c => c.id !== id)), 1200);
  };

  // Auto-trigger if showCoinBurst prop is true
  if (showCoinBurst && coinCount > 0 && coins.length === 0) {
    for (let i = 0; i < Math.min(coinCount, 5); i++) {
      setTimeout(() => triggerCoin(), i * 180);
    }
  }

  return (
    <div ref={cardRef} className="relative">
      <motion.div
        layout
        className="p-4 rounded-2xl relative overflow-hidden"
        style={{
          background: '#1A1600',
          border: `1px solid ${hasGrown ? 'rgba(255,213,79,0.3)' : 'rgba(255,213,79,0.15)'}`,
        }}
        animate={hasGrown ? {
          boxShadow: [
            '0 0 0px rgba(255,179,0,0)',
            '0 0 18px rgba(255,179,0,0.18)',
            '0 0 0px rgba(255,179,0,0)',
          ],
        } : {}}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        onClick={() => setTooltipOpen(v => !v)}
      >
        {/* Subtle background gleam */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at 50% 0%, rgba(255,213,79,0.06) 0%, transparent 70%)',
          }}
        />

        {/* Top row */}
        <div className="flex items-start justify-between mb-3 relative">
          <div>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
              MaizeBank 🌽
            </p>
            <motion.p
              key={groupBank}
              initial={{ scale: 1.06, color: '#FFD54F' }}
              animate={{ scale: 1,    color: '#FFD54F' }}
              transition={{ duration: 0.4 }}
              style={{ fontSize: compact ? '26px' : '30px', fontWeight: '800', lineHeight: 1.1, textShadow: '0 0 14px rgba(255,213,79,0.25)' }}
            >
              ${groupBank.toFixed(2)}
            </motion.p>
          </div>

          <div className="text-right">
            {hasGrown && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="px-2 py-0.5 rounded-full inline-block"
                style={{ background: 'rgba(255,179,0,0.15)', border: '1px solid rgba(255,213,79,0.3)' }}
              >
                <span style={{ color: '#FFD54F', fontSize: '12px', fontWeight: '800' }}>
                  +{growthPct}%
                </span>
              </motion.div>
            )}
            <p style={{ color: 'rgba(249,168,37,0.6)', fontSize: '11px', marginTop: '4px', fontWeight: '600' }}>
              ₿ Bitcoin pool
            </p>
          </div>
        </div>

        {/* Growth Meter */}
        <div className="mb-3">
          <div className="flex justify-between mb-1.5">
            <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '10px' }}>
              Start: $1,000
            </span>
            <span style={{ color: hasGrown ? 'rgba(255,213,79,0.7)' : 'rgba(255,255,255,0.3)', fontSize: '10px', fontWeight: hasGrown ? '600' : '400' }}>
              {hasGrown ? `+$${growth.toFixed(0)} from losses` : 'No growth yet'}
            </span>
          </div>

          {/* Track */}
          <div
            className="w-full rounded-full relative overflow-hidden"
            style={{ background: 'rgba(255,213,79,0.08)', height: '8px' }}
          >
            {/* Animated fill */}
            <motion.div
              key={groupBank}
              initial={{ width: `${Math.max(0, fillPct - 4)}%` }}
              animate={{ width: `${fillPct}%` }}
              transition={{ duration: 0.9, ease: [0.34, 1.56, 0.64, 1] }}
              className="h-full rounded-full relative"
              style={{
                background: 'linear-gradient(90deg, #FFB300 0%, #FFD54F 60%, #FFF176 100%)',
                boxShadow: fillPct > 0 ? '0 0 10px rgba(255,179,0,0.55), 0 0 3px rgba(255,213,79,0.4)' : 'none',
              }}
            >
              {/* Shimmer */}
              {fillPct > 5 && (
                <motion.div
                  className="absolute inset-0 rounded-full"
                  animate={{ x: ['-100%', '200%'] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: 'linear', repeatDelay: 1.5 }}
                  style={{
                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)',
                    width: '40%',
                  }}
                />
              )}
            </motion.div>
          </div>

          <div className="flex justify-between mt-1">
            <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px' }}>
              Every loss feeds the MaizeBank.
            </span>
            <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '10px' }}>
              Goal: $5,000
            </span>
          </div>
        </div>

        {/* Tap hint */}
        <p style={{ color: 'rgba(255,213,79,0.3)', fontSize: '10px', textAlign: 'center' }}>
          Tap for details
        </p>

        {/* Coin burst animations */}
        <AnimatePresence>
          {coins.map(coin => (
            <motion.div
              key={coin.id}
              initial={{ opacity: 1, scale: 1.4, y: 0, x: coin.x }}
              animate={{ opacity: 0, scale: 0.7, y: -55, x: coin.x + (Math.random() > 0.5 ? 18 : -18) }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.85, ease: 'easeOut' }}
              style={{
                position: 'absolute',
                bottom: '28px',
                left: '50%',
                fontSize: '18px',
                pointerEvents: 'none',
                zIndex: 20,
              }}
            >
              🌽
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>

      {/* Tooltip */}
      <AnimatePresence>
        {tooltipOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-30"
              onClick={() => setTooltipOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.96 }}
              transition={{ duration: 0.18 }}
              className="absolute left-0 right-0 z-40 mt-2 p-4 rounded-2xl"
              style={{
                background: '#221900',
                border: '1px solid rgba(255,213,79,0.3)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
              }}
            >
              <p style={{ color: '#FFD54F', fontSize: '13px', fontWeight: '800', marginBottom: '10px', letterSpacing: '0.3px' }}>
                MaizeBank Growth 🌽
              </p>
              <div className="space-y-2 mb-3">
                {[
                  ['Starting', `$${STARTING_VALUE.toLocaleString()}`],
                  ['Current',  `$${groupBank.toFixed(2)}`],
                  ['Increase', hasGrown ? `+${growthPct}%` : '0%'],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between">
                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>{label}</span>
                    <span style={{ color: 'white', fontSize: '13px', fontWeight: '700' }}>{value}</span>
                  </div>
                ))}
              </div>
              <p style={{ color: 'rgba(255,179,0,0.55)', fontSize: '11px', lineHeight: '1.5', fontStyle: 'italic' }}>
                This bank will be converted to Bitcoin for DraftHaus 2026.
              </p>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
