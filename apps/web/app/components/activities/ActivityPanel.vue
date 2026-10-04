<script setup lang="ts">
import { computed, ref, nextTick } from 'vue';
import type { ActivitiesModel } from '../../room/activities-model';
import type { ActivitySettings } from '@study/contracts';
import ActivityCanvas from './ActivityCanvas.vue';
import ActivityPreferences from './ActivityPreferences.vue';
const props = defineProps<{ model: ActivitiesModel }>();
const current = computed(() => props.model.state.view?.activity);
const guess = ref(''),
  input = ref<HTMLInputElement>(),
  rounds = ref(1),
  seconds = ref(60),
  friendsOnly = ref(false),
  customPrompts = ref(''),
  preferences = ref(false),
  settings = ref(false);
const startPolicy = ref<ActivitySettings['start']>('owner'),
  absentPolicy = ref<ActivitySettings['ownerAbsent']>('preserve');
const playAllowed = computed(
  () => current.value?.state === 'active' && current.value.myMode === 'participant',
);
const drawerName = computed(() => {
  const s = current.value;
  return s?.data.type === 'drawing'
    ? (s.members.find((m) => m.id === (s.data.type === 'drawing' ? s.data.drawer : null))?.name ??
        'Participant')
    : '';
});
const guessingAllowed = computed(
  () =>
    playAllowed.value &&
    (current.value?.data.type === 'word' ||
      (current.value?.data.type === 'drawing' && !current.value.data.prompt)),
);
async function submit() {
  if (!guess.value.trim()) return;
  if (await props.model.play({ type: 'guess', guess: guess.value })) guess.value = '';
  await nextTick();
  input.value?.focus();
}
function start(kind: string) {
  void props.model.start(kind, {
    rounds: rounds.value,
    seconds: seconds.value,
    friendsOnly: friendsOnly.value,
    ...(kind === 'sketch-circle' && customPrompts.value.trim() && props.model.state.view?.isOwner
      ? {
          prompts: customPrompts.value
            .split(',')
            .map((p) => p.trim())
            .filter(Boolean),
        }
      : {}),
  });
}
function openSettings() {
  startPolicy.value = props.model.state.view?.settings.start ?? 'owner';
  absentPolicy.value = props.model.state.view?.settings.ownerAbsent ?? 'preserve';
  settings.value = !settings.value;
}
</script>
<template>
  <section class="activity-panel" aria-label="Break activities">
    <p v-if="model.state.error" role="alert">{{ model.state.error }}</p>
    <p v-if="!model.state.view" role="status">Connecting to activities…</p>
    <template v-else>
      <p class="muted">A little pause together. Join only when you want to.</p>
      <div class="activity-actions">
        <button @click="preferences = !preferences">Activity preferences</button
        ><button v-if="model.state.view.isOwner" @click="openSettings">Activity permissions</button>
      </div>
      <ActivityPreferences v-if="preferences" :model="model" />
      <form
        v-if="settings"
        @submit.prevent="model.configure({ start: startPolicy, ownerAbsent: absentPolicy })"
      >
        <label
          >Who may start<select v-model="startPolicy">
            <option value="owner">Owner only</option>
            <option value="moderators">Moderators</option>
            <option value="everyone">Everyone</option>
            <option value="suggestions">Suggestions only (owner launches)</option>
          </select></label
        >
        <label
          >Owner absent<select v-model="absentPolicy">
            <option value="preserve">Preserve permissions</option>
            <option value="moderators">Moderators</option>
            <option value="everyone">Anyone may start temporarily</option>
          </select></label
        >
        <button :disabled="model.state.busy">Save activity permissions</button>
      </form>
      <template v-if="!current || ['completed', 'cancelled'].includes(current.state)">
        <div v-if="model.state.view.canStart" class="activity-options">
          <label>Rounds<input v-model.number="rounds" type="number" min="1" max="3" /></label
          ><label
            >Seconds per turn<input v-model.number="seconds" type="number" min="30" max="180"
          /></label>
          <label><input v-model="friendsOnly" type="checkbox" />Friends of creator only</label>
          <label v-if="model.state.view.isOwner"
            >Custom drawing prompts (comma separated)<input
              v-model="customPrompts"
              maxlength="419"
              placeholder="Optional: moon, tree, pencil"
          /></label>
        </div>
        <div class="activity-catalog">
          <article v-for="item in model.state.view.catalog" :key="item.id">
            <h3>{{ item.name }}</h3>
            <p>{{ item.description }}</p>
            <button
              :disabled="!model.state.view.canStart || model.state.busy"
              @click="start(item.id)"
            >
              Offer {{ item.name }}
            </button>
          </article>
        </div>
        <p v-if="!model.state.view.canStart">
          The room’s activity permissions decide who can offer a game.
        </p>
      </template>
      <template v-if="current">
        <h3>{{ model.state.view.catalog.find((c) => c.id === current!.kind)?.name }}</h3>
        <p role="status" aria-live="polite">
          {{ current.state }} · Round {{ current.round
          }}<template v-if="current.deadline">
            · {{ model.state.remaining }} seconds remaining</template
          >
        </p>
        <div class="activity-actions">
          <template
            v-if="
              ['none', 'declined'].includes(current.myMode) &&
              !['completed', 'cancelled'].includes(current.state)
            "
          >
            <button
              v-if="current.state === 'lobby'"
              :disabled="model.state.busy"
              @click="model.member('join')"
            >
              Join activity</button
            ><button :disabled="model.state.busy" @click="model.member('spectate')">
              Spectate activity</button
            ><button :disabled="model.state.busy" @click="model.member('decline')">
              Decline activity
            </button>
          </template>
          <button
            v-if="
              ['participant', 'spectator'].includes(current.myMode) &&
              !['completed', 'cancelled'].includes(current.state)
            "
            :disabled="model.state.busy"
            @click="model.member('leave')"
          >
            Leave activity
          </button>
          <button
            v-if="current.canManage && current.state === 'lobby'"
            :disabled="model.state.busy"
            @click="model.member('begin')"
          >
            Begin activity
          </button>
          <button
            v-if="current.canManage && !['completed', 'cancelled'].includes(current.state)"
            :disabled="model.state.busy"
            @click="model.member('cancel')"
          >
            Cancel activity
          </button>
          <button
            v-if="!['completed', 'cancelled'].includes(current.state)"
            :disabled="model.state.busy"
            @click="model.member('report')"
          >
            Report activity
          </button>
        </div>
        <p v-if="current.reports">
          {{ current.reports }} report(s). Review the canvas/prompts and cancel if needed.
        </p>
        <ul class="activity-members">
          <li v-for="member in current.members" :key="member.id">
            {{ member.name }} · {{ member.mode }} · {{ member.score }} points
          </li>
        </ul>
        <template v-if="current.data.type === 'word'">
          <ol class="word-guesses" aria-label="Accepted word guesses">
            <li v-for="(entry, index) in current.data.guesses" :key="index">
              <span
                v-for="(letter, pos) in entry.guess"
                :key="pos"
                :class="entry.evaluation[pos]"
                :aria-label="`${letter}: ${entry.evaluation[pos] === 'exact' ? 'correct position' : entry.evaluation[pos] === 'near' ? 'in word, different position' : 'absent'}`"
                >{{ letter
                }}<small>{{
                  entry.evaluation[pos] === 'exact'
                    ? '●'
                    : entry.evaluation[pos] === 'near'
                      ? '↔'
                      : '–'
                }}</small></span
              >
            </li>
          </ol>
          <p v-if="current.data.reveal">
            Word: {{ current.data.reveal }} ·
            {{ current.data.solved ? 'Solved together' : 'Try again next round' }}
          </p>
        </template>
        <template v-else>
          <p>{{ drawerName }} is drawing · {{ current.data.letters }} letters</p>
          <p v-if="current.data.prompt">
            Your prompt: <strong>{{ current.data.prompt }}</strong>
          </p>
          <p v-if="current.data.reveal">Prompt: {{ current.data.reveal }}</p>
          <ActivityCanvas :model="model" />
          <ul aria-label="Activity guesses">
            <li v-for="(entry, index) in current.data.guesses" :key="index">
              {{ current.members.find((m) => m.id === entry.by)?.name ?? 'Participant' }}:
              {{ entry.text }} {{ entry.correct ? '✓' : '' }}
            </li>
          </ul>
        </template>
        <form v-if="guessingAllowed" @submit.prevent="submit">
          <label
            >Activity guess<input
              ref="input"
              v-model="guess"
              maxlength="32"
              autocomplete="off"
              spellcheck="false"
              :placeholder="
                current.data.type === 'word' ? 'Five letters' : 'What is the sketch?'
              " /></label
          ><button :disabled="model.state.busy">Submit guess</button>
        </form>
        <p v-if="current.myMode === 'spectator'">
          Spectating · guesses and drawing are for participants.
        </p>
      </template>
    </template>
  </section>
