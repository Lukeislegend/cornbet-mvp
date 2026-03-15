import { ReactNode } from 'react';
import { Link } from 'react-router';

interface GlossButtonProps {
  children: ReactNode;
  to?: string;
  onClick?: () => void;
  variant?: 'primary' | 'ghost';
}

export function GlossButton({ children, to, onClick, variant = 'primary' }: GlossButtonProps) {
  const content = (
    <button
      onClick={onClick}
      className="w-full relative overflow-hidden transition-all duration-200 active:scale-[0.98]"
      style={{
        borderRadius: '20px',
        padding: variant === 'primary' ? '16px' : '14px',
        ...(variant === 'primary' ? {
          background: 'linear-gradient(180deg, #FFD54F 0%, #FFB300 55%, #F9A825 100%)',
          boxShadow: '0 0 28px rgba(255, 179, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.2), inset 0 -2px 4px rgba(0, 0, 0, 0.15)',
        } : {
          background: 'transparent',
          border: '1.5px solid rgba(255, 213, 79, 0.25)',
        }),
      }}
    >
      {variant === 'primary' && (
        <div
          className="absolute top-0 left-0 right-0 h-[35%] pointer-events-none"
          style={{
            background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.2) 0%, transparent 100%)',
          }}
        />
      )}
      <span
        className="relative z-10 block"
        style={{
          color: variant === 'primary' ? '#111111' : 'rgba(255, 213, 79, 0.85)',
          letterSpacing: '0.3px',
          fontWeight: variant === 'primary' ? '700' : '500',
        }}
      >
        {children}
      </span>
    </button>
  );

  if (to) {
    return (
      <Link to={to} className="block">
        {content}
      </Link>
    );
  }

  return content;
}
