<script setup lang="ts">
import {
  UiExtensionHost,
  ArrowLeft,
  Plus,
  X,
  MicOff,
  PanelsRightBottom,
  StudySelect,
  OverlayPopover,
  Grip,
  MenuRow,
  PictureInPicture2,
  Settings,
} from '@study/ui';
import { arrangementPreference, defaultArrangement } from '../../lib/room-arrangement';
import { layoutGesture } from '@study/core/browser';
import {
  bounded,
  defaultSafeEdges,
  displace,
  headerAnchors,
  magneticHeader,
  railRectangle,
} from '../../lib/room-arrangement-layout';
import type { RailEdge } from '../../lib/room-arrangement-layout';
import type { Rectangle } from '@study/core/browser';
import { workspacePreference } from '@study/core/browser';
import type { Workspace, UiRegistry, Bounds } from '@study/core/browser';
import { createPreferenceStore } from '@study/adapters/indexeddb';
import type { Component } from 'vue';
import {
  presentationPreference,
  presentationPreset,
  standardPresentation,
} from '../../lib/room-presentation';
import type { Presentation } from '../../lib/room-presentation';
import WorkspaceHost from './WorkspaceHost.vue';
import RoomSettings from './RoomSettings.vue';
import { workspacePopouts } from '../../lib/workspace-popouts';
import { copyAppLink, shareAppLink } from '../../lib/context-link';
import { roomAddress } from '../../lib/room-navigation';
import { useContextActions, useContextTargets } from '../../composables/useContextActions';
const props = defineProps<{
  room: { id: string; name: string; privacy: string; ownerId?: string };
  userId?: string;
  ui: UiRegistry;
  workspace: Workspace;
  participants: {
    id: string;
    name: string;
    initials: string;
    status: string;
    camera: boolean;
    expanded: boolean;
    microphone?: boolean;
    speaking?: boolean;
  }[];
  cameraRenderer?: Component;
  preview?: boolean;
  previewBackground?: string;
  roomState: {
    notice: string;
    more: boolean;
    refresh: () => void;
    closeSettings?: () => void;
    preparePopouts?: () => void;
  };
}>();
const emit = defineEmits<{ leave: []; invite: []; visualReady: [] }>();
const roomElement = ref<HTMLElement>(),
  workspaceHost = ref<InstanceType<typeof WorkspaceHost>>();
const rearrange = ref(false),
  advanced = ref(false),
  identityOpen = ref(false),
  identityAnchor = ref<HTMLElement>(),
  moreAnchor = ref<HTMLElement>();
const menus = useContextTargets();
const popouts = workspacePopouts(
  (message) => {
    props.roomState.notice = message;
  },
  (doc) => menus.host?.attach(doc) ?? (() => {}),
);
const workspaceObstacles = computed(() => {
  void popouts.count.value;
  const surface = roomElement.value?.querySelector<HTMLElement>('.workspace-surface');
  const x = surface?.offsetLeft ?? safeEdges.value.left,
    y = surface?.offsetTop ?? safeEdges.value.top;
  return (['header', 'rail', 'dock', 'workspace'] as const)
    .filter((key) =>
      key === 'rail' ? chrome('participants') : key === 'dock' ? chrome('dock') : chrome('header'),
    )
    .filter((key) => chromeRefs[key]?.dataset.poppedOut !== 'true')
    .map((key) => ({
      ...positions.value[key],
      x: positions.value[key].x - x,
      y: positions.value[key].y - y,
    }));
});
const participantAnchor = computed(() => {
  // Track selection even before the rail ref exists on the first render.
  const id = selected.value;
  return chromeRefs.rail?.querySelector<HTMLElement>(`#participant-${CSS.escape(id)}`) ?? undefined;
});
const participantDocument = computed(
  () =>
    participantAnchor.value?.ownerDocument.body ?? (import.meta.client ? document.body : undefined),
);
function dockAction(label: string) {
  chromeRefs.dock?.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)?.click();
}
function canvasActions() {
  if (props.preview) return [];
  const path = `/rooms/${roomAddress(props.room)}`;
  return [
    { id: 'room.rearrange', label: 'Rearrange view', run: startRearrange },
    { id: 'room.reset', label: 'Reset layout', run: resetArrangement },
    { id: 'room.popouts', label: 'Pop out all', run: popoutAll },
    ...(popouts.count.value
      ? [{ id: 'room.restore', label: 'Restore all', run: () => popouts.restoreAll() }]
      : []),
    {
      id: 'room.settings',
      label: 'Advanced settings',
      run: () => {
        window.focus();
        advanced.value = true;
      },
    },
    { id: 'room.background', label: 'Background', run: () => dockAction('Background') },
    { id: 'room.media', label: 'Media', run: () => dockAction('Media') },
    { id: 'room.copy', label: 'Copy room link', run: () => copyAppLink(path) },
    { id: 'room.share', label: 'Share room', run: () => shareAppLink(path, props.room.name) },
    ...(props.room.ownerId === props.userId
      ? [{ id: 'room.invite', label: 'Invite', run: () => emit('invite') }]
      : []),
  ];
}
useContextActions(roomElement, canvasActions);
async function popoutChrome(key: 'rail' | 'dock', utilityOnly = false) {
  const node = chromeRefs[key];
  if (node) await popouts.open([node], utilityOnly);
}
async function popoutAll() {
  props.roomState.more = false;
  props.roomState.preparePopouts?.();
  refresh();
  const cards = props.workspace
    .values()
    .filter(
      (item) =>
        !item.layout.minimized || props.workspace.types.get(item.type)?.minimizedPresentation,
    );
  const specs: { id: string; label: string; width?: number; height?: number }[] = cards.map(
    (item) => ({
      id: item.id,
      label: props.workspace.types.get(item.type)!.label,
    }),
  );
  if (chrome('participants')) specs.push({ id: 'participant-rail', label: 'Participant rail' });
  if (chrome('dock'))
    specs.push({ id: 'room-controls', label: 'Room controls', width: 720, height: 110 });
  popouts.reserveAll(specs);
  if (popouts.reserved('participant-rail')) await popoutChrome('rail', true);
  if (popouts.reserved('room-controls')) await popoutChrome('dock', true);
  await workspaceHost.value?.popoutAll();
}
function objectActions(key: string) {
  if (key === 'rail' || key === 'dock')
    return [
      {
        id: `room.popout-${key}`,
        label: key === 'rail' ? 'Pop out participants' : 'Pop out room controls',
        run: () => popoutChrome(key),
      },
      ...canvasActions(),
    ];
  return canvasActions();
}
const arrangement = ref(defaultArrangement());
const railDrag = ref<{ rect: Rectangle; edge: RailEdge | null; horizontalX: number } | null>(null);
const headerDrag = ref<{ x: number; anchor: number | null } | null>(null);
const draggingObject = ref('');
const safeEdges = ref({ ...defaultSafeEdges });
const arrangementDef = arrangementPreference(props.room.id, props.userId ?? 'device');
const roomBounds = ref({ width: 600, height: 600 });
const sizes = ref<Record<string, { width: number; height: number }>>({});
let chromeObserver: ResizeObserver | undefined, cleanupGesture: (() => void) | undefined;
const chromeRefs: Record<string, HTMLElement> = {};
function chromeRef(key: string, element: unknown) {
  if (element instanceof HTMLElement) {
    chromeRefs[key] = element;
    chromeObserver?.observe(element);
    if (key !== 'audio') menus.bind(`chrome-${key}`, element, () => objectActions(key));
  }
}
function measure() {
  if (!roomElement.value) return;
  roomBounds.value = {
    width: roomElement.value.clientWidth,
    height: roomElement.value.clientHeight,
  };
  const css = getComputedStyle(roomElement.value);
  safeEdges.value = {
    left: parseFloat(css.paddingLeft),
    right: parseFloat(css.paddingRight),
    top: parseFloat(css.paddingTop),
    bottom: parseFloat(css.paddingBottom),
  };
  const next: Record<string, { width: number; height: number }> = { ...sizes.value };
  for (const [key, element] of Object.entries(chromeRefs))
    if (element.dataset.poppedOut !== 'true')
      next[key] = { width: element.offsetWidth, height: element.offsetHeight };
  sizes.value = next;
}
function box(
  key: string,
  fallback: { width: number; height: number },
  x: number,
  y: number,
): Rectangle {
  const size = sizes.value[key] ?? fallback,
    bounds = roomBounds.value;
  const point = arrangement.value.points[key] ?? { x, y };
  return bounded({ ...size, ...point }, bounds, safeEdges.value);
}

