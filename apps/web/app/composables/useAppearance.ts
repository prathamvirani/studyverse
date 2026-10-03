import { createPreferenceStore } from '@study/adapters/indexeddb';
import {
  appearancePreference,
  layoutWidthPreference,
  glassTransparencyPreference,
  readPresentationPreference,
} from '../lib/appearance';
import type { Appearance, LayoutWidth, GlassTransparency } from '../lib/appearance';

export function useAppearance() {
  const options = {
    path: '/',
    sameSite: 'lax' as const,
    secure: true,
    maxAge: 60 * 60 * 24 * 365,
    watch: 'shallow' as const,
  };
  const appearanceCookie = useCookie<unknown>('study-appearance', options);
  const widthCookie = useCookie<unknown>('study-layout-width', options);
  const glassCookie = useCookie<unknown>('study-glass-transparency', options);
  const glass = useState<GlassTransparency>('app-glass-transparency', () =>
    readPresentationPreference(glassTransparencyPreference, glassCookie.value),
  );
  watch(glassCookie, (value) => {
    glass.value = readPresentationPreference(glassTransparencyPreference, value);
  });
  const appearance = useState<Appearance>(
    'app-appearance',
    () => readPresentationPreference(appearancePreference, appearanceCookie.value) as Appearance,
  );
  const width = useState<LayoutWidth>(
    'app-layout-width',
    () => readPresentationPreference(layoutWidthPreference, widthCookie.value) as LayoutWidth,
  );
  watch(appearanceCookie, (value) => {
    appearance.value = readPresentationPreference(appearancePreference, value) as Appearance;
  });
  watch(widthCookie, (value) => {
    width.value = readPresentationPreference(layoutWidthPreference, value) as LayoutWidth;
  });
  const storageNote = ref('');
  // Open the existing database lazily only after an explicit preference change.
  // SSR mirrors win on first paint: asynchronous storage must never flip a rendered theme.
  let pending = Promise.resolve();
  function persist() {
    const theme = appearance.value,
      layout = width.value,
      transparency = glass.value;
    appearanceCookie.value = { version: appearancePreference.version, value: theme };
    widthCookie.value = { version: layoutWidthPreference.version, value: layout };
    glassCookie.value = { version: glassTransparencyPreference.version, value: transparency };
    pending = pending
      .then(async () => {
        const store = await createPreferenceStore([
          appearancePreference,
          layoutWidthPreference,
          glassTransparencyPreference,
        ]);
        try {
          await store.set(appearancePreference, theme);
          await store.set(layoutWidthPreference, layout);
          await store.set(glassTransparencyPreference, transparency);
          storageNote.value =
            store.mode === 'memory'
              ? 'Device storage is unavailable. Preferences may not survive a restart.'
              : '';
        } finally {
          await store.close();
        }
      })
      .catch(() => {
        storageNote.value = 'Preferences could not be saved on this device.';
      });
  }
  function setAppearance(value: string) {
    appearance.value = appearancePreference.schema.parse(value);
    persist();
  }
  function setWidth(value: string) {
    width.value = layoutWidthPreference.schema.parse(value);
    persist();
  }
  function setGlass(value: GlassTransparency) {
    glass.value = glassTransparencyPreference.schema.parse(value);
    persist();
  }
  useHead(() => ({
    htmlAttrs: {
      'data-appearance': appearance.value,
      'data-layout-width': width.value,
      'data-glass-transparency': String(glass.value),
    },
  }));
  return { appearance, width, glass, setAppearance, setWidth, setGlass, storageNote };
}
