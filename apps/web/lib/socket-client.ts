// lib/socket-client.ts
import { io, Socket } from 'socket.io-client';

interface RegisteredListener {
  event: string;
  fn: (...args: any[]) => void;
  once?: boolean;
}

let realSocket: Socket | null = null;
let serverUrl: string | null = null;
let connectPromise: Promise<Socket> | null = null;

const listeners: RegisteredListener[] = [];
const emitQueue: { event: string; args: any[] }[] = [];

// A transparent proxy wrapper that mimics the Socket.IO Socket interface
const socketProxy = new Proxy({} as Socket, {
  get(target, prop, receiver) {
    if (prop === 'connected') {
      return realSocket ? realSocket.connected : false;
    }
    if (prop === 'id') {
      return realSocket ? realSocket.id : undefined;
    }

    if (prop === 'on' || prop === 'addListener') {
      return (event: string, fn: (...args: any[]) => void) => {
        listeners.push({ event, fn });
        if (realSocket) {
          realSocket.on(event, fn);
        }
        return socketProxy;
      };
    }

    if (prop === 'once') {
      return (event: string, fn: (...args: any[]) => void) => {
        const wrapped = (...args: any[]) => {
          const idx = listeners.findIndex(l => l.event === event && l.fn === wrapped);
          if (idx !== -1) listeners.splice(idx, 1);
          fn(...args);
        };
        listeners.push({ event, fn: wrapped, once: true });
        if (realSocket) {
          realSocket.once(event, wrapped);
        }
        return socketProxy;
      };
    }

    if (prop === 'off' || prop === 'removeListener') {
      return (event: string, fn: (...args: any[]) => void) => {
        const idx = listeners.findIndex(l => l.event === event && l.fn === fn);
        if (idx !== -1) listeners.splice(idx, 1);
        if (realSocket) {
          realSocket.off(event, fn);
        }
        return socketProxy;
      };
    }

    if (prop === 'removeAllListeners') {
      return (event?: string) => {
        if (event) {
          for (let i = listeners.length - 1; i >= 0; i--) {
            if (listeners[i].event === event) listeners.splice(i, 1);
          }
        } else {
          listeners.length = 0;
        }
        if (realSocket) {
          realSocket.removeAllListeners(event);
        }
        return socketProxy;
      };
    }

    if (prop === 'emit') {
      return (event: string, ...args: any[]) => {
        if (realSocket) {
          realSocket.emit(event, ...args);
        } else {
          emitQueue.push({ event, args });
        }
        return socketProxy;
      };
    }

    if (prop === 'connect') {
      return () => {
        connectSocket();
        return socketProxy;
      };
    }

    if (prop === 'disconnect') {
      return () => {
        disconnectSocket();
        return socketProxy;
      };
    }

    const value = realSocket ? Reflect.get(realSocket, prop) : Reflect.get(target, prop);
    if (typeof value === 'function') {
      return value.bind(realSocket || target);
    }
    return value;
  }
});

function initRealSocket(url: string) {
  if (realSocket) {
    realSocket.removeAllListeners();
    realSocket.disconnect();
  }

  realSocket = io(url, {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
  });

  // Re-register all listeners in the registry
  for (const { event, fn, once } of listeners) {
    if (once) {
      realSocket.once(event, fn);
    } else {
      realSocket.on(event, fn);
    }
  }

  // Play queued emissions
  while (emitQueue.length > 0) {
    const { event, args } = emitQueue.shift()!;
    realSocket.emit(event, ...args);
  }
}

export function getSocket(): Socket {
  return socketProxy;
}

export function getSocketSync(): Socket | null {
  return realSocket ? socketProxy : null;
}

export function connectSocket(): Promise<Socket> {
  if (connectPromise) return connectPromise;

  connectPromise = (async () => {
    try {
      const res = await fetch('/api/server-url');
      if (!res.ok) {
        throw new Error(`Failed to fetch server URL: ${res.statusText}`);
      }
      const data = await res.json();
      if (!data.url) {
        throw new Error('No server URL returned from API');
      }

      serverUrl = data.url;
      initRealSocket(serverUrl!);

      if (realSocket && !realSocket.connected) {
        realSocket.connect();
      }

      return socketProxy;
    } catch (err) {
      console.error('Failed to initialize socket connection, falling back:', err);
      const fallbackUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3001';
      serverUrl = fallbackUrl;
      initRealSocket(fallbackUrl);
      if (realSocket && !realSocket.connected) {
        realSocket.connect();
      }
      return socketProxy;
    }
  })();

  return connectPromise;
}

export function disconnectSocket(): void {
  if (realSocket) {
    realSocket.disconnect();
    realSocket = null;
  }
  connectPromise = null;
}

export async function getServerUrlAsync(): Promise<string> {
  if (!serverUrl) {
    await connectSocket();
  }
  return serverUrl || process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3001';
}