const positions = computed(() => {
  const bounds = roomBounds.value,
    safe = safeEdges.value;
  const headSize = sizes.value.header ?? { width: 380, height: 44 };
  const anchors = headerAnchors(bounds, headSize.width, safe);
  const header = bounded(
    {
      ...headSize,
      x: headerDrag.value?.x ?? arrangement.value.headerX ?? anchors[arrangement.value.header]!,
      y: safe.top,
    },
    bounds,
    safe,
  );
  const requestedDock = box(
    'dock',
    { width: 420, height: 68 },
    (bounds.width - (sizes.value.dock?.width ?? 420)) / 2,
    bounds.height - (sizes.value.dock?.height ?? 68) - safe.bottom,
  );
  const requestedWorkspace = box(
    'workspace',
    { width: 130, height: 44 },
    Math.min(bounds.width - 142, header.x + header.width + 12),
    safe.top,
  );
  const workspace = displace(requestedWorkspace, [header], bounds, safe) ?? requestedWorkspace;
  // The topBar port contains nonvisual remote-audio renderers, not a movable rail control.
  const audio = box('audio', { width: 0, height: 0 }, bounds.width - 120, 70);
  const finalRail = railRectangle(
    arrangement.value.rail,
    bounds,
    header,
    [workspace],
    props.participants.length,
    arrangement.value.points.rail?.x,
    safe,
  );
  const rail = railDrag.value?.rect ?? finalRail;
  const proposedRail = railDrag.value?.edge
    ? railRectangle(
        railDrag.value.edge,
        bounds,
        header,
        [workspace],
        props.participants.length,
        railDrag.value.horizontalX,
        safe,
      )
    : null;
  const dock =
    displace(
      requestedDock,
      [header, rail, ...(proposedRail ? [proposedRail] : []), workspace],
      bounds,
      safe,
      true,
    ) ?? requestedDock;
  const requested = box('atmosphere', { width: 280, height: 84 }, 110, bounds.height - 220);
  const surface = roomElement.value?.querySelector<HTMLElement>('.workspace-surface');
  const cards = props.workspace
    .values()
    .filter((i) => !i.layout.minimized)
    .map((i) => ({
      ...i.layout,
      x: i.layout.x + (surface?.offsetLeft ?? 98),
      y: i.layout.y + (surface?.offsetTop ?? 78),
    }));
  void revision.value;
  const caption =
    displace(requested, [header, rail, dock, workspace, ...cards], bounds, safe) ??
    displace(requested, [header, rail, dock, workspace], bounds, safe);
  const actionsSize = sizes.value.rearrange ?? { width: 320, height: 60 };
  const actions = {
    ...actionsSize,
    x: (bounds.width - actionsSize.width) / 2,
    y: bounds.height - actionsSize.height - 120,
  };
  const rearrangePosition =
    displace(actions, [header, rail, dock, workspace], bounds, safe) ??
    bounded(actions, bounds, safe);
  return {
    header,
    rail,
    dock,
    workspace,
    audio,
    atmosphere: caption ?? requested,
    captionVisible: !!caption,
    rearrange: rearrangePosition,
  };
});
const railPreview = computed(() =>
  railDrag.value?.edge
    ? railRectangle(
        railDrag.value.edge,
        roomBounds.value,
        positions.value.header,
        [positions.value.workspace],
        props.participants.length,
        railDrag.value.horizontalX,
        safeEdges.value,
      )
    : null,
);
const headerPreview = computed(() =>
  headerDrag.value?.anchor !== null && headerDrag.value
    ? {
        ...positions.value.header,
        x: headerAnchors(roomBounds.value, positions.value.header.width, safeEdges.value)[
          headerDrag.value.anchor
        ]!,
      }
    : null,
);
function objectStyle(
  key: 'header' | 'rail' | 'dock' | 'workspace' | 'audio' | 'atmosphere' | 'rearrange',
) {
  const rect = positions.value[key];
  return {
    left: `${rect.x}px`,
    top: `${rect.y}px`,
    ...(key === 'rail' ? { width: `${rect.width}px`, height: `${rect.height}px` } : {}),
    right: 'auto',
    bottom: 'auto',
    transform: 'none',
  };
}
function moveObject(
  key: 'header' | 'rail' | 'dock' | 'workspace' | 'audio' | 'atmosphere',
  dx: number,
  dy: number,
  start: Rectangle,
) {
  const x = start.x + dx,
    y = start.y + dy,
    bounds = roomBounds.value;
  if (key === 'header') {
    arrangement.value.headerX = bounded(
      { ...start, x, y: safeEdges.value.top },
      bounds,
      safeEdges.value,
    ).x;
  } else {
    const point = bounded({ ...start, x, y }, bounds, safeEdges.value);
    arrangement.value.points[key] = { x: point.x, y: point.y };
  }
  refresh();
}
function objectPointer(
  e: PointerEvent,
  key: 'header' | 'rail' | 'dock' | 'workspace' | 'audio' | 'atmosphere',
) {
  if (!rearrange.value || e.button !== 0) return;
  const start = { ...positions.value[key] };
  cleanupGesture?.();
  draggingObject.value = key;
  if (key === 'header') {
    headerDrag.value = { x: start.x, anchor: null };
    cleanupGesture = layoutGesture(
      e,
      (dx) => {
        const x = bounded({ ...start, x: start.x + dx }, roomBounds.value, safeEdges.value).x;
        headerDrag.value = magneticHeader(
          x,
          headerAnchors(roomBounds.value, start.width, safeEdges.value),
        );
      },
      (event) => {
        if (event.type === 'pointerup' && headerDrag.value) {
          if (headerDrag.value.anchor !== null) {
            arrangement.value.header = headerDrag.value.anchor;
            arrangement.value.headerX = null;
          } else arrangement.value.headerX = headerDrag.value.x;
        }
        headerDrag.value = null;
        draggingObject.value = '';
        refresh();
      },
    );
    return;
  }
  if (key !== 'rail') {
    cleanupGesture = layoutGesture(
      e,
      (dx, dy) => moveObject(key, dx, dy, start),
      () => {
        draggingObject.value = '';
        refresh();
      },
    );
    return;
  }
  const roomRect = roomElement.value!.getBoundingClientRect();
  const descriptor = bounded(
    {
      x: e.clientX - roomRect.left - 24,
      y: e.clientY - roomRect.top - 28,
      width: Math.min(220, roomBounds.value.width - safeEdges.value.left - safeEdges.value.right),
      height: 56,
    },
    roomBounds.value,
    safeEdges.value,
  );
  railDrag.value = { rect: descriptor, edge: null, horizontalX: descriptor.x };
  cleanupGesture = layoutGesture(
    e,
    (dx, dy, event) => {
      const bounds = roomBounds.value;
      const x = event.clientX - roomRect.left,
        y = event.clientY - roomRect.top;
      const candidates = [
        { edge: 'left' as const, distance: x - safeEdges.value.left },
        { edge: 'right' as const, distance: bounds.width - safeEdges.value.right - x },
        { edge: 'top' as const, distance: y - safeEdges.value.top },
        { edge: 'bottom' as const, distance: bounds.height - safeEdges.value.bottom - y },
      ].sort((a, b) => a.distance - b.distance);
      const edge = candidates[0]!.distance <= 40 ? candidates[0]!.edge : null;
      const width = railRectangle(
        edge ?? 'bottom',
        bounds,
        positions.value.header,
        [positions.value.workspace],
        props.participants.length,
        undefined,
        safeEdges.value,
      ).width;
      railDrag.value = {
        rect: bounded(
          { ...descriptor, x: descriptor.x + dx, y: descriptor.y + dy },
          bounds,
          safeEdges.value,
        ),
        edge,
        horizontalX: Math.max(
          safeEdges.value.left,
          Math.min(x - width / 2, bounds.width - safeEdges.value.right - width),
        ),
      };
    },
    (event) => {
      if (event.type === 'pointerup' && railDrag.value?.edge) {
        arrangement.value.rail = railDrag.value.edge;
        arrangement.value.points.rail = { x: railDrag.value.horizontalX, y: safeEdges.value.top };
      }
      railDrag.value = null;
      draggingObject.value = '';
      refresh();
    },
  );
}
function objectKeys(
  e: KeyboardEvent,
  key: 'header' | 'rail' | 'dock' | 'workspace' | 'audio' | 'atmosphere',
) {
  const directions: Record<string, [number, number]> = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
  };
  const delta = directions[e.key];
  if (!delta) return;
  e.preventDefault();
  if (key === 'header') {
    if (e.altKey && delta[0]) {
      arrangement.value.header = Math.max(0, Math.min(3, arrangement.value.header + delta[0]));
      arrangement.value.headerX = null;
      refresh();
    } else if (delta[0])
      moveObject('header', delta[0] * (e.shiftKey ? 32 : 8), 0, positions.value.header);
  } else if (key === 'rail') {
    arrangement.value.rail =
      delta[0] < 0 ? 'left' : delta[0] > 0 ? 'right' : delta[1] < 0 ? 'top' : 'bottom';
    refresh();
  } else
    moveObject(
      key,
      delta[0] * (e.shiftKey ? 32 : 8),
      delta[1] * (e.shiftKey ? 32 : 8),
      positions.value[key],
    );
}
function startRearrange() {
  props.roomState.more = false;
  rearrange.value = true;
}
function resetArrangement() {
  arrangement.value = defaultArrangement();
  recoverLayout();
}
const revision = ref(0),
  dimmed = ref(false),
  selected = ref(''),
  layoutOpen = ref(false);
