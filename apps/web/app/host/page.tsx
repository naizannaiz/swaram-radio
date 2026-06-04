'use client';
// app/host/page.tsx — Host Dashboard
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSocket } from '@/hooks/useSocket';
import { useHostLiveKit } from '@/hooks/useLiveKit';
import { useRadioStore } from '@/store/radioStore';
import { connectSocket } from '@/lib/socket-client';
import { OnAirBadge } from '@/components/broadcast/OnAirBadge';
import { SwaramLogo } from '@/components/broadcast/SwaramLogo';
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
  const { connectAndGoLive } = useHostLiveKit();
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

  const socket = connectSocket();

  // Auth — also stores password for LiveKit host token request
  const authenticate = () => {
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
    socket.emit('START_SHOW');
    // Connect to LiveKit and publish mic when host goes live
    const storedPass = sessionStorage.getItem('swaram_host_pass') || '';
    const storedName = sessionStorage.getItem('swaram_host_name') || hostName;
    connectAndGoLive(storedName, storedPass);
  };
  const endShow = () => { if (confirm('End the show?')) socket.emit('END_SHOW'); };

  // Caller controls
  const acceptCaller = (listenerId: string) => socket.emit('ACCEPT_CALLER', { listenerId });
  const denyCaller = (listenerId: string) => socket.emit('DENY_CALLER', { listenerId });
  const cutCaller = () => socket.emit('CUT_CALLER');

  // Timer
  const setTimer = (seconds: number) => socket.emit('SET_TIMER', { seconds });
  const clearTimer = () => socket.emit('SET_TIMER', { seconds: 0 });

  // Poll
  const createPoll = () => {
    const opts = pollOptions.filter((o) => o.trim());
    if (!pollQuestion.trim() || opts.length < 2) return;
    socket.emit('CREATE_POLL', { question: pollQuestion, options: opts });
    setPollQuestion('');
    setPollOptions(['', '']);
  };

  // Confession
  const readConfession = (id: string) => socket.emit('READ_CONFESSION', { confessionId: id });

  // Schedule
  const addScheduleSlot = () => {
    if (!newSlot.showName.trim() || !newSlot.hostName.trim()) return;
    socket.emit('ADD_SCHEDULE_SLOT', newSlot);
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
              className="w-full bg-amber-500 text-black font-bold py-3.5 text-sm tracking-wide hover:bg-amber-400 transition-colors"
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
      <header className="border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <SwaramLogo size="sm" />
          <h1 className="text-xl font-bold text-white">Swaram Studio</h1>
          <OnAirBadge />
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

      {/* Overlays */}
      <CallerIDCard />
      <ReactionLayer />
      <ConfessionOverlay />
    </main>
  );
}
