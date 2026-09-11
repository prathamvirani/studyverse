import { z } from '@study/contracts';
import { AppError } from '@study/core/server';
import type { Fail } from '@study/feature-sdk';

export const fail: Fail = (code) => {
  throw new AppError(code);
};

// Existing deployment keys remain supported; either explicit false disables the feature.
const legacyFlags: Readonly<Record<string, string>> = {
  IDENTITY_ROOMS_ENABLED: 'PHASE01_ENABLED',
  SOCIAL_ENABLED: 'PHASE03_ENABLED',
};
export function featureEnabled(
  environment: Record<string, string | undefined>,
  name: string,
  defaultValue = true,
): boolean {
  const parse = (value: string | undefined) =>
    z
      .enum(['true', 'false'])
      .default(defaultValue ? 'true' : 'false')
      .parse(value) === 'true';
  const enabled = parse(environment[name]);
  const legacy = legacyFlags[name];
  // Parse both values even when disabled: malformed configuration must fail startup.
  const legacyEnabled = legacy ? parse(environment[legacy]) : true;
  return enabled && legacyEnabled;
}
