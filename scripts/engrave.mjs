// Перетворює фото авто (вид зверху) на «гравюру» для першого екрана:
// повертає на 90°, лишає контури як є, тони передає штрихуванням.
// Запуск: node scripts/engrave.mjs [шлях до фото]
// Результат: public/img/tesla-engraving.webp (світлі штрихи на прозорому тлі)
//            public/img/tesla-glass.webp     (шар підсвітки скла)
import sharp from 'sharp';

const SRC = process.argv[2] ?? 'img/tesla-top-source.jpg';
const W = 1200;
const GLASS_T = +(process.env.GLASS_T ?? 80); // поріг яскравості скла, 0–255

const rotated = await sharp(SRC).rotate(90).png().toBuffer(); // спершу поворот, потім масштаб
const base = sharp(rotated).resize({ width: W }).greyscale().extractChannel(0);
const { data: raw, info } = await base.clone().raw().toBuffer({ resolveWithObject: true });
const H = info.height, N = W * H;
// Вихідний рендер освітлений по-різному з двох боків. Авто симетричне, тому беремо
// краще освітлену половину і віддзеркалюємо її: контури ті самі, тон рівний.
const mid = H >> 1, seam = 5; // кілька рядків біля осі змішані з темною половиною, їх замінюємо сусіднім
for (let y = 0; y < mid; y++) for (let x = 0; x < W; x++) {
  const v = raw[Math.min(y, mid - seam) * W + x];
  raw[y * W + x] = v; raw[(H - 1 - y) * W + x] = v;
}
if (info.channels !== 1) throw new Error('очікується один канал');
const blur = async (buf, sigma) => {
  const b = await sharp(buf, { raw: { width: W, height: H, channels: 1 } }).blur(sigma).toColourspace('b-w').raw().toBuffer();
  if (b.length !== N) throw new Error('розмиття повернуло не один канал');
  return b;
};
const L = new Float32Array(N); for (let i = 0; i < N; i++) L[i] = raw[i] / 255;
const soft = await blur(raw, 1.3), wide = await blur(raw, 6);

/* 1. Маска авто: заливка білого тла від країв кадру */
const bg = new Uint8Array(N), stack = [];
const push = (x, y) => { const i = y * W + x; if (!bg[i] && raw[i] > 236) { bg[i] = 1; stack.push(i); } };
for (let x = 0; x < W; x++) { push(x, 0); push(x, H - 1); }
for (let y = 0; y < H; y++) { push(0, y); push(W - 1, y); }
while (stack.length) {
  const i = stack.pop(), x = i % W, y = (i / W) | 0;
  if (x > 0) push(x - 1, y); if (x < W - 1) push(x + 1, y); if (y > 0) push(x, y - 1); if (y < H - 1) push(x, y + 1);
}
const maskRaw = Buffer.alloc(N); for (let i = 0; i < N; i++) maskRaw[i] = bg[i] ? 0 : 255;
const mask = await blur(maskRaw, 1.2);

/* 2. Контури: оператор Собеля по трохи згладженому зображенню + силует */
const sobel = (src) => {
  const out = new Float32Array(N);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x;
    const gx = -src[i - W - 1] - 2 * src[i - 1] - src[i + W - 1] + src[i - W + 1] + 2 * src[i + 1] + src[i + W + 1];
    const gy = -src[i - W - 1] - 2 * src[i - W] - src[i - W + 1] + src[i + W - 1] + 2 * src[i + W] + src[i + W + 1];
    out[i] = Math.hypot(gx, gy) / 255;
  }
  return out;
};
const edge = sobel(soft), outline = sobel(await blur(maskRaw, 1.6));
const smooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

/* 3. Штрихування: товщина лінії залежить від яскравості, на світлих місцях додається перехресний штрих */
const hatch = (x, y, angle, period, tone, wave = 0) => {
  const u = x * Math.sin(angle) + y * Math.cos(angle) + wave * Math.sin((x * Math.cos(angle) - y * Math.sin(angle)) / 46);
  const d = Math.abs(((u % period) + period) % period - period / 2);
  return Math.min(1, Math.max(0, (period / 2) * tone - d + 0.5));
};

