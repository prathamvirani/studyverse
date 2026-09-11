<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { tasksViewSchema } from '@study/contracts';
import type { z, TaskScope } from '@study/contracts';
import type { RealtimeClient } from '../../lib/realtime';
const requestId = () => crypto.randomUUID();
const props = defineProps<{ roomId: string; realtime: RealtimeClient }>();
const scope = ref<'personal' | 'shared'>('personal'),
  view = ref<z.infer<typeof tasksViewSchema> | null>(null),
  title = ref(''),
  error = ref(''),
  busy = ref(false),
  editing = ref(''),
  editTitle = ref('');
const target = (): TaskScope =>
  scope.value === 'personal' ? { scope: 'personal' } : { scope: 'shared', roomId: props.roomId };
function subscribe() {
  editing.value = '';
  props.realtime.subscribe(
    'tasks.snapshot',
    target(),
    (v) => {
      const result = tasksViewSchema.parse(v);
      if (result.scope.scope === scope.value) view.value = result;
    },
    () => {
      view.value = null;
    },
  );
}
onMounted(subscribe);
async function mutate(command: string, payload: unknown) {
  busy.value = true;
  error.value = '';
  try {
    await props.realtime.send(command, payload);
    title.value = '';
    editing.value = '';
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    busy.value = false;
    props.realtime.refresh('tasks.snapshot');
  }
}
type Task = z.infer<typeof tasksViewSchema>['tasks'][number];
function update(t: Task, change: Partial<Task>) {
  void mutate('tasks.update', {
    scope: target(),
    id: t.id,
    version: t.version,
    title: t.title,
    completed: t.completed,
    position: t.position,
    ...change,
  });
}
</script>
<template>
  <div class="productivity-panel">
    <div class="scope-tabs" role="group" aria-label="Task scope">
      <button
        :aria-pressed="scope === 'personal'"
        @click="
          scope = 'personal';
          subscribe();
        "
      >
        Personal</button
      ><button
        :aria-pressed="scope === 'shared'"
        @click="
          scope = 'shared';
          subscribe();
        "
      >
        Shared
      </button>
    </div>
    <small>{{
      scope === 'personal' ? 'Private to you · across rooms' : 'Shared with this room'
    }}</small>
    <p v-if="!view">{{ realtime.state.errors['tasks.snapshot'] || 'Loading tasks…' }}</p>
    <template v-else
      ><ul class="task-list">
        <li v-for="t in view.tasks" :key="t.id">
          <label
            ><input
              type="checkbox"
              :checked="t.completed"
              :disabled="!t.canEdit || busy"
              :aria-label="'Complete ' + t.title"
              @change="update(t, { completed: !t.completed })"
            /><span :class="{ completed: t.completed }">{{ t.title }}</span></label
          >
          <div v-if="t.canEdit" class="productivity-actions">
            <button
              :disabled="busy"
              :aria-label="'Edit ' + t.title"
              @click="
                editing = t.id;
                editTitle = t.title;
              "
            >
              Edit</button
            ><button
              :disabled="busy"
              :aria-label="'Move up ' + t.title"
              @click="
                mutate('tasks.move', {
                  scope: target(),
                  id: t.id,
                  version: t.version,
                  direction: 'up',
                })
              "
            >
              ↑</button
            ><button
              :disabled="busy"
              :aria-label="'Move down ' + t.title"
              @click="
                mutate('tasks.move', {
                  scope: target(),
                  id: t.id,
                  version: t.version,
                  direction: 'down',
                })
              "
            >
              ↓</button
            ><button
              :disabled="busy"
              :aria-label="'Delete ' + t.title"
              @click="mutate('tasks.delete', { scope: target(), id: t.id, version: t.version })"
            >
              Delete
            </button>
          </div>
          <form v-if="editing === t.id" @submit.prevent="update(t, { title: editTitle })">
            <input
              v-model="editTitle"
              aria-label="Edit task title"
              maxlength="300"
              required
            /><button :disabled="busy">Save task</button>
          </form>
        </li>
      </ul>
      <small v-if="!view.tasks.length">No tasks yet.</small>
      <form
        @submit.prevent="mutate('tasks.create', { scope: target(), requestId: requestId(), title })"
      >
        <input
          v-model="title"
          aria-label="New task"
          placeholder="One small next step…"
          maxlength="300"
          required
        /><button :disabled="busy || !title.trim() || view.tasks.length >= 200">Add task</button>
      </form>
      <small>{{ view.tasks.length }} / 200 tasks</small></template
    >
    <p v-if="error" role="alert">{{ error }}</p>
  </div>
</template>
