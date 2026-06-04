// src/rooms/RadioRoom.ts
import { Server } from 'socket.io';

export type UserRole = 'listener' | 'caller' | 'cohost' | 'host';

export interface Listener {
  id: string;
  name: string;
  avatarColor: string;
  dept?: string;
  role: UserRole;
  joinedAt: number;
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

export interface Confession {
  id: string;
  text: string;
  createdAt: number;
  readAt?: number;
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

export class RadioRoom {
  isLive = false;
  hostSocketId: string | null = null;
  cohostSocketId: string | null = null;
  hostName = '';

  listeners = new Map<string, Listener>();
  micQueue: MicRequest[] = [];
  activeCaller: MicRequest | null = null;

  polls: Poll[] = [];
  activePoll: Poll | null = null;

  confessions: Confession[] = [];

  schedule: ScheduleSlot[] = [];

  timerInterval: ReturnType<typeof setInterval> | null = null;
  timerRemaining = 0;

  get listenerCount(): number {
    return this.listeners.size;
  }

  addListener(id: string, name: string, avatarColor: string, dept?: string): Listener {
    const listener: Listener = {
      id,
      name,
      avatarColor,
      dept,
      role: 'listener',
      joinedAt: Date.now(),
    };
    this.listeners.set(id, listener);
    return listener;
  }

  removeListener(id: string, io: Server): void {
    const listener = this.listeners.get(id);
    if (!listener) return;

    // If host disconnects, end show
    if (id === this.hostSocketId) {
      this.isLive = false;
      this.hostSocketId = null;
      this.hostName = '';
      this.activeCaller = null;
      this.micQueue = [];
      io.emit('SHOW_ENDED', { reason: 'host_disconnected' });
    }

    // If cohost disconnects
    if (id === this.cohostSocketId) {
      this.cohostSocketId = null;
    }

    // If active caller disconnects
    if (this.activeCaller?.listenerId === id) {
      this.activeCaller = null;
      io.emit('CALLER_DISCONNECTED', { reason: 'caller_left' });
    }

    // Remove from mic queue
    this.micQueue = this.micQueue.filter((r) => r.listenerId !== id);

    this.listeners.delete(id);

    io.emit('LISTENER_COUNT', { count: this.listenerCount });
  }

  isHost(socketId: string): boolean {
    return socketId === this.hostSocketId;
  }

  isCohost(socketId: string): boolean {
    return socketId === this.cohostSocketId;
  }

  isHostOrCohost(socketId: string): boolean {
    return this.isHost(socketId) || this.isCohost(socketId);
  }
}
