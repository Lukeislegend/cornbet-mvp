import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle } from 'lucide-react';
import { useApp, calcPayout } from '../context/AppContext';
import { GlossButton } from './GlossButton';

interface BetSlipProps {
  isOpen: boolean;
  onClose: () => void;
  betType: string;
  selection: string;
  odds: string;
  game: string;
  team: string;
  lineId: string;
}

export function BetSlip({ isOpen, onClose, betType, selection, odds, game, team, lineId }: BetSlipProps) {
  const [stake, setStake] = useState('25');
  const [placing, setPlacing] = useState(false);
  const [betError, setBetError] = useState<string | null>(null);
  const { playWallet, addBet } = useApp();

  const stakeNum = parseFloat(stake) || 0;
  const potentialPayout = stakeNum > 0 ? calcPayout(stakeNum, odds) : 0;
  const isDisabled = stakeNum <= 0 || stakeNum > playWallet || placing;

  const handlePlaceBet = async () => {
    if (isDisabled) return;
    setBetError(null);
    setPlacing(true);
    try {
      await addBet({
        id: Date.now().toString(),
        type: betType,
        legs: [{ id: lineId, type: betType, selection, odds, game, team }],
        combinedOdds: odds,
        stake: stakeNum,
        status: 'pending',
        placedAt: Date.now(),
      });
      onClose();
      setStake('25');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to place bet. Please try again.';
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
            style={{ background: 'rgba(0,0,0,0.7)' }}
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
              border: '1px solid rgba(255,213,79,0.15)',
              borderBottom: 'none',
            }}
          >
            <div className="p-6">
              {/* Handle */}
              <div className="flex justify-center mb-4">
                <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'rgba(255,213,79,0.2)' }} />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <h2 style={{ fontSize: '20px', fontWeight: '700', color: 'white' }}>
                  Bet Slip 🌽
                </h2>
                <button onClick={onClose} style={{ color: 'rgba(255,255,255,0.5)', fontSize: '24px', lineHeight: 1 }}>×</button>
              </div>

              {/* Bet Details */}
              <div
                className="mb-5 p-4 rounded-xl space-y-3"
                style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,213,79,0.08)' }}
              >
                <div className="flex justify-between">
                  <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>Type</span>
                  <span style={{ color: 'white', fontSize: '13px', fontWeight: '600' }}>{betType}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>Selection</span>
                  <span style={{ color: 'white', fontSize: '13px', fontWeight: '600', maxWidth: '200px', textAlign: 'right' }}>
                    {selection}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>Odds</span>
                  <span style={{ color: '#FFD54F', fontSize: '14px', fontWeight: '700' }}>{odds}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>Game</span>
                  <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px' }}>{game}</span>
                </div>
              </div>

              {/* Stake Input */}
              <div className="mb-4">
                <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', display: 'block', marginBottom: '8px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                  Stake Amount
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
              {stakeNum > 0 && (
                <div
                  className="flex justify-between items-center mb-4 px-4 py-3 rounded-xl"
                  style={{ background: 'rgba(102,187,106,0.06)', border: '1px solid rgba(102,187,106,0.15)' }}
                >
                  <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>Potential payout</span>
                  <span style={{ color: '#66BB6A', fontSize: '15px', fontWeight: '700' }}>${potentialPayout.toFixed(2)}</span>
                </div>
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
              <p className="mb-5" style={{ color: 'rgba(255,213,79,0.45)', fontSize: '12px', textAlign: 'center', fontStyle: 'italic' }}>
                If this loses, the wager goes to the Group Bank 🌽
              </p>

              {/* Place Bet Button */}
              <div style={{ opacity: isDisabled ? 0.45 : 1, pointerEvents: isDisabled ? 'none' : 'auto' }}>
                <GlossButton onClick={handlePlaceBet}>
                  {placing ? 'Placing…' : 'Place Bet'}
                </GlossButton>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}