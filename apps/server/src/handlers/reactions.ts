// src/handlers/reactions.ts
import { Server, Socket } from 'socket.io';
import { RadioRoom } from '../rooms/RadioRoom';

const VALID_EMOJIS = ['🔥', '❤️', '😂', '🤯', '👏'];
const RATE_LIMIT_MS = 2000;
const lastReaction = new Map<string, number>();

export function registerReactionHandlers(
  io: Server,
  socket: Socket,
  room: RadioRoom
): void {
  socket.on('REACT', (data: { emoji: string }) => {
    if (!room.isLive) return;
    if (!VALID_EMOJIS.includes(data.emoji)) return;

    const last = lastReaction.get(socket.id) || 0;
    if (Date.now() - last < RATE_LIMIT_MS) return;
    lastReaction.set(socket.id, Date.now());

    const listener = room.listeners.get(socket.id);
    const fromName = listener?.name || 'Anonymous';

    io.emit('REACTION', {
      emoji: data.emoji,
      fromName,
      id: `${socket.id}-${Date.now()}`,
    });
  });

  socket.on('disconnect', () => {
    lastReaction.delete(socket.id);
  });
}
