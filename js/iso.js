(function () {
  'use strict';
  const C = Math.cos(Math.PI / 6), S = 0.5, K = Math.SQRT2 * C, KY = Math.SQRT2 * S;
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const P = (x, y, z = 0) => [(x - y) * C, (x + y) * S - z];
  const f = n => Math.round(n * 10) / 10;
  const ps = a => a.map(p => f(p[0]) + ',' + f(p[1])).join(' ');
  const P3 = a => ps(a.map(q => P(q[0], q[1], q[2] || 0)));
  const topM = z => `matrix(${f4(C)},${S},${f4(-C)},${S},0,${f(-z)})`;
  const planeY = y => `matrix(${f4(C)},${S},0,1,${f(-y * C)},${f(y * S)})`;
  const planeXr = x => `matrix(${f4(C)},${-S},0,1,${f(x * C)},${f(x * S)})`; // local u = -y (unmirrored)
  function f4(n) { return Math.round(n * 10000) / 10000; }

  /* ---------- colour ---------- */
  const h2r = h => { h = h.replace('#', ''); return [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16)); };
  const r2h = r => '#' + r.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  const shade = (h, k) => { const c = h2r(h); return r2h(k < 0 ? c.map(v => v * (1 + k)) : c.map(v => v + (255 - v) * k)); };

  /* ---------- defs registry (per svg) ---------- */
  let DEFS = null, GID = 0, PFX = 'g';
  const gcache = new Map();
  function grad(L, R, t, soft) {
    const e = soft ? 0.16 : 0.004, key = PFX + L + R + Math.round(t * 50) + (soft ? 's' : 'h');
    if (gcache.has(key)) return gcache.get(key);
    const id = PFX + (GID++);
    const a = Math.max(0, t - e), b = Math.min(1, t + e);
    DEFS.push(`<linearGradient id="${id}" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="${shade(L, .05)}"/><stop offset="${f4(a)}" stop-color="${L}"/><stop offset="${f4(b)}" stop-color="${R}"/><stop offset="1" stop-color="${shade(R, -.06)}"/></linearGradient>`);
    gcache.set(key, id); return id;
  }
  function radial(c) {
    const key = PFX + 'r' + c; if (gcache.has(key)) return gcache.get(key);
    const id = PFX + (GID++);
    DEFS.push(`<radialGradient id="${id}" cx=".36" cy=".32" r=".75"><stop offset="0" stop-color="${shade(c, .3)}"/><stop offset=".55" stop-color="${c}"/><stop offset="1" stop-color="${shade(c, -.28)}"/></radialGradient>`);
    gcache.set(key, id); return id;
  }

  /* ---------- geometry ---------- */
  function rr(x, y, w, d, r = 0, n = 4) {
    if (!r) return [[x, y], [x + w, y], [x + w, y + d], [x, y + d]];
    const o = [], cs = [[x + w - r, y + r, -90], [x + w - r, y + d - r, 0], [x + r, y + d - r, 90], [x + r, y + r, 180]];
    for (const [cx, cy, a0] of cs) for (let i = 0; i <= n; i++) { const a = (a0 + 90 * i / n) * Math.PI / 180; o.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
    return o;
  }
  function ell(cx, cy, rx, ry, n = 28) { const o = []; for (let i = 0; i < n; i++) { const a = i / n * 2 * Math.PI; o.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]); } return o; }
  function rot(fp, cx, cy, deg) { const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return fp.map(([x, y]) => [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c]); }
  function hull(pts) {
    pts = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], up = [];
    for (const p of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
    for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
    return lo.slice(0, -1).concat(up.slice(0, -1));
  }
  /* extruded prism from a footprint polygon: side silhouette with a two-tone gradient + top face */
  function prism(fp, z0, h, col, o = {}) {
    const B = fp.map(q => P(q[0], q[1], z0)), T = fp.map(q => P(q[0], q[1], z0 + h));
    let out = '';
    if (h > 0) {
      const n = fp.length; let i0 = 0, i1 = 0;
      B.forEach((p, i) => { if (p[0] < B[i0][0] - 1e-6) i0 = i; if (p[0] > B[i1][0] + 1e-6) i1 = i; });
      const walk = d => { const r = [i0]; let i = i0, g = 0; while (i !== i1 && g++ < n) { i = (i + d + n) % n; r.push(i); } return r; };
      const a = walk(1), b = walk(-1), my = arr => arr.reduce((s, i) => s + B[i][1], 0) / arr.length;
      const fr = my(a) > my(b) ? a : b;
      let k = fr[0]; fr.forEach(i => { if (B[i][1] > B[k][1]) k = i; });
      const x0 = B[i0][0], x1 = B[i1][0], t = (B[k][0] - x0) / ((x1 - x0) || 1);
      const L = o.left || shade(col, -.07), R = o.right || shade(col, -.22);
      const poly = fr.map(i => B[i]).concat(fr.slice().reverse().map(i => T[i]));
      out += `<polygon points="${ps(poly)}" fill="${o.flat ? L : 'url(#' + grad(L, R, t, o.soft) + ')'}"/>`;
    }
    const edge = o.edge === false ? '' : ` stroke="${o.edgeC || 'rgba(255,255,255,.6)'}" stroke-width="${o.ew || .8}" stroke-linejoin="round"`;
    out += `<polygon points="${ps(T)}" fill="${o.top || shade(col, .16)}"${edge}/>`;
    return out;
  }
  const box = (x, y, z, w, d, h, col, o = {}) => prism(rr(x, y, w, d, o.r || 0, o.n || 4), z, h, col, o);
  function shadow(fp, z, h, o = {}) {
    const k = o.k || 1.15, dx = h * k, dy = h * k * .28;
    const pts = fp.concat(fp.map(q => [q[0] + dx, q[1] + dy])).map(q => P(q[0], q[1], z));
    return `<polygon points="${ps(hull(pts))}" fill="${o.c || '#2C2656'}" opacity="${o.a || .1}"/>`;
  }
  const bshadow = (x, y, z, w, d, h, o) => shadow(rr(x, y, w, d, (o && o.r) || 0), z, h, o);
  function cyl(x, y, z, r, h, col, o = {}) {
    const rx = r * K, ry = r * KY, [bx, by] = P(x, y, z), [tx, ty] = P(x, y, z + h);
    const L = o.left || shade(col, -.03), R = o.right || shade(col, -.24);
    return `<path d="M${f(bx - rx)},${f(ty)}L${f(bx - rx)},${f(by)}A${f(rx)},${f(ry)} 0 0 0 ${f(bx + rx)},${f(by)}L${f(bx + rx)},${f(ty)}Z" fill="url(#${grad(L, R, .42, true)})"/>` +
      `<ellipse cx="${f(tx)}" cy="${f(ty)}" rx="${f(rx)}" ry="${f(ry)}" fill="${o.top || shade(col, .18)}"${o.edge === false ? '' : ' stroke="rgba(255,255,255,.55)" stroke-width=".7"'}/>`;
  }
  const cshadow = (x, y, z, r, h, o) => shadow(ell(x, y, r, r, 16), z, h, o);
  function sphere(x, y, z, r, col) { const [sx, sy] = P(x, y, z); return `<circle cx="${f(sx)}" cy="${f(sy)}" r="${f(r * K)}" fill="url(#${radial(col)})"/>`; }
  function tube(a, b, w, col, o = {}) {
    const [x1, y1] = P(...a), [x2, y2] = P(...b);
    let s = `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/>`;
    if (o.hi !== false) s += `<line x1="${f(x1 - w * .16)}" y1="${f(y1 - w * .2)}" x2="${f(x2 - w * .16)}" y2="${f(y2 - w * .2)}" stroke="${shade(col, .35)}" stroke-width="${f(w * .32)}" stroke-linecap="round" opacity=".7"/>`;
    return s;
  }
  const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const qY = (y, xa, xb, za, zb) => P3([[xa, y, za], [xb, y, za], [xb, y, zb], [xa, y, zb]]);
  const qX = (x, ya, yb, za, zb) => P3([[x, ya, za], [x, yb, za], [x, yb, zb], [x, ya, zb]]);
  const qZ = (z, xa, xb, ya, yb) => P3([[xa, ya, z], [xb, ya, z], [xb, yb, z], [xa, yb, z]]);

  function begin(prefix) { DEFS = []; PFX = prefix; }
  function finish(svg, body, extraDefs = '') {
    svg.insertAdjacentHTML('beforeend', `<defs>${DEFS.join('')}${extraDefs}</defs>${body}`);
  }
  const ACC = '#FF5B3A', INK = '#1E2142';

  /* =====================================================================
     SCENE 1 — the recording room
     ===================================================================== */
  const DZ = 74; // desk top
  const HOT = {
    laptop: { label: 'Laptop & mouse', c: [206, 70, 92] },
    phone: { label: 'Smartphone', c: [243, 131, 76] },
    cards: { label: 'Playing cards', c: [272, 138, 76] },
    cube: { label: 'Rubik’s cube', c: [308, 114, 92] },
    puzzle: { label: 'Jigsaw puzzle', c: [312, 63, 76] },
    toys: { label: 'Toy bricks', c: [334, 104, 82] },
    notebook: { label: 'Notebook & pen', c: [198, 130, 78] },
    books: { label: 'Books & papers', c: [124, 57, 90] },
    snacks: { label: 'Snacks', c: [322, 150, 86] },
    cola: { label: 'Cola can', c: [116, 92, 94] },
    water: { label: 'Water bottle', c: [134, 104, 102] },
    juice: { label: 'Bitter gourd juice', c: [154, 86, 94] },
  };
  const PROMPTS = ['Play Cube', 'Read Book', 'Eat Snack', 'Write Notes', 'Drink Cola', 'Play Cards', 'Play Puzzle', 'Draw Pictures', 'Operate Word', 'Watch Phone'];

  function deskItems() {
    const it = [];
    const add = (key, depth, svg) => it.push({ key, depth, svg });
    // books (stack)
    add('books', 100, bshadow(104, 40, DZ, 40, 34, 16) +
      box(104, 42, DZ, 38, 30, 6, '#7FA6D8', { r: 1.5 }) +
      box(107, 40, DZ + 6, 34, 28, 5, '#FFC861', { r: 1.5 }) +
      `<g transform="${topM(DZ + 11)}"><rect x="109" y="42" width="30" height="24" rx="2" fill="#FFE08A"/><circle cx="118" cy="50" r="4" fill="#FF8C69"/><circle cx="129" cy="56" r="5" fill="#7BC6E8"/><path d="M112 62h22" stroke="#E59B2E" stroke-width="2"/></g>` +
      box(103, 44, DZ + 11, 30, 24, 3, '#F7F4EE', { r: 1 }) +
      `<g transform="${topM(DZ + 14)}" stroke="#C9C3B8" stroke-width=".9"><path d="M107 49h20M107 53h22M107 57h18M107 61h21"/></g>`);
    // drinks
    add('cola', 190, cshadow(116, 92, DZ, 6, 19) + cyl(116, 92, DZ, 6, 19, '#E9473B') +
      `<path d="${(() => { const [x, y] = P(116, 92, DZ + 11); const rx = 6 * K, ry = 6 * KY; return `M${f(x - rx)},${f(y)}A${f(rx)},${f(ry)} 0 0 0 ${f(x + rx)},${f(y)}`; })()}" stroke="#fff" stroke-width="2.2" fill="none" opacity=".9"/>` +
      `<ellipse cx="${f(P(116, 92, DZ + 19)[0])}" cy="${f(P(116, 92, DZ + 19)[1])}" rx="${f(5 * K)}" ry="${f(5 * KY)}" fill="#D9DCE6"/>`);
    add('water', 214, cshadow(142, 100, DZ, 6, 26) + cyl(142, 100, DZ, 6, 22, '#A9D8F2', { top: '#D7EEFB' }) +
      cyl(142, 100, DZ + 22, 3.4, 5, '#4C8BD6') +
      `<path d="${(() => { const [x, y] = P(142, 100, DZ + 8); const rx = 6 * K, ry = 6 * KY; return `M${f(x - rx)},${f(y)}A${f(rx)},${f(ry)} 0 0 0 ${f(x + rx)},${f(y)}`; })()}" stroke="#4C8BD6" stroke-width="3" fill="none" opacity=".55"/>`);
    add('juice', 172, bshadow(148, 80, DZ, 12, 12, 18) + box(148, 80, DZ, 12, 12, 15, '#7CC06A') +
      `<polygon points="${P3([[148, 80, DZ + 15], [160, 80, DZ + 15], [160, 86, DZ + 20], [148, 86, DZ + 20]])}" fill="#A5D894"/>` +
      `<polygon points="${P3([[148, 92, DZ + 15], [160, 92, DZ + 15], [160, 86, DZ + 20], [148, 86, DZ + 20]])}" fill="#8FCB7C"/>` +
      `<g transform="${planeY(92)}"><rect x="150" y="${-DZ - 11}" width="8" height="6" rx="1" fill="#fff" opacity=".85"/></g>`);
    // laptop + mouse
    add('laptop', 230, bshadow(172, 44, DZ, 68, 48, 30, { a: .08 }) +
      box(172, 46, DZ, 68, 46, 3, '#D8DCE8', { r: 2 }) +
      `<g transform="${topM(DZ + 3)}"><rect x="178" y="58" width="56" height="22" rx="2" fill="#AEB4C8"/><g fill="#C9CEDC">${Array.from({ length: 33 }, (_, i) => `<rect x="${180 + (i % 11) * 5}" y="${60 + Math.floor(i / 11) * 6.4}" width="4" height="4.8" rx=".8"/>`).join('')}</g><rect x="196" y="83" width="20" height="7" rx="1.5" fill="#C5CAD9"/></g>` +
      box(172, 42, DZ + 2, 68, 4, 44, '#C9CEDD', { r: 1 }) +
      `<g transform="${planeY(46)}"><rect x="175" y="${-DZ - 44}" width="62" height="38" rx="2" fill="#2D3157"/><rect x="177" y="${-DZ - 42}" width="58" height="34" rx="1" fill="url(#scr)"/><rect x="183" y="${-DZ - 37}" width="30" height="3" rx="1" fill="#fff" opacity=".9"/><g fill="#fff" opacity=".7"><rect x="183" y="${-DZ - 31}" width="44" height="2" rx="1"/><rect x="183" y="${-DZ - 27}" width="38" height="2" rx="1"/><rect x="183" y="${-DZ - 23}" width="42" height="2" rx="1"/><rect x="183" y="${-DZ - 19}" width="26" height="2" rx="1"/></g><circle cx="229" cy="${-DZ - 14}" r="3" fill="${ACC}"/></g>` +
      shadow(ell(254, 80, 5, 7, 14), DZ, 4) + prism(ell(254, 80, 5, 7.5, 20), DZ, 3.5, '#A8D5C5', { soft: true }) +
      `<path d="${(() => { const a = P(254, 73, DZ + 3.5), b = P(254, 78, DZ + 3.5); return `M${f(a[0])},${f(a[1])}L${f(b[0])},${f(b[1])}`; })()}" stroke="#7FB3A2" stroke-width=".8"/>`);
    // flip clock (decor)
    add('', 250, bshadow(252, 44, DZ, 22, 10, 14) + box(252, 44, DZ, 22, 10, 13, '#3A3E63', { r: 1 }) +
      `<g transform="${planeY(54)}"><rect x="254" y="${-DZ - 11}" width="18" height="9" rx="1.2" fill="#22253F"/><text x="263" y="${-DZ - 4}" font-family="DM Mono,monospace" font-size="6.4" fill="#FFE7A3" text-anchor="middle">16:38</text></g>`);
    // puzzle
    add('puzzle', 330, bshadow(282, 42, DZ, 60, 42, 2) + box(282, 42, DZ, 60, 42, 2, '#E7D3A8', { r: 1.5 }) +
      `<g transform="${topM(DZ + 2)}"><rect x="285" y="45" width="54" height="36" rx="1" fill="#F6E7C3"/><g fill="none" stroke="#D8BE8A" stroke-width=".9"><path d="M285 57h8a3 3 0 1 1 6 0h10a3 3 0 1 0 6 0h24M285 69h12a3 3 0 1 0 6 0h12a3 3 0 1 1 6 0h18M298 45v6a3 3 0 1 1 0 6v24M312 45v8a3 3 0 1 0 0 6v22M326 45v4a3 3 0 1 1 0 6v26"/></g><path d="M287 47h22v10h-22z" fill="#9ED2E8" opacity=".9"/><path d="M313 59h14v10h-14z" fill="#F4A3A8" opacity=".9"/><path d="M299 71h14v8h-14z" fill="#A6D89A" opacity=".9"/><path d="M327 71h12v9h-12z" fill="#C8B5F0"/></g>` +
      prism(rot(rr(276, 90, 9, 8, 1), 280, 94, 22), DZ, 1.6, '#9ED2E8', { edge: false }) + prism(rot(rr(343, 70, 8, 8, 1), 347, 74, -15), DZ, 1.6, '#F4A3A8', { edge: false }));
    // notebook + pen
    add('notebook', 300, bshadow(176, 110, DZ, 44, 40, 3) + box(176, 110, DZ, 44, 40, 1.6, '#B9A6EC', { r: 1.5 }) +
      box(178, 110, DZ + 1.6, 41, 39, 1.4, '#FFFFFF', { r: 1, top: '#FFFFFF' }) +
      `<g transform="${topM(DZ + 3)}"><g stroke="#DCD6EE" stroke-width=".7">${[118, 124, 130, 136, 142].map(y => `<path d="M186 ${y}h30"/>`).join('')}</g><g fill="none" stroke="${INK}" stroke-width="1.1" stroke-linecap="round"><path d="M193 129c3-6 9-6 11 0s-7 9-11 0z"/><path d="M198 120l1.4 3 3.2.4-2.4 2.2.6 3.2-2.8-1.6-2.8 1.6.6-3.2-2.4-2.2 3.2-.4z" stroke="${ACC}"/><path d="M206 138c3 2 6 2 9 0"/></g>${Array.from({ length: 7 }, (_, i) => `<circle cx="180.5" cy="${114 + i * 5.2}" r="1.6" fill="none" stroke="#8C8FA8" stroke-width=".9"/>`).join('')}</g>` +
      tube([206, 146, DZ + 4.2], [222, 128, DZ + 4.2], 2.6, '#2F3460', { hi: false }) + tube([220, 130, DZ + 4.2], [222.5, 127.5, DZ + 4.2], 2.6, ACC, { hi: false }));
    // phone
    add('phone', 380, bshadow(236, 118, DZ, 14, 26, 2) + box(236, 118, DZ, 14, 26, 1.8, '#2B2F55', { r: 2 }) +
      `<g transform="${topM(DZ + 1.8)}"><rect x="237.5" y="120" width="11" height="22" rx="1.5" fill="url(#scr2)"/><circle cx="243" cy="130" r="2.6" fill="#FFD166"/><path d="M239 137h8" stroke="#fff" stroke-width="1.2" opacity=".8"/></g>`);
    // cards (fanned)
    {
      let s = shadow(rr(258, 124, 26, 22), DZ, 1.5);
      [[-24, '#fff'], [-6, '#fff'], [14, '#fff']].forEach(([a, c], i) => {
        const fp = rot(rr(262, 126, 12, 17, 1.2), 268, 142, a);
        s += prism(fp, DZ + i * .7, .7, c, { top: c, edgeC: '#D8D2C8', ew: .6 });
        s += `<g transform="${topM(DZ + i * .7 + .7)}"><g transform="rotate(${a} 268 142)"><rect x="263.5" y="127.5" width="9" height="14" rx=".8" fill="none" stroke="${i === 2 ? ACC : '#5B6DB5'}" stroke-width=".8"/><text x="268" y="137" font-size="6" font-weight="800" text-anchor="middle" fill="${i === 2 ? ACC : '#5B6DB5'}" font-family="Plus Jakarta Sans,sans-serif">${['A', 'K', '♥'][i]}</text></g></g>`;
      });
      add('cards', 400, s);
    }
    // cube 3x3
    {
      const x = 300, y = 106, z = DZ, s = 16, g = .7, n = 3, st = s / n;
      const pal = ['#FF5B3A', '#FFD23F', '#3BA3F0', '#36C28A', '#FFFFFF', '#FF9F1C'];
      let seed = 7; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
      let o = bshadow(x, y, z, s, s, s) + box(x, y, z, s, s, s, '#23253F', { edge: false, top: '#2B2E4A', left: '#202238', right: '#191A2C' });
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        o += `<polygon points="${qZ(z + s, x + i * st + g, x + (i + 1) * st - g, y + j * st + g, y + (j + 1) * st - g)}" fill="${pal[Math.floor(rnd() * 6)]}"/>`;
        o += `<polygon points="${qY(y + s, x + i * st + g, x + (i + 1) * st - g, z + j * st + g, z + (j + 1) * st - g)}" fill="${shade(pal[Math.floor(rnd() * 6)], -.1)}"/>`;
        o += `<polygon points="${qX(x + s, y + i * st + g, y + (i + 1) * st - g, z + j * st + g, z + (j + 1) * st - g)}" fill="${shade(pal[Math.floor(rnd() * 6)], -.25)}"/>`;
      }
      add('cube', 430, o);
    }
    // toy bricks
    {
      let o = bshadow(322, 96, DZ, 24, 22, 10);
      const brick = (x, y, z, w, d, c) => { let s = box(x, y, z, w, d, 5, c, { r: .6 }); for (let i = 0; i < w / 5; i++) for (let j = 0; j < d / 5; j++) s += cyl(x + 2.5 + i * 5, y + 2.5 + j * 5, z + 5, 1.5, 1.4, c, { edge: false }); return s; };
      o += brick(322, 98, DZ, 15, 10, '#FFC23C') + brick(332, 106, DZ, 10, 10, '#3BA3F0') + brick(324, 100, DZ + 5, 10, 5, '#36C28A') + brick(338, 96, DZ, 10, 5, '#FF7A59');
      add('toys', 438, o);
    }
    // snacks
    {
      let o = shadow(rr(318, 128, 28, 34, 6), DZ, 9) + prism(rr(318, 128, 28, 34, 7, 5), DZ, 8, '#FFD45A', { soft: true }) +
        `<g transform="${topM(DZ + 8)}"><rect x="322" y="133" width="20" height="24" rx="5" fill="#FFE07D"/><path d="M322 141h20v8h-20z" fill="${ACC}" opacity=".85"/><circle cx="332" cy="145" r="3.2" fill="#fff"/><path d="M320 129.5h24M320 160.5h24" stroke="#E6B93A" stroke-width="1.6" stroke-dasharray="1.6 1.6"/></g>`;
      o += bshadow(286, 150, DZ, 14, 18, 2) + box(286, 150, DZ, 14, 18, 2, '#E8473B', { r: 1.5 }) + `<g transform="${topM(DZ + 2)}"><rect x="288" y="154" width="10" height="5" rx="1" fill="#FFE07D"/><path d="M289 162h8M289 164.5h6" stroke="#fff" stroke-width=".9"/></g>`;
      [[304, 150, '#F48FB1'], [309, 156, '#80CBC4'], [303, 158, '#FFE082'], [312, 150, '#B39DDB']].forEach(([x, y, c]) => { o += shadow(ell(x, y, 2.2, 2.2, 10), DZ, 3) + sphere(x, y, DZ + 2.2, 2.4, c); });
      add('snacks', 470, o);
    }
    // succulent (decor)
    add('', 260, cshadow(116, 150, DZ, 7, 10) + cyl(116, 150, DZ, 7, 9, '#F3A68A', { top: '#8A6A55' }) +
      [[-6, '#7BC49A'], [6, '#6AB58A'], [0, '#8ED1A8']].map(([d, c], i) => { const a = P(116, 150, DZ + 9), b = P(116 + d * .7, 150 - d * .7, DZ + 22 - Math.abs(d) * .4); return `<ellipse cx="${f((a[0] + b[0]) / 2)}" cy="${f((a[1] + b[1]) / 2)}" rx="4" ry="9" transform="rotate(${d * 3} ${f((a[0] + b[0]) / 2)} ${f((a[1] + b[1]) / 2)})" fill="${c}"/>`; }).join(''));
    return it;
  }

  function personSVG() {
    const X = 222, HC = [X, 233, 138], HR = 18;
    const skin = '#F2C4A4', sweater = '#8FCFC2', pants = '#7479A6', band = '#2E3152';
    let under = '', back = '', mid = '', front = '';
    // chair base
    under += shadow(rr(X - 29, 210, 58, 52, 6), 0, 6, { a: .08 });
    [[X - 25, 214], [X + 21, 214], [X - 25, 254], [X + 21, 254]].forEach(([lx, ly]) => { under += box(lx, ly, 0, 4, 4, 42, '#5D6285', { r: 1 }); });
    under += prism(rr(X - 27, 212, 54, 48, 8), 42, 8, '#7FB2E5', { soft: true });
    // legs
    [-11, 11].forEach(d => { under += tube([X + d, 226, 52], [X + d * 1.1, 198, 53], 11, pants) + tube([X + d * 1.1, 197, 52], [X + d * 1.1, 194, 8], 9.5, pants) + box(X + d * 1.1 - 5, 182, 0, 10, 16, 5, '#4B4F75', { r: 3 }); });
    // arms geometry
    const arm = side => {
      const sx = X + side * 21;
      return { sh: [sx, 234, 106], el: [sx + side * 4, 208, 88], wr: [X + side * 14, 170, 80], ha: [X + side * 12, 161, 77.5] };
    };
    const armSVG = (a, side) => {
      let s = tube(a.sh, a.el, 13, sweater) + tube(a.el, a.wr, 11.5, sweater);
      s += sphere(a.ha[0], a.ha[1], a.ha[2], 5.2, skin);
      return s;
    };
    const bandSVG = (a, side, key) => {
      const w0 = lerp3(a.el, a.wr, .74), w1 = lerp3(a.el, a.wr, .92), u0 = lerp3(a.sh, a.el, .42), u1 = lerp3(a.sh, a.el, .62);
      const led = (p) => { const [x, y] = P(...p); return `<circle cx="${f(x)}" cy="${f(y - 4.8)}" r="1.7" fill="${ACC}" class="blink"/>`; };
      return `<g class="hot-person" data-hot="bands" data-imu="${key}" tabindex="0" role="button" aria-label="Wrist and arm IMU bands">` +
        tube(w0, w1, 13, band) + tube(u0, u1, 14.5, band) + led(lerp3(w0, w1, .5)) + led(lerp3(u0, u1, .5)) + '</g>';
    };
    const R = arm(-1), L = arm(1);
    back += armSVG(R, -1) + bandSVG(R, -1, 'right');
    // torso
    mid += prism(rr(X - 21, 222, 42, 23, 10, 5), 50, 56, sweater, { soft: true });
    mid += prism(ell(X, 233.5, 22, 12, 26), 106, 5, sweater, { soft: true, top: shade(sweater, .22) });
    mid += cyl(X, 234, 110, 6, 12, skin);
    // head: hair, cap, electrodes, strap, camera
    const [hx, hy] = P(...HC), Rr = HR * K;
    const rimZ = HC[2] + HR * Math.cos(86 * Math.PI / 180), rho = HR * Math.sin(86 * Math.PI / 180);
    const [ex, ey] = P(HC[0], HC[1], rimZ), erx = rho * K, ery = rho * KY;
    mid += `<circle cx="${f(hx)}" cy="${f(hy)}" r="${f(Rr)}" fill="url(#${radial('#5A4338')})"/>`;
    mid += `<clipPath id="capClip"><circle cx="${f(hx)}" cy="${f(hy)}" r="${f(Rr + .2)}"/></clipPath>`;
    let cap = `<path clip-path="url(#capClip)" d="M${f(ex - erx - 14)},${f(ey)}L${f(ex - erx)},${f(ey)}A${f(erx)},${f(ery)} 0 0 0 ${f(ex + erx)},${f(ey)}L${f(ex + erx + 14)},${f(ey)}L${f(ex + erx + 14)},${f(hy - Rr - 5)}L${f(ex - erx - 14)},${f(hy - Rr - 5)}Z" fill="url(#${radial('#2E3260')})"/>`;
    // electrodes
    const rings = [[0, 1], [22, 7], [42, 12], [62, 16], [80, 18]];
    const pod = P(X, 251, 126);
    let wires = '', dots = '';
    let k = 0;
    rings.forEach(([th, n], ri) => {
      for (let i = 0; i < n; i++) {
        const t = th * Math.PI / 180, ph = (i / n) * 2 * Math.PI + ri * .4;
        const nx = Math.sin(t) * Math.cos(ph), ny = Math.sin(t) * Math.sin(ph), nz = Math.cos(t);
        if (nx + ny + nz < .25) continue;
        const [x, y] = P(HC[0] + HR * nx * 1.02, HC[1] + HR * ny * 1.02, HC[2] + HR * nz * 1.02);
        if (ny > .2 && ri > 1 && k++ % 3 === 0) wires += `<path d="M${f(x)},${f(y)}Q${f((x + pod[0]) / 2 + 4)},${f(y + 2)} ${f(pod[0])},${f(pod[1])}" fill="none" stroke="#FF9C85" stroke-width=".7" opacity=".9"/>`;
        dots += `<circle class="eeg-dot" style="animation-delay:${(-(i * .37 + ri * .9)).toFixed(2)}s" cx="${f(x)}" cy="${f(y)}" r="1.75" fill="${ACC}" stroke="#FFD9CF" stroke-width=".6"/>`;
      }
    });
    cap += wires + dots;
    // strap over the top (helmet harness)
    let strap = ''; const sp = [];
    for (let a = -40; a <= 85; a += 5) { const t = a * Math.PI / 180; const nx = 0, ny = Math.sin(t), nz = Math.cos(t); if (nx + ny + nz > -.05) sp.push(P(HC[0] + 1.05 * HR * nx, HC[1] + 1.05 * HR * ny, HC[2] + 1.05 * HR * nz)); }
    strap += `<polyline points="${ps(sp)}" fill="none" stroke="#9497B3" stroke-width="3.2" stroke-linecap="round" opacity=".95"/>`;
    const bandPts = []; for (let a = 0; a <= 360; a += 8) { const ph = a * Math.PI / 180, t = 74 * Math.PI / 180; const nx = Math.sin(t) * Math.cos(ph), ny = Math.sin(t) * Math.sin(ph), nz = Math.cos(t); if (nx + ny + nz > 0) bandPts.push([nx + ny, P(HC[0] + 1.04 * HR * nx, HC[1] + 1.04 * HR * ny, HC[2] + 1.04 * HR * nz)]); }
    bandPts.sort((a, b) => a[1][0] - b[1][0]);
    strap += `<polyline points="${ps(bandPts.map(b => b[1]))}" fill="none" stroke="#9497B3" stroke-width="3.2" stroke-linecap="round"/>`;
    // pod at the back
    const podS = box(X - 7, 249, 120, 14, 4, 10, '#3A3E63', { r: 1.5 }) + `<g transform="${planeY(253)}"><rect x="${X - 4}" y="-128" width="8" height="2.2" rx="1" fill="${ACC}" opacity=".8"/></g>`;
    mid += `<g class="hot-person" data-hot="cap" tabindex="0" role="button" aria-label="EEG cap: open the synchronized demo">${cap}${podS}</g>`;
    mid += strap;
    // camera
    const cam = `<g class="hot-person" data-hot="cam" tabindex="0" role="button" aria-label="Head camera: see the first-person view">` +
      box(X - 3, 222, 146, 6, 6, 6, '#6E7296') +
      box(X - 10, 212, 150, 20, 14, 15, '#2B2F4F', { r: 2, top: '#454A73' }) +
      `<g transform="${planeY(226)}"><rect x="${X - 7.5}" y="-162" width="15" height="9" rx="1.4" fill="url(#scr)"/></g>` +
      `<g transform="${planeXr(X + 10)}"><circle cx="-219" cy="-157" r="4.2" fill="#15172B" stroke="#8A8FB8" stroke-width="1.2"/></g>` +
      `<circle cx="${f(P(X + 6, 214, 165)[0])}" cy="${f(P(X + 6, 214, 165)[1])}" r="1.8" fill="#FF3B30" class="blink"/>` +
      `</g>`;
    mid += cam;
    // backrest + near arm
    front += armSVG(L, 1) + bandSVG(L, 1, 'left');
    front += box(X - 20, 254, 62, 40, 6, 30, '#7FB2E5', { r: 3, soft: true }) + box(X - 23, 255, 50, 4, 4, 14, '#5D6285', { r: 1 }) + box(X + 19, 255, 50, 4, 4, 14, '#5D6285', { r: 1 });
    return { under, back, mid, front, cam: [X, 212, 162] };
  }

  function buildLab(svg, H) {
    begin('L');
    const FOAM = `<pattern id="foam" width="22" height="22" patternUnits="userSpaceOnUse"><rect width="22" height="22" fill="#E3DCF3"/><path d="M1 1h20L11 11z" fill="#EDE8F8"/><path d="M1 1v20l10-10z" fill="#E8E2F6"/><path d="M21 1v20L11 11z" fill="#D6CDEB"/><path d="M1 21h20L11 11z" fill="#DBD3EE"/></pattern>` +
      `<pattern id="foam2" width="22" height="22" patternUnits="userSpaceOnUse"><rect width="22" height="22" fill="#D7CFEC"/><path d="M1 1h20L11 11z" fill="#E1DAF2"/><path d="M1 1v20l10-10z" fill="#DCD5EF"/><path d="M21 1v20L11 11z" fill="#CAC0E3"/><path d="M1 21h20L11 11z" fill="#CFC6E6"/></pattern>` +
      `<linearGradient id="scr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7FB8F0"/><stop offset="1" stop-color="#B9A5F2"/></linearGradient>` +
      `<linearGradient id="scr2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF9A7A"/><stop offset="1" stop-color="#FFC861"/></linearGradient>` +
      `<filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="14"/></filter>`;
    let s = '';
    // ground shadow + floor slab   (room 400 x 400, walls 228 high)
    const RW = 400, WH = 228;
    s += `<polygon points="${P3([[30, 30, -20], [RW + 40, 40, -20], [RW + 40, RW + 40, -20], [40, RW + 40, -20]])}" fill="#3B3470" opacity=".16" filter="url(#soft)"/>`;
    s += box(0, 0, -16, RW, RW, 16, '#F2E4D0', { top: '#F6EBDD', left: '#E6D2B8', right: '#D7BF9F', edgeC: '#fff' });
    s += `<g transform="${topM(0)}" stroke="#EADBC6" stroke-width="1.1">${[50, 100, 150, 200, 250, 300, 350].map(v => `<path d="M${v} 0V${RW}M0 ${v}H${RW}"/>`).join('')}</g>`;
    // rug
    s += `<g transform="${topM(.3)}"><rect x="150" y="186" width="150" height="120" rx="30" fill="#CFEADB"/><rect x="160" y="196" width="130" height="100" rx="24" fill="none" stroke="#B5DDC8" stroke-width="3" stroke-dasharray="2 7" stroke-linecap="round"/></g>`;
    // walls (left = x<0, right = y<0)
    s += box(-14, -14, 0, 14, RW + 14, WH, '#D9D1EC', { left: '#E8E2F4', right: '#CFC6E6', top: '#F3F0FA' });
    s += box(-14, -14, 0, RW + 14, 14, WH, '#E3DCF3', { left: '#E3DCF3', right: '#D3CAE8', top: '#F3F0FA' });
    s += `<g transform="${planeY(0)}"><rect x="0" y="${-WH + 4}" width="${RW}" height="${WH - 84}" fill="url(#foam)"/><rect x="0" y="-80" width="${RW}" height="4" fill="#CFC5E7"/><rect x="0" y="-76" width="${RW}" height="76" fill="#EBE6F6"/></g>`;
    s += `<g transform="${planeXr(0)}"><rect x="${-RW}" y="${-WH + 4}" width="${RW}" height="${WH - 84}" fill="url(#foam2)"/><rect x="${-RW}" y="-80" width="${RW}" height="4" fill="#C3B9DD"/><rect x="${-RW}" y="-76" width="${RW}" height="76" fill="#DED7EE"/></g>`;
    // left wall: framed screen with the 16-participant ego mosaic video (foreignObject added after)
    s += `<g transform="${planeXr(0)}"><rect x="-362" y="-210" width="276" height="160" rx="6" fill="#2A2D4C"/><rect x="-356" y="-204" width="264" height="148" rx="3" fill="#15172B"/>` +
      `<g id="heroVidSlot"></g>` +
      `<rect x="-362" y="-42" width="152" height="16" rx="8" fill="#fff" opacity=".92"/><text x="-354" y="-30.5" class="wall-label">16 PARTICIPANTS · EGO VIEW</text></g>`;
    // right wall: prompt display + lamp
    s += `<g transform="${planeY(0)}"><g transform="translate(0,22)"><rect x="146" y="-232" width="190" height="104" rx="6" fill="#2A2D4C"/><rect x="152" y="-226" width="178" height="92" rx="3" fill="#1C1F3A"/>` +
      `<rect x="164" y="-214" width="62" height="10" rx="5" fill="${ACC}"/><text x="171" y="-206.5" font-size="7" font-weight="800" fill="#fff" font-family="Plus Jakarta Sans,sans-serif" letter-spacing=".6">SCREEN PROMPT</text>` +
      `<text id="promptText" x="241" y="-170" class="prompt-text" text-anchor="middle" font-size="22">Play Cube</text>` +
      `<rect x="174" y="-156" width="134" height="5" rx="2.5" fill="#33375A"/><rect id="promptBar" x="174" y="-156" width="40" height="5" rx="2.5" fill="#FFD166"/>` +
      `<rect x="282" y="-146" width="40" height="10" rx="5" fill="#33375A"/><text x="302" y="-138.6" font-size="6.5" font-weight="700" fill="#C9CCE6" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif">Confirm</text></g></g>`;
    // wall lamp
    s += `<g transform="${planeY(0)}"><rect x="356" y="-200" width="30" height="8" rx="4" fill="#FFF3C8"/><rect x="366" y="-192" width="10" height="14" fill="#D6CDEB"/></g>`;
    // desk + participant, nudged toward the room centre
    const [ox, oy] = P(14, 46, 0);
    s += `<g transform="translate(${f(ox)},${f(oy)})">`;
    const D = { x: 100, y: 34, w: 252, d: 138 };
    s += shadow(rr(D.x, D.y, D.w, D.d), 0, 70, { a: .07, k: .7 });
    const leg = (x, y) => box(x, y, 0, 7, 7, DZ - 7, '#D9A97C', { r: 2 });
    s += leg(D.x + 6, D.y + 6) + leg(D.x + D.w - 13, D.y + 6) + leg(D.x + 6, D.y + D.d - 13);
    // person back layer (chair base, legs, far arm) is drawn below the desk front leg
    const per = personSVG();
    s += box(D.x + 6, D.y + 6, DZ - 26, D.w - 12, 4, 18, '#E7BE93');
    s += per.under;
    s += leg(D.x + D.w - 13, D.y + D.d - 13);
    s += prism(rr(D.x, D.y, D.w, D.d, 6), DZ - 7, 7, '#EBC39C', { top: '#F5D7B5', left: '#E0AE80', right: '#C99467', soft: false });
    // desk items (sorted)
    const items = deskItems().sort((a, b) => a.depth - b.depth);
    let pins = '';
    let it = `<clipPath id="deskTop"><polygon points="${P3(rr(D.x, D.y, D.w, D.d, 6).map(q => [q[0], q[1], DZ]))}"/></clipPath>`;
    items.forEach(o => {
      if (!o.key) { it += `<g>${o.svg}</g>`; return; }
      const hc = HOT[o.key], [rx, ry] = P(...hc.c);
      it += `<g class="hot" data-obj="${o.key}" tabindex="0" role="button" aria-label="${hc.label}: see the actions that use it">${o.svg}</g>`;
      pins += `<g class="pin" data-pin="${o.key}"><circle class="ring" cx="${f(rx)}" cy="${f(ry - 10)}" r="6"/><circle cx="${f(rx)}" cy="${f(ry - 10)}" r="2.8" fill="${ACC}" stroke="#fff" stroke-width="1.3"/></g>`;
    });
    s += it;
    // hands rest on the desk: person mid + front
    s += per.back + per.mid + per.front + `<g class="pins">${pins}</g>`;
    // first-person view cone
    const cp = P(...per.cam);
    const fov = [[160, 40], [300, 40], [300, 168], [160, 168]].map(q => P(q[0], q[1], DZ + .5));
    s += `<g class="cone" id="cone"><polygon points="${ps(fov)}" fill="${ACC}" opacity=".10"/>` + fov.map(q => `<line x1="${f(cp[0])}" y1="${f(cp[1])}" x2="${f(q[0])}" y2="${f(q[1])}" stroke="${ACC}" stroke-width="1.2" stroke-dasharray="3 3"/>`).join('') + `<polygon points="${ps(fov)}" fill="none" stroke="${ACC}" stroke-width="1.4" stroke-dasharray="4 3"/></g></g>`;
    finish(svg, s, FOAM);

    // hero video on the left wall (foreignObject, mp4 then webm)
    const slot = svg.querySelector('#heroVidSlot');
    const fo = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
    fo.setAttribute('x', '-356'); fo.setAttribute('y', '-204'); fo.setAttribute('width', '264'); fo.setAttribute('height', '148');
    const v = document.createElement('video');
    v.id = 'heroVideo'; v.muted = true; v.loop = true; v.playsInline = true; v.autoplay = !RM; v.preload = 'auto';
    v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.poster = 'shared/img/hero-grid.jpg';
    v.setAttribute('aria-label', 'Mosaic of 16 participants’ first-person views');
    v.style.cssText = 'width:264px;height:148px;object-fit:cover;display:block;border-radius:3px;background:#15172B';
    v.innerHTML = '<source src="shared/img/hero-grid.mp4" type="video/mp4"><source src="shared/img/hero-grid.webm" type="video/webm">';
    fo.appendChild(v); slot.appendChild(fo);
    if (!RM) { const p = v.play(); if (p && p.catch) p.catch(() => {}); }

    // prompt cycling
    const pt = svg.querySelector('#promptText'), pb = svg.querySelector('#promptBar');
    let pi = 0, hold = null, t0 = performance.now();
    function tick(now) {
      const el = (now - t0) / 3200;
      if (!hold && el >= 1) { pi = (pi + 1) % PROMPTS.length; pt.textContent = PROMPTS[pi]; t0 = now; }
      pb.setAttribute('width', f(134 * Math.max(0, Math.min(1, hold ? 1 : el))));
      if (!RM) requestAnimationFrame(tick);
    }
    if (!RM) requestAnimationFrame(tick);
    const setPrompt = txt => { hold = txt; pt.textContent = txt || PROMPTS[pi]; if (!txt) t0 = performance.now(); };

    // interactions
    const used = () => { svg.classList.add('used'); H.used && H.used(); };
    svg.querySelectorAll('.hot').forEach(g => {
      const k = g.dataset.obj;
      g.addEventListener('mouseenter', () => setPrompt(H.promptFor(k)));
      g.addEventListener('mouseleave', () => setPrompt(null));
      const go = e => { used(); svg.querySelectorAll('.sel').forEach(x => x.classList.remove('sel')); g.classList.add('sel'); H.onObject(k, g, e); };
      g.addEventListener('click', go);
      g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(e); } });
    });
    const cone = svg.querySelector('#cone');
    svg.querySelectorAll('.hot-person').forEach(g => {
      const k = g.dataset.hot;
      g.addEventListener('mouseenter', () => { if (k === 'cam') cone.classList.add('on'); setPrompt(k === 'cap' ? 'EEG · 32 ch' : k === 'cam' ? 'Ego view' : 'IMU × 4'); });
      g.addEventListener('mouseleave', () => { if (!g.classList.contains('sel')) cone.classList.remove('on'); setPrompt(null); });
      const go = e => { used(); svg.querySelectorAll('.sel').forEach(x => x.classList.remove('sel')); if (k === 'bands') svg.querySelectorAll('[data-hot=bands]').forEach(x => x.classList.add('sel')); else g.classList.add('sel'); cone.classList.toggle('on', k === 'cam'); H.onPerson(k, g, e); };
      g.addEventListener('click', go);
      g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(e); } });
    });
    // touch screens: every small hotspot gets an invisible hit box of at least ~32 css px. The boxes sit in a
    // layer BEHIND the whole drawing (decor ignores pointers on touch, see .lab.coarse in the CSS), so a visible
    // object always wins over a neighbour's box and the boxes only catch taps that land in the gaps around objects.
    const coarse = matchMedia('(pointer: coarse)');
    const NS = 'http://www.w3.org/2000/svg';
    const hits = () => {
      svg.querySelector('#hitLayer')?.remove();
      svg.classList.toggle('coarse', coarse.matches);
      const m = svg.getScreenCTM(); if (!coarse.matches || !m) return;
      const inv = m.inverse(), k = Math.hypot(m.a, m.b), min = 32 / k;
      const layer = document.createElementNS(NS, 'g'); layer.id = 'hitLayer';
      svg.querySelectorAll('.hot, .hot-person').forEach(g => {
        const r = g.getBoundingClientRect();
        const p0 = new DOMPoint(r.left, r.top).matrixTransform(inv), p1 = new DOMPoint(r.right, r.bottom).matrixTransform(inv);
        const bw = p1.x - p0.x, bh = p1.y - p0.y, w = Math.max(bw, min), h = Math.max(bh, min);
        const t = document.createElementNS(NS, 'rect');
        t.setAttribute('class', 'hit'); t.setAttribute('fill', 'rgba(0,0,0,0)');
        t.setAttribute('x', f(p0.x + bw / 2 - w / 2)); t.setAttribute('y', f(p0.y + bh / 2 - h / 2)); t.setAttribute('width', f(w)); t.setAttribute('height', f(h));
        t.addEventListener('click', e => { e.stopPropagation(); g.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: e.clientX, clientY: e.clientY })); });
        layer.appendChild(t);
      });
      svg.insertBefore(layer, svg.querySelector(':scope > :not(defs)'));
    };
    hits(); addEventListener('resize', hits); coarse.addEventListener('change', hits);
    return { clearSel() { svg.querySelectorAll('.sel').forEach(x => x.classList.remove('sel')); cone.classList.remove('on'); } };
  }

  /* =====================================================================
     camera rig for the sticky worlds: viewBox follows scroll
     ===================================================================== */
  function rig(section, svg, path, opts) {
    // path(p) -> [cx, cy] world-screen point the camera looks at; zoom from opts
    let W = 1, Hh = 1, raf = 0, last = -1;
    const size = () => { const r = svg.getBoundingClientRect(); W = r.width || innerWidth; Hh = r.height || innerHeight; last = -1; upd(); };
    function prog() { const r = section.getBoundingClientRect(); const tot = r.height - innerHeight; return Math.max(0, Math.min(1, -r.top / (tot || 1))); }
    function upd() {
      raf = 0; const p = prog(); if (Math.abs(p - last) < 1e-4) return; last = p;
      const mob = W < 700;
      const vw = (mob ? opts.mobileW : opts.width) * (opts.zoom ? opts.zoom(p, mob) : 1);
      const vh = vw * Hh / W;
      const [cx, cy] = path(p, mob);
      const ox = mob ? .5 : (opts.anchorX || .62), oy = mob ? (opts.anchorYm || .68) : (opts.anchorY || .55);
      svg.setAttribute('viewBox', `${f(cx - vw * ox)} ${f(cy - vh * oy)} ${f(vw)} ${f(vh)}`);
      opts.onProgress && opts.onProgress(p, mob);
    }
    addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(upd); }, { passive: true });
    addEventListener('resize', size);
    size();
    return { update: () => { last = -1; upd(); } };
  }

  /* =====================================================================
     SCENE 2 — forty tiny desks
     ===================================================================== */
  const SWEATERS = ['#8FCFC2', '#F7A889', '#9DB8EE', '#F4C76B', '#C3A9F0', '#7CC8A0', '#F59AB5', '#86C5E8', '#E9B48A', '#A7B2D6'];
  const SP = 128; // spacing along x
  // two recording environments: A = main scene (P0001–P0034, round dark-wood table, grey carpet),
  // B = new scene for the cross-scene test (P0035–P0040, light rectangular desk crowded with snacks and books, warm room)
  function miniSymbol(kind = 'A') {
    const B = kind === 'B';
    let s = '';
    s += box(0, 0, -8, 100, 100, 8, '#F2E4D0', { top: '#F7EDE0', left: '#E6D2B8', right: '#D7BF9F' });
    s += `<g transform="${topM(.2)}"><rect x="14" y="44" width="72" height="50" rx="12" fill="${B ? '#F6D8B4' : '#D3D1DA'}"/></g>`;
    s += B ? box(0, -6, 0, 100, 6, 64, '#F0DEC8', { left: '#F3E4D2', right: '#E2CBB0', top: '#F8EEE2' }) : box(0, -6, 0, 100, 6, 64, '#E3DCF3', { left: '#E6E0F5', right: '#D3CAE8', top: '#F3F0FA' });
    s += `<g transform="${planeY(0)}"><rect x="0" y="-62" width="100" height="36" fill="${B ? '#EAD5BC' : 'url(#foamS)'}"/><rect x="34" y="-54" width="38" height="22" rx="2" fill="#2A2D4C"/><rect x="36" y="-52" width="34" height="18" rx="1" fill="#1C1F3A"/><rect x="40" y="-46" width="20" height="5" rx="2.5" fill="${ACC}"/></g>`;
    if (B) {
      s += shadow(rr(18, 10, 66, 38), 0, 26, { a: .07, k: .6 });
      s += box(21, 13, 0, 3, 3, 26, '#D9A97C') + box(78, 13, 0, 3, 3, 26, '#D9A97C') + box(21, 42, 0, 3, 3, 26, '#D9A97C');
      s += box(78, 42, 0, 3, 3, 26, '#D9A97C');
      s += box(18, 10, 26, 66, 38, 3, '#EBC39C', { r: 2, top: '#F5D7B5', left: '#E0AE80', right: '#C99467' });
    } else {
      s += cshadow(51, 29, 0, 27, 26, { a: .08, k: .6 });
      s += cyl(51, 29, 0, 9, 1.4, '#4E3A2E') + cyl(51, 29, 1.4, 2.6, 24.6, '#5E4636');
      s += cyl(51, 29, 26, 27, 3, '#6E5140', { top: '#8A6A54', edge: false });
    }
    // laptop
    s += box(40, 16, 29, 22, 15, 1.2, '#D8DCE8') + box(40, 15, 29.6, 22, 1.6, 14, '#C9CEDD') + `<g transform="${planeY(16.6)}"><rect x="41.5" y="-42.5" width="19" height="11.5" rx="1" fill="url(#scrS)"/></g>`;
    // can + cube + book
    s += B ? cyl(27, 22, 29, 2.6, 8, '#E9473B') + box(68, 30, 29, 6, 6, 6, '#FFD23F', { r: .6 }) + box(24, 32, 29, 12, 9, 2.4, '#7FA6D8') + box(25, 31, 31.4, 10, 8, 2, '#FFC861')
           : cyl(33, 19, 29, 2.6, 8, '#E9473B') + box(62, 34, 29, 6, 6, 6, '#FFD23F', { r: .6 }) + box(29, 30, 29, 12, 9, 2.4, '#7FA6D8') + box(30, 29, 31.4, 10, 8, 2, '#FFC861');
    // new scene: the desk is crowded — snack bags, a book pile, a cup and sweets
    if (B) s += box(66, 13, 29, 9, 4, 11, '#E8473B', { r: 1 }) + box(74, 18, 29, 6, 4, 9, '#FFB13B', { r: 1 }) + box(20, 13, 29, 13, 10, 3, '#9C7BD6') + box(21, 14, 32, 12, 9, 3, '#5FB58C') + box(22, 14, 35, 10, 8, 2.6, '#F48FB1') +
      cyl(72, 40, 29, 2.4, 5, '#FFFFFF', { top: '#C9A27E' }) + [[34, 41, '#F48FB1'], [37, 43, '#80CBC4'], [32, 44, '#FFE082']].map(([x, y, c]) => sphere(x, y, 30.2, 1.6, c)).join('');
    // chair + person (sweater = currentColor)
    [[41, 59], [59, 59], [41, 73], [59, 73]].forEach(([lx, ly]) => s += box(lx, ly, 0, 1.6, 1.6, 18, '#5D6285')); s += box(40, 58, 18, 22, 18, 3.5, '#7FB2E5', { r: 3 });
    const sw = `currentColor`;
    const tubeC = (a, b, w) => { const [x1, y1] = P(...a), [x2, y2] = P(...b); return `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${sw}" stroke-width="${w}" stroke-linecap="round"/><line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="#000" stroke-opacity=".08" stroke-width="${w}" stroke-linecap="round"/>`; };
    s += tubeC([42, 63, 46], [43, 46, 34], 5) + tubeC([60, 63, 46], [58, 46, 34], 5);
    // torso (flat faces with currentColor)
    const tx = 41, ty = 58, tw = 20, td = 11, z0 = 21, th = 26;
    s += `<polygon points="${qY(ty + td, tx, tx + tw, z0, z0 + th)}" fill="${sw}"/><polygon points="${qX(tx + tw, ty, ty + td, z0, z0 + th)}" fill="${sw}"/><polygon points="${qX(tx + tw, ty, ty + td, z0, z0 + th)}" fill="#000" opacity=".16"/><polygon points="${qZ(z0 + th, tx, tx + tw, ty, ty + td)}" fill="${sw}"/><polygon points="${qZ(z0 + th, tx, tx + tw, ty, ty + td)}" fill="#fff" opacity=".25"/>`;
    s += sphere(51, 63, 55, 6.5, '#5A4338');
    const [hx, hy] = P(51, 63, 55);
    s += `<path d="M${f(hx - 7.9)},${f(hy + .6)}A7.9 4.6 0 0 0 ${f(hx + 7.9)},${f(hy + .6)}A8 8 0 0 0 ${f(hx - 7.9)},${f(hy + .6)}Z" fill="#2E3260"/>`;
    [[-4, -3], [0, -5.5], [4, -3], [-2, -1], [2.5, -1], [0, 1.5], [-5.5, 0], [5.5, 0]].forEach(([dx, dy]) => s += `<circle cx="${f(hx + dx)}" cy="${f(hy + dy)}" r="1.15" fill="${ACC}"/>`);
    s += box(48, 56, 60, 6, 5, 5, '#262A45', { r: 1 });
    s += box(41, 74.5, 21.5, 1.6, 1.6, 4, '#5D6285') + box(59, 74.5, 21.5, 1.6, 1.6, 4, '#5D6285') + box(40, 75, 24, 22, 3, 15, '#7FB2E5', { r: 2 });
    return `<symbol id="${B ? 'miniB' : 'mini'}" overflow="visible">${s}</symbol>`;
  }
  function buildDesks(svg, H) {
    begin('D');
    const defs = `<pattern id="foamS" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="#E3DCF3"/><path d="M.5 .5h9L5 5z" fill="#EDE8F8"/><path d="M9.5 .5v9L5 5z" fill="#D6CDEB"/></pattern><linearGradient id="scrS" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7FB8F0"/><stop offset="1" stop-color="#B9A5F2"/></linearGradient><filter id="softD" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="10"/></filter>`;
    const sym = miniSymbol('A') + miniSymbol('B'), NEW0 = 34;  // P0035–P0040 = new scene
    let s = '';
    // ground ribbon
    s += `<polygon points="${P3([[-40, -40, -10], [SP * 40 + 20, -40, -10], [SP * 40 + 20, 150, -10], [-40, 150, -10]])}" fill="#3B3470" opacity=".08" filter="url(#softD)"/>`;
    // dotted path on the "ground"
    s += `<g transform="${topM(-8)}"><path d="M-30 128H${SP * 40}" stroke="#D9CFEA" stroke-width="3" stroke-dasharray="2 10" stroke-linecap="round"/></g>`;
    for (let i = 0; i < 40; i++) {
      const id = 'P' + String(i + 1).padStart(4, '0');
      const [x, y] = P(i * SP, 0, 0);
      const [tx, ty] = P(i * SP + 50, 112, -8);
      s += `<g class="desk" data-s="${id}" tabindex="0" role="button" aria-label="${id}: open this participant in the gallery">` +
        `<g class="lift"><use href="#${i >= NEW0 ? 'miniB' : 'mini'}" transform="translate(${f(x)},${f(y)})" style="color:${SWEATERS[(i * 7) % SWEATERS.length]}"/></g>` +
        `<rect class="tag-b${i >= NEW0 ? ' tag-new' : ''}" x="${f(tx - 24)}" y="${f(ty + 4)}" width="48" height="16" rx="8"/><text class="tag-t" x="${f(tx)}" y="${f(ty + 15.5)}" text-anchor="middle">${id}</text>` +
        `<g class="flagslot" data-s="${id}" transform="translate(${f(tx + 26)},${f(ty + 4)})"></g></g>`;
    }
    { const [bx, by] = P(NEW0 * SP + 50, -6, 82); s += `<g class="scene-flag"><rect x="${f(bx - 84)}" y="${f(by - 15)}" width="168" height="24" rx="12"/><text x="${f(bx)}" y="${f(by + 1.5)}" text-anchor="middle">New scene · test only →</text></g>`; }
    finish(svg, s, defs + sym);
    const tip = document.getElementById('deskTip');
    const now = document.getElementById('deskNow'), bar = document.querySelector('#deskBar em');
    const cards = [...document.querySelectorAll('#deskCards .scard')];
    const sec = document.getElementById('desks');
    let lastTouch = null;
    svg.querySelectorAll('.desk').forEach(g => {
      const id = g.dataset.s;
      const show = e => { const html = H.deskTip(id); if (!html) return; tip.innerHTML = html; tip.hidden = false; place(e); };
      const place = e => { const r = sec.querySelector('.story-sticky').getBoundingClientRect(); let x = e.clientX - r.left + 18, y = e.clientY - r.top - 40; if (x + 260 > r.width) x = e.clientX - r.left - 270; if (y + 260 > r.height) y = r.height - 270; tip.style.left = Math.max(8, x) + 'px'; tip.style.top = Math.max(70, y) + 'px'; };
      g.addEventListener('pointerenter', e => { if (e.pointerType !== 'touch') show(e); });
      g.addEventListener('pointermove', e => { if (!tip.hidden && e.pointerType !== 'touch') place(e); });
      g.addEventListener('pointerleave', () => { tip.hidden = true; });
      g.addEventListener('click', e => {
        if (e.pointerType === 'touch' || (e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents)) { if (lastTouch !== id) { lastTouch = id; show(e); return; } }
        tip.hidden = true; H.onDesk(id);
      });
      g.addEventListener('keydown', e => { if (e.key === 'Enter') H.onDesk(id); });
    });
    rig(sec, svg, (p) => { const a = P(10 + Math.min(1, p) * (SP * 36), 50, 30); return a; }, {
      width: 980, mobileW: 400, anchorX: .6, anchorY: .5, anchorYm: .7,
      onProgress(p) {
        const idx = Math.min(39, Math.round(p * 39));
        now.textContent = 'P' + String(idx + 1).padStart(4, '0');
        bar.style.width = (p * 100).toFixed(1) + '%';
        const ci = idx >= NEW0 ? cards.length - 1 : Math.min(cards.length - 2, Math.floor(idx / NEW0 * (cards.length - 1)));  // last card = the new scene
        cards.forEach((c, i) => c.classList.toggle('on', i === ci));
        tip.hidden = true;
      }
    });
    return {
      flag(id, txt) { const g = svg.querySelector(`.flagslot[data-s="${id}"]`); if (g) g.innerHTML = `<circle cx="7" cy="8" r="7" fill="${ACC}"/><text class="flag" x="7" y="11.2" text-anchor="middle">!</text><title>${txt}</title>`; }
    };
  }

  /* =====================================================================
     SCENE 3 — the Brain-TIM data factory
     ===================================================================== */
  const MACH = {
    window: ['Sliding window', 'Video and EEG are cut with identical window indices: duration Δt, stride δt, N = ⌊(T−Δt)/δt⌋+1 windows. The stride is smaller than any potential misalignment, so overlapping windows give temporal redundancy and robustness to sub-second jitter.'],
    venc: ['Visual encoder · VideoMAE ❄', 'Frozen, 305.0M parameters, pre-trained on EPIC-KITCHENS-100. K uniformly sampled frames per window, resized to 224×224 and ImageNet-normalized → one 1024-d feature per window.'],
    benc: ['Brain encoder · LaBraM ❄', 'Frozen, 5.8M parameters (≈1/52 of the visual encoder), pre-trained on 2,500 h of masked EEG. Per-channel 2000-d features, channel-average pooled into one brain feature per window.'],
    emb: ['Embedding layers g', 'Learnable projections g^v and g^b map both modalities into a shared D-dimensional space.'],
    tim: ['TIM · Time-Interval MLP', 'I(·): ℝ² → ℝ^D, three linear layers with ReLU and LayerNorm. Feature tokens get I(t_i, t_i+Δt) (feature time), CLS tokens get the query interval ((j−1)T/Q, jT/Q). The time embedding is concatenated to the token; modality embeddings m^v, m^b are added.'],
    cls: ['CLS tokens', '2Q learnable CLS tokens — Q for vision, Q for EEG — one per query interval. X = [visual features | brain features | visual CLS | brain CLS] ∈ ℝ^((2N+2Q)×2D).'],
    trans: ['Transformer encoder × n', 'n layers of Multi-Head Attention → Add & Norm → Feed Forward → Add & Norm, over the whole multimodal sequence: cross-modal, time-aware interaction.'],
    heads: ['Heads h^v and h^b', 'Modality-specific, query-specific CLS outputs go to linear + softmax heads for verbs (10) and actions (29). Loss L = L_v + λ·L_b (cross-entropy per modality branch).'],
    podium: ['Results podium', 'Top-1 accuracy, mean over 5 seeds. Toggle protocol and task below. Visual + EEG is the visual head of the fused model.'],
  };
  function buildFactory(svg, H) {
    begin('F');
    const defs = `<filter id="softF" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="12"/></filter>` +
      `<pattern id="belt" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="#4A4E73"/><rect width="2" height="12" fill="#5B5F86"/></pattern>` +
      `<symbol id="tokV" overflow="visible">${box(-5, -5, 0, 10, 10, 10, '#7CC8A0', { r: 1.5 })}</symbol>` +
      `<symbol id="tokB" overflow="visible">${box(-5, -5, 0, 10, 10, 10, '#F59AB5', { r: 1.5 })}</symbol>` +
      `<symbol id="tokVT" overflow="visible">${box(-5, -5, 0, 10, 10, 6, '#7CC8A0', { r: 1.5 })}${box(-5, -5, 6, 10, 10, 5, '#8EC5F0', { r: 1.5 })}</symbol>` +
      `<symbol id="tokBT" overflow="visible">${box(-5, -5, 0, 10, 10, 6, '#F59AB5', { r: 1.5 })}${box(-5, -5, 6, 10, 10, 5, '#8EC5F0', { r: 1.5 })}</symbol>` +
      `<symbol id="tokC" overflow="visible">${box(-5, -5, 0, 10, 10, 10, '#FFD166', { r: 5, soft: true })}</symbol>` +
      `<symbol id="tokO" overflow="visible">${sphere(0, 0, 6, 5.5, '#B59CE6')}</symbol>` +
      `<symbol id="tileV" overflow="visible">${box(-9, -1, 0, 18, 2, 20, '#ffffff', { edge: false, left: '#fff', right: '#E6E9F2' })}<g transform="${planeY(1)}"><rect x="-8" y="-18" width="16" height="16" rx="2" fill="#9FD3F5"/><circle cx="-3" cy="-13" r="2.4" fill="#FFD166"/><path d="M-8 -4l5-6 4 4 3-3 4 5z" fill="#7CC8A0"/></g></symbol>` +
      `<symbol id="tileB" overflow="visible">${box(-9, -1, 0, 18, 2, 20, '#ffffff', { edge: false, left: '#fff', right: '#E6E9F2' })}<g transform="${planeY(1)}"><rect x="-8" y="-18" width="16" height="16" rx="2" fill="#FFF1EC"/><path d="M-8 -10l2 -3 2 6 2 -8 2 7 2 -4 2 3 2 -1 2 0" fill="none" stroke="${ACC}" stroke-width="1.1"/><path d="M-8 -5h16" stroke="#B59CE6" stroke-width=".9"/></g></symbol>`;
    const YV = 0, YB = 130, YM = 65, Z = 14;
    let s = '';
    const beltSeg = (x0, x1, y, w = 26) => box(x0, y - w / 2, 0, x1 - x0, w, Z, '#6A6E95', { top: '#4A4E73', left: '#8A8EB2', right: '#6A6E95' }) +
      `<g transform="${topM(Z)}"><rect class="beltmove" x="${x0 + 2}" y="${y - w / 2 + 3}" width="${x1 - x0 - 4}" height="${w - 6}" rx="3" fill="url(#belt)"/></g>`;
    const label = (x, y, z, t, sub, cls = '') => { const [sx, sy] = P(x, y, z); const w = Math.max(t.length * 7.6, sub ? sub.length * 5.9 : 0) + 22, h = sub ? 38 : 24; return `<g class="lbl"><rect x="${f(sx - w / 2)}" y="${f(sy - 17)}" width="${f(w)}" height="${h}" rx="${h / 2 > 14 ? 14 : h / 2}" fill="#fff" fill-opacity=".92" stroke="#E3E8F1"/><text class="mlabel ${cls}" x="${f(sx)}" y="${f(sy)}" text-anchor="middle">${t}</text>` + (sub ? `<text class="msub" x="${f(sx)}" y="${f(sy + 14)}" text-anchor="middle">${sub}</text>` : '') + '</g>'; };
    const mach = (key, inner) => `<g class="mach" data-m="${key}" tabindex="0" role="button" aria-label="${MACH[key][0]}"><g class="lift">${inner}</g></g>`;
    // floor plate
    s += `<polygon points="${P3([[-120, -120, -14], [1560, -120, -14], [1560, 260, -14], [-120, 260, -14]])}" fill="#3B3470" opacity=".12" filter="url(#softF)"/>`;
    s += box(-120, -110, -12, 1660, 350, 12, '#E9EEF6', { top: '#F1F5FA', left: '#DCE3EE', right: '#C9D2E1' });
    s += `<g transform="${topM(0)}" stroke="#E0E7F1" stroke-width="1.2">${Array.from({ length: 31 }, (_, i) => `<path d="M${-120 + i * 55} -110V240"/>`).join('')}<path d="M-120 65H1540" stroke="#D5DDEA" stroke-width="2" stroke-dasharray="10 10"/></g>`;
    // section labels painted on the floor
    const floorTxt = (x, y, t) => `<g transform="${topM(.5)}"><text x="${x}" y="${y}" font-size="15" font-weight="800" fill="#C7D0E0" font-family="Plus Jakarta Sans,sans-serif">${t}</text></g>`;
    s += floorTxt(-100, 230, '01 · WINDOW') + floorTxt(200, 230, '02 · ENCODE') + floorTxt(450, 230, '03 · EMBED + TIME') + floorTxt(700, 230, '04 · CLS') + floorTxt(860, 230, '05 · TRANSFORMER') + floorTxt(1220, 230, '06 · RESULTS');
    // --- belts ---
    let back = '', mid = '', front = '';
    back += beltSeg(-90, 800, YV);
    // inputs: hoppers
    back += mach('window', box(-110, YV - 36, 0, 40, 72, 50, '#CFE2F6', { r: 6, soft: true }) + `<g transform="${planeY(YV + 36)}"><rect x="-104" y="-44" width="28" height="18" rx="3" fill="#2A2D4C"/><path d="M-100 -36l4-3v6zM-92 -39h10v6h-10z" fill="#9FD3F5"/></g>` + label(-90, YV, 76, 'Ego video', '30 fps'));
    // real ego thumbnails stacked behind the video hopper
    const thumbs = H.factoryThumbs || [];
    thumbs.slice(0, 3).forEach((src, i) => {
      const x = -128 + i * 26;
      back += box(x, YV - 64, 0, 22, 2, 24, '#fff', { edge: false, left: '#fff', right: '#E6E9F2' }) + `<g transform="${planeY(YV - 62)}"><image href="${src}" x="${x + 2}" y="-22" width="18" height="18" preserveAspectRatio="xMidYMid slice"/></g>`;
    });
    // window gantry
    const gantry = (x) => box(x, YV - 30, 0, 6, 6, 70, '#FFB4A3') + box(x, YB + 24, 0, 6, 6, 70, '#FFB4A3') + box(x, YV - 30, 70, 6, YB - YV + 60, 6, '#FF8F78', { r: 2 }) +
      `<g transform="${topM(Z + .5)}"><rect x="${x - 26}" y="${YV - 13}" width="58" height="26" fill="${ACC}" opacity=".12" stroke="${ACC}" stroke-dasharray="3 3"/><rect x="${x - 26}" y="${YB - 13}" width="58" height="26" fill="${ACC}" opacity=".12" stroke="${ACC}" stroke-dasharray="3 3"/><rect x="${x - 10}" y="${YV - 13}" width="58" height="26" fill="none" stroke="${ACC}" stroke-opacity=".5" stroke-dasharray="2 4"/></g>`;
    mid += mach('window', gantry(170) + label(176, YM, 118, 'Sliding window', 'same indices · Δt, stride δt'));
    // visual encoder (big)
    const VE = { x: 270, w: 130, d: 100, h: 112 };
    mid += mach('venc', bshadow(VE.x, YV - VE.d / 2, 0, VE.w, VE.d, VE.h, { a: .08, k: .5 }) + box(VE.x, YV - VE.d / 2, 0, VE.w, VE.d, VE.h, '#B9E3CB', { r: 10, soft: true, top: '#D3EFDF' }) +
      `<g transform="${planeY(YV + VE.d / 2)}"><rect x="${VE.x + 16}" y="${-VE.h + 18}" width="${VE.w - 32}" height="44" rx="8" fill="#fff" opacity=".85"/><text x="${VE.x + VE.w / 2}" y="${-VE.h + 46}" text-anchor="middle" font-size="17" font-weight="800" fill="#2C6B4E" font-family="Plus Jakarta Sans,sans-serif">VideoMAE</text><rect x="${VE.x + 30}" y="-34" width="${VE.w - 60}" height="22" rx="4" fill="#2A2D4C"/><rect x="${VE.x + 34}" y="-30" width="${VE.w - 68}" height="14" rx="2" fill="#7CC8A0" opacity=".45"/></g>` +
      `<g transform="${topM(YV + VE.h)}"><text x="${VE.x + 64}" y="${YV - 12}" font-size="30" text-anchor="middle" fill="#7FB8E6">❄</text></g>` +
      label(VE.x + VE.w / 2, YV, VE.h + 46, 'Visual encoder', '305.0M · frozen'));
    // EEG belt + hopper
    front += beltSeg(-90, 800, YB);
    front += mach('window', box(-110, YB - 36, 0, 40, 72, 50, '#FFD9D0', { r: 6, soft: true }) + `<g transform="${planeY(YB + 36)}"><rect x="-104" y="-44" width="28" height="18" rx="3" fill="#2A2D4C"/><path d="M-102 -35l3-4 3 7 3-6 3 4 3-2 3 2" fill="none" stroke="#FF9C85" stroke-width="1.4"/></g>` + label(-90, YB, 76, 'EEG · 32 ch', '200 Hz'));
    // brain encoder (tiny — volume ≈ 1/52)
    const BE = { x: 318, w: 34, d: 28, h: 27 };
    front += mach('benc', bshadow(BE.x, YB - BE.d / 2, Z, BE.w, BE.d, BE.h, { a: .1, k: .6 }) + box(BE.x, YB - BE.d / 2, Z, BE.w, BE.d, BE.h, '#F8B9C8', { r: 5, soft: true, top: '#FCD3DC' }) +
      `<g transform="${planeY(YB + BE.d / 2)}"><text x="${BE.x + BE.w / 2}" y="${-Z - 10}" text-anchor="middle" font-size="7.5" font-weight="800" fill="#A33A57" font-family="Plus Jakarta Sans,sans-serif">LaBraM</text></g>` +
      label(BE.x + BE.w / 2, YB + 62, 0, 'Brain encoder', '5.8M · frozen · ≈1/52 the size'));
    // embedding presses g^v / g^b
    const press = (x, y, c, t) => box(x, y - 20, 0, 34, 6, 46, '#F8CBAD', { r: 2 }) + box(x, y + 14, 0, 34, 6, 46, '#F8CBAD', { r: 2 }) + box(x - 2, y - 20, 46, 38, 40, 12, '#FFB98A', { r: 4, top: '#FFD2B3' }) +
      `<g transform="${planeY(y + 20)}"><text x="${x + 17}" y="-49" text-anchor="middle" font-size="11" font-weight="800" fill="#9A4F1E" font-family="Plus Jakarta Sans,sans-serif">${t}</text></g>`;
    mid += mach('emb', press(470, YV, '#F8CBAD', 'g ᵛ') + label(487, YV, 96, 'Embedding gᵛ, gᵇ'));
    front += mach('emb', press(470, YB, '#F8CBAD', 'g ᵇ'));
    // TIM clock tower between the belts
    const TX = 590;
    mid += mach('tim', bshadow(TX - 18, YM - 18, 0, 36, 36, 100, { a: .08, k: .5 }) + box(TX - 18, YM - 18, 0, 36, 36, 96, '#BFD9F2', { r: 6, soft: true, top: '#D6E7F8' }) +
      cyl(TX, YM, 96, 20, 6, '#8EC5F0') + `<g transform="${topM(102)}"><circle cx="${TX}" cy="${YM}" r="16" fill="#fff"/><circle cx="${TX}" cy="${YM}" r="16" fill="none" stroke="#5A8FCB" stroke-width="2"/><path d="M${TX} ${YM}V${YM - 11}" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/><path class="clockhand" d="M${TX} ${YM}L${TX + 9} ${YM + 3}" stroke="${ACC}" stroke-width="2.2" stroke-linecap="round"/></g>` +
      box(TX - 6, YV + 12, 78, 12, YM - YV - 30, 8, '#8EC5F0', { r: 2 }) + box(TX - 6, YM + 18, 78, 12, YB - YM - 30, 8, '#8EC5F0', { r: 2 }) +
      label(TX + 10, YB + 66, 0, 'TIM · Time-Interval MLP', 'I(start, end) ‖ token  ·  + mᵛ / mᵇ'));
    // modality paint nozzles
    mid += mach('tim', cyl(650, YV - 22, 0, 4, 40, '#9DB8EE') + box(644, YV - 22, 40, 12, 22, 6, '#7D93C6', { r: 2 }));
    front += mach('tim', cyl(650, YB + 22, 0, 4, 40, '#F59AB5') + box(644, YB, 40, 12, 22, 6, '#E07A98', { r: 2 }));
    // CLS dispenser
    mid += mach('cls', bshadow(712, YM - 20, 0, 40, 40, 70, { a: .08, k: .5 }) + box(712, YM - 20, 0, 40, 40, 62, '#FFE7A8', { r: 8, soft: true, top: '#FFF1C9' }) + cyl(732, YM, 62, 14, 14, '#FFD166') +
      sphere(732, YM, 84, 5, '#FFD166') + sphere(724, YM + 4, 80, 5, '#FFD166') + sphere(739, YM - 4, 80, 5, '#FFC23C') +
      `<g transform="${planeY(YM + 20)}"><text x="732" y="-30" text-anchor="middle" font-size="14" font-weight="800" fill="#8A6400" font-family="Plus Jakarta Sans,sans-serif">2Q</text></g>` + label(732, YM, 128, 'CLS tokens', 'Q visual + Q brain'));
    // merge belt + transformer
    let late = '';
    late += box(790, YV - 13, 0, 40, YB - YV + 26, Z, '#6A6E95', { top: '#4A4E73', left: '#8A8EB2', right: '#6A6E95' });
    late += beltSeg(820, 880, YM, 40);
    const TR = { x: 870, w: 190, d: 150, h: 120 };
    late += mach('trans', bshadow(TR.x, YM - TR.d / 2, 0, TR.w, TR.d, TR.h, { a: .08, k: .5 }) + box(TR.x, YM - TR.d / 2, 0, TR.w, TR.d, TR.h, '#D9CCF5', { r: 14, soft: true, top: '#E7DEFA' }) +
      `<g transform="${topM(TR.h)}">${[0, 1, 2].map(i => `<rect x="${TR.x + 22 + i * 54}" y="${YM - 50}" width="40" height="100" rx="10" fill="#fff" opacity=".7"/><text x="${TR.x + 42 + i * 54}" y="${YM + 4}" text-anchor="middle" font-size="9" font-weight="800" fill="#6B55B0" font-family="Plus Jakarta Sans,sans-serif">${['MHA', 'Norm', 'FFN'][i]}</text>`).join('')}<path class="attn" d="M${TR.x + 30} ${YM - 40}C${TR.x + 90} ${YM - 90} ${TR.x + 120} ${YM - 90} ${TR.x + 160} ${YM - 40}M${TR.x + 40} ${YM + 40}C${TR.x + 90} ${YM + 90} ${TR.x + 130} ${YM + 90} ${TR.x + 170} ${YM + 30}" fill="none" stroke="${ACC}" stroke-width="2" stroke-dasharray="4 5"/></g>` +
      `<g transform="${planeY(YM + TR.d / 2)}"><rect x="${TR.x + 24}" y="${-TR.h + 22}" width="${TR.w - 48}" height="36" rx="8" fill="#fff" opacity=".85"/><text x="${TR.x + TR.w / 2}" y="${-TR.h + 46}" text-anchor="middle" font-size="16" font-weight="800" fill="#4E3A93" font-family="Plus Jakarta Sans,sans-serif">Transformer × n</text></g>` +
      label(TR.x + TR.w / 2, YM, TR.h + 70, 'Transformer encoder', 'over (2N + 2Q) tokens'));
    // heads
    late += beltSeg(1060, 1120, YV + 10, 22) + beltSeg(1060, 1120, YB - 10, 22);
    const head = (y, c, t) => box(1120, y - 16, 0, 32, 32, 40, c, { r: 6, soft: true }) + `<g transform="${planeY(y + 16)}"><text x="1136" y="-16" text-anchor="middle" font-size="11" font-weight="800" fill="${INK}" font-family="Plus Jakarta Sans,sans-serif">${t}</text></g>`;
    late += mach('heads', head(YV + 10, '#B9C8EE', 'h ᵛ') + head(YB - 10, '#F8B9C8', 'h ᵇ') + label(1136, YM, 110, 'Heads → L = Lᵥ + λ·L_b', 'verb (10) · action (29)'));
    // podium (filled by setPodium)
    late += `<g class="mach" data-m="podium" tabindex="0" role="button" aria-label="Results podium"><g id="podium"></g></g>`;
    s += back + `<g id="tokLayerV"></g>` + mid + front + `<g id="tokLayerB"></g>` + late + `<g id="tokLayerM"></g>`;
    finish(svg, s, defs);

    // ---- tokens ----
    const lV = svg.querySelector('#tokLayerV'), lB = svg.querySelector('#tokLayerB'), lM = svg.querySelector('#tokLayerM');
    const NS = 'http://www.w3.org/2000/svg';
    const mk = (layer) => { const u = document.createElementNS(NS, 'use'); layer.appendChild(u); return u; };
    const toks = [];
    for (let i = 0; i < 18; i++) toks.push({ m: 'v', o: i / 18, u: mk(lV), u2: mk(lM) });
    for (let i = 0; i < 18; i++) toks.push({ m: 'b', o: i / 18 + .5 / 18, u: mk(lB), u2: mk(lM) });
    for (let i = 0; i < 4; i++) toks.push({ m: 'c', o: i / 4, u: mk(lM), u2: null });
    const X0 = -70, X1 = 1080;
    function place(t, ph) {
      // ph 0..1 along the route; returns [x,y,z,sym,layer]
      if (t.m === 'c') {
        const x = 740 + ph * 130; const y = x < 800 ? YM : YM; return [x, y, Z + (x < 760 ? 30 * (1 - (x - 740) / 20) : 0), 'tokC', 2, x > TR.x + 10];
      }
      const x = X0 + ph * (X1 - X0);
      const y0 = t.m === 'v' ? YV : YB;
      let y = y0, hid = false, sym = t.m === 'v' ? 'tokV' : 'tokB', layer = 1;
      if (t.m === 'v' ? x < VE.x : x < BE.x) sym = t.m === 'v' ? 'tileV' : 'tileB';
      if (x < -66) hid = true;
      if (t.m === 'v' && x > VE.x - 4 && x < VE.x + VE.w + 6) hid = true;
      if (t.m === 'b' && x > BE.x - 2 && x < BE.x + BE.w + 2) hid = true;
      if (x > 470 && x < 506) hid = true;
      if (x > TX - 4) sym = t.m === 'v' ? 'tokVT' : 'tokBT';
      if (x > 790) { const k = Math.min(1, (x - 790) / 40); y = y0 + (YM - y0) * k; layer = 2; }
      if (x > TR.x + 6) hid = true;
      return [x, y, Z, sym, layer, hid];
    }
    let T0 = performance.now(), on = false, raf = 0;
    function frame(now) {
      raf = 0; const tt = (now - T0) / 16000;
      for (const t of toks) {
        const ph = ((tt + t.o) % 1 + 1) % 1;
        const [x, y, z, sym, layer, hid] = place(t, ph);
        const [sx, sy] = P(x, y, z);
        const el = layer === 2 && t.u2 ? t.u2 : t.u, other = el === t.u ? t.u2 : t.u;
        if (other) other.setAttribute('visibility', 'hidden');
        if (hid) { el.setAttribute('visibility', 'hidden'); continue; }
        el.setAttribute('visibility', 'visible');
        el.setAttribute('href', '#' + sym);
        el.setAttribute('transform', `translate(${f(sx)},${f(sy)})`);
      }
      if (on && !RM) raf = requestAnimationFrame(frame);
    }
    frame(T0);
    new IntersectionObserver(es => { on = es[0].isIntersecting; if (on && !raf && !RM) raf = requestAnimationFrame(frame); }).observe(svg);

    // ---- podium ----
    const PX = 1230, PY = YM;
    let cur = null;
    function drawPodium(vals, task, anim) {
      const keys = ['Brain', 'Visual', 'Visual+Brain'], cols = ['#C9B5F0', '#9DB2E0', '#FF7A5C'], names = ['Brain only', 'Visual only', 'Visual + EEG'];
      const g = svg.querySelector('#podium');
      const from = cur || keys.map(() => 0); const to = keys.map(k => vals[k]);
      const t0 = performance.now(), dur = anim && !RM ? 900 : 0;
      const step = now => {
        const e = dur ? Math.max(0, Math.min(1, (now - t0) / dur)) : 1, q = 1 - Math.pow(1 - e, 3);
        const v = from.map((a, i) => a + (to[i] - a) * q);
        begin('P');
        let o = box(PX - 30, PY - 70, 0, 280, 140, 10, '#F3EDE3', { r: 10, top: '#FBF7F1' });
        keys.forEach((k, i) => {
          const x = PX + i * 84, h = Math.max(2, v[i] * 2.1);
          o += bshadow(x, PY - 20, 10, 40, 40, h, { a: .09, k: .45 });
          o += box(x, PY - 20, 10, 40, 40, h, cols[i], { r: 4, soft: true });
          const [lx, ly] = P(x + 20, PY, 10 + h);
          o += `<rect x="${f(lx - 38)}" y="${f(ly - 46)}" width="76" height="32" rx="16" fill="#fff" stroke="${cols[i]}" stroke-width="2"/><text class="tlabel" x="${f(lx)}" y="${f(ly - 22)}" text-anchor="middle">${v[i].toFixed(2)}</text>`;
          const [nx, ny] = P(x + 40, PY + 22, 10);
          o += `<text class="tsub" x="${f(nx + 4)}" y="${f(ny + 16)}" text-anchor="middle">${names[i]}</text>`;
        });
        // trophy on the winner
        const x = PX + 2 * 84, h = v[2] * 2.1; const [tx, ty] = P(x + 20, PY, 10 + h);
        const gain = v[2] - v[1];
        o += `<g transform="translate(${f(tx + 58)},${f(ty - 92)})"><rect x="-44" y="-26" width="88" height="30" rx="15" fill="${ACC}"/><text x="0" y="-6" text-anchor="middle" font-size="15" font-weight="800" fill="#fff" font-family="Plus Jakarta Sans,sans-serif">${gain >= 0 ? '+' : ''}${gain.toFixed(2)} pts</text></g>`;
        o += `<g transform="translate(${f(tx + 58)},${f(ty - 40)})"><path d="M-13 0h26v6c0 10-6 16-13 16S-13 16-13 6z" fill="#FFC23C"/><path d="M-13 3h-6c0 8 5 11 8 11M13 3h6c0 8-5 11-8 11" fill="none" stroke="#FFC23C" stroke-width="3"/><rect x="-3" y="21" width="6" height="7" fill="#E9A800"/><rect x="-9" y="27" width="18" height="5" rx="2" fill="#C98F00"/><path d="M-6 4l2 6" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".7"/></g>`;
        if (DEFS.length) svg.querySelector('defs').insertAdjacentHTML('beforeend', DEFS.join(''));
        g.innerHTML = o;
        if (e < 1) requestAnimationFrame(step); else cur = to;
      };
      requestAnimationFrame(step);
    }
    // machine clicks
    const info = document.getElementById('facInfo');
    svg.querySelectorAll('.mach').forEach(g => {
      const go = () => {
        const [t, d] = MACH[g.dataset.m];
        svg.querySelectorAll('.mach.sel').forEach(x => x.classList.remove('sel'));
        svg.querySelectorAll(`.mach[data-m="${g.dataset.m}"]`).forEach(x => x.classList.add('sel'));
        info.innerHTML = `<button aria-label="Close">×</button><h4>${t}</h4><p>${d}</p>`; info.hidden = false;
        info.querySelector('button').onclick = () => { info.hidden = true; svg.querySelectorAll('.mach.sel').forEach(x => x.classList.remove('sel')); };
      };
      g.addEventListener('click', go);
      g.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    });
    // camera path: along x on the screen
    const cards = [...document.querySelectorAll('#facCards .scard')], step = document.getElementById('facStep'), bar = document.querySelector('#facBar em'), ctl = document.getElementById('podiumCtl');
    const stops = [[30, 65, 0], [330, 65, .2], [560, 65, .4], [740, 65, .56], [990, 65, .74], [1330, 65, 1]];
    const sec = document.getElementById('factory');
    let podiumShown = false;
    rig(sec, svg, (p, mob) => {
      let i = 0; while (i < stops.length - 2 && p > stops[i + 1][2]) i++;
      const a = stops[i], b = stops[i + 1], t = Math.max(0, Math.min(1, (p - a[2]) / (b[2] - a[2])));
      const e = t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const x = a[0] + (b[0] - a[0]) * e;
      const [sx, sy] = P(x, 65, 40);
      return [sx, sy + (mob ? 30 : 0)];
    }, {
      width: 1000, mobileW: 470, anchorX: .58, anchorY: .42, anchorYm: .62,
      onProgress(p) {
        const ci = p > .9 ? 5 : Math.min(4, Math.floor(p / .9 * 5));
        cards.forEach((c, i) => c.classList.toggle('on', i === ci));
        step.textContent = (ci + 1) + ' / 6'; bar.style.width = (p * 100).toFixed(1) + '%';
        ctl.classList.toggle('on', p > .86);
        if (p > .86 && !podiumShown) { podiumShown = true; H.podiumReady && H.podiumReady(); }
      }
    });
    if (H.podiumReady) setTimeout(() => H.podiumReady(), 0);
    return { podium: drawPodium };
  }

  window.ISO = { buildLab, buildDesks, buildFactory, P, HOT, RM };
})();
