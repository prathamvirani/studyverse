<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { chatViewSchema } from '@study/contracts';
import { Send, Trash2 } from '@study/ui';
import type { z } from '@study/contracts';
import type { RealtimeClient } from '../../lib/realtime';
const requestId = () => crypto.randomUUID();
const props = defineProps<{ roomId: string; realtime: RealtimeClient }>();
const view = ref<z.infer<typeof chatViewSchema> | null>(null),
  text = ref(''),
  error = ref(''),
  busy = ref(false),
  before = ref<string | undefined>();
let unsubscribe: (() => void) | undefined;
const composing = ref<boolean>(false);
function send() {
  if (busy.value || !view.value || composing.value || !text.value.trim()) return;
  void mutate('chat.send', {
    roomId: props.roomId,
    requestId: requestId(),
    text: text.value.trim(),
  });
}
function composerKey(event: KeyboardEvent) {
  if (
    event.key !== 'Enter' ||
    event.shiftKey ||
    event.isComposing ||
    composing.value ||
    event.keyCode === 229
  )
    return;
  event.preventDefault();
  send();
}
onUnmounted(() => unsubscribe?.());
function subscribe() {
  unsubscribe?.();
  unsubscribe = props.realtime.subscribe(
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
  <div class="productivity-panel chat-panel">
    <small>Room chat · plain text</small>
    <div v-if="view?.nextBefore || before" class="productivity-actions">
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
    <div class="chat-history" tabindex="0" aria-label="Message history">
      <p v-if="!view">{{ realtime.state.errors['chat.history'] || 'Loading chat…' }}</p>
      <ol v-else class="chat-list" aria-label="Room messages">
        <li v-for="m in view.messages" :key="m.id" :class="{ 'chat-tombstone': m.deleted }">
          <strong>{{ m.authorName }}</strong>
          <time :datetime="m.createdAt">{{
            new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }}</time>
          <p>{{ m.deleted ? 'Message deleted' : m.text }}</p>
          <button
            v-if="m.canDelete && !m.deleted"
            :disabled="busy"
            class="chat-delete"
            aria-label="Delete message"
            title="Delete message"
            @click="mutate('chat.delete', { roomId, id: m.id })"
          >
            <Trash2 :size="15" aria-hidden="true" />
          </button>
        </li>
      </ol>
      <small v-if="view && !view.messages.length">A quiet room. Say hello.</small>
    </div>
    <form class="chat-composer" @submit.prevent="send">
      <textarea
        v-model="text"
        aria-label="Message"
        placeholder="Send a little encouragement…"
        maxlength="2000"
        rows="2"
        required
        @keydown="composerKey"
        @compositionstart="composing = true"
        @compositionend="composing = false"
      ></textarea
      ><button
        aria-label="Send message"
        title="Send message"
        :disabled="busy || !view || !text.trim()"
      >
        <Send :size="18" aria-hidden="true" />
      </button>
    </form>
    <p v-if="error" role="alert">{{ error }}</p>
  </div>
</template>
<style>
.chat-panel {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow: hidden;
}
.chat-panel > small,
.chat-panel > .productivity-actions {
  flex-shrink: 0;
}
.chat-history {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.chat-panel .chat-list {
  max-height: none;
  overflow: visible;
  margin: 0;
}
.chat-list li {
  position: relative;
  padding-right: 40px;
}
.chat-tombstone p {
  color: var(--text-muted);
  font-style: italic;
}
.chat-panel .chat-delete {
  position: absolute;
  right: 0;
  top: 4px;
  width: 36px;
  height: 36px;
  padding: 0;
  display: grid;
  place-items: center;
  border: 0;
  opacity: 0;
  transition: opacity var(--motion-micro);
}
.chat-list li:hover .chat-delete,
.chat-list li:focus-within .chat-delete {
  opacity: 1;
}
.chat-panel .chat-composer {
  position: relative;
  flex-shrink: 0;
  margin: 0;
  display: block;
}
.chat-panel .chat-composer textarea {
  display: block;
  height: 56px;
  min-height: 56px;
  max-height: 56px;
  resize: none;
  padding: 9px 48px 9px 10px;
  line-height: 1.4;
}
.chat-panel .chat-composer button {
  position: absolute;
  right: 3px;
  top: 6px;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 0;
  background: transparent;
  display: grid;
  place-items: center;
}
.chat-panel > [role='alert'] {
  flex-shrink: 0;
  max-height: 30px;
  overflow-y: auto;
  font-size: 11px;
}
@media (hover: none) {
  .chat-panel .chat-delete {
    opacity: 1;
  }
}
</style>
