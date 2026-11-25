// Мови сайту: українська за замовчуванням (без префікса), російська — з префіксом /ru/.
import type { Service, Settings } from './types';
import { RU_SERVICES } from './ru/services';

export type Lang = 'uk' | 'ru';

/** Шлях у потрібній мові: '/servis-tesla/' → '/ru/servis-tesla/'. */
export const lp = (lang: Lang, path: string) => (lang === 'ru' ? `/ru${path === '/' ? '/' : path}` : path);

/** Сторінки, що мають російську версію (для перемикача мов і hreflang). */
export function hasRu(path: string, serviceSlugs: string[] = []) {
  if (['/', '/servis-tesla/', '/kontakty/'].includes(path)) return true;
  if (/^\/servis-tesla\/model-[3ysx]\/$/.test(path)) return true;
  const m = /^\/([a-z0-9-]+)\/$/.exec(path);
  return !!m && serviceSlugs.includes(m[1]) && !!RU_SERVICES[m[1]];
}

/** Послуга російською (ціна та інше — з бази). */
export const ruService = (s: Service): Service => {
  const r = RU_SERVICES[s.slug];
  return r ? { ...s, title: r.title, summary: r.summary, includes: r.includes, duration: r.duration, body: r.body, seo_title: '', seo_description: '' } : s;
};

/** Налаштування для російських сторінок: адреса, місто, графік тощо. */
export const ruSettings = (s: Settings): Settings => ({
  ...s,
  city: s.city === 'Київ' ? 'Киев' : s.city,
  street: s.street.replace('вул. Івана Виговського', 'ул. Ивана Выговского'),
  districts: s.districts.replace('Виноградар', 'Виноградарь').replace('Сирець', 'Сырец'),
  phoneNote: 'по предварительной записи',
  hoursNote: 'Только по предварительной записи',
  footerText: 'Автосервис и шиномонтаж между Нивками и Виноградарем: ремонт бензиновых, дизельных, гибридных авто и электромобилей в Киеве',
});

