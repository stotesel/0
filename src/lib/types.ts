export type Kind = 'all' | 'ice' | 'hyb' | 'ev';

export interface Service {
  id: string;
  slug: string;
  title: string;
  summary: string;
  body: string; // Markdown, детальний опис для сторінки послуги
  includes: string[];
  kind: Kind;
  price_from: number;
  duration: string;
  enabled: boolean;
  sort: number;
  seo_title: string;
  seo_description: string;
}

export interface Settings {
  name: string;
  siteUrl: string;
  phone: string;
  phoneE164: string;
  phoneNote: string;
  email: string;
  street: string;
  city: string;
  postalCode: string;
  lat: string;
  lng: string;
  hoursText: string;
  hoursNote: string;
  openDays: string[]; // Mo, Tu, We, Th, Fr, Sa, Su
  opens: string;
  closes: string;
  telegram: string;
  viber: string;
  whatsapp: string;
  footerText: string;
  seoTitle: string;
  seoDescription: string;
  priceRange: string;
}

export interface Block {
  id: string;
  type: string;
  enabled: boolean;
  data: Record<string, any>;
}

export interface DayOverride {
  dayOff?: boolean;
  closed: string[];
  extra: string[];
}

export interface Schedule {
  horizonDays: number;
  template: Record<string, string[]>; // ключ: день тижня 0 (нд) … 6 (сб)
  overrides: Record<string, DayOverride>; // ключ: дата YYYY-MM-DD
}

export type BookingStatus = 'new' | 'confirmed' | 'done' | 'cancelled';

export interface Booking {
  id: string;
  date: string;
  time: string;
  name: string;
  phone: string;
  car: string;
  car_type: string;
  vin: string;
  service: string;
  note: string;
  status: BookingStatus;
  created_at: string;
}

export interface SiteContent {
  settings: Settings;
  blocks: Block[];
  schedule: Schedule;
}

export type SlotState = 'free' | 'booked' | 'closed' | 'past';
export interface DaySlots {
  date: string;
  dow: number;
  dayOff: boolean;
  slots: { time: string; state: SlotState; booking?: Booking }[];
}

export interface Part {
  id: string;
  title: string;
  description: string;
  category: string;
  price: number; // 0 = «ціна за запитом»
  in_stock: boolean;
  enabled: boolean;
  sort: number;
}
