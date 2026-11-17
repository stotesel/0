import type { APIRoute } from 'astro';
import { getContent, getServices } from '../lib/store';
import { TESLA_MODELS } from '../lib/teslaModels';
import { ALL_ARTICLES } from '../lib/articles';
import { RU_SERVICES } from '../lib/ru/services';

export const GET: APIRoute = async ({ url }) => {
  const [{ settings }, services] = await Promise.all([getContent(), getServices()]);
  const origin = (settings.siteUrl || url.origin).replace(/\/$/, '');
  const paths = ['/', '/servis-tesla/', ...TESLA_MODELS.map((m) => `/servis-tesla/${m.slug}/`), '/statti/', ...ALL_ARTICLES.map((a) => `/statti/${a.slug}/`), '/vidguky/', '/pro-nas/', '/poslugy/', '/tsiny/', '/zapchastyny/', '/kontakty/', '/polityka-konfidentsiynosti/', ...services.map((s) => `/${s.slug}/`),
    // російська версія
    '/ru/', '/ru/servis-tesla/', ...TESLA_MODELS.map((m) => `/ru/servis-tesla/${m.slug}/`), '/ru/kontakty/',
    ...services.filter((s) => RU_SERVICES[s.slug]).map((s) => `/ru/${s.slug}/`)];
  const lastmod = __BUILD_DATE__;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${paths.map((p) => `  <url><loc>${origin}${p}</loc><lastmod>${lastmod}</lastmod></url>`).join('\n')}
</urlset>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
