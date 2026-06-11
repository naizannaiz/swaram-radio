import { getServerUrlAsync } from './socket-client';

// WebRTC helpers — fetch ICE servers from backend (TURN creds never in frontend bundle)
export async function getIceServers(): Promise<RTCIceServer[]> {
  try {
    const serverUrl = await getServerUrlAsync();
    const res = await fetch(
      `${serverUrl}/api/ice-servers`
    );
    const data = await res.json();
    return data.iceServers;
  } catch {
    // Fallback to Google STUN only
    return [{ urls: 'stun:stun.l.google.com:19302' }];
  }
}

export function createPeerConnection(iceServers: RTCIceServer[]): RTCPeerConnection {
  return new RTCPeerConnection({ iceServers });
}
