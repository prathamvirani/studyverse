import { AccessToken, RoomServiceClient, TrackSource } from 'livekit-server-sdk';
import type { MediaAuthority } from '@study/feature-sdk';
/** Server-authoritative grants. Encoder ceilings are product-client resource policy. */
export function liveKitAuthority(config: {
  url: string;
  serviceUrl?: string | undefined;
  roomPrefix?: string | undefined;
  apiKey: string;
  apiSecret: string;
}): MediaAuthority {
  const url = new URL(config.url);
  const prefix = config.roomPrefix ?? 'study-';
  if (!/^[a-z][a-z0-9-]{2,40}-$/.test(prefix)) throw new Error('Invalid media room namespace');
  if (url.protocol !== 'wss:' || url.username || url.password || url.search || url.hash)
    throw new Error('A secure SFU URL is required');
  const service = new RoomServiceClient(
    config.serviceUrl ?? config.url.replace(/^wss:/, 'https:'),
    config.apiKey,
    config.apiSecret,
  );
  return {
    enforcement: { scopedGrants: true },
    async reset() {
      // Ephemeral sessions cannot outlive the authority process which owns their leases.
      for (const room of await service.listRooms())
        if (room.name.startsWith(prefix)) await service.deleteRoom(room.name);
    },
    async reconcile(allowed) {
      for (const room of await service.listRooms()) {
        if (!room.name.startsWith(prefix)) continue;
        const roomId = room.name.slice(prefix.length);
        for (const participant of await service.listParticipants(room.name)) {
          // Consult the live inventory after network IO: a concurrently admitted new tab
          // must not be evicted because a pre-request array snapshot omitted it.
          if (!allowed(roomId, participant.identity))
            await service.removeParticipant(room.name, participant.identity);
        }
      }
    },
    async participants(roomId) {
      try {
        return (await service.listParticipants(`${prefix}${roomId}`)).map((p) => ({
          connectionId: p.identity,
          publishing: p.tracks.length > 0,
        }));
      } catch (error) {
        if ((error as { code?: string }).code === 'not_found') return [];
        throw error;
      }
    },
    async issue(input) {
      const room = `${prefix}${input.roomId}`;
      const token = new AccessToken(config.apiKey, config.apiSecret, {
        identity: input.connectionId,
        ttl: Math.max(1, Math.floor((input.expiresAt - Date.now()) / 1000)),
      });
      const sources = {
        microphone: TrackSource.MICROPHONE,
        camera: TrackSource.CAMERA,
        screen: TrackSource.SCREEN_SHARE,
      };
      token.addGrant({
        roomJoin: true,
        room,
        canSubscribe: true,
        canPublish: input.sources.length > 0,
        canPublishSources: input.sources.map((s) => sources[s]),
        canPublishData: false,
        canUpdateOwnMetadata: false,
        roomAdmin: false,
        roomCreate: false,
        roomList: false,
        roomRecord: false,
        ingressAdmin: false,
      });
      return {
        url: config.url,
        token: await token.toJwt(),
        room,
        connectionId: input.connectionId,
        expiresAt: input.expiresAt,
        sources: input.sources,
      };
    },
    async remove(roomId, connectionId) {
      try {
        await service.removeParticipant(`${prefix}${roomId}`, connectionId);
      } catch (error) {
        if ((error as { code?: string }).code !== 'not_found') throw error;
      }
    },
  };
}
