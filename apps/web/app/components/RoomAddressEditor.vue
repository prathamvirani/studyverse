<script setup lang="ts">
import { roomSchema, roomSlugSchema, roomSlugAvailabilitySchema } from '@study/contracts';
import type { Room } from '@study/contracts';
import { CircleCheck, CircleX, LoaderCircle, OverlayPopover } from '@study/ui';
const props = defineProps<{ room: Room }>();
const emit = defineEmits<{ saved: [Room] }>();
const { api } = useAccount();
const id = useId();
const field = ref<HTMLElement>();
const slug = ref(props.room.slug ?? ''),
  savedSlug = ref(props.room.slug ?? '');
const available = ref(false),
  checking = ref(false),
  message = ref(''),
  busy = ref(false),
  help = ref(false);
const saved = computed(() => slug.value === savedSlug.value);
const savedConfirmation = useState(`room-address-saved.${props.room.id}`, () => false);
const status = computed(() =>
  savedConfirmation.value
    ? 'Saved'
    : busy.value
      ? 'Saving address'
      : checking.value
        ? 'Checking address'
        : available.value
          ? 'Availability: available'
          : saved.value
            ? ''
            : 'Availability: unavailable',
);
let timer: ReturnType<typeof setTimeout> | undefined,
  generation = 0;
watch(slug, (value) => {
  clearTimeout(timer);
  const current = ++generation;
  available.value = false;
  checking.value = false;
  message.value = '';
  help.value = false;
  savedConfirmation.value = false;
  if (saved.value) return;
  if (!value) {
    available.value = true;
    return;
  }
  const parsed = roomSlugSchema.safeParse(value);
  if (!parsed.success) {
    message.value =
      'Invalid address. Use 3–40 letters, numbers and single hyphens; start with a letter. Reserved names are unavailable.';
    help.value = true;
    return;
  }
  checking.value = true;
  timer = setTimeout(async () => {
    try {
      const result = await api.request(
        `/api/v1/rooms/slug-available?slug=${encodeURIComponent(parsed.data)}&roomId=${props.room.id}`,
        roomSlugAvailabilitySchema,
      );
      if (current !== generation) return;
      available.value = result.available;
      message.value = result.available ? '' : 'Address unavailable. Try another.';
      help.value = !result.available;
    } catch {
      if (current === generation) {
        message.value = 'Availability could not be checked. Try again.';
        help.value = true;
      }
    } finally {
      if (current === generation) checking.value = false;
    }
  }, 350);
});
onUnmounted(() => {
  generation++;
  clearTimeout(timer);
});
async function save() {
  if (busy.value || checking.value || !available.value || saved.value) return;
  const value = slug.value,
    current = ++generation;
  busy.value = true;
  message.value = '';
  help.value = false;
  try {
    const room = await api.request('/api/v1/rooms/slug', roomSchema, {
      roomId: props.room.id,
      version: props.room.version,
      slug: value ? roomSlugSchema.parse(value) : null,
    });
    if (current === generation) {
      savedSlug.value = room.slug ?? '';
      slug.value = savedSlug.value;
      savedConfirmation.value = true;
      emit('saved', room);
    }
  } catch {
    if (current === generation) {
      available.value = false;
      message.value = 'The address is unavailable or this room changed. Reload and try again.';
      help.value = true;
    }
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <form class="room-address form" @submit.prevent="save">
    <label :for="id">Room address (optional)</label>
    <div ref="field" class="room-address-field">
      <span class="room-address-prefix" aria-hidden="true">studyspace.my/rooms/</span>
      <input
        :id="id"
        v-model="slug"
        :readonly="busy"
        :aria-describedby="`${id}-status`"
        :aria-invalid="!saved && !checking && !!message"
        maxlength="40"
        autocomplete="off"
        autocapitalize="none"
        spellcheck="false"
      />
      <span v-if="!saved" class="room-address-status" :aria-label="status" :title="status">
        <LoaderCircle v-if="checking || busy" :size="19" class="checking" aria-hidden="true" />
        <CircleCheck v-else-if="available" :size="21" class="available" aria-hidden="true" />
        <CircleX v-else :size="21" class="unavailable" aria-hidden="true" />
      </span>
      <button
        v-if="!saved && available && !checking"
        type="submit"
        class="room-address-save"
        :disabled="busy"
        aria-label="Save room address"
        title="Save room address"
      >
        <CircleCheck :size="21" aria-hidden="true" />
      </button>
      <span v-if="savedConfirmation" class="room-address-saved">Saved</span>
    </div>
    <span :id="`${id}-status`" class="ui-sr-only" role="status">{{ status }}</span>
    <OverlayPopover v-model:open="help" :anchor="field" label="Room address validation">{{
      message
    }}</OverlayPopover>
  </form>
</template>
<style scoped>
.room-address-field {
  position: relative;
  display: flex;
  align-items: center;
  margin-top: var(--space-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  min-width: 0;
  overflow: hidden;
}
.room-address-prefix {
  padding-left: var(--space-3);
  padding-right: var(--space-3);
  flex-shrink: 0;
  user-select: none;
  color: var(--text-muted);
  font-size: 12px;
  white-space: nowrap;
}
.room-address-field input {
  margin: 0;
  flex: 1;
  width: 0;
  border: 0;
  background: transparent;
  padding-inline: 0 var(--space-2);
  border-radius: 0;
  box-shadow: none;
  min-height: 44px;
}
.room-address-field:focus-within {
  outline: 2px solid var(--focus-ring);
  outline-offset: 3px;
}
.room-address-field input:focus-visible {
  outline: none;
  box-shadow: none;
}
.room-address-status {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 6px;
  flex-shrink: 0;
  height: 44px;
  border: 0;
  background: transparent;
  color: var(--text-secondary);
}
.room-address-saved {
  color: var(--text-muted);
  font-size: 12px;
  opacity: 1;
  padding-inline: var(--space-3);
}
.room-address-save {
  flex-shrink: 0;
  min-width: 44px;
  min-height: 44px;
  padding: 8px;
  border: 0;
  background: transparent;
  color: var(--accent);
}
.unavailable {
  color: var(--danger);
}
.available {
  color: var(--success);
}
.checking {
  animation: address-checking 1s linear infinite;
}
@keyframes address-checking {
  to {
    transform: rotate(360deg);
  }
}
</style>
