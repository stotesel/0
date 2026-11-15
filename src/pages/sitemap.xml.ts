import type { APIRoute } from 'astro';
import { getContent, getServices } from '../lib/store';

export const GET: APIRoute = async ({ url }) => {
  const [{ settings }, services] = await Promise.all([getContent(), getServices()]);
  const origin = (settings.siteUrl || url.origin).replace(/\/$/, '');
  const paths = ['/', '/poslugy/', '/tsiny/', '/zapchastyny/', '/kontakty/', ...services.map((s) => `/${s.slug}/`)];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${paths.map((p) => `  <url><loc>${origin}${p}</loc></url>`).join('\n')}
</urlset>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
