'use client';
// hooks/useSocket.ts
import { useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { connectSocket, disconnectSocket } from '@/lib/socket-client';
import { useRadioStore } from '@/store/radioStore';

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const store = useRadioStore();

  useEffect(() => {
    const socket = connectSocket();
    socketRef.current = socket;

    // Show state sync on connect
    socket.on('SHOW_STATE', (data) => {
      store.setIsLive(data.isLive);
      store.setHostName(data.hostName);
      store.setListenerCount(data.listenerCount);
      if (data.activeCaller) store.setActiveCaller(data.activeCaller);
      if (data.activePoll) store.setActivePoll(data.activePoll);
      if (data.schedule) store.setSchedule(data.schedule);
      if (data.timerRemaining) store.setTimerRemaining(data.timerRemaining);
    });

    socket.on('SHOW_STARTED', (data) => {
      store.setIsLive(true);
      store.setHostName(data.hostName);
    });

    socket.on('SHOW_ENDED', () => {
      store.setIsLive(false);
      store.setActiveCaller(null);
      store.setActivePoll(null);
      store.setTimerRemaining(0);
      store.setMicRequestStatus('idle');
    });

    socket.on('LISTENER_COUNT', (data) => store.setListenerCount(data.count));

    socket.on('CALLER_ON_AIR', (data) => store.setActiveCaller(data));
    socket.on('CALLER_DISCONNECTED', () => store.setActiveCaller(null));

    socket.on('REACTION', (data) => {
      store.addReaction(data);
      setTimeout(() => store.removeReaction(data.id), 4000);
    });

    socket.on('POLL_CREATED', (data) => store.setActivePoll(data.poll));
    socket.on('POLL_UPDATED', (data) => store.updatePoll(data.poll));
    socket.on('POLL_CLOSED', () => {
      setTimeout(() => store.setActivePoll(null), 10000);
    });

    socket.on('CONFESSION_ON_AIR', (data) => {
      // Handled by ConfessionOverlay component via store
      store.addConfession({ id: data.id, text: data.text, createdAt: Date.now(), readAt: Date.now() });
    });

    socket.on('TIMER_TICK', (data) => store.setTimerRemaining(data.remaining));
    socket.on('TIMER_CLEARED', () => store.setTimerRemaining(0));
    socket.on('TIMER_ENDED', () => store.setTimerRemaining(0));

    socket.on('SCHEDULE_UPDATED', (data) => store.setSchedule(data.schedule));

    // Host-only events
    socket.on('MIC_REQUEST_ADDED', (data) => store.addMicRequest(data));
    socket.on('MIC_REQUEST_REMOVED', (data) => store.removeMicRequest(data.listenerId));

    socket.on('CONFESSION_RECEIVED', (data) => store.addConfession(data.confession));

    // Own status — server sends 'queued' | 'cancelled' | (others not used)
    // Map 'cancelled' back to 'idle' since store doesn't have that state
    socket.on('MIC_REQUEST_STATUS', (data: { status: string }) => {
      const mapped = data.status === 'cancelled' ? 'idle' : data.status;
      store.setMicRequestStatus(mapped as Parameters<typeof store.setMicRequestStatus>[0]);
    });
    socket.on('CALLER_ACCEPTED', () => {
      store.setMicRequestStatus('accepted');
    });
    socket.on('CALLER_DENIED', () => store.setMicRequestStatus('denied'));
    socket.on('CALLER_CUT', () => store.setMicRequestStatus('idle'));
    socket.on('CALLER_DONE', () => store.setMicRequestStatus('idle'));

    socket.on('ROLE_PROMOTED', () => store.setRole('cohost'));
    socket.on('ROLE_CHANGED', (data) => store.setRole(data.role));

    return () => {
      socket.removeAllListeners();
      disconnectSocket();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return socketRef.current;
}
