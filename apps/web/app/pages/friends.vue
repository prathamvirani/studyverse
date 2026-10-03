<script setup lang="ts">
import { okSchema, roomBrowseSchema, roomListSchema, peopleSearchSchema } from '@study/contracts';
import type { Room, PresenceView, z } from '@study/contracts';
import {
  IntegratedSearch,
  PageHeader,
  StudySelect,
  OverlayPopover,
  SegmentedControl,
} from '@study/ui';
import { socialKey, statusLabels } from '../lib/social';
const entry = useRoomEntry();
const social = inject(socialKey)!,
  { profile, load, api } = useAccount(),
  route = useRoute();
const busy = ref(false),
  error = ref(''),
  notice = ref(''),
  rooms = ref<Room[]>([]),
  shared = ref<Room[]>([]),
  inviteRoom = ref('');
const search = ref(''),
  searching = ref(false),
  searched = ref(false),
  results = ref<z.infer<typeof peopleSearchSchema>['people']>([]);
const searchAnchor = ref<HTMLElement>(),
  searchOpen = ref(false),
  scope = ref('global');
let searchTimer: ReturnType<typeof setTimeout> | undefined;
const selectedId = ref('');
const selected = computed(() =>
  social.state.snapshot?.friends.find((p) => p.id === selectedId.value),
);
const friends = computed(() =>
  (social.state.snapshot?.friends ?? []).filter((p) =>
    `${p.name} ${p.username ?? ''}`.toLowerCase().includes(search.value.toLowerCase()),
  ),
);
const detail = ref<HTMLElement>();
const friendMenus = useContextTargets();
function friendActions(person: PresenceView) {
  return [
    { id: 'friend.open', label: 'Open friend context', run: () => select(person) },
    ...(rooms.value.length
      ? [{ id: 'friend.invite', label: 'Invite to room', run: () => select(person) }]
      : []),
    ...(person.username
      ? [
          {
            id: 'friend.copy',
            label: 'Copy username',
            run: () => navigator.clipboard.writeText(person.username!),
          },
        ]
      : []),
    {
      id: 'friend.remove',
      label: 'Remove friend',
      danger: true,
      run: () =>
        window.confirm(`Remove ${person.name} as a friend?`) &&
        action('/api/v1/friends/remove', { targetId: person.id }),
    },
    {
      id: 'friend.block',
      label: 'Block',
      danger: true,
      run: () =>
        window.confirm(`Block ${person.name}?`) &&
        action('/api/v1/friends/block', { targetId: person.id }),
    },
  ];
}
let selectionGeneration = 0,
  searchGeneration = 0;
