// Simple JSON "database" for Eco Wise class records.
//
//   POST   /api/scores   anyone: a student's finished round is saved
//   GET    /api/scores   teacher PIN required: returns every saved round
//   DELETE /api/scores   teacher PIN required: HIDES every saved round (nothing is erased, so it can be restored)
//   POST   /api/scores   {"action":"restore"} with the PIN: brings hidden rounds back
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
const BADGES = new Set(['first-roll','sharp-start','streak3','streak5','lap','easy3','avg3','hard2','quick','comeback','honor','century','perfect']);
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

// Accept only the fields we expect, with sensible limits. The score and round length come from questions.json, so allow generous ranges.
function cleanRecord(b) {
  if (!b || typeof b !== 'object') return null;
  const name = String(b.name ?? '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 40) || 'Guest';
  const score = Number(b.score), correct = Number(b.correct), total = Math.round(Number(b.total));
  if (!Number.isFinite(total) || total < 1 || total > 100) return null;
  if (!Number.isFinite(score) || score < 0 || score > 10000) return null;
  if (!Number.isFinite(correct) || correct < 0 || correct > total) return null;
  const badges = (Array.isArray(b.badges) ? b.badges : []).filter(x => BADGES.has(x)).slice(0, 12);
  // A phone re-sending a round it could not send earlier may include the real time it was played.
  // Only a real past time (within the last 60 days) is accepted; anything else is replaced by the current time.
  let at = new Date(); let recovered = false;
  if (b.playedAt) {
    const t = new Date(String(b.playedAt));
    if (!isNaN(t) && t.getTime() <= Date.now() + 120000 && t.getTime() >= Date.now() - 60 * 864e5) { at = t; recovered = true; }
  }
  const rec = { name, score: Math.round(score), correct: Math.round(correct), total, badges, at: at.toISOString(), savedAt: new Date().toISOString() };
  if (recovered) rec.recovered = true;
  return rec;
}

/* ---------- storage: local file ---------- */
let chain = Promise.resolve();
const queue = fn => (chain = chain.then(fn, fn));
const CLEARED_FILE = FILE + '.cleared';
async function fileRead() {
  try { const j = JSON.parse(await fs.readFile(FILE, 'utf8')); return Array.isArray(j) ? j : []; }
  catch (e) { return []; }
}
async function fileWrite(rows) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(rows, null, 2));
}
async function fileClearedAt() { try { return new Date((await fs.readFile(CLEARED_FILE, 'utf8')).trim()).getTime() || 0; } catch (e) { return 0; } }

/* ---------- storage: Vercel Blob ---------- */
async function blobList(prefix) {
  const { list } = await import('@vercel/blob');
  const out = []; let cursor;
  do {
    const r = await list({ prefix, limit: 1000, cursor });
    for (const b of r.blobs) out.push({ url: b.url, uploadedAt: new Date(b.uploadedAt).getTime() });
    cursor = r.hasMore ? r.cursor : undefined;
  } while (cursor && out.length < MAX_RECORDS);
  return out.slice(0, MAX_RECORDS);
}

// The same round can be stored twice (a phone re-sending history). Keep one copy of rounds that match.
function dedupe(rows) {
  const sorted = rows.slice().sort((a, b) => String(a.at).localeCompare(String(b.at)));
  const seen = new Map(); const out = []; let removed = 0;
  for (const r of sorted) {
    const key = [r.name, r.score, r.correct, r.total, (r.badges || []).join('|')].join('~');
    const t = new Date(r.at).getTime();
    const last = seen.get(key);
    if (last !== undefined && Math.abs(t - last) < 5 * 60000) { removed++; continue; }
    seen.set(key, t); out.push(r);
  }
  return { rows: out, removed };
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
    let raw = [], stored = 0, unreadable = 0, hidden = 0;
    if (USE_BLOB) {
      const [items, marks] = await Promise.all([blobList('scores/'), blobList('meta/cleared-')]);
      const clearedAt = marks.reduce((m, x) => Math.max(m, x.uploadedAt), 0);
      stored = items.length;
      const visible = items.filter(x => x.uploadedAt > clearedAt);
      hidden = items.length - visible.length;
      const get = u => fetch(u, { cache: 'no-store' }).then(r => { if (!r.ok) throw new Error('http_' + r.status); return r.json(); });
      for (let i = 0; i < visible.length; i += 10) {
        const part = await Promise.all(visible.slice(i, i + 10).map(async x => {
          try { return await get(x.url); }
          catch (e) { await new Promise(r => setTimeout(r, 400)); try { return await get(x.url); } catch (e2) { return null; } }
        }));
        for (const x of part) { if (x) raw.push(x); else unreadable++; }
      }
    } else {
      const [rows, clearedAt] = await Promise.all([queue(fileRead), fileClearedAt()]);
      stored = rows.length;
      raw = rows.filter(r => new Date(r.savedAt || r.at).getTime() > clearedAt);
      hidden = rows.length - raw.length;
    }
    const d = dedupe(raw);
    return { rows: d.rows, stored, unreadable, hidden, duplicates: d.removed };
  },
  // "Clear all" only hides what exists now. Nothing is erased, so restore() can bring it back.
  async clear() {
    if (USE_BLOB) {
      const { put } = await import('@vercel/blob');
      await put(`meta/cleared-${Date.now()}.json`, '{}', { access: 'public', contentType: 'application/json', addRandomSuffix: true });
    } else {
      await queue(async () => { await fs.mkdir(path.dirname(FILE), { recursive: true }); await fs.writeFile(CLEARED_FILE, new Date().toISOString()); });
    }
  },
  async restore() {
    if (USE_BLOB) {
      const { del } = await import('@vercel/blob');
      const marks = await blobList('meta/cleared-');
      if (marks.length) await del(marks.map(x => x.url));
    } else {
      await queue(async () => { try { await fs.unlink(CLEARED_FILE); } catch (e) {} });
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
      if (body && body.action === 'restore') {
        if (!process.env.TEACHER_PIN) return send(res, 503, { error: 'pin_not_set' });
        if (!pinOk(req)) return send(res, 401, { error: 'wrong_pin' });
        await store.restore();
        return send(res, 200, { ok: true });
      }
      const rec = cleanRecord(body);
      if (!rec) return send(res, 400, { error: 'bad_record' });
      await store.add(rec);
      return send(res, 201, { ok: true });
    }

    // GET and DELETE are for the teacher only.
    if (!process.env.TEACHER_PIN) return send(res, 503, { error: 'pin_not_set' });
    if (!pinOk(req)) return send(res, 401, { error: 'wrong_pin' });

    if (method === 'GET') { const a = await store.all(); return send(res, 200, { records: a.rows, stored: a.stored, unreadable: a.unreadable, hidden: a.hidden, duplicates: a.duplicates }); }
    await store.clear();
    return send(res, 200, { ok: true });
  } catch (e) {
    console.error('scores api error:', e && e.message);
    // Free-plan storage allows only a few saves per second; tell the page to try again shortly.
    if (/rate|429|too many/i.test(String((e && (e.name + ' ' + e.message)) || ''))) return send(res, 429, { error: 'busy' });
    return send(res, 500, { error: 'server_error' });
  }
}
