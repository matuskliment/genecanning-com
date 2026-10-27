/**
 * "The Trail" — map of Algonquin with Gene's routes and a pin wherever he
 * painted. Phase 2: needs real locations from Gene.
 *
 * The route lines draw themselves once, slowly (2.5s), the first time the map
 * is in view. This is the only motion on the site that runs by itself.
 * Clicking a pin shows that painting's card beside the map.
 *
 * Markup:
 *   <div class="gc-trail" data-gc-trail>
 *     <div class="gc-trail-map">
 *       <svg viewBox="0 0 780 720" role="img" aria-label="Map of Gene's fall route in Algonquin Park">
 *         … lakes …
 *         <path class="gc-route" data-gc-route d="M180 304 C …" fill="none" stroke="#97391F" stroke-width="3"/>
 *       </svg>
 *       <button type="button" class="gc-pin" data-gc-pin="joe-lake" style="--x:37.8%; --y:54.9%">
 *         <span class="gc-pin-label">Joe Lake</span>
 *       </button>
 *     </div>
 *     <div class="gc-trail-card" data-gc-trail-card></div>
 *     <template data-gc-trail-item="joe-lake"> …card markup: image, title, link… </template>
 *   </div>
 *
 * Also render the same places as a plain list of links under the map, for
 * screen readers and visitors without JS.
 */

import { reducedMotion, animate } from './motion-utils.js';

export function initTrailMap() {
  for (const trail of document.querySelectorAll('[data-gc-trail]')) {
    if (trail.dataset.gcBound) continue;
    trail.dataset.gcBound = '1';
    setupRoutes(trail);
    setupPins(trail);
  }
}

function setupRoutes(trail) {
  const routes = [...trail.querySelectorAll('[data-gc-route]')];
  if (!routes.length) return;

  for (const r of routes) {
    const len = typeof r.getTotalLength === 'function' ? Math.ceil(r.getTotalLength()) : 2000;
    r.style.setProperty('--gc-route-len', String(len));
  }

  const draw = () => {
    for (const r of routes) {
      if (reducedMotion()) { r.classList.add('is-drawn'); continue; }
      requestAnimationFrame(() => requestAnimationFrame(() => r.classList.add('is-drawing')));
      r.addEventListener('transitionend', () => {
        r.classList.add('is-drawn');
        r.classList.remove('is-drawing');
      }, { once: true });
    }
  };

  if (!('IntersectionObserver' in window)) { draw(); return; }
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      io.disconnect();
      setTimeout(draw, 300);
    }
  }, { threshold: 0.4 });
  io.observe(trail);
}

function setupPins(trail) {
  const pins = [...trail.querySelectorAll('[data-gc-pin]')];
  const card = trail.querySelector('[data-gc-trail-card]');
  if (!pins.length || !card) return;
  card.setAttribute('aria-live', 'polite');

  for (const pin of pins) {
    const x = parseFloat(getComputedStyle(pin).getPropertyValue('--x'));
    if (x > 70) pin.dataset.labelSide = 'left';
    pin.setAttribute('aria-pressed', 'false');
    pin.addEventListener('click', () => select(pin.dataset.gcPin));
  }

  const select = (id) => {
    const tpl = trail.querySelector(`template[data-gc-trail-item="${CSS.escape(id)}"]`);
    if (!tpl) return;
    for (const p of pins) p.setAttribute('aria-pressed', String(p.dataset.gcPin === id));
    card.replaceChildren(tpl.content.cloneNode(true));
    animate(card, [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }],
      { duration: 260, easing: 'ease-out' });
  };

  // Show the first (or pre-pressed) pin's card on load.
  const initial = trail.dataset.gcTrailInitial || pins[0].dataset.gcPin;
  const tpl = trail.querySelector(`template[data-gc-trail-item="${CSS.escape(initial)}"]`);
  if (tpl) {
    card.replaceChildren(tpl.content.cloneNode(true));
    for (const p of pins) p.setAttribute('aria-pressed', String(p.dataset.gcPin === initial));
  }
}
