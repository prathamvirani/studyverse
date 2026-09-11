import { csrfResponseSchema } from '@study/contracts';
import type { z } from '@study/contracts';

/** Per-client closure, never Nuxt SSR global state or a persisted browser store. */
export function createApiClient(fetcher: typeof fetch = fetch) {
  let csrf: string | undefined;
  return {
    async request<T>(path: `/api/v1/${string}`, schema: z.ZodType<T>, input?: unknown): Promise<T> {
      if (!path.startsWith('/api/v1/') || path.includes('://') || path.includes('\\'))
        throw new Error('Invalid API path');
      if (input !== undefined && !csrf) {
        const response = await fetcher('/api/v1/session/csrf', {
          credentials: 'same-origin',
          cache: 'no-store',
        });
        if (!response.ok) throw new Error('Authentication required');
        csrf = csrfResponseSchema.parse(await response.json()).csrfToken;
      }
      const response = await fetcher(path, {
        method: input === undefined ? 'GET' : 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        ...(input === undefined
          ? {}
          : {
              headers: { 'content-type': 'application/json', 'x-csrf-token': csrf! },
              body: JSON.stringify(input),
            }),
      });
      if (!response.ok) {
        if ([401, 403].includes(response.status)) csrf = undefined;
        throw new Error(`Request failed (${response.status})`);
      }
      return schema.parse(await response.json());
    },
    clear() {
      csrf = undefined;
    },
  };
}
