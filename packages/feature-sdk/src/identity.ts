import type { ErrorCode, Provider, SessionView } from '@study/contracts';
import type { Actor, Database } from './foundation.ts';

export interface ProviderIdentity {
  readonly provider: Provider;
  readonly issuer: string;
  readonly subject: string;
  readonly displayName: string;
}
export interface OAuthChallenge {
  readonly state: string;
  readonly verifier: string;
  readonly nonce: string;
  readonly reauthenticate: boolean;
}
export interface IdentityProvider {
  readonly id: Provider;
  authorizationUrl(challenge: OAuthChallenge): string;
  exchange(code: string, challenge: OAuthChallenge, signal: AbortSignal): Promise<ProviderIdentity>;
}
export interface SessionDirectory {
  /** Serialize new session issuance with erasure for an opaque subject. */
  withSubject<T>(subjectId: string, work: (db: Database) => Promise<T>): Promise<T>;
  list(actor: Actor): Promise<SessionView[]>;
  revokeOwned(actor: Actor, sessionId: string): Promise<void>;
  revokeOthers(actor: Actor): Promise<void>;
  revokeAll(actor: Actor): Promise<void>;
  activity(actor: Actor, label?: string): Promise<void>;
  requireRecent(actor: Actor): Promise<void>;
  markRecent(actor: Actor): Promise<void>;
  rename(actor: Actor, sessionId: string, name: string): Promise<void>;
  eraseAccount(actor: Actor, work: (db: Database) => Promise<void>): Promise<void>;
  withSession<T>(actor: Actor, work: (db: Database) => Promise<T>): Promise<T>;
}
export type Fail = (code: ErrorCode) => never;
