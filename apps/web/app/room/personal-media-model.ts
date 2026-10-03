import { reactive } from 'vue';
import { createPreferenceStore } from '@study/adapters/indexeddb';
import {
  createPersonalPlayer,
  createPersonalState,
  personalPreference,
  PersonalProviderRegistry,
} from '@study/personal-media/browser';
import type { PersonalPlayer } from '@study/personal-media/browser';
import type { PersonalMediaAdapter } from '@study/feature-sdk';

export function createPersonalMediaModel(
  userId: string,
  adapters: PersonalMediaAdapter[],
  roomGain: (gain: number) => void,
) {
  const state = reactive(createPersonalState()),
    registry = new PersonalProviderRegistry();
  for (const adapter of adapters) registry.register(adapter);
  let disposed = false;
  let playIntent = false,
    restartIntent = false;
  const model = {
    state,
    player: undefined as PersonalPlayer | undefined,
    ready: Promise.resolve(),
    openTile: () => {},
    closeTile: () => {},
    promote: async () => false,
    canPromote: () => false,
    promotionLabel: () => 'Suggest to room',
    cancelPlay() {
      playIntent = false;
      restartIntent = false;
    },
    async play(startOver = false) {
      if (state.attached) model.player?.play(startOver);
      else {
        playIntent = true;
        restartIntent = startOver;
        model.openTile();
        await model.player?.prepare();
        if (playIntent && state.attached && !disposed) {
          playIntent = false;
          model.player?.play(restartIntent);
        }
      }
    },
    async mount(host: HTMLElement) {
      await model.ready;
      if (disposed) return;
      await model.player?.mount(host);
      if (playIntent && state.attached && !disposed) {
        playIntent = false;
        model.player?.play(restartIntent);
      }
    },
    async open(input: string) {
      await model.ready;
      if (!model.player?.select(input) || disposed) return false;
      model.cancelPlay();
      model.openTile();
      return true;
    },
    async dispose() {
      disposed = true;
      model.cancelPlay();
      await model.ready;
      await model.player?.dispose();
    },
  };
  model.ready = (async () => {
    const preference = personalPreference(userId),
      store = await createPreferenceStore([preference]);
    if (disposed) {
      await store.close();
      return;
    }
    model.player = createPersonalPlayer({ registry, state, store, preference, roomGain });
    await model.player.init();
  })().catch(() => {
    state.error = 'Device storage could not initialize. Please reload to try again.';
  });
  return model;
}
export type PersonalMediaModel = ReturnType<typeof createPersonalMediaModel>;
