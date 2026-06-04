'use client';
// components/broadcast/WaveVisualizer.tsx
// Renders an FFT waveform. Accepts either a LiveKit analyserNode (preferred)
// or falls back to an <audio> element for Web Audio API analysis.

import { useRef, useEffect, useCallback } from 'react';
import { useRadioStore } from '@/store/radioStore';

interface WaveVisualizerProps {
  /** External analyser node from LiveKit tracks (preferred) */
  analyserNode?: React.RefObject<AnalyserNode | null>;
  /** Fallback: derive analyser from an <audio> element */
  audioRef?: React.RefObject<HTMLAudioElement | null>;
}

export function WaveVisualizer({ analyserNode, audioRef }: WaveVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const isLive = useRadioStore((s) => s.isLive);

  const draw = useCallback(
    (analyser: AnalyserNode, canvas: HTMLCanvasElement) => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const render = () => {
        analyser.getByteFrequencyData(dataArray);
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const barWidth = (canvas.width / bufferLength) * 2.5;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const barHeight = (dataArray[i] / 255) * canvas.height;
          const intensity = dataArray[i] / 255;

          // Amber → orange gradient per bar
          const r = Math.min(255, Math.floor(245 + 10 * intensity));
          const g = Math.floor(158 - 80 * intensity);
          ctx.fillStyle = `rgb(${r},${g},11)`;
          ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
          x += barWidth + 1;
        }

        animFrameRef.current = requestAnimationFrame(render);
      };

      render();
    },
    []
  );

  // Fake animated waveform when no audio source yet (looks alive on-screen)
  const drawFake = useCallback((canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let t = 0;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const bars = 40;
      for (let i = 0; i < bars; i++) {
        const h = (Math.sin(t + i * 0.35) * 0.5 + 0.5) * canvas.height * 0.6;
        ctx.fillStyle = isLive ? 'rgba(245,158,11,0.25)' : 'rgba(255,255,255,0.06)';
        ctx.fillRect(
          (i / bars) * canvas.width,
          canvas.height - h,
          canvas.width / bars - 2,
          h
        );
      }
      t += 0.04;
      animFrameRef.current = requestAnimationFrame(render);
    };
    render();
  }, [isLive]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    cancelAnimationFrame(animFrameRef.current);

    // Priority 1: external analyserNode from LiveKit
    if (analyserNode?.current) {
      draw(analyserNode.current, canvas);
      return;
    }

    // Priority 2: derive from <audio> element
    if (audioRef?.current && audioRef.current.srcObject) {
      try {
        const ctx = new AudioContext();
        const source = ctx.createMediaStreamSource(
          audioRef.current.srcObject as MediaStream
        );
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyser.connect(ctx.destination);
        draw(analyser, canvas);
        return () => { ctx.close(); };
      } catch {
        // fallthrough to fake
      }
    }

    // Fallback: animated fake bars
    drawFake(canvas);

    return () => cancelAnimationFrame(animFrameRef.current);
  }, [analyserNode, audioRef, draw, drawFake, isLive]);

  return (
    <div className="w-full h-16 relative">
      <canvas
        ref={canvasRef}
        width={600}
        height={64}
        className="w-full h-full"
        aria-label="Audio waveform visualizer"
      />
    </div>
  );
}
