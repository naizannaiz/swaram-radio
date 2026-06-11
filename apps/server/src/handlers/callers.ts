// src/handlers/callers.ts
import { Server, Socket } from 'socket.io';
import { RadioRoom, MicRequest } from '../rooms/RadioRoom';
import { createCallerToken, ROOM_NAME } from '../livekit/tokenService';

export function registerCallerHandlers(
  io: Server,
  socket: Socket,
  room: RadioRoom
): void {
  // Listener requests mic
  socket.on('REQUEST_MIC', (data?: { dept?: string }) => {
    if (!room.isLive) return;

    const listener = room.listeners.get(socket.id);
    if (!listener) return;
    if (room.activeCaller?.listenerId === socket.id) return;
    if (room.micQueue.some((r) => r.listenerId === socket.id)) return;

    const request: MicRequest = {
      listenerId: socket.id,
      name: listener.name,
      avatarColor: listener.avatarColor,
      // Prefer dept stored at join time; fall back to event payload
      dept: listener.dept ?? data?.dept?.slice(0, 40),
      requestedAt: Date.now(),
    };

    room.micQueue.push(request);

    // Notify host + cohost
    if (room.hostSocketId) io.to(room.hostSocketId).emit('MIC_REQUEST_ADDED', request);
    if (room.cohostSocketId) io.to(room.cohostSocketId).emit('MIC_REQUEST_ADDED', request);

    // Broadcast queue length to all listeners
    io.emit('QUEUE_UPDATED', { count: room.micQueue.length });

    // Confirm to requester with their position
    socket.emit('MIC_REQUEST_STATUS', { status: 'queued', position: room.micQueue.length });
  });

  // Cancel request
  socket.on('CANCEL_MIC_REQUEST', () => {
    room.micQueue = room.micQueue.filter((r) => r.listenerId !== socket.id);

    if (room.hostSocketId)
      io.to(room.hostSocketId).emit('MIC_REQUEST_REMOVED', { listenerId: socket.id });
    if (room.cohostSocketId)
      io.to(room.cohostSocketId).emit('MIC_REQUEST_REMOVED', { listenerId: socket.id });

    // Broadcast updated count to all
    io.emit('QUEUE_UPDATED', { count: room.micQueue.length });

    socket.emit('MIC_REQUEST_STATUS', { status: 'cancelled' });
  });

  // Host accepts caller
  socket.on('ACCEPT_CALLER', (data: { listenerId: string }) => {
    if (!room.isHostOrCohost(socket.id)) return;

    const request = room.micQueue.find((r) => r.listenerId === data.listenerId);
    if (!request) return;

    // Cut previous caller first
    if (room.activeCaller) {
      io.to(room.activeCaller.listenerId).emit('CALLER_CUT', {});
      io.emit('CALLER_DISCONNECTED', { reason: 'replaced' });
    }

    room.activeCaller = request;
    room.micQueue = room.micQueue.filter((r) => r.listenerId !== data.listenerId);
    room.listeners.get(data.listenerId)!.role = 'caller';

    // Generate a LiveKit caller token (publish permissions) — send via Socket, never expose secret
    createCallerToken(request.name, data.listenerId).then((callerToken) => {
      io.to(data.listenerId).emit('CALLER_ACCEPTED', {
        callerName: request.name,
        callerDept: request.dept,
        avatarColor: request.avatarColor,
        livekitToken: callerToken,          // caller uses this to republish in LiveKit room
        livekitUrl: process.env.LIVEKIT_URL,
        roomName: ROOM_NAME,
      });
    });

    // Tell host queue updated
    if (room.hostSocketId)
      io.to(room.hostSocketId).emit('MIC_REQUEST_REMOVED', { listenerId: data.listenerId });
    if (room.cohostSocketId)
      io.to(room.cohostSocketId).emit('MIC_REQUEST_REMOVED', { listenerId: data.listenerId });

    // Broadcast caller ID card to all listeners
    io.emit('CALLER_ON_AIR', {
      name: request.name,
      dept: request.dept,
      avatarColor: request.avatarColor,
    });

    // Broadcast updated queue count to all
    io.emit('QUEUE_UPDATED', { count: room.micQueue.length });
  });

  // Host denies caller
  socket.on('DENY_CALLER', (data: { listenerId: string }) => {
    if (!room.isHostOrCohost(socket.id)) return;

    room.micQueue = room.micQueue.filter((r) => r.listenerId !== data.listenerId);
    io.to(data.listenerId).emit('CALLER_DENIED', {});

    if (room.hostSocketId)
      io.to(room.hostSocketId).emit('MIC_REQUEST_REMOVED', { listenerId: data.listenerId });
    if (room.cohostSocketId)
      io.to(room.cohostSocketId).emit('MIC_REQUEST_REMOVED', { listenerId: data.listenerId });

    // Broadcast updated queue count
    io.emit('QUEUE_UPDATED', { count: room.micQueue.length });
  });

  // Host cuts active caller
  socket.on('CUT_CALLER', () => {
    if (!room.isHostOrCohost(socket.id)) return;
    if (!room.activeCaller) return;

    const callerId = room.activeCaller.listenerId;
    room.activeCaller = null;

    const listener = room.listeners.get(callerId);
    if (listener) listener.role = 'listener';

    io.to(callerId).emit('CALLER_CUT', {});
    io.emit('CALLER_DISCONNECTED', { reason: 'cut_by_host' });
  });

  // Caller signals done
  socket.on('CALLER_DONE', () => {
    if (!room.activeCaller || room.activeCaller.listenerId !== socket.id) return;

    room.activeCaller = null;
    const listener = room.listeners.get(socket.id);
    if (listener) listener.role = 'listener';

    io.emit('CALLER_DISCONNECTED', { reason: 'caller_done' });
  });
}
