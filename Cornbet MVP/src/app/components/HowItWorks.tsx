import { MobileContainer } from './MobileContainer';
import { GlossButton } from './GlossButton';
import { InfoCard, HighlightText } from './InfoCard';

export function HowItWorks() {
  return (
    <MobileContainer>
      <div className="flex flex-col h-full px-8 py-12">
        {/* Header */}
        <div className="text-center mb-2">
          <span style={{ fontSize: '32px' }}>🌽</span>
        </div>
        <h1
          className="mb-2 text-center"
          style={{
            fontSize: '26px',
            fontWeight: '800',
            color: 'white',
          }}
        >
          How CornBet Works
        </h1>
        <p
          className="text-center mb-8"
          style={{
            color: 'rgba(255, 255, 255, 0.45)',
            fontSize: '14px',
          }}
        >
          Group: DraftHaus · March Madness 2026
        </p>

        {/* Cards */}
        <div className="flex-1 space-y-4">
          <InfoCard accentColor="#FFD54F">
            <p style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '15px', lineHeight: '1.5' }}>
              🏀 Bet on{' '}
              <HighlightText color="#FFD54F">March Madness</HighlightText>{' '}
              games using real pregame odds
            </p>
          </InfoCard>

          <InfoCard accentColor="#FFB300">
            <p style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '15px', lineHeight: '1.5' }}>
              ✅ Winnings → back to your{' '}
              <HighlightText color="#FFD54F">Play Balance</HighlightText>
            </p>
          </InfoCard>

          <InfoCard accentColor="#F9A825">
            <p style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '15px', lineHeight: '1.5' }}>
              🌽 Losses → the shared{' '}
              <HighlightText color="#F9A825">Group Bank</HighlightText>
            </p>
          </InfoCard>

          <InfoCard accentColor="#66BB6A">
            <p style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '15px', lineHeight: '1.5' }}>
              ₿ Group Bank converts to{' '}
              <HighlightText color="#66BB6A">Bitcoin</HighlightText>{' '}
              for DraftHaus 2026
            </p>
          </InfoCard>
        </div>

        {/* Microcopy */}
        <p
          className="text-center mt-6 mb-5"
          style={{
            color: 'rgba(255, 255, 255, 0.4)',
            fontSize: '13px',
            fontStyle: 'italic',
          }}
        >
          Friendly competition. Shared stakes. No house advantage.
        </p>

        {/* CTA */}
        <div className="pb-4">
          <GlossButton to="/hub">Enter March Madness</GlossButton>
        </div>
      </div>
    </MobileContainer>
  );
}
