import type { APIRoute } from 'astro';
import { addCall, getContent } from '../../lib/store';
import { kyivNow } from '../../lib/schedule';
import { phoneList } from '../../lib/site';

/** Натискання на номер телефону на сайті. Сайт шле сюди sendBeacon, відповідь не потрібна. */
export const POST: APIRoute = async ({ request, url, locals }) => {
  // Лише з власних сторінок: чужі сайти не накрутять лічильник простим запитом із браузера
  const origin = request.headers.get('Origin');
  if (origin && origin !== url.origin) return new Response(null, { status: 403 });
  let b: Record<string, unknown>;
  try { b = JSON.parse(await request.text()); } catch { return new Response(null, { status: 400 }); }

  const { settings } = await getContent();
  const known = new Set([settings.phoneE164, ...phoneList(settings).map((p) => p.e164)]);
  const phone = String(b.phone ?? '');
  // Порожній номер означає «відкрили вікно вибору», інші значення приймаємо лише з налаштувань
  if (phone && !known.has(phone)) return new Response(null, { status: 400 });
  const page = String(b.page ?? '/').replace(/[?#].*$/, '').slice(0, 120) || '/';

  const job = addCall(kyivNow().date, phone, page).catch((e) => console.error('call', e));
  const ctx = (locals as { cfContext?: { waitUntil(p: Promise<unknown>): void } }).cfContext;
  if (ctx) ctx.waitUntil(job); else await job;
  return new Response(null, { status: 204 });
};
