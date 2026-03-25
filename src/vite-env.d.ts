/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SQLITE_SYNC_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
