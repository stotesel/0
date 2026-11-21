/// <reference types="astro/client" />


declare module 'cloudflare:workers' {
  interface KVLike {
    get(key: string, type: 'json'): Promise<unknown>;
    put(key: string, value: string): Promise<void>;
  }
  export const env: {
    DEMO_KV?: KVLike;
    ADMIN_PASSWORD?: string;
    SUPABASE_URL?: string;
    SUPABASE_SERVICE_ROLE_KEY?: string;
    TELEGRAM_BOT_TOKEN?: string;
    TELEGRAM_CHAT_ID?: string;
    TURNSTILE_SITE_KEY?: string;
    TURNSTILE_SECRET_KEY?: string;
  };
}