const out = Buffer.alloc(N * 4), glass = Buffer.alloc(N * 4);
// Скло: темні ділянки всередині авто. Розмиття з порогом прибирає дрібні плями й тонкі щілини.
const glassMaskRaw = Buffer.alloc(N);
for (let i = 0; i < N; i++) glassMaskRaw[i] = !bg[i] && wide[i] < GLASS_T ? 255 : 0;
const eroded = await blur(glassMaskRaw, 5);
for (let i = 0; i < N; i++) glassMaskRaw[i] = eroded[i] > 140 ? 255 : 0;
// Заливка від країв: усе «не скло», до якого не дістатися ззовні, є діркою всередині скла.
const outside = new Uint8Array(N), st = [];
const add = (x, y) => { const i = y * W + x; if (!outside[i] && !glassMaskRaw[i]) { outside[i] = 1; st.push(i); } };
for (let x = 0; x < W; x++) { add(x, 0); add(x, H - 1); }
for (let y = 0; y < H; y++) { add(0, y); add(W - 1, y); }
while (st.length) {
  const i = st.pop(), x = i % W, y = (i / W) | 0;
  if (x > 0) add(x - 1, y); if (x < W - 1) add(x + 1, y); if (y > 0) add(x, y - 1); if (y < H - 1) add(x, y + 1);
}
for (let i = 0; i < N; i++) if (!outside[i]) glassMaskRaw[i] = 255;
// Дрібні темні плями (фари, ліхтарі) не є склом: лишаємо тільки великі ділянки.
const seen = new Uint8Array(N);
for (let s0 = 0; s0 < N; s0++) {
  if (!glassMaskRaw[s0] || seen[s0]) continue;
  const comp = [s0]; seen[s0] = 1;
  for (let k = 0; k < comp.length; k++) {
    const i = comp[k], x = i % W;
    for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) {
      if (j >= 0 && j < N && glassMaskRaw[j] && !seen[j]) { seen[j] = 1; comp.push(j); }
    }
  }
  if (comp.length < N * 0.006) for (const i of comp) glassMaskRaw[i] = 0;
}
const glassMask = await blur(glassMaskRaw, 3);
const glassEdge = sobel(glassMask);

for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const i = y * W + x, m = mask[i] / 255;
  const tone = Math.pow(smooth(0.1, 0.86, soft[i] / 255), 0.85);
  const h1 = hatch(x, y, 1.02, 7, tone * 0.72, 2);
  const h2 = hatch(x, y, -0.62, 8, smooth(0.5, 1, tone) * 0.55);
  const e = Math.max(smooth(0.1, 0.42, edge[i]), smooth(0.25, 0.9, outline[i]));
  const a = Math.max(e, Math.max(h1, h2) * 0.78) * (m > 0.02 ? Math.max(m, e) : e);
  out[i * 4] = 0xE9; out[i * 4 + 1] = 0xEE; out[i * 4 + 2] = 0xF0; out[i * 4 + 3] = Math.round(255 * Math.min(1, a));

  const g = glassMask[i] / 255;
  const ga = Math.max(smooth(0.18, 0.6, glassEdge[i]), hatch(x, y, 1.02, 6, 0.34, 2) * 0.9 * smooth(0.45, 0.6, g));
  glass[i * 4] = 0xF2; glass[i * 4 + 1] = 0x64; glass[i * 4 + 2] = 0x19; glass[i * 4 + 3] = Math.round(255 * Math.min(1, ga));
}
const save = (buf, name) => sharp(buf, { raw: { width: W, height: H, channels: 4 } }).webp({ quality: 82, alphaQuality: 90, effort: 6 }).toFile(`public/img/${name}`);
console.log(W, H, (await save(out, 'tesla-engraving.webp')).size, (await save(glass, 'tesla-glass.webp')).size);

// Попередній перегляд на темному тлі, щоб оцінити результат
await sharp({ create: { width: W, height: H, channels: 4, background: '#0D2A33' } })
  .composite([{ input: await sharp(out, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer() }, ...(process.env.PREVIEW_GLASS ? [{ input: await sharp(glass, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer() }] : [])])
  .png().toFile(process.env.PREVIEW ?? '/dev/null');
