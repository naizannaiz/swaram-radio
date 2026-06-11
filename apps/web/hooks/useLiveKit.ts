'use client';
// hooks/useLiveKit.ts
// Replaces useHostWebRTC + useListenerWebRTC + useCallerWebRTC.
// Audio flows: Host mic → LiveKit SFU → all listeners. Server never sees audio bytes.

import { useEffect, useRef, useCallback } from 'react';
import {
  Room,
  RoomEvent,
  Track,
  RemoteTrack,
  LocalAudioTrack,
  createLocalAudioTrack,
  RoomOptions,
  AudioPresets,
} from 'livekit-client';
import { getSocket, getServerUrlAsync } from '@/lib/socket-client';
import { useRadioStore } from '@/store/radioStore';

const LIVEKIT_URL =
  process.env.NEXT_PUBLIC_LIVEKIT_URL || 'wss://swaram-c1q3n09b.livekit.cloud';

const ROOM_OPTIONS: RoomOptions = {
  // Adaptive stream: skip unused video tracks (audio only app)
  adaptiveStream: false,
  dynacast: false,
  audioCaptureDefaults: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    sampleRate: 48000,
  },
  publishDefaults: {
    audioPreset: AudioPresets.music,
    dtx: true,          // discontinuous transmission — silence = no bits sent
    red: true,          // redundant encoding for packet loss resilience
  },
};

