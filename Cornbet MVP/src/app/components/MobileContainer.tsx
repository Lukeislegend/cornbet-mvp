import { ReactNode } from 'react';

interface MobileContainerProps {
  children: ReactNode;
}

export function MobileContainer({ children }: MobileContainerProps) {
  return (
    <div className="flex items-center justify-center min-h-screen" style={{ background: '#0A0900' }}>
      <div
        className="relative overflow-hidden"
        style={{
          width: '393px',
          height: '852px',
          background: '#111111',
        }}
      >
        {children}
      </div>
    </div>
  );
}
