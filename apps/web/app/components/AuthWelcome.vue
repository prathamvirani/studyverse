<script setup lang="ts">
import { GlassSurface } from '@study/ui';

const route = useRoute();
</script>

<template>
  <div class="auth-space">
    <div class="auth-atmosphere" aria-hidden="true" />

    <GlassSurface as="section" class="auth-card">
      <p class="eyebrow">Study Space</p>

      <h1>Your space to<br /><em>focus, together.</em></h1>

      <p>Settle in. A little progress feels better with company.</p>

      <p v-if="route.query.deleted === 'done'" role="status">Your account has been deleted.</p>

      <p v-if="route.query.deleted === 'local-cleanup'" role="alert">
        Your account has been deleted. This browser could not clear all local files; clear this
        site’s stored data in browser settings.
      </p>

      <SignIn />

      <p class="auth-note">Use your Google or Discord account to get started.</p>
    </GlassSurface>
  </div>
</template>

<style scoped>
.auth-space {
  position: relative;

  min-height: 72dvh;

  display: grid;

  place-items: center;

  padding: 32px 0;

  isolation: isolate;
}

.auth-card {
  width: min(100%, 440px);

  padding: clamp(24px, 5vw, 42px);
}

h1 {
  font-size: clamp(2.2rem, 5vw, 3rem);

  line-height: 1.12;

  letter-spacing: -0.04em;
}

h1 em {
  font-family: var(--font-display);

  font-weight: 400;
}

.auth-note {
  font-size: 0.78rem;

  margin: 24px 0 0;

  text-align: center;

  color: var(--text-muted);
}

.auth-atmosphere {
  position: absolute;
  inset: -10% 0;
  z-index: -1;
  background: radial-gradient(ellipse at center, var(--accent-subtle) 0%, transparent 65%);
  filter: blur(28px);
  pointer-events: none;
}
.eyebrow {
  font-size: 1.35rem;
  font-weight: 600;
  letter-spacing: -0.03em;
}
</style>
