// Форма запису з макета. Дні та час приходять із /api/slots (їх виставляє адмін),
// заявка йде на /api/booking, після чого слот стає зайнятим.
import { useEffect, useRef, useState, type FormEvent } from 'react';

interface Day { date: string; dow: string; day: string; slots: { time: string; free: boolean }[] }
interface Props { services: string[]; preselect?: string; doneText: string; turnstileKey?: string }

const TYPES = ['Бензин / дизель', 'Газ / ГБО', 'Гібрид', 'Електромобіль'];
const FIRST = 'Не знаю, потрібна діагностика';
const resetTurnstile = () => (window as any).turnstile?.reset?.();

/** Українські 9 цифр після коду країни: приймає +380…, 380…, 0… або просто цифри (у тому числі вставлені). */
function nationalDigits(raw: string): string {
  let d = raw.replace(/\D/g, '');
  if (d.startsWith('380')) d = d.slice(3);
  else if (d.length <= 2 && '380'.startsWith(d)) d = ''; // користувач стирає префікс: +38, +3
  if (d.startsWith('0')) d = d.slice(1); // національний формат 066…: нуль не входить до 9 цифр
  return d.slice(0, 9);
}
function formatPhone(raw: string): string {
  const d = nationalDigits(raw);
  if (!d) return '';
  const g = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean);
  return `+380 ${g.join(' ')}`;
}

