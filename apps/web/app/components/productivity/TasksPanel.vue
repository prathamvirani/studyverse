<script setup lang="ts">
import { SegmentedControl, Check, ArrowUp, ArrowDown, Trash2, workspaceHeaderKey } from '@study/ui';
import { onMounted, onUnmounted, ref, inject, nextTick } from 'vue';
import { tasksViewSchema } from '@study/contracts';
import type { z, TaskScope } from '@study/contracts';
import type { RealtimeClient } from '../../lib/realtime';
const headerTarget = inject(workspaceHeaderKey, undefined);
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
let unsubscribe: (() => void) | undefined;
onUnmounted(() => unsubscribe?.());
function subscribe() {
  unsubscribe?.();
  editing.value = '';
  if (view.value?.scope.scope !== scope.value) view.value = null;
  unsubscribe = props.realtime.subscribe(
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
async function startEdit(t: Task, event: Event) {
  editing.value = t.id;
  editTitle.value = t.title;
  const row = (event.currentTarget as HTMLElement).closest('li');
  await nextTick();
  row?.querySelector<HTMLInputElement>('.task-inline-input')?.focus();
}
function finishEdit(t: Task) {
  if (editing.value !== t.id || busy.value) return;
  if (editTitle.value.trim() && editTitle.value !== t.title) update(t, { title: editTitle.value });
  else editing.value = '';
}
</script>
<template>
  <div class="productivity-panel">
    <Teleport :to="headerTarget ?? 'body'" :disabled="!headerTarget">
      <div class="productivity-title">
        <strong v-if="!headerTarget">Tasks</strong
        ><SegmentedControl
          :model-value="scope"
          label="Task scope"
          :disabled="busy"
          :options="[
            { value: 'personal', label: 'Personal' },
            { value: 'shared', label: 'Shared' },
          ]"
          @update:model-value="
            scope = $event as 'personal' | 'shared';
            subscribe();
          "
        />
      </div>
    </Teleport>
    <small v-if="view" aria-label="Task completion"
      >{{ view.tasks.filter((t) => t.completed).length }} / {{ view.tasks.length }} completed</small
    >
    <p v-if="!view">{{ realtime.state.errors['tasks.snapshot'] || 'Loading tasks…' }}</p>
    <template v-else
      ><ul class="task-list">
        <li v-for="(t, index) in view.tasks" :key="t.id" :class="{ 'task-completed': t.completed }">
          <input
            type="checkbox"
            :checked="t.completed"
            :disabled="!t.canEdit || busy"
            :aria-label="'Complete ' + t.title"
            @change="update(t, { completed: !t.completed })"
          />
          <input
            v-if="editing === t.id"
            v-model="editTitle"
            class="task-inline-input"
            aria-label="Edit task title"
            maxlength="300"
            :disabled="busy"
            @keydown.enter.prevent="finishEdit(t)"
            @blur="finishEdit(t)"
            @keydown.esc="editing = ''"
          />
          <button
            v-else-if="t.canEdit"
            class="task-text"
            :disabled="busy"
            :aria-label="'Edit task title: ' + t.title"
            @click="startEdit(t, $event)"
          >
            {{ t.title }}
          </button>
          <span v-else class="task-text">{{ t.title }}</span>
          <div v-if="t.canEdit" class="productivity-actions">
            <button
              :disabled="busy || index === 0"
              aria-label="Move task up"
              title="Move task up"
              @click="
                mutate('tasks.move', {
                  scope: target(),
                  id: t.id,
                  version: t.version,
                  direction: 'up',
                })
              "
            >
              <ArrowUp :size="15" aria-hidden="true" />
            </button>
            <button
              :disabled="busy || index === view.tasks.length - 1"
              aria-label="Move task down"
              title="Move task down"
              @click="
                mutate('tasks.move', {
                  scope: target(),
                  id: t.id,
                  version: t.version,
                  direction: 'down',
                })
              "
            >
              <ArrowDown :size="15" aria-hidden="true" />
            </button>
            <button
              class="task-delete"
              :disabled="busy"
              aria-label="Delete task"
              title="Delete task"
              @click="mutate('tasks.delete', { scope: target(), id: t.id, version: t.version })"
            >
              <Trash2 :size="15" aria-hidden="true" />
            </button>
          </div>
        </li>
      </ul>
      <small v-if="!view.tasks.length">No tasks yet.</small>
      <form
        class="task-create"
        @submit.prevent="mutate('tasks.create', { scope: target(), requestId: requestId(), title })"
      >
        <input
          v-model="title"
          aria-label="New task"
          placeholder="One small next step…"
          maxlength="300"
          required
          @keydown.esc="title = ''"
        /><button
          aria-label="Save new task"
          :disabled="busy || !title.trim() || view.tasks.length >= 200 || !realtime.state.connected"
        >
          <Check :size="18" aria-hidden="true" />
        </button>
      </form>
    </template>
    <p v-if="error" role="alert">{{ error }}</p>
  </div>
</template>

<style>
.productivity-title {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  justify-content: space-between;
}
.productivity-title .ui-segments {
  font-size: 11px;
  flex-shrink: 0;
}
.productivity-title .ui-segments button {
  min-height: 32px;
  padding: 6px 8px;
}
.task-create {
  position: relative;
  display: block !important;
  margin-top: var(--space-3);
}
.task-create input {
  padding-right: 44px !important;
}
.task-create button {
  position: absolute;
  right: 0;
  top: 0;
  width: 44px;
  height: 44px;
}
.productivity-panel:has(.task-list) {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  height: 100%;
  min-height: 0;
}
.productivity-panel .task-list {
  min-height: 0;
  flex: 1;
  max-height: none;
  margin: 0;
  overflow: auto;
}
.task-list li {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-2);
  min-height: 44px;
}
.task-list li > input[type='checkbox'] {
  width: 18px;
  height: 18px;
  margin: 0;
}
.task-list li .task-text {
  border: 0;
  background: transparent;
  padding: 4px 0;
  text-align: left;
  justify-content: flex-start;
  overflow-wrap: anywhere;
  min-width: 0;
}
.task-list li .task-inline-input {
  padding: 4px;
  margin: 0;
  min-height: 36px;
}
.task-list .productivity-actions {
  display: flex;
  flex-wrap: nowrap;
  gap: 0;
  margin: 0;
}
.task-list .productivity-actions button {
  width: 28px;
  height: 36px;
  min-height: 36px;
  padding: 4px;
  display: grid;
  place-items: center;
  border: 0;
  background: transparent;
}
.task-list button:is(:hover, :focus-visible) {
  background: var(--accent-subtle);
}
.task-list .productivity-actions {
  opacity: 0;
  transition: opacity var(--motion-micro);
}
.task-list li:is(:hover, :focus-within) .productivity-actions {
  opacity: 1;
}
.task-completed .task-text {
  text-decoration: line-through;
  color: var(--text-muted);
}
@media (hover: none) {
  .task-list li .productivity-actions {
    opacity: 1;
    grid-column: 2 / -1;
    justify-content: flex-end;
  }
  .task-list .productivity-actions button {
    width: 44px;
    height: 44px;
  }
}
</style>
