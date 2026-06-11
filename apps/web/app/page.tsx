'use client';
// app/page.tsx — Listener View · Mobile-first · Minimal
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSocket } from '@/hooks/useSocket';
import { useListenerLiveKit } from '@/hooks/useLiveKit';
import { useRadioStore } from '@/store/radioStore';
import { getSocketSync } from '@/lib/socket-client';
import { OnAirBadge } from '@/components/broadcast/OnAirBadge';
import { SwaramLogo } from '@/components/broadcast/SwaramLogo';
import { CircularVisualizer } from '@/components/broadcast/CircularVisualizer';
import { ReactionBar } from '@/components/reactions/ReactionBar';
import { ReactionLayer } from '@/components/reactions/ReactionLayer';
import { PollWidget } from '@/components/polls/PollWidget';
import { ConfessionOverlay } from '@/components/confessions/ConfessionOverlay';
import { CountdownTimer } from '@/components/controls/CountdownTimer';

// ── SVG Icons (no emoji) ──────────────────────────────────────────────────────
function IconMic({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 10v2a7 7 0 01-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}
function IconMicOff({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <line x1="1" y1="1" x2="23" y2="23" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16.95A7 7 0 015 12v-2m14 0v2a7 7 0 01-.11 1.23" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}
function IconVolume({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" />
    </svg>
  );
}
function IconVolumeX({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <line x1="23" y1="9" x2="17" y2="15" />
      <line x1="17" y1="9" x2="23" y2="15" />
    </svg>
  );
}
function IconMail({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}
function IconAlertTriangle({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}
function IconRadio({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <circle cx="12" cy="12" r="2" />
      <path d="M16.24 7.76a6 6 0 010 8.49m-8.48-.01a6 6 0 010-8.49m11.31-2.82a10 10 0 010 14.14m-14.14 0a10 10 0 010-14.14" />
    </svg>
  );
}
function IconUsers({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}
function IconClock({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
function IconCalendar({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

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
  const [color, setColor] = useState(AVATAR_COLORS[0]);
  useEffect(() => { setColor(randomHue()); }, []);

  const handleJoin = () => {
    if (!name.trim()) return;
    onJoin(name.trim(), color, dept.trim());
  };

  return (
    <main className="min-h-[100dvh] flex flex-col items-center justify-center px-5 bg-[#080808]">
      <div
        className="pointer-events-none fixed inset-0"
        style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 20%, rgba(245,158,11,0.07) 0%, transparent 70%)' }}
      />
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 180, damping: 22 }}
        className="w-full max-w-sm relative z-10"
      >
        <div className="mb-8 text-center flex flex-col items-center">
          <div className="mb-4"><SwaramLogo size="lg" /></div>
          <h1 className="text-4xl font-bold tracking-tight text-white leading-none">Swaram</h1>
          <p className="mono text-[11px] text-white/25 tracking-[0.25em] uppercase mt-2">College Radio</p>
        </div>

        <div className="glass p-6 flex flex-col gap-4">
          <div>
            <label htmlFor="listener-name" className="mono text-[10px] text-amber-400/70 tracking-[0.2em] uppercase block mb-2">
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
              className="w-full bg-white/5 border border-white/10 px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-amber-500/40 transition-colors text-sm rounded-lg"
            />
          </div>
          <div>
            <label htmlFor="listener-dept" className="mono text-[10px] text-white/30 tracking-[0.2em] uppercase block mb-2">
              Dept / Year <span className="normal-case text-white/20">(optional)</span>
            </label>
            <input
              id="listener-dept"
              type="text"
              value={dept}
              onChange={(e) => setDept(e.target.value)}
              maxLength={40}
              placeholder="e.g. CS '26"
              className="w-full bg-white/5 border border-white/10 px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-amber-500/40 transition-colors text-sm rounded-lg"
            />
          </div>
          <div>
            <p className="mono text-[10px] text-white/30 tracking-[0.2em] uppercase mb-3">Your Color</p>
            <div className="flex gap-2.5 flex-wrap">
              {AVATAR_COLORS.map((c) => (
                <motion.button
                  key={c}
                  whileTap={{ scale: 0.88 }}
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full transition-all ${
                    color === c ? 'ring-2 ring-white/60 ring-offset-2 ring-offset-[#080808] scale-110' : 'opacity-60 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: c }}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
          </div>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleJoin}
            disabled={!name.trim()}
            id="join-btn"
            className="w-full bg-amber-500 text-black font-bold py-3.5 text-sm tracking-[0.08em] uppercase hover:bg-amber-400 active:bg-amber-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed rounded-lg mt-1"
          >
            Join Broadcast
          </motion.button>
        </div>
      </motion.div>
    </main>
  );
}

// ─────────────────────────────────────────────
// Schedule Banner (exclusive, shown when schedule exists)
// ─────────────────────────────────────────────
function ScheduleBanner() {
  const schedule = useRadioStore((s) => s.schedule);
  const [dismissed, setDismissed] = useState(false);

  if (schedule.length === 0 || dismissed) return null;

  // Find next upcoming slot
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const now = new Date();
  const todayIdx = now.getDay();
  const timeNow = now.getHours() * 60 + now.getMinutes();

  const next = schedule
    .map((slot) => {
      const [h, m] = slot.startTime.split(':').map(Number);
      const slotMins = h * 60 + m;
      const daysAhead = (slot.dayOfWeek - todayIdx + 7) % 7;
      const minutesAhead = daysAhead * 1440 + slotMins - timeNow;
      return { ...slot, minutesAhead };
    })
    .filter((s) => s.minutesAhead > 0)
    .sort((a, b) => a.minutesAhead - b.minutesAhead)[0];

  const display = next ?? schedule[0];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        className="mx-4 mt-3 relative overflow-hidden rounded-xl border border-amber-500/25 bg-gradient-to-r from-amber-950/50 via-amber-900/20 to-amber-950/50"
      >
        {/* Shimmer line */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />

        <div className="px-4 py-3 flex items-center gap-3">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-500/15 flex items-center justify-center">
            <IconCalendar className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="mono text-[9px] text-amber-400/70 tracking-widest uppercase mb-0.5">Next Show</p>
            <p className="text-white font-semibold text-sm truncate">{display.showName}</p>
            <p className="mono text-[10px] text-white/40 truncate">
              {DAYS[display.dayOfWeek]} · {display.startTime} · {display.hostName}
            </p>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-white/30 hover:text-white/60 transition-colors"
            aria-label="Dismiss"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────
// Main Listener View
// ─────────────────────────────────────────────
export default function ListenerPage() {
  const [joined, setJoined] = useState(false);
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
  const setIdentity = useRadioStore((s) => s.setIdentity);
  const isAudioMuted = useRadioStore((s) => s.isAudioMuted);
  const setAudioMuted = useRadioStore((s) => s.setAudioMuted);
  const micQueueCount = useRadioStore((s) => s.micQueueCount);
  const myDept = useRadioStore((s) => s.myDept);

  // Sync muted state to <audio>
  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = isAudioMuted;
  }, [isAudioMuted]);

  const onJoin = (name: string, color: string, dept: string) => {
    setIdentity(name, color, dept);
    getSocketSync()?.emit('JOIN_SHOW', { name, avatarColor: color, dept: dept || undefined });
    setJoined(true);
  };

  const requestMic = () => {
    if (micStatus === 'queued') {
      getSocketSync()?.emit('CANCEL_MIC_REQUEST');
    } else if (micStatus === 'idle' || micStatus === 'denied') {
      getSocketSync()?.emit('REQUEST_MIC', myDept ? { dept: myDept } : {});
    }
  };

  const submitConfession = () => {
    if (!confessionText.trim()) return;
    getSocketSync()?.emit('SUBMIT_CONFESSION', { text: confessionText.trim() });
    setConfessionSent(true);
    setTimeout(() => {
      setShowConfession(false);
      setConfessionText('');
      setConfessionSent(false);
    }, 2000);
  };

  if (!joined) return <JoinGate onJoin={onJoin} />;

  return (
    <main className="h-[100dvh] bg-[#080808] flex flex-col overflow-hidden">
      <audio ref={audioRef} autoPlay playsInline className="hidden" />

      {/* Ambient glow */}
      <AnimatePresence>
        {isLive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none fixed inset-0 z-0"
            style={{ background: 'radial-gradient(ellipse 80% 45% at 50% 0%, rgba(245,158,11,0.08) 0%, transparent 60%)' }}
          />
        )}
      </AnimatePresence>

      {/* ── Header — compact, single row ── */}
      <header className="relative z-10 flex items-center justify-between px-4 py-2.5 border-b border-white/5 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <SwaramLogo size="sm" />
          <span className="text-base font-bold text-white tracking-tight">Swaram</span>
          <OnAirBadge />
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <CountdownTimer />
          {/* Listener count pill */}
          {isLive && (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/5 border border-white/8">
              <IconUsers className="w-3 h-3 text-white/40" />
              <span className="mono text-[10px] text-white/40">{listenerCount}</span>
            </div>
          )}
          {/* Volume toggle */}
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={() => setAudioMuted(!isAudioMuted)}
            id="listener-mute-btn"
            className={`w-8 h-8 rounded-full flex items-center justify-center border transition-all ${
              isAudioMuted
                ? 'bg-red-500/20 border-red-500/40 text-red-400'
                : 'bg-white/5 border-white/10 text-white/50 hover:text-white/80'
            }`}
            title={isAudioMuted ? 'Unmute' : 'Mute'}
          >
            {isAudioMuted ? <IconVolumeX className="w-3.5 h-3.5" /> : <IconVolume className="w-3.5 h-3.5" />}
          </motion.button>
        </div>
      </header>

      {/* Schedule exclusive banner */}
      {joined && <ScheduleBanner />}

      {/* ── Scrollable body ── */}
      <div className="relative z-10 flex-1 overflow-y-auto flex flex-col">

        {/* Hero section */}
        <div className="flex flex-col items-center px-4 pt-4 pb-2 flex-shrink-0">

          {/* Host name strip */}
          <AnimatePresence mode="wait">
            {isLive && hostName ? (
              <motion.div
                key="host"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="flex items-center gap-2.5 mb-4"
              >
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-black font-bold text-xs flex-shrink-0"
                  style={{ background: '#F59E0B' }}
                >
                  {hostName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-white font-semibold text-sm leading-tight">{hostName}</p>
                  <p className="mono text-[9px] text-white/30 uppercase tracking-wider">Host</p>
                </div>
              </motion.div>
            ) : !isLive ? (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-2 mb-4 text-white/20"
              >
                <IconRadio className="w-4 h-4" />
                <span className="mono text-xs">No show live right now</span>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* Circular Visualizer */}
          <CircularVisualizer analyserNode={analyserRef} size={260} />

          {/* Live pulse label */}
          {isLive && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-2 flex items-center gap-1.5"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span className="mono text-[9px] text-amber-400/60 tracking-widest uppercase">Live</span>
            </motion.div>
          )}
        </div>

        {/* Caller on-air card */}
        <AnimatePresence>
          {activeCaller && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 26 }}
              className="mx-4 overflow-hidden"
            >
              <div className="glass-active flex items-center gap-3 px-4 py-2.5 rounded-xl mb-3">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-black font-bold text-xs flex-shrink-0"
                  style={{ backgroundColor: activeCaller.avatarColor }}
                >
                  {activeCaller.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="mono text-[9px] text-amber-400 tracking-widest uppercase mb-0.5">On Air</p>
                  <p className="text-white font-semibold text-sm truncate">{activeCaller.name}</p>
                  {activeCaller.dept && (
                    <p className="mono text-[10px] text-white/35 truncate">{activeCaller.dept}</p>
                  )}
                </div>
                <div className="w-7 h-7 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                  <IconMic className="w-3.5 h-3.5 text-red-400" />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Controls section */}
        <div className="flex-1 px-4 pb-6 flex flex-col gap-3">

          {/* Reactions */}
          <div className="flex justify-center">
            <ReactionBar />
          </div>

          {/* Poll */}
          <PollWidget />

          {/* Mic Request — cautious design */}
          {isLive && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={requestMic}
                disabled={micStatus === 'accepted'}
                id="mic-request-btn"
                className={`w-full relative overflow-hidden rounded-xl border transition-all ${
                  micStatus === 'accepted'
                    ? 'bg-emerald-500/12 border-emerald-500/35'
                    : micStatus === 'queued'
                    ? 'bg-orange-500/10 border-orange-500/30'
                    : micStatus === 'denied'
                    ? 'bg-red-500/10 border-red-500/30'
                    : 'bg-amber-950/40 border-amber-500/20 hover:border-amber-500/45 hover:bg-amber-950/55'
                }`}
              >
                {/* Pulse ring when queued */}
                {micStatus === 'queued' && (
                  <motion.div
                    animate={{ opacity: [0.3, 0.7, 0.3] }}
                    transition={{ duration: 1.8, repeat: Infinity }}
                    className="absolute inset-0 rounded-xl border border-orange-400/30 pointer-events-none"
                  />
                )}

                <div className="px-4 py-3.5 flex items-center gap-3">
                  {/* Icon */}
                  <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${
                    micStatus === 'accepted' ? 'bg-emerald-500/20' :
                    micStatus === 'queued' ? 'bg-orange-500/20' :
                    micStatus === 'denied' ? 'bg-red-500/20' :
                    'bg-amber-500/12'
                  }`}>
                    {micStatus === 'accepted' ? (
                      <div className="w-2.5 h-2.5 rounded-full bg-red-400 animate-pulse" />
                    ) : micStatus === 'queued' ? (
                      <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
                        <IconClock className="w-4 h-4 text-orange-400" />
                      </motion.div>
                    ) : micStatus === 'denied' ? (
                      <IconMicOff className="w-4 h-4 text-red-400" />
                    ) : (
                      <IconAlertTriangle className="w-4 h-4 text-amber-400" />
                    )}
                  </div>

                  {/* Text */}
                  <div className="flex-1 text-left">
                    <p className={`font-semibold text-sm leading-tight ${
                      micStatus === 'accepted' ? 'text-emerald-400' :
                      micStatus === 'queued' ? 'text-orange-400' :
                      micStatus === 'denied' ? 'text-red-400' :
                      'text-amber-300'
                    }`}>
                      {micStatus === 'accepted' ? 'You\'re On Air'
                        : micStatus === 'queued' ? 'Waiting in Queue'
                        : micStatus === 'denied' ? 'Request Declined'
                        : 'Request to Speak'}
                    </p>
                    <p className="mono text-[10px] text-white/30 mt-0.5">
                      {micStatus === 'accepted' ? 'Your mic is live to all listeners'
                        : micStatus === 'queued'
                        ? `${micQueueCount > 1 ? `${micQueueCount} people ahead · ` : ''}Tap to cancel`
                        : micStatus === 'denied' ? 'Tap to try again'
                        : 'Mic access required · Goes live immediately'}
                    </p>
                  </div>

                  {/* Queue badge */}
                  {micStatus === 'queued' && micQueueCount > 0 && (
                    <div className="flex-shrink-0 flex flex-col items-center">
                      <span className="w-8 h-8 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center mono text-xs text-orange-400 font-bold">
                        {micQueueCount}
                      </span>
                      <span className="mono text-[8px] text-white/25 mt-0.5">in queue</span>
                    </div>
                  )}

                  {/* Chevron for idle */}
                  {(micStatus === 'idle' || micStatus === 'denied') && (
                    <svg className="w-4 h-4 text-amber-500/50 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </div>
              </motion.button>

              {/* Disclaimer */}
              {(micStatus === 'idle' || micStatus === 'denied') && (
                <div className="mt-1.5 flex items-center justify-center gap-1.5">
                  <IconAlertTriangle className="w-3 h-3 text-white/20" />
                  <p className="mono text-[9px] text-white/20 tracking-wide">
                    Your voice will be broadcast to all listeners
                  </p>
                </div>
              )}

              {/* Queue count shown to everyone when there's a queue */}
              {micStatus !== 'accepted' && micQueueCount > 0 && micStatus !== 'queued' && (
                <div className="mt-1.5 flex items-center justify-center gap-1.5">
                  <IconUsers className="w-3 h-3 text-amber-400/40" />
                  <p className="mono text-[9px] text-amber-400/40">
                    {micQueueCount} {micQueueCount === 1 ? 'person' : 'people'} waiting to speak
                  </p>
                </div>
              )}
            </motion.div>
          )}

          {/* Anonymous Confession */}
          {isLive && (
            <div>
              <button
                onClick={() => setShowConfession(!showConfession)}
                id="confession-btn"
                className={`w-full py-3 rounded-xl border flex items-center justify-center gap-2 text-sm transition-all ${
                  showConfession
                    ? 'bg-white/8 border-white/15 text-white/70'
                    : 'border-white/8 text-white/30 hover:text-white/55 hover:border-white/12'
                }`}
              >
                <IconMail className="w-4 h-4" />
                <span>Send Anonymous Confession</span>
              </button>

              <AnimatePresence>
                {showConfession && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="glass mt-2 p-4 flex flex-col gap-3 rounded-xl">
                      <textarea
                        value={confessionText}
                        onChange={(e) => setConfessionText(e.target.value.slice(0, 280))}
                        placeholder="Your anonymous message... host reads it on air."
                        rows={3}
                        id="confession-input"
                        className="w-full bg-transparent text-white text-sm placeholder-white/20 resize-none focus:outline-none leading-relaxed"
                      />
                      <div className="flex justify-between items-center">
                        <span className="mono text-[10px] text-white/20">{confessionText.length}/280</span>
                        <button
                          onClick={submitConfession}
                          disabled={confessionSent || !confessionText.trim()}
                          id="confession-send-btn"
                          className="mono text-xs px-4 py-2 bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 transition-colors disabled:opacity-40 rounded-lg"
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
        </div>
      </div>

      {/* Global overlays */}
      <ReactionLayer />
      <ConfessionOverlay />
    </main>
  );
}
