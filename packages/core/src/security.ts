import { AppError } from './errors.ts';

export interface RequestSecurity {
  readonly host: string | undefined;
  readonly origin: string | undefined;
  readonly fetchSite: string | undefined;
}
export function verifyRequestBoundary(
  headers: RequestSecurity,
  appOrigin: string,
  mutation: boolean,
): void {
  const allowed = new URL(appOrigin);
  if (headers.host?.toLowerCase() !== allowed.host.toLowerCase())
    throw new AppError('ORIGIN_REJECTED');
  if (headers.origin !== undefined && headers.origin !== allowed.origin)
    throw new AppError('ORIGIN_REJECTED');
  if (mutation && (headers.origin !== allowed.origin || headers.fetchSite === 'cross-site'))
    throw new AppError('ORIGIN_REJECTED');
}
