<script setup lang="ts">
import { OverlayPopover, StudySelect, ArrowRight } from '@study/ui';
import { okSchema } from '@study/contracts';
import type { Room, PresenceView } from '@study/contracts';
import { statusLabels, socialKey } from '../lib/social';
const props = defineProps<{ person: PresenceView; rooms: Room[] }>();
const entry = useRoomEntry();
const social = inject(socialKey)!,
  { api, profile } = useAccount();
const anchor = ref<HTMLButtonElement>(),
  open = ref(false),
  busy = ref(false),
  error = ref(''),
  inviteRoom = ref('');
const current = computed(() =>
  social.state.snapshot?.friends.find((p) => p.id === props.person.id),
);
const owned = computed(() => props.rooms.filter((r) => r.ownerId === profile.value?.id));
useContextActions(anchor, () =>
  current.value
    ? [
        {
          id: 'friend.open',
          label: 'Open friend context',
          run: () => {
            open.value = true;
          },
        },
        ...(owned.value.length
          ? [
              {
                id: 'friend.invite',
                label: 'Invite to room',
                run: () => {
                  open.value = true;
                },
              },
            ]
          : []),
        ...(current.value.username
          ? [
              {
                id: 'friend.copy',
                label: 'Copy username',
                run: () => navigator.clipboard.writeText(current.value!.username!),
              },
            ]
          : []),
        {
          id: 'friend.remove',
          label: 'Remove friend',
          danger: true,
          run: async () => {
            if (window.confirm(`Remove ${props.person.name} as a friend?`))
              await api.request('/api/v1/friends/remove', okSchema, { targetId: props.person.id });
          },
        },
        {
          id: 'friend.block',
          label: 'Block',
          danger: true,
          run: async () => {
            if (window.confirm(`Block ${props.person.name}?`))
              await api.request('/api/v1/friends/block', okSchema, { targetId: props.person.id });
          },
        },
      ]
    : [],
);
watch(current, (value) => {
  if (!value) open.value = false;
});
watch(
  owned,
  (value) => {
    if (!value.some((r) => r.id === inviteRoom.value)) inviteRoom.value = value[0]?.id ?? '';
  },
  { immediate: true },
);
async function invite() {
  busy.value = true;
  error.value = '';
  try {
    await api.request('/api/v1/rooms/friend-invite', okSchema, {
      roomId: inviteRoom.value,
      targetId: props.person.id,
    });
    open.value = false;
  } catch {
    error.value = 'The invitation could not be sent. Try again.';
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <button ref="anchor" class="home-friend secondary" :aria-expanded="open" @click="open = !open">
    <span class="home-avatar" aria-hidden="true">{{ person.name.slice(0, 2).toUpperCase() }}</span>
    <span
      ><strong>{{ person.name }}</strong
      ><small v-if="person.username">@{{ person.username }}</small
      ><small
        >{{ person.status ? statusLabels[person.status] : 'Presence private'
        }}<template v-if="person.room"> · {{ person.room.name }}</template></small
      ></span
    >
  </button>
  <OverlayPopover
    v-model:open="open"
    :anchor="anchor"
    :label="`${person.name} actions`"
    focus
    class="friend-quick-card"
    :match-anchor-width="false"
    align="end"
  >
    <template v-if="current">
      <div class="friend-quick-identity">
        <span class="home-avatar" :data-status="current.status" aria-hidden="true">{{
          current.name.slice(0, 2).toUpperCase()
        }}</span>
        <div>
          <div class="friend-quick-name">
            <strong>{{ current.name }}</strong
            ><span>
              · {{ current.status ? statusLabels[current.status] : 'Presence private' }}</span
            >
          </div>
          <small v-if="current.username">@{{ current.username }}</small>
        </div>
      </div>
      <button
        v-if="current.room?.joinable"
        class="action-link secondary"
        @click="
          entry
            .openAddress(current.room.address ?? current.room.id, '/home')
            .catch(() => (error = 'This room is unavailable.'))
        "
      >
        Join {{ current.room.name }}
      </button>
      <div v-if="owned.length" class="friend-quick-invite">
        <StudySelect
          v-if="owned.length"
          v-model="inviteRoom"
          label="Invite to"
          :options="owned.map((r) => ({ value: r.id, label: r.name }))"
        />
        <button
          v-if="inviteRoom"
          class="secondary"
          :disabled="busy"
          aria-label="Invite to room"
          @click="invite"
        >
          Invite
        </button>
      </div>
      <NuxtLink
        class="ui-menu-row"
        :to="{ path: '/friends', query: current.username ? { friend: current.username } : {} }"
        ><ArrowRight :size="16" aria-hidden="true" />Friend details & shared rooms</NuxtLink
      >
      <p v-if="error" role="alert">{{ error }}</p>
    </template>
  </OverlayPopover>
</template>
<style scoped>
.home-friend {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  text-align: left;
  padding: 12px 8px;
  background: transparent;
  border: 0;
  color: var(--text-primary);
}
.home-friend small {
  display: block;
  color: var(--text-secondary);
  line-height: 1.5;
}
.home-avatar {
  flex-shrink: 0;
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: var(--accent-subtle);
  color: var(--accent);
}
</style>
<style scoped>
.friend-quick-card {
  width: min(300px, calc(100vw - 16px));
  padding: var(--space-3);
  gap: var(--space-3);
}
.friend-quick-card[data-open='true'] {
  display: grid;
}
.friend-quick-identity {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.friend-quick-identity .home-avatar {
  width: 32px;
  height: 32px;
  position: relative;
}
.friend-quick-identity .home-avatar::after {
  content: '';
  width: 8px;
  height: 8px;
  position: absolute;
  bottom: 0;
  right: 0;
  border-radius: 50%;
  background: var(--text-muted);
  border: 1px solid var(--surface);
}
.friend-quick-identity .home-avatar[data-status='available']::after {
  background: var(--success);
}
.friend-quick-identity .home-avatar[data-status='focusing']::after {
  background: var(--accent);
}
.friend-quick-identity .home-avatar[data-status='break']::after {
  background: var(--warning);
}
.friend-quick-name {
  font-size: 13px;
  line-height: 1.4;
}
.friend-quick-name span,
.friend-quick-identity small {
  color: var(--text-secondary);
  font-size: 12px;
}
.friend-quick-identity small {
  display: block;
}
.friend-quick-invite {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  gap: var(--space-2);
}
.friend-quick-card .ui-menu-row {
  font-size: 12px;
  padding: var(--space-2);
}
</style>
