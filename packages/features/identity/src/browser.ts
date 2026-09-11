import type { UiContribution } from '@study/feature-sdk';
export const identityUi: readonly UiContribution<{ href: string }>[] = [
  {
    id: 'identity.account',
    point: 'profileSettings',
    label: 'Account & devices',
    order: 10,
    load: async () => ({ href: '/account' }),
  },
];
