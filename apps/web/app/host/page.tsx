'use client';
// app/host/page.tsx — Host Dashboard
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSocket } from '@/hooks/useSocket';
import { useHostLiveKit } from '@/hooks/useLiveKit';
import { useRadioStore } from '@/store/radioStore';
import { connectSocket, getSocketSync } from '@/lib/socket-client';
import { OnAirBadge } from '@/components/broadcast/OnAirBadge';
import { SwaramLogo } from '@/components/broadcast/SwaramLogo';
import { CircularVisualizer } from '@/components/broadcast/CircularVisualizer';
import { CountdownTimer } from '@/components/controls/CountdownTimer';
import { CallerIDCard } from '@/components/broadcast/CallerIDCard';
import { ConfessionOverlay } from '@/components/confessions/ConfessionOverlay';
import { ReactionLayer } from '@/components/reactions/ReactionLayer';

const TIMER_PRESETS = [
  { label: '5 min', seconds: 300 },
  { label: '10 min', seconds: 600 },
  { label: '15 min', seconds: 900 },
  { label: '30 min', seconds: 1800 },
];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function HostPage() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState('');
  const [hostName, setHostName] = useState('');
  const [authError, setAuthError] = useState('');

  useSocket();
  const { connectAndGoLive, analyserRef, toggleMicMute } = useHostLiveKit();
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);

  // Schedule editor
  const [newSlot, setNewSlot] = useState({
    dayOfWeek: 1,
    startTime: '18:00',
    durationMin: 60,
    showName: '',
    hostName: '',
    description: '',
  });

  const isLive = useRadioStore((s) => s.isLive);
  const micQueue = useRadioStore((s) => s.micQueue);
  const confessions = useRadioStore((s) => s.confessions);
  const unreadConfessions = confessions.filter((c) => !c.readAt);
  const activePoll = useRadioStore((s) => s.activePoll);
  const schedule = useRadioStore((s) => s.schedule);
  const isMicMuted = useRadioStore((s) => s.isMicMuted);

  const [socketReady, setSocketReady] = useState(false);
  useEffect(() => {
    connectSocket().then(() => setSocketReady(true));
  }, []);

  // Socket is always initialised by the time user interacts (async < 500ms).

  // Auth — also stores password for LiveKit host token request
  const authenticate = () => {
    const socket = getSocketSync();
    if (!socket) return;
    socket.connect();
    socket.emit('HOST_AUTH', { password, hostName: hostName.trim() });
    socket.once('HOST_AUTH_RESULT', (data: { success: boolean; error?: string }) => {
      if (data.success) {
        // Store for LiveKit host token fetch (never sent to browser bundle)
        sessionStorage.setItem('swaram_host_pass', password);
        sessionStorage.setItem('swaram_host_name', hostName.trim());
        setAuthed(true);
      } else {
        setAuthError(data.error || 'Authentication failed');
      }
    });
  };

  // Show controls
  const startShow = () => {
    getSocketSync()?.emit('START_SHOW');
    const storedPass = sessionStorage.getItem('swaram_host_pass') || '';
    const storedName = sessionStorage.getItem('swaram_host_name') || hostName;
    connectAndGoLive(storedName, storedPass);
  };
  const endShow = () => { if (confirm('End the show?')) getSocketSync()?.emit('END_SHOW'); };

  // Caller controls
  const acceptCaller = (listenerId: string) => getSocketSync()?.emit('ACCEPT_CALLER', { listenerId });
  const denyCaller = (listenerId: string) => getSocketSync()?.emit('DENY_CALLER', { listenerId });
  const cutCaller = () => getSocketSync()?.emit('CUT_CALLER');

  // Timer
  const setTimer = (seconds: number) => getSocketSync()?.emit('SET_TIMER', { seconds });
  const clearTimer = () => getSocketSync()?.emit('SET_TIMER', { seconds: 0 });

  // Poll
  const createPoll = () => {
    const opts = pollOptions.filter((o) => o.trim());
    if (!pollQuestion.trim() || opts.length < 2) return;
    getSocketSync()?.emit('CREATE_POLL', { question: pollQuestion, options: opts });
    setPollQuestion('');
    setPollOptions(['', '']);
  };

  // Confession
  const readConfession = (id: string) => getSocketSync()?.emit('READ_CONFESSION', { confessionId: id });

  // Schedule
  const addScheduleSlot = () => {
    if (!newSlot.showName.trim() || !newSlot.hostName.trim()) return;
    getSocketSync()?.emit('ADD_SCHEDULE_SLOT', newSlot);
    setNewSlot({ dayOfWeek: 1, startTime: '18:00', durationMin: 60, showName: '', hostName: '', description: '' });
  };

  // Login gate
  if (!authed) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4 bg-[#080808]">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass w-full max-w-sm p-8 flex flex-col items-center"
        >
          <div className="mb-4">
            <SwaramLogo size="md" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-1 text-center">Host Login</h1>
          <p className="mono text-xs text-white/30 tracking-wider mb-8 text-center">SWARAM STUDIO</p>

          <div className="flex flex-col gap-4">
            <input
              type="text"
              value={hostName}
              onChange={(e) => setHostName(e.target.value)}
              placeholder="Your host name"
              className="w-full bg-white/5 border border-white/10 px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-amber-500/50 transition-colors text-sm"
              id="host-name-input"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && authenticate()}
              placeholder="Password"
              className="w-full bg-white/5 border border-white/10 px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-amber-500/50 transition-colors text-sm"
              id="host-password-input"
            />
            {authError && (
              <p className="mono text-xs text-red-400">{authError}</p>
            )}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={authenticate}
              disabled={!socketReady || !hostName.trim() || !password}
              className="w-full bg-amber-500 text-black font-bold py-3.5 text-sm tracking-wide hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              id="host-login-btn"
            >
              ENTER STUDIO
            </motion.button>
          </div>
        </motion.div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#080808] flex flex-col">
      {/* Top bar */}
      <header className="border-b border-white/5 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <SwaramLogo size="sm" />
          <h1 className="text-xl font-bold text-white">Swaram Studio</h1>
          <OnAirBadge />
          {/* Mini host mic visualizer — shows when live */}
          {isLive && (
            <div className="ml-1 flex items-center gap-2">
              <CircularVisualizer analyserNode={analyserRef} size={40} compact />
              <span className={`mono text-[10px] tracking-wide ${
                isMicMuted ? 'text-red-400' : 'text-amber-400/60'
              }`}>
                {isMicMuted ? 'MUTED' : 'LIVE MIC'}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-4">
          <CountdownTimer />
          {!isLive ? (
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={startShow}
              className="bg-amber-500 text-black font-bold px-6 py-2.5 text-sm tracking-wide hover:bg-amber-400 transition-colors"
              id="go-live-btn"
            >
              ● GO LIVE
            </motion.button>
          ) : (
            <button
              onClick={endShow}
              className="border border-red-500/30 text-red-400 font-bold px-6 py-2.5 text-sm hover:bg-red-500/10 transition-colors"
              id="end-show-btn"
            >
              ■ END SHOW
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Caller Queue + Active Caller */}
        <div className="w-80 border-r border-white/5 p-5 overflow-y-auto flex flex-col gap-5">

          {/* Mic Queue */}
          <section>
            <span className="mono text-[10px] text-white/30 tracking-[0.2em] uppercase block mb-3">
              Mic Queue ({micQueue.length})
            </span>
            <div className="flex flex-col gap-2">
              <AnimatePresence>
                {micQueue.map((req) => (
                  <motion.div
                    key={req.listenerId}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="glass flex items-center gap-3 p-3"
                  >
                    <div
                      className="w-8 h-8 flex items-center justify-center text-black font-bold text-sm flex-shrink-0"
                      style={{ backgroundColor: req.avatarColor }}
                    >
                      {req.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-medium truncate">{req.name}</p>
                      {req.dept && (
                        <p className="mono text-[10px] text-white/30 truncate">{req.dept}</p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => acceptCaller(req.listenerId)}
                        className="w-7 h-7 bg-amber-500/20 text-amber-400 hover:bg-amber-500/40 transition-colors text-xs font-bold"
                        aria-label="Accept"
                        id={`accept-${req.listenerId}`}
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => denyCaller(req.listenerId)}
                        className="w-7 h-7 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors text-xs"
                        aria-label="Deny"
                        id={`deny-${req.listenerId}`}
                      >
                        ✕
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {micQueue.length === 0 && (
                <p className="mono text-xs text-white/15 text-center py-4">No requests</p>
              )}
            </div>

            {/* Cut caller */}
            <button
              onClick={cutCaller}
              className="mt-3 w-full mono text-xs py-2 border border-red-500/20 text-red-400/60 hover:text-red-400 hover:border-red-500/40 transition-colors"
              id="cut-caller-btn"
            >
              Cut Current Caller
            </button>
          </section>

          {/* Timer */}
          <section>
            <span className="mono text-[10px] text-white/30 tracking-[0.2em] uppercase block mb-3">
              Timer
            </span>
            <div className="grid grid-cols-2 gap-2">
              {TIMER_PRESETS.map((p) => (
                <button
                  key={p.seconds}
                  onClick={() => setTimer(p.seconds)}
                  className="glass py-2 text-xs text-white/60 hover:text-amber-400 hover:border-amber-500/30 transition-colors"
                  id={`timer-${p.seconds}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <button
              onClick={clearTimer}
              className="mt-2 w-full mono text-[10px] text-white/20 hover:text-white/40 transition-colors py-1.5"
            >
              Clear Timer
            </button>
          </section>
        </div>

        {/* Center: Confessions + Poll Creator */}
        <div className="flex-1 p-5 overflow-y-auto flex flex-col gap-5">

          {/* Confessions */}
          <section>
            <span className="mono text-[10px] text-white/30 tracking-[0.2em] uppercase block mb-3">
              Confessions ({unreadConfessions.length} unread)
            </span>
            <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
              <AnimatePresence>
                {unreadConfessions.map((c) => (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="glass p-4 flex items-start gap-3"
                  >
                    <p className="flex-1 text-sm text-white/70 italic leading-relaxed">
                      &ldquo;{c.text}&rdquo;
                    </p>
                    <button
                      onClick={() => readConfession(c.id)}
                      className="flex-shrink-0 mono text-[10px] px-3 py-1.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 transition-colors"
                      id={`read-confession-${c.id}`}
                    >
                      Read On Air
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
              {unreadConfessions.length === 0 && (
                <p className="mono text-xs text-white/15 text-center py-4">No confessions yet</p>
              )}
            </div>
          </section>

          {/* Poll Creator */}
          <section>
            <span className="mono text-[10px] text-white/30 tracking-[0.2em] uppercase block mb-3">
              Create Poll
            </span>
            {activePoll ? (
              <div className="glass p-4">
                <p className="text-sm text-amber-400 mono">Poll active: &ldquo;{activePoll.question}&rdquo;</p>
                <p className="mono text-[10px] text-white/30 mt-1">
                  Total votes: {activePoll.options.reduce((a, o) => a + o.votes, 0)}
                </p>
              </div>
            ) : (
              <div className="glass p-4 flex flex-col gap-3">
                <input
                  type="text"
                  value={pollQuestion}
                  onChange={(e) => setPollQuestion(e.target.value.slice(0, 120))}
                  placeholder="Poll question..."
                  className="w-full bg-transparent border-b border-white/10 pb-2 text-white text-sm placeholder-white/20 focus:outline-none focus:border-amber-500/30 transition-colors"
                  id="poll-question-input"
                />
                {pollOptions.map((opt, i) => (
                  <input
                    key={i}
                    type="text"
                    value={opt}
                    onChange={(e) => {
                      const next = [...pollOptions];
                      next[i] = e.target.value.slice(0, 60);
                      setPollOptions(next);
                    }}
                    placeholder={`Option ${i + 1}`}
                    className="w-full bg-transparent border-b border-white/10 pb-2 text-white text-sm placeholder-white/20 focus:outline-none focus:border-amber-500/30 transition-colors"
                    id={`poll-option-${i}`}
                  />
                ))}
                <div className="flex gap-2">
                  {pollOptions.length < 4 && (
                    <button
                      onClick={() => setPollOptions([...pollOptions, ''])}
                      className="mono text-[10px] text-white/30 hover:text-white/50 transition-colors"
                    >
                      + Add Option
                    </button>
                  )}
                  <button
                    onClick={createPoll}
                    className="ml-auto mono text-xs px-4 py-2 bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 transition-colors"
                    id="create-poll-btn"
                  >
                    Launch Poll
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Right: Schedule Editor */}
        <div className="w-80 border-l border-white/5 p-5 overflow-y-auto">
          <span className="mono text-[10px] text-white/30 tracking-[0.2em] uppercase block mb-4">
            Schedule Editor
          </span>

          {/* Add slot form */}
          <div className="glass p-4 flex flex-col gap-3 mb-4">
            <select
              value={newSlot.dayOfWeek}
              onChange={(e) => setNewSlot({ ...newSlot, dayOfWeek: Number(e.target.value) })}
              className="bg-white/5 border border-white/10 px-3 py-2 text-white text-sm focus:outline-none"
              id="schedule-day"
            >
              {DAYS.map((d, i) => (
                <option key={d} value={i} className="bg-[#080808]">{d}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <input
                type="time"
                value={newSlot.startTime}
                onChange={(e) => setNewSlot({ ...newSlot, startTime: e.target.value })}
                className="flex-1 bg-white/5 border border-white/10 px-3 py-2 text-white text-sm focus:outline-none"
                id="schedule-time"
              />
              <input
                type="number"
                value={newSlot.durationMin}
                onChange={(e) => setNewSlot({ ...newSlot, durationMin: Number(e.target.value) })}
                min={15}
                max={300}
                className="w-20 bg-white/5 border border-white/10 px-3 py-2 text-white text-sm focus:outline-none"
                id="schedule-duration"
                placeholder="Min"
              />
            </div>
            <input
              type="text"
              value={newSlot.showName}
              onChange={(e) => setNewSlot({ ...newSlot, showName: e.target.value })}
              placeholder="Show name"
              className="bg-white/5 border border-white/10 px-3 py-2 text-white text-sm placeholder-white/20 focus:outline-none"
              id="schedule-show-name"
            />
            <input
              type="text"
              value={newSlot.hostName}
              onChange={(e) => setNewSlot({ ...newSlot, hostName: e.target.value })}
              placeholder="Host name"
              className="bg-white/5 border border-white/10 px-3 py-2 text-white text-sm placeholder-white/20 focus:outline-none"
              id="schedule-host-name"
            />
            <input
              type="text"
              value={newSlot.description}
              onChange={(e) => setNewSlot({ ...newSlot, description: e.target.value })}
              placeholder="Description (optional)"
              className="bg-white/5 border border-white/10 px-3 py-2 text-white text-sm placeholder-white/20 focus:outline-none"
              id="schedule-description"
            />
            <button
              onClick={addScheduleSlot}
              className="w-full mono text-xs py-2.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 transition-colors"
              id="add-schedule-btn"
            >
              Add to Schedule
            </button>
          </div>

          {/* Current schedule */}
          <div className="flex flex-col gap-1">
            {schedule.map((slot) => (
              <div key={slot.id} className="flex items-center gap-2 p-2 border border-white/5 text-xs">
                <span className="mono text-white/30">{DAYS[slot.dayOfWeek]} {slot.startTime}</span>
                <span className="text-white/60 flex-1 truncate">{slot.showName}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Google Meet-style bottom call toolbar ── */}
      {isLive && (
        <div className="border-t border-white/5 bg-[#080808] px-6 py-3 flex items-center justify-center gap-3">

          {/* Live status pill */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 mr-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="mono text-[10px] text-red-400 tracking-widest">ON AIR</span>
          </div>

          {/* Mute Mic */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={toggleMicMute}
            id="host-mute-btn"
            title={isMicMuted ? 'Unmute Mic' : 'Mute Mic'}
            className={`group relative flex flex-col items-center gap-1 px-4 py-2.5 rounded-xl border transition-all ${
              isMicMuted
                ? 'bg-red-500/20 border-red-500/50 text-red-400'
                : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white'
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              {isMicMuted ? (
                <>
                  <line x1="1" y1="1" x2="23" y2="23" />
                  <path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6" />
                  <path d="M17 16.95A7 7 0 015 12v-2m14 0v2a7 7 0 01-.11 1.23" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </>
              ) : (
                <>
                  <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                  <path d="M19 10v2a7 7 0 01-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </>
              )}
            </svg>
            <span className="text-[10px] mono">{isMicMuted ? 'Unmute' : 'Mute'}</span>
          </motion.button>

          {/* Cut Caller */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={cutCaller}
            id="cut-caller-toolbar-btn"
            title="Cut Current Caller"
            className="group flex flex-col items-center gap-1 px-4 py-2.5 rounded-xl border bg-white/5 border-white/10 text-white/70 hover:bg-orange-500/15 hover:border-orange-500/30 hover:text-orange-400 transition-all"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            <span className="text-[10px] mono">Cut</span>
          </motion.button>

          {/* Timer quick-set */}
          <div className="relative group">
            <button
              className="flex flex-col items-center gap-1 px-4 py-2.5 rounded-xl border bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white transition-all"
              title="Set Timer"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span className="text-[10px] mono">Timer</span>
            </button>
            {/* Dropdown on hover */}
            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col gap-1 bg-[#111] border border-white/10 p-2 rounded-xl shadow-2xl z-50">
              {TIMER_PRESETS.map((p) => (
                <button
                  key={p.seconds}
                  onClick={() => setTimer(p.seconds)}
                  className="px-4 py-1.5 text-xs text-white/70 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors whitespace-nowrap"
                  id={`timer-${p.seconds}`}
                >
                  {p.label}
                </button>
              ))}
              <button
                onClick={clearTimer}
                className="px-4 py-1.5 text-xs text-white/30 hover:text-white/60 rounded-lg transition-colors"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Raise Hand / Queue count badge */}
          <div className="flex flex-col items-center gap-1 px-4 py-2.5 rounded-xl border bg-white/5 border-white/10 text-white/50">
            <div className="relative">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3" />
              </svg>
              {micQueue.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-black text-[9px] font-bold flex items-center justify-center">
                  {micQueue.length}
                </span>
              )}
            </div>
            <span className="text-[10px] mono">Queue</span>
          </div>

          {/* Confessions badge */}
          <div className="flex flex-col items-center gap-1 px-4 py-2.5 rounded-xl border bg-white/5 border-white/10 text-white/50">
            <div className="relative">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              {unreadConfessions.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                  {unreadConfessions.length}
                </span>
              )}
            </div>
            <span className="text-[10px] mono">DMs</span>
          </div>

          <div className="w-px h-8 bg-white/8 mx-1" />

          {/* End Show */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={endShow}
            id="end-show-toolbar-btn"
            title="End Show"
            className="flex flex-col items-center gap-1 px-4 py-2.5 rounded-xl border bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20 transition-all"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
            <span className="text-[10px] mono">End</span>
          </motion.button>
        </div>
      )}

      {/* Overlays */}
      <CallerIDCard />
      <ReactionLayer />
      <ConfessionOverlay />
    </main>
  );
}
