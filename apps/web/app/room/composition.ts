import { defineComponent, h, reactive } from 'vue';
import { layoutSchema } from '@study/contracts';
import { TileRegistry, UiRegistry, Workspace } from '@study/core/browser';

export interface Participant {
  id: string;
  name: string;
  initials: string;
  status: string;
  camera: boolean;
  expanded: boolean;
}

/** Shared room hosts and controls; features register their own surfaces at composition time. */
export function createRoomComposition(displayName: string, invite: () => void) {
  const ui = new UiRegistry(),
    tiles = new TileRegistry(),
    workspace = new Workspace(tiles);
  const participants = reactive<Participant[]>([
    {
      id: 'self',
      name: `${displayName} (you)`,
      initials: displayName.slice(0, 2).toUpperCase(),
      status: 'Connecting…',
      camera: false,
      expanded: false,
    },
  ]);
  const state = reactive({ notice: '', more: false, refresh: () => {} });
  // This tile type is persisted in existing device layouts; keep its identifier stable.
  const guideType = 'demo.sandbox';
  tiles.register(guideType, {
    type: guideType,
    label: 'Workspace guide',
    defaultSize: { width: 360, height: 260 },
    minimumSize: { width: 220, height: 180 },
    resizable: true,
    fullscreenable: true,
    layoutSchema,
    load: async () =>
      defineComponent({
        setup: () => () =>
          h('div', { class: 'workspace-guide' }, [
            h('span', { class: 'workspace-orbit', 'aria-hidden': 'true' }, '✧'),
            h('h3', 'A little room to think.'),
            h('p', 'Move a workspace tile, resize it, or tuck it away.'),
            h('small', 'Keyboard: arrows on Move / Resize. Shift = larger steps.'),
          ]),
      }),
  });
  const register = (
    id: string,
    point: 'bottomDock' | 'roomMoreMenu',
    order: number,
    label: string,
    render: () => ReturnType<typeof h>,
  ) =>
    ui.register(id, {
      id,
      point,
      order,
      label,
      load: async () => defineComponent({ setup: () => render }),
    });
  register('room.media', 'bottomDock', 0, 'Media', () =>
    h(
      'button',
      {
        'aria-label': 'Media',
        onClick: () => {
          state.notice = 'Media providers are not connected yet.';
        },
      },
      [h('span', { 'aria-hidden': 'true', class: 'dock-icon' }, '♫'), h('small', 'Media')],
    ),
  );
  register('room.more', 'bottomDock', 5, 'More', () =>
    h(
      'button',
      {
        'aria-label': 'More',
        'aria-expanded': state.more,
        'aria-controls': 'room-more',
        onClick: () => {
          state.more = !state.more;
        },
      },
      [h('span', { 'aria-hidden': 'true', class: 'dock-icon' }, '•••'), h('small', 'More')],
    ),
  );
  register('room.workspace-guide', 'roomMoreMenu', 10, 'Workspace guide', () =>
    h(
      'button',
      {
        onClick: () => {
          const tile = workspace.open(guideType, 'sample');
          workspace.update(tile.id, { ...tile.layout, minimized: false });
          workspace.focus(tile.id);
          state.refresh();
          state.more = false;
        },
      },
      'Open workspace guide',
    ),
  );
  register('room.invite', 'roomMoreMenu', 20, 'Invite management', () =>
    h('button', { onClick: invite }, 'Room details & invitations'),
  );
  return { ui, tiles, workspace, participants, state };
}
export type RoomComposition = ReturnType<typeof createRoomComposition>;