// ------------------------------------------------------------------
// Listener / Caller hook (used in listener page)
// ------------------------------------------------------------------
export function useListenerLiveKit(
  audioRef: React.RefObject<HTMLAudioElement | null>
) {
  const roomRef = useRef<Room | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const myName = useRadioStore((s) => s.myName);
  const micRequestStatus = useRadioStore((s) => s.micRequestStatus);

  // ------------------------------------------------------------------
  // Attach incoming audio track to <audio> element + Web Audio analyser
  // ------------------------------------------------------------------
  const attachTrack = useCallback(
    (track: RemoteTrack) => {
      if (track.kind !== Track.Kind.Audio) return;

      // Wire to hidden <audio> element for playback
      if (audioRef.current) {
        track.attach(audioRef.current);
      }

      // Wire to Web Audio analyser for waveform visualizer
      const mediaStream = new MediaStream([track.mediaStreamTrack]);
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext();
      }
      const ctx = audioCtxRef.current;
      const source = ctx.createMediaStreamSource(mediaStream);
      if (!analyserRef.current) {
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyserRef.current = analyser;
        analyser.connect(ctx.destination);
      }
      source.connect(analyserRef.current);
    },
    [audioRef]
  );

  // ------------------------------------------------------------------
  // Connect to LiveKit as a listener (subscribe only)
  // ------------------------------------------------------------------
  const connectAsListener = useCallback(
    async (name: string) => {
      if (roomRef.current?.state === 'connected') return;

      try {
        const serverUrl = await getServerUrlAsync();
        const res = await fetch(
          `${serverUrl}/api/livekit-token?name=${encodeURIComponent(name)}`
        );
        const { token, url } = await res.json();

        const room = new Room(ROOM_OPTIONS);
        roomRef.current = room;

        // Handle incoming audio tracks
        room.on(RoomEvent.TrackSubscribed, (track) => attachTrack(track));

        room.on(RoomEvent.Disconnected, () => {
          console.log('[LiveKit] Disconnected from room');
        });

        const connectUrl = url || LIVEKIT_URL;
        console.log('[LiveKit] Listener connecting to:', connectUrl);
        await room.connect(connectUrl, token);
        console.log('[LiveKit] Listener connected ✅');

        // Resume AudioContext after user gesture (browser autoplay policy)
        if (audioCtxRef.current?.state === 'suspended') {
          await audioCtxRef.current.resume();
        }

        // Attach already-existing tracks (host was live before listener joined)
        room.remoteParticipants.forEach((participant) => {
          participant.trackPublications.forEach((pub) => {
            if (pub.isSubscribed && pub.track) {
              attachTrack(pub.track);
            }
          });
        });
      } catch (err) {
        console.error('[LiveKit] Listener connect failed:', err);
      }
    },
    [attachTrack]
  );

  // ------------------------------------------------------------------
  // Upgrade to caller: reconnect with a publish-capable token
  // ------------------------------------------------------------------
  const upgradeToCallerAndPublish = useCallback(
    async (data: { livekitToken: string; livekitUrl: string }) => {
      const room = roomRef.current;
      if (!room) return;

      try {
        // Reconnect with the caller token (has canPublish=true)
        // LiveKit supports token refresh without full disconnect
        await room.localParticipant.setMicrophoneEnabled(false); // ensure clean state

        // Create a fresh local audio track for the caller
        const audioTrack: LocalAudioTrack = await createLocalAudioTrack({
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
        });

        // We need to reconnect with the new token to gain publish permissions
        await room.disconnect();

        const newRoom = new Room(ROOM_OPTIONS);
        roomRef.current = newRoom;

        newRoom.on(RoomEvent.TrackSubscribed, (track) => attachTrack(track));

        await newRoom.connect(data.livekitUrl || LIVEKIT_URL, data.livekitToken);

        // Publish mic now that we have publish permissions
        await newRoom.localParticipant.publishTrack(audioTrack);

        console.log('[LiveKit] Caller mic published ✅');
      } catch (err) {
        console.error('[LiveKit] Caller upgrade failed:', err);
      }
    },
    [attachTrack]
  );

  // ------------------------------------------------------------------
  // Go back to listener (mic cut by host or caller done)
  // ------------------------------------------------------------------
  const downgradeToListener = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;

    // Unpublish all local tracks
    const pubs = Array.from(room.localParticipant.trackPublications.values());
    for (const pub of pubs) {
      if (pub.track) {
        await room.localParticipant.unpublishTrack(pub.track as LocalAudioTrack);
        pub.track.stop();
      }
    }

    // Notify server that caller is done so it clears activeCaller state
    const socket = getSocket();
    socket.emit('CALLER_DONE');

    console.log('[LiveKit] Caller mic unpublished, back to listener');
  }, []);

  // ------------------------------------------------------------------
  // Socket.io event wiring for LiveKit lifecycle
  // ------------------------------------------------------------------
  useEffect(() => {
    const socket = getSocket();

    // Join show → connect to LiveKit as listener
    socket.on('SHOW_STATE', async () => {
      if (myName && roomRef.current?.state !== 'connected') {
        await connectAsListener(myName);
      }
    });

    // Show went live mid-session
    socket.on('SHOW_STARTED', async () => {
      if (myName && roomRef.current?.state !== 'connected') {
        await connectAsListener(myName);
      }
    });

    // Host accepted us as caller — upgrade and publish mic
    socket.on(
      'CALLER_ACCEPTED',
      async (data: { livekitToken: string; livekitUrl: string }) => {
        await upgradeToCallerAndPublish(data);
      }
    );

    // Host cut us / we're done — unpublish mic
    socket.on('CALLER_CUT', downgradeToListener);
    socket.on('CALLER_DONE', downgradeToListener);

    // Show ended — disconnect
    socket.on('SHOW_ENDED', async () => {
      await roomRef.current?.disconnect();
      roomRef.current = null;
      if (audioRef.current) {
        audioRef.current.srcObject = null;
        audioRef.current.pause();
      }
    });

    return () => {
      socket.off('SHOW_STATE');
      socket.off('SHOW_STARTED');
      socket.off('CALLER_ACCEPTED');
      socket.off('CALLER_CUT', downgradeToListener);
      socket.off('CALLER_DONE', downgradeToListener);
      socket.off('SHOW_ENDED');
    };
  }, [myName, connectAsListener, upgradeToCallerAndPublish, downgradeToListener, audioRef]);

  // Connect immediately if already live when hook mounts (e.g. mid-show join)
  useEffect(() => {
    if (myName) {
      connectAsListener(myName);
    }
    return () => {
      roomRef.current?.disconnect();
      audioCtxRef.current?.close();
    };
  }, [myName, connectAsListener]);

  return analyserRef;
}

