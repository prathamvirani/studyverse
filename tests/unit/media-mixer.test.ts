import { expect, it, vi } from 'vitest';
import { createRoomMediaModel } from '../../apps/web/app/room/room-media-model.ts';
import { initialPlayback, defaultMediaSettings } from '@study/room-media/browser';
import type { MediaView } from '@study/contracts';
import type { RealtimeClient } from '../../apps/web/app/lib/realtime.ts';
it('coalesces mixer fields, preserves unrelated server levels and cancels pending work on disposal', async () => {
  vi.useFakeTimers();
  const actions: unknown[] = [];
  const snapshot: MediaView = {
    roomId: '00000000-0000-4000-8000-000000000001',
    epoch: '00000000-0000-4000-8000-000000000002',
    version: 0,
    state: initialPlayback(1000),
    ownerBaseline: initialPlayback(1000),
    settings: defaultMediaSettings,
    ownerPresent: true,
    temporary: false,
    canControl: true,
    isOwner: true,
    controller: null,
    changedBy: [],
    suggestions: [],
  };
  snapshot.state.mix.ambience.pink = 0.2;
  const client = {
    state: { connected: true },
    refresh: () => {},
    send: async (_name: string, fields: { action: { mix: MediaView['state']['mix'] } }) => {
      actions.push(fields.action);
      snapshot.state.mix = fields.action.mix;
      snapshot.version++;
      return structuredClone(snapshot);
    },
  } as unknown as RealtimeClient;
  const model = createRoomMediaModel(snapshot.roomId, 'viewer', client);
  try {
    model.state.view = structuredClone(snapshot);
    model.scheduleMix({ ambience: { rain: 0.1 } });
    model.scheduleMix({ ambience: { rain: 0.6, brown: 0.4 } });
    model.scheduleMix({ music: 0.3 });
    expect(actions).toHaveLength(0);
    expect(model.state.previewMix?.ambience.rain).toBe(0.6);
    await vi.advanceTimersByTimeAsync(351);
    expect(actions).toHaveLength(1);
    expect(model.state.view?.state.mix).toEqual({
      music: 0.3,
      ambience: { rain: 0.6, white: 0, pink: 0.2, brown: 0.4 },
    });
    model.scheduleMix({ music: 0.9 });
    model.dispose();
    await vi.advanceTimersByTimeAsync(1000);
    expect(actions).toHaveLength(1);
  } finally {
    model.dispose();
    vi.useRealTimers();
  }
});
