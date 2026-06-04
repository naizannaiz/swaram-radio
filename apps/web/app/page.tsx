'use client';
// app/page.tsx — Listener View (mobile-first redesign)
// Layout: sticky header → hero waveform → bottom controls
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSocket } from '@/hooks/useSocket';
import { useListenerLiveKit } from '@/hooks/useLiveKit';
import { useRadioStore } from '@/store/radioStore';
import { connectSocket } from '@/lib/socket-client';
import { OnAirBadge } from '@/components/broadcast/OnAirBadge';
import { SwaramLogo } from '@/components/broadcast/SwaramLogo';
import { HeroWaveVisualizer } from '@/components/broadcast/HeroWaveVisualizer';
import { ReactionBar } from '@/components/reactions/ReactionBar';
import { ReactionLayer } from '@/components/reactions/ReactionLayer';
import { PollWidget } from '@/components/polls/PollWidget';
import { ConfessionOverlay } from '@/components/confessions/ConfessionOverlay';
import { CountdownTimer } from '@/components/controls/CountdownTimer';
import { ScheduleBoard } from '@/components/schedule/ScheduleBoard';

const AVATAR_COLORS = [
  '#F59E0B', '#F97316', '#EF4444', '#10B981',
  '#06B6D4', '#8B5CF6', '#EC4899', '#84CC16',
];

