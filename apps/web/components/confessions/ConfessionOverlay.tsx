'use client';
// components/confessions/ConfessionOverlay.tsx
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getSocket } from '@/lib/socket-client';

export function ConfessionOverlay() {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    const socket = getSocket();
    socket.on('CONFESSION_ON_AIR', (data: { text: string }) => {
      setText(data.text);
      setTimeout(() => setText(null), 8000);
    });
    return () => { socket.off('CONFESSION_ON_AIR'); };
  }, []);

  return (
    <AnimatePresence>
      {text && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 200, damping: 22 }}
          className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none"
        >
          <div className="glass-active max-w-md w-full mx-6 p-8 text-center">
            <span className="mono text-[10px] text-amber-400 tracking-[0.2em] uppercase block mb-4">
              ◆ Anonymous Confession
            </span>
            <p className="text-white text-xl font-medium leading-relaxed italic">
              &ldquo;{text}&rdquo;
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
