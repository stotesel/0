// Єдиний шар доступу до даних. Два драйвери з однаковим інтерфейсом:
//  - Supabase (PostgREST через fetch із service role ключем, тільки на сервері);
//  - демо на Cloudflare KV, коли змінні Supabase не задані.
import { env } from 'cloudflare:workers';
import { seedBlocks, seedParts, seedSchedule, seedServices, seedSettings } from './seed';
import type { Block, Booking, Part, Schedule, Service, SiteContent } from './types';

export type ContentKey = 'settings' | 'blocks' | 'schedule';
export type Table = 'services' | 'parts';
type Row = { id: string; enabled: boolean; sort: number };

export function mode(): 'supabase' | 'demo' {
  return env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY ? 'supabase' : 'demo';
}

export class SlotTakenError extends Error {}

const seeds: Record<Table, Row[]> = { services: seedServices, parts: seedParts };

function withDefaults(c: Partial<SiteContent>): SiteContent {
  return {
    settings: { ...seedSettings, ...(c.settings ?? {}) },
    blocks: (c.blocks as Block[]) ?? seedBlocks,
    schedule: { ...seedSchedule, ...(c.schedule ?? {}) } as Schedule,
  };
}

/* ---------------- Демо-драйвер (KV) ---------------- */
interface DemoDb {
  content: Partial<SiteContent>;
  services: Service[];
  parts: Part[];
  bookings: Booking[];
}
let memory: DemoDb | null = null; // запасний варіант, якщо KV недоступний

async function demoRead(): Promise<DemoDb> {
  const fresh = (): DemoDb => structuredClone({ content: {}, services: seedServices, parts: seedParts, bookings: [] });
  if (!env.DEMO_KV) return (memory ??= fresh());
  const db = (await env.DEMO_KV.get('db', 'json')) as DemoDb | null;
  return db ? { ...fresh(), ...db } : fresh();
}
async function demoWrite(db: DemoDb) {
  if (!env.DEMO_KV) memory = db;
  else await env.DEMO_KV.put('db', JSON.stringify(db));
}

/* ---------------- Драйвер Supabase ---------------- */
async function sb<T>(path: string, init: RequestInit & { prefer?: string } = {}): Promise<T> {
  const key = env.SUPABASE_SERVICE_ROLE_KEY!;
  const { prefer, ...rest } = init;
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    ...rest,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {}),
    },
  });
  if (res.status === 409) throw new SlotTakenError();
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

async function sbContent(): Promise<Record<string, any>> {
  const rows = await sb<{ key: string; value: any }[]>('site_content?select=key,value');
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

const upsertContent = (key: string, value: unknown) =>
  sb('site_content', { method: 'POST', prefer: 'resolution=merge-duplicates', body: JSON.stringify([{ key, value }]) });

/** Перше звернення адмінки до порожньої бази: переносимо початкові дані. */
export async function ensureSeeded() {
  if (mode() !== 'supabase') return;
  if ((await sbContent()).seeded) return;
  for (const table of ['services', 'parts'] as Table[]) {
    const existing = await sb<Row[]>(`${table}?select=id&limit=1`);
    if (!existing.length) {
      await sb(table, { method: 'POST', body: JSON.stringify(seeds[table].map(({ id, ...r }) => r)) });
    }
  }
  await upsertContent('seeded', true);
}

/* ---------------- Тексти, налаштування, розклад ---------------- */
export async function getContent(): Promise<SiteContent> {
  if (mode() === 'supabase') return withDefaults(await sbContent());
  return withDefaults((await demoRead()).content);
}

export async function saveContent(key: ContentKey, value: unknown) {
  if (mode() === 'supabase') return void (await upsertContent(key, value));
  const db = await demoRead();
  (db.content as any)[key] = value;
  await demoWrite(db);
}

/* ---------------- Послуги та запчастини ---------------- */
export async function listRows<T extends Row>(table: Table, includeDisabled = false): Promise<T[]> {
  let list: Row[];
  if (mode() === 'supabase') {
    list = await sb<Row[]>(`${table}?select=*&order=sort.asc`);
    if (!list.length && !includeDisabled) list = seeds[table]; // база ще не заповнена
  } else {
    list = (await demoRead())[table];
  }
  return list.filter((r) => includeDisabled || r.enabled).sort((a, b) => a.sort - b.sort) as T[];
}
export const getServices = (all = false) => listRows<Service>('services', all);
export const getParts = (all = false) => listRows<Part>('parts', all);

export async function saveRow<T extends Row>(table: Table, row: T): Promise<T> {
  const isNew = !row.id || row.id.startsWith('new-');
  if (mode() === 'supabase') {
    const { id, ...rest } = row;
    const rows = await sb<T[]>(isNew ? table : `${table}?id=eq.${encodeURIComponent(id)}`, {
      method: isNew ? 'POST' : 'PATCH',
      prefer: 'return=representation',
      body: JSON.stringify(rest),
    });
    return rows[0];
  }
  const db = await demoRead();
  if (isNew) row = { ...row, id: crypto.randomUUID() };
  const list = db[table] as Row[];
  const i = list.findIndex((x) => x.id === row.id);
  if (i >= 0) list[i] = row;
  else list.push(row);
  await demoWrite(db);
  return row;
}

export async function deleteRow(table: Table, id: string) {
  if (mode() === 'supabase') return void (await sb(`${table}?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' }));
  const db = await demoRead();
  (db[table] as Row[]) = (db[table] as Row[]).filter((x) => x.id !== id);
  await demoWrite(db);
}

/* ---------------- Заявки ---------------- */
export async function getBookings(fromDate?: string): Promise<Booking[]> {
  if (mode() === 'supabase') {
    const f = fromDate ? `&date=gte.${fromDate}` : '';
    return sb<Booking[]>(`bookings?select=*${f}&order=date.asc,time.asc`);
  }
  const list = (await demoRead()).bookings.filter((b) => !fromDate || b.date >= fromDate);
  return list.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}

export async function addBooking(b: Omit<Booking, 'id' | 'created_at' | 'status'>): Promise<Booking> {
  if (mode() === 'supabase') {
    // Подвійний запис на один слот відсікає унікальний індекс у базі (відповідь 409).
    const rows = await sb<Booking[]>('bookings', {
      method: 'POST',
      prefer: 'return=representation',
      body: JSON.stringify({ ...b, status: 'new' }),
    });
    return rows[0];
  }
  const db = await demoRead();
  if (db.bookings.some((x) => x.date === b.date && x.time === b.time && x.status !== 'cancelled')) {
    throw new SlotTakenError();
  }
  const row: Booking = { ...b, id: crypto.randomUUID(), status: 'new', created_at: new Date().toISOString() };
  db.bookings.push(row);
  await demoWrite(db);
  return row;
}

export async function updateBooking(id: string, status: Booking['status']) {
  if (mode() === 'supabase') {
    return void (await sb(`bookings?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ status }) }));
  }
  const db = await demoRead();
  const row = db.bookings.find((x) => x.id === id);
  if (row) row.status = status;
  await demoWrite(db);
}
