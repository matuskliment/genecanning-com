/**
 * genecanning.com — motion kit entry point.
 *
 * Load once, at the end of <body> or with type="module" in <head>:
 *   <script type="module" src="/assets/js/gc.js"></script>
 *
 * Each feature is a separate module, loaded only when its markup is on the
 * page. Every feature is progressive enhancement: with JS off, links still go
 * to painting pages, images still show and native audio controls still work.
 */

const root = document.documentElement;
root.classList.remove('no-js');
root.classList.add('js');

const features = [
  ['img[data-gc-fade]', () => import('./image-fade.js'), 'initImageFade'],
  ['[data-gc-gallery]', () => import('./lightbox.js'), 'initLightbox'],
  ['[data-gc-true-size]', () => import('./true-size.js'), 'initTrueSize'],
  ['[data-gc-audio]', () => import('./audio.js'), 'initAudio'],
  ['[data-gc-zoom]', () => import('./zoom.js'), 'initZoom'],
  ['[data-gc-trail]', () => import('./trail-map.js'), 'initTrailMap'],
];

function boot() {
  for (const [selector, load, fn] of features) {
    if (!document.querySelector(selector)) continue;
    load()
      .then((mod) => mod[fn]())
      .catch((err) => console.error(`[gc] ${fn} failed`, err));
  }

  // "Print this painting"
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-gc-print]');
    if (btn) window.print();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
