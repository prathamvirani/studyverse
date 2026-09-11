import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { createHash, X509Certificate } from 'node:crypto';
// Only the isolated test harness uses this certificate. Never changes system trust.
export function browserTls() {
  mkdirSync('.local/browser-tls', { recursive: true });
  const keyPath = '.local/browser-tls/key.pem',
    certPath = '.local/browser-tls/cert.pem';
  if (
    !existsSync(keyPath) ||
    !existsSync(certPath) ||
    new Date(new X509Certificate(readFileSync(certPath)).validTo).getTime() <= Date.now()
  ) {
    execFileSync(
      process.platform === 'win32' ? 'C:/Program Files/Git/usr/bin/openssl.exe' : 'openssl',
      [
        'req',
        '-x509',
        '-newkey',
        'rsa:2048',
        '-nodes',
        '-keyout',
        keyPath,
        '-out',
        certPath,
        '-days',
        '2',
        '-subj',
        '/CN=localhost',
        '-addext',
        'subjectAltName=DNS:localhost',
      ],
      { stdio: 'ignore', windowsHide: true },
    );
  }
  const spki = createHash('sha256')
    .update(
      new X509Certificate(readFileSync(certPath)).publicKey.export({ type: 'spki', format: 'der' }),
    )
    .digest('base64');
  return { keyPath, certPath, spki };
}
