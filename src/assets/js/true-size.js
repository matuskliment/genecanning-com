/**
 * "See it at true size" — the painting drawn to scale on a wall beside an
 * armchair, so collectors understand what 48″ × 86″ means in a room.
 * An optional second button swaps in a comparison size (e.g. an 8″ × 10″
 * field sketch) and the painting glides to the new size over 450ms.
 *
 * Markup:
 *   <button type="button" class="gc-tool" data-gc-true-size-toggle
 *           aria-controls="true-size" aria-expanded="false">See it at true size</button>
 *
 *   <section id="true-size" class="gc-ts" data-gc-true-size hidden
 *            data-width-in="86" data-height-in="48"
 *            data-size-label="48″ × 86″"
 *            data-src="/img/treetop-leopard-1200.jpg"
 *            data-title="Treetop Leopard"
 *            data-compare-width-in="10" data-compare-height-in="8"
 *            data-compare-label="8″ × 10″ field sketch"
 *            data-compare-src="/img/potter-creek-400.jpg"></section>
 *
 * Only data-width-in and data-height-in are required. Everything inside the
 * section is generated. Without JS the section stays hidden and the toggle
 * button should be hidden too (give it the `hidden` attribute in markup; the
 * script reveals it).
 */

import { reducedMotion } from './motion-utils.js';

const CHAIR = { w: 34, h: 32 };     // inches
const HANG_CENTRE = 57;             // gallery hanging height, inches from floor
const CHAIR_SVG = `
  <svg class="gc-ts-chair" aria-hidden="true" viewBox="0 0 34 32" preserveAspectRatio="xMidYMax meet">
    <rect x="5" y="3" width="24" height="17" rx="3" fill="#9AA39B"/>
    <rect x="0" y="12" width="7" height="14" rx="3" fill="#8A948B"/>
    <rect x="27" y="12" width="7" height="14" rx="3" fill="#8A948B"/>
    <rect x="5" y="18" width="24" height="8" rx="2" fill="#A7AFA7"/>
    <rect x="2" y="26" width="2" height="6" fill="#6E776F"/>
    <rect x="30" y="26" width="2" height="6" fill="#6E776F"/>
  </svg>`;

const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** 86 → "7′ 2″" ; 30 → "30″" */
function feet(inches) {
  if (inches < 36) return `${Math.round(inches)}″`;
  const ft = Math.floor(inches / 12);
  const rem = Math.round(inches - ft * 12);
  return rem ? `${ft}′ ${rem}″` : `${ft}′`;
}

export function initTrueSize() {
  for (const panel of document.querySelectorAll('[data-gc-true-size]')) {
    if (panel.dataset.gcBound) continue;
    panel.dataset.gcBound = '1';
    setup(panel);
  }
}

