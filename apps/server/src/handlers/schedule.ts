// src/handlers/schedule.ts
import { Server, Socket } from 'socket.io';
import { RadioRoom, ScheduleSlot } from '../rooms/RadioRoom';
import { randomUUID } from 'crypto';

export function registerScheduleHandlers(
  io: Server,
  socket: Socket,
  room: RadioRoom
): void {
  socket.on('ADD_SCHEDULE_SLOT', (data: Omit<ScheduleSlot, 'id'>) => {
    if (!room.isHostOrCohost(socket.id)) return;

    const slot: ScheduleSlot = {
      id: randomUUID(),
      dayOfWeek: Math.max(0, Math.min(6, data.dayOfWeek)),
      startTime: data.startTime,
      durationMin: Math.max(15, Math.min(300, data.durationMin)),
      showName: data.showName.slice(0, 60),
      hostName: data.hostName.slice(0, 40),
      description: data.description?.slice(0, 120),
    };

    room.schedule.push(slot);
    room.schedule.sort(
      (a, b) => a.dayOfWeek * 1440 + parseInt(a.startTime) - (b.dayOfWeek * 1440 + parseInt(b.startTime))
    );

    io.emit('SCHEDULE_UPDATED', { schedule: room.schedule });
  });

  socket.on('REMOVE_SCHEDULE_SLOT', (data: { slotId: string }) => {
    if (!room.isHostOrCohost(socket.id)) return;
    room.schedule = room.schedule.filter((s) => s.id !== data.slotId);
    io.emit('SCHEDULE_UPDATED', { schedule: room.schedule });
  });
}
