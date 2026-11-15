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

export function mapLinks(s: Settings) {
  const q = encodeURIComponent(addressLine(s));
  return {
    embed: `https://maps.google.com/maps?q=${q}&z=15&output=embed`,
    google: `https://www.google.com/maps/dir/?api=1&destination=${q}`,
    waze: `https://waze.com/ul?q=${q}&navigate=yes`,
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
    telephone: s.phoneE164,
    ...(s.email ? { email: s.email } : {}),
    priceRange: s.priceRange,
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
        priceSpecification: { '@type': 'PriceSpecification', minPrice: x.price_from, priceCurrency: 'UAH' },
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
