/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare const __APP_VERSION__: string;

/** True for Capacitor builds (BASE_PATH=./): no service worker. */
declare const __NATIVE_SHELL__: boolean;
