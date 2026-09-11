import type { ExtensionPoint, TileLayout, z } from '@study/contracts';

export type Dispose = () => void;
export interface Actor {
  readonly subjectId: string;
  readonly sessionId: string;
}
export interface Resource {
  readonly id: string;
  readonly scopeId?: string;
  readonly ownerId?: string;
}
export interface Observer {
  record(name: string, fields?: Readonly<Record<string, string | number | boolean>>): void;
  measure(name: string, value: number, labels?: Readonly<Record<string, string>>): void;
}
export interface OperationContext {
  /** Transport-owned identity; never accepted from a payload. */
  readonly connectionId?: string;
  readonly actor: Actor | null;
  readonly requestId: string;
  readonly signal: AbortSignal;
  /** Present only on registered POST authentication operations; never serialized. */
  readonly browser?: BrowserAuthentication;
}
export interface BrowserAuthentication {
  readonly flowToken: string | undefined;
  readonly deviceLabel: string;
  setFlowToken(token: string | null): void;
  issueSession(subjectId: string): Promise<string>;
  refreshSession(): Promise<void>;
  clearSession(): void;
}
export interface AuthorizedContext extends OperationContext {
  readonly resource: Resource | null;
}
export interface PermissionDefinition {
  readonly id: string;
  readonly description: string;
  /** Must resolve current relationships on the server; no cached client role claims. */
  readonly allows: (actor: Actor, resource: Resource) => Promise<boolean>;
}
export interface RatePolicy {
  readonly limit: number;
  readonly windowMs: number;
}
export interface RateLimiter {
  consume(key: string, policy: RatePolicy): Promise<boolean>;
}
export type Access<I> =
  | { readonly public: true }
  | {
      readonly permission: string;
      readonly resource: (input: I, context: OperationContext) => Promise<Resource | null>;
    };
export interface OperationContract<I, O> {
  readonly id: string;
  readonly kind: 'query' | 'command' | 'authentication';
  readonly input: z.ZodType<I>;
  readonly output: z.ZodType<O>;
}
export interface OperationSpec<I, O> extends OperationContract<I, O> {
  readonly access: Access<I>;
  readonly rate: RatePolicy;
  readonly flag?: string;
  readonly handle: (input: I, context: AuthorizedContext) => Promise<O>;
}
export type RegisteredOperation = OperationSpec<unknown, unknown>;
/** Erase only at the registry boundary; module handlers retain inferred input/output types. */
export function defineOperation<I, O>(spec: OperationSpec<I, O>): RegisteredOperation {
  return {
    ...spec,
    access:
      'public' in spec.access
        ? spec.access
        : {
            permission: spec.access.permission,
            resource: (input, context) => {
              if ('public' in spec.access) throw new Error('Invalid operation access');
              return spec.access.resource(spec.input.parse(input), context);
            },
          },
    handle: (input, context) => spec.handle(spec.input.parse(input), context),
  };
}
export interface HttpBinding {
  readonly method: 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  readonly path: `/api/v1/${string}`;
  readonly operation: string;
  /** Sources remain separate; attacker body fields cannot overwrite URL parameters. */
  readonly input: 'body' | 'query' | 'params' | 'parts';
}
export interface RealtimeBinding {
  readonly command: string;
  readonly operation: string;
  /** A query snapshot, reauthorized before each delivery. */
  readonly snapshotEvent?: string;
}
export interface EventDefinition<T = unknown> {
  readonly id: string;
  readonly schema: z.ZodType<T>;
}
export interface EventPublisher {
  emit<T>(definition: EventDefinition<T>, payload: T): Promise<void>;
}
export interface EventSubscription {
  readonly event: string;
  readonly handle: (payload: unknown, signal: AbortSignal) => Promise<void>;
}
export type FlagRule =
  | { readonly mode: 'disabled' | 'global' | 'development' }
  | { readonly mode: 'cohort'; readonly subjects: readonly string[] }
  | { readonly mode: 'scope'; readonly scopes: readonly string[] };
