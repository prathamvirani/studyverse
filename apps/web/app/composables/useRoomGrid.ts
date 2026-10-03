import { createPreferenceStore } from '@study/adapters/indexeddb';
import { z } from '@study/contracts';
import { readPresentationPreference } from '../lib/appearance';
const definition = {
  key: 'app.room-grid',
  version: 1,
  defaultValue: 'auto',
  schema: z.enum(['auto', '1', '2', '3', '4', '5', '6', '7', '8']),
};
export function useRoomGrid() {
  const cookie = useCookie<unknown>('study-room-grid', {
    path: '/',
    sameSite: 'lax',
    secure: true,
    maxAge: 31536000,
  });
  const columns = useState('room-grid-columns', () =>
    readPresentationPreference(definition, cookie.value),
  );
  const storageNote = ref('');
  let pending = Promise.resolve();
  function save(value: string) {
    const parsed = definition.schema.parse(value);
    columns.value = parsed;
    cookie.value = { version: 1, value: parsed };
    pending = pending
      .then(async () => {
        const store = await createPreferenceStore([definition]);
        try {
          await store.set(definition, parsed);
          storageNote.value =
            store.mode === 'memory' ? 'Grid preference may not survive a restart.' : '';
        } finally {
          await store.close();
        }
      })
      .catch(() => {
        storageNote.value = 'Grid preference could not be saved on this device.';
      });
  }
  return { columns, save, storageNote };
}
