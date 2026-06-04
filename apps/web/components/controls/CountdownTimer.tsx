'use client';
// components/controls/CountdownTimer.tsx
import { motion, AnimatePresence } from 'framer-motion';
import { useRadioStore } from '@/store/radioStore';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export function CountdownTimer() {
  const remaining = useRadioStore((s) => s.timerRemaining);
  const isUrgent = remaining > 0 && remaining <= 30;
  const isWarning = remaining > 30 && remaining <= 120;

  return (
    <AnimatePresence>
      {remaining > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="flex items-center gap-2"
        >
          <span className="mono text-[10px] text-white/40 tracking-[0.15em] uppercase">
            Break in
          </span>
          <motion.span
            animate={isUrgent ? { scale: [1, 1.06, 1] } : {}}
            transition={{ repeat: Infinity, duration: 0.8 }}
            className={`mono text-xl font-bold tabular-nums ${
              isUrgent
                ? 'text-orange-400'
                : isWarning
                ? 'text-amber-300'
                : 'text-amber-500'
            }`}
          >
            {formatTime(remaining)}
          </motion.span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
