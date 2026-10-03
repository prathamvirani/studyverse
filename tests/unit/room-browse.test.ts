import { expect, it } from 'vitest';
import { roomOrigin, memberLabel, titleCase } from '../../apps/web/app/lib/room-navigation.ts';
import { roomBrowseInputSchema, friendSearchInputSchema } from '@study/contracts';
it('room navigation accepts only browse origins and bounded query state', () => {
  expect(roomOrigin('/discover?search=math&sort=largest&filter=friends&columns=3')).toBe(
    '/discover?search=math&sort=largest&filter=friends&columns=3',
  );
  for (const bad of [
    'https://evil.test',
    '//evil.test',
    '/\\evil.test',
    '/%2f%2fevil.test',
    '/account',
    '/rooms/new',
    null,
    ['/home'],
  ])
    expect(roomOrigin(bad)).toBe('/my-rooms');
  expect(roomOrigin('/friends?token=secret#fragment')).toBe('/friends');
  expect(roomOrigin('/home')).toBe('/home');
});
it('room metadata has explicit counts and title-case enums', () => {
  expect(memberLabel(1)).toBe('1 member');
  expect(memberLabel(0)).toBe('0 members');
  expect(memberLabel(2)).toBe('2 members');
  for (const value of ['public', 'private', 'unlisted', 'owner', 'moderator', 'member'])
    expect(titleCase(value)[0]).toBe(value[0]!.toUpperCase());
});
it('browse and exact friend search inputs reject unsupported metrics and enumeration patterns', () => {
  expect(roomBrowseInputSchema.parse({}).sort).toBe('recommended');
  for (const input of [
    { sort: 'recently-active' },
    { cursor: '-1' },
    { minMembers: '1e4' },
    { scope: 'private' },
    { role: 'owner' },
  ])
    expect(roomBrowseInputSchema.safeParse(input).success).toBe(false);
  for (const username of ['ab', 'bob%', 'bob*', '00000000-0000-4000-8000-000000000000'])
    expect(friendSearchInputSchema.safeParse({ username }).success).toBe(false);
});
