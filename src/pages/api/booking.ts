import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { json } from '../../lib/auth';
import { buildDays, dayLabel, kyivNow } from '../../lib/schedule';
import { addBooking, getBookings, getContent, SlotTakenError } from '../../lib/store';

const clean = (v: unknown, max: number) => String(v ?? '').replace(/[\u0000-\u001f<>]/g, ' ').trim().slice(0, max);

/** Дата й час створення заявки за Києвом: 15.11.2026, 10:58 */
function createdLabel(iso: string | undefined): string {
  const d = iso ? new Date(iso) : new Date();
  return new Intl.DateTimeFormat('uk-UA', {
    timeZone: 'Europe/Kyiv', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(Number.isNaN(d.getTime()) ? new Date() : d);
}

async function turnstileOk(token: unknown, ip: string | null) {
  if (!env.TURNSTILE_SECRET_KEY) return true; // Turnstile ще не підключено
  const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: String(token ?? '') });
  if (ip) body.set('remoteip', ip);
  const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
  return ((await r.json()) as { success: boolean }).success;
}

async function notifyTelegram(text: string) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return; // Telegram ще не підключено
  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text }),
  });
}

export const POST: APIRoute = async ({ request, locals }) => {
  let b: Record<string, unknown>;
  try { b = await request.json(); } catch { return json({ error: 'Некоректний запит.' }, 400); }
  if (b.website) return json({ ok: true }); // поле-пастка заповнив бот

  const phone = clean(b.phone, 20);
  const digits = phone.replace(/\D/g, '');
  if (!(digits.length === 10 || (digits.length === 12 && digits.startsWith('380')))) {
    return json({ error: 'Вкажіть номер телефону з 10 цифр.' }, 400);
  }
  if (!(await turnstileOk(b.turnstile, request.headers.get('CF-Connecting-IP')))) {
    return json({ error: 'Не вдалося підтвердити, що ви не робот. Оновіть сторінку і спробуйте ще раз.' }, 400);
  }

  const vin = clean(b.vin, 20).replace(/[\s-]/g, '').toUpperCase();
  if (vin && !/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) {
    return json({ error: 'VIN складається з 17 латинських літер і цифр, без I, O та Q.' }, 400);
  }

  const date = clean(b.date, 10), time = clean(b.time, 5);
  const [{ schedule }, bookings] = await Promise.all([getContent(), getBookings(kyivNow().date)]);
  const slot = buildDays(schedule, bookings).find((d) => d.date === date)?.slots.find((s) => s.time === time);
  if (!slot) return json({ error: 'Такого часу немає в розкладі. Оберіть інший.' }, 400);
  if (slot.state !== 'free') return json({ error: 'Цей час щойно зайняли. Оберіть, будь ласка, інший.' }, 409);

  try {
    const row = await addBooking({
      date, time, phone, vin,
      name: clean(b.name, 60), car: clean(b.car, 80), car_type: clean(b.car_type, 40),
      service: clean(b.service, 120), note: clean(b.note, 600),
    });
    const l = dayLabel(date);
    const msg = [
      `Нова заявка: ${l.dow}, ${l.day}, ${time}`,
      `${row.name || 'Без імені'}, ${row.phone}`,
      [row.car_type, row.car].filter(Boolean).join(', '),
      row.vin && `VIN: ${row.vin}`,
      row.service,
      row.note && `Коментар: ${row.note}`,
      `Створено: ${createdLabel(row.created_at)}`,
    ].filter(Boolean).join('\n');
    // Сповіщення не затримує відповідь клієнту і не ламає запис, якщо Telegram недоступний.
    const job = notifyTelegram(msg).catch((e) => console.error('telegram', e));
    const ctx = (locals as { cfContext?: { waitUntil(p: Promise<unknown>): void } }).cfContext;
    if (ctx) ctx.waitUntil(job); else await job;
    return json({ ok: true });
  } catch (e) {
    if (e instanceof SlotTakenError) return json({ error: 'Цей час щойно зайняли. Оберіть, будь ласка, інший.' }, 409);
    console.error('booking', e);
    return json({ error: 'Не вдалося зберегти заявку. Зателефонуйте нам, будь ласка.' }, 500);
  }
};
