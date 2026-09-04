/// <reference types="vite/client" />

/** true in development builds, false in production (see vite.config.ts) */
declare const __DEV_FORCING__: boolean;

interface ImportMetaEnv {
  readonly VITE_GAME_API_URL?: string;
  readonly VITE_GAME_API_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
