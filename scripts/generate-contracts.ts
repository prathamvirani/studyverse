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

const schemas = {
  Capabilities: capabilitiesSchema,
  Command: commandEnvelopeSchema,
  CsrfResponse: csrfResponseSchema,
  Error: errorSchema,
  Event: eventEnvelopeSchema,
  Health: healthSchema,
  TileLayout: layoutSchema,
  Result: resultEnvelopeSchema,
};
const jsonSchemas = Object.fromEntries(
  Object.entries(schemas).map(([name, schema]) => [
    name,
    z.toJSONSchema(schema, { target: 'draft-2020-12' }),
  ]),
);
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
for (const binding of foundation.http ?? []) {
  const operation = foundation.operations?.find((item) => item.id === binding.operation);
  if (!operation) throw new Error(`Undocumented operation: ${binding.operation}`);
  const input = z.toJSONSchema(operation.input, { target: 'draft-2020-12', io: 'input' });
  // Phase 00 exposes only empty-input foundation queries. New transports must extend
  // documentation deliberately; never silently omit a new request body or parameter.
  if (
    binding.method !== 'GET' ||
    binding.input !== 'query' ||
    Object.keys(input.properties ?? {}).length
  )
    throw new Error(`Extend the versioned API generator for ${binding.operation}`);
  const schema = Object.entries(schemas).find(([, schema]) => schema === operation.output)?.[0];
  if (!schema) throw new Error(`Missing shared response contract: ${binding.operation}`);
  paths[binding.path] ??= {};
  paths[binding.path]![binding.method.toLowerCase()] = {
    operationId: operation.id,
    security: 'public' in operation.access ? [] : [{ browserSession: [] }],
    responses: {
      '200': {
        description: 'Success',
        content: { 'application/json': { schema: { $ref: `#/components/schemas/${schema}` } } },
      },
      ...(binding.path === READINESS_PATH
        ? {
            '503': {
              description: 'Required dependencies unavailable or readiness deadline exceeded',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Health' } } },
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
const artifacts = {
  'protocol-v1.schema.json': {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'urn:study:protocol:v1',
    $defs: jsonSchemas,
  },
  'openapi-v1.json': {
    openapi: '3.1.0',
    info: { title: 'Study foundation API', version: '1.0.0' },
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
