import { buildDays, kyivNow, nextFreeLabel } from './schedule';
import { getBookings, getContent, getServices } from './store';
import type { Service, Settings } from './types';

/** Усе, що потрібно будь-якій публічній сторінці. */
export async function loadSite() {
  const [content, services, bookings] = await Promise.all([getContent(), getServices(), getBookings(kyivNow().date)]);
  const days = buildDays(content.schedule, bookings);
  return { ...content, services, days, nextFree: nextFreeLabel(days) };
}

export const tel = (s: Settings) => `tel:${s.phoneE164}`;
export const addressLine = (s: Settings) => `${s.street}, ${s.city}`;
export const price = (n: number) => n.toLocaleString('uk-UA').replace(/ /g, ' ');
/** Ціна 0 у послузі означає «за запитом» (напр. шиномонтаж, де все залежить від радіуса). */
export const PRICE_ON_REQUEST = 'за запитом';

/** Райони з налаштувань: «Нивки, Виноградар» → ['Нивки', 'Виноградар']. */
export const districtList = (s: Settings) => (s.districts || '').split(',').map((x) => x.trim()).filter(Boolean);
/** «Нивки та Виноградар» для текстів; порожньо, якщо районів немає. */
export const districtPhrase = (s: Settings, sep = ' та ') => {
  const d = districtList(s);
  return d.length < 2 ? d.join('') : `${d.slice(0, -1).join(', ')}${sep}${d[d.length - 1]}`;
};
/** Для заголовків: лише перші два райони, щоб title не був задовгим. «Нивки і Виноградар». */
export const titleNear = (s: Settings, sep = ' і ') => districtList(s).slice(0, 2).join(sep);
/** Обрізає опис до ~160 символів по межі слова, щоб Google не різав його сам посеред фрази. */
export function clip(text: string, max = 160) {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(' ')).replace(/[,.;:—–-]+$/, '')}…`;
}
/** Місто плюс райони для schema.org areaServed. */
export const areaServed = (s: Settings) => {
  const d = districtList(s);
  return d.length ? [s.city, ...d.map((name) => ({ '@type': 'Place', name: `${name}, ${s.city}` }))] : s.city;
};

export function mapLinks(s: Settings) {
  // Якщо в налаштуваннях задані координати, мітка й маршрути ведуть точно на них,
  // а не на місце, яке Google підбирає за адресою.
  const hasCoords = /^-?\d+(\.\d+)?$/.test(s.lat.trim()) && /^-?\d+(\.\d+)?$/.test(s.lng.trim());
  const q = encodeURIComponent(hasCoords ? `${s.lat.trim()},${s.lng.trim()}` : addressLine(s));
  return {
    embed: `https://maps.google.com/maps?q=${q}&z=${hasCoords ? 17 : 15}&output=embed`,
    google: `https://www.google.com/maps/dir/?api=1&destination=${q}`,
    waze: hasCoords ? `https://waze.com/ul?ll=${q}&navigate=yes` : `https://waze.com/ul?q=${q}&navigate=yes`,
  };
}

/* ---------- schema.org ---------- */
const DAYS: Record<string, string> = {
  Mo: 'Monday', Tu: 'Tuesday', We: 'Wednesday', Th: 'Thursday', Fr: 'Friday', Sa: 'Saturday', Su: 'Sunday',
};

export function autoRepairLd(s: Settings, services: Service[], origin: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'AutoRepair',
    '@id': `${origin}/#autorepair`,
    name: s.name,
    url: `${origin}/`,
    image: `${origin}/img/stotesel-car.png`,
    logo: `${origin}/icon-512.png`,
    telephone: s.phoneE164,
    ...(s.email ? { email: s.email } : {}),
    priceRange: s.priceRange,
    areaServed: areaServed(s),
    // Зв'язок сайту з точкою в Google Картах
    hasMap: 'https://maps.google.com/?cid=13948839784886276017',
    sameAs: ['https://maps.google.com/?cid=13948839784886276017'],
    knowsLanguage: ['uk', 'ru'],
    address: {
      '@type': 'PostalAddress',
      streetAddress: s.street,
      addressLocality: s.city,
      postalCode: s.postalCode,
      addressCountry: 'UA',
    },
    ...(s.lat && s.lng ? { geo: { '@type': 'GeoCoordinates', latitude: +s.lat, longitude: +s.lng } } : {}),
    openingHoursSpecification: [
      { '@type': 'OpeningHoursSpecification', dayOfWeek: s.openDays.map((d) => DAYS[d]).filter(Boolean), opens: s.opens, closes: s.closes },
    ],
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Послуги автосервісу',
      itemListElement: services.map((x) => ({
        '@type': 'Offer',
        url: `${origin}/${x.slug}/`,
        itemOffered: { '@type': 'Service', name: x.title, description: x.summary },
        ...(x.price_from > 0 ? { priceSpecification: { '@type': 'PriceSpecification', minPrice: x.price_from, priceCurrency: 'UAH' } } : {}),
      })),
    },
  };
}

export function faqLd(items: { title: string; text: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((i) => ({ '@type': 'Question', name: i.title, acceptedAnswer: { '@type': 'Answer', text: i.text } })),
  };
}

export function breadcrumbLd(origin: string, trail: [string, string][]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: `${origin}${path}` })),
  };
}