// ------------------------------------------------------------------
// Host hook (used in host/page.tsx)
// ------------------------------------------------------------------
export function useHostLiveKit() {
  const roomRef = useRef<Room | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  // Create dynamic audio element for host to hear remote participants (like callers)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const el = document.createElement('audio');
      el.id = 'livekit-host-audio-playback';
      el.autoplay = true;
      document.body.appendChild(el);
      audioElRef.current = el;
    }
    return () => {
      audioElRef.current?.remove();
    };
  }, []);

  // ------------------------------------------------------------------
  // Connect as host and publish mic
  // ------------------------------------------------------------------
  const connectAndGoLive = useCallback(
    async (hostName: string, password: string) => {
      if (roomRef.current?.state === 'connected') return;

      try {
        const serverUrl = await getServerUrlAsync();
        const res = await fetch(`${serverUrl}/api/livekit-host-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password, hostName }),
        });

        if (!res.ok) {
          console.error('[LiveKit] Host token rejected');
          return;
        }

        const { token, url } = await res.json();
        const room = new Room(ROOM_OPTIONS);
        roomRef.current = room;

        room.on(RoomEvent.Disconnected, () => {
          console.log('[LiveKit] Host disconnected');
        });

        // Handle remote tracks (e.g. caller audio) so the host can hear them
        room.on(RoomEvent.TrackSubscribed, (track) => {
          if (track.kind === Track.Kind.Audio) {
            console.log('[LiveKit] Host subscribed to remote audio track:', track.sid);
            if (audioElRef.current) {
              track.attach(audioElRef.current);
            }
          }
        });

        room.on(RoomEvent.TrackUnsubscribed, (track) => {
          if (track.kind === Track.Kind.Audio) {
            console.log('[LiveKit] Host unsubscribed from remote audio track:', track.sid);
            if (audioElRef.current) {
              track.detach(audioElRef.current);
            }
          }
        });

        const connectUrl = url || LIVEKIT_URL;
        console.log('[LiveKit] Host connecting to:', connectUrl);
        await room.connect(connectUrl, token);

        // Publish mic immediately
        await room.localParticipant.setMicrophoneEnabled(true);

        // Set up Web Audio analyser from host's own mic track for the waveform
        const micTrack = Array.from(
          room.localParticipant.trackPublications.values()
        ).find((p) => p.kind === Track.Kind.Audio)?.track;

        if (micTrack) {
          const ctx = new AudioContext();
          audioCtxRef.current = ctx;
          const source = ctx.createMediaStreamSource(
            new MediaStream([micTrack.mediaStreamTrack])
          );
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 256;
          source.connect(analyser);
          analyserRef.current = analyser;
        }

        console.log('[LiveKit] Host connected + mic published ✅');
      } catch (err) {
        console.error('[LiveKit] Host connect failed:', err);
      }
    },
    []
  );

  // ------------------------------------------------------------------
  // Disconnect (show ended)
  // ------------------------------------------------------------------
  const disconnect = useCallback(async () => {
    await roomRef.current?.disconnect();
    roomRef.current = null;
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
  }, []);

  // ------------------------------------------------------------------
  // Toggle mic mute — truly disables the MediaStreamTrack (Option A)
  // ------------------------------------------------------------------
  const toggleMicMute = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;

    const isMicMuted = useRadioStore.getState().isMicMuted;
    const setMicMuted = useRadioStore.getState().setMicMuted;
    const newMuted = !isMicMuted;

    // Disable/enable the actual mic track so no audio is sent
    room.localParticipant.trackPublications.forEach((pub) => {
      if (pub.kind === Track.Kind.Audio && pub.track) {
        pub.track.mediaStreamTrack.enabled = !newMuted;
      }
    });

    setMicMuted(newMuted);
  }, []);

  // Socket wiring
  useEffect(() => {
    const socket = getSocket();
    socket.on('SHOW_ENDED', disconnect);
    return () => {
      socket.off('SHOW_ENDED', disconnect);
      disconnect();
    };
  }, [disconnect]);

  return { connectAndGoLive, disconnect, analyserRef, toggleMicMute };
}
