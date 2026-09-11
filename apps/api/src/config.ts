import { z } from '@study/contracts';

const postgresUrl = z
  .url()
  .refine((value) => ['postgres:', 'postgresql:'].includes(new URL(value).protocol));
const redisUrl = z.url().refine((value) => ['redis:', 'rediss:'].includes(new URL(value).protocol));
const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_ORIGIN: z.url().refine((value) => {
    const url = new URL(value);
    return url.protocol === 'https:' && url.origin === value && !url.username && !url.password;
  }),
  DATABASE_URL: postgresUrl,
  REDIS_URL: redisUrl,
  API_HOST: z.string().default('127.0.0.1'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  LOG_LEVEL: z.enum(['silent', 'fatal', 'error', 'warn', 'info', 'debug']).default('info'),
  WS_REVALIDATE_MS: z.coerce.number().int().min(20).max(60_000).default(5_000),
  INGRESS_LIMIT: z.coerce.number().int().min(1).max(100_000).default(300),
});
export type ApiConfig = z.infer<typeof configSchema>;
export function readConfig(environment: Record<string, string | undefined>): ApiConfig {
  const parsed = configSchema.safeParse(environment);
  if (!parsed.success)
    throw new Error(
      `Invalid configuration fields: ${parsed.error.issues.map((issue) => issue.path.join('.')).join(', ')}`,
    );
  return parsed.data;
}
