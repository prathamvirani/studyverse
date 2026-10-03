<script setup lang="ts">
import {
  mediaQualityStageSchema,
  roomSchema,
  roomBrowseSchema,
  inviteCreatedSchema,
  invitesSchema,
  okSchema,
} from '@study/contracts';
import type { Room, z } from '@study/contracts';
import { PageHeader, StatusBadge, ContextPane, SettingsSheet, Trash2 } from '@study/ui';
import { curatedProvider } from '@study/backgrounds/browser';
import { roomOrigin, memberLabel, titleCase, roomAddress } from '../lib/room-navigation';
import { registerRoomMedia } from '../room/room-media';
import { registerPersonalMedia } from '../room/personal-media';
let personalMedia: ReturnType<typeof registerPersonalMedia>;
let roomMedia: ReturnType<typeof registerRoomMedia> | undefined;
import { registerBackgrounds } from '../room/backgrounds';
import { createRealtimeClient } from '../lib/realtime';
import { registerProductivity } from '../room/productivity';
let stopProductivity: (() => void) | undefined;
import RoomShell from './room/RoomShell.vue';
import { createRoomComposition } from '../room/composition';
import { registerRtc } from '../room/rtc';
import { createLiveKitProvider } from '@study/adapters/livekit/browser';
let backgrounds: ReturnType<typeof registerBackgrounds> | undefined;
const sceneReady = ref(false);
let signalVisualReady: () => void;
const visualPrepared = new Promise<void>((resolve) => {
  signalVisualReady = resolve;
});
let realtime: ReturnType<typeof createRealtimeClient> | undefined;
let media: ReturnType<typeof registerRtc> | undefined;
import { socialKey, statusLabels } from '../lib/social';
import { defineComponent, h } from 'vue';
import RoomIdentityCard from './room/RoomIdentityCard.vue';
import { registerRoomSocial } from '../room/social';
const props = defineProps<{ configure?: boolean }>();
const config = useRuntimeConfig();
const confirmedEntry = useRoomEntry();
const social = inject(socialKey)!;
const immersive = useState('immersive-room', () => false);
let composition: ReturnType<typeof createRoomComposition> | undefined;
let disposed = false,
  entryGeneration = 0;
function leave() {
  void navigateTo(
    { path: `/rooms/${roomAddress(room.value!)}/configure`, query: { from: origin.value } },
    { replace: true },
  );
  entryGeneration++;
  void personalMedia?.dispose();
  void media?.dispose();
  roomMedia?.dispose();
  stopProductivity?.();
  social.room(null);
  entered.value = false;
  immersive.value = false;
  void loadInvites().catch(() => {
    error.value = 'Invite links could not load. Please refresh to try again.';
  });
  nextTick(() => document.getElementById('room-enter')?.focus());
}
function invitations() {
  if (room.value?.ownerId !== profile.value?.id) {
    if (composition) composition.state.notice = 'Invite links are managed by the room owner.';
    return;
  }
  leave();
  nextTick(() => document.getElementById('invite-heading')?.focus());
}
onUnmounted(() => {
  disposed = true;
  signalVisualReady?.();
  backgrounds?.dispose();
  void personalMedia?.dispose();
  entryGeneration++;
  void media?.dispose();
  roomMedia?.dispose();
  stopProductivity?.();
  social.room(null);
  immersive.value = false;
});
const route = useRoute(),
  { profile, load, api } = useAccount();
const owningPath = route.path;
const router = useRouter();
onBeforeRouteLeave(() => {
  entryGeneration++;
  if (!entered.value && confirmedEntry.state.value.room) confirmedEntry.close(false);
});
const origin = computed(() => roomOrigin(route.query.from));
const nearby = ref<Room[]>([]);
const thumbnail = computed(
  () => curatedProvider.assets().find((a) => a.id === room.value?.backgroundId)?.thumbnail,
);
const room = ref<Room | null>(null),
  busy = ref(true),
  error = ref(''),
  inviteLink = ref(''),
  editing = ref(false),
  entered = ref(false);