const presentation = ref<Presentation>({ ...standardPresentation }),
  revealed = ref(false);
const participantMenu = ref<HTMLElement>();
const cardDefinitions = computed(() => {
  void revision.value;
  return props.workspace.types.values().filter((t) => t.workspaceCard);
});
const panelStates = ref<Record<string, boolean>>({});
const fullscreen = computed(() => {
  void revision.value;
  return props.workspace.values().some((i) => i.layout.fullscreen && !i.layout.minimized);
});
const chrome = (part: 'header' | 'participants' | 'dock') =>
  presentation.value[part] || revealed.value;
const preference = workspacePreference(props.room.id, props.userId),
  legacy = workspacePreference(props.room.id);
const modePreference = presentationPreference(props.room.id, props.userId ?? 'device');
let store: Awaited<ReturnType<typeof createPreferenceStore>> | undefined,
  disposed = false,
  loaded = false;
let saveQueue = Promise.resolve(),
  lastSaved = '';
let currentBounds: Bounds = { width: 600, height: 400 };
let saveTimer: ReturnType<typeof setTimeout> | undefined;
function persist() {
  if (props.preview || !loaded || !store) return;
  const snapshot = {
    panels: { ...panelStates.value },
    dimmed: dimmed.value,
    tiles: props.workspace.snapshot(),
    snaps: Object.fromEntries(props.workspace.snaps),
  };
  const mode = { ...presentation.value },
    serialized = JSON.stringify([snapshot, mode, arrangement.value]);
  if (lastSaved === serialized) return;
  lastSaved = serialized;
  saveQueue = saveQueue
    .then(async () => {
      await store!.set(preference, snapshot);
      await store!.set(modePreference, mode);
      await store!.set(arrangementDef, JSON.parse(JSON.stringify(arrangement.value)));
    })
    .catch(() => {
      props.roomState.notice = 'Layout could not be saved. You can keep using this room.';
    });
}
function refresh() {
  revision.value++;
  for (const definition of cardDefinitions.value)
    panelStates.value[definition.type] = props.workspace
      .values()
      .some((i) => i.type === definition.type && !i.layout.minimized);
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persist, 180);
}
props.roomState.refresh = refresh;
props.roomState.closeSettings = () => {
  advanced.value = false;
};
async function ready(bounds: Bounds) {
  currentBounds = bounds;
  store ??= await createPreferenceStore(
    props.userId
      ? [preference, legacy, modePreference, arrangementDef]
      : [preference, modePreference, arrangementDef],
  );
  if (disposed) {
    await store.close();
    return;
  }
  let saved = await store.get(preference);
  const mode = await store.get(modePreference);
  arrangement.value = await store.get(arrangementDef);
  if (disposed) return;
  if (!saved.panels.initialized && props.userId) {
    saved = await store.get(legacy);
    if (disposed) return;
  }
  panelStates.value = { ...saved.panels };
  dimmed.value = saved.dimmed;
  presentation.value = {
    ...mode,
    atmosphere: mode.preset === 'custom' ? mode.atmosphere : true,
    header: true,
    participants: true,
    dock: true,
    preset: mode.preset === 'custom' ? 'custom' : 'standard',
  };
  props.workspace.recover(saved, bounds);
  const slots = props.workspace.snapSlots(bounds, workspaceObstacles.value);
  cardDefinitions.value.forEach((definition, index) => {
    const existing = props.workspace.values().find((i) => i.type === definition.type);
    if (existing || (saved.panels.initialized && saved.panels[definition.type] === false)) return;
    const tile = props.workspace.open(definition.type, 'room');
    if (bounds.width < 620 || index >= slots.length)
      props.workspace.update(tile.id, { ...tile.layout, minimized: true });
    else props.workspace.snap(tile.id, index, bounds, workspaceObstacles.value);
  });
  panelStates.value.initialized = true;
  loaded = true;
  if (store.mode === 'memory')
    props.roomState.notice = 'Layout is temporary because device storage is unavailable.';
  refresh();
  await nextTick();
  emit('visualReady');
}
function showCard(type: string, visible: boolean) {
  const tile =
    props.workspace.values().find((i) => i.type === type) ?? props.workspace.open(type, 'room');
  props.workspace.update(tile.id, { ...tile.layout, minimized: !visible, fullscreen: false });
  props.workspace.place(tile.id, {}, currentBounds, false);
  if (visible) props.workspace.focus(tile.id);
  refresh();
}
function preset(value: string) {
  presentation.value = presentationPreset(value as Presentation['preset']);
  revealed.value = false;
  for (const definition of cardDefinitions.value)
    showCard(
      definition.type,
      value === 'standard' ||
        value === 'custom' ||
        ((value === 'minimal' || value === 'projector') &&
          ['Pomodoro', 'Clock'].includes(definition.label)) ||
        (value === 'ambient' && definition.label === 'Clock'),
    );
  if (value === 'projector') {
    const visible = props.workspace
      .values()
      .filter((i) => props.workspace.types.get(i.type)?.workspaceCard && !i.layout.minimized);
    for (const [index, item] of visible.entries()) {
      props.workspace.unsnap(item.id);
      props.workspace.place(
        item.id,
        {
          x: currentBounds.width > 700 ? (index * currentBounds.width) / 2 : 0,
          y: currentBounds.width > 700 ? 0 : (index * currentBounds.height) / 2,
          width: currentBounds.width > 700 ? currentBounds.width / 2 - 10 : currentBounds.width,
          height: currentBounds.width > 700 ? currentBounds.height : currentBounds.height / 2 - 5,
        },
        currentBounds,
        false,
      );
    }
  }
  refresh();
}
function recoverLayout() {
  for (const [index, definition] of cardDefinitions.value.entries()) {
    showCard(definition.type, true);
    const tile = props.workspace.values().find((i) => i.type === definition.type)!;
    if (index < props.workspace.snapSlots(currentBounds, workspaceObstacles.value).length)
      props.workspace.snap(tile.id, index, currentBounds, workspaceObstacles.value);
    else
      props.workspace.place(
        tile.id,
        { x: 0, y: index * 24, width: 320, height: 260 },
        currentBounds,
        false,
      );
  }
  refresh();
}
watch(
  () => props.roomState.more,
  () => {
    moreAnchor.value =
      chromeRefs.dock?.querySelector<HTMLElement>('[aria-label="More"]') ?? undefined;
  },
);
watch(dimmed, refresh);
watch(
  () => props.preview,
  (preview) => {
    if (!preview) {
      refresh();
      void ready(currentBounds);
    }
  },
);
watch(presentation, refresh, { deep: true });
watch(advanced, async (open) => {
  if (open) return;
  await nextTick();
  document
    .querySelector<HTMLElement>(chrome('dock') ? 'button[aria-label="More"]' : '.room-reveal')
    ?.focus();
});

