/**
 * Production server for Plonopolis:
 *  - Serves the Vite build from ./public
 *  - SPA fallback: unknown paths → index.html
 */

const http = require('http');
const fs   = require('fs');
const path = require('path');
const url  = require('url');

const PORT       = process.env.PORT || 3000;
const STATIC_DIR = path.join(__dirname, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.mjs':  'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.webp': 'image/webp',
  '.mp3':  'audio/mpeg',
  '.ogg':  'audio/ogg',
  '.wav':  'audio/wav',
};

http.createServer((req, res) => {
  const pathname = url.parse(req.url).pathname;
  const filePath = path.join(STATIC_DIR, pathname);

  fs.stat(filePath, (err, stat) => {
    if (!err && stat.isFile()) {
      const ext  = path.extname(filePath).toLowerCase();
      const mime = MIME[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': mime });
      fs.createReadStream(filePath).pipe(res, { end: true });
    } else {
      // SPA fallback
      const idx = path.join(STATIC_DIR, 'index.html');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      fs.createReadStream(idx).pipe(res, { end: true });
    }
  });
}).listen(PORT, '0.0.0.0', () => {
  console.log(`Plonopolis server on port ${PORT}`);
});
