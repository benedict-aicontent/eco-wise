/* Eco Wise auto-player (for testing).
   Plays full rounds by itself with random answers, then starts the next round.

   HOW TO USE
   1. Open the game in your browser (your Vercel link, or http://localhost:3000).
   2. Press F12 (or right-click > Inspect), open the "Console" tab.
      If the console asks you to type "allow pasting", type it and press Enter.
   3. Change the settings below if you want, paste this whole file, press Enter.
   4. To stop early, type  stopAutoPlay()  in the console and press Enter.

   By default NOTHING is sent to your class records, so a test never pollutes real scores.
   Set SAVE_TO_RECORDS = true only if you really want the test rounds saved online
   (they get random names such as "Maria D.", or "Test 1" if RANDOM_NAMES is false, and can only be removed from the Vercel Blob
   store, or with "Clear all", which deletes every record). */
(async () => {
  const ROUNDS = 5;               // how many full rounds to play
  const SAVE_TO_RECORDS = false;  // false = dry run, nothing is sent to the server
  const PAUSE_MS = 150;           // wait between actions; raise it to watch more slowly
  const RANDOM_NAMES = true;      // true = each round uses a random Filipino name; false = "Test 1", "Test 2", ...
  const NAME_PREFIX = 'Test';     // used only when RANDOM_NAMES is false
  const NAMES = ['Juan','Maria','Jose','Ana','Carlo','Angel','Mark','Joy','Rico','Bea','Paolo','Grace','Miguel','Jessa','Nico','Trisha','Kenneth','Aira','Renz','Cherry','Jomar','Lyka','Dennis','Mika','Gabriel','Shane','Ryan','Kim','Jericho','Alyssa'];
  const SURNAME_INITIALS = 'ABCDEFGHIJKLMNOPRSTV';

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const $ = s => document.querySelector(s);
  const shown = el => !!el && !el.closest('[hidden]');
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const nameFor = n => RANDOM_NAMES ? `${pick(NAMES)} ${pick([...SURNAME_INITIALS])}.` : `${NAME_PREFIX} ${n}`;
  let stop = false, currentName = '';
  window.stopAutoPlay = () => { stop = true; console.log('Auto-play will stop after the current step.'); };

  const realFetch = window.fetch;
  if (!SAVE_TO_RECORDS) {
    window.fetch = (u, o) => (String(u).includes('/api/scores') && o && o.method === 'POST')
      ? Promise.resolve(new Response('{"ok":true}', { status: 201, headers: { 'content-type': 'application/json' } }))
      : realFetch(u, o);
  }

  async function waitFor(fn, ms = 20000) {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { if (stop) return null; const v = fn(); if (v) return v; await sleep(80); }
    return null;
  }

  async function playOneRound(n) {
    if (shown($('#welcome'))) {
      const who = nameFor(n); currentName = who;
      $('#pname').value = who;
      $('#pname').dispatchEvent(new Event('input', { bubbles: true }));
      const b = await waitFor(() => { const x = $('#begin'); return x && !x.disabled && x; });
      if (!b) throw new Error('The Begin button never became ready (questions.json not loaded?).');
      b.click();
    }
    const t0 = Date.now();
    while (!shown($('#results'))) {
      if (stop) return false;
      if (Date.now() - t0 > 240000) throw new Error('Round took too long, stopping.');
      const next = $('#next');
      if (shown(next)) { next.click(); }
      else if (shown($('#scrim')) && $('#dialog')) {
        const answers = [...document.querySelectorAll('#dialog .ans')];
        const box = $('#idin');
        if (answers.length) pick(answers).click();
        else if (box && !box.value) {
          box.value = pick(['pera', 'ipon', 'badyet', 'utang', 'hindi alam', 'xyz']);
          $('#idform').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        }
      } else if (shown($('#game'))) {
        const r = $('#roll'); if (r && !r.disabled) r.click();
      }
      await sleep(PAUSE_MS);
    }
    return true;
  }

  console.log(`Auto-play started: ${ROUNDS} round(s), ${SAVE_TO_RECORDS ? 'SAVING to class records' : 'dry run (nothing saved online)'}.`);
  const table = [];
  try {
    for (let n = 1; n <= ROUNDS && !stop; n++) {
      const ok = await playOneRound(n);
      if (!ok) break;
      await sleep(600); // let the results screen and the save finish
      let s = {}; try { s = { score: S.score, correct: S.correct, total: TOTAL_Q }; } catch (e) {}
      table.push({ round: n, player: currentName, ...s });
      console.log(`Round ${n} finished`, s);
      if (n < ROUNDS) { $('#again').click(); await sleep(400); }
    }
  } catch (e) { console.error('Auto-play stopped:', e.message); }
  window.fetch = realFetch;
  console.table(table);
  console.log('Auto-play done.');
})();
