<script setup lang="ts">
import { okSchema, socialPrivacySchema, roomListSchema } from '@study/contracts';
import type { Privacy, Room } from '@study/contracts';
import { socialKey, statusLabels } from '../lib/social';
const social = inject(socialKey)!,
  { profile, load, api } = useAccount();
const busy = ref(false),
  error = ref(''),
  notice = ref(''),
  rooms = ref<Room[]>([]),
  inviteRoom = ref('');
const privacy = ref<Privacy>({
  online: true,
  room: false,
  study: true,
  join: false,
  invites: true,
});
watch(
  () => social.state.snapshot?.privacy,
  (p) => {
    if (p) privacy.value = { ...p };
  },
  { immediate: true },
);
onMounted(async () => {
  if (await load()) {
    try {
      rooms.value = (await api.request('/api/v1/rooms/mine', roomListSchema)).rooms.filter(
        (r) => r.ownerId === profile.value?.id,
      );
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
  } catch {
    error.value = 'This action is unavailable. Check your connection or try again later.';
  } finally {
    busy.value = false;
  }
}
async function savePrivacy() {
  busy.value = true;
  try {
    await api.request('/api/v1/friends/privacy', socialPrivacySchema, privacy.value);
    notice.value = 'Privacy saved.';
  } catch {
    error.value = 'Privacy could not be saved.';
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <div>
    <div class="hero">
      <span class="eyebrow">A little company</span>
      <h1>Friends</h1>
      <p>Find your people in a study room. Open a participant’s menu to send a friend request.</p>
    </div>
    <SignIn v-if="!profile" />
    <template v-else>
      <p role="status">{{ social.state.connected ? 'Connected' : 'Reconnecting…' }}</p>
      <p v-if="error || social.state.error" class="error" role="alert">
        {{ error || social.state.error }}
      </p>
      <p v-if="notice" class="success" role="status">{{ notice }}</p>
      <section class="social-settings card form">
        <h2>Your presence</h2>
        <label
          >Status<select
            aria-label="Status"
            :value="social.state.status"
            @change="
              social.status(($event.target as HTMLSelectElement).value as keyof typeof statusLabels)
            "
          >
            <option v-for="(label, key) in statusLabels" :key="key" :value="key">
              {{ label }}
            </option>
          </select></label
        >
        <details>
          <summary>Presence & invitation privacy</summary>
          <p>
            Hidden information is withheld by the server. Private and unlisted rooms are shown only
            to their members. Hiding your current room also hides you from other participants in its
            rail.
          </p>
          <label
            v-for="(label, key) in {
              online: 'Show online presence',
              room: 'Show current room',
              study: 'Show study status',
              join: 'Show Join action',
              invites: 'Receive friend invitations',
            }"
            :key="key"
            ><input v-model="privacy[key]" type="checkbox" /> {{ label }}</label
          ><button :disabled="busy" @click="savePrivacy">Save privacy</button>
        </details>
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
            <strong>{{ person.name }}</strong>
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
        <section>
          <h2>
            Your friends <span class="muted">{{ social.state.snapshot.friends.length }}</span>
          </h2>
          <div v-if="!social.state.snapshot.friends.length" class="empty">
            A quiet start. Meet someone in a room and say hello with a friend request.
          </div>
          <label v-if="rooms.length" class="form"
            >Invite friends to<select v-model="inviteRoom">
              <option v-for="room in rooms" :key="room.id" :value="room.id">{{ room.name }}</option>
            </select></label
          >
          <div class="grid">
            <article v-for="person in social.state.snapshot.friends" :key="person.id" class="card">
              <div class="friend-avatar" aria-hidden="true">
                {{ person.name.slice(0, 2).toUpperCase() }}
              </div>
              <h3>{{ person.name }}</h3>
              <p>{{ person.status ? statusLabels[person.status] : 'Presence private' }}</p>
              <p v-if="person.room">
                {{ person.room.name }}
                <NuxtLink v-if="person.room.joinable" :to="`/rooms/${person.room.id}`"
                  >Join</NuxtLink
                >
              </p>
              <details>
                <summary>Friend options</summary>
                <div class="actions">
                  <button
                    v-if="inviteRoom"
                    :disabled="busy"
                    @click="
                      action('/api/v1/rooms/friend-invite', {
                        roomId: inviteRoom,
                        targetId: person.id,
                      })
                    "
                  >
                    Invite to room</button
                  ><button
                    class="secondary"
                    :disabled="busy"
                    @click="action('/api/v1/friends/remove', { targetId: person.id })"
                  >
                    Remove friend</button
                  ><button
                    class="danger"
                    :disabled="busy"
                    @click="action('/api/v1/friends/block', { targetId: person.id })"
                  >
                    Block
                  </button>
                </div>
              </details>
            </article>
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
        <details>
          <summary>Blocked people ({{ social.state.snapshot.blocked.length }})</summary>
          <p>
            Blocking removes friendship and requests, hides presence in both directions, and
            prevents invitations. Unblocking does not restore a friendship.
          </p>
          <div
            v-for="person in social.state.snapshot.blocked"
            :key="person.id"
            class="card social-row"
          >
            {{ person.name
            }}<button
              class="secondary"
              :disabled="busy"
              @click="action('/api/v1/friends/unblock', { targetId: person.id })"
            >
              Unblock
            </button>
          </div>
        </details>
      </template>
    </template>
  </div>
</template>
<style>
.social-row {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
  margin-bottom: 0.8rem;
  flex-wrap: wrap;
}
.social-settings input[type='checkbox'] {
  display: inline;
  width: auto;
  margin-right: 0.5rem;
}
.social-settings details {
  line-height: 1.8;
}
.friend-avatar {
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: #e5eadb;
  color: #345b43;
}
summary {
  cursor: pointer;
}
.social-settings {
  max-width: none;
}
.social-settings select {
  max-width: 340px;
}
</style>
