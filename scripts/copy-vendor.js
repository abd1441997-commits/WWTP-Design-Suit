'use strict';
// Copies third-party runtime files into www/ so the app works fully offline (no CDN, no network at run time).
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
const cp = (from, to) => { fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(path.join(root, from), path.join(root, to)); };
cp('node_modules/jspdf/dist/jspdf.umd.min.js', 'www/vendor/jspdf.umd.min.js');
cp('node_modules/jspdf-autotable/dist/jspdf.plugin.autotable.min.js', 'www/vendor/jspdf.plugin.autotable.min.js');
for (const w of [400, 500, 600, 700]) {
  cp(`node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-${w}-normal.woff2`, `www/fonts/ibm-plex-sans-latin-${w}-normal.woff2`);
  cp(`node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-${w}-normal.woff2`, `www/fonts/jetbrains-mono-latin-${w}-normal.woff2`);
}
console.log('vendor + fonts copied');
