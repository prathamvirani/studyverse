import { defineComponent, h } from 'vue';
import type { PropType } from 'vue';
import { layoutSchema } from '@study/contracts';
import type { TileInstance } from '@study/core/browser';
import { createRoomComposition } from '../../apps/web/app/room/composition.ts';
import { cameraLocation } from '@study/rtc/browser';

export const MockCamera = defineComponent({
  props: { participantId: { type: String, required: true } },
  setup: (props) => () =>
    h('div', { 'data-camera-renderer': props.participantId }, 'Synthetic camera'),
});
export const cameraTarget = (p: { camera: boolean; expanded: boolean }) =>
  cameraLocation(p.camera, p.expanded);
/** Synthetic renderer proves generic workspace lifecycle independently of capture/transport. */
export function createCameraFixture() {
  const room = createRoomComposition('Test', () => {});
  const participant = room.participants[0]!;
  room.tiles.register('fixture.camera', {
    type: 'fixture.camera',
    label: 'Synthetic camera',
    defaultSize: { width: 360, height: 260 },
    minimumSize: { width: 220, height: 180 },
    resizable: true,
    fullscreenable: true,
    persist: false,
    layoutSchema,
    load: async () =>
      defineComponent({
        props: { instance: { type: Object as PropType<TileInstance>, required: true } },
        setup: (props) => () => h(MockCamera, { participantId: props.instance.resourceKey }),
      }),
    onOpen: () => {
      participant.expanded = true;
    },
    onClose: () => {
      participant.expanded = false;
    },
    onLayoutChange: (_, layout) => {
      participant.expanded = !layout.minimized;
    },
  });
  return room;
}
