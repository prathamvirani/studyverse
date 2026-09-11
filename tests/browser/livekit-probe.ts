/** Test-only adversarial adapter fixture, not a public package export or production import. */
import { Room, Track } from 'livekit-client';
import type { MediaCredential, MediaSource } from '@study/contracts';
let room: Room | undefined;
const probe = {
  async connect(c: MediaCredential) {
    await room?.disconnect();
    room = new Room();
    try {
      await room.connect(c.url, c.token, { autoSubscribe: false });
      return { connected: true, identity: room.localParticipant.identity, room: room.name };
    } catch (error) {
      return { connected: false, error: error instanceof Error ? error.message : 'failed' };
    }
  },
  async publish(source: MediaSource) {
    // Deliberately hostile client: bypass SDK's local permission preflight.
    // Only the real SFU's signed grants may reject this attempt.
    if (room?.localParticipant.permissions) {
      room.localParticipant.permissions.canPublish = true;
      room.localParticipant.permissions.canPublishSources = [];
    }
    const stream = await navigator.mediaDevices.getUserMedia(
      source === 'microphone' ? { audio: true } : { video: true },
    );
    try {
      const publication = await room!.localParticipant.publishTrack(stream.getTracks()[0]!, {
        source:
          source === 'microphone'
            ? Track.Source.Microphone
            : source === 'camera'
              ? Track.Source.Camera
              : Track.Source.ScreenShare,
      });
      return { published: true, id: publication.trackSid };
    } catch {
      stream.getTracks().forEach((t) => t.stop());
      return { published: false };
    }
  },
  async disconnect() {
    await room?.disconnect();
  },
  state() {
    return { connected: room?.state === 'connected' };
  },
};
(window as unknown as { probe: typeof probe }).probe = probe;
export type Probe = typeof probe;
