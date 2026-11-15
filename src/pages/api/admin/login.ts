import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { json, login, logout } from '../../../lib/auth';

export const POST: APIRoute = async ({ request, cookies, url }) => {
  const { password } = (await request.json().catch(() => ({}))) as { password?: string };
  if (!env.ADMIN_PASSWORD) return json({ error: 'Пароль адмінки не заданий: додайте ADMIN_PASSWORD у .dev.vars або секрети Worker.' }, 500);
  if (!(await login(String(password ?? ''), cookies, url.protocol === 'https:'))) {
    await new Promise((r) => setTimeout(r, 600)); // сповільнює перебір
    return json({ error: 'Невірний пароль.' }, 401);
  }
  return json({ ok: true });
};

export const DELETE: APIRoute = async ({ cookies }) => {
  logout(cookies);
  return json({ ok: true });
};
