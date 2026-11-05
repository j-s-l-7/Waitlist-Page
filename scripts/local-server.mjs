// Local stand-in for Vercel: serves dist/ and routes /api/* to the real handlers.
// Usage: npm run serve:local   (needs .env.local with DATABASE_URL; writes to the real database)
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const repo = path.resolve(process.argv[2] || '.');
const port = Number(process.argv[3] || 4173);
const load = (p) => import(pathToFileURL(path.join(repo, p)).href).then((m) => m.default);
const routes = {
    '/api/waitlist': await load('api/waitlist.js'),
    '/api/waitlist/count': await load('api/waitlist/count.js'),
    '/api/health': await load('api/health.js'),
};
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };

http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);
    const handler = routes[url.pathname];
    if (handler) {
        let raw = '';
        for await (const chunk of req) raw += chunk;
        let body;
        try { body = raw ? JSON.parse(raw) : undefined; } catch { body = raw; }
        Object.defineProperty(req, 'body', { value: body });
        res.status = (c) => { res.statusCode = c; return res; };
        res.json = (o) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); return res; };
        console.log(new Date().toISOString(), req.method, url.pathname);
        return handler(req, res);
    }
    const file = path.join(repo, 'dist', url.pathname === '/' ? 'index.html' : url.pathname);
    if (!file.startsWith(path.join(repo, 'dist'))) { res.statusCode = 403; return res.end(); }
    try {
        const data = await readFile(file);
        res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
        res.end(data);
    } catch {
        res.statusCode = 404; res.end('not found');
    }
}).listen(port, () => console.log(`listening on http://localhost:${port}`));
