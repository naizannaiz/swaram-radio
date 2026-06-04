// src/handlers/confessions.ts
import { Server, Socket } from 'socket.io';
import { RadioRoom, Confession } from '../rooms/RadioRoom';
import { randomUUID } from 'crypto';

export function registerConfessionHandlers(
  io: Server,
  socket: Socket,
  room: RadioRoom
): void {
  socket.on('SUBMIT_CONFESSION', (data: { text: string }) => {
    if (!room.isLive) return;

    const text = data.text?.trim().slice(0, 280);
    if (!text) return;

    const confession: Confession = {
      id: randomUUID(),
      text,
      createdAt: Date.now(),
    };

    room.confessions.push(confession);

    // Notify host only (anonymous — no sender info)
    if (room.hostSocketId)
      io.to(room.hostSocketId).emit('CONFESSION_RECEIVED', { confession });
    if (room.cohostSocketId)
      io.to(room.cohostSocketId).emit('CONFESSION_RECEIVED', { confession });

    socket.emit('CONFESSION_SUBMITTED', { success: true });
  });

  socket.on('READ_CONFESSION', (data: { confessionId: string }) => {
    if (!room.isHostOrCohost(socket.id)) return;

    const confession = room.confessions.find((c) => c.id === data.confessionId);
    if (!confession) return;

    confession.readAt = Date.now();

    // Broadcast on-air overlay to all
    io.emit('CONFESSION_ON_AIR', { text: confession.text, id: confession.id });
  });
}
