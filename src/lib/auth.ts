// Вхід в адмінку: пароль із секрету ADMIN_PASSWORD, сесія в підписаній cookie.
import { env } from 'cloudflare:workers';
import type { AstroCookies } from 'astro';

const COOKIE = 'adm';
const WEEK = 7 * 24 * 3600;

async function hmac(secret: string, msg: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export async function login(password: string, cookies: AstroCookies, secure: boolean): Promise<boolean> {
  const real = env.ADMIN_PASSWORD;
  if (!real) return false;
  // Порівнюємо підписи, а не самі рядки, щоб час відповіді не залежав від пароля.
  if (!safeEqual(await hmac('cmp', password), await hmac('cmp', real))) return false;
  const exp = Date.now() + WEEK * 1000;
  cookies.set(COOKIE, `${exp}.${await hmac(real, `adm:${exp}`)}`, {
    httpOnly: true, sameSite: 'strict', secure, path: '/', maxAge: WEEK,
  });
  return true;
}

export function logout(cookies: AstroCookies) {
  cookies.delete(COOKIE, { path: '/' });
}

export async function isAdmin(cookies: AstroCookies): Promise<boolean> {
  const real = env.ADMIN_PASSWORD;
  const raw = cookies.get(COOKIE)?.value;
  if (!real || !raw) return false;
  const [exp, sig] = raw.split('.');
  if (!exp || !sig || +exp < Date.now()) return false;
  return safeEqual(sig, await hmac(real, `adm:${exp}`));
}

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
