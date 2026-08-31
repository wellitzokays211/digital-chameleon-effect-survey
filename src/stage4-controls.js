/* Stage 4 customisation controls.
 *
 * These live in the Worker and are sent to the browser as source text, assembled per
 * session into a bundle containing only the controls the assigned level allows. That
 * is what makes the blinding structural: a Level 2 participant's browser never
 * receives the skin-tone control, and the endpoint that would serve it refuses their
 * session outright.
 *
 * They are written as ordinary functions and serialised with `Function.prototype
 * .toString()` rather than kept as template strings, so they stay real JavaScript --
 * highlighted, linted and diffable. The consequence is that each one must be entirely
 * self-contained: it may only reference the names the bundle injects around it, listed
 * in PRELUDE below. Nothing here ever executes on the server.
 *
 * Behaviour is ported from the prototype, which is the source of truth for how these
 * four controls look and feel. */

/* ---------------- injected helpers ---------------- */

function controlBlock(label, readout) {
  var head = h('div', { class: 'control-head' }, h('span', { class: 'control-label', text: label }));
  if (readout) head.append(readout);
  var block = h('div', { class: 'control-block' }, head);
  ctx.container.append(block);
  return block;
}

/* Options are radio-like: the active pill is the current value, and re-clicking it is
 * a no-op rather than a redundant repaint. */
function pills(parent, options, getCurrent, setNext) {
  var row = h('div', { class: 'pill-options' });
  options.forEach(function (opt) {
    var btn = h('button', {
      type: 'button',
      class: 'pill-option' + (opt.value === getCurrent() ? ' active' : ''),
      text: opt.label
    });
    btn.addEventListener('click', function () {
      if (opt.value === getCurrent()) return;
      setNext(opt.value);
      row.querySelectorAll('.pill-option').forEach(function (n) { n.classList.remove('active'); });
      btn.classList.add('active');
      ctx.notifyChange();
    });
    row.append(btn);
  });
  parent.append(row);
  return row;
}

/* ---------------- custom text ----------------
 *
 * Ported from the prototype, including the switch to a multi-line editor on click and
 * the draggable box on the garment. The font size, ink colour and box position are
 * genuine prototype features and are kept, but only the presence of text counts toward
 * the engagement index, so a participant is not credited twice for adjusting one
 * feature. */

