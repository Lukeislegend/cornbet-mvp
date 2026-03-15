import { ReactNode } from 'react';

interface InfoCardProps {
  children: ReactNode;
  accentColor?: string;
}

export function InfoCard({ children, accentColor }: InfoCardProps) {
  return (
    <div
      className="p-5 relative"
      style={{
        background: '#1A1600',
        borderRadius: '18px',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
        ...(accentColor && {
          border: `1px solid ${accentColor}15`,
        }),
      }}
    >
      {children}
    </div>
  );
}

interface HighlightTextProps {
  children: ReactNode;
  color: string;
}

export function HighlightText({ children, color }: HighlightTextProps) {
  return (
    <span style={{ color, fontWeight: '600' }}>
      {children}
    </span>
  );
}
