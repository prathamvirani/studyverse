import { defineNuxtConfig } from 'nuxt/config';

export default defineNuxtConfig({
  compatibilityDate: '2026-09-11',
  devtools: { enabled: false },
  telemetry: false,
  modules: ['nuxt-security'],
  typescript: { strict: true },
  security: {
    strict: true,
    nonce: true,
    // API mutations live in the separate service and use its mandatory session/CSRF pipeline.
    allowedMethodsRestricter: { methods: ['GET', 'HEAD'] },
    corsHandler: false,
    xssValidator: false,
    headers: { contentSecurityPolicy: { 'frame-ancestors': ["'none'"] } },
  },
  app: {
    head: {
      title: 'Study space',
      htmlAttrs: { lang: 'en' },
      meta: [{ name: 'description', content: 'A quiet place to focus, together.' }],
    },
  },
});
