/**
 * "Hang it on the wall" — the painting viewer.
 *
 * Clicking a gallery card grows its thumbnail into full view on a dim, warm
 * wall (a FLIP animation, 380ms). Closing shrinks it back into its exact spot
 * in the grid, so visitors never lose their place. Previous/Next cross-fade.
 *
 * Markup (one container per gallery; cards are ordinary links to the
 * painting page, so everything still works without JS):
 *
 *   <div data-gc-gallery>
 *     <a href="/on-the-trail-of-tom-thomson/fall-season-paintings/potter-creek.html"
 *        class="gc-card" data-gc-item
 *        data-gc-full="/img/potter-creek-1800.jpg"
 *        data-gc-full-srcset="/img/potter-creek-1200.jpg 1200w, /img/potter-creek-1800.jpg 1800w, /img/potter-creek-2400.jpg 2400w"
 *        data-gc-ratio="10/8"
 *        data-gc-title="Potter Creek"
 *        data-gc-meta="On wood panel · 8″ × 10″"
 *        data-gc-status="Available · $650"
 *        data-gc-enquire="/contact-gene.html?painting=potter-creek">
 *       <span class="gc-mat"><span class="gc-img"><img src="…-400.jpg" alt="…" width="400" height="320" data-gc-fade></span></span>
 *       <span class="gc-title">Potter Creek</span>
 *       …
 *     </a>
 *   </div>
 *
 * Optional: add `data-gc-sold` to a card to show the red dot in the viewer.
 * Keyboard: Escape closes, ← → move. Touch: swipe left/right.
 * Ctrl/Cmd/Shift/middle-click still open the painting page as a normal link.
 */

import { reducedMotion, TIMING, animate, ready, frame, lockScroll } from './motion-utils.js';

let dialog = null;
let els = null;
const state = { items: [], index: 0, open: false, closing: false, loadToken: 0, hiddenThumb: null };

export function initLightbox() {
  for (const gallery of document.querySelectorAll('[data-gc-gallery]')) {
    if (gallery.dataset.gcBound) continue;
    gallery.dataset.gcBound = '1';
    gallery.addEventListener('click', (e) => {
      const card = e.target.closest('[data-gc-item]');
      if (!card || !gallery.contains(card)) return;
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      // Only the cards currently showing (gallery filters may hide some).
      const items = [...gallery.querySelectorAll('[data-gc-item]')].filter((c) => !c.hidden);
      open(items, items.indexOf(card));
    });
  }
}

/* ---------------------------------------------------------------- build */

function build() {
  if (dialog) return;
  dialog = document.createElement('dialog');
  dialog.className = 'gc-lightbox';
  dialog.setAttribute('aria-labelledby', 'gc-lb-title');
  dialog.innerHTML = `
    <div class="gc-lb-wall"></div>
    <div class="gc-lb-bar">
      <span class="gc-lb-counter" aria-hidden="true"></span>
      <button type="button" class="gc-lb-btn gc-lb-close">Close <span aria-hidden="true">✕</span></button>
    </div>
    <div class="gc-lb-stage">
      <button type="button" class="gc-lb-btn gc-lb-nav gc-lb-prev"><span aria-hidden="true">‹</span> Previous</button>
      <figure class="gc-lb-figure"><img class="gc-lb-img" alt="" decoding="async"></figure>
      <button type="button" class="gc-lb-btn gc-lb-nav gc-lb-next">Next <span aria-hidden="true">›</span></button>
    </div>
    <div class="gc-lb-info">
      <span class="gc-lb-title" id="gc-lb-title"></span>
      <span class="gc-lb-meta"></span>
      <span class="gc-lb-status"></span>
      <a class="gc-lb-enquire" href="#">Ask Gene about this painting</a>
      <a class="gc-lb-page" href="#">Painting page</a>
    </div>
    <p class="gc-visually-hidden" aria-live="polite"></p>`;
  document.body.append(dialog);

  const q = (s) => dialog.querySelector(s);
  els = {
    wall: q('.gc-lb-wall'), bar: q('.gc-lb-bar'), counter: q('.gc-lb-counter'),
    close: q('.gc-lb-close'), prev: q('.gc-lb-prev'), next: q('.gc-lb-next'),
    stage: q('.gc-lb-stage'), figure: q('.gc-lb-figure'), img: q('.gc-lb-img'),
    info: q('.gc-lb-info'), title: q('.gc-lb-title'), meta: q('.gc-lb-meta'),
    status: q('.gc-lb-status'), enquire: q('.gc-lb-enquire'), page: q('.gc-lb-page'),
    live: q('[aria-live]'),
  };

  els.close.addEventListener('click', () => close());
  els.prev.addEventListener('click', () => go(-1));
  els.next.addEventListener('click', () => go(1));

  // Escape: animate out instead of the browser's instant close.
  dialog.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  // Safety net if the browser force-closes (e.g. repeated Escape).
  dialog.addEventListener('close', () => cleanup());

  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
  });

  // Swipe on touch screens.
  let start = null;
  els.stage.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') start = { x: e.clientX, y: e.clientY };
  });
  els.stage.addEventListener('pointerup', (e) => {
    if (!start || e.pointerType !== 'touch') return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    start = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
  });
  els.stage.addEventListener('pointercancel', () => { start = null; });

  window.addEventListener('resize', () => { if (state.open) layout(); });
}

