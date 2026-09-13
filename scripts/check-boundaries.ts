import { readFile } from 'node:fs/promises';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { sourceFiles } from './source-files.ts';

const names: Record<string, string> = {
  contracts: 'packages/contracts',
  'feature-sdk': 'packages/feature-sdk',
  core: 'packages/core',
  adapters: 'packages/adapters',
  ui: 'packages/ui',
  api: 'apps/api',
  web: 'apps/web',
};
function owner(path: string): string {
  if (path.startsWith('packages/features/')) return path.split('/').slice(0, 3).join('/');
  return path.split('/').slice(0, 2).join('/');
}
export function importViolations(from: string, specifier: string): string[] {
  from = from.replaceAll('\\', '/');
  const current = owner(from),
    feature = current.startsWith('packages/features/');
  const publicPackage = /^@study\/([^/]+)(.*)$/.exec(specifier);
  const target = specifier.startsWith('.')
    ? relative(process.cwd(), resolve(dirname(from), specifier)).replaceAll('\\', '/')
    : publicPackage
      ? `${names[publicPackage[1]!] ?? `packages/features/${publicPackage[1]}`}${publicPackage[2]}`
      : '';
  const other = owner(target),
    errors: string[] = [];
  if (
    /^livekit(?:-client|-server-sdk)?$/.test(specifier) &&
    !from.startsWith('packages/adapters/src/livekit/') &&
    !from.startsWith('tests/')
  )
    errors.push('SFU SDK imports belong only in the provider adapter');
  if (
    target &&
    current !== other &&
    specifier.startsWith('.') &&
    !current.startsWith('tests/') &&
    !from.startsWith('scripts/')
  )
    errors.push('Cross-package relative import; use public exports');
  if (publicPackage && /\/(?:src|internal|dist)\//.test(publicPackage[2]!))
    errors.push('Private package entry point');
  if (current === 'packages/contracts' && target && other !== current)
    errors.push('Contracts cannot depend on other packages');
  if (
    current === 'packages/feature-sdk' &&
    target &&
    !['packages/contracts', current].includes(other)
  )
    errors.push('SDK dependency inversion');
  if (
    current === 'packages/core' &&
    target &&
    !['packages/contracts', 'packages/feature-sdk', current].includes(other)
  )
    errors.push('Core cannot import adapters, applications or features');
  if (feature && target && ![current, 'packages/contracts', 'packages/feature-sdk'].includes(other))
    errors.push('Features communicate only through public SDK/contracts');
  if (feature && /^(?:fastify|@fastify\/|ws$|pg$|redis$|node:http|node:https)/.test(specifier))
    errors.push('Features must use transport/persistence registries');
  const browser =
    current === 'apps/web' ||
    current === 'packages/ui' ||
    from.startsWith('packages/adapters/src/indexeddb/') ||
    from === 'packages/core/src/browser.ts';
  if (
    browser &&
    (specifier.startsWith('node:') ||
      /^(?:pg|redis|fastify|ws)$/.test(specifier) ||
      specifier === '@study/core' ||
      specifier === '@study/core/server' ||
      /^@study\/adapters\/(postgres|redis|livekit\/server)/.test(specifier) ||
      specifier === 'livekit-server-sdk' ||
      target.startsWith('apps/api/') ||
      /\/core\/src\/(?:server|sessions|security)\.ts$/.test(target))
  )
    errors.push('Server dependency in browser graph');
  if ((from.startsWith('apps/') || from.startsWith('packages/')) && target.startsWith('tests/'))
    errors.push('Production cannot import test modules');
  if (/^(apps|packages)\//.test(from) && /(?:^|\/)\w+[.-](?:fixture|test|spec)\./.test(target))
    errors.push('Production cannot import test fixtures');
  return errors;
}
export function importsFrom(
  source: string,
  filename: string,
): { specifier: string; dynamic: boolean }[] {
  const imports: { specifier: string; dynamic: boolean }[] = [];
  const code = filename.endsWith('.vue')
    ? [...source.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((match) => match[1]).join('\n')
    : source;
  const parsed = ts.createSourceFile(filename, code, ts.ScriptTarget.Latest, true);
  const visit = (node: ts.Node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    )
      imports.push({ specifier: node.moduleSpecifier.text, dynamic: false });
    if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
    ) {
      const argument = node.arguments[0];
      imports.push({
        specifier: argument && ts.isStringLiteral(argument) ? argument.text : '<computed>',
        dynamic: true,
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(parsed);
  return imports;
}
export async function checkBoundaries(): Promise<string[]> {
  const errors: string[] = [];
  const graph = new Map<string, string[]>();
  for (const path of await sourceFiles()) {
    if (!/\.(ts|mjs|vue)$/.test(path)) continue;
    const source = await readFile(path, 'utf8');
    graph.set(
      path,
      importsFrom(source, path).map((entry) => entry.specifier),
    );
    for (const entry of importsFrom(source, path)) {
      if (entry.specifier === '<computed>' && /^(apps|packages)\//.test(path))
        errors.push(`${path}: computed imports require a reviewed public adapter`);
      for (const violation of importViolations(path, entry.specifier))
        errors.push(`${path}: ${violation} (${entry.specifier})`);
    }
  }
  errors.push(...browserGraphViolations(graph));
  errors.push(...roomShellGraphViolations(graph));
  errors.push(...circularDependencies(graph));
  for (const path of graph.keys()) {
    if (!/^(apps|packages)\//.test(path)) continue;
    const source = await readFile(path, 'utf8');
    errors.push(...productionSourceViolations(path, source));
  }
  return errors;
}
function internalTarget(from: string, specifier: string): string | undefined {
  if (specifier.startsWith('.'))
    return relative(process.cwd(), resolve(dirname(from), specifier)).replaceAll('\\', '/');
  const match = /^@study\/([^/]+)(.*)$/.exec(specifier);
  if (!match) return undefined;
  const base = names[match[1]!] ?? `packages/features/${match[1]}`,
    suffix = match[2];
  if (suffix === '/browser' || suffix === '/server') return `${base}/src${suffix}.ts`;
  if (
    match[1] === 'adapters' &&
    (suffix?.startsWith('/livekit/') || suffix?.startsWith('/youtube/'))
  )
    return `${base}/src${suffix}.ts`;
  if (match[1] === 'adapters') return `${base}/src${suffix}/index.ts`;
  return `${base}/src/index.ts`;
}
function graphTarget(
  graph: ReadonlyMap<string, readonly string[]>,
  from: string,
  specifier: string,
) {
  const target = internalTarget(from, specifier);
  return (
    target &&
    [
      target,
      `${target}.ts`,
      `${target}.mjs`,
      `${target}.vue`,
      `${target}/index.ts`,
      target.replace(/\.(?:m?js)$/, '.ts'),
    ].find((candidate) => graph.has(candidate))
  );
}

/** Shell dependencies stay generic, including imports hidden behind local barrels. */
export function roomShellGraphViolations(graph: ReadonlyMap<string, readonly string[]>): string[] {
  const errors: string[] = [],
    visited = new Set<string>();
  const walk = (file: string) => {
    if (visited.has(file)) return;
    visited.add(file);
    for (const specifier of graph.get(file) ?? []) {
      const target = graphTarget(graph, file, specifier);
      if (
        target &&
        (/^packages\/features\//.test(target) ||
          /^apps\/web\/app\/(?:room|components\/(?:productivity|backgrounds))\//.test(target) ||
          /\/adapters\/src\/livekit\//.test(target))
      )
        errors.push(
          `${file}: RoomShell cannot depend on concrete feature composition (${specifier})`,
        );
      if (target) walk(target);
    }
  };
  walk('apps/web/app/components/room/RoomShell.vue');
  return errors;
}

export function circularDependencies(graph: ReadonlyMap<string, readonly string[]>): string[] {
  const done = new Set<string>(),
    active = new Set<string>(),
    stack: string[] = [],
    errors: string[] = [];
  const walk = (file: string) => {
    if (active.has(file)) {
      errors.push(
        `Circular dependency: ${[...stack.slice(stack.indexOf(file)), file].join(' -> ')}`,
      );
      return;
    }
    if (done.has(file)) return;
    active.add(file);
    stack.push(file);
    for (const specifier of graph.get(file) ?? []) {
      const target = graphTarget(graph, file, specifier);
      if (target && /^(apps|packages)\//.test(target)) walk(target);
    }
    stack.pop();
    active.delete(file);
    done.add(file);
  };
  for (const file of graph.keys()) if (/^(apps|packages)\//.test(file)) walk(file);
  return errors;
}

export function productionSourceViolations(path: string, source: string): string[] {
  const errors: string[] = [];
  // Compatibility names are exact, centralized deployment keys, never new implementation names.
  const normalized =
    path === 'apps/api/src/module-support.ts'
      ? source.replace(/'PHASE(?:01|03)_ENABLED'/g, "'legacy-key'")
      : source;
  if (/phase[ _-]?0[0-6]/i.test(path + '\n' + normalized))
    errors.push(`${path}: production phase-number naming`);
  const feature = /^packages\/features\/([^/]+)\/src\//.exec(path)?.[1];
  if (feature) {
    const parsed = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
    const visit = (node: ts.Node) => {
      if (ts.isTaggedTemplateExpression(node) && node.tag.getText(parsed) === 'sql') {
        const sqlText = ts.isNoSubstitutionTemplateLiteral(node.template)
          ? node.template.text
          : node.template.head.text +
            node.template.templateSpans.map((span) => ' ? ' + span.literal.text).join('');
        for (const match of sqlText.matchAll(/\b(?:FROM|JOIN|UPDATE|INTO|TABLE)\s+([a-z_]+)\./gi)) {
          if (match[1] !== feature.replaceAll('-', '_'))
            errors.push(`${path}: ${feature} queries private ${match[1]} tables`);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(parsed);
  }
  return errors;
}
/** Follow barrels so neutral-looking exports cannot smuggle server code into clients. */
export function browserGraphViolations(graph: ReadonlyMap<string, readonly string[]>): string[] {
  const errors: string[] = [],
    visited = new Set<string>();
  const walk = (file: string) => {
    if (visited.has(file)) return;
    visited.add(file);
    for (const specifier of graph.get(file) ?? []) {
      const unresolved = internalTarget(file, specifier);
      // Match TypeScript's common extensionless and emitted-JavaScript imports.
      const target =
        unresolved &&
        ([
          unresolved,
          `${unresolved}.ts`,
          `${unresolved}.mjs`,
          `${unresolved}.vue`,
          `${unresolved}/index.ts`,
          unresolved.replace(/\.(?:m?js)$/, '.ts'),
        ].find((candidate) => graph.has(candidate)) ??
          unresolved);
      if (
        specifier.startsWith('node:') ||
        /^(?:pg|redis|fastify|ws|livekit-server-sdk)$/.test(specifier) ||
        (target &&
          (/packages\/adapters\/src\/(postgres|redis)\//.test(target) ||
            target === 'packages/adapters/src/livekit/server.ts' ||
            /packages\/(?:core|features\/[^/]+)\/src\/server\.ts$/.test(target) ||
            target === 'packages/core/src/sessions.ts' ||
            target.startsWith('apps/api/')))
      )
        errors.push(`${file}: transitive server dependency in browser graph (${specifier})`);
      if (target) walk(target);
    }
  };
  for (const file of graph.keys())
    if (
      file.startsWith('apps/web/app/') ||
      file.startsWith('packages/ui/src/') ||
      file === 'packages/core/src/browser.ts' ||
      file.startsWith('packages/adapters/src/indexeddb/')
    )
      walk(file);
  return errors;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errors = await checkBoundaries();
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exitCode = 1;
  } else console.log('Architecture boundaries passed.');
}
