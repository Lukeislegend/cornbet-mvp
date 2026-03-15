import { MobileContainer } from './MobileContainer';
import { WalletBar } from './WalletBar';
import { GlossButton } from './GlossButton';
import { useApp } from '../context/AppContext';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';

export function Performance() {
  const { placedBets, playWallet, groupBank } = useApp();

  const totalWinnings = placedBets
    .filter(bet => bet.status === 'won')
    .reduce((sum, bet) => sum + (bet.payout ?? 0), 0);

  const totalLosses = placedBets
    .filter(bet => bet.status === 'lost')
    .reduce((sum, bet) => sum + bet.stake, 0);

  const netChange = playWallet - 500; // Initial was $500

  const graphData = [
    { session: '0', net: 0 },
    { session: '1', net: netChange },
  ];

  return (
    <MobileContainer>
      <div className="flex flex-col h-full">
        <WalletBar />

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {/* Header */}
          <div className="text-center mb-6">
            <h1
              style={{
                fontSize: '24px',
                fontWeight: '800',
                color: 'white',
              }}
            >
              Performance 📊
            </h1>
            <p style={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '13px', marginTop: '4px' }}>
              Group: DraftHaus · March Madness 2026
            </p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div
              className="p-4 rounded-xl"
              style={{
                background: '#1A1600',
                border: '1px solid rgba(102, 187, 106, 0.15)',
              }}
            >
              <p
                className="mb-2"
                style={{
                  fontSize: '10px',
                  color: 'rgba(255, 255, 255, 0.45)',
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase',
                }}
              >
                Total Winnings
              </p>
              <p
                style={{
                  fontSize: '20px',
                  fontWeight: '700',
                  color: '#66BB6A',
                }}
              >
                ${totalWinnings.toFixed(2)}
              </p>
            </div>

            <div
              className="p-4 rounded-xl"
              style={{
                background: '#1A1600',
                border: '1px solid rgba(239, 83, 80, 0.15)',
              }}
            >
              <p
                className="mb-2"
                style={{
                  fontSize: '10px',
                  color: 'rgba(255, 255, 255, 0.45)',
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase',
                }}
              >
                Total Losses
              </p>
              <p
                style={{
                  fontSize: '20px',
                  fontWeight: '700',
                  color: '#EF5350',
                }}
              >
                ${totalLosses.toFixed(2)}
              </p>
            </div>

            <div
              className="p-4 rounded-xl"
              style={{
                background: '#1A1600',
                border: `1px solid ${netChange >= 0 ? 'rgba(102, 187, 106, 0.15)' : 'rgba(239, 83, 80, 0.15)'}`,
              }}
            >
              <p
                className="mb-2"
                style={{
                  fontSize: '10px',
                  color: 'rgba(255, 255, 255, 0.45)',
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase',
                }}
              >
                Net Change
              </p>
              <p
                style={{
                  fontSize: '20px',
                  fontWeight: '700',
                  color: netChange >= 0 ? '#66BB6A' : '#EF5350',
                }}
              >
                {netChange >= 0 ? '+' : ''}${netChange.toFixed(2)}
              </p>
            </div>

            <div
              className="p-4 rounded-xl"
              style={{
                background: '#1A1600',
                border: '1px solid rgba(255, 213, 79, 0.15)',
              }}
            >
              <p
                className="mb-2"
                style={{
                  fontSize: '10px',
                  color: 'rgba(255, 255, 255, 0.45)',
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase',
                }}
              >
                Group Bank 🌽
              </p>
              <p
                style={{
                  fontSize: '20px',
                  fontWeight: '700',
                  color: '#FFD54F',
                }}
              >
                ${groupBank.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Graph */}
          <div
            className="p-4 rounded-xl mb-5"
            style={{
              background: '#1A1600',
              border: '1px solid rgba(255, 213, 79, 0.1)',
              height: '180px',
            }}
          >
            <p style={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '11px', marginBottom: '8px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              Balance Trend
            </p>
            <ResponsiveContainer width="100%" height="85%">
              <LineChart data={graphData}>
                <XAxis
                  dataKey="session"
                  stroke="rgba(255, 255, 255, 0.15)"
                  style={{ fontSize: '11px', fill: 'rgba(255,255,255,0.4)' }}
                />
                <YAxis
                  stroke="rgba(255, 255, 255, 0.15)"
                  style={{ fontSize: '11px', fill: 'rgba(255,255,255,0.4)' }}
                />
                <Tooltip
                  contentStyle={{
                    background: '#1A1600',
                    border: '1px solid rgba(255, 213, 79, 0.2)',
                    borderRadius: '8px',
                    color: '#FFD54F',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="net"
                  stroke="#FFB300"
                  strokeWidth={2.5}
                  dot={{ fill: '#FFD54F', r: 5, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Quote */}
          <p
            className="text-center mb-4"
            style={{
              color: 'rgba(255, 255, 255, 0.3)',
              fontSize: '13px',
              lineHeight: '1.6',
              fontStyle: 'italic',
            }}
          >
            Friendly competition. Shared stakes.{'\n'}The Group Bank grows together.
          </p>

          {/* Back Button */}
          <GlossButton to="/hub" variant="ghost">
            Back to Betting
          </GlossButton>
        </div>
      </div>
    </MobileContainer>
  );
}