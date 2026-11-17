import type { APIRoute } from 'astro';
import { json } from '../../lib/auth';
import { buildDays, dayLabel, kyivNow } from '../../lib/schedule';
import { getBookings, getContent } from '../../lib/store';

/** Найближчі дні, у яких є хоча б один вільний слот. */
export const GET: APIRoute = async ({ url }) => {
  const lang = url.searchParams.get('lang') === 'ru' ? 'ru' : 'uk';
  const [{ schedule }, bookings] = await Promise.all([getContent(), getBookings(kyivNow().date)]);
  const days = buildDays(schedule, bookings)
    .filter((d) => d.slots.some((s) => s.state === 'free'))
    .map((d) => ({
      date: d.date,
      ...dayLabel(d.date, lang),
      slots: d.slots.filter((s) => s.state !== 'past').map((s) => ({ time: s.time, free: s.state === 'free' })),
    }));
  return json({ days });
};
