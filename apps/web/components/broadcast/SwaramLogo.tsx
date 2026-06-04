'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useRadioStore } from '@/store/radioStore';

interface SwaramLogoProps {
  size?: 'sm' | 'md' | 'lg';
  interactive?: boolean;
}

export function SwaramLogo({ size = 'md', interactive = true }: SwaramLogoProps) {
  const isLive = useRadioStore((s) => s.isLive);
  const [clicked, setClicked] = useState(false);
  const [hovered, setHovered] = useState(false);

  // Dynamic sizing classes
  const dimensions = {
    sm: 'w-10 h-10',
    md: 'w-20 h-20',
    lg: 'w-32 h-32',
  };

  // Sound effect / interaction helper
  const handleClick = () => {
    if (!interactive) return;
    setClicked(true);
    setTimeout(() => setClicked(false), 500);

    // Play subtle synthetic radio static sound
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const bufferSize = ctx.sampleRate * 0.15; // 150ms static chirp
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      
      // Generate band-passed noise + frequency sweep
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      // Filter to make it sound like a radio tuning chirp
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1200, ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.15);
      filter.Q.value = 4.0;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start();
    } catch (e) {
      // AudioContext block fallback
    }
  };

  return (
    <div className="relative inline-block select-none" style={{ perspective: 1000 }}>
      {/* Dynamic ambient background glow */}
      {isLive && (
        <motion.div
          animate={{
            scale: hovered ? [1.1, 1.25, 1.1] : [1, 1.15, 1],
            opacity: hovered ? [0.4, 0.6, 0.4] : [0.25, 0.35, 0.25],
          }}
          transition={{
            duration: 2.5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className={`absolute inset-0 rounded-full bg-amber-500 blur-xl ${dimensions[size]}`}
          style={{ transformOrigin: 'center' }}
        />
      )}

      {/* Ripple ring effect on click */}
      {clicked && (
        <motion.div
          initial={{ scale: 0.9, opacity: 0.8 }}
          animate={{ scale: 1.8, opacity: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="absolute inset-0 rounded-full border-2 border-amber-400 pointer-events-none"
        />
      )}

      {/* Main Logo Container */}
      <motion.button
        onClick={handleClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        disabled={!interactive}
        whileHover={interactive ? { scale: 1.08, rotateY: 10, rotateX: -5 } : {}}
        whileTap={interactive ? { scale: 0.94 } : {}}
        className={`relative flex items-center justify-center overflow-hidden rounded-full border border-white/5 bg-[#0a0a0a] transition-shadow shadow-lg shadow-black/80 cursor-pointer ${
          isLive ? 'border-amber-500/30 shadow-amber-500/5' : 'hover:border-white/10'
        } ${dimensions[size]}`}
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* Subtle rotating reflection shine */}
        <motion.div
          animate={isLive || hovered ? { x: ['-100%', '100%'] } : {}}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut', repeatDelay: 1 }}
          className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/5 to-transparent skew-x-12 pointer-events-none"
        />

        {/* Dynamic scanning line when Live */}
        {isLive && (
          <motion.div
            animate={{ y: ['-10%', '110%'] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
            className="absolute inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-amber-400/30 to-transparent pointer-events-none"
          />
        )}

        {/* Logo Image */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-nobg.png"
          alt="Swaram Logo"
          className="w-[85%] h-[85%] object-contain select-none pointer-events-none"
        />
      </motion.button>
    </div>
  );
}
