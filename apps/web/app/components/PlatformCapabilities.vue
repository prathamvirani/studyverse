<script setup lang="ts">
import { platformCapabilities } from '../lib/platform-capabilities';
const capabilities = ref(platformCapabilities());
const ready = ref(false);
onMounted(() => {
  capabilities.value = platformCapabilities(window);
  ready.value = true;
});
</script>
<template>
  <section class="platform-capabilities" aria-label="Platform capabilities" :aria-busy="!ready">
    <h4>Browser & system capabilities</h4>
    <p>
      Availability on this browser. Permissions, installation and device support may add limits.
    </p>
    <dl v-if="ready">
      <div
        v-for="capability in capabilities"
        :key="capability.key"
        :data-capability="capability.key"
      >
        <dt>{{ capability.label }}</dt>
        <dd>
          <strong>{{ capability.status }}</strong
          ><span>{{ capability.detail }}</span>
        </dd>
      </div>
    </dl>
    <p v-else role="status">Checking browser capabilities…</p>
  </section>
</template>
<style scoped>
.platform-capabilities {
  margin-block: 20px;
}
h4 {
  margin-block: 0 8px;
}
p,
dd span {
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.5;
}
dl {
  margin: 16px 0;
}
dl > div {
  padding-block: 12px;
  border-top: 1px solid var(--border);
}
dt {
  font-weight: 600;
}
dd {
  margin: 6px 0 0;
}
dd strong {
  display: block;
  font-size: 12px;
}
dd span {
  display: block;
  margin-top: 4px;
}
</style>
