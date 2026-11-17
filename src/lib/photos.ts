import { ALL_ARTICLES } from './articles';

// Місця на сайті, куди через адмінку можна завантажити фото (квадрат 1:1).
// Поки фото немає, на сторінці стоїть біла заглушка.
export const PHOTO_SLOTS: { id: string; label: string; page: string }[] = [
  { id: 'about-facade', label: 'Сервіс зовні, в’їзд', page: '/pro-nas/' },
  { id: 'about-workshop', label: 'Робоча зона, пости', page: '/pro-nas/' },
  { id: 'about-tesla', label: 'Tesla на підйомнику', page: '/pro-nas/' },
  { id: 'about-team', label: 'Команда', page: '/pro-nas/' },
  { id: 'model-3', label: 'Tesla Model 3 у сервісі', page: '/servis-tesla/model-3/' },
  { id: 'model-y', label: 'Tesla Model Y у сервісі', page: '/servis-tesla/model-y/' },
  { id: 'model-s', label: 'Tesla Model S у сервісі', page: '/servis-tesla/model-s/' },
  { id: 'model-x', label: 'Tesla Model X у сервісі', page: '/servis-tesla/model-x/' },
  ...ALL_ARTICLES.map((a) => ({ id: `article-${a.slug}`, label: `Стаття: ${a.title}`, page: `/statti/${a.slug}/` })),
];