watch(
  () => props.roomState.more,
  (open) => {
    if (!open && !chrome('dock'))
      nextTick(() => document.querySelector<HTMLElement>('.room-reveal')?.focus());
  },
);
async function openParticipant(id: string) {
  selected.value = selected.value === id ? '' : id;
  await nextTick();
  participantMenu.value?.querySelector('button')?.focus();
}
function closeMenus() {
  const id = selected.value;
  selected.value = '';
  layoutOpen.value = false;
  if (id) chromeRefs.rail?.ownerDocument.getElementById(`participant-${id}`)?.focus();
}
function keys(event: KeyboardEvent) {
  if (document.querySelector('dialog[open]') || fullscreen.value) return;
  if (event.key === 'Escape') {
    if (rearrange.value) {
      rearrange.value = false;
      return;
    }
    if (selected.value) {
      closeMenus();
      return;
    }
    if (layoutOpen.value) {
      layoutOpen.value = false;
      document.querySelector<HTMLElement>('[aria-label="Workspace cards"]')?.focus();
      return;
    }
    closeMenus();
    presentation.value = { ...standardPresentation };
    revealed.value = false;
    nextTick(() => document.querySelector<HTMLElement>('button[aria-label="More"]')?.focus());
  }
}
function outside(event: PointerEvent) {
  if (!(event.target instanceof Element)) return;
  if (!event.target.closest('.participant-rail, .participant-actions')) selected.value = '';
  if (!event.target.closest('.workspace-controls')) layoutOpen.value = false;
}
onMounted(() => {
  chromeObserver = new ResizeObserver(measure);
  if (roomElement.value) chromeObserver.observe(roomElement.value);
  for (const element of Object.values(chromeRefs)) chromeObserver.observe(element);
  measure();
  moreAnchor.value =
    roomElement.value?.querySelector<HTMLElement>('[aria-label="More"]') ?? undefined;
  nextTick(() => {
    moreAnchor.value =
      roomElement.value?.querySelector<HTMLElement>('[aria-label="More"]') ?? undefined;
  });
  document.addEventListener('pointerdown', outside);
  document.addEventListener('keydown', keys);
});
onUnmounted(() => {
  disposed = true;
  popouts.close();
  chromeObserver?.disconnect();
  cleanupGesture?.();
  clearTimeout(saveTimer);
  persist();
  document.removeEventListener('pointerdown', outside);
  document.removeEventListener('keydown', keys);
  props.roomState.refresh = () => {};
  for (const item of props.workspace.values()) props.workspace.close(item.id);
  void saveQueue.finally(() => store?.close());
});
</script>
<template>
  <div
    ref="roomElement"
    class="room-shell"
    :data-entry-state="preview ? 'preview' : 'active'"
    :inert="preview"
    :data-rearrange="rearrange"
    :data-header-slot="arrangement.headerX === null ? arrangement.header : 'free'"
    :data-dragged-object="draggingObject"
    :data-rail-edge="arrangement.rail"
    :data-rail-dragging="!!railDrag"
    :class="{
      'room-dimmed': dimmed,
      'room-projector': presentation.preset === 'projector',
      'presentation-quiet': !chrome('dock'),
    }"
  >
    <div
      class="room-scene"
      :class="{ 'has-environment': ui.at('environment').length > 0 }"
      aria-hidden="true"
    >
      <img
        v-if="previewBackground"
        class="room-preview-background"
        :src="previewBackground"
        alt=""
      />
      <UiExtensionHost :registry="ui" point="environment" :context="{ revision }" />
    </div>
    <header
      :ref="(el) => chromeRef('header', el)"
      v-show="chrome('header')"
      class="room-top"
      :style="objectStyle('header')"
      :inert="fullscreen"
    >
      <button
        v-if="rearrange"
        class="room-object-grip"
        aria-label="Move room header"
        title="Drag horizontally. Arrow keys move; Alt + arrows snap."
        @pointerdown="objectPointer($event, 'header')"
        @keydown="objectKeys($event, 'header')"
      >
        <Grip :size="16" />
      </button>
      <button
        class="glass"
        aria-label="Back to room details"
        title="Back to room details"
        @click="emit('leave')"
      >
        <ArrowLeft :size="19" />
      </button>
      <button
        ref="identityAnchor"
        class="room-title glass"
        :aria-expanded="identityOpen"
        @click="identityOpen = !identityOpen"
      >
        <span class="room-name">{{ room.name }}</span>
        <span>{{ room.privacy }}</span>
      </button>
      <button class="invite-button glass" @click="emit('invite')">
        <Plus :size="16" /> Invite
      </button>
    </header>
    <OverlayPopover v-model:open="identityOpen" :anchor="identityAnchor" label="Room identity" focus
      ><UiExtensionHost :registry="ui" point="roomIdentity" :context="{ revision }"
    /></OverlayPopover>
    <div :ref="(el) => chromeRef('audio', el)" class="room-audio" :style="objectStyle('audio')">
      <UiExtensionHost :registry="ui" point="topBar" :context="{ revision }" />
    </div>
    <div
      v-if="railPreview"
      class="rail-snap-preview room-snap-preview"
      aria-hidden="true"
      :data-edge="railDrag?.edge"
      :style="{
        left: `${railPreview.x}px`,
        top: `${railPreview.y}px`,
        width: `${railPreview.width}px`,
        height: `${railPreview.height}px`,
      }"
    />
    <div
      v-if="headerPreview"
      class="header-snap-preview room-snap-preview"
      aria-hidden="true"
      :style="{
        left: `${headerPreview.x}px`,
        top: `${headerPreview.y}px`,
        width: `${headerPreview.width}px`,
        height: `${headerPreview.height}px`,
      }"
    />
    <aside
      v-show="chrome('participants')"
      :inert="fullscreen"
      :ref="(el) => chromeRef('rail', el)"
      class="participant-rail glass"
      data-popout-id="participant-rail"
      :style="objectStyle('rail')"
      :aria-label="`Participants · ${participants.length} active`"
    >
      <button
        v-if="rearrange"
        class="room-object-grip"
        aria-label="Move participants"
        @pointerdown="objectPointer($event, 'rail')"
        @keydown="objectKeys($event, 'rail')"
      >
        <Grip :size="16" />
      </button>
      <span v-show="railDrag" class="rail-drag-label">Participant Rail</span>
      <div
        v-for="p in participants"
        :key="p.id"
        class="participant-entry"
        :inert="!!railDrag"
        :aria-hidden="railDrag ? true : undefined"
        :class="{ 'participant-speaking': p.speaking }"
      >
        <button
          :ref="
            (node) =>
              menus.bind(`participant-${p.id}`, node, () => [
                {
                  id: 'participant.open',
                  label: 'Open participant controls',
                  run: () => openParticipant(p.id),
                },
                {
                  id: 'participant.popout',
                  label: 'Pop out participants',
                  run: () => popoutChrome('rail'),
                },
              ])
          "
          :id="`participant-${p.id}`"
          class="participant-circle"
          :aria-label="`${p.id === 'self' ? 'You, ' : ''}${p.name}, ${p.status}, ${p.microphone ? (p.speaking ? 'speaking' : 'microphone on') : 'microphone muted'}. Participant controls`"
          :aria-expanded="selected === p.id"
          :title="`${p.name} · ${p.status}`"
          @click="openParticipant(p.id)"
        >
          <component :is="cameraRenderer" v-if="p.camera && !p.expanded" :participant-id="p.id" />
          <span v-else class="participant-avatar" :data-avatar="p.id">{{ p.initials }}</span>
          <span class="participant-status" :data-status="p.status" aria-hidden="true"></span>
          <span v-if="!p.microphone" class="participant-mute" aria-hidden="true"
            ><MicOff :size="12"
          /></span>
        </button>
        <small>{{ p.id === 'self' ? 'You' : p.name.split(' ·')[0] }}</small>
      </div>
    </aside>
    <Teleport v-if="participantDocument" :to="participantDocument">
      <OverlayPopover
        :open="!!selected && chrome('participants')"
        :anchor="participantAnchor"
        label="Participant controls"
        focus
        @update:open="closeMenus"
        ><div ref="participantMenu" class="participant-actions">
          <button class="popover-close" aria-label="Close participant controls" @click="closeMenus">
            <X :size="16" />
          </button>
          <UiExtensionHost
            :registry="ui"
            point="participantContextMenu"
            :context="{ participantId: selected }"
          /></div></OverlayPopover
    ></Teleport>
    <WorkspaceHost
      ref="workspaceHost"
      :rearrange="rearrange"
      :workspace="workspace"
      :popouts="popouts"
      :revision="revision"
      :obstacles="workspaceObstacles"
      :style="{
        top: `${safeEdges.top}px`,
        left: `${safeEdges.left}px`,
        right: `${safeEdges.right}px`,
        bottom: `${safeEdges.bottom}px`,
      }"
      @notice="roomState.notice = $event"
      @change="refresh"
      @ready="ready"
      @bounds="currentBounds = $event"
    />
    <div
      :ref="(el) => chromeRef('workspace', el)"
      v-show="chrome('header')"
      class="workspace-controls"
      :style="objectStyle('workspace')"
      :inert="fullscreen"
    >
      <button
        v-if="rearrange"
        class="room-object-grip"
        aria-label="Move workspace controls"
        @pointerdown="objectPointer($event, 'workspace')"
        @keydown="objectKeys($event, 'workspace')"
      >
        <Grip :size="16" />
      </button>
      <button
        class="glass"
        :aria-expanded="layoutOpen"
        aria-label="Workspace cards"
        title="Workspace cards"
        @click="layoutOpen = !layoutOpen"
      >
        <PanelsRightBottom :size="18" /><span>Workspace</span>
      </button>
      <div
        v-if="layoutOpen"
        class="workspace-menu glass"
        role="region"
        aria-label="Workspace cards"
      >
        <label v-for="card in cardDefinitions" :key="card.type"
          ><input
            type="checkbox"
            :checked="panelStates[card.type]"
            @change="showCard(card.type, ($event.target as HTMLInputElement).checked)"
          />{{ card.label }}</label
        >
        <button @click="recoverLayout">Recover card layout</button>
        <p>Drag toward the right edge to snap. Arrow keys on Move reposition cards.</p>
      </div>
    </div>
    <div
      :ref="(el) => chromeRef('atmosphere', el)"
      v-show="presentation.atmosphere"
      class="scene-caption"
      :style="objectStyle('atmosphere')"
    >
      <button
        v-if="rearrange"
        class="room-object-grip"
        aria-label="Move atmosphere text"
        @pointerdown="objectPointer($event, 'atmosphere')"
        @keydown="objectKeys($event, 'atmosphere')"
      >
        <Grip :size="16" />
      </button>
      <span>THE QUIET HOURS</span>
      <p>Make yourself a little space.</p>
    </div>
    <Teleport v-if="moreAnchor" :to="moreAnchor.ownerDocument.body">
      <OverlayPopover
        :open="roomState.more"
        :anchor="moreAnchor"
        label="Quick room actions"
        focus
        @update:open="roomState.more = $event"
      >
        <MenuRow class="quick-room-action" @click="startRearrange"
          ><Grip :size="16" aria-hidden="true" />Rearrange view</MenuRow
        >
        <MenuRow
          class="quick-room-action"
          @click="
            popoutAll();
            roomState.more = false;
          "
        >
          <PictureInPicture2 :size="16" aria-hidden="true" />Pop out all
        </MenuRow>
        <MenuRow
          v-if="popouts.count.value"
          class="quick-room-action"
          @click="
            popouts.restoreAll();
            roomState.more = false;
          "
        >
          <PanelsRightBottom :size="16" aria-hidden="true" />Restore all
        </MenuRow>
        <MenuRow
          class="quick-room-action"
          @click="
            roomState.more = false;
            advanced = true;
          "
        >
          <Settings :size="16" aria-hidden="true" />Advanced settings
        </MenuRow>
      </OverlayPopover></Teleport
    >
    <div
      v-if="rearrange"
      :ref="(el) => chromeRef('rearrange', el)"
      :style="objectStyle('rearrange')"
      class="rearrange-actions glass"
      role="region"
      aria-label="Rearrange view"
    >
      <strong>Rearrange view</strong><button @click="resetArrangement">Reset layout</button
      ><button
        @click="
          rearrange = false;
          persist();
        "
      >
        Done
      </button>
    </div>
    <RoomSettings :open="advanced" :ui="ui" @update:open="advanced = $event">
      <template #appearance>
        <h3>Room presentation</h3>
        <StudySelect
          label="Presentation preset"
          :model-value="presentation.preset"
          :options="
            ['Standard', 'Minimal', 'Ambient', 'Projector', 'Custom'].map((label) => ({
              label,
              value: label.toLowerCase(),
            }))
          "
          @update:model-value="preset"
        />
        <p>
          Reveal controls temporarily shows room buttons. Escape restores standard controls.
          Re-entry always restores controls.
        </p>
        <label v-for="part in ['header', 'participants', 'atmosphere', 'dock'] as const" :key="part"
          ><input
            v-model="presentation[part]"
            type="checkbox"
            @change="presentation.preset = 'custom'"
          />{{
            {
              header: 'Room header',
              participants: 'Participants',
              atmosphere: 'Atmosphere quote',
              dock: 'Room dock',
            }[part]
          }}</label
        >
        <label v-for="card in cardDefinitions" :key="card.type"
          ><input
            type="checkbox"
            :checked="panelStates[card.type]"
            @change="
              showCard(card.type, ($event.target as HTMLInputElement).checked);
              presentation.preset = 'custom';
            "
          />{{ card.label }}</label
        >
        <button @click="recoverLayout">Recover card layout</button>
        <label><input v-model="dimmed" type="checkbox" /> Dim this room on my device</label>
      </template>
    </RoomSettings>
    <div v-if="roomState.notice" class="room-notice glass" :inert="fullscreen" role="status">
      {{ roomState.notice
      }}<button aria-label="Dismiss notice" @click="roomState.notice = ''"><X :size="16" /></button>
    </div>
    <nav
      v-show="chrome('dock')"
      :inert="fullscreen"
      :ref="(el) => chromeRef('dock', el)"
      class="room-dock glass"
      data-popout-id="room-controls"
      :style="objectStyle('dock')"
      aria-label="Room controls"
    >
      <button
        v-if="rearrange"
        class="room-object-grip"
        aria-label="Move room dock"
        @pointerdown="objectPointer($event, 'dock')"
        @keydown="objectKeys($event, 'dock')"
      >
        <Grip :size="16" />
      </button>
      <UiExtensionHost :registry="ui" point="bottomDock" :context="{ revision }" />
    </nav>
    <button
      v-if="!presentation.header || !presentation.dock || !presentation.participants"
      class="room-reveal glass"
      :inert="fullscreen"
      @click="revealed = !revealed"
    >
      {{ revealed ? 'Hide revealed controls' : 'Reveal controls' }} <small>Esc to exit</small>
    </button>
  </div>