function randomHue() {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

// ─────────────────────────────────────────────
// Join Gate
// ─────────────────────────────────────────────
function JoinGate({ onJoin }: { onJoin: (name: string, color: string, dept: string) => void }) {
  const [name, setName] = useState('');
  const [dept, setDept] = useState('');
  // Use a fixed default so SSR and hydration render identical HTML.
  // Randomize only after mount (client-side) to avoid hydration mismatch.
  const [color, setColor] = useState(AVATAR_COLORS[0]);
  useEffect(() => {
    setColor(randomHue());
  }, []);

  const handleJoin = () => {
    if (!name.trim()) return;
    onJoin(name.trim(), color, dept.trim());
  };

  return (
    <main className="min-h-[100dvh] flex flex-col items-center justify-center px-5 bg-[#080808]">
      {/* Background ambient glow */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            'radial-gradient(ellipse 60% 50% at 50% 20%, rgba(245,158,11,0.07) 0%, transparent 70%)',
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 180, damping: 22 }}
        className="w-full max-w-xs relative z-10"
      >
        {/* Logo */}
        <div className="mb-8 text-center flex flex-col items-center">
          <div className="mb-4">
            <SwaramLogo size="lg" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-white leading-none">
            Swaram
          </h1>
          <p className="mono text-[11px] text-white/25 tracking-[0.25em] uppercase mt-2">
            College Radio
          </p>
        </div>

        <div className="glass p-6 flex flex-col gap-5">
          {/* Name input */}
          <div>
            <label
              htmlFor="listener-name"
              className="mono text-[10px] text-amber-400/70 tracking-[0.2em] uppercase block mb-2"
            >
              Your Name
            </label>
            <input
              id="listener-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              maxLength={30}
              placeholder="e.g. Naizan"
              autoFocus
              className="w-full bg-white/5 border border-white/10 px-4 py-3.5 text-white placeholder-white/20 focus:outline-none focus:border-amber-500/40 transition-colors text-sm"
            />
          </div>

          {/* Dept input */}
          <div>
            <label
              htmlFor="listener-dept"
              className="mono text-[10px] text-white/30 tracking-[0.2em] uppercase block mb-2"
            >
              Dept / Year
              <span className="normal-case text-white/20 ml-1">(optional)</span>
            </label>
            <input
              id="listener-dept"
              type="text"
              value={dept}
              onChange={(e) => setDept(e.target.value)}
              maxLength={40}
              placeholder="e.g. CS '26"
              className="w-full bg-white/5 border border-white/10 px-4 py-3.5 text-white placeholder-white/20 focus:outline-none focus:border-amber-500/40 transition-colors text-sm"
            />
          </div>

          {/* Color picker */}
          <div>
            <p className="mono text-[10px] text-white/30 tracking-[0.2em] uppercase mb-3">
              Your Color
            </p>
            <div className="flex gap-2.5 flex-wrap">
              {AVATAR_COLORS.map((c) => (
                <motion.button
                  key={c}
                  whileTap={{ scale: 0.88 }}
                  onClick={() => setColor(c)}
                  className={`w-9 h-9 transition-all ${
                    color === c
                      ? 'ring-2 ring-white/60 ring-offset-1 ring-offset-[#080808] scale-110'
                      : 'opacity-60 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: c }}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
          </div>

          {/* Join CTA */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleJoin}
            disabled={!name.trim()}
            id="join-btn"
            className="w-full bg-amber-500 text-black font-bold py-4 text-sm tracking-[0.08em] uppercase hover:bg-amber-400 active:bg-amber-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed mt-1"
          >
            Join Broadcast
          </motion.button>
        </div>
      </motion.div>
    </main>
  );
}

// ─────────────────────────────────────────────
// Main Listener View
// ─────────────────────────────────────────────
export default function ListenerPage() {
  const [joined, setJoined] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [showConfession, setShowConfession] = useState(false);
  const [confessionText, setConfessionText] = useState('');
  const [confessionSent, setConfessionSent] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  useSocket();
  const analyserRef = useListenerLiveKit(audioRef);

  const isLive = useRadioStore((s) => s.isLive);
  const hostName = useRadioStore((s) => s.hostName);
  const listenerCount = useRadioStore((s) => s.listenerCount);
  const micStatus = useRadioStore((s) => s.micRequestStatus);
  const activeCaller = useRadioStore((s) => s.activeCaller);
  const timerRemaining = useRadioStore((s) => s.timerRemaining);
  const setIdentity = useRadioStore((s) => s.setIdentity);

  const socket = connectSocket();

  const onJoin = (name: string, color: string, dept: string) => {
    setIdentity(name, color, dept);
    socket.emit('JOIN_SHOW', { name, avatarColor: color, dept: dept || undefined });
    setJoined(true);
  };

  const myDept = useRadioStore((s) => s.myDept);

  const requestMic = () => {
    if (micStatus === 'queued') {
      socket.emit('CANCEL_MIC_REQUEST');
    } else if (micStatus === 'idle' || micStatus === 'denied') {
      socket.emit('REQUEST_MIC', myDept ? { dept: myDept } : {});
    }
  };

  const submitConfession = () => {
    if (!confessionText.trim()) return;
    socket.emit('SUBMIT_CONFESSION', { text: confessionText.trim() });
    setConfessionSent(true);
    setTimeout(() => {
      setShowConfession(false);
      setConfessionText('');
      setConfessionSent(false);
    }, 2000);
  };

  if (!joined) return <JoinGate onJoin={onJoin} />;

  // ─────────────── Schedule sheet ───────────────
  if (showSchedule) {
    return (
      <main className="min-h-[100dvh] bg-[#080808] flex flex-col">
        <header className="border-b border-white/5 px-5 py-4 flex items-center gap-3">
          <button
            onClick={() => setShowSchedule(false)}
            className="text-white/40 hover:text-white transition-colors text-xl leading-none"
            aria-label="Back"
          >
            ←
          </button>
          <h2 className="text-white font-semibold">Schedule</h2>
        </header>
        <div className="flex-1 overflow-y-auto p-5">
          <ScheduleBoard />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-[#080808] flex flex-col overflow-hidden">
      <audio ref={audioRef} autoPlay playsInline className="hidden" />

      {/* ── Ambient background glow (reacts to live state) ── */}
      <AnimatePresence>
        {isLive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none fixed inset-0 z-0"
            style={{
              background:
                'radial-gradient(ellipse 80% 55% at 50% 15%, rgba(245,158,11,0.09) 0%, transparent 65%)',
            }}
          />
        )}
      </AnimatePresence>

      {/* ── Sticky Header ── */}
      <header className="relative z-10 flex items-center justify-between px-5 py-3 border-b border-white/5">
        <div className="flex items-center gap-3">
          <SwaramLogo size="sm" />
          <h1 className="text-lg font-bold tracking-tight text-white">Swaram</h1>
          <OnAirBadge />
        </div>
        <div className="flex items-center gap-3">
          <CountdownTimer />
          <button
            onClick={() => setShowSchedule(true)}
            className="mono text-[10px] text-white/30 hover:text-white/60 transition-colors tracking-wider"
            aria-label="Show schedule"
          >
            SCHED
          </button>
        </div>
      </header>

      {/* ── Hero Section ── */}
      <div className="relative z-10 flex flex-col items-center px-5 pt-6 pb-4">

        {/* Host avatar + name */}
        <AnimatePresence mode="wait">
          {isLive && hostName ? (
            <motion.div
              key="host"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex flex-col items-center mb-5"
            >
              <div className="relative mb-2">
                <div className="w-12 h-12 bg-amber-500 flex items-center justify-center text-black font-bold text-lg">
                  {hostName.charAt(0).toUpperCase()}
                </div>
                {/* Pulse ring when live */}
                <span className="absolute -inset-1 on-air-ring rounded-none opacity-60" />
              </div>
              <p className="text-white font-semibold text-sm">{hostName}</p>
              <p className="mono text-[10px] text-white/30 mt-0.5">Host</p>
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center mb-5"
            >
              <div className="w-12 h-12 bg-white/5 border border-white/10 flex items-center justify-center mb-2">
                <span className="text-white/20 text-xl">📻</span>
              </div>
              <p className="mono text-xs text-white/20">Waiting for host...</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── HERO WAVEFORM ── */}
        <div
          className={`w-full relative transition-all duration-700 ${
            isLive
              ? 'border border-amber-500/20 bg-amber-500/[0.03]'
              : 'border border-white/5 bg-white/[0.02]'
          }`}
          style={{ height: '200px' }}
        >
          {/* Corner labels */}
          {isLive && (
            <>
              <span className="absolute top-2 left-3 mono text-[9px] text-amber-400/50 tracking-widest z-10">
                ● LIVE
              </span>
              <span className="absolute top-2 right-3 mono text-[9px] text-white/20 z-10">
                {listenerCount} listening
              </span>
            </>
          )}

          <HeroWaveVisualizer analyserNode={analyserRef} />

          {/* Center line */}
          <div
            className="absolute inset-x-4 top-1/2 -translate-y-px h-px pointer-events-none"
            style={{
              background: isLive
                ? 'linear-gradient(to right, transparent, rgba(245,158,11,0.3), transparent)'
                : 'linear-gradient(to right, transparent, rgba(255,255,255,0.05), transparent)',
            }}
          />
        </div>

        {/* ── Caller card (inline, appears below waveform) ── */}
        <AnimatePresence>
          {activeCaller && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 24 }}
              className="w-full overflow-hidden"
            >
              <div className="glass-active flex items-center gap-3 px-4 py-3 mt-2">
                <div
                  className="w-8 h-8 flex items-center justify-center text-black font-bold text-sm flex-shrink-0"
                  style={{ backgroundColor: activeCaller.avatarColor }}
                >
                  {activeCaller.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="mono text-[9px] text-amber-400 tracking-widest uppercase mb-0.5">
                    ● On Air
                  </p>
                  <p className="text-white font-semibold text-sm truncate">
                    {activeCaller.name}
                  </p>
                  {activeCaller.dept && (
                    <p className="mono text-[10px] text-white/40 truncate">
                      {activeCaller.dept}
                    </p>
                  )}
                </div>
                <span className="flex-shrink-0">🎙️</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Scrollable bottom controls ── */}
      <div className="relative z-10 flex-1 overflow-y-auto px-5 pb-6 flex flex-col gap-4">

        {/* Reactions */}
        <div className="flex justify-center">
          <ReactionBar />
        </div>

        {/* Poll widget — shows only when active */}
        <PollWidget />

        {/* Mic request CTA */}
        {isLive && (
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={requestMic}
            disabled={micStatus === 'accepted'}
            id="mic-request-btn"
            className={`w-full py-4 font-bold text-sm tracking-wide transition-all ${
              micStatus === 'accepted'
                ? 'bg-amber-500 text-black'
                : micStatus === 'queued'
                ? 'bg-orange-500/15 text-orange-400 border border-orange-500/30'
                : 'glass text-white hover:border-amber-500/30 active:bg-white/5'
            }`}
          >
            {micStatus === 'accepted'
              ? '🎙️  You\'re On Air!'
              : micStatus === 'queued'
              ? '⏳  In Queue — Tap to Cancel'
              : micStatus === 'denied'
              ? '🎙️  Request Declined — Try Again'
              : '🎙️  Request to Speak'}
          </motion.button>
        )}

        {/* Confession */}
        {isLive && (
          <div>
            <button
              onClick={() => setShowConfession(!showConfession)}
              id="confession-btn"
              className="w-full py-3 border border-white/8 text-white/35 text-sm hover:text-white/55 hover:border-white/15 transition-all active:bg-white/5"
            >
              ✉️  Send Anonymous Confession
            </button>

            <AnimatePresence>
              {showConfession && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="glass mt-2 p-4 flex flex-col gap-3">
                    <textarea
                      value={confessionText}
                      onChange={(e) =>
                        setConfessionText(e.target.value.slice(0, 280))
                      }
                      placeholder="Your anonymous message... host reads it on air."
                      rows={3}
                      id="confession-input"
                      className="w-full bg-transparent text-white text-sm placeholder-white/20 resize-none focus:outline-none leading-relaxed"
                    />
                    <div className="flex justify-between items-center">
                      <span className="mono text-[10px] text-white/20">
                        {confessionText.length}/280
                      </span>
                      <button
                        onClick={submitConfession}
                        disabled={confessionSent || !confessionText.trim()}
                        id="confession-send-btn"
                        className="mono text-xs px-4 py-2 bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 transition-colors disabled:opacity-40"
                      >
                        {confessionSent ? '✓ Sent' : 'Send'}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Offline state */}
        {!isLive && (
          <div className="glass p-8 text-center">
            <div className="text-3xl mb-3">📻</div>
            <p className="text-white/20 mono text-sm">
              No show live right now
            </p>
            <button
              onClick={() => setShowSchedule(true)}
              className="mt-4 mono text-[11px] text-amber-400/60 hover:text-amber-400 transition-colors tracking-wider underline underline-offset-2"
            >
              View Schedule →
            </button>
          </div>
        )}
      </div>

      {/* ── Desktop sidebar (hidden on mobile) ── */}
      <div className="hidden lg:block fixed right-0 top-0 bottom-0 w-72 border-l border-white/5 bg-[#080808] overflow-y-auto p-5 z-20">
        <ScheduleBoard />
      </div>

      {/* ── Global overlays ── */}
      <ReactionLayer />
      <ConfessionOverlay />
    </main>
  );
}
