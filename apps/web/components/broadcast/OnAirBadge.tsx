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
          className="flex items-center gap-3"
        >
          {/* Pulse dot */}
          <span className="relative flex h-3 w-3">
            <span className="on-air-ring absolute inline-flex h-full w-full rounded-full bg-amber-400" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-400" />
          </span>

          <span className="mono text-xs font-semibold tracking-[0.2em] text-amber-400 uppercase">
            ● LIVE
          </span>

          <span className="mono text-xs text-white/40 tracking-wider">
            {listenerCount} listening
          </span>
        </motion.div>
      )}
      {!isLive && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mono text-xs text-white/20 tracking-[0.2em] uppercase"
        >
          ○ OFF AIR
        </motion.div>
      )}
    </AnimatePresence>
  );
}
