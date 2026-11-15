import { useEffect, useState, type ReactNode } from 'react';
import type { Block, Booking, DaySlots, Part, Schedule, Service, Settings } from '../../lib/types';

interface Data {
  mode: 'supabase' | 'demo';
  settings: Settings;
  blocks: Block[];
  schedule: Schedule;
  services: Service[];
  parts: Part[];
  bookings: Booking[];
  days: DaySlots[];
  blockTemplates: Record<string, { label: string; data: Record<string, any> }>;
}

type FieldType = 'text' | 'area' | 'number' | 'bool' | 'lines' | 'select' | 'days';
interface Field { key: string; label: string; type?: FieldType; options?: [string, string][]; hint?: string }

const DOW = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const MON = ['січ', 'лют', 'бер', 'кві', 'тра', 'чер', 'лип', 'сер', 'вер', 'жов', 'лис', 'гру'];
const fmtDate = (date: string) => {
  const d = new Date(`${date}T12:00:00Z`);
  return `${DOW[d.getUTCDay()]}, ${d.getUTCDate()} ${MON[d.getUTCMonth()]}`;
};
const normTime = (t: string) => {
  const m = /^(\d{1,2})[:.](\d{2})$/.exec(t.trim());
  return !m || +m[1] > 23 || +m[2] > 59 ? null : `${m[1].padStart(2, '0')}:${m[2]}`;
};
const TR: Record<string, string> = { а: 'a', б: 'b', в: 'v', г: 'h', ґ: 'g', д: 'd', е: 'e', є: 'ie', ж: 'zh', з: 'z', и: 'y', і: 'i', ї: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ь: '', ю: 'iu', я: 'ia', "'": '', '’': '' };
const slugify = (s: string) => [...s.toLowerCase()].map((c) => TR[c] ?? c).join('').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/* ---------- Поля форм ---------- */
function Input({ f, value, onChange }: { f: Field; value: any; onChange: (v: any) => void }) {
  const t = f.type ?? 'text';
  if (t === 'bool') {
    return (
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" className="size-4 accent-hv" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
        {f.label}
      </label>
    );
  }
  let control: ReactNode;
  if (t === 'area') control = <textarea className="inp min-h-24" value={value ?? ''} onChange={(e) => onChange(e.target.value)} />;
  else if (t === 'lines') control = <textarea className="inp min-h-28" value={(value ?? []).join('\n')} onChange={(e) => onChange(e.target.value.split('\n'))} onBlur={(e) => onChange(e.target.value.split('\n').map((x) => x.trim()).filter(Boolean))} />;
  else if (t === 'number') control = <input type="number" min={0} className="inp" value={value ?? 0} onChange={(e) => onChange(+e.target.value)} />;
  else if (t === 'select') control = <select className="inp" value={value} onChange={(e) => onChange(e.target.value)}>{f.options!.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>;
  else if (t === 'days') {
    const all: [string, string][] = [['Mo', 'Пн'], ['Tu', 'Вт'], ['We', 'Ср'], ['Th', 'Чт'], ['Fr', 'Пт'], ['Sa', 'Сб'], ['Su', 'Нд']];
    control = (
      <div className="flex flex-wrap gap-3">
        {all.map(([v, l]) => (
          <label key={v} className="flex items-center gap-1 text-sm">
            <input type="checkbox" className="accent-hv" checked={(value ?? []).includes(v)} onChange={(e) => onChange(all.map((x) => x[0]).filter((d) => (d === v ? e.target.checked : (value ?? []).includes(d))))} />{l}
          </label>
        ))}
      </div>
    );
  } else control = <input className="inp" value={value ?? ''} onChange={(e) => onChange(e.target.value)} />;
  return (
    <div>
      <span className="lbl">{f.label}{t === 'lines' && ' (кожен пункт з нового рядка)'}</span>
      {control}
      {f.hint && <p className="mt-1 text-xs text-slate-500">{f.hint}</p>}
    </div>
  );
}

function Form<T extends Record<string, any>>({ fields, value, onChange }: { fields: Field[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {fields.map((f) => (
        <div key={f.key} className={['area', 'lines', 'days'].includes(f.type ?? '') ? 'md:col-span-2' : ''}>
          <Input f={f} value={value[f.key]} onChange={(v) => onChange({ ...value, [f.key]: v })} />
        </div>
      ))}
    </div>
  );
}

/* Універсальний редактор вмісту блоку: будує форму за формою самих даних. */
const LABELS: Record<string, string> = {
  title: 'Заголовок', text: 'Текст', body: 'Текст (Markdown)', button: 'Напис на кнопці', link: 'Посилання кнопки', tags: 'Мітки',
  facts: 'Переваги під заголовком', note: 'Примітка', foot: 'Примітка під прайсом', steps: 'Кроки', items: 'Пункти', highlight: 'Виділені (електромобілі)',
  offerBig: 'Знижка великим шрифтом', offerText: 'Опис знижки', callLabel: 'Підпис над телефоном', doneText: 'Текст після відправки заявки', car: 'Авто і робота',
  specLabel: 'Tesla: мітка над заголовком', specTitle: 'Tesla: заголовок', specText: 'Tesla: підпис', zones: 'Вузли на гравюрі Tesla',
  slug: 'Адреса послуги (звідти ціна й посилання), можна лишити порожньою',
  part: 'Що підсвітити: battery, chassis, electronics, glass, charge або climate',
};
const ITEM_SHAPES: Record<string, Record<string, string>> = { reviews: { title: '', car: '', text: '' } };

function AutoFields({ type, value, onChange }: { type: string; value: Record<string, any>; onChange: (v: Record<string, any>) => void }) {
  const set = (k: string, v: any) => onChange({ ...value, [k]: v });
  return (
    <div className="grid gap-4">
      {Object.entries(value).map(([k, v]) => {
        const label = LABELS[k] ?? k;
        if (Array.isArray(v) && (v.length === 0 ? ['items', 'steps', 'facts', 'zones'].includes(k) : typeof v[0] === 'object')) {
          const shape = k === 'zones' ? { title: '', text: '', slug: '', part: 'battery' } : (ITEM_SHAPES[type] ?? { title: '', text: '' });
          const move = (i: number, d: number) => { const a = [...v]; [a[i], a[i + d]] = [a[i + d], a[i]]; set(k, a); };
          return (
            <div key={k}>
              <span className="lbl">{label}</span>
              <div className="grid gap-2">
                {v.map((item: Record<string, any>, i: number) => (
                  <div key={i} className="rounded-xl border border-slate-200 p-3">
                    <AutoFields type={type} value={item} onChange={(nv) => set(k, v.map((x: any, j: number) => (j === i ? nv : x)))} />
                    <div className="mt-2 flex gap-2">
                      <button type="button" className="btn-b" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                      <button type="button" className="btn-b" disabled={i === v.length - 1} onClick={() => move(i, 1)}>↓</button>
                      <button type="button" className="btn-d" onClick={() => set(k, v.filter((_: any, j: number) => j !== i))}>Видалити</button>
                    </div>
                  </div>
                ))}
                <button type="button" className="btn-b justify-self-start" onClick={() => set(k, [...v, { ...shape }])}>+ Додати</button>
              </div>
            </div>
          );
        }
        if (Array.isArray(v)) return <Input key={k} f={{ key: k, label, type: 'lines' }} value={v} onChange={(nv) => set(k, nv)} />;
        const long = typeof v === 'string' && (v.length > 60 || ['text', 'body', 'foot', 'doneText'].includes(k));
        return <Input key={k} f={{ key: k, label, type: long ? 'area' : 'text' }} value={v} onChange={(nv) => set(k, nv)} />;
      })}
    </div>
  );
}

/* ---------- Описи полів ---------- */
const KINDS: [string, string][] = [['all', 'Усі авто'], ['ice', 'Бензин / дизель (ДВЗ)'], ['hyb', 'Гібриди'], ['ev', 'Електромобілі']];
const SERVICE_FIELDS: Field[] = [
  { key: 'title', label: 'Назва' },
  { key: 'slug', label: 'Адреса сторінки', hint: 'Латиницею, напр. zamina-masla. Сторінка відкриється за адресою /zamina-masla/' },
  { key: 'price_from', label: 'Ціна від, грн', type: 'number' },
  { key: 'duration', label: 'Тривалість' },
  { key: 'kind', label: 'Тип авто', type: 'select', options: KINDS },
  { key: 'sort', label: 'Порядок у списку', type: 'number' },
  { key: 'summary', label: 'Короткий опис (у прайсі)', type: 'area' },
  { key: 'includes', label: 'Що входить', type: 'lines' },
  { key: 'body', label: 'Детальний опис для сторінки послуги (Markdown)', type: 'area' },
  { key: 'seo_title', label: 'SEO-заголовок (необов’язково)' },
  { key: 'seo_description', label: 'SEO-опис (необов’язково)' },
  { key: 'enabled', label: 'Показувати на сайті', type: 'bool' },
];
const PART_FIELDS: Field[] = [
  { key: 'title', label: 'Назва' },
  { key: 'category', label: 'Категорія' },
  { key: 'price', label: 'Ціна від, грн (0 = «ціна за запитом»)', type: 'number' },
  { key: 'sort', label: 'Порядок у списку', type: 'number' },
  { key: 'description', label: 'Опис', type: 'area' },
  { key: 'in_stock', label: 'В наявності (інакше «під замовлення»)', type: 'bool' },
  { key: 'enabled', label: 'Показувати на сайті', type: 'bool' },
];
const SETTINGS_FIELDS: Field[] = [
  { key: 'name', label: 'Назва СТО' },
  { key: 'siteUrl', label: 'Адреса сайту', hint: 'Напр. https://stotesel.com.ua. Потрібна для canonical і sitemap після підключення домену.' },
  { key: 'phone', label: 'Телефон (як показувати)' },
  { key: 'phoneE164', label: 'Телефон для дзвінка', hint: 'У форматі +380XXXXXXXXX' },
  { key: 'phoneNote', label: 'Підпис під телефоном у шапці' },
  { key: 'email', label: 'Пошта' },
  { key: 'street', label: 'Вулиця і будинок' },
  { key: 'city', label: 'Місто' },
  { key: 'postalCode', label: 'Індекс' },
  { key: 'priceRange', label: 'Рівень цін для Google (₴, ₴₴, ₴₴₴)' },
  { key: 'lat', label: 'Широта (для розмітки)' },
  { key: 'lng', label: 'Довгота (для розмітки)' },
  { key: 'hoursText', label: 'Графік (текст)' },
  { key: 'hoursNote', label: 'Примітка до графіка' },
  { key: 'opens', label: 'Відкриття (для розмітки)' },
  { key: 'closes', label: 'Закриття (для розмітки)' },
  { key: 'openDays', label: 'Робочі дні (для розмітки)', type: 'days' },
  { key: 'telegram', label: 'Telegram (нік без @)' },
  { key: 'viber', label: 'Viber (номер)' },
  { key: 'whatsapp', label: 'WhatsApp (номер)' },
  { key: 'footerText', label: 'Текст у підвалі', type: 'area' },
  { key: 'seoTitle', label: 'SEO-заголовок головної' },
  { key: 'seoDescription', label: 'SEO-опис головної', type: 'area' },
];
const BLOCK_NAMES: Record<string, string> = {
  hero: 'Перший екран', brands: 'Стрічка марок', services: 'Послуги і ціни', process: 'Як проходить візит', why: 'Чому ми',
  booking: 'Запис', faq: 'Часті питання', contacts: 'Контакти і карта', reviews: 'Відгуки', text: 'Текстовий блок', banner: 'Банер',
};
const STATUS: [Booking['status'], string][] = [['new', 'Нова'], ['confirmed', 'Підтверджена'], ['done', 'Виконана'], ['cancelled', 'Скасована']];

/* ---------- Список із редагуванням (послуги, запчастини) ---------- */
function Rows<T extends { id: string; title: string; enabled: boolean; sort: number }>({
  rows, fields, blank, priceKey, onSave, onDelete, extra,
}: {
  rows: T[]; fields: Field[]; blank: () => T; priceKey: keyof T & string;
  onSave: (r: T) => void; onDelete: (id: string) => void; extra?: (r: T) => ReactNode;
}) {
  const [edit, setEdit] = useState<T | null>(null);
  return (
    <div className="grid gap-2">
      {rows.map((r) => (edit?.id === r.id ? null : (
        <div key={r.id} className={`card flex flex-wrap items-center gap-3 !py-3 ${r.enabled ? '' : 'opacity-50'}`}>
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold">{r.title}</div>
            {extra && <div className="truncate text-xs text-slate-500">{extra(r)}</div>}
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            від
            <input type="number" min={0} className="inp !w-24" defaultValue={r[priceKey] as number} key={`${r.id}-${r[priceKey]}`}
              onBlur={(e) => { const v = +e.target.value; if (v !== r[priceKey]) onSave({ ...r, [priceKey]: v }); }} />
            грн
          </label>
          <button className="btn-b" onClick={() => onSave({ ...r, enabled: !r.enabled })}>{r.enabled ? 'Сховати' : 'Показати'}</button>
          <button className="btn-b" onClick={() => setEdit(r)}>Редагувати</button>
        </div>
      )))}
      {edit && (
        <div className="card ring-2 ring-hv">
          <Form fields={fields} value={edit} onChange={(v) => setEdit(fields.some((f) => f.key === 'slug') && !rows.some((r) => r.id === edit.id) && v.title !== edit.title ? { ...v, slug: slugify(v.title) } : v)} />
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="btn-a" onClick={() => { onSave(edit); setEdit(null); }}>Зберегти</button>
            <button className="btn-b" onClick={() => setEdit(null)}>Скасувати</button>
            {rows.some((r) => r.id === edit.id) && (
              <button className="btn-d ml-auto" onClick={() => { if (confirm(`Видалити «${edit.title}»? Відновити не вдасться.`)) { onDelete(edit.id); setEdit(null); } }}>Видалити</button>
            )}
          </div>
        </div>
      )}
      {!edit && <button className="btn-a justify-self-start" onClick={() => setEdit(blank())}>+ Додати</button>}
    </div>
  );
}

/* ---------- Застосунок ---------- */
const TABS = [['bookings', 'Заявки'], ['schedule', 'Розклад'], ['services', 'Послуги і ціни'], ['parts', 'Запчастини'], ['blocks', 'Головна сторінка'], ['settings', 'Налаштування']] as const;
type Tab = (typeof TABS)[number][0];

export default function AdminApp() {
  const [data, setData] = useState<Data | null>(null);
  const [auth, setAuth] = useState<'loading' | 'no' | 'yes'>('loading');
  const [tab, setTab] = useState<Tab>('bookings');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [open, setOpen] = useState('');
  const [allBookings, setAllBookings] = useState(false);

  function apply(d: Data) { setData(d); setBlocks(d.blocks); setSettings(d.settings); }
  async function load() {
    const r = await fetch('/api/admin/data');
    if (r.status === 401) return setAuth('no');
    apply(await r.json());
    setAuth('yes');
  }
  useEffect(() => { load(); }, []);

  async function act(body: Record<string, unknown>, okText = 'Збережено') {
    setErr('');
    const r = await fetch('/api/admin/data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (r.status === 401) return setAuth('no');
    const d = await r.json();
    if (!r.ok) return setErr(d.error ?? 'Помилка збереження');
    apply(d);
    setMsg(okText);
    setTimeout(() => setMsg(''), 2500);
  }

  if (auth === 'loading') return <p className="p-8 text-slate-500">Завантаження…</p>;
  if (auth === 'no') return <Login onDone={load} />;
  if (!data || !settings) return null;

  const saveSchedule = (s: Schedule) => act({ action: 'content', key: 'schedule', value: s });
  const today = data.days[0]?.date ?? '';
  const shown = data.bookings.filter((b) => allBookings || (b.date >= today && b.status !== 'cancelled'));
  const newCount = data.bookings.filter((b) => b.status === 'new' && b.date >= today).length;

  return (
    <div className="mx-auto max-w-5xl px-4 pb-24">
      <header className="flex flex-wrap items-center gap-3 py-5">
        <h1 className="text-xl font-black tracking-tight">STO<span className="text-hv">tesel</span> <span className="font-medium text-slate-500">адмінка</span></h1>
        <a className="btn-b ml-auto" href="/" target="_blank" rel="noopener">Відкрити сайт</a>
        <button className="btn-b" onClick={async () => { await fetch('/api/admin/login', { method: 'DELETE' }); setAuth('no'); }}>Вийти</button>
      </header>
      {data.mode === 'demo' && (
        <p className="mb-4 rounded-xl bg-amber-100 px-4 py-3 text-sm text-amber-900">
          Демо-режим: Supabase ще не підключено, дані зберігаються локально на цьому комп’ютері.
        </p>
      )}
      <nav className="mb-5 flex gap-1 overflow-x-auto rounded-xl bg-white p-1 shadow-sm">
        {TABS.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`cursor-pointer whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold ${tab === k ? 'bg-ink text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
            {l}{k === 'bookings' && newCount > 0 && <span className="ml-2 rounded-full bg-hv px-2 py-0.5 text-xs text-white">{newCount}</span>}
          </button>
        ))}
      </nav>
      {(msg || err) && (
        <div role="status" className={`fixed bottom-5 left-1/2 z-10 -translate-x-1/2 rounded-full px-5 py-2 text-sm font-semibold text-white shadow-lg ${err ? 'bg-red-600' : 'bg-emerald-600'}`}>{err || msg}</div>
      )}

      {tab === 'bookings' && (
        <section className="grid gap-2">
          <label className="mb-1 flex items-center gap-2 text-sm"><input type="checkbox" className="accent-hv" checked={allBookings} onChange={(e) => setAllBookings(e.target.checked)} />Показати минулі та скасовані</label>
          {shown.length === 0 && <p className="card text-slate-500">Заявок поки немає. Нові записи з форми на сайті з’являться тут.</p>}
          {shown.map((b) => (
            <div key={b.id} className="card flex flex-wrap items-start gap-4 !py-4">
              <div className="w-32 shrink-0"><div className="font-bold">{fmtDate(b.date)}</div><div className="text-2xl font-black tracking-tight">{b.time.replace(/^0/, '')}</div></div>
              <div className="min-w-0 flex-1 text-sm">
                <div className="font-semibold">{b.name || 'Без імені'} · <a className="text-hv-deep underline" href={`tel:${b.phone.replace(/[^\d+]/g, '')}`}>{b.phone}</a></div>
                <div className="text-slate-600">{[b.car_type, b.car].filter(Boolean).join(', ')}</div>
                {b.vin && <div className="font-mono text-slate-600">VIN: {b.vin}</div>}
                <div>{b.service}</div>
                {b.note && <div className="mt-1 text-slate-500">«{b.note}»</div>}
                <div className="mt-1 text-xs text-slate-400">Створено: {new Date(b.created_at).toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv', dateStyle: 'short', timeStyle: 'short' })}</div>
              </div>
              <select className="inp !w-40" value={b.status} onChange={(e) => act({ action: 'booking', id: b.id, status: e.target.value }, e.target.value === 'cancelled' ? 'Скасовано, слот знову вільний' : 'Збережено')}>
                {STATUS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          ))}
        </section>
      )}

      {tab === 'schedule' && <ScheduleTab data={data} onSave={saveSchedule} />}

      {tab === 'services' && (
        <Rows<Service> rows={data.services} fields={SERVICE_FIELDS} priceKey="price_from"
          extra={(r) => `/${r.slug}/ · ${r.duration}`}
          blank={() => ({ id: `new-${Date.now()}`, slug: '', title: '', summary: '', body: '', includes: [], kind: 'all', price_from: 500, duration: '1 год', enabled: true, sort: data.services.length + 1, seo_title: '', seo_description: '' })}
          onSave={(row) => { if (!row.title.trim() || !/^[a-z0-9-]+$/.test(row.slug)) return setErr('Вкажіть назву та адресу сторінки латиницею'); act({ action: 'row', table: 'services', row }); }}
          onDelete={(id) => act({ action: 'deleteRow', table: 'services', id }, 'Видалено')} />
      )}

      {tab === 'parts' && (
        <Rows<Part> rows={data.parts} fields={PART_FIELDS} priceKey="price"
          extra={(r) => `${r.category} · ${r.in_stock ? 'в наявності' : 'під замовлення'}`}
          blank={() => ({ id: `new-${Date.now()}`, title: '', description: '', category: data.parts.at(-1)?.category ?? '', price: 0, in_stock: true, enabled: true, sort: data.parts.length + 1 })}
          onSave={(row) => { if (!row.title.trim()) return setErr('Вкажіть назву'); act({ action: 'row', table: 'parts', row }); }}
          onDelete={(id) => act({ action: 'deleteRow', table: 'parts', id }, 'Видалено')} />
      )}

      {tab === 'blocks' && (
        <section className="grid gap-2">
          <p className="text-sm text-slate-600">Блоки йдуть на головній у цьому порядку. Їх можна переставляти, ховати, редагувати й додавати нові.</p>
          {blocks.map((b, i) => {
            const move = (d: number) => { const a = [...blocks]; [a[i], a[i + d]] = [a[i + d], a[i]]; setBlocks(a); };
            const upd = (nb: Block) => setBlocks(blocks.map((x) => (x.id === b.id ? nb : x)));
            return (
              <div key={b.id} className={`card !py-3 ${b.enabled ? '' : 'opacity-60'}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="min-w-0 flex-1 font-semibold">{BLOCK_NAMES[b.type] ?? b.type}<span className="ml-2 truncate text-sm font-normal text-slate-500">{b.data.title}</span></div>
                  <button className="btn-b" disabled={i === 0} onClick={() => move(-1)} aria-label="Вище">↑</button>
                  <button className="btn-b" disabled={i === blocks.length - 1} onClick={() => move(1)} aria-label="Нижче">↓</button>
                  <button className="btn-b" onClick={() => upd({ ...b, enabled: !b.enabled })}>{b.enabled ? 'Сховати' : 'Показати'}</button>
                  <button className="btn-b" onClick={() => setOpen(open === b.id ? '' : b.id)}>{open === b.id ? 'Згорнути' : 'Редагувати'}</button>
                </div>
                {open === b.id && (
                  <div className="mt-4 border-t border-slate-200 pt-4">
                    <AutoFields type={b.type} value={b.data} onChange={(nd) => upd({ ...b, data: nd })} />
                    {data.blockTemplates[b.type] && (
                      <button className="btn-d mt-4" onClick={() => confirm('Видалити блок?') && setBlocks(blocks.filter((x) => x.id !== b.id))}>Видалити блок</button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button className="btn-a" onClick={() => act({ action: 'content', key: 'blocks', value: blocks }, 'Головну сторінку оновлено')}>Зберегти зміни</button>
            {JSON.stringify(blocks) !== JSON.stringify(data.blocks) && <span className="text-sm text-amber-700">Є незбережені зміни</span>}
            <select className="inp ml-auto !w-56" value="" onChange={(e) => {
              const t = e.target.value; if (!t) return;
              const id = `${t}-${Date.now()}`;
              setBlocks([...blocks, { id, type: t, enabled: true, data: structuredClone(data.blockTemplates[t].data) }]); setOpen(id);
            }}>
              <option value="">+ Додати блок…</option>
              {Object.entries(data.blockTemplates).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
        </section>
      )}

      {tab === 'settings' && (
        <section className="card">
          <Form fields={SETTINGS_FIELDS} value={settings} onChange={setSettings} />
          <button className="btn-a mt-5" onClick={() => act({ action: 'content', key: 'settings', value: settings })}>Зберегти налаштування</button>
        </section>
      )}
    </div>
  );
}

function ScheduleTab({ data, onSave }: { data: Data; onSave: (s: Schedule) => void }) {
  const s = data.schedule;
  const [tpl, setTpl] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(s.template).map(([k, v]) => [k, v.join(', ')])));
  const [horizon, setHorizon] = useState(s.horizonDays);
  const [extra, setExtra] = useState<Record<string, string>>({});
  const [bad, setBad] = useState('');

  const ov = (date: string) => {
    const o = s.overrides[date];
    return { ...o, closed: o?.closed ?? [], extra: o?.extra ?? [] };
  };
  const setOv = (date: string, patch: Partial<Schedule['overrides'][string]>) =>
    onSave({ ...s, overrides: { ...s.overrides, [date]: { ...ov(date), ...patch } } });

  function saveTemplate() {
    const template: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(tpl)) {
      const times = v.split(/[,\s]+/).filter(Boolean).map(normTime);
      if (times.includes(null)) return setBad(`Перевірте час у дні «${DOW[+k]}»: формат ГГ:ХХ через кому`);
      template[k] = [...new Set(times as string[])].sort();
    }
    setBad('');
    // прибираємо винятки для дат, що вже минули
    const overrides = Object.fromEntries(Object.entries(s.overrides).filter(([d]) => d >= data.days[0].date));
    onSave({ ...s, template, overrides, horizonDays: Math.min(60, Math.max(1, horizon)) });
  }

  const chip = 'rounded-full border px-3 py-1.5 text-sm font-medium';
  return (
    <section className="grid gap-5">
      <div className="card">
        <h2 className="mb-1 font-bold">Типовий тиждень</h2>
        <p className="mb-4 text-sm text-slate-600">Час початку візитів для кожного дня через кому. Порожнє поле означає вихідний.</p>
        <div className="grid gap-3 md:grid-cols-2">
          {[1, 2, 3, 4, 5, 6, 0].map((d) => (
            <label key={d} className="flex items-center gap-3 text-sm">
              <span className="w-8 font-semibold">{DOW[d]}</span>
              <input className="inp" value={tpl[d] ?? ''} placeholder="вихідний" onChange={(e) => setTpl({ ...tpl, [d]: e.target.value })} />
            </label>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">Запис відкритий на <input type="number" min={1} max={60} className="inp !w-20" value={horizon} onChange={(e) => setHorizon(+e.target.value)} /> днів наперед</label>
          <button className="btn-a" onClick={saveTemplate}>Зберегти тиждень</button>
          {bad && <span className="text-sm text-red-700">{bad}</span>}
        </div>
      </div>

      <div className="card">
        <h2 className="mb-1 font-bold">Слоти по днях</h2>
        <p className="mb-4 text-sm text-slate-600">
          Натисніть на вільний час, щоб закрити його для запису, і ще раз, щоб відкрити.
          <span className={`${chip} ml-2 border-emerald-300 bg-emerald-50 text-emerald-800`}>вільно</span>
          <span className={`${chip} ml-1 border-slate-300 bg-slate-100 text-slate-500 line-through`}>закрито</span>
          <span className={`${chip} ml-1 border-orange-300 bg-orange-100 text-orange-900`}>запис</span>
        </p>
        <div className="grid gap-4">
          {data.days.map((d) => (
            <div key={d.date} className="border-t border-slate-200 pt-3">
              <div className="mb-2 flex flex-wrap items-center gap-3">
                <b className="w-28">{fmtDate(d.date)}</b>
                <label className="flex items-center gap-1 text-sm"><input type="checkbox" className="accent-hv" checked={d.dayOff} onChange={(e) => setOv(d.date, { dayOff: e.target.checked })} />вихідний</label>
                <form className="ml-auto flex gap-2" onSubmit={(e) => {
                  e.preventDefault();
                  const t = normTime(extra[d.date] ?? '');
                  if (!t) return;
                  setOv(d.date, { extra: [...new Set([...ov(d.date).extra, t])], closed: ov(d.date).closed.filter((x) => x !== t), dayOff: false });
                  setExtra({ ...extra, [d.date]: '' });
                }}>
                  <input className="inp !w-24" placeholder="14:00" aria-label={`Додати час на ${fmtDate(d.date)}`} value={extra[d.date] ?? ''} onChange={(e) => setExtra({ ...extra, [d.date]: e.target.value })} />
                  <button className="btn-b">+ час</button>
                </form>
              </div>
              <div className="flex flex-wrap gap-2">
                {d.slots.length === 0 && <span className="text-sm text-slate-500">Немає слотів</span>}
                {d.slots.map((x) => {
                  const t = x.time.replace(/^0/, '');
                  if (x.state === 'booked') return <span key={x.time} className={`${chip} border-orange-300 bg-orange-100 text-orange-900`} title={`${x.booking?.phone ?? ''} ${x.booking?.service ?? ''}`}>{t} · {x.booking?.name || x.booking?.phone}</span>;
                  if (x.state === 'past') return <span key={x.time} className={`${chip} border-slate-200 text-slate-300`}>{t}</span>;
                  const closed = x.state === 'closed';
                  return (
                    <button key={x.time} aria-pressed={!closed} className={`${chip} cursor-pointer ${closed ? 'border-slate-300 bg-slate-100 text-slate-500 line-through' : 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'}`}
                      onClick={() => setOv(d.date, { closed: closed ? ov(d.date).closed.filter((c) => c !== x.time) : [...ov(d.date).closed, x.time] })}>{t}</button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Login({ onDone }: { onDone: () => void }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <form className="card mx-auto mt-24 grid max-w-sm gap-4" onSubmit={async (e) => {
      e.preventDefault();
      setBusy(true);
      const password = new FormData(e.currentTarget).get('password');
      const r = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
      setBusy(false);
      if (r.ok) onDone(); else setError((await r.json()).error ?? 'Помилка входу');
    }}>
      <h1 className="text-xl font-black tracking-tight">STO<span className="text-hv">tesel</span> <span className="font-medium text-slate-500">адмінка</span></h1>
      <div><label className="lbl" htmlFor="pw">Пароль</label><input id="pw" name="password" type="password" className="inp" autoComplete="current-password" autoFocus /></div>
      {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
      <button className="btn-a" disabled={busy}>{busy ? 'Входимо…' : 'Увійти'}</button>
    </form>
  );
}
