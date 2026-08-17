/**
 * Production server for Plonopolis:
 *  - Serves the Vite build from ./public
 *  - Proxies /sb-proxy/* → Supabase (bypasses Opera/Brave DNS-over-HTTPS blocking)
 *  - SPA fallback: unknown paths → index.html
 */

const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const url   = require('url');

const PORT         = process.env.PORT || 3000;
const STATIC_DIR   = path.join(__dirname, 'public');
const SUPABASE_HOST = 'vwgfoevjiliggsgmqacg.supabase.co';

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
  const parsed   = url.parse(req.url);
  const pathname = parsed.pathname;

  // ── Diagnostics ──────────────────────────────────────────────────────────
  if (pathname === '/sb-test') {
    const testReq = https.request(
      { hostname: SUPABASE_HOST, path: '/auth/v1/health', method: 'GET',
        headers: { host: SUPABASE_HOST } },
      (testRes) => {
        let body = '';
        testRes.on('data', d => body += d);
        testRes.on('end', () => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, status: testRes.statusCode, body }));
        });
      },
    );
    testReq.on('error', (err) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: err.message, code: err.code }));
    });
    testReq.end();
    return;
  }

  // ── Supabase proxy ──────────────────────────────────────────────────────
  if (pathname.startsWith('/sb-proxy/')) {
    const upstream = pathname.replace(/^\/sb-proxy/, '') + (parsed.search || '');

    const proxyHeaders = {};
    for (const [k, v] of Object.entries(req.headers)) {
      if (k === 'host') continue;
      if (k === 'accept-encoding') continue;
      proxyHeaders[k] = v;
    }
    proxyHeaders['host'] = SUPABASE_HOST;

    const proxyReq = https.request(
      { hostname: SUPABASE_HOST, path: upstream, method: req.method, headers: proxyHeaders },
      (proxyRes) => {
        const headers = {};
        for (const [k, v] of Object.entries(proxyRes.headers)) {
          if (k === 'transfer-encoding') continue;
          headers[k] = v;
        }
        res.writeHead(proxyRes.statusCode, headers);
        proxyRes.pipe(res, { end: true });
      },
    );
    proxyReq.on('error', (err) => {
      console.error('[proxy error]', err.message);
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    req.pipe(proxyReq, { end: true });
    return;
  }

  // ── Static files ─────────────────────────────────────────────────────────
  const filePath = path.join(STATIC_DIR, pathname);
  fs.stat(filePath, (err, stat) => {
    if (!err && stat.isFile()) {
      const ext  = path.extname(filePath).toLowerCase();
      const mime = MIME[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': mime });
      fs.createReadStream(filePath).pipe(res, { end: true });
    } else {
      const idx = path.join(STATIC_DIR, 'index.html');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      fs.createReadStream(idx).pipe(res, { end: true });
    }
  });
}).listen(PORT, '0.0.0.0', () => {
  console.log(`Plonopolis server on port ${PORT}`);
});