const inviteToken = ref('');
const inviteReturnTo = computed(
  () => `/rooms/${String(route.params.id)}?invite-code=${inviteToken.value}`,
);
const invites = ref<z.infer<typeof invitesSchema>>([]),
  expiresInHours = ref(24),
  maxUses = ref(10);
const deletingInvite = ref(''),
  deleting = ref(false);
async function deleteInvite() {
  if (!deletingInvite.value || deleting.value) return;
  deleting.value = true;
  try {
    await api.request('/api/v1/rooms/invite-delete', okSchema, {
      roomId: room.value!.id,
      inviteId: deletingInvite.value,
    });
    deletingInvite.value = '';
    await loadInvites();
  } catch {
    error.value = 'This revoked invite could not be removed.';
  } finally {
    deleting.value = false;
  }
}
async function loadInvites() {
  if (room.value?.ownerId === profile.value?.id)
    invites.value = await api.request(
      `/api/v1/rooms/invites?roomId=${room.value!.id}`,
      invitesSchema,
    );
}
async function prepareScene() {
  composition ??= createRoomComposition(profile.value!.displayName, invitations);
  composition.participants.splice(0);
  realtime ??= createRealtimeClient();
  backgrounds ??= registerBackgrounds(composition.ui, room.value!.id, profile.value!.id, realtime);
  await backgrounds.prepare(room.value!.backgroundId ?? undefined);
  if (disposed) return;
  sceneReady.value = true;
  immersive.value = true;
  await Promise.all([visualPrepared, backgrounds.rendered]);
}
onCriticalPageMounted(async () => {
  try {
    const token = String(route.query['invite-code'] ?? '');
    if (/^[A-Za-z0-9_-]{43}$/.test(token)) {
      inviteToken.value = token;
      history.replaceState(history.state, '', route.path);
      void api
        .authentication('/api/v1/rooms/referral-land', okSchema, {
          token,
          landingId: crypto.randomUUID(),
        })
        .catch(() => {});
    }
    if (await load()) {
      if (inviteToken.value) return;
      room.value = await api.request(
        `/api/v1/rooms/resolve?address=${encodeURIComponent(String(route.params.id))}`,
        roomSchema,
      );
      if (disposed) return;
      if (!props.configure) {
        if (String(route.params.id) !== roomAddress(room.value)) {
          await navigateTo(
            { path: `/rooms/${roomAddress(room.value)}`, query: { from: origin.value } },
            { replace: true },
          );
          return;
        }
        await prepareScene();
        if (disposed) return;
        if (route.query.preview === '1' && confirmedEntry.state.value.room?.id !== room.value.id)
          confirmedEntry.preview(room.value, origin.value);
        confirmedEntry.prepared(room.value.id);
        if (confirmedEntry.state.value.room?.id !== room.value.id) await enter();
      } else {
        await loadInvites();
        try {
          nearby.value = (
            await api.request('/api/v1/rooms/browse?scope=mine', roomBrowseSchema)
          ).rooms
            .filter((r) => r.id !== room.value?.id)
            .slice(0, 2);
        } catch {
          /* Optional context. */
        }
      }
    }
  } catch {
    error.value = 'This room is unavailable or you do not have access.';
    if (!props.configure && confirmedEntry.state.value.room) {
      confirmedEntry.close();
      confirmedEntry.state.value.error = error.value;
    }
  } finally {
    busy.value = false;
  }
});
watch(
  () => confirmedEntry.state.value.confirmed,
  (admitted) => {
    if (admitted?.room.id === room.value?.id && !entered.value && !props.configure) void enter();
  },
);
watch(
  () => route.query.enter,
  (value) => {
    if (value === '1' && room.value && !entered.value && !busy.value) void enter();
  },
);
async function enter() {
  if (entered.value || disposed || !room.value) return;
  if (props.configure) {
    await navigateTo(
      { path: `/rooms/${roomAddress(room.value)}`, query: { from: origin.value } },
      { replace: true },
    );
    return;
  }
  error.value = '';
  const generation = ++entryGeneration;
  busy.value = true;
  try {
    // Canonical invite redemption can reuse this page instead of mounting a new one.
    if (!sceneReady.value) await prepareScene();
    if (disposed || generation !== entryGeneration) return;
    // A card-confirmed server admission is consumed once; direct links retain their existing join path.
    room.value =
      confirmedEntry.consume(room.value!.id) ??
      (await api.request('/api/v1/rooms/join', roomSchema, { roomId: room.value!.id }));
    if (disposed || generation !== entryGeneration || router.currentRoute.value.path !== owningPath)
      return;
    entered.value = true;
    composition ??= createRoomComposition(profile.value!.displayName, invitations);
    composition.ui.register('rooms.identity', {
      id: 'rooms.identity',
      point: 'roomIdentity',
      order: 0,
      label: 'Room identity',
      load: async () =>
        defineComponent({
          setup: () => () =>
            h(RoomIdentityCard, {
              room: room.value!,
              userId: profile.value!.id,
              saved: (value: Room) => {
                room.value = value;
              },
            }),
        }),
    });
    media = registerRtc(
      composition,
      createLiveKitProvider(
        mediaQualityStageSchema.safeParse(config.public.rtcQualityStage).data ?? 'basic',
      ),
      api,
      room.value.id,
      profile.value!.id,
    );
    registerRoomSocial(
      composition.ui,
      social,
      api,
      room.value.id,
      room.value.ownerId === profile.value!.id,
      (message) => {
        if (composition) composition.state.notice = message;
      },
    );
    stopProductivity?.();
    realtime ??= createRealtimeClient();
    backgrounds?.activate();
    roomMedia = registerRoomMedia(composition, room.value.id, profile.value!.id, realtime);
    personalMedia = registerPersonalMedia(
      composition,
      profile.value!.id,
      roomMedia,
      () => media?.voiceActivity() ?? { available: false, speaking: false },
      config.public.personalMediaEnabled !== false,
    );
    stopProductivity = registerProductivity(
      composition.ui,
      room.value.id,
      realtime,
      composition.tiles,
    );
    social.room(room.value.id);
    immersive.value = true;
  } catch {
    error.value = 'Unable to enter this room. Your access may have changed.';
  } finally {
    busy.value = false;
  }
}
watch(
  () => social.state.participants,
  (people) => {
    if (!composition || !entered.value) return;
    composition.participants.splice(
      0,
      composition.participants.length,
      ...people.map((p) => {
        const id = p.id === profile.value?.id ? 'self' : p.id;
        return {
          id,
          name: p.name,
          initials: p.name.slice(0, 2).toUpperCase(),
          status: p.status ? statusLabels[p.status] : 'Presence private',
          camera: false,
          expanded: false,
        };
      }),
    );
    media?.project();
  },
);
async function createInvite() {
  busy.value = true;
  error.value = '';
  try {
    const result = await api.request('/api/v1/rooms/invite-create', inviteCreatedSchema, {
      roomId: room.value!.id,
      expiresInHours: expiresInHours.value,
      maxUses: maxUses.value,
    });
    inviteLink.value = `${location.origin}/rooms/${roomAddress(room.value!)}?invite-code=${result.token}`;
    await loadInvites();
  } catch {
    error.value = 'Unable to create an invite.';
  } finally {
    busy.value = false;
  }
}
async function revoke(inviteId: string) {
  try {
    await api.request('/api/v1/rooms/invite-revoke', okSchema, {
      roomId: room.value!.id,
      inviteId,
    });
    inviteLink.value = '';
    await loadInvites();
  } catch {
    error.value = 'Unable to revoke this invite.';
  }
}
async function saved(value: Room) {
  room.value = value;
  editing.value = false;
  await navigateTo(
    { path: `/rooms/${roomAddress(value)}/configure`, query: { from: origin.value } },
    { replace: true },
  );
  inviteLink.value = '';
  await loadInvites();
}
async function redeemInvite() {
  busy.value = true;
  error.value = '';
  try {
    room.value = await api.request('/api/v1/rooms/invite-redeem', roomSchema, {
      token: inviteToken.value,
    });
    inviteToken.value = '';
    const path = `/rooms/${roomAddress(room.value)}`;
    // Replacing only the query can suspend this same page while it prepares its scene.
    if (router.currentRoute.value.path !== path)
      await navigateTo({ path, query: { enter: '1', from: origin.value } }, { replace: true });
    if (!disposed) await enter();
  } catch {
    error.value = 'This invite is invalid, expired, revoked or fully used.';
  } finally {
    busy.value = false;
  }
}
function inviteUrl(token: string) {
  return `${location.origin}/rooms/${roomAddress(room.value!)}?invite-code=${token}`;
}
</script>
<template>
  <RoomShell
    v-if="room && composition && sceneReady && !configure"
    :preview="!entered"
    :room="room"
    :user-id="profile!.id"
    :ui="composition.ui"
    :workspace="composition.workspace"
    :participants="composition.participants"
    :camera-renderer="media?.cameraRenderer"
    :room-state="composition.state"
    @visual-ready="signalVisualReady()"
    @leave="leave"
    @invite="invitations"
  />
  <div v-else>
    <p v-if="busy" role="status">Loading…</p>
    <p v-if="error" role="alert" class="error">{{ error }}</p>
    <section v-if="inviteToken" class="card">
      <h1>You’re invited.</h1>
      <p>Accept this invitation to become a room member.</p>
      <SignIn v-if="!profile && !busy" :return-to="inviteReturnTo" :invite-token="inviteToken" />
      <button v-if="profile" :disabled="busy" @click="redeemInvite">Accept invitation</button>
    </section>
    <SignIn v-else-if="!profile && !busy" /><template v-if="room"
      ><div class="management-layout">
        <div class="management-main">
          <section class="room-identity">
            <img v-if="thumbnail" :src="thumbnail" alt="" class="identity-background" />
            <PageHeader :title="room.name" :description="room.description"
              ><template #actions
                ><div class="identity-badges">
                  <StatusBadge>{{ titleCase(room.privacy) }}</StatusBadge
                  ><StatusBadge v-if="room.membership">{{
                    titleCase(room.membership)
                  }}</StatusBadge>
                </div></template
              ></PageHeader
            >
            <p>
              {{ memberLabel(room.memberCount)
              }}<template v-if="room.onlineCount !== undefined">
                · {{ room.onlineCount }} online · visible to you</template
              >
            </p>
            <p class="muted">Available even when the owner is away</p>
            <button id="room-enter" :disabled="busy" @click="enter">
              {{ room.membership ? 'Enter room' : 'Join room' }}
            </button>
          </section>
          <template v-if="room.ownerId === profile?.id"
            ><section>
              <div class="heading-row">
                <h2>Room settings</h2>
                <button class="secondary" @click="editing = !editing">
                  {{ editing ? 'Close settings' : 'Edit room' }}
                </button>
              </div>
              <RoomForm v-if="editing" :room="room" @saved="saved" />
              <RoomAddressEditor :room="room" @saved="saved" />
              <CompactLink :value="`/rooms/${roomAddress(room)}`" label="Room link" actions-only />
            </section>
            <section>
              <h2 id="invite-heading" tabindex="-1">Invite people</h2>
              <p>
                Anyone with a valid invite can become a member. Share it only with people you want
                to join.
              </p>
              <form class="form invite-create-form" @submit.prevent="createInvite">
                <label
                  >Expires in hours<input
                    v-model.number="expiresInHours"
                    type="number"
                    min="1"
                    max="168"
                    required /></label
                ><label
                  >Maximum new members<input
                    v-model.number="maxUses"
                    type="number"
                    min="1"
                    max="100"
                    required /></label
                ><button :disabled="busy">Create invite link</button>
              </form>
              <CompactLink
                v-if="inviteLink"
                class="generated-invite"
                :value="inviteLink"
                label="New invite link"
              />
              <div v-for="invite in invites" :key="invite.id" class="card device">
                <div>
                  <strong>{{
                    titleCase(invite.status ?? (invite.revoked ? 'revoked' : 'active'))
                  }}</strong>
                  <small v-if="invite.createdAt">
                    · Created {{ new Date(invite.createdAt).toLocaleString()
                    }}{{ invite.creatorId === profile?.id ? ' by you' : '' }}</small
                  >
                  <p>{{ invite.joins ?? invite.uses }} joins · {{ invite.signups ?? 0 }} signups</p>
                  <CompactLink
                    v-if="invite.token"
                    :value="inviteUrl(invite.token)"
                    label="Invite link"
                  />
                  <p v-else-if="invite.status === 'active'" class="muted">
                    This older link cannot be re-displayed. Create a new link to share again.
                  </p>
                  <p>
                    {{ invite.uses }} / {{ invite.maxUses }} uses · Expires
                    {{ new Date(invite.expiresAt).toLocaleString() }}
                  </p>
                </div>
                <button v-if="!invite.revoked" class="danger" @click="revoke(invite.id)">
                  Revoke invite
                </button>
                <button
                  v-else
                  class="danger invite-delete"
                  aria-label="Delete revoked invite"
                  title="Delete revoked invite"
                  @click="deletingInvite = invite.id"
                >
                  <Trash2 :size="17" aria-hidden="true" />
                </button>
              </div></section
          ></template>
        </div>
        <ContextPane label="Room context"
          ><h2>Your rooms</h2>
          <RoomCards :rooms="nearby" />
          <p v-if="!nearby.length">Your next study space is a click away.</p>
          <NuxtLink class="action-link" to="/my-rooms">All my rooms →</NuxtLink>
          <p class="muted">Manage this room here. Open a room to start studying.</p></ContextPane
        >
      </div></template
    >
  </div>
  <SettingsSheet
    :open="!!deletingInvite"
    title="Remove revoked invite?"
    @update:open="deletingInvite = ''"
  >
    <p>The link stays revoked. Its join and referral history is retained.</p>
    <div class="invite-delete-actions">
      <button class="danger" :disabled="deleting" @click="deleteInvite">Remove invite</button
      ><button class="secondary" :disabled="deleting" @click="deletingInvite = ''">
        Keep invite
      </button>
    </div>
  </SettingsSheet>