async function select(person: PresenceView) {
  selectedId.value = person.id;
  shared.value = [];
  const current = ++selectionGeneration;
  if (person.username)
    void navigateTo({ path: '/friends', query: { friend: person.username } }, { replace: true });
  await nextTick();
  detail.value?.focus();
  try {
    const data = await api.request(
      `/api/v1/rooms/shared?targetId=${encodeURIComponent(person.id)}`,
      roomListSchema,
    );
    if (current === selectionGeneration) shared.value = data.rooms;
  } catch {
    if (current === selectionGeneration)
      error.value = 'Shared rooms are unavailable. Please select your friend again to retry.';
  }
}
watch(
  () => social.state.snapshot?.friends,
  (people) => {
    if (selectedId.value && !people?.some((p) => p.id === selectedId.value)) {
      selectedId.value = '';
      shared.value = [];
      selectionGeneration++;
    }
    const linked = people?.find((p) => p.username === route.query.friend);
    if (linked && !selectedId.value) void select(linked);
  },
  { immediate: true },
);
watch([search, scope], () => {
  searchGeneration++;
  clearTimeout(searchTimer);
  results.value = [];
  searched.value = false;
  searchOpen.value = search.value.trim().length >= 3;
  if (searchOpen.value) searchTimer = setTimeout(() => void findPerson(), 350);
});
onUnmounted(() => {
  selectionGeneration++;
  searchGeneration++;
  clearTimeout(searchTimer);
});
onCriticalPageMounted(async () => {
  if (await load()) {
    try {
      rooms.value = (
        await api.request('/api/v1/rooms/browse?scope=mine', roomBrowseSchema)
      ).rooms.filter((r) => r.ownerId === profile.value?.id);
      inviteRoom.value = rooms.value[0]?.id ?? '';
    } catch {
      error.value = 'Rooms could not be loaded.';
    }
  }
});
async function action(path: `/api/v1/${string}`, input: unknown) {
  busy.value = true;
  error.value = '';
  notice.value = '';
  try {
    await api.request(path, okSchema, input);
    notice.value = 'Saved. Your list will update shortly.';
    results.value = [];
    searched.value = false;
  } catch {
    error.value = 'This action is unavailable. Check your connection or try again later.';
  } finally {
    busy.value = false;
  }
}
async function findPerson() {
  const query = search.value.trim().replace(/^@/, '');
  if (query.length < 3) return;
  clearTimeout(searchTimer);
  const current = ++searchGeneration;
  searching.value = true;
  searchOpen.value = true;
  error.value = '';
  try {
    const data = await api.request(
      `/api/v1/friends/find?query=${encodeURIComponent(query)}&scope=${scope.value}`,
      peopleSearchSchema,
    );
    if (current === searchGeneration) {
      results.value = data.people;
      searched.value = true;
    }
  } catch {
    if (current === searchGeneration)
      error.value = 'Search is unavailable. Wait a moment and try again.';
  } finally {
    if (current === searchGeneration) searching.value = false;
  }
}
</script>
<template>
  <div>
    <PageHeader title="Friends" description="A little company for the work ahead."
      ><template #actions
        ><NuxtLink class="action-link" to="/account#presence"
          >Presence & privacy</NuxtLink
        ></template
      ></PageHeader
    >
    <SignIn v-if="!profile" /><template v-else>
      <p v-if="error || social.state.error" role="alert" class="error">
        {{ error || social.state.error }}
      </p>
      <p v-if="notice" role="status" class="success">{{ notice }}</p>
      <div class="friends-layout" :class="{ 'friend-selected': selected }">
        <div class="friends-list">
          <div ref="searchAnchor">
            <IntegratedSearch
              v-model="search"
              label="Search people"
              placeholder="Name or username"
              :maxlength="80"
              :busy="searching"
              @submit="findPerson"
            />
          </div>
          <OverlayPopover
            v-model:open="searchOpen"
            :anchor="searchAnchor"
            label="People search results"
          >
            <SegmentedControl
              v-model="scope"
              label="People search scope"
              :options="[
                { value: 'global', label: 'Global' },
                { value: 'met', label: 'Met before' },
              ]"
            />
            <article v-for="person in results" :key="person.username" class="people-result">
              <div>
                <strong>{{ person.name }}</strong
                ><small>@{{ person.username }}</small>
              </div>
              <button
                v-if="person.state === 'none'"
                :disabled="busy"
                @click="action('/api/v1/friends/request', { username: person.username })"
              >
                Add friend
              </button>
              <span v-else>{{
                person.state === 'friends'
                  ? 'Friends'
                  : person.state === 'incoming'
                    ? 'Request received'
                    : 'Request sent'
              }}</span>
            </article>
            <p v-if="searching" role="status">Searching…</p>
            <p v-else-if="searched && !results.length" role="status">No available matches.</p>
          </OverlayPopover>
          <section>
            <h2>
              Your friends <small>{{ friends.length }}</small>
            </h2>
            <p v-if="!social.state.snapshot">
              {{ social.state.connected ? 'Loading friends…' : 'Reconnecting…' }}
            </p>
            <p v-else-if="!friends.length" class="empty">
              {{
                search
                  ? 'No friends match this search.'
                  : 'Meet someone in a room, then find them below.'
              }}
            </p>
            <button
              v-for="person in friends"
              :ref="(node) => friendMenus.bind(person.id, node, () => friendActions(person))"
              :key="person.id"
              class="friend-row secondary"
              :aria-pressed="selectedId === person.id"
              @click="select(person)"
            >
              <span class="friend-avatar" aria-hidden="true">{{
                person.name.slice(0, 2).toUpperCase()
              }}</span
              ><span
                ><strong>{{ person.name }}</strong
                ><small v-if="person.username">@{{ person.username }}</small
                ><small>{{
                  person.status ? statusLabels[person.status] : 'Presence private'
                }}</small></span
              ><span aria-hidden="true">→</span>
            </button>
          </section>
          <section v-if="social.state.invitations.length">
            <h2>Room invitations</h2>
            <div v-for="inv in social.state.invitations" :key="inv.id" class="card social-row">
              <strong>{{ inv.roomName }}</strong>
              <div class="actions">
                <button
                  :disabled="busy"
                  @click="action('/api/v1/rooms/friend-invite-accept', { inviteId: inv.id })"
                >
                  Accept invitation</button
                ><button
                  class="secondary"
                  :disabled="busy"
                  @click="action('/api/v1/rooms/friend-invite-decline', { inviteId: inv.id })"
                >
                  Decline invitation
                </button>
              </div>
            </div>
            <NuxtLink to="/my-rooms">Open My Rooms after accepting</NuxtLink>
          </section>
          <template v-if="social.state.snapshot">
            <section v-if="social.state.snapshot.incoming.length">
              <h2>Friend requests</h2>
              <div
                v-for="person in social.state.snapshot.incoming"
                :key="person.id"
                class="card social-row"
              >
                <strong
                  >{{ person.name
                  }}<small v-if="person.username"> @{{ person.username }}</small></strong
                >
                <div class="actions">
                  <button
                    :disabled="busy"
                    @click="action('/api/v1/friends/accept', { targetId: person.id })"
                  >
                    Accept</button
                  ><button
                    class="secondary"
                    :disabled="busy"
                    @click="action('/api/v1/friends/decline', { targetId: person.id })"
                  >
                    Decline</button
                  ><button
                    class="danger"
                    :disabled="busy"
                    @click="action('/api/v1/friends/block', { targetId: person.id })"
                  >
                    Block
                  </button>
                </div>
              </div>
            </section>
            <section v-if="social.state.snapshot.outgoing.length">
              <h2>Sent requests</h2>
              <div
                v-for="person in social.state.snapshot.outgoing"
                :key="person.id"
                class="card social-row"
              >
                {{ person.name
                }}<button
                  class="secondary"
                  :disabled="busy"
                  @click="action('/api/v1/friends/decline', { targetId: person.id })"
                >
                  Cancel request
                </button>
              </div>
            </section>
          </template>
        </div>
        <section ref="detail" tabindex="-1" class="friend-detail" aria-label="Selected friend">
          <template v-if="selected"
            ><button
              class="secondary friend-back"
              @click="
                selectedId = '';
                shared = [];
                navigateTo('/friends', { replace: true });
              "
            >
              ← Friends
            </button>
            <div class="friend-profile">
              <span
                class="friend-avatar large"
                :data-status="selected.status ?? 'private'"
                aria-hidden="true"
                >{{ selected.name.slice(0, 2).toUpperCase() }}</span
              >
              <h2>
                {{ selected.name }}
                <small
                  >·
                  {{ selected.status ? statusLabels[selected.status] : 'Presence private' }}</small
                >
              </h2>
              <p v-if="selected.username">@{{ selected.username }}</p>
              <p v-if="selected.room">
                {{ selected.room.name }}
                <button
                  v-if="selected.room.joinable"
                  class="action-link secondary"
                  @click="
                    entry
                      .openAddress(selected.room.address ?? selected.room.id, '/friends')
                      .catch(() => (error = 'This room is unavailable.'))
                  "
                >
                  Join room
                </button>
              </p>
            </div>
            <div class="friend-invite">
              <StudySelect
                v-if="rooms.length"
                v-model="inviteRoom"
                label="Invite friends to"
                :options="rooms.map((r) => ({ value: r.id, label: r.name }))"
              /><button
                v-if="inviteRoom"
                :disabled="busy"
                @click="
                  action('/api/v1/rooms/friend-invite', {
                    roomId: inviteRoom,
                    targetId: selected.id,
                  })
                "
              >
                Invite to room
              </button>
              <p v-else>Create a room to invite your friend.</p>
            </div>
            <section>
              <h2>Shared rooms</h2>
              <RoomCards :rooms="shared" />
              <p v-if="!shared.length">No shared rooms to show.</p>
            </section>
            <details>
              <summary>Friend options</summary>
              <div class="actions">
                <button
                  class="secondary"
                  :disabled="busy"
                  @click="action('/api/v1/friends/remove', { targetId: selected.id })"
                >
                  Remove friend</button
                ><button
                  class="danger"
                  :disabled="busy"
                  @click="action('/api/v1/friends/block', { targetId: selected.id })"
                >
                  Block
                </button>
              </div>
            </details>
          </template>
          <div v-else class="empty">
            <h2>Study is better with company</h2>
            <p>Select a friend to see shared rooms or send an invitation.</p>
          </div>
        </section>
      </div></template
    >
  </div>
