<script setup lang="ts">
import {
  mediaQualityStageSchema,
  roomSchema,
  inviteCreatedSchema,
  invitesSchema,
  okSchema,
} from '@study/contracts';
import type { Room, z } from '@study/contracts';
import { registerRoomMedia } from '../../room/room-media';
let roomMedia: ReturnType<typeof registerRoomMedia> | undefined;
import { registerBackgrounds } from '../../room/backgrounds';
import { createRealtimeClient } from '../../lib/realtime';
import { registerProductivity } from '../../room/productivity';
let stopProductivity: (() => void) | undefined;
import RoomShell from '../../components/room/RoomShell.vue';
import { createRoomComposition } from '../../room/composition';
import { registerRtc } from '../../room/rtc';
import { createLiveKitProvider } from '@study/adapters/livekit/browser';
let media: ReturnType<typeof registerRtc> | undefined;
import { socialKey, statusLabels } from '../../lib/social';
import { registerRoomSocial } from '../../room/social';
const config = useRuntimeConfig();
const social = inject(socialKey)!;
const immersive = useState('immersive-room', () => false);
let composition: ReturnType<typeof createRoomComposition> | undefined;
let disposed = false,
  entryGeneration = 0;
function leave() {
  entryGeneration++;
  void media?.dispose();
  roomMedia?.dispose();
  stopProductivity?.();
  social.room(null);
  entered.value = false;
  immersive.value = false;
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
  entryGeneration++;
  void media?.dispose();
  roomMedia?.dispose();
  stopProductivity?.();
  social.room(null);
  immersive.value = false;
});
const route = useRoute(),
  { profile, load, api } = useAccount();
const room = ref<Room | null>(null),
  busy = ref(true),
  error = ref(''),
  inviteLink = ref(''),
  editing = ref(false),
  entered = ref(false);
const invites = ref<z.infer<typeof invitesSchema>>([]),
  expiresInHours = ref(24),
  maxUses = ref(10);
async function loadInvites() {
  if (room.value?.ownerId === profile.value?.id)
    invites.value = await api.request(
      `/api/v1/rooms/invites?roomId=${room.value!.id}`,
      invitesSchema,
    );
}
onMounted(async () => {
  try {
    if (await load()) {
      room.value = await api.request(
        `/api/v1/rooms/detail?roomId=${encodeURIComponent(String(route.params.id))}`,
        roomSchema,
      );
      await loadInvites();
    }
  } catch {
    error.value = 'This room is unavailable or you do not have access.';
  } finally {
    busy.value = false;
  }
});
async function enter() {
  const generation = ++entryGeneration;
  busy.value = true;
  try {
    room.value = await api.request('/api/v1/rooms/join', roomSchema, { roomId: room.value!.id });
    if (disposed || generation !== entryGeneration) return;
    entered.value = true;
    composition = createRoomComposition(profile.value!.displayName, invitations);
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
    const realtime = createRealtimeClient();
    registerBackgrounds(composition.ui, room.value.id, profile.value!.id, realtime);
    roomMedia = registerRoomMedia(composition, room.value.id, profile.value!.id, realtime);
    stopProductivity = registerProductivity(composition.ui, room.value.id, realtime);
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
    if (!composition) return;
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
    inviteLink.value = `${location.origin}/invite#${result.token}`;
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
  inviteLink.value = '';
  await loadInvites();
}
</script>
<template>
  <RoomShell
    v-if="entered && room && composition && media"
    :room="room"
    :ui="composition.ui"
    :workspace="composition.workspace"
    :participants="composition.participants"
    :camera-renderer="media.cameraRenderer"
    :room-state="composition.state"
    @leave="leave"
    @invite="invitations"
  />
  <div v-else>
    <NuxtLink to="/my-rooms">← My Rooms</NuxtLink>
    <p v-if="busy" role="status">Loading…</p>
    <p v-if="error" role="alert" class="error">{{ error }}</p>
    <SignIn v-if="!profile && !busy" /><template v-if="room"
      ><section class="hero" style="margin-top: 1.5rem">
        <span class="tag">{{ room.privacy }}</span>
        <h1>{{ room.name }}</h1>
        <p>{{ room.description }}</p>
        <p>{{ room.memberCount }} members · Available independently of the owner</p>
        <button id="room-enter" :disabled="busy" @click="enter">
          {{ entered ? 'Re-enter room' : room.membership ? 'Enter room' : 'Join room' }}
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
        </section>
        <section>
          <h2 id="invite-heading" tabindex="-1">Invite people</h2>
          <p>
            Anyone with a valid invite can become a member. Share it only with people you want to
            join.
          </p>
          <form class="form" @submit.prevent="createInvite">
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
          <p v-if="inviteLink" class="link-output" aria-label="New invite link">{{ inviteLink }}</p>
          <p v-if="inviteLink" class="muted">Copy this link now. It is shown only once.</p>
          <div v-for="invite in invites" :key="invite.id" class="card device">
            <div>
              <strong>{{ invite.revoked ? 'Revoked' : 'Invite' }}</strong>
              <p>
                {{ invite.uses }} / {{ invite.maxUses }} uses · Expires
                {{ new Date(invite.expiresAt).toLocaleString() }}
              </p>
            </div>
            <button v-if="!invite.revoked" class="danger" @click="revoke(invite.id)">
              Revoke invite
            </button>
          </div>
        </section></template
      ></template
    >
  </div>
</template>
