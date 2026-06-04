// src/handlers/broadcast.ts
import { Server, Socket } from 'socket.io';
import { RadioRoom } from '../rooms/RadioRoom';

const HOST_PASSWORD = process.env.HOST_PASSWORD || 'swaram2024';

export function registerBroadcastHandlers(
  io: Server,
  socket: Socket,
  room: RadioRoom
): void {
  // Listener joins
  socket.on(
    'JOIN_SHOW',
    (data: { name: string; avatarColor: string; dept?: string }) => {
      const listener = room.addListener(
        socket.id,
        data.name.slice(0, 30),
        data.avatarColor,
        data.dept?.slice(0, 40)
      );

      socket.join('listeners');

      // Send current state to new joiner
      socket.emit('SHOW_STATE', {
        isLive: room.isLive,
        hostName: room.hostName,
        listenerCount: room.listenerCount,
        activeCaller: room.activeCaller,
        activePoll: room.activePoll,
        schedule: room.schedule,
        timerRemaining: room.timerRemaining,
      });

      // Notify everyone of new count
      io.emit('LISTENER_COUNT', { count: room.listenerCount });

      // If show is live, tell host about new listener so it can open WebRTC
      if (room.isLive && room.hostSocketId) {
        io.to(room.hostSocketId).emit('LISTENER_JOINED_LIVE', {
          listenerId: socket.id,
        });
      }

      console.log(`[JOIN] ${listener.name} (${socket.id})`);
    }
  );

  // Host login
  socket.on(
    'HOST_AUTH',
    async (data: { password: string; hostName: string }) => {
      const valid = data.password === HOST_PASSWORD;
      if (!valid) {
        socket.emit('HOST_AUTH_RESULT', { success: false, error: 'Wrong password' });
        return;
      }

      room.hostSocketId = socket.id;
      room.hostName = data.hostName.slice(0, 40);
      socket.join('host');

      // Add host as listener too for count
      room.addListener(socket.id, room.hostName, '#F59E0B');
      room.listeners.get(socket.id)!.role = 'host';

      socket.emit('HOST_AUTH_RESULT', {
        success: true,
        state: {
          isLive: room.isLive,
          micQueue: room.micQueue,
          confessions: room.confessions.filter((c) => !c.readAt),
          activePoll: room.activePoll,
          schedule: room.schedule,
        },
      });

      io.emit('LISTENER_COUNT', { count: room.listenerCount });
      console.log(`[HOST] ${room.hostName} authenticated`);
    }
  );

  // Start show
  socket.on('START_SHOW', () => {
    if (!room.isHost(socket.id)) return;

    room.isLive = true;

    // Collect current listener socket IDs (exclude host itself)
    const listenerIds = Array.from(room.listeners.keys()).filter(
      (id) => id !== socket.id && id !== room.cohostSocketId
    );

    io.emit('SHOW_STARTED', {
      hostName: room.hostName,
      startedAt: Date.now(),
    });

    // Give host the list of everyone already in room to connect to
    socket.emit('CURRENT_LISTENERS', { listenerIds });

    console.log(`[LIVE] Show started by ${room.hostName}, ${listenerIds.length} listener(s) in room`);
  });

  // End show
  socket.on('END_SHOW', () => {
    if (!room.isHost(socket.id)) return;

    room.isLive = false;
    room.activeCaller = null;
    room.micQueue = [];
    room.activePoll = null;
    room.confessions = []; // purge confessions
    if (room.timerInterval) {
      clearInterval(room.timerInterval);
      room.timerInterval = null;
    }

    io.emit('SHOW_ENDED', { reason: 'host_ended' });
    console.log(`[END] Show ended by ${room.hostName}`);
  });

  // Promote co-host
  socket.on('PROMOTE_COHOST', (data: { listenerId: string }) => {
    if (!room.isHost(socket.id)) return;

    const listener = room.listeners.get(data.listenerId);
    if (!listener) return;

    // Demote previous cohost
    if (room.cohostSocketId) {
      const prev = room.listeners.get(room.cohostSocketId);
      if (prev) prev.role = 'listener';
      io.to(room.cohostSocketId).emit('ROLE_CHANGED', { role: 'listener' });
    }

    room.cohostSocketId = data.listenerId;
    listener.role = 'cohost';

    io.to(data.listenerId).emit('ROLE_PROMOTED', { role: 'cohost' });
    io.emit('COHOST_UPDATED', { name: listener.name, avatarColor: listener.avatarColor });
  });
}
