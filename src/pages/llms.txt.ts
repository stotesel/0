import type { APIRoute } from 'astro';
import { getContent, getServices } from '../lib/store';
import { ALL_ARTICLES } from '../lib/articles';
import { TESLA_MODELS } from '../lib/teslaModels';
import { addressLine, districtList, price } from '../lib/site';

/** Короткий опис сайту для ШІ-пошуку (ChatGPT, Perplexity тощо): хто ми, де, що робимо, ціни. */
export const GET: APIRoute = async ({ url }) => {
  const [{ settings: s }, services] = await Promise.all([getContent(), getServices()]);
  const o = (s.siteUrl || url.origin).replace(/\/$/, '');
  const lines = [
    `# ${s.name}`,
    '',
    `> Автосервіс у Києві (${addressLine(s)}${districtList(s).length ? `; райони поруч: ${districtList(s).join(', ')}` : ''}). Спеціалізація: ремонт і обслуговування Tesla Model S, 3, X, Y та інших електромобілів, а також бензинових, дизельних і гібридних авто. Працюємо за попереднім записом. ${s.hoursText}. Телефон ${s.phone}.`,
    '',
    '## Основні сторінки',
    `- [Сервіс Tesla](${o}/servis-tesla/): ремонт і ТО Tesla, діагностика батареї, тепловий насос, ходова`,
    ...TESLA_MODELS.map((m) => `- [Tesla ${m.name}](${o}/servis-tesla/${m.slug}/): ${m.lead}`),
    `- [Відгуки](${o}/vidguky/)`,
    `- [Про нас](${o}/pro-nas/)`,
    `- [Контакти і як доїхати](${o}/kontakty/)`,
    `- [Русская версия](${o}/ru/)`,
    '',
    '## Послуги і ціни (робота, без запчастин)',
    ...services.map((x) => `- [${x.title}](${o}/${x.slug}/): ${x.summary}. ${x.price_from > 0 ? `від ${price(x.price_from)} грн` : 'ціна за запитом'}, ${x.duration}`),
    '',
    '## Статті',
    ...ALL_ARTICLES.map((a) => `- [${a.title}](${o}/statti/${a.slug}/): ${a.lead}`),
    '',
  ];
  return new Response(lines.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
