import type { APIRoute } from 'astro';
import { getContent } from '../lib/store';

export const GET: APIRoute = async ({ url }) => {
  const { settings } = await getContent();
  const origin = (settings.siteUrl || url.origin).replace(/\/$/, '');
  return new Response(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n\nSitemap: ${origin}/sitemap.xml\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
