import { createPreferenceStore, createLocalVisualStore } from '@study/adapters/indexeddb';
/** Called only after confirmed server erasure. Other accounts' custom images remain intact. */
export async function clearAccountLocal(userId: string) {
  for (const name of [
    'study-appearance',
    'study-layout-width',
    'study-glass-transparency',
    'study-room-grid',
  ])
    document.cookie = `${name}=; Max-Age=0; Path=/; Secure; SameSite=Lax`;
  const preferences = await createPreferenceStore([]);
  try {
    if (preferences.mode !== 'indexeddb') throw new Error('Local storage unavailable');
    await preferences.clear();
  } finally {
    await preferences.close();
  }
  const visuals = await createLocalVisualStore(userId);
  try {
    for (const item of await visuals.list()) await visuals.delete(item.id);
  } finally {
    visuals.close();
  }
}
