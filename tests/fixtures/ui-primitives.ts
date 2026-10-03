import { createApp, h, ref } from 'vue';
import {
  ContextPane,
  GlassSurface,
  IntegratedSearch,
  PageHeader,
  SegmentedControl,
  SettingsSheet,
  StudySelect,
} from '@study/ui';

createApp({
  setup() {
    const value = ref('alpha'),
      query = ref(''),
      result = ref(''),
      open = ref(false);
    const busy = ref(false),
      disabled = ref(false),
      error = ref(false);
    const options = [
      { value: 'alpha', label: 'Alpha' },
      { value: 'blocked', label: 'Beta', disabled: true },
      { value: 'gamma', label: 'Gamma' },
      { value: 'delta', label: 'Delta' },
    ];
    return () =>
      h('main', [
        h(PageHeader, { title: 'Shared control fixture' }),
        h(GlassSurface, {}, () =>
          h(ContextPane, { label: 'Controls' }, () => [
            h(
              'button',
              {
                onClick: () => {
                  open.value = true;
                },
              },
              'Open settings',
            ),
            h(
              'button',
              {
                onClick: () => {
                  busy.value = !busy.value;
                },
              },
              'Toggle busy',
            ),
            h(
              'button',
              {
                onClick: () => {
                  disabled.value = !disabled.value;
                },
              },
              'Toggle disabled',
            ),
            h(
              'button',
              {
                onClick: () => {
                  error.value = !error.value;
                },
              },
              'Toggle error',
            ),
            h(IntegratedSearch, {
              label: 'Search first',
              modelValue: query.value,
              busy: busy.value,
              disabled: disabled.value,
              error: error.value ? 'Try another query.' : '',
              'onUpdate:modelValue': (v: string) => {
                query.value = v;
              },
              onSubmit: (v: string) => {
                result.value = v;
              },
            }),
            h(IntegratedSearch, { label: 'Search second', modelValue: '', showSubmit: false }),
            h('output', { 'aria-label': 'Submitted query' }, result.value),
            h(StudySelect, {
              label: 'Test choice',
              options,
              modelValue: value.value,
              disabled: disabled.value,
              error: error.value ? 'Choose another option.' : '',
              'onUpdate:modelValue': (v: string) => {
                value.value = v;
              },
            }),
            h(SegmentedControl, {
              label: 'Test segments',
              options,
              modelValue: value.value,
              'onUpdate:modelValue': (v: string) => {
                value.value = v;
              },
            }),
          ]),
        ),
        h(
          SettingsSheet,
          {
            title: 'Test settings',
            open: open.value,
            'onUpdate:open': (v: boolean) => {
              open.value = v;
            },
          },
          () => [h('button', 'First action'), h('button', 'Last action')],
        ),
      ]);
  },
}).mount('#fixture');
