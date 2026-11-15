import type { APIRoute } from 'astro';
import { isAdmin, json } from '../../../lib/auth';
import { addDays, buildDays, kyivNow } from '../../../lib/schedule';
import { blockTemplates } from '../../../lib/seed';
import {
  deleteRow, ensureSeeded, getBookings, getContent, listRows, mode, saveContent, saveRow, updateBooking,
  type ContentKey, type Table,
} from '../../../lib/store';

const TABLES: Table[] = ['services', 'parts'];
const KEYS: ContentKey[] = ['settings', 'blocks', 'schedule'];

async function snapshot() {
  await ensureSeeded();
  const today = kyivNow().date;
  const [content, services, parts, bookings] = await Promise.all([
    getContent(), listRows('services', true), listRows('parts', true), getBookings(addDays(today, -30)),
  ]);
  return {
    mode: mode(), ...content, services, parts, bookings, blockTemplates,
    days: buildDays(content.schedule, bookings, Math.max(content.schedule.horizonDays, 14)),
  };
}

export const GET: APIRoute = async ({ cookies }) => {
  if (!(await isAdmin(cookies))) return json({ error: 'auth' }, 401);
  return json(await snapshot());
};

/** Усі зміни з адмінки: { action, ... }. У відповідь повертається свіжий стан. */
export const POST: APIRoute = async ({ cookies, request }) => {
  if (!(await isAdmin(cookies))) return json({ error: 'auth' }, 401);
  const b = (await request.json()) as Record<string, any>;
  try {
    if (b.action === 'content' && KEYS.includes(b.key)) await saveContent(b.key, b.value);
    else if (b.action === 'row' && TABLES.includes(b.table)) await saveRow(b.table, b.row);
    else if (b.action === 'deleteRow' && TABLES.includes(b.table)) await deleteRow(b.table, String(b.id));
    else if (b.action === 'booking') await updateBooking(String(b.id), b.status);
    else return json({ error: 'Невідома дія.' }, 400);
    return json(await snapshot());
  } catch (e) {
    console.error('admin', e);
    return json({ error: e instanceof Error ? e.message : 'Помилка збереження.' }, 500);
  }
};
