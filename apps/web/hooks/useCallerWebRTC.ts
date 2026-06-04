'use client';
// hooks/useCallerWebRTC.ts
// Caller-side WebRTC: when accepted by host, captures caller's mic and connects to host.
// The host mixes caller audio with their own mic and streams to all listeners.

import { useEffect, useRef } from 'react';
import { getSocket } from '@/lib/socket-client';
import { getIceServers } from '@/lib/webrtc';
import { useRadioStore } from '@/store/radioStore';

export function useCallerWebRTC(
  audioRef: React.RefObject<HTMLAudioElement | null>
) {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const iceServersRef = useRef<RTCIceServer[]>([]);

  const micRequestStatus = useRadioStore((s) => s.micRequestStatus);

  useEffect(() => {
    getIceServers().then((servers) => {
      iceServersRef.current = servers;
    });
  }, []);

  // ------------------------------------------------------------------
  // When caller is accepted → capture mic + initiate offer to host
  // ------------------------------------------------------------------
  useEffect(() => {
    const socket = getSocket();

    if (micRequestStatus !== 'accepted') {
      // Clean up if we were a caller and status reverted
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
      return;
    }

    let mounted = true;

    const startCallerSession = async () => {
      try {
        // Get caller's mic
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 48000,
          },
          video: false,
        });

        if (!mounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        micStreamRef.current = stream;

        const pc = new RTCPeerConnection({ iceServers: iceServersRef.current });
        pcRef.current = pc;

        // Add caller mic track to connection (sent to host)
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        // When host sends us their mixed audio back — play it so caller can monitor
        pc.ontrack = ({ streams }) => {
          const audio = audioRef.current;
          if (audio && streams[0]) {
            audio.srcObject = streams[0];
            audio.play().catch(() => {});
          }
        };

        // ICE candidates → relay via server to host's socket ID
        // We send to 'host' which the server will route
        pc.onicecandidate = ({ candidate }) => {
          if (candidate) {
            // Send ICE to the socket that sent us CALLER_ACCEPTED
            // We store the host socket ID from the event
            const hostId = sessionStorage.getItem('swaram_host_id');
            if (hostId) {
              socket.emit('RTC_ICE', {
                targetId: hostId,
                candidate: candidate.toJSON(),
              });
            }
          }
        };

        pc.onconnectionstatechange = () => {
          console.log('[Caller WebRTC] State:', pc.connectionState);
        };

        // Create offer and send to host
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const hostId = sessionStorage.getItem('swaram_host_id');
        if (hostId) {
          socket.emit('RTC_OFFER', {
            targetId: hostId,
            offer: pc.localDescription,
          });
        }

        console.log('[Caller WebRTC] Offer sent to host ✅');
      } catch (err) {
        console.error('[Caller WebRTC] Mic access failed:', err);
      }
    };

    startCallerSession();

    // Handle answer from host
    const onAnswer = async (data: {
      fromId: string;
      answer: RTCSessionDescriptionInit;
    }) => {
      if (!pcRef.current) return;
      if (pcRef.current.signalingState === 'have-local-offer') {
        await pcRef.current.setRemoteDescription(
          new RTCSessionDescription(data.answer)
        );
        console.log('[Caller WebRTC] Connected to host ✅');
      }
    };

    // ICE from host → add to caller PC
    const onIce = async (data: {
      fromId: string;
      candidate: RTCIceCandidateInit;
    }) => {
      if (!pcRef.current) return;
      try {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (e) {
        console.warn('[Caller WebRTC] ICE error:', e);
      }
    };

    socket.on('RTC_ANSWER', onAnswer);
    socket.on('RTC_ICE', onIce);

    return () => {
      mounted = false;
      socket.off('RTC_ANSWER', onAnswer);
      socket.off('RTC_ICE', onIce);
      pcRef.current?.close();
      pcRef.current = null;
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    };
  }, [micRequestStatus, audioRef]);
}