export const T = {
  uk: {
    nav: [['/servis-tesla/', 'Сервіс Tesla'], ['/#services', 'Послуги і ціни'], ['/zapchastyny/', 'Запчастини'], ['/pro-nas/', 'Про нас'], ['/vidguky/', 'Відгуки'], ['/kontakty/', 'Контакти']],
    foot: [['/servis-tesla/', 'Сервіс Tesla'], ['/poslugy/', 'Послуги'], ['/vidguky/', 'Відгуки'], ['/statti/', 'Статті'], ['/pro-nas/', 'Про нас'], ['/tsiny/', 'Ціни'], ['/zapchastyny/', 'Запчастини'], ['/kontakty/', 'Контакти'], ['/polityka-konfidentsiynosti/', 'Політика конфіденційності']],
    home: 'на головну', menu: 'Меню', sections: 'Розділи сайту', pages: 'Сторінки сайту',
    book: 'Записатися', call: 'Подзвонити', callFull: 'Зателефонувати', pickPhone: 'Кому зателефонувати?', close: 'Закрити', switchTo: 'RU', switchLabel: 'Русская версия',
    // прайс
    allServices: 'Усі послуги', ice: 'Бензин / дизель', hyb: 'Гібриди', ev: 'Електромобілі', filter: 'Фільтр послуг',
    showAll: 'Показати всі послуги', collapse: 'Згорнути', from: 'від', uah: 'грн', onRequest: 'за запитом', kindHyb: 'гібрид', kindIce: 'ДВЗ',
    // контакти
    address: 'Адреса', phone: 'Телефон', email: 'Пошта', hours: 'Графік', messengers: 'Месенджери', routeGoogle: 'Маршрут у Google Maps', map: 'Карта',
    // відгуки
    rating: (n: number) => `Оцінка ${n} з 5`, allReviews: 'Усі відгуки', mapsReviews: 'Відгуки в Google Картах',
    // форма запису
    f: {
      types: ['Бензин / дизель', 'Газ / ГБО', 'Гібрид', 'Електромобіль'], first: 'Не знаю, потрібна діагностика', other: 'Інше',
      type: 'Тип авто', car: 'Марка і модель', carPh: 'Напр. Nissan Leaf 2019', svc: 'Що потрібно зробити',
      vin: "VIN-код (необов'язково)", vinPh: '17 символів із техпаспорта', vinErr: 'VIN складається з 17 латинських літер і цифр, без I, O та Q.',
      day: 'День', loading: 'Завантажуємо вільний час…', noSlots: 'Найближчим часом вільних вікон немає. Зателефонуйте, знайдемо варіант.',
      time: 'Час', busy: 'Зайнято', name: "Ваше ім'я", phone: 'Телефон', phoneErr: 'Вкажіть номер у форматі +380 XX XXX XX XX, щоб ми могли підтвердити запис.',
      note: "Що турбує (необов'язково)", notePh: 'Стукіт спереду справа на нерівностях, горить чек…',
      consent: 'Натискаючи кнопку, ви погоджуєтесь на обробку персональних даних і дзвінок для підтвердження запису.', privacy: 'Політика конфіденційності',
      sending: 'Надсилаємо…', send: 'Надіслати заявку', pickTime: 'Оберіть день і час візиту.',
      fail: 'Не вдалося надіслати заявку. Зателефонуйте нам, будь ласка.', offline: 'Немає зв’язку із сервером. Спробуйте ще раз або зателефонуйте.',
      done: 'Заявку надіслано', toHome: 'На головну', homeHref: '/',
    },
  },
  ru: {
    nav: [['/ru/servis-tesla/', 'Сервис Tesla'], ['/ru/#services', 'Услуги и цены'], ['/ru/#reviews', 'Отзывы'], ['/ru/#faq', 'Вопросы'], ['/ru/kontakty/', 'Контакты']],
    foot: [['/ru/servis-tesla/', 'Сервис Tesla'], ['/ru/#services', 'Услуги и цены'], ['/ru/kontakty/', 'Контакты'], ['/', 'Українська версія'], ['/polityka-konfidentsiynosti/', 'Политика конфиденциальности (укр.)']],
    home: 'на главную', menu: 'Меню', sections: 'Разделы сайта', pages: 'Страницы сайта',
    book: 'Записаться', call: 'Позвонить', callFull: 'Позвонить', pickPhone: 'Кому позвонить?', close: 'Закрыть', switchTo: 'UA', switchLabel: 'Українська версія',
    allServices: 'Все услуги', ice: 'Бензин / дизель', hyb: 'Гибриды', ev: 'Электромобили', filter: 'Фильтр услуг',
    showAll: 'Показать все услуги', collapse: 'Свернуть', from: 'от', uah: 'грн', onRequest: 'по запросу', kindHyb: 'гибрид', kindIce: 'ДВС',
    address: 'Адрес', phone: 'Телефон', email: 'Почта', hours: 'График', messengers: 'Мессенджеры', routeGoogle: 'Маршрут в Google Maps', map: 'Карта',
    rating: (n: number) => `Оценка ${n} из 5`, allReviews: 'Все отзывы', mapsReviews: 'Отзывы в Google Картах',
    f: {
      types: ['Бензин / дизель', 'Газ / ГБО', 'Гибрид', 'Электромобиль'], first: 'Не знаю, нужна диагностика', other: 'Другое',
      type: 'Тип авто', car: 'Марка и модель', carPh: 'Напр. Nissan Leaf 2019', svc: 'Что нужно сделать',
      vin: 'VIN-код (необязательно)', vinPh: '17 символов из техпаспорта', vinErr: 'VIN состоит из 17 латинских букв и цифр, без I, O и Q.',
      day: 'День', loading: 'Загружаем свободное время…', noSlots: 'В ближайшее время свободных окон нет. Позвоните, найдём вариант.',
      time: 'Время', busy: 'Занято', name: 'Ваше имя', phone: 'Телефон', phoneErr: 'Укажите номер в формате +380 XX XXX XX XX, чтобы мы могли подтвердить запись.',
      note: 'Что беспокоит (необязательно)', notePh: 'Стук спереди справа на неровностях, горит чек…',
      consent: 'Нажимая кнопку, вы соглашаетесь на обработку персональных данных и звонок для подтверждения записи.', privacy: 'Политика конфиденциальности',
      sending: 'Отправляем…', send: 'Отправить заявку', pickTime: 'Выберите день и время визита.',
      fail: 'Не удалось отправить заявку. Позвоните нам, пожалуйста.', offline: 'Нет связи с сервером. Попробуйте ещё раз или позвоните.',
      done: 'Заявка отправлена', toHome: 'На главную', homeHref: '/ru/',
    },
  },
} as const;

export type FormText = (typeof T)['uk']['f'] | (typeof T)['ru']['f'];