</template>
<style scoped>
.people-result {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 0;
}
.people-result small {
  display: block;
  color: var(--text-secondary);
}
.friend-profile h2 small {
  font-size: 0.875rem;
  color: var(--text-secondary);
}
.friend-profile h2 {
  margin-bottom: 4px;
}
.friend-profile h2 + p {
  margin-top: 0;
}
.friend-profile .friend-avatar {
  position: relative;
}
.friend-profile .friend-avatar::after {
  content: '';
  width: 10px;
  height: 10px;
  position: absolute;
  right: 2px;
  bottom: 2px;
  border-radius: 50%;
  background: var(--text-muted);
  border: 2px solid var(--surface);
}

.friends-layout {
  display: grid;
  grid-template-columns: minmax(300px, 0.7fr) minmax(0, 1.3fr);
  gap: 2rem;
  align-items: start;
}
.friends-list {
  min-width: 0;
}
section {
  margin-top: 1.5rem;
}
.friend-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  width: 100%;
  text-align: left;
  margin: 0.5rem 0;
  background: var(--surface-elevated);
}
.friend-row[aria-pressed='true'] {
  border-color: var(--accent);
  background: var(--accent-subtle);
  color: var(--text-primary);
}
.friend-row > :last-child {
  margin-left: auto;
}
.friend-row strong {
  font-weight: 500;
}
.friend-row small {
  display: block;
  color: var(--text-secondary);
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.friend-avatar {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--accent-subtle);
  color: var(--accent);
}
.friend-profile .friend-avatar[data-status='focusing']::after {
  background: var(--accent);
}
.friend-profile .friend-avatar[data-status='available']::after {
  background: var(--success);
}
.friend-profile .friend-avatar[data-status='break']::after {
  background: var(--warning);
}
.friend-avatar.large {
  width: 64px;
  height: 64px;
  margin-bottom: 1rem;
}
.friend-detail {
  margin: 0;
  padding: 1.5rem;
  background: var(--surface);
  border-radius: var(--radius-card);
  min-width: 0;
}
.friend-profile {
  animation: friend-reveal 220ms ease-out;
  overflow-wrap: anywhere;
}
.friend-invite {
  display: flex;
  align-items: end;
  flex-wrap: wrap;
  gap: 1rem;
}
.friend-invite > :first-child {
  flex: 1;
  min-width: 180px;
}
.friend-back {
  display: none;
  margin-bottom: 1rem;
}
.social-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
  justify-content: space-between;
  margin: 0.5rem 0;
}
.friend-search p {
  font-size: 0.85rem;
}
details {
  margin-top: 1.5rem;
}
summary {
  cursor: pointer;
  padding: 0.75rem 0;
}
small {
  font-weight: 400;
}
@keyframes friend-reveal {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
@media (max-width: 900px) {
  .friends-layout {
    grid-template-columns: 1fr;
  }
  .friend-detail {
    display: none;
  }
  .friend-selected .friends-list {
    display: none;
  }
  .friend-selected .friend-detail {
    display: block;
  }
  .friend-back {
    display: inline-flex;
  }
}
@media (prefers-reduced-motion: reduce) {
  .friend-profile {
    animation: none;
  }
}
</style>
