import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

const ignored = new Set([
  'node_modules',
  '.git',
  '.nuxt',
  '.output',
  'dist',
  '.local',
  'coverage',
  'test-results',
  'playwright-report',
]);
export async function sourceFiles(directory = '.'): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name) || entry.isSymbolicLink()) continue;
    const path = join(directory, entry.name).replaceAll('\\', '/');
    if (entry.isDirectory()) files.push(...(await sourceFiles(path)));
    else if (/\.(?:ts|mjs|vue|json|yml|yaml|sql|sh|md)$/.test(entry.name)) files.push(path);
  }
  return files;
}
