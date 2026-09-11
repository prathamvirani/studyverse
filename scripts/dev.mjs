import { randomBytes } from 'node:crypto';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

export async function prepareEnvironment() {
  await mkdir('.local', { recursive: true });
  if (process.platform === 'win32') {
    // Windows ignores POSIX modes. Protect only this repository's generated local
    // artifacts, including inherited access for its secrets, private keys and backups.
    const protectedDirectory = spawnSync(
      spawnSync('pwsh.exe', ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.Major'], {
        windowsHide: true,
      }).status === 0
        ? 'pwsh.exe'
        : 'powershell.exe',
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
      $taskCurrent = Get-Acl -LiteralPath '.local'
      $taskExpected = @($taskIdentity.Value, 'S-1-5-18', 'S-1-5-32-544') | Sort-Object
      $taskRules = @($taskCurrent.GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier]))
      $taskActual = @($taskRules | ForEach-Object { $_.IdentityReference.Value }) | Sort-Object
      $taskSecure = $taskCurrent.AreAccessRulesProtected -and $taskRules.Count -eq 3 -and -not (Compare-Object $taskExpected $taskActual)
      foreach ($taskExisting in $taskRules) {
        $taskSecure = $taskSecure -and $taskExisting.AccessControlType -eq 'Allow' -and $taskExisting.FileSystemRights -eq 'FullControl' -and $taskExisting.InheritanceFlags -eq $taskInheritance
      }
      if (-not $taskSecure) { Set-Acl -LiteralPath '.local' -AclObject $taskAcl }
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
        'Cannot restrict generated local secrets to the current Windows user, SYSTEM and administrators: ' +
          protectedDirectory.stderr,
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
const environment = await prepareEnvironment();
const values = Object.fromEntries(
  environment
    .trim()
    .split(/\r?\n/)
    .map((line) => line.split('=')),
);
let additions = '';
for (const key of ['LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET']) {
  if (!values[key]) {
    values[key] = randomBytes(32).toString('hex');
    additions += `${key}=${values[key]}\n`;
  }
}
if (additions)
  await writeFile('.local/compose.env', environment.trimEnd() + '\n' + additions, { mode: 0o600 });
await writeFile(
  '.local/livekit.yaml',
  `port: 7880
bind_addresses: ["0.0.0.0"]
prometheus_port: 6789
rtc:
  tcp_port: 7881
  udp_port: 7882
  node_ip: 127.0.0.1
  use_external_ip: false
  advertise_internal_ip: true
room:
  auto_create: true
  empty_timeout: 60
  max_participants: 32
keys:
  ${values.LIVEKIT_API_KEY}: ${values.LIVEKIT_API_SECRET}
turn:
  enabled: true
  domain: localhost
  udp_port: 3478
logging:
  level: warn
`,
  { mode: 0o600 },
);
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
if (action === 'up') {
  // Apply generated provider configuration before the API resets its ephemeral media namespace.
  const media = spawnSync(
    'docker',
    [
      'compose',
      '--env-file',
      '.local/compose.env',
      'up',
      '--detach',
      '--wait',
      '--force-recreate',
      'livekit',
    ],
    { stdio: 'inherit', windowsHide: true },
  );
  if (media.error) throw media.error;
  if (media.status !== 0) throw new Error('Local SFU did not become ready');
}
const result = spawnSync(
  'docker',
  ['compose', '--env-file', '.local/compose.env', ...actions[action]],
  { stdio: 'inherit', windowsHide: true },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
if (process.exitCode === 0 && action === 'up') {
  // Caddy's admin API is disabled. Recreate only the proxy to apply its mounted config.
  const proxy = spawnSync(
    'docker',
    [
      'compose',
      '--env-file',
      '.local/compose.env',
      'up',
      '--no-deps',
      '--force-recreate',
      '--detach',
      '--wait',
      'proxy',
    ],
    { stdio: 'inherit', windowsHide: true },
  );
  if (proxy.error) throw proxy.error;
  if (proxy.status !== 0) throw new Error('Development HTTPS proxy did not become ready');
  console.log('Ready: https://localhost:8443. Trust the local CA as documented in README.md.');
}
