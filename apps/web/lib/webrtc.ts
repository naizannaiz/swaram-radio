// lib/webrtc.ts
// WebRTC helpers — fetch ICE servers from backend (TURN creds never in frontend bundle)
export async function getIceServers(): Promise<RTCIceServer[]> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SERVER_URL}/api/ice-servers`
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
