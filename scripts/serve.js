'use strict';
// Tiny static server for local testing of the web/PWA build:  npm run serve  ->  http://localhost:8080
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..', 'www'), port = process.env.PORT || 8080;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(root, p); if (!f.startsWith(root) || !fs.existsSync(f)) { r.writeHead(404); return r.end('Not found'); }
  r.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); fs.createReadStream(f).pipe(r);
}).listen(port, () => console.log('Serving www on http://localhost:' + port));
