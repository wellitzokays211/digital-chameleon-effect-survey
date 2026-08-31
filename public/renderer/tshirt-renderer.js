/* T-shirt renderer, extracted from tshirt-tone-v9.html.
 *
 * The image maths here is the prototype's, carried over unchanged: the shading field
 * recovered from the photograph's luminance, the linear-light relighting, the edge
 * coverage solve, and the parallel typed arrays on the render path. The prototype is
 * the source of truth for how the garment looks and behaves, so none of it has been
 * reinterpreted. Comments explaining *why* the maths is shaped this way are the
 * prototype author's reasoning, preserved.
 *
 * What has changed is everything around the maths:
 *
 *  - It is a module with an API instead of a page that wires itself to fixed DOM ids,
 *    so Stage 4 can expose only the controls a participant's assigned level allows.
 *  - Garment colour is locked at construction to the participant's own calibration
 *    choice. There is no swatch list and no "original" pass-through, because no level
 *    of this study may change the colour.
 *  - Combos load lazily from real files rather than all twelve from inlined base64.
 *    Canvas dimensions come from the manifest, so the frame is sized before the first
 *    image decodes.
 *  - The model is fixed at construction rather than being a control.
 */

const SHIRT_GAIN = [0.20, 0.70];
const SKIN_GAIN = [0.30, 0.60];

const LIGHT = { h: 32, s: 0.50, l: 0.79 };
const DARK = { h: 21, s: 0.42, l: 0.24 };

export const FONT_MIN = 14;
export const FONT_MAX = 90;
export const FONT_STEP = 4;

/* ---------------- colour helpers ---------------- */

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s;
  const l = (max + min) / 2;
  if (max === min) { h = 0; s = 0; }
  else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return [h * 360, s, l];
}

function hue2rgb(p, q, t) {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

/* The render passes call this once per garment pixel, up to 150k times a frame.
   Returning a fresh [r,g,b] each time is not much slower on average, but it makes
   frame times lurch as the collector catches up: measured over repeated drags the
   spread was 14.6ms returning arrays against 4.0ms writing into these. On a slider
   the consistency is what you feel, so the hot path writes into these instead. */
let _r = 0, _g = 0, _b = 0;

function hslToRgbInto(h, s, l) {
  if (s === 0) { _r = _g = _b = l * 255; return; }
  h = ((h % 360) + 360) % 360 / 360;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  _r = hue2rgb(p, q, h + 1 / 3) * 255;
  _g = hue2rgb(p, q, h) * 255;
  _b = hue2rgb(p, q, h - 1 / 3) * 255;
}

function hslToRgb(h, s, l) {
  hslToRgbInto(h, s, l);
  return [Math.round(_r), Math.round(_g), Math.round(_b)];
}

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a, b, t) => a + (b - a) * t;

/* ---------------- linear light ----------------

   Shading is a multiplication by how much light reaches a fold, and that is only
   true of linear values. Doing it on the gamma-encoded bytes instead is what
   leaves recoloured fabric looking flat and slightly muddy through the midtones.
   Both directions are tabulated because the render loop converts on every pixel. */

const SRGB_TO_LINEAR = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const c = i / 255;
  SRGB_TO_LINEAR[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

const LIN_STEPS = 8192;
const LINEAR_TO_SRGB = new Uint8Array(LIN_STEPS);
for (let i = 0; i < LIN_STEPS; i++) {
  const v = i / (LIN_STEPS - 1);
  const s = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  LINEAR_TO_SRGB[i] = Math.round(s * 255);
}

const LIN_MAX = LIN_STEPS - 1;
function toByte(v) {
  return LINEAR_TO_SRGB[v <= 0 ? 0 : v >= 1 ? LIN_MAX : (v * LIN_MAX) | 0];
}
function relLum(r, g, b) {
  return SRGB_TO_LINEAR[r] * 0.2126 + SRGB_TO_LINEAR[g] * 0.7152 + SRGB_TO_LINEAR[b] * 0.0722;
}

/* ---------------- skin tone anchors ---------------- */

function skinTargetForT(t) {
  return { h: lerp(LIGHT.h, DARK.h, t), s: lerp(LIGHT.s, DARK.s, t), l: lerp(LIGHT.l, DARK.l, t) };
}

export function toneTrackGradient() {
  const stops = [];
  const N = 7;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const tg = skinTargetForT(t);
    const rgb = hslToRgb(tg.h, tg.s, tg.l);
    const hex = '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('');
    stops.push(hex + ' ' + Math.round(t * 100) + '%');
  }
  return 'linear-gradient(90deg,' + stops.join(',') + ')';
}