export interface FlagDefinition {
  readonly id: string;
  readonly rule: FlagRule;
}
export interface Migration {
  readonly owner: string;
  readonly id: string;
  readonly sql: string;
}
export interface LifecycleContext {
  readonly signal: AbortSignal;
  readonly events: EventPublisher;
  readonly observer: Observer;
}
export interface BackgroundJob {
  readonly id: string;
  readonly run: (context: LifecycleContext) => Promise<void>;
}
export interface UiContribution<Renderer = unknown> {
  readonly id: string;
  readonly point: ExtensionPoint;
  readonly order: number;
  readonly label: string;
  readonly permission?: string;
  readonly load: () => Promise<Renderer>;
}
export interface TileDefinition<Renderer = unknown> {
  readonly type: string;
  readonly label: string;
  readonly load: () => Promise<Renderer>;
  readonly minimumSize: { readonly width: number; readonly height: number };
  readonly defaultSize: { readonly width: number; readonly height: number };
  readonly resizable: boolean;
  readonly fullscreenable: boolean;
  readonly permission?: string;
  readonly layoutSchema: z.ZodType<TileLayout>;
  readonly onOpen?: (instanceId: string) => void;
  readonly onClose?: (instanceId: string) => void;
  /** Local view lifecycle, never an authorization decision. */
  readonly onLayoutChange?: (instanceId: string, layout: TileLayout) => void;
  /** Opt out for ephemeral resources such as a mock/live camera. */
  readonly persist?: boolean;
}
export interface FeatureModule {
  readonly connectionClosed?: (connectionId: string) => Promise<void>;
  readonly id: string;
  readonly version: string;
  readonly required?: boolean;
  readonly dependencies?: readonly {
    readonly id: string;
    readonly major: number;
    readonly optional?: boolean;
  }[];
  readonly capabilities?: readonly string[];
  readonly permissions?: readonly PermissionDefinition[];
  readonly operations?: readonly RegisteredOperation[];
  readonly http?: readonly HttpBinding[];
  readonly realtime?: readonly RealtimeBinding[];
  readonly events?: readonly EventDefinition[];
  readonly subscriptions?: readonly EventSubscription[];
  readonly persistence?: {
    readonly durableSchema?: string;
    readonly ephemeralNamespace?: string;
    readonly localNamespace?: string;
  };
  readonly migrations?: readonly Migration[];
  readonly settings?: z.ZodType;
  readonly flags?: readonly FlagDefinition[];
  readonly ui?: readonly UiContribution[];
  readonly tiles?: readonly TileDefinition[];
  readonly jobs?: readonly BackgroundJob[];
  readonly start?: (context: LifecycleContext) => Promise<void>;
  readonly stop?: (context: LifecycleContext) => Promise<void>;
}
export interface SessionRecord {
  readonly id: string;
  readonly tokenHash: string;
  readonly subjectId: string;
  readonly csrfToken: string;
  readonly createdAt: number;
  readonly expiresAt: number;
  readonly idleExpiresAt: number;
  readonly revokedAt: number | null;
}
export interface SessionStore {
  create(session: SessionRecord): Promise<void>;
  findByHash(hash: string): Promise<SessionRecord | null>;
  findById(id: string): Promise<SessionRecord | null>;
  /** Atomically replace a credential while preserving the logical session ID. */
  rotate(oldHash: string, replacement: SessionRecord, now: number): Promise<boolean>;
  revoke(id: string, now: number): Promise<void>;
  revokeSubject(subjectId: string, now: number): Promise<void>;
}
export interface EphemeralStore {
  get(namespace: string, key: string): Promise<string | null>;
  set(namespace: string, key: string, value: string, ttlMs: number): Promise<void>;
  delete(namespace: string, key: string): Promise<void>;
}
export interface PreferenceDefinition<T> {
  readonly key: string;
  readonly version: number;
  readonly schema: z.ZodType<T>;
  readonly defaultValue: T;
  /** Migration is local only; old records never upload themselves. */
  readonly migrate?: (value: unknown, previousVersion: number) => T;
}
export interface PreferenceStore {
  get<T>(definition: PreferenceDefinition<T>): Promise<T>;
  set<T>(definition: PreferenceDefinition<T>, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  close(): Promise<void>;
}
export interface SqlStatement {
  readonly text: string;
  readonly values: readonly unknown[];
}
/** Core-owned SQL construction contract; features never need a database driver import. */
export function sql(parts: TemplateStringsArray, ...values: unknown[]): SqlStatement {
  return {
    text: parts.reduce((text, part, index) => text + (index ? `$${index}` : '') + part, ''),
    values,
  };
}
export interface Database {
  query<T extends Record<string, unknown>>(statement: SqlStatement): Promise<T[]>;
  transaction<T>(work: (database: Database) => Promise<T>): Promise<T>;
}
