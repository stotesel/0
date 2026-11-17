import type { APIRoute } from 'astro';
import { isAdmin, json } from '../../../lib/auth';
import { uploadImage } from '../../../lib/store';

const TYPES: Record<string, string> = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' };

/** Завантаження фото з адмінки. Браузер уже обрізав його до квадрата й стиснув. */
export const POST: APIRoute = async ({ cookies, request }) => {
  if (!(await isAdmin(cookies))) return json({ error: 'auth' }, 401);
  const form = await request.formData();
  const file = form.get('file');
  const slot = String(form.get('slot') ?? '').replace(/[^a-z0-9-]/g, '');
  if (!(file instanceof File) || !slot) return json({ error: 'Немає файлу.' }, 400);
  const ext = TYPES[file.type];
  if (!ext) return json({ error: 'Підтримуються JPG, PNG і WebP.' }, 400);
  if (file.size > 5 * 1024 * 1024) return json({ error: 'Файл більший за 5 МБ.' }, 400);
  try {
    const url = await uploadImage(`${slot}-${Date.now()}.${ext}`, await file.arrayBuffer(), file.type);
    return json({ url });
  } catch (e) {
    console.error('upload', e);
    return json({ error: 'Не вдалося завантажити фото.' }, 500);
  }
};
