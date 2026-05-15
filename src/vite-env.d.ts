/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Только если фронт ходит к API с другого домена без Vercel-прокси. С прокси оставьте пустым. */
  readonly VITE_API_BASE_URL?: string;
}
