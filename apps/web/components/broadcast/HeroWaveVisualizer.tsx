'use client';
// components/broadcast/HeroWaveVisualizer.tsx
// Large centrepiece waveform — mirrored bars, amber glow, fills its container.
// Used as the hero element on the mobile listener view.

import { useRef, useEffect, useCallback } from 'react';
import { useRadioStore } from '@/store/radioStore';

interface HeroWaveVisualizerProps {
  analyserNode?: React.RefObject<AnalyserNode | null>;
}

export function HeroWaveVisualizer({ analyserNode }: HeroWaveVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const isLive = useRadioStore((s) => s.isLive);

  // ── Real FFT draw ─────────────────────────────────────────────────
  const drawReal = useCallback((analyser: AnalyserNode, canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const W = canvas.width;
    const H = canvas.height;
    const midY = H / 2;

    const render = () => {
      analyser.getByteFrequencyData(dataArray);
      ctx.clearRect(0, 0, W, H);

      const bars = 48;
      const barW = W / bars - 2;
      const step = Math.floor(bufferLength / bars);

      for (let i = 0; i < bars; i++) {
        const value = dataArray[i * step] / 255;
        const barH = Math.max(4, value * midY * 0.9);
        const x = i * (barW + 2) + 1;

        // Glow
        ctx.shadowColor = `rgba(245, 158, 11, ${value * 0.7})`;
        ctx.shadowBlur = 8 + value * 14;

        // Gradient per bar
        const grad = ctx.createLinearGradient(x, midY - barH, x, midY + barH);
        grad.addColorStop(0, `rgba(249, 115, 22, ${0.3 + value * 0.7})`);
        grad.addColorStop(0.5, `rgba(245, 158, 11, ${0.5 + value * 0.5})`);
        grad.addColorStop(1, `rgba(249, 115, 22, ${0.3 + value * 0.7})`);

        ctx.fillStyle = grad;

        // Rounded cap bars
        const r = barW / 2;
        // Top bar
        ctx.beginPath();
        ctx.roundRect(x, midY - barH, barW, barH, [r, r, 0, 0]);
        ctx.fill();
        // Mirror bottom bar
        ctx.beginPath();
        ctx.roundRect(x, midY, barW, barH, [0, 0, r, r]);
        ctx.fill();
      }

      ctx.shadowBlur = 0;
      animFrameRef.current = requestAnimationFrame(render);
    };

    render();
  }, []);

  // ── Idle / off-air animated sine bars ─────────────────────────────
  const drawIdle = useCallback((canvas: HTMLCanvasElement, live: boolean) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const midY = H / 2;
    const bars = 48;
    const barW = W / bars - 2;
    let t = 0;

    const render = () => {
      ctx.clearRect(0, 0, W, H);

      for (let i = 0; i < bars; i++) {
        const wave = (Math.sin(t + i * 0.28) * 0.5 + 0.5);
        const h = Math.max(3, wave * midY * (live ? 0.4 : 0.18));
        const x = i * (barW + 2) + 1;
        const alpha = live ? 0.2 + wave * 0.15 : 0.06 + wave * 0.04;

        ctx.fillStyle = `rgba(245, 158, 11, ${alpha})`;
        const r = barW / 2;
        ctx.beginPath();
        ctx.roundRect(x, midY - h, barW, h, [r, r, 0, 0]);
        ctx.fill();
        ctx.beginPath();
        ctx.roundRect(x, midY, barW, h, [0, 0, r, r]);
        ctx.fill();
      }

      t += 0.035;
      animFrameRef.current = requestAnimationFrame(render);
    };

    render();
  }, []);

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

  return (
    <canvas
      ref={canvasRef}
      width={600}
      height={200}
      className="w-full h-full"
      aria-label="Live audio waveform"
    />
  );
}
