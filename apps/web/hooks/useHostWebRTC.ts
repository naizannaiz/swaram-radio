'use client';
// hooks/useHostWebRTC.ts
// Host-side WebRTC: captures mic, mixes with caller audio, streams to ALL listeners.
// Audio NEVER touches the server — only ICE signaling messages pass through Socket.io.

import { useEffect, useRef, useCallback } from 'react';
import { getSocket } from '@/lib/socket-client';
import { getIceServers } from '@/lib/webrtc';
import { useRadioStore } from '@/store/radioStore';

interface PeerEntry {
  pc: RTCPeerConnection;
  sendersAdded: boolean;
}

export function useHostWebRTC(
  audioRef: React.RefObject<HTMLAudioElement | null>
) {
  // Map of listenerId → PeerConnection
  const peers = useRef<Map<string, PeerEntry>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const mixedStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const destNodeRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const iceServersRef = useRef<RTCIceServer[]>([]);

  const isLive = useRadioStore((s) => s.isLive);

  // ------------------------------------------------------------------
  // Mic capture + Web Audio mixer setup
  // ------------------------------------------------------------------
  const setupMixer = useCallback(async () => {
    try {
      // Get mic
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 48000,
        },
        video: false,
      });
      localStreamRef.current = stream;

      // Create audio context + destination node for mixing
      const ctx = new AudioContext({ sampleRate: 48000 });
      audioCtxRef.current = ctx;

      const dest = ctx.createMediaStreamDestination();
      destNodeRef.current = dest;
      mixedStreamRef.current = dest.stream;

      // Connect host mic to mixer
      const micSource = ctx.createMediaStreamSource(stream);
      micSource.connect(dest);

      return true;
    } catch (err) {
      console.error('[Host WebRTC] Mic access denied:', err);
      return false;
    }
  }, []);

  // ------------------------------------------------------------------
  // Add caller's incoming audio track to the mixer
  // ------------------------------------------------------------------
  const addCallerToMixer = useCallback((remoteStream: MediaStream) => {
    const ctx = audioCtxRef.current;
    const dest = destNodeRef.current;
    if (!ctx || !dest) return;

    const callerSource = ctx.createMediaStreamSource(remoteStream);
    callerSource.connect(dest);
    console.log('[Host WebRTC] Caller audio added to mix');
  }, []);

  // ------------------------------------------------------------------
  // Create a peer connection to a listener and send the mixed stream
  // ------------------------------------------------------------------
  const connectToListener = useCallback(
    async (listenerId: string) => {
      if (peers.current.has(listenerId)) return;
      if (!mixedStreamRef.current) return;

      const socket = getSocket();
      const pc = new RTCPeerConnection({ iceServers: iceServersRef.current });
      const entry: PeerEntry = { pc, sendersAdded: false };
      peers.current.set(listenerId, entry);

      // Add all mixed audio tracks to this connection
      mixedStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, mixedStreamRef.current!);
      });
      entry.sendersAdded = true;

      // ICE candidate → relay via server
      pc.onicecandidate = ({ candidate }) => {
        if (candidate) {
          socket.emit('RTC_ICE', { targetId: listenerId, candidate: candidate.toJSON() });
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          peers.current.delete(listenerId);
        }
      };

      // Create offer and send to listener
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('RTC_OFFER', { targetId: listenerId, offer: pc.localDescription });

      console.log(`[Host WebRTC] Offer sent to listener ${listenerId}`);
    },
    []
  );

  // ------------------------------------------------------------------
  // Remove listener peer connection
  // ------------------------------------------------------------------
  const disconnectListener = useCallback((listenerId: string) => {
    const entry = peers.current.get(listenerId);
    if (entry) {
      entry.pc.close();
      peers.current.delete(listenerId);
    }
  }, []);

  // ------------------------------------------------------------------
  // Cleanup all peers
  // ------------------------------------------------------------------
  const cleanupAll = useCallback(() => {
    peers.current.forEach((entry) => entry.pc.close());
    peers.current.clear();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
  }, []);

  // ------------------------------------------------------------------
  // Socket event wiring
  // ------------------------------------------------------------------
  useEffect(() => {
    const socket = getSocket();

    // Pre-fetch ICE servers
    getIceServers().then((servers) => {
      iceServersRef.current = servers;
    });

    // Host goes live — connect to everyone already in room
    socket.on('CURRENT_LISTENERS', async (data: { listenerIds: string[] }) => {
      const ok = await setupMixer();
      if (!ok) return;

      for (const id of data.listenerIds) {
        await connectToListener(id);
      }
    });

    // New listener joined mid-show
    socket.on('LISTENER_JOINED_LIVE', async (data: { listenerId: string }) => {
      if (!mixedStreamRef.current) return;
      await connectToListener(data.listenerId);
    });

    // Listener disconnected
    socket.on('LISTENER_COUNT', () => {
      // Clean up any closed peer connections
      peers.current.forEach((entry, id) => {
        if (entry.pc.connectionState === 'closed' || entry.pc.connectionState === 'failed') {
          peers.current.delete(id);
        }
      });
    });

    // Answer from listener → set remote description
    socket.on(
      'RTC_ANSWER',
      async (data: { fromId: string; answer: RTCSessionDescriptionInit }) => {
        const entry = peers.current.get(data.fromId);
        if (!entry) return;
        if (entry.pc.signalingState === 'have-local-offer') {
          await entry.pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        }
      }
    );

    // ICE candidate from listener
    socket.on(
      'RTC_ICE',
      async (data: { fromId: string; candidate: RTCIceCandidateInit }) => {
        const entry = peers.current.get(data.fromId);
        if (!entry) return;
        try {
          await entry.pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (e) {
          console.warn('[Host WebRTC] ICE add error:', e);
        }
      }
    );

    // Caller accepted — receive caller's audio and add to mixer
    socket.on('CALLER_ACCEPTED', async (data: { callerName: string }) => {
      console.log(`[Host WebRTC] Caller accepted: ${data.callerName}`);
      // Caller will send us an offer — handled in RTC_OFFER (caller-to-host path)
    });

    // Offer from caller → answer and add their audio to mixer
    socket.on(
      'RTC_OFFER',
      async (data: { fromId: string; offer: RTCSessionDescriptionInit }) => {
        // If offer is from a caller (not a listener we're hosting)
        if (peers.current.has(data.fromId)) return; // already our listener connection

        const pc = new RTCPeerConnection({ iceServers: iceServersRef.current });

        pc.ontrack = ({ streams }) => {
          if (streams[0]) addCallerToMixer(streams[0]);
        };

        pc.onicecandidate = ({ candidate }) => {
          if (candidate) {
            getSocket().emit('RTC_ICE', {
              targetId: data.fromId,
              candidate: candidate.toJSON(),
            });
          }
        };

        // Store as caller peer (use a special key prefix)
        peers.current.set(`caller:${data.fromId}`, { pc, sendersAdded: false });

        // Send our mixed stream to caller too (so caller hears themselves + host)
        if (mixedStreamRef.current) {
          mixedStreamRef.current.getTracks().forEach((t) => {
            pc.addTrack(t, mixedStreamRef.current!);
          });
        }

        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        getSocket().emit('RTC_ANSWER', { targetId: data.fromId, answer: pc.localDescription });
      }
    );

    // Caller cut or done — remove from mixer (we close the pc, audio stops)
    const cleanupCaller = () => {
      peers.current.forEach((entry, key) => {
        if (key.startsWith('caller:')) {
          entry.pc.close();
          peers.current.delete(key);
        }
      });
    };
    socket.on('CALLER_DISCONNECTED', cleanupCaller);
    socket.on('CALLER_CUT', cleanupCaller);

    // Show ended — cleanup everything
    socket.on('SHOW_ENDED', cleanupAll);

    return () => {
      socket.off('CURRENT_LISTENERS');
      socket.off('LISTENER_JOINED_LIVE');
      socket.off('LISTENER_COUNT');
      socket.off('RTC_ANSWER');
      socket.off('RTC_ICE');
      socket.off('CALLER_ACCEPTED');
      socket.off('RTC_OFFER');
      socket.off('CALLER_DISCONNECTED', cleanupCaller);
      socket.off('CALLER_CUT', cleanupCaller);
      socket.off('SHOW_ENDED', cleanupAll);
      cleanupAll();
    };
  }, [setupMixer, connectToListener, addCallerToMixer, cleanupAll]);
}
