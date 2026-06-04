'use client';
// hooks/useWaveform.ts
import { useEffect, useRef, useCallback } from 'react';

export function useWaveform(
  audioRef: React.RefObject<HTMLAudioElement | null>,
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  isActive: boolean
) {
  const animFrameRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const contextRef = useRef<AudioContext | null>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const barWidth = (canvas.width / bufferLength) * 2.5;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const barHeight = (dataArray[i] / 255) * canvas.height;
      const intensity = dataArray[i] / 255;

      // Amber → orange gradient per bar based on height
      const r = Math.floor(245 + 10 * intensity);
      const g = Math.floor(158 - 60 * intensity);
      const b = 11;

      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
      x += barWidth + 1;
    }

    animFrameRef.current = requestAnimationFrame(draw);
  }, [canvasRef]);

  useEffect(() => {
    if (!isActive || !audioRef.current) return;

    const audio = audioRef.current;

    try {
      if (!contextRef.current) {
        contextRef.current = new AudioContext();
      }
      const ctx = contextRef.current;
      const source = ctx.createMediaElementSource(audio);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyser.connect(ctx.destination);
      analyserRef.current = analyser;
      draw();
    } catch {
      // Fallback: fake waveform animation
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx2d = canvas.getContext('2d');
      if (!ctx2d) return;

      let t = 0;
      const fakeDraw = () => {
        ctx2d.clearRect(0, 0, canvas.width, canvas.height);
        const bars = 40;
        for (let i = 0; i < bars; i++) {
          const h = (Math.sin(t + i * 0.3) * 0.5 + 0.5) * canvas.height * 0.8;
          ctx2d.fillStyle = '#F59E0B';
          ctx2d.fillRect((i / bars) * canvas.width, canvas.height - h, canvas.width / bars - 2, h);
        }
        t += 0.05;
        animFrameRef.current = requestAnimationFrame(fakeDraw);
      };
      fakeDraw();
    }

    return () => {
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [isActive, audioRef, draw, canvasRef]);
}
