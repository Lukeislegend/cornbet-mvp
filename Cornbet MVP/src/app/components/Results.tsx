import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { MobileContainer } from './MobileContainer';
import { WalletBar } from './WalletBar';
import { GlossButton } from './GlossButton';
import { MaizeBankCard } from './MaizeBankCard';
import { useApp, resolveBetOutcome } from '../context/AppContext';
import type { PlacedBet } from '../context/AppContext';

interface FlyingCoin {
  id: number;
  startX: number;
  startY: number;
}

export function Results() {
  const { placedBets, resolveGameResults, gameResults, champion } = useApp();
  const [resolved, setResolved]     = useState(false);
  const [animating, setAnimating]   = useState(false);
  const [flyingCoins, setFlyingCoins] = useState<FlyingCoin[]>([]);
  const coinRef = useRef(0);
  const didResolve = useRef(false);

  const pendingBets  = placedBets.filter(b => b.status === 'pending');
  const resolvedBets = placedBets.filter(b => b.status !== 'pending');

  const launchCoins = (count: number) => {
    for (let i = 0; i < Math.min(count, 6); i++) {
      setTimeout(() => {
        const id = ++coinRef.current;
        const startX = 80 + Math.random() * 220;
        const startY = 300 + Math.random() * 100;
        setFlyingCoins(prev => [...prev, { id, startX, startY }]);
        setTimeout(() => setFlyingCoins(prev => prev.filter(c => c.id !== id)), 900);
      }, i * 140 + 200);
    }
  };

  useEffect(() => {
    if (!didResolve.current && pendingBets.length > 0) {
      didResolve.current = true;
      setAnimating(true);
      const timer = setTimeout(async () => {
        // Count losses before resolving (deterministic)
        const lossCount = pendingBets.filter(b => {
          const outcome = resolveBetOutcome(b, gameResults, champion);
          return outcome === 'lost';
        }).length;

        await resolveGameResults();
        setResolved(true);
        setAnimating(false);
        if (lossCount > 0) launchCoins(lossCount);
      }, 1400);
      return () => clearTimeout(timer);
    } else if (pendingBets.length === 0 && resolvedBets.length > 0) {
      setResolved(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const netWon  = placedBets.filter(b => b.status === 'won' ).reduce((s, b) => s + (b.payout ?? 0), 0);
  const netLost = placedBets.filter(b => b.status === 'lost').reduce((s, b) => s + b.stake, 0);
  const netResult = netWon - netLost;

  const getBetOutcomeLabel = (bet: PlacedBet) => resolveBetOutcome(bet, gameResults, champion);

  return (
    <MobileContainer>
      <div className="flex flex-col h-full">
        <WalletBar />

        <div className="flex-1 overflow-y-auto px-6 py-6">

          {/* Final Scores */}
          <div className="text-center mb-6">
            <p
              className="mb-3"
              style={{ fontSize: '11px', color: 'rgba(255,213,79,0.5)', fontWeight: '700', letterSpacing: '1.5px', textTransform: 'uppercase' }}
            >
              Elite Eight · Final Scores 🏀
            </p>

            {/* Game 1 */}
            <div
              className="flex justify-center gap-6 p-4 rounded-2xl mb-3"
              style={{ background: '#1A1600', border: '1px solid rgba(255,213,79,0.15)' }}
            >
              <div className="text-center">
                <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '12px', marginBottom: '4px' }}>Duke</p>
                <p style={{ color: '#FFD54F', fontSize: '36px', fontWeight: '800', textShadow: '0 0 15px rgba(255,213,79,0.3)' }}>78</p>
              </div>
              <div className="flex items-center">
                <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '18px' }}>—</span>
              </div>
              <div className="text-center">
                <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '12px', marginBottom: '4px' }}>Kansas</p>
                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '36px', fontWeight: '800' }}>71</p>
              </div>
            </div>

            {/* Game 2 */}
            <div
              className="flex justify-center gap-6 p-4 rounded-2xl"
              style={{ background: '#1A1600', border: '1px solid rgba(255,213,79,0.15)' }}
            >
              <div className="text-center">
                <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '12px', marginBottom: '4px' }}>Kentucky</p>
                <p style={{ color: '#FFD54F', fontSize: '36px', fontWeight: '800', textShadow: '0 0 15px rgba(255,213,79,0.3)' }}>82</p>
              </div>
              <div className="flex items-center">
                <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '18px' }}>—</span>
              </div>
              <div className="text-center">
                <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '12px', marginBottom: '4px' }}>UNC</p>
                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '36px', fontWeight: '800' }}>74</p>
              </div>
            </div>
          </div>

          {/* Resolving spinner */}
          <AnimatePresence>
            {animating && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-center py-8 mb-4"
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                  style={{ fontSize: '32px', display: 'inline-block', marginBottom: '12px' }}
                >
                  🏀
                </motion.div>
                <p style={{ color: 'rgba(255,213,79,0.7)', fontSize: '14px', fontWeight: '600' }}>
                  Resolving game results…
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Bet Results */}
          {!animating && placedBets.length > 0 && (
            <>
              <h2
                className="mb-3"
                style={{ fontSize: '13px', fontWeight: '700', color: 'rgba(255,213,79,0.6)', letterSpacing: '1px', textTransform: 'uppercase' }}
              >
                Your Bets ({placedBets.length})
              </h2>

              <div className="space-y-3 mb-6">
                {placedBets.map((bet, idx) => {
                  const isWin   = bet.status === 'won';
                  const isLoss  = bet.status === 'lost';
                  const pend    = bet.status === 'pending';

                  return (
                    <motion.div
                      key={bet.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{
                        opacity: 1,
                        y: 0,
                        boxShadow: resolved && isWin
                          ? '0 0 20px rgba(102,187,106,0.25)'
                          : '0 4px 16px rgba(0,0,0,0.3)',
                      }}
                      transition={{ delay: idx * 0.12, duration: 0.3 }}
                      className="p-4 rounded-xl"
                      style={{
                        background: '#1A1600',
                        border: pend
                          ? '1px solid rgba(255,213,79,0.1)'
                          : `1px solid ${isWin ? 'rgba(102,187,106,0.4)' : 'rgba(239,83,80,0.3)'}`,
                      }}
                    >
                      {/* Type badge + status */}
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className="px-2 py-0.5 rounded-md"
                          style={{ background: 'rgba(255,213,79,0.1)', color: '#FFD54F', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}
                        >
                          {bet.type}{bet.type === 'Parlay' ? ` · ${bet.legs.length} legs` : ''}
                        </span>
                        {!pend && (
                          <motion.span
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: idx * 0.12 + 0.4 }}
                            className="px-3 py-1 rounded-full"
                            style={{
                              background: isWin ? 'rgba(102,187,106,0.15)' : 'rgba(239,83,80,0.15)',
                              color: isWin ? '#66BB6A' : '#EF5350',
                              fontSize: '11px',
                              fontWeight: '800',
                              letterSpacing: '0.5px',
                            }}
                          >
                            {isWin ? 'WIN ✓' : 'LOSS'}
                          </motion.span>
                        )}
                        {pend && (
                          <span style={{ color: '#FFB300', fontSize: '11px', fontWeight: '600' }}>⏳ Futures</span>
                        )}
                      </div>

                      {/* Legs */}
                      {bet.legs.map((leg, li) => (
                        <div key={leg.id} className="mb-1">
                          {bet.type === 'Parlay' && (
                            <p style={{ color: 'rgba(255,179,0,0.5)', fontSize: '10px', fontWeight: '600' }}>Leg {li + 1}</p>
                          )}
                          <p style={{ color: 'white', fontSize: '13px', fontWeight: '600' }}>{leg.selection}</p>
                          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px' }}>
                            {leg.type} · {leg.odds}
                          </p>
                        </div>
                      ))}

                      {/* Footer */}
                      <div className="flex justify-between items-center mt-2 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>
                          Stake: ${bet.stake.toFixed(2)}
                        </span>
                        {isWin && (
                          <motion.span
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: idx * 0.12 + 0.6 }}
                            style={{ color: '#66BB6A', fontSize: '15px', fontWeight: '700' }}
                          >
                            +${(bet.payout ?? 0).toFixed(2)}
                          </motion.span>
                        )}
                        {isLoss && (
                          <motion.span
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: idx * 0.12 + 0.6 }}
                            style={{ color: 'rgba(249,168,37,0.6)', fontSize: '11px', fontStyle: 'italic' }}
                          >
                            → Group Bank 🌽
                          </motion.span>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Summary */}
              {resolved && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 }}
                  className="text-center mb-6 p-6 rounded-2xl"
                  style={{
                    background: netResult >= 0 ? 'rgba(102,187,106,0.07)' : 'rgba(255,179,0,0.07)',
                    border: netResult >= 0 ? '1px solid rgba(102,187,106,0.2)' : '1px solid rgba(255,179,0,0.2)',
                  }}
                >
                  <p className="mb-2" style={{ fontSize: '20px', fontWeight: '700', color: 'white' }}>
                    {netResult >= 0 ? '🎉 You came out ahead!' : '🌽 Your loss feeds the Group Bank.'}
                  </p>
                  <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '14px' }}>
                    Net: {netResult >= 0 ? '+' : ''}${netResult.toFixed(2)}
                  </p>
                </motion.div>
              )}

              {/* MaizeBank growth card after resolution */}
              {resolved && netLost > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.1 }}
                  className="mb-5"
                >
                  <p
                    className="mb-2"
                    style={{ color: 'rgba(255,213,79,0.5)', fontSize: '11px', fontWeight: '700', letterSpacing: '1px', textTransform: 'uppercase' }}
                  >
                    MaizeBank Updated
                  </p>
                  <MaizeBankCard showCoinBurst={false} />
                </motion.div>
              )}
            </>
          )}

          {/* Empty state */}
          {placedBets.length === 0 && (
            <div className="text-center py-12">
              <p style={{ fontSize: '40px', marginBottom: '12px' }}>🌽</p>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '15px' }}>No bets placed yet.</p>
            </div>
          )}

          {/* Action buttons */}
          <div className="space-y-3">
            <Link to="/my-bets" className="block">
              <button
                className="w-full py-3 px-6 rounded-xl transition-all active:scale-[0.98]"
                style={{ background: 'rgba(255,179,0,0.08)', border: '1px solid rgba(255,213,79,0.25)', color: '#FFD54F', fontSize: '15px', fontWeight: '700' }}
              >
                View All Bets 📋
              </button>
            </Link>
            <GlossButton to="/investment-house">
              View Group Bank 🌽
            </GlossButton>
            <GlossButton to="/hub" variant="ghost">
              Back to Betting
            </GlossButton>
          </div>
        </div>
      </div>

      {/* Flying coins overlay */}
      <AnimatePresence>
        {flyingCoins.map(coin => (
          <motion.div
            key={coin.id}
            initial={{ opacity: 1, scale: 1.3, x: coin.startX, y: coin.startY }}
            animate={{ opacity: 0, scale: 0.6, x: coin.startX + (Math.random() > 0.5 ? 20 : -20), y: 48 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
            style={{ position: 'fixed', fontSize: '20px', pointerEvents: 'none', zIndex: 99, top: 0, left: 0 }}
          >
            🌽
          </motion.div>
        ))}
      </AnimatePresence>
    </MobileContainer>
  );
}