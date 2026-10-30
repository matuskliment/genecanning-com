/** Shared helpers for the motion kit. */

const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

/** True when the visitor has asked their device to reduce motion. Checked live, every time. */
export const reducedMotion = () => reduceQuery.matches;

/** Motion timings, matching the CSS custom properties in gc-motion.css. */
export const TIMING = {
  quick: 200,
  standard: 300,
  hang: 380,
  close: 240,
  settle: 'cubic-bezier(.2, .7, .2, 1)',
};

/**
 * Run a Web Animation unless reduced motion is on.
 * Always resolves, so callers can await it either way.
 */
export function animate(el, keyframes, options) {
  if (reducedMotion() || typeof el.animate !== 'function') return Promise.resolve();
  const anim = el.animate(keyframes, { fill: 'none', ...options });
  return anim.finished.catch(() => {});
}

/** Wait for an image to be decoded (or fail) without throwing. */
export function ready(img) {
  if (img.complete && img.naturalWidth) {
    return img.decode ? img.decode().catch(() => {}) : Promise.resolve();
  }
  return new Promise((resolve) => {
    const done = () => resolve();
    img.addEventListener('load', done, { once: true });
    img.addEventListener('error', done, { once: true });
  });
}

/** Next animation frame, as a promise. */
export const frame = () => new Promise((r) => requestAnimationFrame(() => r()));

/** Lock page scroll while an overlay is open, without the page jumping sideways.
 *  Also blocks iOS rubber-band scroll behind lightbox/menu overlays. */
let lockedScrollY = 0;
let scrollLocked = false;
export function lockScroll(lock) {
  const html = document.documentElement;
  const body = document.body;
  if (lock) {
    if (scrollLocked) return;
    scrollLocked = true;
    lockedScrollY = window.scrollY || window.pageYOffset || 0;
    const scrollbar = window.innerWidth - html.clientWidth;
    html.style.overflow = 'hidden';
    html.style.overscrollBehavior = 'none';
    if (scrollbar > 0) html.style.paddingRight = `${scrollbar}px`;
    body.style.position = 'fixed';
    body.style.top = `-${lockedScrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
  } else {
    if (!scrollLocked) return;
    scrollLocked = false;
    html.style.overflow = '';
    html.style.overscrollBehavior = '';
    html.style.paddingRight = '';
    body.style.position = '';
    body.style.top = '';
    body.style.left = '';
    body.style.right = '';
    body.style.width = '';
    // Instant: html { scroll-behavior: smooth } would animate from the top.
    window.scrollTo({ top: lockedScrollY, left: 0, behavior: 'instant' });
  }
}
