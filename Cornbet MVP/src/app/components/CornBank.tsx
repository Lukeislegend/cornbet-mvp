import { motion } from 'motion/react';
import { Link } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { MobileContainer } from './MobileContainer';
import { WalletBar } from './WalletBar';
import { MaizeBankCard } from './MaizeBankCard';
import { useApp } from '../context/AppContext';

const STARTING_VALUE = 1000;
const GOAL_VALUE = 5000;

export function CornBank() {
  const { groupBank, placedBets } = useApp();

  const lostBets = placedBets.filter(b => b.status === 'lost');
  const totalContributed = lostBets.reduce((s, b) => s + b.stake, 0);
  const fillPct = Math.min(Math.max(0, ((groupBank - STARTING_VALUE) / (GOAL_VALUE - STARTING_VALUE)) * 100), 100);

  const milestones = [
    { label: 'Seed Money',       target: 1000, emoji: '🌱' },
    { label: '25% to Goal',      target: 2000, emoji: '🌽' },
    { label: 'Halfway There',    target: 3000, emoji: '🔥' },
    { label: '75% to Goal',      target: 4000, emoji: '⚡' },
    { label: 'DraftHaus Ready',  target: 5000, emoji: '₿' },
  ];

  return (
    <MobileContainer>
      <div className="flex flex-col h-full">
        <WalletBar />

        <div className="flex-1 overflow-y-auto">
          <div className="px-5 pt-5 pb-8">
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
                <h1 style={{ fontSize: '22px', fontWeight: '800', color: 'white' }}>Corn Bank 🌽</h1>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>DraftHaus Progress · March Madness 2026</p>
              </div>
            </div>

            {/* Hero — MaizeBankCard */}
            <div className="mb-5">
              <MaizeBankCard />
            </div>

            {/* How it works */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="p-4 rounded-2xl mb-4"
              style={{ background: '#1A1600', border: '1px solid rgba(255,213,79,0.12)' }}
            >
              <p style={{ color: '#FFD54F', fontSize: '13px', fontWeight: '800', marginBottom: '10px', letterSpacing: '0.3px' }}>
                How the Corn Bank Works
              </p>
              <div className="space-y-3">
                {[
                  { emoji: '💸', text: 'Every bet you lose, your stake goes into the Corn Bank.' },
                  { emoji: '🌽', text: 'The bank grows all season as the group racks up L\'s.' },
                  { emoji: '₿', text: 'At the end of DraftHaus 2026, the pot converts to Bitcoin and gets distributed.' },
                  { emoji: '🏆', text: 'The more you play, the bigger the prize pool for everyone.' },
                ].map(({ emoji, text }) => (
                  <div key={text} className="flex items-start gap-3">
                    <span style={{ fontSize: '16px', flexShrink: 0 }}>{emoji}</span>
                    <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', lineHeight: '1.5' }}>{text}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* This season's contributions */}
            {lostBets.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.22 }}
                className="p-4 rounded-2xl mb-4"
                style={{ background: '#1A1600', border: '1px solid rgba(255,213,79,0.12)' }}
              >
                <div className="flex items-center justify-between mb-3">
                  <p style={{ color: '#FFD54F', fontSize: '13px', fontWeight: '800', letterSpacing: '0.3px' }}>
                    Your Contributions
                  </p>
                  <span
                    className="px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(255,179,0,0.12)', border: '1px solid rgba(255,179,0,0.25)', color: '#FFB300', fontSize: '11px', fontWeight: '700' }}
                  >
                    ${totalContributed.toFixed(2)} total
                  </span>
                </div>
                <div className="space-y-1.5">
                  {lostBets.slice(-5).reverse().map((bet, i) => (
                    <motion.div
                      key={bet.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center justify-between py-1.5"
                      style={{ borderBottom: '1px solid rgba(255,213,79,0.06)' }}
                    >
                      <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '12px' }} className="truncate flex-1 mr-2">
                        {bet.type === 'Parlay' ? `${bet.legs.length}-leg Parlay` : bet.legs[0]?.selection ?? bet.type}
                      </p>
                      <p style={{ color: '#EF5350', fontSize: '12px', fontWeight: '700', flexShrink: 0 }}>
                        -${bet.stake.toFixed(2)}
                      </p>
                    </motion.div>
                  ))}
                  {lostBets.length > 5 && (
                    <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '11px', textAlign: 'center', paddingTop: '4px' }}>
                      +{lostBets.length - 5} more contributions
                    </p>
                  )}
                </div>
              </motion.div>
            )}

            {/* Milestone tracker */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="p-4 rounded-2xl"
              style={{ background: '#1A1600', border: '1px solid rgba(255,213,79,0.12)' }}
            >
              <p style={{ color: '#FFD54F', fontSize: '13px', fontWeight: '800', marginBottom: '12px', letterSpacing: '0.3px' }}>
                Milestones
              </p>
              <div className="space-y-3">
                {milestones.map(({ label, target, emoji }) => {
                  const reached = groupBank >= target;
                  const isCurrent = !reached && groupBank < target &&
                    (milestones.findIndex(m => m.target === target) === 0 ||
                     groupBank >= milestones[milestones.findIndex(m => m.target === target) - 1].target);
                  return (
                    <div key={label} className="flex items-center gap-3">
                      <span style={{ fontSize: '16px', opacity: reached ? 1 : 0.3 }}>{emoji}</span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p style={{
                            color: reached ? 'white' : isCurrent ? '#FFD54F' : 'rgba(255,255,255,0.3)',
                            fontSize: '12px',
                            fontWeight: reached || isCurrent ? '700' : '400',
                          }}>
                            {label}
                          </p>
                          <p style={{ color: reached ? '#66BB6A' : 'rgba(255,255,255,0.25)', fontSize: '11px', fontWeight: '600' }}>
                            ${target.toLocaleString()}
                          </p>
                        </div>
                        {isCurrent && (
                          <div className="mt-1 rounded-full overflow-hidden" style={{ height: '3px', background: 'rgba(255,213,79,0.1)' }}>
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${fillPct}%` }}
                              transition={{ duration: 1, ease: 'easeOut' }}
                              className="h-full rounded-full"
                              style={{ background: 'linear-gradient(90deg, #FFB300, #FFD54F)' }}
                            />
                          </div>
                        )}
                        {reached && (
                          <p style={{ color: 'rgba(102,187,106,0.7)', fontSize: '10px' }}>✓ Reached</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </MobileContainer>
  );
}