export function toneLabelFor(t) {
  if (t < 0.10) return 'Lightest';
  if (t < 0.32) return 'Light';
  if (t < 0.55) return 'Medium';
  if (t < 0.80) return 'Deep';
  return 'Darkest';
}

export function toneHexFor(t) {
  const tg = skinTargetForT(t);
  const rgb = hslToRgb(tg.h, tg.s, tg.l);
  return ('#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('')).toUpperCase();
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error('failed to decode ' + src));
    im.src = src;
  });
}

/* ---------------- renderer ---------------- */

export async function createRenderer(options) {
  const {
    canvas,
    manifest,
    model,
    colourHsl,
    neckline: initialNeckline = 'round',
    sleeve: initialSleeve = 'short',
    basePath = '',
    onBusyChange = null
  } = options;

  const combosForModel = Object.entries(manifest.combos).filter(([, c]) => c.model === model);
  if (!combosForModel.length) throw new Error('no combos in the manifest for model "' + model + '"');

  const firstEntry = combosForModel[0][1];
  const W = firstEntry.width;
  const H = firstEntry.height;
  canvas.width = W;
  canvas.height = H;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const outBuffer = new Uint8ClampedArray(W * H * 4);
  const built = Object.create(null);
  const inFlight = Object.create(null);

  let necklineKey = initialNeckline;
  let sleeveKey = initialSleeve;
  let busy = false;

  function comboKey(neck = necklineKey, sleeve = sleeveKey) {
    return model + '_' + neck + '_' + sleeve;
  }

  function setBusy(next) {
    if (busy === next) return;
    busy = next;
    if (onBusyChange) onBusyChange(busy);
  }

  /* ---------------- mask weights ----------------

     A feathered mask ramps from 0 to 1 over roughly three pixels, and blending the
     recolour by that raw weight leaves the outer half of the ramp mostly showing the
     original fabric -- which reads as a rim of the old colour once the garment is
     recoloured, and as a halo on the backdrop once the skin is darkened. Steepening
     the weight into a narrower band keeps the anti-aliased edge soft while making the
     recolour commit much sooner.

     The garment and the skin want different curves. Skin is recoloured by shifting
     its own lightness, so a narrow band is safe there. The garment is recoloured by
     relighting a new dye, and a pixel forced to full strength gets painted as solid
     fabric when it is really half background, so its band stays wider and the mixing
     is left to the composite. */

  function applyEdgeGain(weights, gain) {
    const lo = gain[0], hi = gain[1], span = hi - lo;
    for (let i = 0; i < weights.length; i++) {
      const w = weights[i];
      if (w <= lo) { weights[i] = 0; continue; }
      if (w >= hi) { weights[i] = 1; continue; }
      const t = (w - lo) / span;
      weights[i] = t * t * (3 - 2 * t);
    }
    return weights;
  }

  function readMaskWeights(maskImg, gain) {
    const off = document.createElement('canvas');
    off.width = W; off.height = H;
    const octx = off.getContext('2d', { willReadFrequently: true });
    octx.drawImage(maskImg, 0, 0, W, H);
    const d = octx.getImageData(0, 0, W, H).data;
    const weights = new Float32Array(W * H);
    for (let i = 0, p = 0; i < weights.length; i++, p += 4) weights[i] = d[p] / 255;
    return applyEdgeGain(weights, gain);
  }

  /* ---------------- shading field ----------------

     The garment is one flat dyed colour photographed under a light, so every pixel
     is that dye scaled by how much light reached it. Dividing the photo's luminance
     by the value of its fully lit fabric recovers that scale on its own, and once
     recovered it can relight any other dye. Recolouring then only ever changes the
     dye: folds, the hem, the shadow under a sleeve and the sheen on a shoulder all
     come through at their true depth, because they were never touched.

     The reference is the median, which makes the swatch an honest promise: the
     garment's median lightness lands on exactly the lightness the swatch shows.

     A pixel on the silhouette is part fabric and part whatever is behind it, so its
     luminance is not the fabric's luminance. Reading shading off it would tell the
     model the fabric is in near-darkness there, and relighting a dark dye by that
     paints a black rim all the way round. Shading is therefore only measured where
     a pixel is wholly fabric, then carried outward across the boundary; the mixing
     is handled where it belongs, by compositing over the photo with a soft alpha. */

  // wholly fabric: the pixel and everything within two of it
  function solidFabric(weights) {
    const known = new Uint8Array(W * H);
    for (let y = 2; y < H - 2; y++) {
      for (let x = 2; x < W - 2; x++) {
        const i = y * W + x;
        if (weights[i] < 0.999) continue;
        let solid = 1;
        for (let dy = -2; dy <= 2 && solid; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            if (weights[i + dy * W + dx] < 0.999) { solid = 0; break; }
          }
        }
        known[i] = solid;
      }
    }
    return known;
  }

  function buildShadingField(weights, data, solid) {
    const n = W * H;
    const field = new Float32Array(n);
    const known = Uint8Array.from(solid);

    const lit = [];
    for (let i = 0, p = 0; i < n; i++, p += 4) {
      if (weights[i] <= 0) continue;
      field[i] = relLum(data[p], data[p + 1], data[p + 2]);
      if (known[i]) lit.push(field[i]);
    }
    lit.sort((a, b) => a - b);
    const ref = lit.length ? lit[lit.length >> 1] : 1;

    // carry it outward, averaging whatever is already known around each pixel. Only
    // the thin band between "wholly fabric" and the mask edge needs filling, so the
    // worklist is a few thousand entries and is rebuilt rather than spliced.
    let todo = [];
    for (let i = 0; i < n; i++) if (weights[i] > 0 && !known[i]) todo.push(i);

    for (let pass = 0; pass < 8 && todo.length; pass++) {
      const filled = [], values = [], remaining = [];
      for (let t = 0; t < todo.length; t++) {
        const i = todo[t];
        const x = i % W, y = (i - x) / W;
        let sum = 0, count = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy; if (yy < 0 || yy >= H) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx; if (xx < 0 || xx >= W) continue;
            const j = yy * W + xx;
            if (known[j]) { sum += field[j]; count++; }
          }
        }
        if (count) { filled.push(i); values.push(sum / count); }
        else remaining.push(i);
      }
      if (!filled.length) break;
      for (let k = 0; k < filled.length; k++) { field[filled[k]] = values[k]; known[filled[k]] = 1; }
      todo = remaining;
    }

    if (ref > 0) for (let i = 0; i < n; i++) field[i] /= ref;
    return field;
  }

  /* ---------------- what is behind the edge ----------------

     The band along a silhouette is part the thing itself and part whatever is behind it,
     and recolouring it means replacing only the first share. That needs the second, which
     is nowhere in the mask, so it is taken from the closest pixel the pass does not touch
     and carried inward ring by ring until the band is crossed.

     An index rather than a colour. The garment pass runs after the skin pass and has to
     composite over what is on screen by then: freeze the colour at load and lightening the
     arm leaves the band under the sleeve at the arm's old darkness, which is a brown line
     round the cuff at the pale end of the tone slider. */

  function nearestSource(isSeed, isTodo) {
    const n = W * H;
    const src = new Int32Array(n).fill(-1);
    let todo = [];
    for (let i = 0; i < n; i++) {
      if (isSeed[i]) src[i] = i;
      else if (isTodo[i]) todo.push(i);
    }

    for (let pass = 0; pass < 8 && todo.length; pass++) {
      const got = [], values = [], remaining = [];
      for (let t = 0; t < todo.length; t++) {
        const i = todo[t];
        const x = i % W, y = (i - x) / W;
        let best = -1, bestD = Infinity;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy; if (yy < 0 || yy >= H) continue;
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const xx = x + dx; if (xx < 0 || xx >= W) continue;
            const s = src[yy * W + xx];
            if (s < 0) continue;
            const sx = s % W, sy = (s - sx) / W;
            const d = (sx - x) * (sx - x) + (sy - y) * (sy - y);
            if (d < bestD) { bestD = d; best = s; }
          }
        }
        if (best >= 0) { got.push(i); values.push(best); }
        else remaining.push(i);
      }
      if (!got.length) break;
      for (let k = 0; k < got.length; k++) src[got[k]] = values[k];
      todo = remaining;
    }
    return src;
  }

  function paintedBand(weights, solid) {
    const band = new Uint8Array(W * H);
    for (let i = 0; i < band.length; i++) band[i] = weights[i] > 0.03 && !solid[i] ? 1 : 0;
    return band;
  }

  function notPainted(weights) {
    const off = new Uint8Array(W * H);
    for (let i = 0; i < off.length; i++) off[i] = weights[i] <= 0.03 ? 1 : 0;
    return off;
  }

  /* ---------------- how much of a pixel is fabric ----------------

     The mask cannot say. It is grown a pixel or two past the last of the fabric on
     purpose, because the composite used to pull the edge back in, so on the outer ring
     it claims cloth the photograph does not have. Painting on that figure is what drew
     a dark line along every cuff and collar: the band's own luminance is fabric mixed
     with a darker arm, and relighting a saturated dye by it lands well below both the
     fabric inside and the skin outside, which is precisely what an outline is.

     A mixture of two known colours does not need guessing at, though. The fabric here
     is the dye under the shading field and the background has just been carried in, so
     the fraction is where the pixel falls on the line between the two. Off the end of
     the fabric it solves to nothing and the photograph is left alone; well inside it
     solves to one and the pass reduces to dye x shading, which is what it always was. */

  function fabricDye(weights, data, shading, solid) {
    const n = W * H;
    const chans = [[], [], []];
    for (let i = 0, p = 0; i < n; i++, p += 4) {
      if (!solid[i]) continue;
      const sh = shading[i] > 1e-6 ? shading[i] : 1e-6;
      chans[0].push(SRGB_TO_LINEAR[data[p]] / sh);
      chans[1].push(SRGB_TO_LINEAR[data[p + 1]] / sh);
      chans[2].push(SRGB_TO_LINEAR[data[p + 2]] / sh);
    }
    return chans.map((v) => {
      if (!v.length) return 0;
      v.sort((a, b) => a - b);
      const h = v.length >> 1;
      return v.length % 2 ? v[h] : (v[h - 1] + v[h]) / 2;
    });
  }

  function buildCoverage(weights, data, solid, bgSrc, fg) {
    const n = W * H;
    const a = new Float32Array(n);
    for (let i = 0, p = 0; i < n; i++, p += 4) {
      if (weights[i] <= 0.03) continue;
      if (solid[i]) { a[i] = 1; continue; }
      const b = bgSrc[i] < 0 ? i : bgSrc[i], b4 = b * 4, i3 = i * 3;
      const br = SRGB_TO_LINEAR[data[b4]],
        bg1 = SRGB_TO_LINEAR[data[b4 + 1]],
        bb = SRGB_TO_LINEAR[data[b4 + 2]];
      const dr = fg[i3] - br, dg = fg[i3 + 1] - bg1, db = fg[i3 + 2] - bb;
      const den = dr * dr + dg * dg + db * db;
      if (den <= 1e-4) { a[i] = Math.min(weights[i], 1); continue; }
      const pr = SRGB_TO_LINEAR[data[p]] - br,
        pg = SRGB_TO_LINEAR[data[p + 1]] - bg1,
        pb = SRGB_TO_LINEAR[data[p + 2]] - bb;
      const t = (pr * dr + pg * dg + pb * db) / den;
      a[i] = t < 0 ? 0 : t > 1 ? 1 : t;
    }
    return a;
  }

  function dyeUnderShading(dye, shading) {
    const n = W * H, fg = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const sh = shading[i];
      fg[i * 3] = dye[0] * sh; fg[i * 3 + 1] = dye[1] * sh; fg[i * 3 + 2] = dye[2] * sh;
    }
    return fg;
  }

  // Skin has no flat dye to relight, so what a band pixel would be if it were nothing but
  // skin is taken from the nearest pixel that is.
  function colourAt(data, src) {
    const n = W * H, fg = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const s = (src[i] < 0 ? i : src[i]) * 4;
      fg[i * 3] = SRGB_TO_LINEAR[data[s]];
      fg[i * 3 + 1] = SRGB_TO_LINEAR[data[s + 1]];
      fg[i * 3 + 2] = SRGB_TO_LINEAR[data[s + 2]];
    }
    return fg;
  }

  // Parallel typed arrays rather than an array of objects: the render loop touches
  // ~150k entries per frame while the tone slider is being dragged, and object
  // access there is what makes the drag feel heavy.
  function buildRegion(weights, data, shading, coverage, bgSrc, colourSrc) {
    let count = 0;
    for (let i = 0; i < weights.length; i++) if (weights[i] > 0.03) count++;

    const region = {
      idx: new Int32Array(count),
      m: new Float32Array(count),
      h: new Float32Array(count),
      s: new Float32Array(count),
      l: new Float32Array(count),
      r: new Uint8Array(count),
      g: new Uint8Array(count),
      b: new Uint8Array(count),
      sh: shading ? new Float32Array(count) : null,
      a: coverage ? new Float32Array(count) : null,
      bg: bgSrc ? new Int32Array(count) : null,
      avgL: 0.5,
      count: count
    };

    let k = 0, sumL = 0, wsum = 0;
    for (let i = 0; i < weights.length; i++) {
      const m = weights[i];
      if (m <= 0.03) continue;
      // On the band the pixel itself is a mixture, so the colour to be shifted is read
      // from the nearest pixel that is not. Inside, the source is the pixel itself.
      const o = (colourSrc && colourSrc[i] >= 0 ? colourSrc[i] : i) * 4;
      const r = data[o], g = data[o + 1], b = data[o + 2];
      const hsl = rgbToHsl(r, g, b);
      region.idx[k] = i;
      region.m[k] = Math.min(m, 1);
      region.h[k] = hsl[0]; region.s[k] = hsl[1]; region.l[k] = hsl[2];
      region.r[k] = r; region.g[k] = g; region.b[k] = b;
      if (shading) region.sh[k] = shading[i];
      if (coverage) region.a[k] = coverage[i];
      if (bgSrc) region.bg[k] = bgSrc[i] < 0 ? i : bgSrc[i];
      sumL += hsl[2] * m; wsum += m;
      k++;
    }
    region.avgL = wsum > 0 ? sumL / wsum : 0.5;
    return region;
  }

  /* ---------------- combo loading ----------------
   *
   * Lazy and cached. `inFlight` is what stops a participant clicking two sleeve
   * options in quick succession from starting the same expensive precomputation twice. */

  async function loadCombo(key) {
    if (built[key]) return built[key];
    if (inFlight[key]) return inFlight[key];

    const cfg = manifest.combos[key];
    if (!cfg) throw new Error('unknown combo "' + key + '"');

    inFlight[key] = (async () => {
      const [im, skinMaskImg, shirtMaskImg] = await Promise.all([
        loadImage(basePath + cfg.photo),
        loadImage(basePath + cfg.skinMask),
        loadImage(basePath + cfg.shirtMask)
      ]);

      const off = document.createElement('canvas');
      off.width = W; off.height = H;
      const octx = off.getContext('2d', { willReadFrequently: true });
      octx.drawImage(im, 0, 0, W, H);
      const origData = octx.getImageData(0, 0, W, H);

      const shirtWeights = readMaskWeights(shirtMaskImg, SHIRT_GAIN);
      const solid = solidFabric(shirtWeights);
      const shading = buildShadingField(shirtWeights, origData.data, solid);
      const bgSrc = nearestSource(notPainted(shirtWeights), paintedBand(shirtWeights, solid));
      const dye = fabricDye(shirtWeights, origData.data, shading, solid);
      const coverage = buildCoverage(
        shirtWeights, origData.data, solid, bgSrc, dyeUnderShading(dye, shading)
      );

      const skinWeights = readMaskWeights(skinMaskImg, SKIN_GAIN);
      const skinSolid = solidFabric(skinWeights);
      const skinBand = paintedBand(skinWeights, skinSolid);
      const skinBgSrc = nearestSource(notPainted(skinWeights), skinBand);
      const skinSrc = nearestSource(skinSolid, skinBand);
      const skinCover = buildCoverage(
        skinWeights, origData.data, skinSolid, skinBgSrc, colourAt(origData.data, skinSrc)
      );

      built[key] = {
        orig: origData.data,
        skin: buildRegion(skinWeights, origData.data, null, skinCover, skinBgSrc, skinSrc),
        shirt: buildRegion(shirtWeights, origData.data, shading, coverage, bgSrc),
        shirtWeights: shirtWeights,
        shading: shading
      };
      delete inFlight[key];
      return built[key];
    })();

    return inFlight[key];
  }

  /* ---------------- custom text ---------------- */

  let customText = '';
  let textColour = 'black';
  let fontSizePx = 28;
  let textAlphaCache = null;
  let textAlphaCacheKey = '';
  const textBox = { cxFrac: 0.5, cyFrac: 0.44 };
  let lastBoxWFrac = 0.22;
  let lastBoxHFrac = 0.10;

  function hasText() { return customText.trim().length > 0; }

  function getTextAlphaMask() {
    const key = [customText, W, H, textBox.cxFrac, textBox.cyFrac, fontSizePx].join('|');
    if (textAlphaCache && textAlphaCacheKey === key) return textAlphaCache;

    const lines = customText.split('\n');
    const off = document.createElement('canvas');
    off.width = W; off.height = H;
    const octx = off.getContext('2d', { willReadFrequently: true });
    octx.clearRect(0, 0, W, H);
    octx.fillStyle = '#000';
    octx.textAlign = 'center';
    octx.textBaseline = 'middle';

    // the stepper value is authoritative; this only shrinks as a last resort so an
    // extreme string can't run clean off the shirt
    const safeMaxWidth = W * 0.85;
    let fontSize = fontSizePx;
    const measure = () => {
      octx.font = '800 ' + fontSize + 'px Inter, sans-serif';
      return Math.max.apply(null, lines.map((l) => octx.measureText(l).width));
    };
    let widest = measure();
    while (widest > safeMaxWidth && fontSize > 8) { fontSize -= 1; widest = measure(); }

    const cx = W * textBox.cxFrac;
    const cy = H * textBox.cyFrac;
    const lineHeight = fontSize * 1.25;
    lastBoxWFrac = Math.min(0.9, widest / W);
    lastBoxHFrac = Math.min(0.8, (lineHeight * lines.length) / H);

    const blockTop = cy - (lines.length - 1) * lineHeight / 2;
    lines.forEach((line, i) => octx.fillText(line, cx, blockTop + i * lineHeight));

    const d = octx.getImageData(0, 0, W, H).data;
    const alpha = new Float32Array(W * H);
    for (let i = 0, p = 3; i < alpha.length; i++, p += 4) alpha[i] = d[p] / 255;

    textAlphaCache = alpha;
    textAlphaCacheKey = key;
    return alpha;
  }

  function invalidateTextCache() { textAlphaCache = null; textAlphaCacheKey = ''; }

  /* ---------------- render ----------------

     Every pass starts from the untouched photo and the layers are applied in
     sequence, which is what keeps the controls independent: nothing compounds
     between renders. */

  let toneT = 0.5;
  let hasInteractedSkin = false;
  let pending = false;

  function render() {
    const data = built[comboKey()];
    if (!data) return;

    const out = outBuffer;
    out.set(data.orig);

    if (hasInteractedSkin) {
      const target = skinTargetForT(toneT);
      // The tone is applied to skin and then laid over what is behind the arm by however
      // much of the pixel is skin -- the same two steps as the garment, and for the same
      // reason. Shifting the mixed pixel instead is what put a dark outline round a pale
      // arm: on the silhouette it is skin averaged with backdrop or with cloth, its
      // lightness sits far below the arm's, and the shift carries that gap through, so
      // the lighter the tone the further the edge falls behind the arm it belongs to.
      const R = data.skin;
      for (let k = 0; k < R.count; k++) {
        const a = R.a[k], n = 1 - a;
        const deltaL = clamp(R.l[k] - R.avgL, -0.32, 0.32);
        hslToRgbInto(target.h, target.s, clamp(target.l + deltaL, 0.03, 0.97));
        const o = R.idx[k] * 4, b = R.bg[k] * 4;
        out[o] = out[b] * n + _r * a;
        out[o + 1] = out[b + 1] * n + _g * a;
        out[o + 2] = out[b + 2] * n + _b * a;
      }
    }

    // garment: relight the locked dye with the shading the photograph already carries,
    // then lay it over what is behind the garment by however much of the pixel is
    // fabric. Inside, coverage is 1 and this is dye x shading; only the silhouette
    // mixes. The colour is the participant's own calibration choice and never changes.
    {
      const R = data.shirt;
      const dye = hslToRgb(colourHsl.h, colourHsl.s, colourHsl.l);
      const dr = SRGB_TO_LINEAR[dye[0]], dg = SRGB_TO_LINEAR[dye[1]], db = SRGB_TO_LINEAR[dye[2]];
      for (let k = 0; k < R.count; k++) {
        const a = R.a[k], sh = R.sh[k], n = 1 - a;
        const o = R.idx[k] * 4, b = R.bg[k] * 4;
        out[o] = toByte(SRGB_TO_LINEAR[out[b]] * n + dr * sh * a);
        out[o + 1] = toByte(SRGB_TO_LINEAR[out[b + 1]] * n + dg * sh * a);
        out[o + 2] = toByte(SRGB_TO_LINEAR[out[b + 2]] * n + db * sh * a);
      }
    }

    // print: ink is lit by the same light as the fabric under it, so it takes the
    // same shading and the folds run through the letters instead of over a flat decal
    if (hasText()) {
      const textAlpha = getTextAlphaMask();
      const sw = data.shirtWeights;
      const shading = data.shading;
      const ink = hslToRgb(0, 0, textColour === 'white' ? 0.95 : 0.06);
      const ir = SRGB_TO_LINEAR[ink[0]], ig = SRGB_TO_LINEAR[ink[1]], ib = SRGB_TO_LINEAR[ink[2]];
      for (let i = 0; i < textAlpha.length; i++) {
        const ta = textAlpha[i];
        if (ta <= 0) continue;
        const shirtW = sw[i];
        if (shirtW <= 0.03) continue;      // clipped to the garment, never onto skin or backdrop
        const w = ta * shirtW;
        if (w <= 0.02) continue;
        const sh = shading[i];
        const o = i * 4;
        out[o] = lerp(out[o], toByte(ir * sh), w);
        out[o + 1] = lerp(out[o + 1], toByte(ig * sh), w);
        out[o + 2] = lerp(out[o + 2], toByte(ib * sh), w);
      }
    }

    ctx.putImageData(new ImageData(out, W, H), 0, 0);
  }

  function scheduleRender() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; render(); });
  }

  /* ---------------- boot ---------------- */

  const initial = await loadCombo(comboKey());

  /* The photograph's own average skin lightness sets where the slider starts, so it
     opens on the model as photographed rather than on an arbitrary midpoint. This is
     also the baseline `skinToneAdjusted` is measured against. */
  const defaultTone = clamp((LIGHT.l - initial.skin.avgL) / (LIGHT.l - DARK.l), 0, 1);
  toneT = defaultTone;
  render();

  /* Text metrics depend on the webfont; once it lands, drop the cache and repaint. */
  if (document.fonts && document.fonts.ready) {
    document.fonts.load('800 28px Inter')
      .then(() => document.fonts.ready)
      .catch(() => {})
      .then(() => { invalidateTextCache(); render(); });
  }

  /* ---------------- public API ---------------- */

  async function switchCombo(nextNeck, nextSleeve) {
    const key = comboKey(nextNeck, nextSleeve);
    if (!built[key]) {
      setBusy(true);
      try { await loadCombo(key); }
      finally { setBusy(false); }
    }
    necklineKey = nextNeck;
    sleeveKey = nextSleeve;
    render();
  }

  return {
    width: W,
    height: H,

    /* Precomputing a combo costs a second or two, so the ones a participant can reach
       are warmed after the first paint. Sequential and awaited rather than parallel:
       six at once on a mid-range phone competes with the interaction that is already
       on screen. */
    warmReachableCombos() {
      const keys = combosForModel.map(([k]) => k).filter((k) => k !== comboKey());
      let cancelled = false;
      (async () => {
        for (const key of keys) {
          if (cancelled) return;
          try { await loadCombo(key); } catch { /* warming is best-effort */ }
          await new Promise((r) => setTimeout(r, 0));
        }
      })();
      return () => { cancelled = true; };
    },

    getNeckline() { return necklineKey; },
    getSleeve() { return sleeveKey; },
    setNeckline(next) { return switchCombo(next, sleeveKey); },
    setSleeve(next) { return switchCombo(necklineKey, next); },

    getDefaultTone() { return defaultTone; },
    getTone() { return toneT; },
    hasAdjustedTone() { return hasInteractedSkin; },
    setTone(t, { markInteracted = true } = {}) {
      toneT = clamp(Number(t), 0, 1);
      if (markInteracted) hasInteractedSkin = true;
      scheduleRender();
    },
    /* Resume path: restores a saved slider position without claiming the participant
       has just moved it, so `skinToneAdjusted` survives a reload truthfully. */
    restoreTone(t, wasAdjusted) {
      toneT = clamp(Number(t), 0, 1);
      hasInteractedSkin = Boolean(wasAdjusted);
      scheduleRender();
    },

    getText() { return customText; },
    setText(value) {
      customText = String(value ?? '');
      scheduleRender();
    },
    getTextColour() { return textColour; },
    setTextColour(next) { textColour = next; scheduleRender(); },
    getFontSize() { return fontSizePx; },
    setFontSize(px) {
      fontSizePx = clamp(Math.round(px), FONT_MIN, FONT_MAX);
      scheduleRender();
    },
    getTextPosition() { return { cxFrac: textBox.cxFrac, cyFrac: textBox.cyFrac }; },
    setTextPosition(cxFrac, cyFrac) {
      textBox.cxFrac = clamp(cxFrac, 0.15, 0.85);
      textBox.cyFrac = clamp(cyFrac, 0.15, 0.85);
      scheduleRender();
    },
    hasText,
    /* The dashed handle on the canvas has to sit exactly where the glyphs were
       measured, which is only known after the alpha mask is built. */
    getTextBoxExtent() {
      if (hasText() && W > 0) getTextAlphaMask();
      return { wFrac: lastBoxWFrac, hFrac: lastBoxHFrac };
    },

    render,
    scheduleRender
  };
}
