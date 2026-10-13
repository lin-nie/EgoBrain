/* EgoBrain v12 — page logic: lab interactions, sync demo, charts, gallery. */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const RM = window.ISO.RM;
  const SH = 'shared/';
  const EB = window.EB;
  const ACC = '#FF5B3A', INK = '#1E2142';
  const HAS = id => !!document.getElementById(id);  // a release build may not ship every section yet
  const MINI_HF = 'https://huggingface.co/datasets/ut-vision/EgoBrain-Mini';

  /* ---------------- labels ---------------- */
  // raw Mini label -> [display title, verb, category]
  const LBL = {
    'Operate Computer (Word)': ['Operate Computer (Word)', 'Operate', 'Work'],
    'Operate Computer (Excel)': ['Operate Computer (Excel)', 'Operate', 'Work'],
    'Operate Computer (PowerPoint)': ['Operate Computer (PowerPoint)', 'Operate', 'Work'],
    'Operate Computer (Paint)': ['Operate Computer (Paint)', 'Operate', 'Work'],
    'Watch Computer (Web & Video)': ['Watch Computer (Web & Video)', 'Watch', 'Work'],
    'Watch Smartphone (APP & Video)': ['Watch Smartphone (App & Video)', 'Watch', 'Work'],
    'Play_I Computer game (Mouse)': ['Play (I) · Computer Game (Mouse)', 'Play (I)', 'Play'],
    'Play_I Computer game (Keyboard)': ['Play (I) · Computer Game (Keyboard)', 'Play (I)', 'Play'],
    'Play_II Toys': ['Play (II) · Toys', 'Play (II)', 'Play'],
    'Play_II Cards': ['Play (II) · Cards', 'Play (II)', 'Play'],
    'Play_II Puzzle': ['Play (II) · Puzzle', 'Play (II)', 'Play'],
    'Play_II Cube': ['Play (II) · Cube', 'Play (II)', 'Play'],
    'Play_III Phone game (Simple)': ['Play (III) · Phone Game (Simple)', 'Play (III)', 'Play'],
    'Play_III Phone game (Complex)': ['Play (III) · Phone Game (Complex)', 'Play (III)', 'Play'],
    'Write Copybook': ['Write Copybook', 'Write', 'Learn'],
    'Write Notes': ['Write Notes', 'Write', 'Learn'],
    'Read Textbook': ['Read Textbook', 'Read', 'Learn'],
    'Read Comic-book': ['Read Comic Book', 'Read', 'Learn'],
    'Read Research Article': ['Read Research Article', 'Read', 'Learn'],
    'Draw Pictures': ['Draw Pictures', 'Draw', 'Learn'],
    'Draw Picture Tracing': ['Draw Picture Tracing', 'Draw', 'Learn'],
    'Eat Snack': ['Eat Snack', 'Eat', 'Consume'],
    'Eat Spicy strips': ['Eat Spicy Strips', 'Eat', 'Consume'],
    'Eat Sugers': ['Eat Sugars', 'Eat', 'Consume'],
    'Drink Water': ['Drink Water', 'Drink', 'Consume'],
    'Drink Coca-cola': ['Drink Coca-Cola', 'Drink', 'Consume'],
    'Drink Bitter Gourd Juice': ['Drink Bitter Gourd Juice', 'Drink', 'Consume'],
    'setup calibration': ['Setup Calibration', 'Calibration', 'Calibration'],
    'closing calibration': ['Closing Calibration', 'Calibration', 'Calibration'],
  };
  const VC = { 'Operate': '#F6A54B', 'Watch': '#EF6F6C', 'Play (I)': '#6C7BB5', 'Play (II)': '#4FB6CF', 'Play (III)': '#4CBF8F', 'Write': '#CDAE7A', 'Read': '#9C8BDB', 'Draw': '#3FB3A6', 'Eat': '#B07A57', 'Drink': '#E8C350', 'Calibration': '#A9ADC4' };
  const CATC = { Work: '#F28C5B', Play: '#4C9FC9', Learn: '#8E7CD6', Consume: '#C79A3E', Calibration: '#A9ADC4' };
  const title = raw => (LBL[raw] || [raw])[0];
  const verbOf = raw => (LBL[raw] || [0, 'Calibration'])[1];
  const catOf = raw => (LBL[raw] || [0, 0, 'Calibration'])[2];
  const OBJ = {
    laptop: ['Laptop & mouse', 'Operate Word', ['Operate Computer (Word)', 'Operate Computer (Excel)', 'Operate Computer (PowerPoint)', 'Operate Computer (Paint)', 'Watch Computer (Web & Video)', 'Play_I Computer game (Mouse)', 'Play_I Computer game (Keyboard)']],
    phone: ['Smartphone', 'Watch Phone', ['Watch Smartphone (APP & Video)', 'Play_III Phone game (Simple)', 'Play_III Phone game (Complex)']],
    cards: ['Playing cards', 'Play Cards', ['Play_II Cards']],
    cube: ['Rubik’s cube', 'Play Cube', ['Play_II Cube']],
    puzzle: ['Jigsaw puzzle', 'Play Puzzle', ['Play_II Puzzle']],
    toys: ['Toy bricks', 'Play Toys', ['Play_II Toys']],
    notebook: ['Notebook & pen', 'Write Notes', ['Write Notes', 'Write Copybook', 'Draw Pictures', 'Draw Picture Tracing']],
    books: ['Books & papers', 'Read Book', ['Read Textbook', 'Read Comic-book', 'Read Research Article']],
    snacks: ['Snacks', 'Eat Snack', ['Eat Snack', 'Eat Spicy strips', 'Eat Sugers']],
    cola: ['Cola can', 'Drink Cola', ['Drink Coca-cola']],
    water: ['Water bottle', 'Drink Water', ['Drink Water']],
    juice: ['Bitter gourd juice', 'Drink Juice', ['Drink Bitter Gourd Juice']],
  };
  const OBJ_CLIP = { laptop: 'P0034_phase2_008_draw-computer-pictures', phone: 'P0023_phase2_002_play-phone-game-complex-a', cards: 'P0036_phase2_016_play-cards', cube: 'P0026_phase2_017_play-cube', puzzle: 'P0040_phase2_033_play-puzzle', notebook: 'P0001_phase2_033_draw-pictures', books: 'P0032_phase2_014_read-comic-book', snacks: 'P0024_phase2_008_eat-snack-c', cola: 'P0033_phase2_008_drink-coca-cola-a' };
  const ISSUES = { P0008: 'EEG: electrode came loose twice (15 of 39 segments)', P0020: 'EEG: ear reference lost contact (32 of 39 segments)', P0025: 'IMU: imu_3 ~58 Hz', P0029: 'IMU: imu_2 ~63 Hz', P0031: 'IMU: imu_1 ~61 Hz', P0035: 'IMU: imu_4 ~159 Hz', P0037: 'IMU: imu_1 ~49 Hz', P0039: 'IMU: imu_2 ~152 Hz' };

  /* ---------------- data loading ---------------- */
  let SEG = null, BY_LABEL = {}, BY_SUBJ = {}, CLIPS = [], CLIP_BY_ID = {}, CLIP_BY_LABEL = {};
  const segReady = fetch(SH + 'data/segments.json').then(r => r.json()).then(rows => {
    SEG = rows;
    rows.forEach(r => { (BY_LABEL[r.a] = BY_LABEL[r.a] || []).push(r); (BY_SUBJ[r.s] = BY_SUBJ[r.s] || []).push(r); });
    return rows;
  });
  const clipsReady = fetch(SH + 'clips/index.json').then(r => r.json()).then(c => { CLIPS = c; c.forEach(x => { CLIP_BY_ID[x.id] = x; CLIP_BY_LABEL[x.action] = x; }); return c; });
  const clipData = new Map();
  function getClip(id) { if (!clipData.has(id)) clipData.set(id, fetch(SH + 'clips/' + id + '.json').then(r => r.json())); return clipData.get(id); }
  let SPARKS = null, sparksP = null;
  const loadSparks = () => sparksP || (sparksP = fetch(SH + 'data/sparks.json').then(r => r.json()).then(j => (SPARKS = j)));
  const thumb = id => SH + 'thumbs/' + id + '.jpg';
  const fmtDur = d => d >= 60 ? `${Math.floor(d / 60)} min ${String(Math.round(d % 60)).padStart(2, '0')} s` : `${d.toFixed(1)} s`;
  function vidSources(v, base) {
    v.innerHTML = `<source src="${base}.mp4" type="video/mp4"><source src="${base}.webm" type="video/webm">`;
  }
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 2600); }

  /* =========================================================
     HERO LAB
     ========================================================= */
  const pop = $('#pop'), popBody = $('#popBody');
  let popVideo = null, popRAF = 0, lastObj = null;
  function closePop() {
    pop.hidden = true; if (popVideo) { popVideo.pause(); popVideo = null; } cancelAnimationFrame(popRAF);
    lab && lab.clearSel();
  }
  $('#popX').onclick = closePop;
  addEventListener('keydown', e => { if (e.key === 'Escape') { closePop(); $('#lb').hidden = true; $('#gd').hidden = true; } });
  function placePop(anchor) {
    pop.hidden = false;
    const w = pop.offsetWidth, h = pop.offsetHeight, vw = innerWidth, vh = innerHeight;
    if (vw < 760 || !anchor) { pop.style.left = '12px'; pop.style.top = 'auto'; pop.style.bottom = '12px'; return; }
    const r = anchor.getBoundingClientRect();
    const lr = $('#lab').getBoundingClientRect(); let x = lr.left + lr.width * .06 - w; if (x < 12) x = Math.min(vw - w - 12, r.right + 24);
    let y = r.top + r.height / 2 - h / 2; y = Math.max(76, Math.min(vh - h - 12, y));
    // no free space beside the lab (tablet widths): a side card would cover the object itself, so use the bottom sheet
    if (x < r.right && x + w > r.left) { pop.style.left = '12px'; pop.style.top = 'auto'; pop.style.bottom = '12px'; return; }
    pop.style.left = x + 'px'; pop.style.top = y + 'px'; pop.style.bottom = 'auto';
  }
  function pickThumbs(raw, n = 4) {
    const arr = BY_LABEL[raw] || []; if (!arr.length) return [];
    const out = [], step = arr.length / n; for (let i = 0; i < n && i < arr.length; i++) out.push(arr[Math.floor(i * step + step / 2) % arr.length]);
    return out;
  }
  async function onObject(k, g) {
    lastObj = k;
    const [name, , labels] = OBJ[k];
    popBody.innerHTML = `<p class="pop-k">On the desk</p><h3 id="popTitle">${name}</h3><p>Loading actions…</p>`;
    placePop(g);
    await Promise.all([segReady, clipsReady]).catch(() => {});
    let html = `<p class="pop-k">On the desk</p><h3 id="popTitle">${name}</h3><p>${labels.length === 1 ? 'One action' : labels.length + ' actions'} in EgoBrain-Mini use${labels.length === 1 ? 's' : ''} it. Thumbnails are real segments${HAS('gallery') ? '; tap one for details' : ''}.</p>`;
    labels.forEach(raw => {
      const arr = BY_LABEL[raw] || [], hrs = arr.reduce((s, r) => s + r.d, 0) / 3600, clip = CLIP_BY_LABEL[raw];
      html += `<div class="act"><div class="act-h"><b title="Dataset label: ${raw}">${title(raw)}</b><span>${arr.length} segments · ${hrs.toFixed(1)} h</span></div><div class="act-thumbs">` +
        pickThumbs(raw).map(r => HAS('gallery') ? `<button data-seg="${r.id}" aria-label="${title(raw)}, ${r.s}"><img src="${thumb(r.id)}" alt="" loading="lazy" width="240" height="240"></button>` : `<span><img src="${thumb(r.id)}" alt="${title(raw)}, ${r.s}" loading="lazy" width="240" height="240"></span>`).join('') +
        `</div><div class="act-btns">${clip && HAS('demo') ? `<button class="chip hot" data-clip="${clip.id}">▶ Synced clip + EEG</button>` : ''}${HAS('gallery') ? `<button class="chip" data-gal="${raw}">Browse in gallery →</button>` : ''}</div></div>`;
    });
    popBody.innerHTML = html;
    placePop(g);
  }
  popBody.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.seg) openDetail(b.dataset.seg);
    if (b.dataset.clip) { closePop(); goDemo(b.dataset.clip, true); }
    if (b.dataset.gal) { closePop(); galFilter({ action: b.dataset.gal }); }
    if (b.dataset.go === 'demo') { closePop(); goDemo(b.dataset.id || 'P0024_phase2_008_eat-snack-c', true); }
  });
  function onPerson(k, g) {
    if (k === 'cap' && !HAS('demo')) {
      popBody.innerHTML = `<p class="pop-k">Emotiv FLEX 2 Gel</p><h3 id="popTitle">32-channel EEG cap</h3><p>Brain activity recorded on the same clock as the head camera and the four IMU bands. EgoBrain-Mini ships it for every segment at 200 Hz, aligned with the video.</p>
        <div class="row"><a class="chip hot" href="${MINI_HF}">Get EgoBrain-Mini →</a></div>`;
      placePop(g); return;
    }
    if (k === 'cap') {
      toast('Opening the sync demo: watch each chew in the EEG');
      goDemo('P0024_phase2_008_eat-snack-c', true); lab.clearSel(); return;
    }
    if (k === 'cam') {
      const id = OBJ_CLIP[lastObj] || 'P0026_phase2_017_play-cube', c = CLIP_BY_ID[id];
      popBody.innerHTML = `<p class="pop-k">Helmet-mounted GoPro HERO12</p><h3 id="popTitle">First-person view</h3><p>What the participant sees, at their visual horizon. Real EgoBrain-Mini footage${c ? ` · ${c.subject} · ${title(c.action)}` : ''}.</p>
        <div class="vf"><video muted playsinline loop autoplay preload="auto" poster="${SH}clips/${id}.jpg"></video><div class="rec"><i></i>REC · EGO</div></div>
        ${HAS('demo') ? `<div class="row"><button class="chip hot" data-go="demo" data-id="${id}">Open with EEG + IMU →</button></div>` : ''}`;
      popVideo = $('video', popBody); vidSources(popVideo, SH + 'clips/' + id); popVideo.play().catch(() => {});
      placePop(g); return;
    }
    if (k === 'bands') {
      const id = 'P0026_phase2_017_play-cube';
      popBody.innerHTML = `<p class="pop-k">WitMotion WT9011DCL BT50 · in EgoBrain-Mini</p><h3 id="popTitle">Four IMU bands</h3><p>Both wrists and both upper arms. Accelerometer magnitude while P0026 plays the cube — the traces follow the video.</p>
        <video muted playsinline loop autoplay preload="auto" poster="${SH}clips/${id}.jpg"></video><canvas class="imu-c" aria-label="IMU traces"></canvas>
        ${HAS('demo') ? `<div class="row"><button class="chip hot" data-go="demo" data-id="${id}">Open in the sync demo →</button></div>` : ''}`;
      popVideo = $('video', popBody); vidSources(popVideo, SH + 'clips/' + id); popVideo.play().catch(() => {});
      placePop(g);
      const cv = $('canvas', popBody), v = popVideo;
      getClip(id).then(J => {
        const names = [['imu_1', 'L wrist'], ['imu_2', 'L arm'], ['imu_3', 'R wrist'], ['imu_4', 'R arm']], cols = ['#4FB6CF', '#9DB8EE', ACC, '#F59AB5'];
        const mags = names.map(([k]) => { const a = J.imu[k].acc; return a[0].map((_, i) => Math.hypot(a[0][i], a[1][i], a[2][i])); });
        const loop = () => {
          if (!popVideo || popVideo !== v) return;
          const { ctx, w, h } = fitCanvas(cv);
          ctx.clearRect(0, 0, w, h);
          const lh = h / 4;
          mags.forEach((m, j) => {
            let mn = Infinity, mx = -Infinity; m.forEach(x => { mn = Math.min(mn, x); mx = Math.max(mx, x); });
            ctx.strokeStyle = cols[j]; ctx.lineWidth = 1.4; ctx.beginPath();
            for (let i = 0; i < m.length; i += 2) { const x = 58 + (i / m.length) * (w - 66), y = j * lh + lh - 6 - ((m[i] - mn) / ((mx - mn) || 1)) * (lh - 12); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
            ctx.stroke(); ctx.fillStyle = '#575B78'; ctx.font = '600 11px Plus Jakarta Sans, sans-serif'; ctx.fillText(names[j][1], 6, j * lh + lh / 2 + 4);
          });
          const x = 58 + (v.currentTime / 24) * (w - 66); ctx.fillStyle = INK; ctx.fillRect(x - 1, 0, 2, h);
          popRAF = requestAnimationFrame(loop);
        };
        loop();
      });
    }
  }
  // hero type: the subtitle's longer line ends where logo + name end, and the bold TL;DR sentence stays on one line
  // when a slightly smaller size allows it (otherwise it wraps as before)
  function fitHero() {
    const name = $('.h1-name'), sub = $('.h1-sub'), tl = $('#tldr'), st = tl && $('strong', tl);
    const width = el => { const r = document.createRange(); r.selectNodeContents(el); return r.getBoundingClientRect().width; };
    if (name && sub) {
      sub.style.fontSize = '';
      const w = width(name), longest = Math.max(...$$(':scope > span', sub).map(width));
      if (w && longest) sub.style.fontSize = (parseFloat(getComputedStyle(sub).fontSize) * w / longest).toFixed(2) + 'px';
    }
    if (st) {
      tl.style.fontSize = '';
      const base = parseFloat(getComputedStyle(tl).fontSize);
      for (let fs = base; fs >= 13; fs -= .25) { tl.style.fontSize = fs + 'px'; if (st.getClientRects().length === 1) return; }
      tl.style.fontSize = '';
    }
  }
  fitHero(); document.fonts && document.fonts.ready.then(fitHero); addEventListener('resize', fitHero);

  let lab = null;
  try {
    lab = window.ISO.buildLab($('#lab'), {
      onObject, onPerson, promptFor: k => OBJ[k] ? OBJ[k][1] : null,
      used: () => $('#labHint').classList.add('gone'),
    });
  } catch (e) { console.warn(e); }

  /* =========================================================
     DESKS + FACTORY (built when near)
     ========================================================= */
  let desks = null, fac = null, proto = 'cross_subject_scene', ptask = 'action';
  const lazyBuild = (el, fn) => new IntersectionObserver((es, o) => { if (es[0].isIntersecting) { o.disconnect(); fn(); } }, { rootMargin: '120% 0px' }).observe(el);

  /* =========================================================
     NAV, counters, reveal
     ========================================================= */
  const nav = $('#nav'), navLinks = $$('.nav-links a');
  const secs = navLinks.map(a => $(a.getAttribute('href')));
  function onScroll() {
    nav.classList.toggle('show', scrollY > innerHeight * .6);
    let cur = -1; secs.forEach((s, i) => { if (s && s.getBoundingClientRect().top < innerHeight * .4) cur = i; });
    navLinks.forEach((a, i) => a.classList.toggle('on', i === cur));
  }
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  if (!RM) $$('[data-count]').forEach(el => {
    const n = +el.dataset.count, t0 = performance.now() + 300;
    const st = now => { const e = Math.max(0, Math.min(1, (now - t0) / 1400)); el.textContent = Math.round(n * (1 - Math.pow(1 - e, 3))); if (e < 1) requestAnimationFrame(st); };
    el.textContent = '0'; requestAnimationFrame(st);
  });
  const rvo = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); rvo.unobserve(e.target); } }), { rootMargin: '0px 0px -6% 0px' });
  $$('.sec-head, .card, .tax>div, .contrib>div, .adv>div, .tk, .bstat, .vs-card, .protocol, .setup, .splits, .res-main, .seq-card, .gallery').forEach(el => { el.classList.add('rv'); rvo.observe(el); });

  /* =========================================================
     canvas helper
     ========================================================= */
  function fitCanvas(cv) {
    const r = cv.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1);
    const w = Math.max(10, Math.round(r.width)), h = Math.max(10, Math.round(r.height));
    if (cv.width !== w * d || cv.height !== h * d) { cv.width = w * d; cv.height = h * d; }
    const ctx = cv.getContext('2d'); ctx.setTransform(d, 0, 0, d, 0, 0); return { ctx, w, h };
  }







  /* =========================================================
     misc: copy, lightbox
     ========================================================= */
  $$('.copy').forEach(b => b.onclick = async () => {
    const t = $('#' + b.dataset.copy).innerText;
    try { await navigator.clipboard.writeText(t); } catch (e) { const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (_) {} ta.remove(); }
    b.textContent = 'Copied ✓'; b.classList.add('done'); setTimeout(() => { b.textContent = 'Copy'; b.classList.remove('done'); }, 1600);
  });
  const lb = $('#lb');
  $$('.fig-btn').forEach(b => b.onclick = () => { $('img', lb).src = b.dataset.lb; $('img', lb).alt = b.dataset.cap; $('figcaption', lb).textContent = b.dataset.cap; lb.hidden = false; });
  lb.onclick = () => (lb.hidden = true);

  /* =========================================================
     EgoBrain-Mini IN 30 SECONDS: pick an action -> real clip + EEG/IMU on one clock -> code for that segment
     ========================================================= */
  (function quickStart() {
    const sec = $('#quick'); if (!sec) return;
    const acts = $('#qsActs'), video = $('#qsVideo'), cv = $('#qsCanvas'), tag = $('#qsTag'), tdisp = $('#qsTime'), codeEl = $('#qsCode code');
    const SHOW = ['Fz', 'Cz', 'Pz', 'Oz'];
    let cur = null, J = null, trace = null, inView = false, raf = 0;
    const esc = t => String(t).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
    const code = c => {
      const seg = `${c.subject}/segments/phase2/${c.id}`;
      return `<span class="k">from</span> huggingface_hub <span class="k">import</span> snapshot_download
<span class="k">import</span> json, numpy <span class="k">as</span> np, pandas <span class="k">as</span> pd

seg = <span class="s">"${esc(seg)}"</span>
root = snapshot_download(
    <span class="s">"ut-vision/EgoBrain-Mini"</span>, repo_type=<span class="s">"dataset"</span>,
    allow_patterns=<span class="s">f"{seg}/*"</span>)  <span class="c"># this segment only</span>

meta = json.load(open(<span class="s">f"{root}/{seg}/meta.json"</span>))
eeg = np.load(<span class="s">f"{root}/{seg}/eeg/clean.npy"</span>)  <span class="c"># (32, T), 200 Hz</span>
imu = pd.read_parquet(<span class="s">f"{root}/{seg}/imu/imu.parquet"</span>)
print(meta[<span class="s">"action"</span>], eeg.shape)`;
    };
    // static traces are drawn once per clip/size; the playhead is drawn on top every frame
    function buildTrace() {
      const { w, h } = fitCanvas(cv); if (!J) { trace = null; return; }
      const off = document.createElement('canvas'), d = Math.min(2, devicePixelRatio || 1);
      off.width = w * d; off.height = h * d; const x = off.getContext('2d'); x.setTransform(d, 0, 0, d, 0, 0);
      const n = J.eeg.data[0].length, rows = SHOW.length + 1, lh = h / rows, G = 30, X = i => G + i / (n - 1) * (w - G);
      const line = (arr, y0, col, lw) => {
        const s = [...arr].sort((a, b) => a - b), lo = s[Math.floor(s.length * .02)], hi = s[Math.floor(s.length * .98)], sc = (lh * .8) / ((hi - lo) || 1);
        x.beginPath(); arr.forEach((v, i) => { const y = y0 + lh / 2 - (Math.max(lo, Math.min(hi, v)) - (lo + hi) / 2) * sc; i ? x.lineTo(X(i), y) : x.moveTo(X(i), y); });
        x.strokeStyle = col; x.lineWidth = lw; x.stroke();
      };
      x.font = '600 11px ' + getComputedStyle(document.body).fontFamily; x.textBaseline = 'middle';
      SHOW.forEach((ch, r) => { const k = J.eeg.channels.findIndex(c => c === ch); if (k < 0) return; line(J.eeg.data[k], r * lh, ACC, 1.2); x.fillStyle = '#8A8DAD'; x.fillText(ch, 2, r * lh + lh / 2); });
      const a = J.imu.imu_3 && J.imu.imu_3.acc;
      if (a) { line(a[0].map((_, i) => Math.hypot(a[0][i], a[1][i], a[2][i])), SHOW.length * lh, '#4FB6CF', 1.6); x.fillStyle = '#8A8DAD'; x.fillText('IMU', 2, SHOW.length * lh + lh / 2); }
      trace = off;
    }
    function draw() {
      const { ctx, w, h } = fitCanvas(cv);
      if (!trace || trace.width !== cv.width) buildTrace();
      ctx.clearRect(0, 0, w, h); if (trace) ctx.drawImage(trace, 0, 0, w, h);
      const t = video.currentTime || 0, L = (cur && cur.clip_len) || 24, G = 30, px = G + t / L * (w - G);
      ctx.fillStyle = 'rgba(30,33,66,.06)'; ctx.fillRect(G, 0, px - G, h);
      ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, h); ctx.stroke();
      tdisp.textContent = t.toFixed(1) + ' s';
    }
    const loop = () => { draw(); raf = (inView && !video.paused) ? requestAnimationFrame(loop) : 0; };
    const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };
    async function pick(c) {
      cur = c; J = null; trace = null;
      $$('.qs-act', acts).forEach(b => b.setAttribute('aria-selected', String(b.dataset.id === c.id)));
      tag.textContent = `${c.subject} · ${title(c.action)}`;
      codeEl.innerHTML = code(c);
      video.poster = SH + 'clips/' + c.id + '.jpg'; vidSources(video, SH + 'clips/' + c.id); video.load();
      if (inView) video.play().catch(() => {});
      const j = await getClip(c.id); if (cur !== c) return; J = j; trace = null; draw();
    }
    clipsReady.then(cs => {
      acts.innerHTML = cs.map(c => `<button class="qs-act" role="tab" data-id="${c.id}" aria-selected="false">${esc(title(c.action))}</button>`).join('');
      acts.onclick = e => { const b = e.target.closest('.qs-act'); if (b) pick(CLIP_BY_ID[b.dataset.id]); };
      pick(CLIP_BY_ID['P0024_phase2_008_eat-snack-c'] || cs[0]);
    }).catch(() => {});
    video.addEventListener('play', kick); video.addEventListener('seeked', kick); video.addEventListener('loadeddata', kick);
    new IntersectionObserver(es => { inView = es[0].isIntersecting; if (inView) { video.play().catch(() => {}); kick(); } else video.pause(); }, { threshold: .25 }).observe(sec);
    addEventListener('resize', () => { trace = null; draw(); });
    window.__qs = { video, ready: () => !!J, playheadX: () => (video.currentTime / ((cur && cur.clip_len) || 24)), id: () => cur && cur.id };
  })();
})();
