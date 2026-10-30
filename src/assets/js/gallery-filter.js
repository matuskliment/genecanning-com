/**
 * Gallery filters that glide — by status and by medium.
 *
 * Cards that leave fade out (160ms); the cards that stay slide to their new
 * places (320ms), so visitors see what moved; cards that return fade back in.
 * A live region announces the result, e.g. "Showing 3 available oil paintings".
 * The painting viewer (lightbox.js) only steps through the cards that show.
 *
 * Markup — one bar per filter group, all pointing at the same gallery:
 *
 *   <div class="gc-filter" role="group" aria-label="Show"
 *        data-gc-filter-for="african-wildlife" data-gc-filter-key="status" hidden>
 *     <span class="gc-filter-label">Show:</span>
 *     <button type="button" data-gc-filter="all" aria-pressed="true">All</button>
 *     <button type="button" data-gc-filter="available" aria-pressed="false">Available</button>
 *     <button type="button" data-gc-filter="sold" aria-pressed="false">Sold</button>
 *   </div>
 *   <div class="gc-filter" role="group" aria-label="Medium"
 *        data-gc-filter-for="african-wildlife" data-gc-filter-key="medium" hidden>
 *     <span class="gc-filter-label">Medium:</span>
 *     <button type="button" data-gc-filter="all" aria-pressed="true">All</button>
 *     <button type="button" data-gc-filter="oil" aria-pressed="false">Oil</button>
 *     <button type="button" data-gc-filter="acrylic" aria-pressed="false">Acrylic</button>
 *     <button type="button" data-gc-filter="graphite" aria-pressed="false">Graphite</button>
 *   </div>
 *   <p class="gc-filter-count" data-gc-filter-count-for="african-wildlife" aria-live="polite"></p>
 *
 *   <div id="african-wildlife" class="grid" data-gc-gallery>
 *     <a class="gc-card" data-gc-item data-status="available" data-medium="oil" …>…</a>
 *   </div>
 *
 * Only filters we have the facts for are shown:
 *  - A bar stays hidden unless EVERY card has that attribute (e.g. data-medium)
 *    and there are at least two different values. So a series where some
 *    captions don't state the medium simply gets no medium filter.
 *  - Buttons whose value no card has are removed; the rest show their count,
 *    e.g. "Oil (4)".
 * data-status values: available, sold, private, artist. data-medium values:
 * oil, acrylic, graphite (add others as needed, lower case).
 */

import { reducedMotion, animate } from './motion-utils.js';

const MEDIUM_NOUN = { oil: 'oil paintings', acrylic: 'acrylic paintings', graphite: 'graphite drawings' };
const STATUS_ADJ = { available: 'available', sold: 'sold', private: 'privately owned', artist: 'artist’s collection' };

export function initGalleryFilter() {
  const groups = new Map();
  for (const bar of document.querySelectorAll('[data-gc-filter-for]')) {
    if (bar.dataset.gcBound) continue;
    const id = bar.dataset.gcFilterFor;
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(bar);
  }
  for (const [id, bars] of groups) {
    const grid = document.getElementById(id);
    if (!grid) continue;
    bars.forEach((b) => { b.dataset.gcBound = '1'; });
    setup(id, grid, bars);
  }
}

function setup(id, grid, bars) {
  const cards = () => [...grid.querySelectorAll('[data-gc-item], .gc-card')];
  const count = document.querySelector(`[data-gc-filter-count-for="${CSS.escape(id)}"]`)
    || bars.map((b) => b.querySelector('.gc-filter-count')).find(Boolean);
  const keyOf = (bar) => bar.dataset.gcFilterKey || 'status';
  const state = {};
  const live = [];

  for (const bar of bars) {
    const key = keyOf(bar);
    const values = cards().map((c) => c.dataset[key]);
    const known = values.every((v) => v);
    const distinct = new Set(values.filter(Boolean));
    if (!known || distinct.size < 2) continue; // don't offer a filter we lack the facts for

    for (const b of bar.querySelectorAll('[data-gc-filter]')) {
      const f = b.dataset.gcFilter;
      if (f === 'all') continue;
      const n = values.filter((v) => v === f).length;
      if (!n) { b.remove(); continue; }
      if (key !== 'status') b.textContent = `${b.textContent.trim()} (${n})`;
    }
    state[key] = bar.querySelector('[data-gc-filter][aria-pressed="true"]')?.dataset.gcFilter || 'all';
    bar.hidden = false;
    live.push(bar);
  }
  if (!live.length) return;

  const matches = (card, s = state) => Object.entries(s).every(([k, f]) => f === 'all' || card.dataset[k] === f);

  const say = () => {
    if (!count) return;
    const n = cards().filter((c) => !c.hidden).length;
    const status = state.status && state.status !== 'all' ? STATUS_ADJ[state.status] || state.status : '';
    const medium = state.medium && state.medium !== 'all' ? MEDIUM_NOUN[state.medium] || `${state.medium} works` : 'works';
    const noun = n === 1 ? medium.replace(/s$/, '') : medium;
    count.textContent = n
      ? `Showing ${n} ${status ? status + ' ' : ''}${noun}`
      : `No ${status ? status + ' ' : ''}${medium} in this series. Try “All”.`;
  };

  let busy = false;
  let queued = null;

  const apply = async (next) => {
    if (busy) { queued = next; return; }
    busy = true;

    const all = cards();
    const leaving = all.filter((c) => !c.hidden && !matches(c, next));
    const entering = all.filter((c) => c.hidden && matches(c, next));
    const staying = all.filter((c) => !c.hidden && matches(c, next));
    Object.assign(state, next);

    if (reducedMotion()) {
      leaving.forEach((c) => { c.hidden = true; });
      entering.forEach((c) => { c.hidden = false; });
    } else {
      await Promise.all(leaving.map((c) => animate(c, [{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: 'ease-in', fill: 'forwards' })));
      const first = new Map(staying.map((c) => [c, c.getBoundingClientRect()]));
      leaving.forEach((c) => { c.hidden = true; c.getAnimations().forEach((a) => a.cancel()); });
      entering.forEach((c) => { c.hidden = false; });
      const glides = staying.map((c) => {
        const a = first.get(c);
        const b = c.getBoundingClientRect();
        const dx = a.left - b.left;
        const dy = a.top - b.top;
        if (!dx && !dy) return null;
        return animate(c, [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }],
          { duration: 320, easing: 'cubic-bezier(.2, .7, .2, 1)' });
      });
      const fades = entering.map((c) => animate(c,
        [{ opacity: 0, transform: 'scale(.98)' }, { opacity: 1, transform: 'none' }],
        { duration: 260, delay: 120, easing: 'ease-out', fill: 'backwards' }));
      await Promise.all([...glides, ...fades]);
    }

    say();
    busy = false;
    if (queued) { const q = queued; queued = null; apply(q); }
  };

  for (const bar of live) {
    const key = keyOf(bar);
    bar.addEventListener('click', (e) => {
      const b = e.target.closest('[data-gc-filter]');
      if (!b || b.getAttribute('aria-pressed') === 'true') return;
      for (const other of bar.querySelectorAll('[data-gc-filter]')) {
        other.setAttribute('aria-pressed', String(other === b));
      }
      apply({ ...state, ...(queued || {}), [key]: b.dataset.gcFilter });
    });
  }

  // Initial state (a bar may start on something other than "All").
  for (const c of cards()) c.hidden = !matches(c);
  say();
}
