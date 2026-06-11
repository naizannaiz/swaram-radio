'use client';
// components/broadcast/OnAirBadge.tsx
import { motion, AnimatePresence } from 'framer-motion';
import { useRadioStore } from '@/store/radioStore';

export function OnAirBadge() {
  const isLive = useRadioStore((s) => s.isLive);
  const listenerCount = useRadioStore((s) => s.listenerCount);

  return (
    <AnimatePresence>
      {isLive && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
        >
          {/* Pulse dot only — no text */}
          <span className="relative flex h-2.5 w-2.5">
            <span className="on-air-ring absolute inline-flex h-full w-full rounded-full bg-amber-400" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-400" />
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
