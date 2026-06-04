// src/webrtc/signaling.ts
// Relay WebRTC signaling (offer/answer/ICE candidates) between peers.
// Audio bytes NEVER pass through this server — only JSON signaling messages.
import { Server, Socket } from 'socket.io';
import { RadioRoom } from '../rooms/RadioRoom';

export function registerSignalingHandlers(
  io: Server,
  socket: Socket,
  room: RadioRoom
): void {
  // Peer sends WebRTC offer to a target peer
  socket.on('RTC_OFFER', (data: { targetId: string; offer: Record<string, unknown> }) => {
    io.to(data.targetId).emit('RTC_OFFER', {
      fromId: socket.id,
      offer: data.offer,
    });
  });

  // Peer sends WebRTC answer back
  socket.on('RTC_ANSWER', (data: { targetId: string; answer: Record<string, unknown> }) => {
    io.to(data.targetId).emit('RTC_ANSWER', {
      fromId: socket.id,
      answer: data.answer,
    });
  });

  // ICE candidate exchange
  socket.on('RTC_ICE', (data: { targetId: string; candidate: Record<string, unknown> }) => {
    io.to(data.targetId).emit('RTC_ICE', {
      fromId: socket.id,
      candidate: data.candidate,
    });
  });
}
