import type { UiContribution } from '@study/feature-sdk';
export const friendsUi: readonly UiContribution[] = [
  {
    id: 'friends.navigation',
    point: 'homeNavigation',
    order: 30,
    label: 'Friends',
    load: async () => ({ href: '/friends' }),
  },
];
