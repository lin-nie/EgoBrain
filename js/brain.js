const CH_POS = { Fp1: [-.31, .95], Fp2: [.31, .95], F7: [-.81, .59], F3: [-.41, .56], Fz: [0, .5], F4: [.41, .56], F8: [.81, .59], FC5: [-.66, .3], FC1: [-.22, .26], FC2: [.22, .26], FC6: [.66, .3], FT9: [-.97, .3], FT10: [.97, .3], T7: [-1, 0], C3: [-.5, 0], Cz: [0, 0], C4: [.5, 0], T8: [1, 0], CP5: [-.66, -.3], CP1: [-.22, -.26], CP2: [.22, -.26], CP6: [.66, -.3], P7: [-.81, -.59], P3: [-.41, -.56], Pz: [0, -.5], P4: [.41, -.56], P8: [.81, -.59], PO9: [-.6, -.86], PO10: [.6, -.86], O1: [-.31, -.95], Oz: [0, -1], O2: [.31, -.95] };
const STOPS = [[0, [246, 244, 252]], [.45, [255, 196, 170]], [.75, [255, 91, 58]], [1, [120, 34, 80]]];
const G = 72;  // interpolation grid; drawn smoothed up to the canvas size

function cmap(v) {
  for (let i = 1; i < STOPS.length; i++) if (v <= STOPS[i][0]) { const [p, a] = STOPS[i - 1], [q, b] = STOPS[i], u = (v - p) / (q - p); return a.map((x, k) => x + (b[k] - x) * u); }
  return STOPS[STOPS.length - 1][1];
}

export function create(stage) {
  stage.innerHTML = '<canvas class="bv-topo" role="img" aria-label="Scalp map of EEG band power, following the video"></canvas>';
  const cv = stage.querySelector('canvas'), off = document.createElement('canvas'), img = new ImageData(G, G);
  off.width = off.height = G;
  let J = null, t = 0, band = 'alpha', pts = [], wts = null;

  // inverse-distance weights from every grid cell to every electrode, computed once per clip
  function prepare() {
    pts = J ? J.eeg.channels.map((c, i) => CH_POS[c] ? { i, x: CH_POS[c][0], y: CH_POS[c][1] } : null).filter(Boolean) : [];
    wts = new Float32Array(G * G * pts.length);
    for (let gy = 0; gy < G; gy++) for (let gx = 0; gx < G; gx++) {
      const u = gx / (G - 1) * 2 - 1, v = 1 - gy / (G - 1) * 2, o = (gy * G + gx) * pts.length;
      let s = 0;
      pts.forEach((p, k) => { const d = (u - p.x) ** 2 + (v - p.y) ** 2 + 2e-3, w = 1 / (d * Math.sqrt(d)); wts[o + k] = w; s += w; });
      for (let k = 0; k < pts.length; k++) wts[o + k] /= s;
    }
  }
  function values() {  // band power per electrode at time t, blended between the two 4 Hz frames, scaled 0..1 across the scalp
    const arr = J.bands.data[band], n = arr[0].length, f = Math.max(0, Math.min(n - 1.001, t * J.bands.hz)), k = Math.floor(f), a = f - k;
    const v = pts.map(p => arr[p.i][k] * (1 - a) + arr[p.i][Math.min(n - 1, k + 1)] * a);
    const mn = Math.min(...v), mx = Math.max(...v);
    return v.map(x => (x - mn) / ((mx - mn) || 1));
  }
  function render() {
    const r = cv.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1); if (!r.width) return;
    const pw = Math.round(r.width * d), ph = Math.round(r.height * d);
    if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; }   // both: the box can change height alone
    const x = cv.getContext('2d'), W = cv.width, H = cv.height; x.clearRect(0, 0, W, H);
    const R = Math.min(W, H) * .42, cx = W / 2, cy = H / 2 + R * .05;
    if (J && J.bands && pts.length) {
      const val = values();
      for (let gy = 0; gy < G; gy++) for (let gx = 0; gx < G; gx++) {
        const o = gy * G + gx, wo = o * pts.length; let s = 0;
        for (let k = 0; k < pts.length; k++) s += wts[wo + k] * val[k];
        const c = cmap(s); img.data[o * 4] = c[0]; img.data[o * 4 + 1] = c[1]; img.data[o * 4 + 2] = c[2]; img.data[o * 4 + 3] = 255;
      }
      off.getContext('2d').putImageData(img, 0, 0);
      x.save(); x.beginPath(); x.arc(cx, cy, R, 0, Math.PI * 2); x.clip();
      x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; x.drawImage(off, cx - R, cy - R, 2 * R, 2 * R); x.restore();
    }
    x.strokeStyle = '#1E2142'; x.lineWidth = 1.6 * d; x.lineJoin = 'round';
    x.beginPath(); x.arc(cx, cy, R, 0, Math.PI * 2); x.stroke();
    x.beginPath(); x.moveTo(cx - R * .11, cy - R * .99); x.lineTo(cx, cy - R * 1.13); x.lineTo(cx + R * .11, cy - R * .99); x.stroke();   // nose
    [-1, 1].forEach(s => { x.beginPath(); x.ellipse(cx + s * R * 1.035, cy, R * .055, R * .17, 0, 0, Math.PI * 2); x.stroke(); });      // ears
    for (const p of pts) {
      x.beginPath(); x.arc(cx + p.x * R * .9, cy - p.y * R * .9, Math.max(1.1 * d, R * .022), 0, Math.PI * 2);
      x.fillStyle = '#1E2142'; x.fill(); x.lineWidth = d; x.strokeStyle = 'rgba(255,255,255,.85)'; x.stroke();
    }
  }
  return {
    load(id, clipJson) { J = clipJson || null; prepare(); render(); },
    time(sec) { t = sec; render(); },
    band(b) { band = b; render(); return band; },
  };
}
