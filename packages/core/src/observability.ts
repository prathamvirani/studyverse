import type { Observer } from '@study/feature-sdk';
/** Safe default; adapters choose the destination without exposing request bodies. */
export const noopObserver: Observer = { record() {}, measure() {} };
