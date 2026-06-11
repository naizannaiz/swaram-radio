// store/radioStore.ts
import { create } from 'zustand';

export interface Listener {
  id: string;
  name: string;
  avatarColor: string;
  role: string;
}

export interface MicRequest {
  listenerId: string;
  name: string;
  avatarColor: string;
  dept?: string;
  requestedAt: number;
}

export interface Poll {
  id: string;
  question: string;
  options: { id: string; label: string; votes: number }[];
  createdAt: number;
  closedAt?: number;
}

export interface ScheduleSlot {
  id: string;
  dayOfWeek: number;
  startTime: string;
  durationMin: number;
  showName: string;
  hostName: string;
  description?: string;
}

export interface CallerInfo {
  name: string;
  dept?: string;
  avatarColor: string;
}

export interface Confession {
  id: string;
  text: string;
  createdAt: number;
  readAt?: number;
}

export interface ReactionItem {
  id: string;
  emoji: string;
  fromName: string;
}

interface RadioState {
  // Identity
  myName: string;
  myAvatarColor: string;
  myDept: string;
  myRole: 'listener' | 'caller' | 'cohost' | 'host' | null;
  isAuthenticated: boolean;

  // Show state
  isLive: boolean;
  hostName: string;
  listenerCount: number;

  // Caller
  activeCaller: CallerInfo | null;
  micRequestStatus: 'idle' | 'queued' | 'accepted' | 'denied';

  // Reactions
  reactions: ReactionItem[];

  // Poll
  activePoll: Poll | null;
  hasVoted: boolean;

  // Confessions (host only)
  confessions: Confession[];

  // Schedule
  schedule: ScheduleSlot[];

  // Timer
  timerRemaining: number;

  // Host queue (host only)
  micQueue: MicRequest[];

  // Mute state
  isMicMuted: boolean;      // host: disables mic track (true mute)
  isAudioMuted: boolean;    // listener: silences audio output

  // Public queue state (visible to all listeners)
  micQueueCount: number;    // how many people are in the queue

  // Setters
  setIdentity: (name: string, color: string, dept?: string) => void;
  setRole: (role: RadioState['myRole']) => void;
  setAuthenticated: (v: boolean) => void;
  setIsLive: (v: boolean) => void;
  setHostName: (n: string) => void;
  setListenerCount: (n: number) => void;
  setActiveCaller: (c: CallerInfo | null) => void;
  setMicRequestStatus: (s: RadioState['micRequestStatus']) => void;
  addReaction: (r: ReactionItem) => void;
  removeReaction: (id: string) => void;
  setActivePoll: (p: Poll | null) => void;
  updatePoll: (p: Poll) => void;
  setHasVoted: (v: boolean) => void;
  addConfession: (c: Confession) => void;
  markConfessionRead: (id: string) => void;
  setSchedule: (s: ScheduleSlot[]) => void;
  setTimerRemaining: (n: number) => void;
  setMicQueue: (q: MicRequest[]) => void;
  addMicRequest: (r: MicRequest) => void;
  removeMicRequest: (listenerId: string) => void;
  setMicMuted: (v: boolean) => void;
  setAudioMuted: (v: boolean) => void;
  setMicQueueCount: (n: number) => void;
}

export const useRadioStore = create<RadioState>((set) => ({
  myName: '',
  myAvatarColor: '#F59E0B',
  myDept: '',
  myRole: null,
  isAuthenticated: false,

  isLive: false,
  hostName: '',
  listenerCount: 0,

  activeCaller: null,
  micRequestStatus: 'idle',

  reactions: [],

  activePoll: null,
  hasVoted: false,

  confessions: [],
  schedule: [],
  timerRemaining: 0,
  micQueue: [],

  isMicMuted: false,
  isAudioMuted: false,
  micQueueCount: 0,

  setIdentity: (name, color, dept = '') => set({ myName: name, myAvatarColor: color, myDept: dept }),
  setRole: (role) => set({ myRole: role }),
  setAuthenticated: (v) => set({ isAuthenticated: v }),
  setIsLive: (v) => set({ isLive: v }),
  setHostName: (n) => set({ hostName: n }),
  setListenerCount: (n) => set({ listenerCount: n }),
  setActiveCaller: (c) => set({ activeCaller: c }),
  setMicRequestStatus: (s) => set({ micRequestStatus: s }),

  addReaction: (r) =>
    set((state) => ({ reactions: [...state.reactions, r] })),
  removeReaction: (id) =>
    set((state) => ({ reactions: state.reactions.filter((r) => r.id !== id) })),

  setActivePoll: (p) => set({ activePoll: p, hasVoted: false }),
  updatePoll: (p) => set({ activePoll: p }),
  setHasVoted: (v) => set({ hasVoted: v }),

  addConfession: (c) =>
    set((state) => ({ confessions: [c, ...state.confessions] })),
  markConfessionRead: (id) =>
    set((state) => ({
      confessions: state.confessions.map((c) =>
        c.id === id ? { ...c, readAt: Date.now() } : c
      ),
    })),

  setSchedule: (s) => set({ schedule: s }),
  setTimerRemaining: (n) => set({ timerRemaining: n }),
  setMicQueue: (q) => set({ micQueue: q }),
  addMicRequest: (r) =>
    set((state) => ({ micQueue: [...state.micQueue, r] })),
  removeMicRequest: (listenerId) =>
    set((state) => ({
      micQueue: state.micQueue.filter((r) => r.listenerId !== listenerId),
    })),
  setMicMuted: (v) => set({ isMicMuted: v }),
  setAudioMuted: (v) => set({ isAudioMuted: v }),
  setMicQueueCount: (n) => set({ micQueueCount: n }),
}));
