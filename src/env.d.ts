/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly PUBLIC_ALLOWED_ORIGINS: string
  readonly DATABASE_URL: string
  readonly OPENAI_API_KEY: string
  readonly OPENAI_BASE_URL: string
  readonly OPENAI_MODEL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
