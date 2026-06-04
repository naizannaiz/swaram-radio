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

const io = new Server(httpServer, {
  cors: {
    origin: FRONTEND_URL,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

app.use(cors({ origin: FRONTEND_URL, credentials: true }));
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
