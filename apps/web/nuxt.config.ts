import { defineNuxtConfig } from 'nuxt/config';
import localFonts, { localFontAssetDirectory } from '../../infra/nuxt/local-font-provider.ts';

export default defineNuxtConfig({
  compatibilityDate: '2026-09-11',
  devtools: { enabled: false },
  telemetry: false,
  runtimeConfig: {
    public: { rtcQualityStage: 'basic', personalMediaEnabled: true, activitiesEnabled: true },
  },
  modules: ['nuxt-security', '@nuxt/fonts', '@nuxt/image', '@nuxt/icon', '@vueuse/nuxt'],
  fonts: {
    // Resolve only the pinned local packages; never contact a font service.
    providers: {
      google: false,
      googleicons: false,
      bunny: false,
      fontshare: false,
      fontsource: false,
      adobe: false,
      local: false,
      npm: false,
    },
    families: [
      {
        name: 'Inter Variable',
        provider: 'studyLocal',
        global: true,
        weights: ['100 900'],
        styles: ['normal'],
        preload: false,
      },
      {
        name: 'Instrument Serif',
        provider: 'studyLocal',
        global: true,
        weights: [400],
        styles: ['normal', 'italic'],
        subsets: ['latin'],
        preload: false,
      },
    ],
  },
  hooks: {
    'fonts:providers': (providers) => {
      providers.studyLocal = localFonts;
    },
  },
  image: { provider: 'ipx', domains: ['i.ytimg.com'] },
  nitro: {
    publicAssets: [{ dir: localFontAssetDirectory, baseURL: '/fonts', maxAge: 31536000 }],
  },
  icon: {
    componentName: 'NuxtIcon',
    mode: 'svg',
    provider: 'none',
    fallbackToApi: false,
    serverBundle: false,
    clientBundle: {
      scan: false,
      sizeLimitKb: 8,
      icons: [
        'lucide:house',
        'lucide:panels-top-left',
        'lucide:users-round',
        'lucide:compass',
        'lucide:star',
      ],
    },
  },
  css: ['@study/ui/styles/tokens.css', '@study/ui/styles/primitives.css'],
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
        autoplay: ['self', '"https://www.youtube.com"', '"https://player.vimeo.com"'],
        fullscreen: ['self', '"https://www.youtube.com"', '"https://player.vimeo.com"'],
        'encrypted-media': ['self', '"https://www.youtube.com"', '"https://player.vimeo.com"'],
        'picture-in-picture': ['self', '"https://www.youtube.com"', '"https://player.vimeo.com"'],
      },
      contentSecurityPolicy: {
        'frame-ancestors': ["'none'"],
        'img-src': ["'self'", 'data:', 'blob:', 'https://i.ytimg.com'],
        'frame-src': ['https://www.youtube.com', 'https://player.vimeo.com'],
        'connect-src': ["'self'", 'https://www.youtube.com'],
        'media-src': ["'self'", 'blob:'],
        'script-src': [
          "'self'",
          "'nonce-{{nonce}}'",
          "'strict-dynamic'",
          'https://www.youtube.com',
          'https://player.vimeo.com',
        ],
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
