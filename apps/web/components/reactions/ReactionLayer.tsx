'use client';
// components/reactions/ReactionLayer.tsx
import { motion, AnimatePresence } from 'framer-motion';
import { useRadioStore } from '@/store/radioStore';

export function ReactionLayer() {
  const reactions = useRadioStore((s) => s.reactions);

  return (
    <div className="fixed bottom-0 right-6 w-20 h-screen pointer-events-none overflow-hidden z-40">
      <AnimatePresence>
        {reactions.map((r) => (
          <motion.div
            key={r.id}
            initial={{ y: 0, opacity: 1, x: 0, scale: 0.8 }}
            animate={{
              y: -400,
              opacity: 0,
              x: Math.sin(Date.now()) * 30,
              scale: 1.4,
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 3, ease: 'easeOut' }}
            className="absolute bottom-20 right-2 text-3xl select-none"
            style={{ x: Math.random() * 40 - 20 }}
          >
            {r.emoji}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
