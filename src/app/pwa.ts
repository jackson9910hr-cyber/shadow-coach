import { signal } from '@preact/signals';

/** A new service worker is waiting; call applyUpdate() to activate it and reload. */
export const needRefresh = signal(false);
/** The app shell is cached and works offline. */
export const offlineReady = signal(false);

let updater: ((reload?: boolean) => Promise<void>) | null = null;

export function setUpdater(fn: (reload?: boolean) => Promise<void>) {
  updater = fn;
}

export function applyUpdate() {
  void updater?.(true);
}
