import { backgroundsModules } from '../apps/api/src/backgrounds.ts';
import { rtcModules } from '../apps/api/src/rtc.ts';
import { productivityModules } from '../apps/api/src/productivity.ts';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import {
  capabilitiesSchema,
  commandEnvelopeSchema,
  csrfResponseSchema,
  errorSchema,
  eventEnvelopeSchema,
  healthSchema,
  layoutSchema,
  resultEnvelopeSchema,
  z,
} from '@study/contracts';
import { foundationModule } from '../apps/api/src/foundation.ts';
import { READINESS_PATH } from '../apps/api/src/readiness.ts';
import { identityModules } from '../apps/api/src/identity.ts';
import { socialModules } from '../apps/api/src/social.ts';
import type { Database } from '@study/feature-sdk';

const schemas: Record<string, z.ZodType> = {
  Capabilities: capabilitiesSchema,
  Command: commandEnvelopeSchema,
  CsrfResponse: csrfResponseSchema,
  Error: errorSchema,
  Event: eventEnvelopeSchema,
  Health: healthSchema,
  TileLayout: layoutSchema,
  Result: resultEnvelopeSchema,
};
// Inspect actual registration declarations without starting services or invoking handlers.
const foundation = foundationModule(
  { capabilities: () => [] },
  {
    csrfFor: async () => {
      throw new Error('Documentation cannot access sessions');
    },
  },
  async () => ({ status: 'unavailable' }),
);
const paths: Record<string, Record<string, unknown>> = {};
const unavailable = async (): Promise<never> => {
  throw new Error('Documentation must not access services');
};
const inertDb: Database = { query: unavailable, transaction: unavailable };
for (const module of [
  foundation,
  ...productivityModules(inertDb),
  ...backgroundsModules(inertDb),
  ...rtcModules(inertDb, {
    create: unavailable,
    findById: unavailable,
    findByHash: unavailable,
    rotate: unavailable,
    revoke: unavailable,
    revokeSubject: unavailable,
  }),
  ...identityModules(inertDb, {}, 'https://localhost:8443'),
  ...socialModules(
    inertDb,
    { get: unavailable, set: unavailable, delete: unavailable },
    {
      create: unavailable,
      findById: unavailable,
      findByHash: unavailable,
      rotate: unavailable,
      revoke: unavailable,
      revokeSubject: unavailable,
    },
  ),
]) {
  for (const event of module.events ?? []) schemas[event.id] = event.schema;
  for (const operation of module.operations ?? []) {
    schemas[`${operation.id}.input`] = operation.input;
    schemas[`${operation.id}.response`] = operation.output;
  }
  for (const binding of module.http ?? []) {
    const operation = module.operations?.find((item) => item.id === binding.operation);
    if (!operation) throw new Error(`Undocumented operation: ${binding.operation}`);
    const input = z.toJSONSchema(operation.input, { target: 'draft-2020-12', io: 'input' });
    if (!['query', 'body'].includes(binding.input))
      throw new Error(`Extend the versioned API generator for ${binding.operation}`);
    const schema =
      Object.entries(schemas).find(([, schema]) => schema === operation.output)?.[0] ??
      `${operation.id}.response`;
    schemas[schema] = operation.output;
    schemas[`${operation.id}.input`] = operation.input;
    // Query unions retain each variant's fields; required means required in every variant.
    const queryVariants = (input.anyOf ?? input.oneOf ?? [input]) as {
      properties?: Record<string, unknown>;
      required?: string[];
    }[];
    const queryNames = [...new Set(queryVariants.flatMap((v) => Object.keys(v.properties ?? {})))];
    paths[binding.path] ??= {};
    paths[binding.path]![binding.method.toLowerCase()] = {
      operationId: operation.id,
      security: 'public' in operation.access ? [] : [{ browserSession: [] }],
      ...(binding.input === 'body'
        ? { requestBody: { required: true, content: { 'application/json': { schema: input } } } }
        : {}),
      parameters: [
        ...(binding.input === 'query'
          ? queryNames.map((name) => {
              const variants = queryVariants.flatMap((v) =>
                v.properties?.[name] ? [v.properties[name]] : [],
              );
              return {
                name,
                in: 'query',
                required: queryVariants.every((v) => v.required?.includes(name)),
                schema: variants.length === 1 ? variants[0] : { anyOf: variants },
              };
            })
          : []),
        ...(binding.method === 'POST'
          ? [
              {
                name: 'Origin',
                in: 'header',
                required: true,
                schema: { type: 'string', format: 'uri' },
              },
              {
                name: 'X-CSRF-Token',
                in: 'header',
                required: !('public' in operation.access),
                description: 'Required whenever a session cookie is present.',
                schema: { type: 'string' },
              },
            ]
          : []),
        ...(operation.kind === 'authentication'
          ? [
              {
                name: 'X-Study-Auth',
                in: 'header',
                required: true,
                schema: { type: 'string', const: '1' },
              },
            ]
          : []),
      ],
      responses: {
        '200': {
          description: 'Success',
          content: { 'application/json': { schema: { $ref: `#/components/schemas/${schema}` } } },
        },
        ...(binding.path === READINESS_PATH
          ? {
              '503': {
                description: 'Required dependencies unavailable or readiness deadline exceeded',
                content: {
                  'application/json': { schema: { $ref: '#/components/schemas/Health' } },
                },
              },
            }
          : {}),
        default: {
          description: 'Error',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
      },
    };
  }
}
const jsonSchemas = Object.fromEntries(
  Object.entries(schemas).map(([name, schema]) => [
    name,
    z.toJSONSchema(schema, { target: 'draft-2020-12', io: 'input' }),
  ]),
);
const artifacts = {
  'protocol-v1.schema.json': {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'urn:study:protocol:v1',
    $defs: jsonSchemas,
  },
  'openapi-v1.json': {
    openapi: '3.1.0',
    info: { title: 'Study API', version: '1.1.0' },
    paths,
    components: {
      schemas: jsonSchemas,
      securitySchemes: {
        browserSession: { type: 'apiKey', in: 'cookie', name: '__Host-study-session' },
      },
    },
  },
};
await mkdir('packages/contracts/generated', { recursive: true });
for (const [name, artifact] of Object.entries(artifacts)) {
  const path = `packages/contracts/generated/${name}`,
    content = `${JSON.stringify(artifact, null, 2)}\n`;
  if (process.argv.includes('--check')) {
    if ((await readFile(path, 'utf8')) !== content) throw new Error(`Contract drift: ${path}`);
  } else await writeFile(path, content);
}
console.log(
  process.argv.includes('--check')
    ? 'Versioned contracts match.'
    : 'Versioned contracts generated.',
);
