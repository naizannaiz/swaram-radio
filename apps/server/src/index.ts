// src/index.ts
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { registerBroadcastHandlers } from './handlers/broadcast';
import { registerCallerHandlers } from './handlers/callers';
import { registerReactionHandlers } from './handlers/reactions';
import { registerPollHandlers } from './handlers/polls';
import { registerConfessionHandlers } from './handlers/confessions';
import { registerTimerHandlers } from './handlers/timer';
import { registerScheduleHandlers } from './handlers/schedule';
import { RadioRoom } from './rooms/RadioRoom';
import {
  createListenerToken,
  createHostToken,
  ROOM_NAME,
} from './livekit/tokenService';

const app = express();
const httpServer = createServer(app);

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Support comma-separated list of allowed origins (e.g. Vercel URL + localhost)
const allowedOrigins = FRONTEND_URL.split(',').map((u) => u.trim());

function corsOrigin(
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void
) {
  if (!origin) return callback(null, true);

  // Allow any localhost/127.0.0.1 connection for local testing
  if (
    origin.match(/^https?:\/\/localhost(:\d+)?$/) ||
    origin.match(/^https?:\/\/127\.0\.0\.1(:\d+)?$/)
  ) {
    return callback(null, true);
  }

  // Allow any Vercel deployment of the app
  if (origin.endsWith('.vercel.app')) {
    return callback(null, true);
  }

  if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
    return callback(null, true);
  }

  console.warn(`[CORS Blocked] Origin: ${origin}`);
  callback(new Error(`CORS: origin ${origin} not allowed`));
}

const io = new Server(httpServer, {
  cors: {
    origin: corsOrigin,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json());

// LiveKit: Listener token — subscribe only, no secret exposed
app.get('/api/livekit-token', async (req, res) => {
  const name = (req.query.name as string | undefined)?.slice(0, 30) || 'Listener';
  try {
    const token = await createListenerToken(name);
    res.json({ token, url: process.env.LIVEKIT_URL, roomName: ROOM_NAME });
  } catch (err) {
    res.status(500).json({ error: 'Token generation failed' });
  }
});

// LiveKit: Host token — requires password
app.post('/api/livekit-host-token', async (req, res) => {
  const { password, hostName } = req.body as { password?: string; hostName?: string };
  if (password !== process.env.HOST_PASSWORD) {
    res.status(401).json({ error: 'Wrong password' });
    return;
  }
  try {
    const name = (hostName || 'Host').slice(0, 40);
    const token = await createHostToken(name);
    res.json({ token, url: process.env.LIVEKIT_URL, roomName: ROOM_NAME });
  } catch (err) {
    res.status(500).json({ error: 'Token generation failed' });
  }
});

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Global radio room state
const room = new RadioRoom();

io.on('connection', (socket) => {
  console.log(`[+] Connected: ${socket.id}`);

  // Register all event handlers
  registerBroadcastHandlers(io, socket, room);
  registerCallerHandlers(io, socket, room);
  registerReactionHandlers(io, socket, room);
  registerPollHandlers(io, socket, room);
  registerConfessionHandlers(io, socket, room);
  registerTimerHandlers(io, socket, room);
  registerScheduleHandlers(io, socket, room);

  socket.on('disconnect', () => {
    console.log(`[-] Disconnected: ${socket.id}`);
    room.removeListener(socket.id, io);
  });
});

const PORT = parseInt(process.env.PORT || '3001', 10);
httpServer.listen(PORT, () => {
  console.log(`🎙️  Swaram Radio Server running on port ${PORT}`);
});
