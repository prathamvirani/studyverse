import { randomBytes } from 'node:crypto';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

export async function prepareEnvironment() {
  await mkdir('.local', { recursive: true });
  if (process.platform === 'win32') {
    // Windows ignores POSIX modes. Protect only this repository's generated local
    // artifacts, including inherited access for its secrets, private keys and backups.
    const protectedDirectory = spawnSync(
      'powershell.exe',
      [
        '-NoLogo',
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `
      $ErrorActionPreference = 'Stop'
      $taskIdentity = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
      $taskAcl = [System.Security.AccessControl.DirectorySecurity]::new()
      $taskAcl.SetAccessRuleProtection($true, $false)
      $taskInheritance = [System.Security.AccessControl.InheritanceFlags]'ContainerInherit,ObjectInherit'
      foreach ($taskSid in @($taskIdentity, [System.Security.Principal.SecurityIdentifier]::new('S-1-5-18'), [System.Security.Principal.SecurityIdentifier]::new('S-1-5-32-544'))) {
        $taskRule = [System.Security.AccessControl.FileSystemAccessRule]::new($taskSid, 'FullControl', $taskInheritance, 'None', 'Allow')
        $taskAcl.AddAccessRule($taskRule)
      }
      Set-Acl -LiteralPath '.local' -AclObject $taskAcl
    `,
      ],
      {
        encoding: 'utf8',
        windowsHide: true,
        // Windows PowerShell must construct its own module path when launched from pwsh 7.
        env: Object.fromEntries(
          Object.entries(process.env).filter(([key]) => key.toUpperCase() !== 'PSMODULEPATH'),
        ),
      },
    );
    if (protectedDirectory.error || protectedDirectory.status !== 0)
      throw new Error(
        'Cannot restrict generated local secrets to the current Windows user, SYSTEM and administrators',
      );
  } else {
    await chmod('.local', 0o700);
  }
  const path = '.local/compose.env';
  try {
    if (process.platform !== 'win32') await chmod(path, 0o600);
    return await readFile(path, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const content =
    ['POSTGRES_PASSWORD', 'MIGRATION_PASSWORD', 'RUNTIME_PASSWORD', 'REDIS_PASSWORD']
      .map((key) => `${key}=${randomBytes(24).toString('hex')}`)
      .join('\n') + '\n';
  await writeFile(path, content, { mode: 0o600, flag: 'wx' });
  return content;
}
await prepareEnvironment();
const action = process.argv[2] ?? 'up';
const actions = {
  up: ['up', '--build', '--detach', '--wait', '--wait-timeout', '240'],
  down: ['down'],
  logs: ['logs', '--follow', '--tail', '100'],
  // Explicit command deletes only this Compose project's PostgreSQL and local CA volumes.
  reset: ['down', '--volumes'],
  config: ['config', '--quiet'],
  services: ['up', '--detach', '--wait', 'postgres', 'redis'],
};
if (!Object.hasOwn(actions, action)) throw new Error('Unknown development command');
const result = spawnSync(
  'docker',
  ['compose', '--env-file', '.local/compose.env', ...actions[action]],
  { stdio: 'inherit' },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
if (process.exitCode === 0 && action === 'up')
  console.log('Ready: https://localhost:8443. Trust the local CA as documented in README.md.');