export default function BookingForm({ services, preselect = '', doneText, turnstileKey = '' }: Props) {
  const [days, setDays] = useState<Day[] | null>(null);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [type, setType] = useState(TYPES[0]);
  const [phone, setPhone] = useState('');
  const [phoneBad, setPhoneBad] = useState(false);
  const [vinBad, setVinBad] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState<{ when: string; car: string; svc: string } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const tsRef = useRef<HTMLDivElement>(null);

  const firstFree = (d?: Day) => d?.slots.find((s) => s.free)?.time ?? '';

  async function load(keepDate = '') {
    try {
      const r = await fetch('/api/slots');
      const list: Day[] = (await r.json()).days;
      setDays(list);
      const d = list.find((x) => x.date === keepDate) ?? list[0];
      setDate(d?.date ?? '');
      setTime(firstFree(d));
    } catch {
      setDays([]);
    }
  }
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!turnstileKey || !tsRef.current) return;
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    s.async = true;
    document.head.appendChild(s);
  }, [turnstileKey]);

  const current = days?.find((d) => d.date === date);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const ok = nationalDigits(phone).length === 9;
    setPhoneBad(!ok);
    if (!ok) return (e.currentTarget.elements.namedItem('phone') as HTMLInputElement).focus();
    // VIN необов'язковий, але якщо введений, то це 17 латинських літер і цифр без I, O, Q
    const vin = String(f.get('vin') ?? '').replace(/[\s-]/g, '').toUpperCase();
    const vinOk = vin === '' || /^[A-HJ-NPR-Z0-9]{17}$/.test(vin);
    setVinBad(!vinOk);
    if (!vinOk) return (e.currentTarget.elements.namedItem('vin') as HTMLInputElement).focus();
    if (!date || !time) return setError('Оберіть день і час візиту.');
    setBusy(true);
    setError('');
    const body = {
      date, time, car_type: type,
      car: f.get('car'), vin, service: f.get('svc'), name: f.get('name'), phone: f.get('phone'), note: f.get('note'),
      website: f.get('website'),
      turnstile: f.get('cf-turnstile-response'),
    };
    try {
      const r = await fetch('/api/booking', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await r.json();
      if (!r.ok) {
        resetTurnstile(); // токен одноразовий: після помилки потрібен новий
        setError(data.error ?? 'Не вдалося надіслати заявку. Зателефонуйте нам, будь ласка.');
        if (r.status === 409) await load(date);
        return;
      }
      (window as any).gtag?.('event', 'generate_lead', { service: String(f.get('svc') ?? ''), car_type: type });
      setSent({ when: `${current?.dow}, ${current?.day}, ${time.replace(/^0/, '')}`, car: String(f.get('car') ?? ''), svc: String(f.get('svc') ?? '') });
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch {
      resetTurnstile();
      setError('Немає зв’язку із сервером. Спробуйте ще раз або зателефонуйте.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={`card${sent ? ' sent' : ''}`} id="bookForm" noValidate onSubmit={submit} ref={formRef}>
      <div className="form-body">
        <div className="field">
          <span className="lbl" id="l-type">Тип авто</span>
          <div className="chips" role="radiogroup" aria-labelledby="l-type">
            {TYPES.map((t, i) => (
              <span key={t} style={{ display: 'contents' }}>
                <input type="radio" name="type" id={`t${i}`} value={t} checked={type === t} onChange={() => setType(t)} />
                <label htmlFor={`t${i}`}>{t}</label>
              </span>
            ))}
          </div>
        </div>
        <div className="grid2">
          <div className="field">
            <label htmlFor="car">Марка і модель</label>
            <input type="text" id="car" name="car" placeholder="Напр. Nissan Leaf 2019" autoComplete="off" maxLength={80} />
          </div>
          <div className="field">
            <label htmlFor="svc">Що потрібно зробити</label>
            <select id="svc" name="svc" defaultValue={preselect || FIRST}>
              <option>{FIRST}</option>
              {services.map((s) => <option key={s}>{s}</option>)}
              <option>Інше</option>
            </select>
          </div>
        </div>
        <div className={`field${vinBad ? ' invalid' : ''}`}>
          <label htmlFor="vin">VIN-код (необов'язково)</label>
          <input type="text" id="vin" name="vin" placeholder="17 символів із техпаспорта" autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={20} style={{ textTransform: 'uppercase' }} />
          <div className="err">VIN складається з 17 латинських літер і цифр, без I, O та Q.</div>
        </div>
        <div className="field">
          <span className="lbl" id="l-day">День</span>
          <div className="chips" id="days" role="radiogroup" aria-labelledby="l-day">
            {days === null && <span className="slots-empty">Завантажуємо вільний час…</span>}
            {days?.length === 0 && <span className="slots-empty">Найближчим часом вільних вікон немає. Зателефонуйте, знайдемо варіант.</span>}
            {days?.map((d) => (
              <span key={d.date} style={{ display: 'contents' }}>
                <input type="radio" name="day" id={`d${d.date}`} checked={date === d.date} onChange={() => { setDate(d.date); setTime(firstFree(d)); }} />
                <label htmlFor={`d${d.date}`}>{d.dow}<small>{d.day}</small></label>
              </span>
            ))}
          </div>
        </div>
        {current && (
          <div className="field">
            <span className="lbl" id="l-time">Час</span>
            <div className="chips" id="slots" role="radiogroup" aria-labelledby="l-time">
              {current.slots.map((s) => (
                <span key={s.time} style={{ display: 'contents' }}>
                  <input type="radio" name="slot" id={`s${s.time}`} disabled={!s.free} checked={time === s.time} onChange={() => setTime(s.time)} />
                  <label htmlFor={`s${s.time}`} className={s.free ? '' : 'busy'} title={s.free ? undefined : 'Зайнято'}>{s.time.replace(/^0/, '')}</label>
                </span>
              ))}
            </div>
          </div>
        )}
        <div className="grid2">
          <div className="field">
            <label htmlFor="name">Ваше ім'я</label>
            <input type="text" id="name" name="name" autoComplete="given-name" maxLength={60} />
          </div>
          <div className={`field${phoneBad ? ' invalid' : ''}`} id="f-phone">
            <label htmlFor="phone">Телефон</label>
            <input
              type="tel" id="phone" name="phone" placeholder="+380 50 000 00 00" autoComplete="tel" inputMode="tel" maxLength={17}
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              onFocus={() => !phone && setPhone('+380 ')}
              onBlur={() => !nationalDigits(phone) && setPhone('')}
            />
            <div className="err">Вкажіть номер у форматі +380 XX XXX XX XX, щоб ми могли підтвердити запис.</div>
          </div>
        </div>
        <div className="field">
          <label htmlFor="note">Що турбує (необов'язково)</label>
          <textarea id="note" name="note" maxLength={600} placeholder="Стукіт спереду справа на нерівностях, горить чек…" />
        </div>
        {/* пастка для ботів: люди це поле не бачать */}
        <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: 'absolute', left: '-9999px' }} />
        {turnstileKey && <div ref={tsRef} className="cf-turnstile" data-sitekey={turnstileKey} style={{ marginBottom: 16 }} />}
        <div className="form-foot">
          <small>Натискаючи кнопку, ви погоджуєтесь на обробку персональних даних і дзвінок для підтвердження запису. <a href="/polityka-konfidentsiynosti/" target="_blank" rel="noopener" style={{ textDecoration: 'underline' }}>Політика конфіденційності</a></small>
          <button className="btn btn-ink" type="submit" disabled={busy}>{busy ? 'Надсилаємо…' : 'Надіслати заявку'}</button>
        </div>
        {error && <div className="form-err" role="alert">{error}</div>}
      </div>
      <div className="done" role="status">
        <h3>Заявку надіслано</h3>
        <p>{doneText}</p>
        {sent && (
          <div className="sum">
            <b>{sent.when}</b><br />
            {type}{sent.car ? `, ${sent.car}` : ''}<br />
            {sent.svc}
          </div>
        )}
        <a className="btn btn-ghost" href="/">На головну</a>
      </div>
    </form>
  );
}
