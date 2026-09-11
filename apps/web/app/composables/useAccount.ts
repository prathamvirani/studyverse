import { okSchema, profileSchema } from '@study/contracts';
import type { z } from '@study/contracts';
import { createApiClient } from '../lib/api-client';

export function useAccount() {
  const profile = useState<z.infer<typeof profileSchema> | null>('account-profile', () => null);
  const api = createApiClient();
  async function load() {
    try {
      profile.value = await api.request('/api/v1/account/me', profileSchema);
    } catch {
      profile.value = null;
    }
    return profile.value;
  }
  async function renew() {
    // Credential renewal is a separate POST. Serialize across same-origin tabs where supported.
    const work = async () => {
      try {
        await api.authentication('/api/v1/account/refresh', okSchema, {});
      } catch {
        /* A concurrent rotation may have replaced the cookie. Recheck without replaying commands. */
      }
    };
    if (navigator.locks) await navigator.locks.request('study-session-renewal', work);
    else await work();
  }
  return { profile, api, load, renew };
}
