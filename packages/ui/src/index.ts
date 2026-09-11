import { defineAsyncComponent, defineComponent, h, onErrorCaptured, ref } from 'vue';
import type { Component, PropType } from 'vue';
import type { ExtensionPoint } from '@study/contracts';
import type { TileInstance, TileRegistry, UiRegistry } from '@study/core/browser';

const Unavailable = defineComponent({
  setup: () => () => h('p', { role: 'status' }, 'This panel is temporarily unavailable.'),
});
const Loading = defineComponent({ setup: () => () => h('p', { role: 'status' }, 'Loading…') });
function lazy(load: () => Promise<unknown>): Component {
  return defineAsyncComponent({
    loader: async () => {
      const component = await load();
      if (!component || !['object', 'function'].includes(typeof component))
        throw new Error('Invalid renderer');
      return component as Component;
    },
    loadingComponent: Loading,
    errorComponent: Unavailable,
    timeout: 2_000,
    delay: 100,
  });
}
const ContributionBoundary = defineComponent({
  props: {
    renderer: { type: [Object, Function] as PropType<Component>, required: true },
    context: { type: Object as PropType<Record<string, unknown>>, default: () => ({}) },
  },
  setup(props) {
    const failed = ref(false);
    onErrorCaptured(() => {
      failed.value = true;
      return false;
    });
    return () => (failed.value ? h(Unavailable) : h(props.renderer, props.context));
  },
});
export const UiExtensionHost = defineComponent({
  props: {
    registry: { type: Object as PropType<UiRegistry>, required: true },
    point: { type: String as PropType<ExtensionPoint>, required: true },
    onlyId: { type: String, default: '' },
    context: { type: Object as PropType<Record<string, unknown>>, default: () => ({}) },
    can: { type: Function as PropType<(permission: string) => boolean>, default: () => false },
  },
  setup(props) {
    const renderers = new Map<string, Component>();
    return () =>
      h(
        'div',
        { 'data-extension-point': props.point },
        props.registry
          .at(props.point, props.can)
          .filter((item) => !props.onlyId || item.id === props.onlyId)
          .map((item) => {
            if (!renderers.has(item.id)) renderers.set(item.id, lazy(item.load));
            return h('section', { key: item.id, 'aria-label': item.label }, [
              h(ContributionBoundary, {
                renderer: renderers.get(item.id)!,
                context: props.context,
              }),
            ]);
          }),
      );
  },
});
export const WorkspaceTileView = defineComponent({
  props: {
    registry: { type: Object as PropType<TileRegistry>, required: true },
    instance: { type: Object as PropType<TileInstance>, required: true },
    can: { type: Function as PropType<(permission: string) => boolean>, default: () => false },
  },
  setup(props) {
    const renderers = new Map<string, Component>();
    return () => {
      const definition = props.registry.get(props.instance.type);
      if (
        !definition ||
        props.instance.layout.minimized ||
        (definition.permission && !props.can(definition.permission))
      )
        return null;
      if (!renderers.has(definition.type)) renderers.set(definition.type, lazy(definition.load));
      return h(
        'section',
        {
          'aria-label': definition.label,
          'data-tile-id': props.instance.id,
          hidden: props.instance.layout.minimized,
        },
        [
          h(ContributionBoundary, {
            renderer: renderers.get(definition.type)!,
            context: { instance: props.instance },
          }),
        ],
      );
    };
  },
});
