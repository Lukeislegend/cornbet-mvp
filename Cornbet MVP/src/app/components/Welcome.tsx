import { MobileContainer } from './MobileContainer';
import { GlossButton } from './GlossButton';

export function Welcome() {
  return (
    <MobileContainer>
      <div className="flex flex-col items-center justify-center h-full px-8">
        {/* Main content */}
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          {/* Corn emoji hero */}
          <div style={{ fontSize: '56px', marginBottom: '20px' }}>🌽</div>

          <h1
            className="mb-4"
            style={{
              fontSize: '32px',
              fontWeight: '800',
              color: 'white',
              lineHeight: '1.25',
              maxWidth: '320px',
            }}
          >
            Bet with your friends.{' '}
            <span style={{ color: '#FFD54F' }}>Lose to the group.</span>{' '}
            Win for yourself.
          </h1>

          <p
            className="mb-8"
            style={{
              color: 'rgba(255, 255, 255, 0.55)',
              fontSize: '15px',
              lineHeight: '1.6',
              maxWidth: '300px',
            }}
          >
            March Madness, friendly competition, one shared bank.
          </p>

          {/* Explanation card */}
          <div
            className="w-full p-5 rounded-2xl"
            style={{
              background: 'rgba(255, 179, 0, 0.07)',
              border: '1px solid rgba(255, 213, 79, 0.2)',
            }}
          >
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span style={{ fontSize: '20px' }}>💰</span>
                <p style={{ color: 'rgba(255, 255, 255, 0.85)', fontSize: '14px', textAlign: 'left' }}>
                  Players start with{' '}
                  <span style={{ color: '#FFD54F', fontWeight: '700' }}>$500</span>{' '}
                  Play Balance
                </p>
              </div>
              <div
                style={{
                  height: '1px',
                  background: 'rgba(255, 213, 79, 0.1)',
                }}
              />
              <div className="flex items-center gap-3">
                <span style={{ fontSize: '20px' }}>🏦</span>
                <p style={{ color: 'rgba(255, 255, 255, 0.85)', fontSize: '14px', textAlign: 'left' }}>
                  Losses go to the{' '}
                  <span style={{ color: '#FFB300', fontWeight: '700' }}>MaizeBank</span>
                </p>
              </div>
              <div
                style={{
                  height: '1px',
                  background: 'rgba(255, 213, 79, 0.1)',
                }}
              />
              <div className="flex items-center gap-3">
                <span style={{ fontSize: '20px' }}>₿</span>
                <p style={{ color: 'rgba(255, 255, 255, 0.85)', fontSize: '14px', textAlign: 'left' }}>
                  The bank funds{' '}
                  <span style={{ color: '#F9A825', fontWeight: '700' }}>DraftHaus 2026</span>
                </p>
              </div>
            </div>
          </div>

          {/* Golden divider */}
          <div
            className="mt-8"
            style={{
              width: '80px',
              height: '2px',
              background: 'linear-gradient(90deg, transparent, #FFB300, transparent)',
              opacity: 0.5,
            }}
          />
        </div>

        {/* Bottom CTA */}
        <div className="w-full pb-12">
          <GlossButton to="/how-it-works">Start with $500</GlossButton>
        </div>
      </div>
    </MobileContainer>
  );
}
