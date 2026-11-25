#!/usr/bin/env node
// Image de présentation de la fiche Play Store (1024×500), une par langue : titre du visuel 1 à gauche, un téléphone et
// une montre Wear OS à droite.
//
//   node generate-feature.mjs               21 langues
//   node generate-feature.mjs --lang fr,de
//
// Sortie : out/play-feature/<langue>.png

import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';
import { FALLBACK_LANG, LANGS, STYLE } from './config.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const W = 1024, H = 500;
const TEXTS = JSON.parse(readFileSync(join(ROOT, 'texts.json'), 'utf8'));
const args = process.argv.slice(2);
const langs = args.includes('--lang') ? args[args.indexOf('--lang') + 1].split(',') : LANGS;

const dataUrl = (p) => `data:image/png;base64,${readFileSync(p).toString('base64')}`;
const raw = (dir, lang, n) => {
  for (const l of [lang, FALLBACK_LANG]) {
    const p = join(ROOT, 'raw', dir, l, `${n}.png`);
    if (existsSync(p)) return pathToFileURL(p).href;
  }
  return '';
};
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

// Appareils : cadre, position (top, left) et hauteur ; `round` pour la montre.
const phone = { frame: dataUrl(join(ROOT, 'frames/android.png')), dir: 'android', n: 1, top: 60, left: 660, height: 800 };
const watch = { frame: dataUrl(join(ROOT, 'frames/wear.png')), dir: 'wear', n: 1, top: 255, left: 545, height: 245, round: true };

const html = (lang) => {
  const [l1, l2] = TEXTS[lang][0];
  const device = (d) => `<div class="device" data-round="${!!d.round}" style="top:${d.top}px;left:${d.left}px;height:${d.height}px">
    <div class="screen"><img class="shot" src="${raw(d.dir, lang, d.n)}"></div><img class="frame" src="${d.frame}"></div>`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  @font-face { font-family: NouvelR; font-weight: 400; src: url("${pathToFileURL(join(ROOT, 'fonts/NouvelRRegular.ttf')).href}"); }
  @font-face { font-family: NouvelR; font-weight: 700; src: url("${pathToFileURL(join(ROOT, 'fonts/NouvelRBold.ttf')).href}"); }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: ${W}px; height: ${H}px; overflow: hidden; position: relative;
    background: linear-gradient(to right, ${STYLE.gradientFrom}, ${STYLE.gradientTo}); }
  .title { position: absolute; left: 48px; top: 0; bottom: 0; width: 460px; display: flex; flex-direction: column;
    justify-content: center; font: 400 46px/1.1 NouvelR; color: ${STYLE.titleColor}; }
  .title span { white-space: nowrap; }
  .title .accent { font-weight: 700; color: ${STYLE.accentColor}; }
  .device { position: absolute; }
  .screen { position: absolute; overflow: hidden; background: #111; }
  .shot { width: 100%; height: 100%; object-fit: cover; object-position: top; display: block; }
  .frame { position: absolute; inset: 0; width: 100%; height: 100%; }
  .device[data-round="true"] { filter: drop-shadow(0 6px 14px rgba(0,0,0,.35)); }
</style></head><body>
<h1 class="title"><span>${esc(l1)}</span><span class="accent">${esc(l2)}</span></h1>
${device(phone)}${device(watch)}
<script>
  const loaded = (img) => img.complete ? Promise.resolve() : new Promise((r) => { img.onload = r; img.onerror = r; });
  function hole(img) {
    const w = img.naturalWidth, h = img.naturalHeight;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
    const a = ctx.getImageData(0, 0, w, h).data;
    const opaque = (x, y) => a[(y * w + x) * 4 + 3] > 128;
    const cy = Math.round(h / 2), cx = Math.round(w / 4);
    let left = Math.round(w / 2); while (left > 0 && !opaque(left - 1, cy)) left--;
    let right = Math.round(w / 2); while (right < w - 1 && !opaque(right + 1, cy)) right++;
    let top = h, bottom = 0;
    for (const x of [cx, Math.round(w / 2), Math.round((3 * w) / 4)]) {
      let t = cy; while (t > 0 && !opaque(x, t - 1)) t--;
      let b = cy; while (b < h - 1 && !opaque(x, b + 1)) b++;
      top = Math.min(top, t); bottom = Math.max(bottom, b);
    }
    let d = 0, inFrame = false;
    for (; d < (right - left) / 2; d++) { if (opaque(left + d, top + d)) inFrame = true; else if (inFrame) break; }
    return { left, top, width: right - left + 1, height: bottom - top + 1, radius: d / (Math.SQRT2 - 1), w, h };
  }
  window.ready = (async () => {
    await document.fonts.ready;
    await Promise.all([...document.querySelectorAll('img')].map(loaded));
    for (const el of document.querySelectorAll('.device')) {
      const frame = el.querySelector('.frame'), screen = el.querySelector('.screen');
      const ho = hole(frame), k = parseFloat(el.style.height) / ho.h;
      el.style.width = ho.w * k + 'px';
      Object.assign(screen.style, { left: ho.left * k + 'px', top: ho.top * k + 'px', width: ho.width * k + 'px',
        height: ho.height * k + 'px',
        borderRadius: (el.dataset.round === 'true' ? Math.min(ho.width, ho.height) / 2 : ho.radius) * k + 'px' });
    }
  })();
</script></body></html>`;
};

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: W, height: H } });
mkdirSync(join(ROOT, 'out/play-feature'), { recursive: true });
const tmp = join(ROOT, 'out/.feature.html');
for (const lang of langs) {
  if (!TEXTS[lang]) { console.log(`! ${lang} : pas de textes`); continue; }
  (await import('node:fs')).writeFileSync(tmp, html(lang));
  await page.goto(pathToFileURL(tmp).href);
  await page.evaluate(() => window.ready);
  await page.screenshot({ path: join(ROOT, `out/play-feature/${lang}.png`), clip: { x: 0, y: 0, width: W, height: H } });
  console.log(`✓ ${lang}`);
}
await browser.close();
(await import('node:fs')).rmSync(tmp, { force: true });
