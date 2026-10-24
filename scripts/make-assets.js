'use strict';
// Generates the app icon, adaptive-icon layers, splash screens and PWA icons (no fonts / external tools needed).
const sharp = require('sharp'), fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
fs.mkdirSync(path.join(root, 'assets'), { recursive: true });
fs.mkdirSync(path.join(root, 'www/icons'), { recursive: true });

const grid = (size, step, op) => { let g = ''; for (let i = step; i < size; i += step) g += `<path d="M${i} 0V${size}M0 ${i}H${size}" />`; return `<g stroke="#7FB5B0" stroke-opacity="${op}" stroke-width="2" fill="none">${g}</g>`; };
const defs = `<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#14405E"/><stop offset="1" stop-color="#081D2B"/></linearGradient>
  <linearGradient id="dr" x1="0.2" y1="0" x2="0.8" y2="1"><stop offset="0" stop-color="#2CC9BA"/><stop offset="1" stop-color="#0B7A72"/></linearGradient>
</defs>`;
// droplet + stepped hydraulic profile, drawn on a 1024 canvas and scaled about its centre
const mark = (scale, cx, cy) => `<g transform="translate(${cx} ${cy}) scale(${scale}) translate(-512 -512)">
  <path d="M512 130C512 130 262 420 262 625A250 250 0 0 0 762 625C762 420 512 130 512 130Z" fill="url(#dr)"/>
  <path d="M512 175C512 175 330 400 318 560" fill="none" stroke="#fff" stroke-opacity=".22" stroke-width="26" stroke-linecap="round"/>
  <path d="M346 540H430L452 592H534L556 644H638L660 696H714" fill="none" stroke="#fff" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="346" cy="540" r="22" fill="#fff"/><circle cx="714" cy="696" r="22" fill="#0B2536" stroke="#fff" stroke-width="12"/>
</g>`;
const svg = (size, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${defs}${body}</svg>`;
const out = (name, s, size, file) => sharp(Buffer.from(s)).resize(size, size).png().toFile(file).then(() => console.log('wrote', path.relative(root, file)));

(async () => {
  const bgRect = n => `<rect width="${n}" height="${n}" fill="url(#bg)"/>`;
  const iconOnly = svg(1024, bgRect(1024) + grid(1024, 64, 0.07) + mark(0.86, 512, 520));
  await out('icon-only', iconOnly, 1024, path.join(root, 'assets/icon-only.png'));
  await out('icon-foreground', svg(1024, mark(0.74, 512, 520)), 1024, path.join(root, 'assets/icon-foreground.png'));
  await out('icon-background', svg(1024, bgRect(1024) + grid(1024, 64, 0.07)), 1024, path.join(root, 'assets/icon-background.png'));
  const splash = svg(2732, bgRect(2732) + grid(2732, 128, 0.05) + mark(0.9, 1366, 1366) + `<rect x="0" y="2700" width="2732" height="32" fill="#0E7C74"/>`);
  await out('splash', splash, 2732, path.join(root, 'assets/splash.png'));
  await out('splash-dark', splash, 2732, path.join(root, 'assets/splash-dark.png'));
  // PWA icons
  for (const [n, s] of [['icon-192', 192], ['icon-512', 512], ['apple-touch-icon', 180]]) await out(n, iconOnly, s, path.join(root, 'www/icons', n + '.png'));
  await out('maskable', svg(1024, bgRect(1024) + grid(1024, 64, 0.07) + mark(0.7, 512, 520)), 512, path.join(root, 'www/icons/icon-maskable-512.png'));
})().catch(e => { console.error(e); process.exit(1); });