function setup(panel) {
  const d = panel.dataset;
  const main = { w: num(d.widthIn), h: num(d.heightIn) };
  if (!main.w || !main.h) {
    console.warn('[gc] true-size: data-width-in and data-height-in are required', panel);
    return;
  }
  const compare = num(d.compareWidthIn) && num(d.compareHeightIn)
    ? { w: num(d.compareWidthIn), h: num(d.compareHeightIn) }
    : null;
  const title = d.title || 'This painting';
  const sizeLabel = d.sizeLabel || `${main.h}″ × ${main.w}″`;

  // Wall big enough for the larger of the two works plus the chair.
  const widest = Math.max(main.w, compare?.w || 0);
  const tallest = Math.max(main.h, compare?.h || 0);
  const wall = { w: Math.max(168, widest + CHAIR.w + 40), h: Math.max(108, tallest + 30) };
  const chairLeft = wall.w * 0.05;
  const free = { left: chairLeft + CHAIR.w + 8, right: wall.w - 6 };
  const centreX = (free.left + free.right) / 2;

  const place = ({ w, h }) => {
    let bottom = Math.max(6, HANG_CENTRE - h / 2);
    if (bottom + h > wall.h - 4) bottom = Math.max(2, wall.h - 4 - h);
    const left = Math.max(free.left, centreX - w / 2);
    const pct = (v, of) => `${((v / of) * 100).toFixed(3)}%`;
    return { left: pct(left, wall.w), bottom: pct(bottom, wall.h), width: pct(w, wall.w), height: pct(h, wall.h) };
  };

  panel.innerHTML = `
    <div class="gc-ts-head">
      <h2>At true size, on a wall</h2>
      ${compare ? `<div class="gc-ts-switch" role="group" aria-label="Choose size to show">
        <button type="button" class="gc-tool" data-which="main" aria-pressed="true">This painting · ${sizeLabel}</button>
        <button type="button" class="gc-tool" data-which="compare" aria-pressed="false">Compare · ${d.compareLabel || `${compare.h}″ × ${compare.w}″`}</button>
      </div>` : ''}
    </div>
    <div class="gc-ts-wall" style="aspect-ratio: ${wall.w} / ${wall.h}">
      <div class="gc-ts-floor" style="height: ${((2.5 / wall.h) * 100).toFixed(3)}%"></div>
      ${CHAIR_SVG}
      <div class="gc-ts-art" role="img"></div>
    </div>
    <p class="gc-ts-caption" aria-live="polite"></p>`;

  const chair = panel.querySelector('.gc-ts-chair');
  chair.style.left = `${((chairLeft / wall.w) * 100).toFixed(3)}%`;
  chair.style.width = `${((CHAIR.w / wall.w) * 100).toFixed(3)}%`;

  const art = panel.querySelector('.gc-ts-art');
  const caption = panel.querySelector('.gc-ts-caption');

  const show = (which) => {
    const isCompare = which === 'compare' && compare;
    const dims = isCompare ? compare : main;
    Object.assign(art.style, place(dims));
    const src = isCompare ? d.compareSrc : d.src;
    art.style.backgroundImage = src ? `url("${src}")` : 'none';
    art.style.backgroundSize = 'cover';
    art.style.backgroundPosition = 'center';
    const label = isCompare ? (d.compareLabel || `${compare.h}″ × ${compare.w}″`) : `${title}, ${sizeLabel}`;
    art.setAttribute('aria-label', `${label}, shown to scale beside an armchair`);
    caption.textContent = isCompare
      ? `${d.compareLabel || 'The comparison piece'}, at the same scale. Centred ${HANG_CENTRE}″ from the floor, beside an armchair about ${CHAIR.w}″ wide.`
      : `${title} is ${feet(main.w)} wide and ${feet(main.h)} tall. Hung at gallery height, centred ${HANG_CENTRE}″ from the floor, beside an armchair about ${CHAIR.w}″ wide.`;
    for (const b of panel.querySelectorAll('[data-which]')) {
      b.setAttribute('aria-pressed', String(b.dataset.which === (isCompare ? 'compare' : 'main')));
    }
  };

  panel.addEventListener('click', (e) => {
    const b = e.target.closest('[data-which]');
    if (b) show(b.dataset.which);
  });
  show('main');

  // Toggle button(s) that control this panel.
  const toggles = panel.id
    ? document.querySelectorAll(`[data-gc-true-size-toggle][aria-controls="${panel.id}"]`)
    : [];
  for (const t of toggles) {
    t.hidden = false;
    t.addEventListener('click', () => {
      const opening = panel.hidden;
      panel.hidden = !opening;
      for (const other of toggles) other.setAttribute('aria-expanded', String(opening));
      if (opening) {
        panel.classList.remove('gc-reveal');
        void panel.offsetWidth; // restart the reveal animation
        panel.classList.add('gc-reveal');
        const r = panel.getBoundingClientRect();
        if (r.bottom > window.innerHeight) {
          panel.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
        }
      }
    });
  }
}
