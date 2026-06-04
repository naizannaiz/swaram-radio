// src/handlers/timer.ts
import { Server, Socket } from 'socket.io';
import { RadioRoom } from '../rooms/RadioRoom';

export function registerTimerHandlers(
  io: Server,
  socket: Socket,
  room: RadioRoom
): void {
  socket.on('SET_TIMER', (data: { seconds: number }) => {
    if (!room.isHostOrCohost(socket.id)) return;

    const seconds = Math.min(Math.max(data.seconds, 0), 7200);

    if (room.timerInterval) {
      clearInterval(room.timerInterval);
      room.timerInterval = null;
    }

    if (seconds === 0) {
      room.timerRemaining = 0;
      io.emit('TIMER_CLEARED', {});
      return;
    }

    room.timerRemaining = seconds;
    io.emit('TIMER_TICK', { remaining: room.timerRemaining });

    room.timerInterval = setInterval(() => {
      room.timerRemaining--;
      io.emit('TIMER_TICK', { remaining: room.timerRemaining });

      if (room.timerRemaining <= 0) {
        clearInterval(room.timerInterval!);
        room.timerInterval = null;
        room.timerRemaining = 0;
        io.emit('TIMER_ENDED', {});
      }
    }, 1000);
  });
}
