/** Root tsc checks controller tests; Nuxt vue-tsc checks the actual SFCs and their props. */
declare module '*.vue' {
  import type { Component } from 'vue';
  const component: Component;
  export default component;
}
