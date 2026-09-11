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
    headers: {
      permissionsPolicy: {
        camera: ['self'],
        microphone: ['self'],
        'display-capture': ['self'],
        autoplay: ['self'],
      },
      contentSecurityPolicy: {
        'frame-ancestors': ["'none'"],
        'img-src': ["'self'", 'data:', 'blob:'],
      },
      referrerPolicy: 'no-referrer',
    },
  },
  app: {
    head: {
      title: 'Study space',
      htmlAttrs: { lang: 'en' },
      meta: [{ name: 'description', content: 'A quiet place to focus, together.' }],
    },
  },
});
