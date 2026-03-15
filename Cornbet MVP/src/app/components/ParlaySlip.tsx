import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, AlertCircle } from 'lucide-react';
import { useApp, calcCombinedOdds, calcPayout } from '../context/AppContext';
import { GlossButton } from './GlossButton';
import type { BetLeg } from '../context/AppContext';

interface ParlaySlipProps {
  isOpen: boolean;
  onClose: () => void;
  legs: BetLeg[];
  onRemoveLeg: (id: string) => void;
}

export function ParlaySlip({ isOpen, onClose, legs, onRemoveLeg }: ParlaySlipProps) {
  const [stake, setStake] = useState('25');
  const [placing, setPlacing] = useState(false);
  const [betError, setBetError] = useState<string | null>(null);
  const { playWallet, addBet } = useApp();

  const stakeNum = parseFloat(stake) || 0;
  const combinedOdds = calcCombinedOdds(legs.map(l => l.odds));
  const potentialPayout = stakeNum > 0 ? calcPayout(stakeNum, combinedOdds) : 0;
  const isDisabled = legs.length < 2 || stakeNum <= 0 || stakeNum > playWallet || placing;

  const handlePlaceParlay = async () => {
    if (isDisabled) return;
    setBetError(null);
    setPlacing(true);
    try {
      await addBet({
        id: Date.now().toString(),
        type: 'Parlay',
        legs: [...legs],
        combinedOdds,
        stake: stakeNum,
        status: 'pending',
        placedAt: Date.now(),
      });
      onClose();
      setStake('25');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to place parlay. Please try again.';
      setBetError(msg);
    } finally {
      setPlacing(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(0,0,0,0.75)' }}
          />

          {/* Bottom Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl overflow-hidden"
            style={{
              background: '#1A1600',
              maxWidth: '393px',
              margin: '0 auto',
              border: '1px solid rgba(255,213,79,0.2)',
              borderBottom: 'none',
              maxHeight: '85vh',
              overflowY: 'auto',
            }}
          >
            <div className="p-6">
              {/* Handle */}
              <div className="flex justify-center mb-4">
                <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'rgba(255,213,79,0.2)' }} />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between mb-2">
                <h2 style={{ fontSize: '20px', fontWeight: '700', color: 'white' }}>
                  Parlay Slip 🏀
                </h2>
                <button onClick={onClose} style={{ color: 'rgba(255,255,255,0.5)', fontSize: '24px', lineHeight: 1 }}>×</button>
              </div>
              <p className="mb-5" style={{ color: 'rgba(255,213,79,0.5)', fontSize: '12px' }}>
                {legs.length} leg{legs.length !== 1 ? 's' : ''} · minimum 2 required
              </p>

              {/* Legs */}
              <div className="space-y-2 mb-5">
                {legs.map((leg, idx) => (
                  <motion.div
                    key={leg.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ delay: idx * 0.05 }}
                    className="flex items-center gap-3 p-3 rounded-xl"
                    style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,213,79,0.08)' }}
                  >
                    <div
                      className="flex-shrink-0 flex items-center justify-center rounded-full"
                      style={{ width: '22px', height: '22px', background: 'rgba(255,179,0,0.15)', color: '#FFB300', fontSize: '11px', fontWeight: '700' }}
                    >
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p style={{ color: 'white', fontSize: '13px', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {leg.selection}
                      </p>
                      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>
                        {leg.type} · {leg.game}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        style={{
                          color: leg.odds.startsWith('+') ? '#66BB6A' : '#FFD54F',
                          fontSize: '13px',
                          fontWeight: '700',
                        }}
                      >
                        {leg.odds}
                      </span>
                      <button
                        onClick={() => onRemoveLeg(leg.id)}
                        className="flex items-center justify-center rounded-full"
                        style={{ width: '20px', height: '20px', background: 'rgba(239,83,80,0.15)', color: '#EF5350' }}
                      >
                        <X size={11} />
                      </button>
                    </div>
                  </motion.div>
                ))}

                {legs.length === 0 && (
                  <div
                    className="text-center py-8 rounded-xl"
                    style={{ border: '1px dashed rgba(255,213,79,0.15)' }}
                  >
                    <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>
                      No legs added yet — tap a betting line
                    </p>
                  </div>
                )}
              </div>

              {/* Combined Odds */}
              {legs.length >= 2 && (
                <div
                  className="flex justify-between items-center mb-4 px-4 py-3 rounded-xl"
                  style={{ background: 'rgba(255,179,0,0.07)', border: '1px solid rgba(255,213,79,0.2)' }}
                >
                  <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: '13px' }}>Combined Odds</span>
                  <span style={{ color: '#FFD54F', fontSize: '16px', fontWeight: '800' }}>{combinedOdds}</span>
                </div>
              )}

              {/* Stake Input */}
              <div className="mb-4">
                <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', display: 'block', marginBottom: '8px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                  Wager
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: '#FFD54F', fontSize: '18px', fontWeight: '700' }}>$</span>
                  <input
                    type="number"
                    value={stake}
                    onChange={e => { setStake(e.target.value); setBetError(null); }}
                    className="w-full pl-8 pr-4 py-3 rounded-xl"
                    style={{ background: 'rgba(0,0,0,0.4)', border: `1px solid ${betError ? 'rgba(239,83,80,0.4)' : 'rgba(255,213,79,0.2)'}`, color: 'white', fontSize: '18px', fontWeight: '700' }}
                  />
                </div>
                <p className="mt-2" style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px' }}>
                  Available: ${playWallet.toFixed(2)}
                </p>
              </div>

              {/* Potential Payout */}
              {stakeNum > 0 && legs.length >= 2 && (
                <div
                  className="flex justify-between items-center mb-4 px-4 py-3 rounded-xl"
                  style={{ background: 'rgba(102,187,106,0.06)', border: '1px solid rgba(102,187,106,0.15)' }}
                >
                  <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>Potential Payout</span>
                  <span style={{ color: '#66BB6A', fontSize: '16px', fontWeight: '800' }}>${potentialPayout.toFixed(2)}</span>
                </div>
              )}

              {legs.length < 2 && (
                <p className="mb-4 text-center" style={{ color: 'rgba(239,83,80,0.6)', fontSize: '12px', fontStyle: 'italic' }}>
                  Add at least 2 legs to place a parlay
                </p>
              )}

              {/* Validation / server error */}
              <AnimatePresence>
                {betError && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="flex items-start gap-2 mb-4 px-3 py-3 rounded-xl"
                    style={{ background: 'rgba(239,83,80,0.1)', border: '1px solid rgba(239,83,80,0.3)' }}
                  >
                    <AlertCircle size={13} style={{ color: 'rgba(239,83,80,0.8)', flexShrink: 0, marginTop: '1px' }} />
                    <p style={{ fontSize: '12px', color: 'rgba(239,83,80,0.85)', lineHeight: '1.4' }}>{betError}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Group Bank note */}
              <p className="mb-5" style={{ color: 'rgba(255,213,79,0.4)', fontSize: '12px', textAlign: 'center', fontStyle: 'italic' }}>
                All legs must win. A loss sends the wager to Group Bank 🌽
              </p>

              <div style={{ opacity: isDisabled ? 0.45 : 1, pointerEvents: isDisabled ? 'none' : 'auto' }}>
                <GlossButton onClick={handlePlaceParlay}>
                  {placing ? 'Placing…' : `Place Parlay (${legs.length} legs)`}
                </GlossButton>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}