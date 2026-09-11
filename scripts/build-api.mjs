import { build } from 'esbuild';
await build({
  entryPoints: { main: 'apps/api/src/main.ts', migrate: 'scripts/migrate.ts' },
  outdir: 'dist/api',
  outExtension: { '.js': '.mjs' },
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'esm',
  sourcemap: true,
  external: ['fastify', '@fastify/*', 'pg', 'redis', 'pino'],
});
