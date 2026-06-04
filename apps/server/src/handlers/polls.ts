// src/handlers/polls.ts
import { Server, Socket } from 'socket.io';
import { RadioRoom, Poll } from '../rooms/RadioRoom';
import { randomUUID } from 'crypto';

const sessionVotes = new Map<string, Set<string>>(); // pollId → Set<socketId>

export function registerPollHandlers(
  io: Server,
  socket: Socket,
  room: RadioRoom
): void {
  socket.on(
    'CREATE_POLL',
    (data: { question: string; options: string[] }) => {
      if (!room.isHostOrCohost(socket.id)) return;
      if (room.activePoll) return; // one poll at a time

      const pollId = randomUUID();
      const poll: Poll = {
        id: pollId,
        question: data.question.slice(0, 120),
        options: data.options.slice(0, 4).map((label) => ({
          id: randomUUID(),
          label: label.slice(0, 60),
          votes: 0,
        })),
        createdAt: Date.now(),
      };

      room.activePoll = poll;
      room.polls.push(poll);
      sessionVotes.set(pollId, new Set());

      io.emit('POLL_CREATED', { poll });
    }
  );

  socket.on('VOTE_POLL', (data: { pollId: string; optionId: string }) => {
    if (!room.activePoll || room.activePoll.id !== data.pollId) return;

    const voters = sessionVotes.get(data.pollId);
    if (!voters) return;
    if (voters.has(socket.id)) return; // already voted

    const option = room.activePoll.options.find((o) => o.id === data.optionId);
    if (!option) return;

    option.votes++;
    voters.add(socket.id);

    io.emit('POLL_UPDATED', { poll: room.activePoll });
  });

  socket.on('CLOSE_POLL', (data: { pollId: string }) => {
    if (!room.isHostOrCohost(socket.id)) return;
    if (!room.activePoll || room.activePoll.id !== data.pollId) return;

    room.activePoll.closedAt = Date.now();
    io.emit('POLL_CLOSED', { poll: room.activePoll });
    room.activePoll = null;
  });
}
