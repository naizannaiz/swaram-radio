'use client';
// components/broadcast/CircularVisualizer.tsx
// Radial FFT visualizer: bars spike outward around a circle.
// Swaram logo sits in the center. Used as the hero on the listener page.

import { useRef, useEffect, useCallback } from 'react';
import { useRadioStore } from '@/store/radioStore';

interface CircularVisualizerProps {
  /** External analyser node from LiveKit (preferred) */
  analyserNode?: React.RefObject<AnalyserNode | null>;
  /** Diameter in CSS pixels (default 280) */
  size?: number;
  /** Compact mode for host mini-visualizer */
  compact?: boolean;
}

export function CircularVisualizer({
  analyserNode,
  size = 280,
  compact = false,
}: CircularVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const logoRef = useRef<HTMLImageElement | null>(null);
  const isLive = useRadioStore((s) => s.isLive);

  // Preload logo image
  useEffect(() => {
    const img = new Image();
    img.src = '/logo-nobg.png';
    img.onload = () => { logoRef.current = img; };
  }, []);

  // ── Real FFT radial draw ──────────────────────────────────────────
  const drawReal = useCallback(
    (analyser: AnalyserNode, canvas: HTMLCanvasElement) => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      const W = canvas.width;
      const H = canvas.height;
      const cx = W / 2;
      const cy = H / 2;
      const bars = compact ? 48 : 80;
      const innerR = compact ? W * 0.28 : W * 0.30;
      const maxBarH = compact ? W * 0.18 : W * 0.22;
      const step = Math.floor(bufferLength / bars);

      const render = () => {
        analyser.getByteFrequencyData(dataArray);
        ctx.clearRect(0, 0, W, H);

        for (let i = 0; i < bars; i++) {
          const value = dataArray[i * step] / 255;
          const barH = Math.max(compact ? 2 : 3, value * maxBarH);
          const angle = (i / bars) * Math.PI * 2 - Math.PI / 2;

          const x1 = cx + Math.cos(angle) * innerR;
          const y1 = cy + Math.sin(angle) * innerR;
          const x2 = cx + Math.cos(angle) * (innerR + barH);
          const y2 = cy + Math.sin(angle) * (innerR + barH);

          // Glow
          ctx.shadowColor = `rgba(245, 158, 11, ${value * 0.8})`;
          ctx.shadowBlur = compact ? 4 + value * 8 : 6 + value * 16;

          // Color: amber → orange based on intensity
          const alpha = 0.4 + value * 0.6;
          const g = Math.floor(158 - 60 * value);
          ctx.strokeStyle = `rgba(245, ${g}, 11, ${alpha})`;
          ctx.lineWidth = compact ? 1.5 : 2.5;
          ctx.lineCap = 'round';

          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }

        ctx.shadowBlur = 0;

        // Draw logo in center
        drawCenterLogo(ctx, cx, cy, W, compact);

        animFrameRef.current = requestAnimationFrame(render);
      };

      render();
    },
    [compact]
  );

  // ── Idle sine-wave radial bars ───────────────────────────────────
  const drawIdle = useCallback(
    (canvas: HTMLCanvasElement, live: boolean) => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const W = canvas.width;
      const H = canvas.height;
      const cx = W / 2;
      const cy = H / 2;
      const bars = compact ? 48 : 80;
      const innerR = compact ? W * 0.28 : W * 0.30;
      const maxBarH = compact ? W * 0.10 : W * 0.14;
      let t = 0;

      const render = () => {
        ctx.clearRect(0, 0, W, H);

        for (let i = 0; i < bars; i++) {
          const wave = Math.sin(t + i * 0.25) * 0.5 + 0.5;
          const barH = Math.max(compact ? 1 : 2, wave * maxBarH * (live ? 0.55 : 0.28));
          const angle = (i / bars) * Math.PI * 2 - Math.PI / 2;

          const x1 = cx + Math.cos(angle) * innerR;
          const y1 = cy + Math.sin(angle) * innerR;
          const x2 = cx + Math.cos(angle) * (innerR + barH);
          const y2 = cy + Math.sin(angle) * (innerR + barH);

          const alpha = live ? 0.15 + wave * 0.12 : 0.05 + wave * 0.06;
          ctx.strokeStyle = `rgba(245, 158, 11, ${alpha})`;
          ctx.lineWidth = compact ? 1.5 : 2.5;
          ctx.lineCap = 'round';
          ctx.shadowBlur = 0;

          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }

        // Draw logo in center
        drawCenterLogo(ctx, cx, cy, W, compact);

        t += 0.032;
        animFrameRef.current = requestAnimationFrame(render);
      };

      render();
    },
    [compact]
  );

  // ── Draw the Swaram logo (or fallback ring) in center ───────────
  const drawCenterLogo = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    W: number,
    mini: boolean
  ) => {
    const logoR = mini ? W * 0.22 : W * 0.24;

    // Dark background circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, logoR, 0, Math.PI * 2);
    ctx.fillStyle = '#0a0a0a';
    ctx.fill();

    // Subtle amber border ring
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.18)';
    ctx.lineWidth = mini ? 1 : 1.5;
    ctx.stroke();
    ctx.restore();

    // Logo image if loaded
    if (logoRef.current) {
      const imgSize = logoR * 1.55;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, logoR * 0.92, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(
        logoRef.current,
        cx - imgSize / 2,
        cy - imgSize / 2,
        imgSize,
        imgSize
      );
      ctx.restore();
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    cancelAnimationFrame(animFrameRef.current);

    if (analyserNode?.current) {
      drawReal(analyserNode.current, canvas);
    } else {
      drawIdle(canvas, isLive);
    }

    return () => cancelAnimationFrame(animFrameRef.current);
  }, [analyserNode, isLive, drawReal, drawIdle]);

  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const canvasSize = size * dpr;

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      {/* Outer ambient glow ring */}
      {isLive && (
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            background:
              'radial-gradient(circle, rgba(245,158,11,0.06) 40%, transparent 70%)',
            animation: 'pulse 3s ease-in-out infinite',
          }}
        />
      )}
      <canvas
        ref={canvasRef}
        width={canvasSize}
        height={canvasSize}
        style={{ width: size, height: size }}
        aria-label={compact ? 'Host mic activity' : 'Live audio waveform'}
      />
    </div>
  );
}
