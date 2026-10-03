import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
/** Versioned AES-GCM envelopes. The persistent key belongs to deployment secrets, outside SQL. */
export function inviteVault(key: string) {
  if (!/^[a-f0-9]{64}$/i.test(key))
    throw new Error('ROOM_INVITE_ENCRYPTION_KEY must contain 32 random bytes encoded as hex');
  const secret = Buffer.from(key, 'hex');
  return {
    seal(token: string, id: string) {
      const iv = randomBytes(12),
        cipher = createCipheriv('aes-256-gcm', secret, iv);
      cipher.setAAD(Buffer.from(id));
      const data = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
      return [
        'v1',
        iv.toString('base64url'),
        cipher.getAuthTag().toString('base64url'),
        data.toString('base64url'),
      ].join('.');
    },
    open(envelope: string, id: string) {
      const [version, iv, tag, data] = envelope.split('.');
      if (version !== 'v1' || !iv || !tag || !data) throw new Error('Invalid invite envelope');
      const cipher = createDecipheriv('aes-256-gcm', secret, Buffer.from(iv, 'base64url'));
      cipher.setAAD(Buffer.from(id));
      cipher.setAuthTag(Buffer.from(tag, 'base64url'));
      return Buffer.concat([
        cipher.update(Buffer.from(data, 'base64url')),
        cipher.final(),
      ]).toString('utf8');
    },
  };
}
