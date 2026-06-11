// lib/socket-client.ts
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;
let initPromise: Promise<Socket> | null = null;

/** Fetch current server URL from /api/server-url (reads Supabase radio_config at runtime).
 *  Falls back to NEXT_PUBLIC_SERVER_URL for local dev. */
async function resolveServerUrl(): Promise<string> {
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3001';
  }
  try {
    const res = await fetch('/api/server-url', { cache: 'no-store' });
    if (!res.ok) throw new Error('status ' + res.status);
    const { url } = await res.json();
    return url;
  } catch {
    // Fallback: use env var (local dev or if Supabase is unreachable)
    return process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3001';
  }
}

/** Async — resolves URL, creates + connects socket singleton.
 *  Safe to call multiple times; reuses the same promise/socket. */
export async function connectSocket(): Promise<Socket> {
  if (!initPromise) {
    initPromise = resolveServerUrl().then((url) => {
      socket = io(url, {
        path: '/socket.io',
        transports: ['websocket', 'polling'],
        autoConnect: false,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
      });
      return socket;
    });
  }
  const s = await initPromise;
  if (!s.connected) s.connect();
  return s;
}

/** Sync — returns socket if already initialised, null otherwise.
 *  Use in click handlers — by the time a user clicks anything,
 *  the async init (< 500 ms) is always done. */
export function getSocketSync(): Socket | null {
  return socket;
}

/** Disconnect and reset singleton (called on unmount). */
export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
  initPromise = null;
}
