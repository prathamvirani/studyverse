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
      /^@study\/adapters\/(postgres|redis)/.test(specifier) ||
      target.startsWith('apps/api/') ||
      /\/core\/src\/(?:server|sessions|security)\.ts$/.test(target))
  )
    errors.push('Server dependency in browser graph');
  if ((from.startsWith('apps/') || from.startsWith('packages/')) && target.startsWith('tests/'))
    errors.push('Production cannot import test modules');
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
  if (match[1] === 'adapters') return `${base}/src${suffix}/index.ts`;
  return `${base}/src/index.ts`;
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
        /^(?:pg|redis|fastify|ws)$/.test(specifier) ||
        (target &&
          (/packages\/adapters\/src\/(postgres|redis)\//.test(target) ||
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
