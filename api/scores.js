// Simple JSON "database" for Wealth Wise class records.
//
//   POST   /api/scores   anyone: a student's finished round is saved
//   GET    /api/scores   teacher PIN required: returns every saved round
//   DELETE /api/scores   teacher PIN required: deletes every saved round
//
// Storage:
//   - On Vercel (production): one small JSON file per round in Vercel Blob, so two
//     students finishing at the same moment can never overwrite each other.
//     Needs the BLOB_READ_WRITE_TOKEN variable, which Vercel adds when you connect a Blob store.
//   - On your own computer (npm run dev): a single file, data/scores.json.
//
// Vercel's servers cannot save normal files, which is why production uses Blob.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const MAX_RECORDS = 2000;
const MAX_BODY = 4096;
const BADGES = new Set(['first-roll','sharp-start','streak3','streak5','lap','easy3','avg3','hard2','quick','comeback','century','perfect']);
const USE_BLOB = !!process.env.BLOB_READ_WRITE_TOKEN;
const ON_VERCEL = !!process.env.VERCEL;
const FILE = process.env.SCORES_FILE || path.join(process.cwd(), 'data', 'scores.json');

function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}

async function readBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') { if (req.body.length > MAX_BODY) throw new Error('too_large'); return JSON.parse(req.body); }
    if (Buffer.isBuffer(req.body)) { if (req.body.length > MAX_BODY) throw new Error('too_large'); return JSON.parse(req.body.toString('utf8')); }
    return req.body;
  }
  let size = 0; const chunks = [];
  for await (const c of req) { size += c.length; if (size > MAX_BODY) throw new Error('too_large'); chunks.push(c); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

function pinOk(req) {
  const want = process.env.TEACHER_PIN || '';
  const got = String(req.headers['x-teacher-pin'] || '');
  const a = crypto.createHash('sha256').update(want).digest();
  const b = crypto.createHash('sha256').update(got).digest();
  return crypto.timingSafeEqual(a, b);
}

// Accept only the fields we expect, with sensible limits.
function cleanRecord(b) {
  if (!b || typeof b !== 'object') return null;
  const name = String(b.name ?? '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 40) || 'Guest';
  const score = Number(b.score), correct = Number(b.correct);
  if (!Number.isFinite(score) || score < 0 || score > 250) return null;
  if (!Number.isFinite(correct) || correct < 0 || correct > 10) return null;
  const badges = (Array.isArray(b.badges) ? b.badges : []).filter(x => BADGES.has(x)).slice(0, 12);
  return { name, score: Math.round(score), correct: Math.round(correct), total: 10, badges, at: new Date().toISOString() };
}

/* ---------- storage: local file ---------- */
let chain = Promise.resolve();
const queue = fn => (chain = chain.then(fn, fn));
async function fileRead() {
  try { const j = JSON.parse(await fs.readFile(FILE, 'utf8')); return Array.isArray(j) ? j : []; }
  catch (e) { return []; }
}
async function fileWrite(rows) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(rows, null, 2));
}

/* ---------- storage: Vercel Blob ---------- */
async function blobUrls() {
  const { list } = await import('@vercel/blob');
  const urls = []; let cursor;
  do {
    const r = await list({ prefix: 'scores/', limit: 1000, cursor });
    for (const b of r.blobs) urls.push(b.url);
    cursor = r.hasMore ? r.cursor : undefined;
  } while (cursor && urls.length < MAX_RECORDS);
  return urls.slice(0, MAX_RECORDS);
}

const store = {
  async add(rec) {
    if (USE_BLOB) {
      const { put } = await import('@vercel/blob');
      await put(`scores/${Date.now()}.json`, JSON.stringify(rec), { access: 'public', contentType: 'application/json', addRandomSuffix: true });
    } else {
      await queue(async () => { const rows = await fileRead(); rows.push(rec); await fileWrite(rows.slice(-MAX_RECORDS)); });
    }
  },
  async all() {
    if (USE_BLOB) {
      const urls = await blobUrls(); const rows = [];
      for (let i = 0; i < urls.length; i += 25) {
        const part = await Promise.all(urls.slice(i, i + 25).map(u => fetch(u, { cache: 'no-store' }).then(r => r.json()).catch(() => null)));
        rows.push(...part.filter(Boolean));
      }
      return rows;
    }
    return queue(fileRead);
  },
  async clear() {
    if (USE_BLOB) {
      const { del } = await import('@vercel/blob');
      const urls = await blobUrls();
      for (let i = 0; i < urls.length; i += 100) await del(urls.slice(i, i + 100));
    } else {
      await queue(() => fileWrite([]));
    }
  }
};

export default async function handler(req, res) {
  try {
    const method = req.method;
    if (!['GET', 'POST', 'DELETE'].includes(method)) { res.setHeader('Allow', 'GET, POST, DELETE'); return send(res, 405, { error: 'method_not_allowed' }); }

    // Production without a Blob store connected: say so clearly instead of failing silently.
    if (ON_VERCEL && !USE_BLOB) return send(res, 503, { error: 'storage_not_configured' });

    if (method === 'POST') {
      let body; try { body = await readBody(req); } catch (e) { return send(res, e.message === 'too_large' ? 413 : 400, { error: 'bad_request' }); }
      const rec = cleanRecord(body);
      if (!rec) return send(res, 400, { error: 'bad_record' });
      await store.add(rec);
      return send(res, 201, { ok: true });
    }

    // GET and DELETE are for the teacher only.
    if (!process.env.TEACHER_PIN) return send(res, 503, { error: 'pin_not_set' });
    if (!pinOk(req)) return send(res, 401, { error: 'wrong_pin' });

    if (method === 'GET') return send(res, 200, { records: await store.all() });
    await store.clear();
    return send(res, 200, { ok: true });
  } catch (e) {
    console.error('scores api error:', e && e.message);
    return send(res, 500, { error: 'server_error' });
  }
}
