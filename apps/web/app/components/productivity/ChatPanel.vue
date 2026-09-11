<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { chatViewSchema } from '@study/contracts';
import type { z } from '@study/contracts';
import type { RealtimeClient } from '../../lib/realtime';
const requestId = () => crypto.randomUUID();
const props = defineProps<{ roomId: string; realtime: RealtimeClient }>();
const view = ref<z.infer<typeof chatViewSchema> | null>(null),
  text = ref(''),
  error = ref(''),
  busy = ref(false),
  before = ref<string | undefined>();
function subscribe() {
  props.realtime.subscribe(
    'chat.history',
    { roomId: props.roomId, ...(before.value ? { before: before.value } : {}) },
    (v) => {
      view.value = chatViewSchema.parse(v);
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
    if (command === 'chat.send') {
      text.value = '';
      before.value = undefined;
      subscribe();
    }
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    busy.value = false;
    props.realtime.refresh('chat.history');
  }
}
</script>
<template>
  <div class="productivity-panel">
    <small>Room chat · plain text</small>
    <div class="productivity-actions">
      <button
        v-if="view?.nextBefore"
        @click="
          before = view.nextBefore!;
          subscribe();
        "
      >
        Older messages</button
      ><button
        v-if="before"
        @click="
          before = undefined;
          subscribe();
        "
      >
        Latest messages
      </button>
    </div>
    <p v-if="!view">{{ realtime.state.errors['chat.history'] || 'Loading chat…' }}</p>
    <ol v-else class="chat-list" aria-label="Room messages">
      <li v-for="m in view.messages" :key="m.id">
        <strong>{{ m.authorName }}</strong>
        <time :datetime="m.createdAt">{{
          new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }}</time>
        <p>{{ m.deleted ? 'Message deleted' : m.text }}</p>
        <button
          v-if="m.canDelete && !m.deleted"
          :disabled="busy"
          :aria-label="'Delete message ' + m.sequence"
          @click="mutate('chat.delete', { roomId, id: m.id })"
        >
          Delete
        </button>
      </li>
    </ol>
    <small v-if="view && !view.messages.length">A quiet room. Say hello.</small>
    <form @submit.prevent="mutate('chat.send', { roomId, requestId: requestId(), text })">
      <textarea
        v-model="text"
        aria-label="Message"
        placeholder="Send a little encouragement…"
        maxlength="2000"
        rows="2"
        required
      ></textarea
      ><button :disabled="busy || !view || !text.trim()">Send</button>
    </form>
    <p v-if="error" role="alert">{{ error }}</p>
  </div>
</template>
