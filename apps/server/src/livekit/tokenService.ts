// src/livekit/tokenService.ts
// Server-side token generation — API secret NEVER leaves this file
import { AccessToken } from 'livekit-server-sdk';

export const ROOM_NAME = 'swaram-live';

const getCredentials = () => {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!apiKey || !apiSecret) {
    throw new Error('LIVEKIT_API_KEY or LIVEKIT_API_SECRET is not configured');
  }
  return { apiKey, apiSecret };
};

/** Listener token — subscribe only, cannot publish */
export async function createListenerToken(displayName: string): Promise<string> {
  const { apiKey, apiSecret } = getCredentials();
  const identity = `listener-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const at = new AccessToken(apiKey, apiSecret, {
    identity,
    name: displayName,
    ttl: '4h',
  });
  at.addGrant({
    roomJoin: true,
    room: ROOM_NAME,
    canPublish: false,
    canSubscribe: true,
    canPublishData: false,
  });
  return at.toJwt();
}

/** Host token — publish + subscribe + admin */
export async function createHostToken(hostName: string): Promise<string> {
  const { apiKey, apiSecret } = getCredentials();
  const at = new AccessToken(apiKey, apiSecret, {
    identity: 'host',
    name: hostName,
    ttl: '8h',
  });
  at.addGrant({
    roomJoin: true,
    room: ROOM_NAME,
    roomAdmin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });
  return at.toJwt();
}

/** Caller token — publish + subscribe, time-limited to 1h */
export async function createCallerToken(
  callerName: string,
  callerId: string
): Promise<string> {
  const { apiKey, apiSecret } = getCredentials();
  const at = new AccessToken(apiKey, apiSecret, {
    identity: `caller-${callerId.slice(0, 8)}`,
    name: callerName,
    ttl: '1h',
  });
  at.addGrant({
    roomJoin: true,
    room: ROOM_NAME,
    canPublish: true,
    canSubscribe: true,
    canPublishData: false,
  });
  return at.toJwt();
}
