// Tiny local server so you can try the whole game on your computer:  npm run dev
// Serves index.html, questions.json and the same /api/scores code that Vercel runs. Records go to data/scores.json.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import handler from './api/scores.js';

if (!process.env.TEACHER_PIN) { process.env.TEACHER_PIN = '1234'; console.log('TEACHER_PIN not set, using 1234 for local testing.'); }
const port = Number(process.env.PORT) || 3000;

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/scores') return handler(req, res);
  if (url.pathname === '/' || url.pathname === '/index.html') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end(await readFile(new URL('./index.html', import.meta.url)));
  }
  if (url.pathname === '/questions.json') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    return res.end(await readFile(new URL('./questions.json', import.meta.url)));
  }
  const types = { '.js': 'text/javascript', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
  const ext = url.pathname.slice(url.pathname.lastIndexOf('.'));
  if (types[ext] && /^\/(sw\.js|manifest\.webmanifest|icons\/[\w-]+\.png)$/.test(url.pathname)) {
    try { res.setHeader('Content-Type', types[ext]); return res.end(await readFile(new URL('.' + url.pathname, import.meta.url))); } catch {}
  }
  res.statusCode = 404; res.end('Not found');
}).listen(port, () => console.log(`Eco Wise running at http://localhost:${port}`));
