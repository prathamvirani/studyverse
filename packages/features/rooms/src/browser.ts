import type { UiContribution } from '@study/feature-sdk';
export const roomsUi: readonly UiContribution<{ href: string }>[] = [
  {
    id: 'rooms.mine',
    point: 'homeNavigation',
    label: 'My Rooms',
    order: 20,
    load: async () => ({ href: '/my-rooms' }),
  },
  {
    id: 'rooms.discover',
    point: 'homeNavigation',
    label: 'Discover',
    order: 30,
    load: async () => ({ href: '/discover' }),
  },
];
