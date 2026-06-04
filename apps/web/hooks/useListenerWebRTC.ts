'use client';
// hooks/useListenerWebRTC.ts
// Listener-side WebRTC: receives host's offer, answers, plays audio.
// Audio flows DIRECTLY from host browser to this browser — server never sees it.

import { useEffect, useRef } from 'react';
import { getSocket } from '@/lib/socket-client';
import { getIceServers } from '@/lib/webrtc';
import { useRadioStore } from '@/store/radioStore';

export function useListenerWebRTC(
  audioRef: React.RefObject<HTMLAudioElement | null>
) {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const iceServersRef = useRef<RTCIceServer[]>([]);
  const isLive = useRadioStore((s) => s.isLive);

  useEffect(() => {
    const socket = getSocket();

    getIceServers().then((servers) => {
      iceServersRef.current = servers;
    });

    // Offer from host → create answer, play audio
    const onOffer = async (data: {
      fromId: string;
      offer: RTCSessionDescriptionInit;
    }) => {
      // Close any existing connection first
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }

      const pc = new RTCPeerConnection({ iceServers: iceServersRef.current });
      pcRef.current = pc;

      // When we receive the audio track from host → wire to <audio>
      pc.ontrack = ({ streams }) => {
        const audio = audioRef.current;
        if (!audio || !streams[0]) return;

        // Only attach if srcObject differs (avoid re-attach flicker)
        if (audio.srcObject !== streams[0]) {
          audio.srcObject = streams[0];
          audio.play().catch((err) => {
            // Autoplay blocked — user needs to interact first
            console.warn('[Listener WebRTC] Autoplay blocked, needs user gesture:', err);
          });
        }
        console.log('[Listener WebRTC] Receiving audio from host ✅');
      };

      // ICE candidates → relay via server to host
      pc.onicecandidate = ({ candidate }) => {
        if (candidate) {
          socket.emit('RTC_ICE', {
            targetId: data.fromId,
            candidate: candidate.toJSON(),
          });
        }
      };

      pc.onconnectionstatechange = () => {
        console.log('[Listener WebRTC] State:', pc.connectionState);
        if (pc.connectionState === 'failed') {
          pc.restartIce();
        }
      };

      // Set remote description (host's offer) and create answer
      await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // Send answer back to host via server signaling
      socket.emit('RTC_ANSWER', {
        targetId: data.fromId,
        answer: pc.localDescription,
      });
    };

    // ICE candidate from host
    const onIce = async (data: {
      fromId: string;
      candidate: RTCIceCandidateInit;
    }) => {
      if (!pcRef.current) return;
      try {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (e) {
        console.warn('[Listener WebRTC] ICE add error:', e);
      }
    };

    // Show ended → close connection + stop audio
    const onShowEnded = () => {
      pcRef.current?.close();
      pcRef.current = null;
      if (audioRef.current) {
        audioRef.current.srcObject = null;
        audioRef.current.pause();
      }
    };

    socket.on('RTC_OFFER', onOffer);
    socket.on('RTC_ICE', onIce);
    socket.on('SHOW_ENDED', onShowEnded);

    return () => {
      socket.off('RTC_OFFER', onOffer);
      socket.off('RTC_ICE', onIce);
      socket.off('SHOW_ENDED', onShowEnded);
      pcRef.current?.close();
      pcRef.current = null;
    };
  }, [audioRef]);

  return pcRef;
}
