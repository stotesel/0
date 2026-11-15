import type { APIRoute } from 'astro';
import { json } from '../../lib/auth';
import { buildDays, dayLabel, kyivNow } from '../../lib/schedule';
import { getBookings, getContent } from '../../lib/store';

/** Найближчі дні, у яких є хоча б один вільний слот. */
export const GET: APIRoute = async () => {
  const [{ schedule }, bookings] = await Promise.all([getContent(), getBookings(kyivNow().date)]);
  const days = buildDays(schedule, bookings)
    .filter((d) => d.slots.some((s) => s.state === 'free'))
    .slice(0, 7)
    .map((d) => ({
      date: d.date,
      ...dayLabel(d.date),
      slots: d.slots.filter((s) => s.state !== 'past').map((s) => ({ time: s.time, free: s.state === 'free' })),
    }));
  return json({ days });
};
