import { build } from 'esbuild';
import { parse, compileScript } from '@vue/compiler-sfc';
import { readFile } from 'node:fs/promises';
/** Test-only HTTP surface. Never imported by production composition or built into Nuxt. */
export async function rtcBundle(entry = 'tests/browser/rtc-fixture.ts') {
  const result = await build({
    entryPoints: [entry],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'browser',
    define: {
      'process.env.NODE_ENV': '"production"',
      __VUE_OPTIONS_API__: 'true',
      __VUE_PROD_DEVTOOLS__: 'false',
      __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false',
    },
    plugins: [
      {
        name: 'test-vue-sfc',
        setup(b) {
          b.onLoad({ filter: /\.vue$/ }, async (args) => {
            const { descriptor } = parse(await readFile(args.path, 'utf8'));
            const compiled = compileScript(descriptor, { id: 'test-sfc', inlineTemplate: true });
            return {
              contents:
                "import {ref,computed,watch,onMounted,onUnmounted,nextTick} from 'vue';\n" +
                compiled.content,
              loader: 'ts',
              resolveDir: args.path.replace(/[\\/][^\\/]+$/, ''),
            };
          });
        },
      },
    ],
  });
  return result.outputFiles[0]!.text;
}
