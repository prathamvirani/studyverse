import { defineComponent, h, onMounted, onUnmounted, ref, watchEffect } from 'vue';
import type { Component, PropType } from 'vue';
import {
  mediaCredentialSchema,
  mediaAudienceSchema,
  okSchema,
  layoutSchema,
} from '@study/contracts';
import type { MediaSource } from '@study/contracts';
import type { MediaTrack, RealtimeMediaProvider } from '@study/feature-sdk';
import type { TileInstance } from '@study/core/browser';
import { createMediaSession } from '@study/rtc/browser';
import type { createApiClient } from '../lib/api-client.ts';
import type { RoomComposition } from './composition.ts';

/** Each track has one DOM element. Moving that element also avoids transient Vue mount overlap. */
export function mediaRenderer(
  provider: RealtimeMediaProvider,
  track: () => MediaTrack | undefined,
  surface: 'circle' | 'workspace',
  elements: Map<string, HTMLMediaElement>,
) {
  return defineComponent({
    setup() {
      const host = ref<HTMLElement>();
      let current: string | undefined;
      let dispose: (() => void) | undefined;
      function render() {
        const t = track();
        if (current && current !== t?.id) {
          const old = elements.get(current);
          if (old && old.parentElement === host.value) {
            old.remove();
            old.srcObject = null;
          }
          provider.receive(current, 'hidden');
        }
        current = t?.id;
        if (!t || !host.value) return;
        let el = elements.get(t.id);
        if (!el) {
          el = document.createElement(t.source === 'microphone' ? 'audio' : 'video');
          elements.set(t.id, el);
          el.autoplay = true;
          if (el instanceof HTMLVideoElement) el.playsInline = true;
          el.style.cssText = `width:100%;height:100%;object-fit:${t.source === 'screen' ? 'contain' : 'cover'};background:#172b2f`;
        }
        el.muted = t.local;
        el.setAttribute(
          'aria-label',
          t.source === 'camera'
            ? 'Live camera'
            : t.source === 'screen'
              ? 'Screen share'
              : 'Participant audio',
        );
        if (t.source === 'camera') el.dataset.cameraRenderer = t.userId;
        el.dataset.mediaTrack = t.id;
        if (el.srcObject !== t.stream) el.srcObject = t.stream;
        if (el.parentElement !== host.value) host.value.append(el);
        provider.receive(t.id, surface);
        void el.play().catch(() => {
          el!.controls = true;
        });
      }
      onMounted(() => {
        render();
        dispose = provider.listen(render);
      });
      onUnmounted(() => {
        dispose?.();
        if (current) {
          const el = elements.get(current);
          if (el && el.parentElement === host.value) {
            el.remove();
            el.srcObject = null;
            provider.receive(current, 'hidden');
          }
        }
      });
      watchEffect(() => {
        track();
        render();
      });
      return () => h('div', { ref: host, class: 'rtc-renderer', style: 'width:100%;height:100%' });
    },
  });
}
export function registerRtc(
  shell: RoomComposition,
  rawProvider: RealtimeMediaProvider,
  api: ReturnType<typeof createApiClient>,
  roomId: string,
  userId: string,
) {
  let audience: { connectionId: string; userId: string; name: string }[] = [];
  let disposed = false,
    polling = false;
  const provider: RealtimeMediaProvider = {
    ...rawProvider,
    snapshot: () => {
      const snapshot = rawProvider.snapshot();
      return {
        ...snapshot,
        tracks: snapshot.tracks.flatMap((t) => {
          const identity = audience.find((p) => p.connectionId === t.participantId);
          if (!t.local && !identity) return [];
          return [{ ...t, userId: t.local ? userId : identity!.userId }];
        }),
      };
    },
  };
  async function refreshAudience() {
    if (disposed || polling) return;
    polling = true;
    try {
      audience = await api.request('/api/v1/rtc/audience', mediaAudienceSchema, { roomId });
    } catch {
      audience = [];
    } finally {
      polling = false;
      if (!disposed) {
        session.state.snapshot = provider.snapshot();
        revision.value++;
        project();
      }
    }
  }
  const revision = ref(0),
    expanded = new Set<string>(),
    elements = new Map<string, HTMLMediaElement>();
  const session = createMediaSession(
    provider,
    {
      join: () => api.request('/api/v1/rtc/join', mediaCredentialSchema, { roomId }),
      renew: (c) =>
        api
          .request('/api/v1/rtc/renew', okSchema, { roomId, connectionId: c.connectionId })
          .then(() => {}),
      leave: (c) =>
        api
          .request('/api/v1/rtc/leave', okSchema, { roomId, connectionId: c.connectionId })
          .then(() => {}),
    },
    () => {
      revision.value++;
      project();
    },
  );
  const trackFor = (id: string) => {
    void revision.value;
    return session.state.snapshot.tracks.find(
      (t) => t.source === 'camera' && t.userId === (id === 'self' ? userId : id) && !t.muted,
    );
  };
  function project() {
    for (let index = shell.participants.length - 1; index >= 0; index--) {
      const p = shell.participants[index]!;
      if (
        p.status === 'Media active' &&
        !audience.some((a) => a.userId === (p.id === 'self' ? userId : p.id))
      )
        shell.participants.splice(index, 1);
    }
    for (const person of audience) {
      const id = person.userId === userId ? 'self' : person.userId;
      if (!shell.participants.some((p) => p.id === id))
        shell.participants.push({
          id,
          name: person.name,
          initials: person.name.slice(0, 2).toUpperCase(),
          status: 'Media active',
          camera: false,
          expanded: false,
        });
    }
    for (const t of rawProvider.snapshot().tracks)
      if (!t.local && !audience.some((p) => p.connectionId === t.participantId))
        rawProvider.receive(t.id, 'hidden');
    for (const p of shell.participants) {
      const t = trackFor(p.id);
      p.camera = !!t;
      p.expanded = !!t && expanded.has(t.id);
    }
    for (const item of shell.workspace.values())
      if (
        item.type.startsWith('rtc.') &&
        !session.state.snapshot.tracks.some((t) => t.id === item.resourceKey && !t.muted)
      )
        shell.workspace.close(item.id);
    for (const t of session.state.snapshot.tracks) {
      if (
        t.source === 'screen' &&
        !shell.workspace.values().some((i) => i.resourceKey === t.id) &&
        !dismissed.has(t.id)
      )
        shell.workspace.open('rtc.screen', t.id);
      if (
        !t.local &&
        t.source === 'camera' &&
        !expanded.has(t.id) &&
        !shell.participants.some((p) => trackFor(p.id)?.id === t.id)
      )
        provider.receive(t.id, 'hidden');
    }
    for (const [id, el] of elements)
      if (!session.state.snapshot.tracks.some((t) => t.id === id)) {
        el.srcObject = null;
        el.remove();
        elements.delete(id);
      }
    for (const id of dismissed)
      if (!session.state.snapshot.tracks.some((t) => t.id === id)) dismissed.delete(id);
    for (const id of expanded)
      if (!session.state.snapshot.tracks.some((t) => t.id === id)) expanded.delete(id);
    if (session.state.error) shell.state.notice = session.state.error;
    shell.state.refresh();
  }
  const dismissed = new Set<string>();
  const cameraRenderer = defineComponent({
    props: { participantId: { type: String, required: true } },
    setup: (props) => {
      const renderer = mediaRenderer(
        provider,
        () => trackFor(props.participantId),
        'circle',
        elements,
      );
      return () => h(renderer);
    },
  });
  for (const source of ['camera', 'screen'] as const)
    shell.tiles.register(`rtc.${source}`, {
      type: `rtc.${source}`,
      label: source === 'camera' ? 'Camera' : 'Screen share',
      defaultSize: { width: 480, height: 300 },
      minimumSize: { width: 220, height: 180 },
      resizable: true,
      fullscreenable: true,
      persist: false,
      layoutSchema,
      onOpen: (id) => {
        expanded.add(JSON.parse(id)[1]);
        projectParticipants();
      },
      onClose: (id) => {
        expanded.delete(JSON.parse(id)[1]);
        dismissed.add(JSON.parse(id)[1]);
        projectParticipants();
      },
      onLayoutChange: (id, l) => {
        if (l.minimized) expanded.delete(JSON.parse(id)[1]);
        else expanded.add(JSON.parse(id)[1]);
        projectParticipants();
      },
      load: async () =>
        defineComponent({
          props: { instance: { type: Object as PropType<TileInstance>, required: true } },
          setup: (props) => {
            const renderer = mediaRenderer(
              provider,
              () => {
                void revision.value;
                return session.state.snapshot.tracks.find(
                  (t) => t.id === props.instance.resourceKey,
                );
              },
              'workspace',
              elements,
            );
            return () => h(renderer);
          },
        }),
    });
  function projectParticipants() {
    for (const p of shell.participants) {
      const t = trackFor(p.id);
      p.expanded = !!t && expanded.has(t.id);
    }
    revision.value++;
  }
  const register = (
    id: string,
    point: 'bottomDock' | 'participantContextMenu' | 'participantBadge' | 'roomMoreMenu' | 'topBar',
    order: number,
    label: string,
    component: Component,
  ) => shell.ui.register(id, { id, point, order, label, load: async () => component });
  for (const [index, source] of (['microphone', 'camera', 'screen'] as MediaSource[]).entries()) {
    const label = { microphone: 'Microphone', camera: 'Camera', screen: 'Screen Share' }[source];
    register(
      `rtc.${source}`,
      'bottomDock',
      index + 2,
      label,
      defineComponent({
        setup: () => () => {
          void revision.value;
          const active = session.state.snapshot.tracks.some((t) => t.local && t.source === source);
          return h(
            'button',
            {
              'aria-label': `${label} ${active ? 'on' : 'off'}`,
              'aria-pressed': active,
              disabled: session.state.busy.has(source),
              onClick: () => void session.toggle(source),
            },
            [
              h(
                'span',
                { class: 'dock-icon', 'aria-hidden': 'true' },
                { microphone: '♩', camera: '▣', screen: '▱' }[source],
              ),
              h('small', label),
            ],
          );
        },
      }),
    );
  }
  register(
    'rtc.participant',
    'participantContextMenu',
    9,
    'Media controls',
    defineComponent({
      props: { participantId: { type: String, required: true } },
      setup: (props) => () => {
        void revision.value;
        const tracks = session.state.snapshot.tracks.filter(
          (t) =>
            t.source === 'camera' &&
            t.userId === (props.participantId === 'self' ? userId : props.participantId) &&
            !t.muted,
        );
        if (!tracks.length) return h('button', { disabled: true }, 'Expand camera');
        return h(
          'div',
          tracks.map((t, index) =>
            h(
              'button',
              {
                disabled: expanded.has(t.id),
                onClick: () => {
                  const tile = shell.workspace.open('rtc.camera', t.id);
                  shell.workspace.update(tile.id, { ...tile.layout, minimized: false });
                  shell.state.refresh();
                },
              },
              tracks.length === 1 ? 'Expand camera' : `Expand camera · device ${index + 1}`,
            ),
          ),
        );
      },
    }),
  );
  register(
    'rtc.audio',
    'topBar',
    99,
    'Participant audio',
    defineComponent({
      setup() {
        const renderers = new Map<string, Component>();
        return () => {
          void revision.value;
          for (const id of renderers.keys())
            if (
              !session.state.snapshot.tracks.some(
                (t) => !t.local && t.source === 'microphone' && t.id === id,
              )
            )
              renderers.delete(id);
          return h(
            'div',
            session.state.snapshot.tracks
              .filter((t) => !t.local && t.source === 'microphone')
              .map((t) => {
                if (!renderers.has(t.id))
                  renderers.set(
                    t.id,
                    mediaRenderer(
                      provider,
                      () => session.state.snapshot.tracks.find((v) => v.id === t.id),
                      'workspace',
                      elements,
                    ),
                  );
                return h(renderers.get(t.id)!, { key: t.id });
              }),
          );
        };
      },
    }),
  );
  register(
    'rtc.badge',
    'participantBadge',
    10,
    'Microphone state',
    defineComponent({
      props: { participantId: { type: String, required: true } },
      setup: (props) => () => {
        void revision.value;
        const tracks = session.state.snapshot.tracks.filter(
          (t) =>
            t.userId === (props.participantId === 'self' ? userId : props.participantId) &&
            t.source === 'microphone',
        );
        return h('small', tracks.some((t) => !t.muted) ? 'Mic on' : 'Mic off');
      },
    }),
  );
  register(
    'rtc.settings',
    'roomMoreMenu',
    8,
    'Devices and basic media',
    defineComponent({
      setup: () => () => {
        void revision.value;
        return h('div', [
          h('p', `Media: ${session.state.snapshot.connection}`),
          h('button', { onClick: () => void session.connect() }, 'Connect media'),
          ...(['microphone', 'camera'] as const).map((source) =>
            h('label', [
              `${source} device`,
              h(
                'select',
                {
                  'aria-label': `${source} device`,
                  onChange: (e: Event) =>
                    void session.switchDevice(source, (e.target as HTMLSelectElement).value),
                },
                session.state.devices
                  .filter((d) => d.kind === (source === 'camera' ? 'videoinput' : 'audioinput'))
                  .map((d) => h('option', { value: d.deviceId }, d.label || 'Device')),
              ),
            ]),
          ),
          h('button', { onClick: () => void session.refreshDevices() }, 'Refresh devices'),
          h('label', [
            'Voice preset',
            h(
              'select',
              {
                'aria-label': 'Voice preset',
                value: session.state.voice,
                disabled:
                  session.state.busy.has('microphone') ||
                  session.state.snapshot.tracks.some((t) => t.local && t.source === 'microphone'),
                onChange: (e: Event) =>
                  session.voice(
                    (e.target as HTMLSelectElement).value === 'high' ? 'high' : 'standard',
                  ),
              },
              [
                h('option', { value: 'standard' }, 'Standard'),
                h('option', { value: 'high' }, 'High'),
              ],
            ),
          ]),
          h(
            'small',
            'Choose before activating the microphone. High uses less processing; echo cancellation remains on.',
          ),
          h('button', { onClick: () => void session.mute(true) }, 'Mute microphone'),
          h('button', { onClick: () => void session.mute(false) }, 'Unmute microphone'),
          h('small', 'Camera ≤720p30 · Screen ≤1080p30. Actual delivery may be lower.'),
          h(
            'small',
            'Sharing media makes you visible to authorized people in this room. Friends-list privacy stays unchanged.',
          ),
          ...session.state.snapshot.tracks
            .filter((t) => t.local)
            .map((t) =>
              h(
                'p',
                `${t.source}: requested ${t.requested.width ?? 'audio'} · actual ${t.actual.width ?? 'unknown'}`,
              ),
            ),
        ]);
      },
    }),
  );
  const deviceChanged = () => void session.refreshDevices();
  navigator.mediaDevices?.addEventListener('devicechange', deviceChanged);
  // Receive-only connection is asynchronous; it never acquires local devices or blocks entry.
  // Disabled/unconfigured media stays quiet until a deliberate control action.
  void session.connect(true);
  const audienceTimer = setInterval(() => void refreshAudience(), 2000);
  void refreshAudience();
  return {
    cameraRenderer,
    project,
    async dispose() {
      disposed = true;
      clearInterval(audienceTimer);
      audience = [];
      navigator.mediaDevices?.removeEventListener('devicechange', deviceChanged);
      await session.dispose();
      for (const el of elements.values()) {
        el.srcObject = null;
        el.remove();
      }
      elements.clear();
    },
  };
}
