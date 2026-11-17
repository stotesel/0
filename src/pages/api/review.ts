import type { APIRoute } from 'astro';
import { json } from '../../lib/auth';
import { addPendingReview } from '../../lib/store';
import { notifyTelegram, turnstileOk } from './booking';

const clean = (v: unknown, max: number) => String(v ?? '').replace(/[\u0000-\u0009\u000b-\u001f<>]/g, ' ').trim().slice(0, max);

/** Відгук із сайту. На сайті з'являється лише після підтвердження в адмінці. */
export const POST: APIRoute = async ({ request, locals }) => {
  let b: Record<string, unknown>;
  try { b = await request.json(); } catch { return json({ error: 'Некоректний запит.' }, 400); }
  if (b.website) return json({ ok: true }); // поле-пастка заповнив бот

  const author = clean(b.author, 60);
  const text = clean(b.text, 1500);
  const rating = Math.round(Number(b.rating));
  if (author.length < 2) return json({ error: 'Вкажіть, як вас звати.' }, 400);
  if (text.length < 10) return json({ error: 'Напишіть кілька слів про візит.' }, 400);
  if (!(rating >= 1 && rating <= 5)) return json({ error: 'Оберіть оцінку від 1 до 5.' }, 400);
  if (!(await turnstileOk(b.turnstile, request.headers.get('CF-Connecting-IP')))) {
    return json({ error: 'Не вдалося підтвердити, що ви не робот. Оновіть сторінку і спробуйте ще раз.' }, 400);
  }

  try {
    const row = await addPendingReview({ author, car: clean(b.car, 80), text, rating });
    const job = notifyTelegram(`Новий відгук на перевірці (${'★'.repeat(row.rating)})\n${row.author}${row.car ? `, ${row.car}` : ''}\n${row.text}\n\nПідтвердити: адмінка → Відгуки`)
      .catch((e) => console.error('telegram', e));
    const ctx = (locals as { cfContext?: { waitUntil(p: Promise<unknown>): void } }).cfContext;
    if (ctx) ctx.waitUntil(job); else await job;
    return json({ ok: true });
  } catch (e) {
    console.error('review', e);
    return json({ error: 'Не вдалося надіслати відгук. Спробуйте пізніше.' }, 500);
  }
};
