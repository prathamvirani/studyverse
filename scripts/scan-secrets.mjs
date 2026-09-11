import { createHash } from 'node:crypto';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const checksums = {
  windows_x64: 'd29144deff3a68aa93ced33dddf84b7fdc26070add4aa0f4513094c8332afc4e',
  windows_arm64: 'b95f5e4f5c425cedca7ee203d9afd29597e692c4924a12ed42f970537c72cc0f',
  linux_x64: '551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb',
  linux_arm64: 'e4a487ee7ccd7d3a7f7ec08657610aa3606637dab924210b3aee62570fb4b080',
  darwin_x64: 'dfe101a4db2255fc85120ac7f3d25e4342c3c20cf749f2c20a18081af1952709',
  darwin_arm64: 'b40ab0ae55c505963e365f271a8d3846efbc170aa17f2607f13df610a9aeb6a5',
};
const platform = process.platform === 'win32' ? 'windows' : process.platform;
const key = `${platform}_${process.arch}`,
  expected = checksums[key];
if (!expected) throw new Error('Unsupported Gitleaks platform; install Gitleaks 8.30.1 manually.');
const filename = `gitleaks_8.30.1_${key}.${platform === 'windows' ? 'zip' : 'tar.gz'}`;
const directory = resolve('.local/tools/gitleaks-8.30.1'),
  archive = resolve(directory, filename);
await mkdir(directory, { recursive: true });
let contents;
try {
  contents = await readFile(archive);
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
if (!contents) {
  const response = await fetch(
    `https://github.com/gitleaks/gitleaks/releases/download/v8.30.1/${filename}`,
  );
  if (!response.ok) throw new Error('Gitleaks download failed');
  contents = Buffer.from(await response.arrayBuffer());
}
if (createHash('sha256').update(contents).digest('hex') !== expected)
  throw new Error('Gitleaks archive checksum mismatch');
await writeFile(archive, contents);
const executableName = platform === 'windows' ? 'gitleaks.exe' : 'gitleaks';
execFileSync('tar', ['-xf', archive, '-C', directory, executableName]);
const executable = resolve(directory, executableName);
if (platform !== 'windows') await chmod(executable, 0o755);
try {
  execFileSync(
    executable,
    [
      'dir',
      '.',
      '--redact',
      '--no-banner',
      '--config',
      '.gitleaks.toml',
      '--max-target-megabytes',
      '2',
    ],
    { stdio: 'inherit' },
  );
} catch (error) {
  process.exitCode = error.status ?? 1;
}
