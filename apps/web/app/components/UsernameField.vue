<script setup lang="ts">
import { usernameProblem, normalizeUsername, usernameAvailabilitySchema } from '@study/contracts';
import { Check, X, LoaderCircle, OverlayPopover } from '@study/ui';
const props = defineProps<{ modelValue: string }>();
const emit = defineEmits<{ 'update:modelValue': [string]; valid: [boolean] }>();
const { api } = useAccount();
const id = useId(),
  message = ref(''),
  checking = ref(false),
  available = ref(false);
const field = ref<HTMLElement>(),
  statusButton = ref<HTMLButtonElement>(),
  detailsOpen = ref(false);
let generation = 0,
  timer: ReturnType<typeof setTimeout> | undefined;
watch(
  () => props.modelValue,
  (value) => {
    clearTimeout(timer);
    const current = ++generation;
    available.value = false;
    checking.value = false;
    emit('valid', false);
    const problem = usernameProblem(value);
    message.value = value ? (problem ?? '') : 'Choose a username you’ll be known by.';
    if (problem) return;
    checking.value = true;
    timer = setTimeout(async () => {
      try {
        const result = await api.request(
          `/api/v1/account/username-available?username=${encodeURIComponent(normalizeUsername(value))}`,
          usernameAvailabilitySchema,
        );
        if (current !== generation) return;
        available.value = result.available;
        emit('valid', result.available);
        message.value = result.available
          ? `@${normalizeUsername(value)} is available.`
          : 'This username is taken. Try another.';
      } catch {
        if (current === generation)
          message.value = 'Availability could not be checked. Please try again.';
      } finally {
        if (current === generation) checking.value = false;
      }
    }, 300);
  },
  { immediate: true },
);
onUnmounted(() => {
  generation++;
  clearTimeout(timer);
});
</script>
<template>
  <div class="username-field">
    <label :for="id">Username</label>
    <div ref="field" class="username-input">
      <span aria-hidden="true">@</span
      ><input
        :id="id"
        :value="modelValue"
        :aria-describedby="`${id}-help`"
        :aria-invalid="!!modelValue && !checking && !available && !!message"
        autocomplete="username"
        autocapitalize="none"
        spellcheck="false"
        maxlength="24"
        required
        @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      />
      <button
        ref="statusButton"
        type="button"
        class="username-status"
        :aria-label="checking ? 'Checking availability' : message"
        :aria-expanded="detailsOpen"
        @click="detailsOpen = !detailsOpen"
      >
        <LoaderCircle v-if="checking" :size="18" class="checking" />
        <Check v-else-if="available" :size="18" class="available" />
        <X v-else :size="18" />
      </button>
    </div>
    <span :id="`${id}-help`" class="ui-sr-only" aria-live="polite">
      {{ checking ? 'Checking availability…' : message }}
    </span>
    <OverlayPopover v-model:open="detailsOpen" :anchor="field" label="Username availability">
      {{ checking ? 'Checking availability…' : message }}
    </OverlayPopover>
    <small
      >3–24 characters. Start with a letter; use letters, numbers or underscores. Changes are
      limited to once every 7 days.</small
    >
  </div>
</template>
<style scoped>
.username-input {
  position: relative;
  display: flex;
  align-items: center;
}
.username-input > span {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
  pointer-events: none;
}
.username-input input {
  min-width: 0;
  flex: 1;
  padding-inline: 36px 48px;
  margin-top: 0;
}
.username-status {
  position: absolute;
  right: 2px;
  width: 44px;
  height: 44px;
  padding: 0;
  display: grid;
  place-items: center;
  color: var(--text-secondary);
  background: transparent;
  border: 0;
}
.available {
  color: var(--success);
}
.checking {
  animation: checking 1s linear infinite;
}
@keyframes checking {
  to {
    transform: rotate(360deg);
  }
}
p {
  font-size: 0.85rem;
  margin: 6px 0;
}
small {
  color: var(--text-muted);
  display: block;
  line-height: 1.5;
}
</style>
