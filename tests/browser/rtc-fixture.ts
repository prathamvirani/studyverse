import { createApp, h } from 'vue';
import { createRoomComposition } from '../../apps/web/app/room/composition.ts';
import { registerRtc } from '../../apps/web/app/room/rtc.ts';
// @ts-expect-error SFC compiled by the isolated browser harness.
import RoomShell from '../../apps/web/app/components/room/RoomShell.vue';
import type { RealtimeMediaProvider, MediaSnapshot } from '@study/feature-sdk';
import type { MediaSource } from '@study/contracts';
import type { createApiClient } from '../../apps/web/app/lib/api-client.ts';
const listeners = new Set<() => void>();
let snapshot: MediaSnapshot = { connection: 'disconnected', tracks: [] };
const emit = () => {
  for (const f of listeners) f();
};
const provider: RealtimeMediaProvider = {
  snapshot: () => snapshot,
  listen: (f) => {
    listeners.add(f);
    return () => listeners.delete(f);
  },
  connect: async () => {
    snapshot = { connection: 'connected', tracks: [] };
    emit();
  },
  disconnect: async () => {
    for (const t of snapshot.tracks) t.stream?.getTracks().forEach((t) => t.stop());
    snapshot = { connection: 'disconnected', tracks: [] };
    emit();
  },
  async publish(source) {
    const stream =
      source === 'screen'
        ? await navigator.mediaDevices.getDisplayMedia({ video: true })
        : await navigator.mediaDevices.getUserMedia(
            source === 'microphone' ? { audio: true } : { video: { width: 640, height: 360 } },
          );
    const id = crypto.randomUUID();
    snapshot = {
      ...snapshot,
      tracks: [
        ...snapshot.tracks,
        {
          id,
          source,
          userId: 'self',
          participantId: 'fixture-tab',
          local: true,
          muted: false,
          stream,
          requested: { width: 640, height: 360 },
          actual: {},
        },
      ],
    };
    for (const track of stream.getTracks())
      track.addEventListener('ended', () => {
        snapshot = { ...snapshot, tracks: snapshot.tracks.filter((t) => t.id !== id) };
        emit();
      });
    emit();
  },
  async unpublish(source) {
    for (const t of snapshot.tracks.filter((t) => t.source === source))
      t.stream?.getTracks().forEach((t) => t.stop());
    snapshot = { ...snapshot, tracks: snapshot.tracks.filter((t) => t.source !== source) };
    emit();
  },
  async mute(source, muted) {
    for (const t of snapshot.tracks.filter((t) => t.source === source)) {
      t.muted = muted;
      t.stream?.getTracks().forEach((t) => {
        t.enabled = !muted;
      });
    }
    emit();
  },
  async switchDevice(source, deviceId) {
    await provider.unpublish(source);
    const stream = await navigator.mediaDevices.getUserMedia(
      source === 'camera' ? { video: { deviceId } } : { audio: { deviceId } },
    );
    snapshot = {
      ...snapshot,
      tracks: [
        ...snapshot.tracks,
        {
          id: crypto.randomUUID(),
          source,
          userId: 'self',
          participantId: 'fixture-tab',
          local: true,
          muted: false,
          stream,
          requested: {},
          actual: {},
        },
      ],
    };
    emit();
  },
  receive: () => {},
  devices: async () => Array.from(await navigator.mediaDevices.enumerateDevices()),
};
const shell = createRoomComposition('Synthetic device', () => {});
const api = {
  request: async (path: string) =>
    path.endsWith('/audience')
      ? [...new Set(snapshot.tracks.filter((t) => !t.local).map((t) => t.userId))].map(
          (userId) => ({
            connectionId: `${userId}-tab`,
            userId,
            name: `${userId} · synthetic`,
          }),
        )
      : path.endsWith('/join')
        ? {
            url: 'wss://fixture.invalid',
            token: 'fixture-only',
            room: 'fixture',
            connectionId: crypto.randomUUID(),
            expiresAt: Date.now() + 60000,
            sources: ['microphone', 'camera', 'screen'] as MediaSource[],
          }
        : { ok: true },
} as unknown as ReturnType<typeof createApiClient>;
const media = registerRtc(shell, provider, api, 'fixture-room', 'self');
(window as unknown as { addRemoteMedia: () => Promise<void> }).addRemoteMedia = async () => {
  for (const userId of ['remote-one', 'remote-two']) {
    shell.participants.push({
      id: userId,
      name: `${userId} · synthetic`,
      initials: 'RT',
      status: 'Synthetic remote',
      camera: false,
      expanded: false,
    });
    for (const source of ['camera', 'screen'] as const) {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      snapshot = {
        ...snapshot,
        tracks: [
          ...snapshot.tracks,
          {
            id: crypto.randomUUID(),
            userId,
            participantId: `${userId}-tab`,
            source,
            local: false,
            muted: false,
            stream,
            requested: { width: 640, height: 360 },
            actual: {},
          },
        ],
      };
    }
  }
  emit();
};
createApp({
  render: () =>
    h(RoomShell, {
      room: {
        id: 'fixture-room',
        name: 'Basic RTC · synthetic browser devices',
        privacy: 'Test fixture',
      },
      ui: shell.ui,
      workspace: shell.workspace,
      participants: shell.participants,
      cameraRenderer: media.cameraRenderer,
      roomState: shell.state,
      onLeave: () => void media.dispose(),
    }),
}).mount('#app');
