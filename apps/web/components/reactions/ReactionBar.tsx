'use client';
// components/reactions/ReactionBar.tsx
import { getSocket } from '@/lib/socket-client';
import { useRadioStore } from '@/store/radioStore';
import { motion } from 'framer-motion';

const EMOJIS = ['🔥', '❤️', '😂', '🤯', '👏'];

export function ReactionBar() {
  const isLive = useRadioStore((s) => s.isLive);

  const sendReaction = (emoji: string) => {
    const socket = getSocket();
    socket.emit('REACT', { emoji });
  };

  if (!isLive) return null;

  return (
    <div className="flex items-center gap-2">
      {EMOJIS.map((emoji) => (
        <motion.button
          key={emoji}
          whileHover={{ scale: 1.3, y: -4 }}
          whileTap={{ scale: 0.85 }}
          transition={{ type: 'spring', stiffness: 400, damping: 15 }}
          onClick={() => sendReaction(emoji)}
          className="text-2xl cursor-pointer select-none p-1.5 hover:bg-white/5 transition-colors"
          aria-label={`React with ${emoji}`}
        >
          {emoji}
        </motion.button>
      ))}
    </div>
  );
}