/* ---------------------------------------------------------------- data */

const thumbOf = (card) => card.querySelector('img');

function ratioOf(card) {
  const r = card.dataset.gcRatio;
  if (r) {
    const [a, b] = r.split('/').map(Number);
    if (a > 0 && b > 0) return a / b;
  }
  const t = thumbOf(card);
  if (t?.naturalWidth) return t.naturalWidth / t.naturalHeight;
  const w = Number(t?.getAttribute('width'));
  const h = Number(t?.getAttribute('height'));
  return w > 0 && h > 0 ? w / h : 4 / 3;
}

function fill(card) {
  const n = state.items.length;
  const i = state.index;
  const d = card.dataset;
  const title = d.gcTitle || card.querySelector('.gc-title')?.textContent.trim() || '';

  els.title.textContent = title;
  els.meta.textContent = d.gcMeta || '';
  els.meta.hidden = !d.gcMeta;
  els.status.textContent = d.gcStatus || '';
  els.status.hidden = !d.gcStatus;
  els.status.classList.toggle('gc-sold', card.hasAttribute('data-gc-sold'));
  const enquireHref = d.gcEnquire || '';
  els.enquire.hidden = !enquireHref;
  if (enquireHref) els.enquire.href = enquireHref;
  els.page.href = card.getAttribute('href') || '#';
  els.page.textContent = card.classList.contains('gc-card') && card.querySelector('.gc-photo')
    ? 'Photo page'
    : 'Painting page';
  els.counter.textContent = `${i + 1} of ${n}`;
  els.prev.hidden = i === 0;
  els.next.hidden = i === n - 1;

  // Show the thumbnail at once (already in cache), then upgrade to the large file.
  const thumb = thumbOf(card);
  const img = els.img;
  img.removeAttribute('srcset');
  img.src = thumb?.currentSrc || thumb?.src || '';
  img.alt = thumb?.alt || title;
  layout();

  const token = ++state.loadToken;
  if (d.gcFull || d.gcFullSrcset) {
    const big = new Image();
    big.decoding = 'async';
    if (d.gcFullSrcset) {
      big.sizes = `${Math.ceil(parseFloat(img.style.width) || window.innerWidth)}px`;
      big.srcset = d.gcFullSrcset;
    }
    if (d.gcFull) big.src = d.gcFull;
    ready(big).then(() => {
      if (token !== state.loadToken || !big.naturalWidth) return;
      img.src = big.currentSrc || big.src;
    });
  }
}

/** Size the image to fit the stage exactly, so the FLIP maths is deterministic. */
function layout() {
  const card = state.items[state.index];
  if (!card) return;
  const ratio = ratioOf(card);
  const boxW = els.figure.clientWidth;
  const boxH = els.figure.clientHeight;
  if (!boxW || !boxH) return;
  let w = boxW;
  let h = w / ratio;
  if (h > boxH) { h = boxH; w = h * ratio; }
  els.img.style.width = `${Math.floor(w)}px`;
  els.img.style.height = `${Math.floor(h)}px`;
}

/* ---------------------------------------------------------------- motion */

