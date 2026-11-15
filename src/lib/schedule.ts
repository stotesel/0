import type { Booking, DaySlots, Schedule } from './types';

export const DOW_SHORT = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
export const MONTH_SHORT = ['січ', 'лют', 'бер', 'кві', 'тра', 'чер', 'лип', 'сер', 'вер', 'жов', 'лис', 'гру'];

/** Поточні дата й час у Києві (Worker працює в UTC). */
export function kyivNow(): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Kyiv',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date());
  const g = (t: string) => parts.find((p) => p.type === t)!.value;
  return { date: `${g('year')}-${g('month')}-${g('day')}`, time: `${g('hour')}:${g('minute')}` };
}

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export const dowOf = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();

export function normTime(t: string): string | null {
  const m = /^(\d{1,2})[:.](\d{2})$/.exec(t.trim());
  if (!m || +m[1] > 23 || +m[2] > 59) return null;
  return `${m[1].padStart(2, '0')}:${m[2]}`;
}

export function dayLabel(date: string) {
  const [, m, d] = date.split('-').map(Number);
  return { dow: DOW_SHORT[dowOf(date)], day: `${d} ${MONTH_SHORT[m - 1]}` };
}

/** Слоти на найближчі дні: шаблон тижня + винятки дня − заявки. */
export function buildDays(schedule: Schedule, bookings: Booking[], days = schedule.horizonDays): DaySlots[] {
  const now = kyivNow();
  const out: DaySlots[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(now.date, i);
    const dow = dowOf(date);
    const o = schedule.overrides[date] ?? { closed: [], extra: [] };
    const times = [...new Set([...(schedule.template[String(dow)] ?? []), ...(o.extra ?? [])])].sort();
    // Вимкнений день тижня: явний список offDays, а для старих даних день без годин
    const weekdayOff = schedule.offDays ? schedule.offDays.includes(String(dow)) : (schedule.template[String(dow)] ?? []).length === 0;
    const off = o.dayOff ?? weekdayOff; // виняток на конкретну дату сильніший за день тижня
    const slots = times.map((time) => {
      const booking = bookings.find((b) => b.date === date && b.time === time && b.status !== 'cancelled');
      const state = booking
        ? ('booked' as const)
        : off || (o.closed ?? []).includes(time)
          ? ('closed' as const)
          : date === now.date && time <= now.time
            ? ('past' as const)
            : ('free' as const);
      return { time, state, booking };
    });
    out.push({ date, dow, dayOff: off, slots });
  }
  return out;
}

/** Текст для шапки: найближчий вільний час. */
export function nextFreeLabel(days: DaySlots[]): string {
  for (const [i, d] of days.entries()) {
    const s = d.slots.find((x) => x.state === 'free');
    if (!s) continue;
    const l = dayLabel(d.date);
    const when = i === 0 ? 'сьогодні' : i === 1 ? 'завтра' : `${l.dow.toLowerCase()}, ${l.day}`;
    return `вільно ${when} о ${s.time.replace(/^0/, '')}`;
  }
  return '';
}
