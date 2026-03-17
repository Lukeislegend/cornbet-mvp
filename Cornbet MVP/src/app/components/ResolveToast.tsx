import { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface ResolveToastProps {
  message: string | null;
  onDismiss: () => void;
}

export function ResolveToast({ message, onDismiss }: ResolveToastProps) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [message, onDismiss]);

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.95 }}
          animate={{ opacity: 1, y: 0,  scale: 1    }}
          exit={{  opacity: 0, y: 24,  scale: 0.95  }}
          transition={{ type: 'spring', damping: 22, stiffness: 320 }}
          onClick={onDismiss}
          style={{
            position:     'fixed',
            bottom:       '88px',
            left:         '50%',
            transform:    'translateX(-50%)',
            zIndex:       9999,
            maxWidth:     '340px',
            width:        'calc(100% - 40px)',
            background:   'linear-gradient(135deg, #1A1600 0%, #2A2200 100%)',
            border:       '1px solid rgba(255,179,0,0.45)',
            borderRadius: '16px',
            padding:      '12px 16px',
            display:      'flex',
            alignItems:   'center',
            gap:          '10px',
            cursor:       'pointer',
            boxShadow:    '0 8px 32px rgba(0,0,0,0.5), 0 0 20px rgba(255,179,0,0.1)',
          }}
        >
          <span style={{ fontSize: '20px', flexShrink: 0 }}>🎉</span>
          <p style={{ color: 'white', fontSize: '13px', fontWeight: '600', lineHeight: '1.4', flex: 1 }}>
            {message}
          </p>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '18px', lineHeight: 1, flexShrink: 0 }}>×</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
