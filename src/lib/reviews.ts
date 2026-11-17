import type { Review } from './types';

/** Профіль STOtesel у Google Картах (вкладка відгуків). */
export const MAPS_REVIEWS_URL = 'https://www.google.com/maps/place/STOtesel/@50.4910586,30.4002541,17z/data=!4m8!3m7!1s0x40d4cd18c9de8083:0xc1943be156fb8fb1!8m2!3d50.4910586!4d30.4002541!9m1!1b1';

const MONTHS = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
/** 2026-11-03 → «3 листопада 2026» */
export function reviewDate(date: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  return m ? `${+m[3]} ${MONTHS[+m[2] - 1]} ${m[1]}` : '';
}

/** Підтверджені відгуки з текстом, нові спершу. */
export const approved = (list: Review[]) =>
  list.filter((r) => r.status === 'approved' && r.text.trim()).sort((a, b) => b.date.localeCompare(a.date));

/** Відгуки про Tesla й електромобілі — для сторінок Tesla. */
export const teslaReviews = (list: Review[]) =>
  approved(list).filter((r) => /tesla|тесл|електро/i.test(`${r.car} ${r.text}`));
