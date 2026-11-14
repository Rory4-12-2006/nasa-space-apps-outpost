// Automated play-test. Open the game, then in the browser console run:
//   var s=document.createElement('script'); s.src='tests/playtest.js'; document.body.appendChild(s);
// then: await T.runAll()   (results in window.R; progress in R.log)
window.T = (() => {
  const T = {};
  T.errs = []; window.addEventListener('error', (e) => T.errs.push(e.message + ' @' + (e.lineno || '')));
  T.w = (ms) => new Promise((r) => setTimeout(r, ms));
  T.q = (s) => document.querySelector(s);
  T.c = (s) => { const e = T.q(s); if (!e) throw new Error('missing ' + s); if (e.disabled) throw new Error('disabled ' + s); e.click(); };
  T.pe = (el, type, x, y) => el.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1, isPrimary: true }));
  T.ctr = (el) => { const b = el.getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; };
  T.drag = (from, to) => { if (!from || !to) throw new Error('drag target missing'); const [x1, y1] = T.ctr(from), [x2, y2] = T.ctr(to); T.pe(from, 'pointerdown', x1, y1); T.pe(document, 'pointermove', (x1 + x2) / 2, (y1 + y2) / 2); T.pe(document, 'pointermove', x2, y2); T.pe(document, 'pointerup', x2, y2); };
  T.slide = async (inp, v, hold) => { inp.value = v; inp.dispatchEvent(new Event('input', { bubbles: true })); await T.w(hold); };
  T.S = () => window.__sols.S;
  T.click = (el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  T.newGame = async (kit, mode, site, crates) => {
    T.c('[data-action=home]'); T.c('[data-action=start]'); T.c(`[data-action=pick-kitten][data-id=${kit}]`); T.c('#btn-kitten-go');
    T.c(`[data-action=pick-mission][data-id=${mode}]`); T.c(`[data-action=pick-site][data-id=${site}]`);
    for (let i = 0; i < 60 && !T.q('#screen-brief.active'); i++) await T.w(100);
    T.c('[data-action=begin]');
    for (const m of crates) { T.c(`.crate[data-id=${m}]`); const t = [...document.querySelectorAll('#grid .tile.can-place')]; T.click(t[(t.length * 7 + 3) % t.length]); }
    if (!T.q('#btn-launch').disabled) T.c('#btn-launch');
  };
  T.keyOf = (id) => (Object.entries(T.S().tiles).find(([, v]) => v === id) || [])[0];
  T.mission = async (mid, mode) => {
    const st = window.__sols.MISSIONS[mid].station, key = T.keyOf(st);
    if (!key) return 'no-station';
    T.click(T.q(`#grid .station[data-key="${key}"]`)); T.c('[data-action=enter-station]');
    const card = T.q(`[data-action=start-mission][data-id=${mid}]`);
    if (card.disabled) { const b = (card.querySelector('.blocked') || {}).textContent; T.c('[data-action=close-overlay]'); return 'blocked: ' + b; }
    card.click();
    let n = 0; while (T.q('.tool-group.on .tool.drag:not(.used)') && n++ < 10) T.drag(T.q('.tool-group.on .tool.drag:not(.used)'), T.q('#bench'));
    await T.w(600); T.c('[data-action=mg-start]'); await T.w(60);
    if (mode === 'giveup') T.q('#mg-giveup').click();
    else await T.play[T.S().site === 'moon' && mid === 'dust' ? 'turn' : mid]();
    for (let i = 0; i < 20 && !T.q('.room-work .result'); i++) await T.w(100);
    const res = (T.q('.room-work .result h2') || {}).textContent || 'NO RESULT (' + ((T.q('#mg-help') || {}).textContent || '') + ')';
    if (!T.q('.room-work .result')) T.q('#mg-giveup').click();
    T.c('[data-action=close-overlay]'); return res;
  };
  T.play = {
    async dust() { for (const c of [...document.querySelectorAll('.panel-pv canvas')]) { const b = c.getBoundingClientRect(); T.pe(c, 'pointerdown', b.x + 2, b.y + 2); for (let y = 2; y < b.height; y += 8) for (let x = 2; x < b.width; x += 10) T.pe(document, 'pointermove', b.x + x, b.y + y); T.pe(document, 'pointerup', b.x, b.y); } await T.w(300); },
    async turn() { await T.slide(T.q('#mg input[type=range]'), 70, 1400); },
    async battery() { for (const p of [...document.querySelectorAll('.plug')]) T.drag(p, T.q(`.socket[data-c="${p.dataset.c}"]`)); },
    async plant() { for (const t of [...document.querySelectorAll('.gtray')]) T.drag(T.q('.seed'), t); await T.w(50); await T.slide(T.q('#mg input[type=range]'), 57, 1400); },
    async harvest() { for (const p of [...document.querySelectorAll('.produce:not(.unripe)')]) T.drag(p, T.q('.crate-box')); },
    async melt() { for (let i = 0; i < 3; i++) T.drag(T.q('.ice:not(.used)'), T.q('.heater')); await T.w(50); await T.slide(T.q('#mg input[type=range]'), 52, 2900); },
    async recycle() { const sl = [...document.querySelectorAll('.lslot')]; ['gravel', 'charcoal', 'membrane'].forEach((id, i) => T.drag(T.q(`.layer[data-id=${id}]`), sl[i])); T.c('#pour'); },
    async bricks() { for (let i = 0; i < 5; i++) T.drag(T.q('.brick:not(.used)'), T.q('.weak:not(.fixed)')); },
    async wall() { await T.slide(T.q('#mg input[type=range]'), 80, 1400); },
    async scan() { for (let i = 0; i < 3; i++) { const r = T.q('.rock:not(.used)'); T.drag(r, T.q('.scanner')); T.c(`.pat[data-t="${r.dataset.t}"]`); } },
    async sun() {
      const d = T.q('#w-sun').getAttribute('d').trim().split(/[ML]/).filter(Boolean).map((p) => p.trim().split(' ').map(Number));
      const amp = Math.max(...d.map((p) => Math.abs(p[1] - 60))); const a = Math.round((amp - 5) * 2);
      let cross = 0; for (let i = 1; i < d.length; i++) if ((d[i - 1][1] - 60) * (d[i][1] - 60) < 0) cross++;
      const f = Math.round((cross / 2 - 1) * 20);
      for (const ff of [f, f - 4, f + 4, f - 8, f + 8]) { T.q('#d-a').value = a; T.q('#d-f').value = Math.max(0, Math.min(100, ff)); await T.w(1200); if (/Matched/.test((T.q('#mg-help') || {}).textContent || '')) break; }
    }
  };
  T.endSol = (choice) => {
    T.c('#btn-endsol');
    const avail = [...document.querySelectorAll('.choice:not([disabled])')].map((b) => b.dataset.id);
    let pick = null;
    if (T.q('.choice')) { const ask = T.q('[data-action=ask-earth]'); if (ask && !ask.disabled) ask.click(); pick = avail.includes(choice) ? choice : avail[0]; T.c(`.choice[data-id=${pick}]`); }
    const reveal = !!T.q('#modal .deltas');
    T.c('[data-action=next]'); if (T.q('[data-action=family-next]')) T.c('[data-action=family-next]');
    return { pick, avail, reveal };
  };
  T.check = (tag) => {
    const S = T.S(), bad = [];
    for (const k of ['power', 'life', 'health']) if (S[k] < 0 || S[k] > 100 || !Number.isFinite(S[k])) bad.push(k + '=' + S[k]);
    if (S.actionsUsed > 2 || S.actionsUsed < 0) bad.push('actions=' + S.actionsUsed);
    if (!Number.isFinite(S.credits) || S.credits < 0) bad.push('credits=' + S.credits);
    if (document.documentElement.scrollHeight > innerHeight + 2 || document.documentElement.scrollWidth > innerWidth + 2) bad.push('page scrolls');
    return bad.length ? tag + ': ' + bad.join(', ') : null;
  };
  return T;
})();