function flipFrom(rect) {
  const last = els.img.getBoundingClientRect();
  if (!last.width || !last.height) return null;
  const dx = rect.left - last.left;
  const dy = rect.top - last.top;
  const sx = rect.width / last.width;
  const sy = rect.height / last.height;
  return `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
}

const inView = (r) => r.width > 0 && r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth;

function hideThumb(card) {
  const t = thumbOf(card);
  if (!t) return;
  t.style.visibility = 'hidden';
  state.hiddenThumb = t;
}
function showThumb() {
  if (state.hiddenThumb) state.hiddenThumb.style.visibility = '';
  state.hiddenThumb = null;
}

async function open(items, index) {
  if (state.open || index < 0) return;
  build();
  state.items = items;
  state.index = index;
  state.open = true;
  state.closing = false;

  const card = items[index];
  const thumb = thumbOf(card);
  const from = thumb?.getBoundingClientRect();

  lockScroll(true);
  dialog.showModal();
  fill(card);
  await frame();
  layout();

  if (reducedMotion() || !from || !inView(from)) {
    await animate(dialog, [{ opacity: 0 }, { opacity: 1 }], { duration: TIMING.quick, easing: 'ease-out' });
    return;
  }

  const start = flipFrom(from);
  hideThumb(card);
  await Promise.all([
    animate(els.wall, [{ opacity: 0 }, { opacity: 1 }], { duration: TIMING.standard, easing: 'ease-out' }),
    animate(els.bar, [{ opacity: 0 }, { opacity: 1 }], { duration: TIMING.standard, delay: 120, easing: 'ease-out', fill: 'backwards' }),
    animate(els.info, [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }],
      { duration: TIMING.standard, delay: 140, easing: 'ease-out', fill: 'backwards' }),
    animate(els.prev, [{ opacity: 0 }, { opacity: 1 }], { duration: TIMING.standard, delay: 140, fill: 'backwards' }),
    animate(els.next, [{ opacity: 0 }, { opacity: 1 }], { duration: TIMING.standard, delay: 140, fill: 'backwards' }),
    start && animate(els.img, [
      { transform: start, boxShadow: '0 0 0 rgba(0,0,0,0)' },
      { transform: 'none', boxShadow: getComputedStyle(els.img).boxShadow },
    ], { duration: TIMING.hang, easing: TIMING.settle }),
  ]);
  showThumb();
}

async function go(delta) {
  if (!state.open || state.closing) return;
  const next = state.index + delta;
  if (next < 0 || next >= state.items.length) return;
  state.index = next;
  const card = state.items[next];

  // Keep keyboard focus on a visible control when reaching either end.
  const focused = document.activeElement;
  fill(card);
  if ((focused === els.prev || focused === els.next) && focused.hidden) {
    const other = focused === els.prev ? els.next : els.prev;
    (other.hidden ? els.close : other).focus();
  }

  els.live.textContent = `${next + 1} of ${state.items.length}: ${els.title.textContent}`;
  await animate(els.img, [{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: 'ease-out' });
}

async function close() {
  if (!state.open || state.closing) return;
  state.closing = true;

  const card = state.items[state.index];
  const thumb = thumbOf(card);
  // While scroll is locked, don't scrollIntoView — it fights unlock restore.
  // FLIP only when the thumb is already on screen; otherwise fade out.
  const to = thumb?.getBoundingClientRect();
  const canFlip = !reducedMotion() && thumb && to && inView(to);

  if (canFlip) {
    const end = flipFrom(to);
    hideThumb(card);
    await Promise.all([
      animate(els.wall, [{ opacity: 1 }, { opacity: 0 }], { duration: TIMING.close, easing: 'ease-in', fill: 'forwards' }),
      animate(els.bar, [{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: 'forwards' }),
      animate(els.info, [{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: 'forwards' }),
      animate(els.prev, [{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: 'forwards' }),
      animate(els.next, [{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: 'forwards' }),
      end && animate(els.img, [
        { transform: 'none' },
        { transform: end, boxShadow: '0 0 0 rgba(0,0,0,0)' },
      ], { duration: TIMING.close, easing: 'cubic-bezier(.4, 0, .6, 1)', fill: 'forwards' }),
    ]);
  } else if (!reducedMotion()) {
    await Promise.all([
      animate(dialog, [{ opacity: 1 }, { opacity: 0 }], { duration: TIMING.close, easing: 'ease-in', fill: 'forwards' }),
    ]);
  }

  dialog.close();
  cleanup();
  // After unlock restored the open scroll position: if we closed on a card
  // that was off-screen (Next/Prev), bring it into view once, instantly.
  if (thumb && !inView(thumb.getBoundingClientRect())) {
    card.scrollIntoView({ block: 'center', behavior: 'instant' });
  }
  card.focus({ preventScroll: true });
}

function cleanup() {
  if (!state.open) return;
  state.open = false;
  state.closing = false;
  state.loadToken++;
  showThumb();
  lockScroll(false);
  // Clear any held animation end-states so the next open starts clean.
  for (const el of [dialog, els.wall, els.bar, els.info, els.prev, els.next, els.img]) {
    el.getAnimations().forEach((a) => a.cancel());
  }
  dialog.style.opacity = '';
  if (dialog.open) dialog.close();
}