</template>
<style src="../../room/room.css"></style>
<style src="./room-refresh.css"></style>

<style>
.room-shell .workspace-surface {
  bottom: max(8px, env(safe-area-inset-bottom));
}
.room-shell .room-top {
  width: max-content;
  max-width: calc(100vw - 24px);
  right: auto;
}
.room-name {
  font: 400 clamp(16px, 1.25vw, 21px)/1.2 var(--font-display);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: min(40vw, 560px);
}
.room-shell .room-title {
  border-radius: 26px;
  display: flex;
  gap: 12px;
  padding: 9px 16px;
}
.room-shell .room-top .room-title {
  width: auto;
  border-radius: 26px;
}
.room-shell .room-dock {
  display: flex;
  align-items: center;
  gap: 6px;
  width: max-content;
  max-width: calc(100vw - 24px);
}
.room-shell .participant-rail {
  bottom: auto;
  right: auto;
  scrollbar-width: thin;
}
.room-shell[data-rail-edge='top'] .participant-rail,
.room-shell[data-rail-edge='bottom'] .participant-rail {
  flex-direction: row;
  overflow-x: auto;
  overflow-y: hidden;
  justify-content: flex-start;
  padding: 8px 10px;
}
.room-shell[data-rail-edge='top'] .participant-entry,
.room-shell[data-rail-edge='bottom'] .participant-entry {
  width: 64px;
}
.room-shell .scene-caption {
  width: min(280px, calc(100vw - 104px));
  padding: 16px;
  background: transparent;
}
.room-shell .scene-caption::before {
  content: '';
  position: absolute;
  inset: -40px -80px;
  background: radial-gradient(ellipse, #071c27b0, transparent 72%);
  pointer-events: none;
  z-index: -1;
}
/* The same rail collapses spatially; its participant and media nodes remain mounted. */
.room-shell {
  padding: max(12px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right))
    max(8px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left));
}
.room-shell .participant-rail,
.room-shell .room-dock,
.room-shell .room-top,
.room-shell .workspace-controls,
.room-shell .scene-caption {
  transition:
    left var(--motion-standard) var(--ease-soft-spring),
    top var(--motion-standard) var(--ease-soft-spring),
    width var(--motion-standard) var(--ease-soft-spring),
    height var(--motion-standard) var(--ease-soft-spring),
    box-shadow var(--motion-quick);
}
.room-shell[data-dragged-object='header'] .room-top,
.room-shell[data-dragged-object='dock'] .room-dock,
.room-shell[data-dragged-object='workspace'] .workspace-controls,
.room-shell[data-dragged-object='atmosphere'] .scene-caption {
  transition: none;
}
.room-shell[data-dragged-object='header'] .room-top,
.room-shell[data-dragged-object='dock'] .room-dock,
.room-shell[data-dragged-object='workspace'] .workspace-controls,
.room-shell[data-dragged-object='atmosphere'] .scene-caption {
  outline-color: var(--accent);
  filter: drop-shadow(0 8px 14px rgb(0 0 0 / 14%));
}
.room-shell[data-rail-dragging='true'] .participant-rail {
  transition:
    width var(--motion-quick) var(--ease-enter),
    height var(--motion-quick) var(--ease-enter),
    box-shadow var(--motion-quick);
  flex-direction: row;
  align-items: center;
  gap: 8px;
  padding: 5px 10px;
  overflow: hidden;
  z-index: 105;
  cursor: grabbing;
  box-shadow: var(--shadow-elevated);
}
.participant-entry {
  transition: opacity var(--motion-quick);
}
.room-shell[data-rail-dragging='true'] .participant-entry {
  position: absolute;
  visibility: hidden;
  opacity: 0;
  pointer-events: none;
}
.rail-drag-label {
  white-space: nowrap;
  font-size: 13px;
  font-weight: 500;
}
.room-shell[data-rail-dragging='true'] .room-object-grip {
  flex-shrink: 0;
  cursor: grabbing;
}
.room-snap-preview {
  position: absolute;
  z-index: 100;
  pointer-events: none;
  border: 1px solid color-mix(in srgb, var(--accent) 65%, transparent);
  border-radius: 16px;
  background: color-mix(in srgb, var(--accent) 8%, transparent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 8%, transparent);
}
.room-object-grip {
  touch-action: none;
  cursor: grab;
  border: 0 !important;
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  position: relative;
  z-index: 2;
}
.room-object-grip:hover,
.room-object-grip:focus-visible {
  background: var(--accent-subtle);
}
.room-shell[data-rearrange='true'] .room-top,
.room-shell[data-rearrange='true'] .participant-rail,
.room-shell[data-rearrange='true'] .room-dock,
.room-shell[data-rearrange='true'] .scene-caption,
.room-shell[data-rearrange='true'] .workspace-controls {
  outline: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
  outline-offset: 3px;
}
.rearrange-actions {
  position: absolute;
  z-index: 110;
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 8px;
  max-width: calc(100% - 24px);
  flex-wrap: wrap;
}
.rearrange-actions strong,
.rearrange-actions button {
  font-size: 12px;
}
.rearrange-actions button {
  padding-inline: 10px;
}
.quick-room-action {
  display: block;
  min-height: 44px !important;
  width: 100%;
  text-align: left;
}
.room-preview-background {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.room-shell[data-entry-state='preview'] .workspace-controls,
.room-shell[data-entry-state='preview'] .room-dock,
.room-shell[data-entry-state='preview'] .participant-rail {
  visibility: hidden;
}
.room-shell .workspace-controls {
  display: flex;
  align-items: center;
  gap: 6px;
}
.room-shell .scene-caption {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  column-gap: 8px;
}
.room-shell[data-rearrange='true'] .scene-caption {
  pointer-events: auto;
  z-index: 80;
}
.scene-caption .room-object-grip {
  grid-column: 1;
  grid-row: 1;
}
.scene-caption > span {
  grid-column: 2;
  grid-row: 1;
}
.scene-caption > p {
  grid-column: 2;
  grid-row: 2;
}
.room-shell .room-object-grip {
  flex-shrink: 0;
  opacity: 0;
  transform: translateX(-3px);
  transition:
    opacity var(--motion-micro),
    transform var(--motion-micro);
}
.room-shell
  :is(.room-top, .participant-rail, .room-dock, .scene-caption, .workspace-controls):is(
    :hover,
    :focus-within
  )
  > .room-object-grip,
.room-shell[data-rail-dragging='true'] .participant-rail > .room-object-grip,
.room-shell[data-dragged-object]:not([data-dragged-object='']) .room-object-grip:active {
  opacity: 1;
  transform: none;
}
.room-object-grip:active {
  cursor: grabbing;
}

/* Text contrast is independent of the owner's accepted glass fill mapping. */
.room-shell .room-title {
  position: relative;
  isolation: isolate;
  color: #fff;
  text-shadow: 0 1px 3px #000a;
}
.room-shell .room-title .room-name {
  color: #fff;
  font: 400 clamp(20px, 1.6vw, 26px)/1.2 var(--font-display);
}
.room-shell .room-title > span:not(.room-name) {
  color: #d6dce6;
  font-size: 10px;
}
.room-shell .room-title::before {
  content: '';
  position: absolute;
  inset: -12px;
  border-radius: inherit;
  z-index: -1;
  pointer-events: none;
  background: radial-gradient(ellipse, #10172270, transparent 74%);
}
.room-shell:has([data-material='light']) .room-title::before,
.room-shell:has([data-material='complex']) .room-title::before {
  background: radial-gradient(ellipse, #101722b0, transparent 78%);
}
.participant-actions {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  min-width: min(240px, calc(100vw - 64px));
  padding-top: var(--space-8);
}
.participant-actions .popover-close {
  position: absolute;
  right: 0;
  top: 0;
  width: 32px;
  height: 32px;
  min-height: 32px;
  min-width: 32px;
  padding: 6px;
  border: 0;
  background: transparent;
  color: var(--text-primary);
}
.participant-actions [data-extension-point] {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.participant-actions .camera-expand {
  min-height: 40px;
  padding: var(--space-2);
  background: transparent;
  color: var(--text-primary);
  border: 0;
}
</style>