</template>
<style scoped>
.activity-panel {
  padding: 0.75rem;
  overflow: auto;
  height: 100%;
  font-size: 0.9rem;
}
.activity-panel h3 {
  margin: 0.65rem 0 0.25rem;
  font-family: var(--font-display);
  font-size: 1.35rem;
}
.activity-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-block: 0.5rem;
}
.activity-options,
form {
  display: grid;
  gap: 0.5rem;
  margin-block: 0.6rem;
}
label {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  align-items: center;
}
input:not([type='checkbox']),
select {
  max-width: 100%;
  min-width: 0;
  flex: 1;
}
.activity-catalog article {
  padding-block: 0.5rem;
  border-bottom: 1px solid var(--border);
}
.word-guesses {
  padding: 0;
  list-style: none;
}
.word-guesses li {
  display: flex;
  gap: 0.3rem;
  margin-bottom: 0.3rem;
}
.word-guesses span {
  display: grid;
  text-align: center;
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 0.25rem;
  flex: 1;
  font-weight: 700;
}
.word-guesses .exact {
  border-style: double;
  border-width: 3px;
  background: color-mix(in srgb, var(--accent) 25%, transparent);
}
.word-guesses .near {
  border-style: dashed;
}
.word-guesses small {
  font-size: 0.75rem;
}
.activity-members {
  padding-left: 1.2rem;
}
@media (pointer: coarse), (max-width: 700px) {
  .activity-panel :deep(button),
  .activity-panel :deep(input:not([type='checkbox'])),
  .activity-panel :deep(select) {
    min-height: 44px;
  }
}
</style>