function textControl() {
  var block = controlBlock('Custom text');

  var input = h('input', {
    type: 'text',
    class: 'text-input',
    placeholder: 'Add text to the shirt',
    maxlength: '24',
    value: renderer.getText()
  });
  var area = h('textarea', {
    class: 'text-input',
    placeholder: 'Add text to the shirt',
    maxlength: '80',
    rows: '3',
    style: 'display:none;resize:none;'
  });

  block.append(
    input,
    area,
    h('p', {
      class: 'hint',
      text: 'Click the field (or double-click the text on the shirt) for multi-line editing. Drag the box on the shirt to reposition.'
    })
  );

  var overlay = ctx.overlay;
  var frame = ctx.frame;
  var canvas = frame.querySelector('canvas');

  function updateBoxPosition() {
    var extent = renderer.getTextBoxExtent();
    var wFrac = Math.min(0.94, extent.wFrac + 0.02);
    var hFrac = Math.min(0.85, extent.hFrac + 0.03);
    var pos = renderer.getTextPosition();
    overlay.style.left = ((pos.cxFrac - wFrac / 2) * 100) + '%';
    overlay.style.top = ((pos.cyFrac - hFrac / 2) * 100) + '%';
    overlay.style.width = (wFrac * 100) + '%';
    overlay.style.height = (hFrac * 100) + '%';
  }
  function showBox() {
    if (!renderer.hasText()) return;
    overlay.style.display = 'block';
    updateBoxPosition();
  }
  function hideBox() { overlay.style.display = 'none'; }

  function onTextChanged(value) {
    renderer.setText(value);
    if (renderer.hasText()) showBox(); else hideBox();
    ctx.notifyChange();
  }

  function switchToMultiline() {
    if (area.style.display === 'block') return;
    area.value = renderer.getText();
    input.style.display = 'none';
    area.style.display = 'block';
    area.focus();
    var end = area.value.length;
    area.setSelectionRange(end, end);
    if (renderer.hasText()) showBox();
  }

  input.addEventListener('input', function () { onTextChanged(input.value); });
  input.addEventListener('click', switchToMultiline);
  input.addEventListener('focus', function () { if (renderer.hasText()) showBox(); });
  area.addEventListener('input', function () { onTextChanged(area.value); });
  area.addEventListener('focus', function () { if (renderer.hasText()) showBox(); });

  overlay.addEventListener('dblclick', function (e) {
    switchToMultiline();
    e.preventDefault();
    e.stopPropagation();
  });

  var drag = null;
  overlay.addEventListener('pointerdown', function (e) {
    var pos = renderer.getTextPosition();
    drag = {
      rect: frame.getBoundingClientRect(),
      startX: e.clientX, startY: e.clientY,
      startCx: pos.cxFrac, startCy: pos.cyFrac
    };
    overlay.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  overlay.addEventListener('pointermove', function (e) {
    if (!drag) return;
    renderer.setTextPosition(
      drag.startCx + (e.clientX - drag.startX) / drag.rect.width,
      drag.startCy + (e.clientY - drag.startY) / drag.rect.height
    );
    updateBoxPosition();
  });
  function endDrag() {
    if (!drag) return;
    drag = null;
    ctx.notifyChange();
  }
  overlay.addEventListener('pointerup', endDrag);
  overlay.addEventListener('pointercancel', endDrag);

  /* Clicking the printed text brings its box back; clicking anywhere else hides the
     box without touching the text already rendered on the shirt. */
  document.addEventListener('pointerdown', function (e) {
    if (!renderer.hasText() || drag) return;
    var t = e.target;
    if (t === overlay || overlay.contains(t)) return;
    if (t === input || t === area) return;
    if (t === canvas) {
      var rect = canvas.getBoundingClientRect();
      var fx = (e.clientX - rect.left) / rect.width;
      var fy = (e.clientY - rect.top) / rect.height;
      var extent = renderer.getTextBoxExtent();
      var pos = renderer.getTextPosition();
      if (Math.abs(fx - pos.cxFrac) < extent.wFrac / 2 && Math.abs(fy - pos.cyFrac) < extent.hFrac / 2) {
        showBox();
        return;
      }
    }
    hideBox();
  });

  /* font size */
  var value = h('span', { class: 'stepper-value', text: renderer.getFontSize() + 'px' });
  var down = h('button', { type: 'button', class: 'stepper-btn', 'aria-label': 'Decrease font size', text: '\u2212' });
  var up = h('button', { type: 'button', class: 'stepper-btn', 'aria-label': 'Increase font size', text: '+' });

  function refreshStepper() {
    var size = renderer.getFontSize();
    value.textContent = size + 'px';
    down.disabled = size <= rt.FONT_MIN;
    up.disabled = size >= rt.FONT_MAX;
  }
  function step(delta) {
    renderer.setFontSize(renderer.getFontSize() + delta);
    refreshStepper();
    if (renderer.hasText()) updateBoxPosition();
    ctx.notifyChange();
  }
  down.addEventListener('click', function () { step(-rt.FONT_STEP); });
  up.addEventListener('click', function () { step(rt.FONT_STEP); });

  block.append(
    h('div', { class: 'stepper-row' },
      h('span', { class: 'control-label', style: 'font-weight:400;color:var(--ink-soft);', text: 'Font size' }),
      h('div', { class: 'stepper' }, down, value, up)
    )
  );
  refreshStepper();

  /* ink colour */
  var inkRow = h('div', { style: 'margin-top:10px;' });
  block.append(inkRow);
  pills(
    inkRow,
    [{ value: 'black', label: 'Black' }, { value: 'white', label: 'White' }],
    function () { return renderer.getTextColour(); },
    function (v) { renderer.setTextColour(v); }
  );

  if (renderer.hasText()) showBox();
}

/* ---------------- sleeve length ---------------- */

function sleeveControl() {
  var block = controlBlock('Sleeve length');
  pills(
    block,
    [
      { value: 'sleeveless', label: 'Sleeveless' },
      { value: 'short', label: 'Short sleeve' },
      { value: 'long', label: 'Long sleeve' }
    ],
    function () { return renderer.getSleeve(); },
    function (v) {
      /* Switching shape may need a garment that has not been precomputed yet, so the
         frame dims until it is ready rather than appearing to ignore the tap. */
      ctx.frame.classList.add('busy');
      renderer.setSleeve(v).then(function () { ctx.frame.classList.remove('busy'); });
    }
  );
}

/* ---------------- neckline ---------------- */

function neckControl() {
  var block = controlBlock('Neckline');
  pills(
    block,
    [{ value: 'round', label: 'Round neck' }, { value: 'v', label: 'V-neck' }],
    function () { return renderer.getNeckline(); },
    function (v) {
      ctx.frame.classList.add('busy');
      renderer.setNeckline(v).then(function () { ctx.frame.classList.remove('busy'); });
    }
  );
}

/* ---------------- skin tone ----------------
 *
 * No reference, no comparison, no matching score and no feedback of any kind: it is
 * one available option like the others. Anything that told a participant how close
 * they were to something would be measuring a different construct. */

function skinToneControl() {
  var dot = h('span', { class: 'swatch-dot' });
  var hexLabel = h('span', { text: '' });
  var nameLabel = h('span', { text: 'Original' });

  var readout = h('span', { class: 'control-readout' }, dot, hexLabel);
  var block = controlBlock('Model tone', readout);

  var head = block.querySelector('.control-label');
  head.append(' \u2014 ', nameLabel);

  var track = h('div', { class: 'track-bg', style: 'background:' + rt.toneTrackGradient() });
  var slider = h('input', {
    type: 'range',
    min: '0',
    max: '100',
    value: String(Math.round(renderer.getTone() * 100)),
    'aria-label': 'Model skin tone'
  });

  block.append(
    h('div', { class: 'slider-wrap' }, track, slider),
    h('div', { class: 'slider-ends' }, h('span', { text: 'Lightest' }), h('span', { text: 'Darkest' }))
  );

  function refreshReadout() {
    var t = Number(slider.value) / 100;
    dot.style.background = rt.toneHexFor(t);
    hexLabel.textContent = rt.toneHexFor(t);
    nameLabel.textContent = renderer.hasAdjustedTone() ? rt.toneLabelFor(t) : 'Original';
  }

  slider.addEventListener('input', function () {
    renderer.setTone(Number(slider.value) / 100);
    refreshReadout();
  });
  slider.addEventListener('change', function () { ctx.notifyChange(); });

  refreshReadout();
}

/* ---------------- bundle assembly ---------------- */

const CONTROL_SOURCES = {
  text: textControl,
  sleeve: sleeveControl,
  neck: neckControl,
  skinTone: skinToneControl
};

/* The names the serialised controls may reference. Everything else must be local to
 * the control, because only its own body crosses to the browser. */
const PRELUDE = [
  'var api = { collectors: [] };',
  'var h = ctx.h;',
  'var renderer = ctx.renderer;',
  'var rt = ctx.rt;',
  'var initial = ctx.initial || {};',
  'var controlBlock = ' + controlBlock.toString() + ';',
  'var pills = ' + pills.toString() + ';'
].join('\n');

const EPILOGUE = [
  'return { collect: function () {',
  '  var out = {};',
  '  api.collectors.forEach(function (c) { Object.assign(out, c()); });',
  '  return out;',
  '} };'
].join('\n');

/* Ordering follows the brief for the shared controls -- text, then sleeve, then neck --
 * and keeps tone last, where the prototype placed the controls describing who is
 * wearing the shirt rather than what the shirt is. */
const CONTROL_ORDER = ['text', 'sleeve', 'neck', 'skinTone'];

export function buildControlBundle(controlNames) {
  const allowed = CONTROL_ORDER.filter((name) => controlNames.includes(name));
  const bodies = allowed.map((name) => `(${CONTROL_SOURCES[name].toString()})();`);
  return [PRELUDE, ...bodies, EPILOGUE].join('\n\n');
}
