import { createSSRApp, defineComponent, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { expect, it } from 'vitest';
import { UiRegistry } from '@study/core/browser';
import { UiExtensionHost } from '@study/ui';

it('renders a registered lazy contribution and escapes hostile text', async () => {
  const hostile = '<img src=x onerror=alert(1)>',
    registry = new UiRegistry();
  registry.register('fixture.panel', {
    id: 'fixture.panel',
    label: hostile,
    point: 'rightRail',
    order: 1,
    load: async () => defineComponent({ setup: () => () => h('p', hostile) }),
  });
  const html = await renderToString(
    createSSRApp({ render: () => h(UiExtensionHost, { registry, point: 'rightRail' }) }),
  );
  expect(html).toContain('&lt;img');
  expect(html).not.toContain('<img');
  expect(html).toContain('data-extension-point="rightRail"');
});
