import { useState } from 'react';
import { motion } from 'motion/react';
import { MobileContainer } from './MobileContainer';
import { WalletBar } from './WalletBar';
import { GlossButton } from './GlossButton';
import { MaizeBankCard } from './MaizeBankCard';
import { useApp } from '../context/AppContext';

export function InvestmentHouse() {
  const { groupBank } = useApp();
  const [converted, setConverted] = useState(false);
  const btcPrice = 65000;
  const projectedBTC = groupBank / btcPrice;

  const handleConversion = () => {
    setConverted(true);
  };

  return (
    <MobileContainer>
      <div className="flex flex-col h-full">
        <WalletBar />

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {/* Title */}
          <div className="text-center mb-6">
            <div style={{ fontSize: '40px', marginBottom: '8px' }}>🌽</div>
            <h1 style={{ fontSize: '26px', fontWeight: '800', color: 'white' }}>
              MaizeBank
            </h1>
            <p style={{ color: 'rgba(255,213,79,0.55)', fontSize: '13px', marginTop: '4px' }}>
              To be converted to Bitcoin for DraftHaus 2026
            </p>
          </div>

          {/* MaizeBank Growth Card */}
          <div className="mb-5">
            <MaizeBankCard />
          </div>

          {/* Bitcoin Conversion Card */}
          <motion.div
            animate={converted ? {
              boxShadow: ['0 4px 16px rgba(0,0,0,0.3)', '0 0 30px rgba(255,179,0,0.4)', '0 0 30px rgba(255,179,0,0.4)'],
              scale: [1, 1.02, 1],
            } : {}}
            transition={{ duration: 1 }}
            className="w-full p-5 rounded-2xl mb-5"
            style={{
              background: '#1A1600',
              border: converted
                ? '1px solid rgba(255,179,0,0.5)'
                : '1px solid rgba(255,213,79,0.12)',
            }}
          >
            <div className="text-center mb-4">
              <p className="mb-1" style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                ₿ Bitcoin Conversion Preview
              </p>
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)' }}>
                @ ${btcPrice.toLocaleString()} / BTC
              </p>
            </div>

            <div className="text-center">
              <motion.p
                animate={converted ? { scale: [1, 1.1, 1], opacity: [0.7, 1, 1] } : {}}
                transition={{ duration: 1, delay: 0.3 }}
                style={{
                  fontSize: '32px',
                  fontWeight: '800',
                  color: '#FFB300',
                  textShadow: converted ? '0 0 20px rgba(255,179,0,0.6)' : '0 0 15px rgba(255,179,0,0.25)',
                  fontFamily: 'monospace',
                  letterSpacing: '1px',
                }}
              >
                {projectedBTC.toFixed(6)} BTC
              </motion.p>
            </div>

            {converted && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="text-center mt-4 pt-4"
                style={{ borderTop: '1px solid rgba(255,179,0,0.15)' }}
              >
                <p style={{ color: '#FFB300', fontSize: '13px', fontWeight: '700' }}>
                  ✓ Converted at market price
                </p>
                <p style={{ color: 'rgba(255,179,0,0.6)', fontSize: '11px', marginTop: '2px' }}>
                  Ready for DraftHaus 2026
                </p>
              </motion.div>
            )}
          </motion.div>

          {/* Simulate Conversion Button */}
          {!converted && groupBank > 0 && (
            <div className="w-full mb-4">
              <button
                onClick={handleConversion}
                className="w-full py-3 px-6 rounded-xl transition-all active:scale-[0.98]"
                style={{
                  background: 'rgba(255,179,0,0.08)',
                  border: '1px solid rgba(255,213,79,0.3)',
                  color: '#FFD54F',
                  fontSize: '15px',
                  fontWeight: '700',
                  boxShadow: '0 0 20px rgba(255,179,0,0.15)',
                }}
              >
                Simulate Bitcoin Conversion
              </button>
            </div>
          )}

          {/* Info text */}
          <p
            className="text-center mb-5"
            style={{ color: 'rgba(255,255,255,0.35)', fontSize: '13px', lineHeight: '1.6', fontStyle: 'italic' }}
          >
            Losses convert to Bitcoin every Monday at market price.
          </p>

          {/* Back Button */}
          <div className="w-full">
            <GlossButton to="/hub" variant="ghost">
              Back to Betting
            </GlossButton>
          </div>
        </div>
      </div>
    </MobileContainer>
  );
}