</template>

<style scoped>
.management-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 310px;
  gap: 2rem;
  align-items: start;
  margin-top: 1.5rem;
}
.invite-create-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4, 16px);
  margin-bottom: var(--space-6, 24px);
}
.invite-create-form > button {
  grid-column: 1 / -1;
  justify-self: start;
}
.invite-delete {
  min-width: 44px;
  min-height: 44px;
  flex-shrink: 0;
}
.generated-invite {
  margin-block: var(--space-4) var(--space-8);
}
.invite-delete-actions {
  display: flex;
  gap: var(--space-3, 12px);
  margin-top: var(--space-4, 16px);
}
@media (max-width: 540px) {
  .invite-create-form {
    grid-template-columns: 1fr;
  }
}
.management-main {
  min-width: 0;
}
.management-main > section + section {
  margin-top: 2rem;
}
.room-identity {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  padding: 1.5rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  background: var(--surface-elevated);
}
.identity-background {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0.16;
  z-index: -1;
}
.identity-badges {
  display: flex;
  flex-direction: column;
  align-items: end;
  gap: 0.5rem;
}
.ui-context-pane > a {
  margin: 1rem 0;
}
@media (max-width: 1100px) {
  .management-layout {
    grid-template-columns: 1fr;
  }
  .ui-context-pane {
    display: none;
  }
}
@media (prefers-contrast: more), (prefers-reduced-transparency: reduce) {
  .identity-background {
    display: none;
  }
}
</style>
