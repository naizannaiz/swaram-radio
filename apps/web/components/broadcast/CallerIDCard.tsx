'use client';
// components/broadcast/CallerIDCard.tsx
import { motion, AnimatePresence } from 'framer-motion';
import { useRadioStore } from '@/store/radioStore';

export function CallerIDCard() {
  const caller = useRadioStore((s) => s.activeCaller);

  return (
    <AnimatePresence>
      {caller && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          className="fixed bottom-6 left-6 z-50"
        >
          <div className="glass-active flex items-center gap-4 px-5 py-4 min-w-[260px]">
            {/* Avatar */}
            <div
              className="w-10 h-10 rounded-none flex items-center justify-center text-black font-bold text-lg flex-shrink-0"
              style={{ backgroundColor: caller.avatarColor }}
            >
              {caller.name.charAt(0).toUpperCase()}
            </div>

            <div className="flex flex-col min-w-0">
              {/* Chyron label */}
              <span className="mono text-[10px] text-amber-400 tracking-[0.2em] uppercase mb-0.5">
                ● ON AIR
              </span>
              <span className="text-white font-semibold text-sm truncate leading-tight">
                {caller.name}
              </span>
              {caller.dept && (
                <span className="mono text-[11px] text-white/50 truncate">
                  {caller.dept}
                </span>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
