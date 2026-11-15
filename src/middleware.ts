import { defineMiddleware } from 'astro:middleware';

// www.stotesel.com.ua веде на основну адресу, щоб у пошуку не було дублів сайту.
export const onRequest = defineMiddleware((context, next) => {
  const { url } = context;
  if (url.hostname.startsWith('www.')) {
    url.hostname = url.hostname.slice(4);
    return Response.redirect(url.toString(), 301);
  }
  return next();
});
