import { createHash } from 'node:crypto';
import { mkdir, readFile, copyFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import { defineFontProvider } from '@nuxt/fonts/utils';
import type { FontFaceData } from '@nuxt/fonts';

const require = createRequire(import.meta.url);
const families = new Map<string, FontFaceData[]>();
export const localFontAssetDirectory = fileURLToPath(
  new URL('../../apps/web/node_modules/.cache/study-fonts/', import.meta.url),
);
// Register an existing directory before Nitro initialization, including on a
// cold Docker build. Provider setup later fills it before assets are copied.
mkdirSync(localFontAssetDirectory, { recursive: true });

// The module's npm provider assumes unhoisted packages and rewrites local URLs
// to a CDN. Resolve our pinned workspace packages without either assumption.
export default defineFontProvider({
  async setup() {
    families.clear();
    // Nuxt clears buildDir after module setup, so generated public assets live
    // in a separate ignored package cache and are copied by Nitro.
    const dir = localFontAssetDirectory;
    await mkdir(dir, { recursive: true });
    for (const entry of [
      '@fontsource-variable/inter/index.css',
      '@fontsource/instrument-serif/latin-400.css',
      '@fontsource/instrument-serif/latin-400-italic.css',
    ]) {
      const cssPath = require.resolve(entry);
      const css = await readFile(cssPath, 'utf8');
      for (const match of css.matchAll(/@font-face\s*\{([^}]+)\}/g)) {
        const block = match[1]!;
        const value = (property: string) =>
          block.match(new RegExp(`${property}:\\s*([^;]+);`))?.[1]?.trim();
        const family = value('font-family')?.replaceAll("'", '');
        const filename = block.match(/url\(\.\/files\/([\w-]+\.woff2)\)/)?.[1];
        if (!family || !filename) throw new Error(`Unsupported pinned font CSS: ${entry}`);
        const source = join(dirname(cssPath), 'files', filename);
        const digest = createHash('sha256')
          .update(await readFile(source))
          .digest('hex')
          .slice(0, 16);
        const asset = `${digest}-${filename}`;
        await copyFile(source, join(dir, asset));
        const fonts = families.get(family) ?? [];
        fonts.push({
          src: [{ url: `/fonts/${asset}`, format: 'woff2' }],
          weight: value('font-weight') ?? '400',
          style: value('font-style') ?? 'normal',
          display: 'swap',
          ...(value('unicode-range') ? { unicodeRange: value('unicode-range')!.split(',') } : {}),
        });
        families.set(family, fonts);
      }
    }
  },
  resolveFontFaces(family) {
    const fonts = families.get(family);
    return fonts ? { fonts } : undefined;
  },
});
