// Tiny local server so you can try the whole game on your computer:  npm run dev
// Serves index.html and the same /api/scores code that Vercel runs. Records go to data/scores.json.
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
  res.statusCode = 404; res.end('Not found');
}).listen(port, () => console.log(`Wealth Wise running at http://localhost:${port}`));
