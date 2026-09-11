import { openDB } from 'idb';
import type { LocalVisualStore, LocalVisualAsset } from '@study/feature-sdk';
/** Atomic per-account quota checks also serialize imports in competing tabs. */
export async function createLocalVisualStore(userId: string): Promise<LocalVisualStore> {
  const db = await openDB('study-local-visuals', 2, {
    async upgrade(db, oldVersion, _newVersion, tx) {
      if (oldVersion < 1) db.createObjectStore('assets');
      if (oldVersion < 2) {
        const metadata = db.createObjectStore('metadata');
        let cursor = await tx.objectStore('assets').openCursor();
        while (cursor) {
          const { frames: _, ...meta } = cursor.value as LocalVisualAsset;
          await metadata.put(meta, cursor.key);
          cursor = await cursor.continue();
        }
      }
    },
  });
  const key = (id: string) => `${userId}:${id}`;
  const owned = (key: IDBValidKey) => typeof key === 'string' && key.startsWith(userId + ':');
  return {
    async list() {
      const tx = db.transaction('metadata');
      const keys = await tx.store.getAllKeys();
      const items = await Promise.all(
        keys.filter(owned).map((k) => tx.store.get(k) as Promise<LocalVisualAsset>),
      );
      await tx.done;
      return items.map(({ frames: _, ...meta }) => meta);
    },
    async get(id) {
      const asset = (await db.get('assets', key(id))) as LocalVisualAsset | undefined;
      if (
        !asset ||
        asset.id !== id ||
        !Array.isArray(asset.frames) ||
        !Array.isArray(asset.durations) ||
        asset.frames.length < 1 ||
        asset.frames.length > 60 ||
        asset.frames.length !== asset.durations.length ||
        asset.frames.some((b) => !(b instanceof Blob) || b.type !== 'image/webp') ||
        !asset.durations.every((n) => Number.isFinite(n) && n >= 100 && n <= 5000) ||
        !Number.isFinite(asset.width) ||
        !Number.isFinite(asset.height) ||
        asset.width < 1 ||
        asset.height < 1 ||
        asset.width > 1920 ||
        asset.height > 1080 ||
        asset.frames.reduce((n, b) => n + b.size, 0) > 12 * 1024 * 1024
      )
        return undefined;
      return asset;
    },
    async put(asset) {
      if (
        !/^custom-[a-f0-9]{64}$/.test(asset.id) ||
        asset.frames.length < 1 ||
        asset.frames.length > 60 ||
        asset.frames.length !== asset.durations.length ||
        asset.frames.some((b) => b.type !== 'image/webp') ||
        asset.thumbnail.type !== 'image/webp'
      )
        throw new Error('Invalid sanitized asset');
      const bytes = asset.frames.reduce((n, b) => n + b.size, asset.thumbnail.size);
      if (bytes !== asset.bytes || bytes > 12 * 1024 * 1024)
        throw new Error('This image is too large after processing.');
      const tx = db.transaction(['assets', 'metadata'], 'readwrite');
      const metadata = tx.objectStore('metadata');
      const keys = (await metadata.getAllKeys()).filter(owned);
      const existing = await Promise.all(
        keys.map((k) => metadata.get(k) as Promise<LocalVisualAsset>),
      );
      const others = existing.filter((a) => a.id !== asset.id);
      if (others.length >= 8 || others.reduce((n, a) => n + a.bytes, bytes) > 32 * 1024 * 1024) {
        tx.abort();
        await tx.done.catch(() => {});
        throw new Error('Device library limit: 8 images / 32 MB. Remove an image first.');
      }
      await tx.objectStore('assets').put(asset, key(asset.id));
      const { frames: _, ...meta } = asset;
      await metadata.put(meta, key(asset.id));
      await tx.done;
    },
    async delete(id) {
      const tx = db.transaction(['assets', 'metadata'], 'readwrite');
      await tx.objectStore('assets').delete(key(id));
      await tx.objectStore('metadata').delete(key(id));
      await tx.done;
    },
    close() {
      db.close();
    },
  };
}
