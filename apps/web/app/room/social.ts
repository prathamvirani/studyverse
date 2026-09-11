import { defineComponent, h } from 'vue';
import type { UiRegistry } from '@study/core/browser';
import type { SocialClient } from '../lib/social';
import { statusLabels } from '../lib/social';
import { okSchema } from '@study/contracts';
import type { createApiClient } from '../lib/api-client';
export function registerRoomSocial(
  ui: UiRegistry,
  social: SocialClient,
  api: ReturnType<typeof createApiClient>,
  roomId: string,
  owner: boolean,
  notice: (message: string) => void,
) {
  async function action(name: string, targetId: string) {
    try {
      await api.request(
        `/api/v1/${name}`,
        okSchema,
        name === 'rooms/friend-invite' ? { targetId, roomId } : { targetId },
      );
      notice('Saved. Your social list will update shortly.');
    } catch {
      notice('Action unavailable. Your relationship or room access may have changed.');
    }
  }
  ui.register('friends.participant', {
    id: 'friends.participant',
    point: 'participantContextMenu',
    order: 5,
    label: 'Social controls',
    load: async () =>
      defineComponent({
        props: { participantId: { type: String, required: true } },
        setup: (props) => () => {
          if (props.participantId === 'self')
            return h('label', [
              'Your status',
              h(
                'select',
                {
                  'aria-label': 'Your status',
                  value: social.state.status,
                  onChange: (e: Event) =>
                    social.status(
                      (e.target as HTMLSelectElement).value as keyof typeof statusLabels,
                    ),
                },
                Object.entries(statusLabels).map(([value, label]) => h('option', { value }, label)),
              ),
            ]);
          const person = social.state.participants.find((p) => p.id === props.participantId);
          if (!person) return h('p', 'Participant unavailable');
          const friend = social.state.snapshot?.friends.some((p) => p.id === person.id),
            incoming = social.state.snapshot?.incoming.some((p) => p.id === person.id),
            outgoing = social.state.snapshot?.outgoing.some((p) => p.id === person.id);
          return h('div', [
            h('strong', person.name),
            h('p', person.status ? statusLabels[person.status] : 'Presence private'),
            h(
              'button',
              {
                onClick: () =>
                  void action(
                    `friends/${friend ? 'remove' : incoming ? 'accept' : outgoing ? 'decline' : 'request'}`,
                    person.id,
                  ),
              },
              friend
                ? 'Remove friend'
                : incoming
                  ? 'Accept friend request'
                  : outgoing
                    ? 'Cancel friend request'
                    : 'Add friend',
            ),
            ...(friend && owner
              ? [
                  h(
                    'button',
                    { onClick: () => void action('rooms/friend-invite', person.id) },
                    'Invite to room',
                  ),
                ]
              : []),
            h('button', { onClick: () => void action('friends/block', person.id) }, 'Block'),
          ]);
        },
      }),
  });
  ui.register('friends.more', {
    id: 'friends.more',
    point: 'roomMoreMenu',
    order: 5,
    label: 'Friends',
    load: async () =>
      defineComponent({ setup: () => () => h('a', { href: '/friends' }, 'Friends & privacy') }),
  });
  ui.register('friends.notifications', {
    id: 'friends.notifications',
    point: 'topBar',
    order: 30,
    label: 'Social notifications',
    load: async () =>
      defineComponent({
        setup: () => () => {
          const count =
            (social.state.snapshot?.incoming.length ?? 0) + social.state.invitations.length;
          return count
            ? h(
                'a',
                {
                  href: '/friends',
                  'aria-label': `${count} pending friend requests and invitations`,
                },
                `Friends · ${count}`,
              )
            : h('span');
        },
      }),
  });
}
