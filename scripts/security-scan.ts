import { readFile } from 'node:fs/promises';
import { sourceFiles } from './source-files.ts';

const errors: string[] = [];
for (const path of await sourceFiles()) {
  const source = await readFile(path, 'utf8');
  // Supplemental source scan; CI also runs Gitleaks, CodeQL and npm audit.
  if (
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(source) ||
    /(?:AKIA|ASIA)[A-Z0-9]{16}/.test(source) ||
    /gh[pousr]_[A-Za-z0-9]{30,}/.test(source)
  )
    errors.push(`${path}: possible credential`);
  if (!/^(apps|packages)\//.test(path) || !/\.(?:ts|vue|mjs)$/.test(path)) continue;
  if (/\b(?:localStorage|sessionStorage)\b/.test(source))
    errors.push(`${path}: browser key/value storage is not an approved adapter`);
  if (/(?<![.\w])eval\s*\(|\b(?:new Function\s*\(|v-html\s*=|innerHTML\s*=)/.test(source))
    errors.push(`${path}: unsafe content execution/rendering`);
  if (/\bindexedDB\b/.test(source) && !path.startsWith('packages/adapters/src/indexeddb/'))
    errors.push(`${path}: use the preference adapter`);
  if (/from\s+['"]electron/.test(source)) errors.push(`${path}: Electron prohibited`);
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else console.log('Secret/source security checks passed.');
