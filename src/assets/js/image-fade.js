/**
 * Images fade in from their own colours.
 *
 * Markup:
 *   <span class="gc-img" style="--gc-lqip-color:#8a7a5c; --gc-lqip:url(data:image/jpeg;base64,…)">
 *     <img src="…" width="800" height="640" alt="…" loading="lazy" data-gc-fade>
 *   </span>
 *
 * The wrapper paints the tiny placeholder (or the average colour) at the
 * image's final size. The image fades in over 200ms once loaded. Images that
 * are already loaded (cached) appear instantly, without a fade.
 */

export function initImageFade(scope = document) {
  for (const img of scope.querySelectorAll('img[data-gc-fade]:not(.is-loaded)')) {
    if (img.complete && img.naturalWidth) {
      // Cached: show at once, no animation.
      img.style.transition = 'none';
      img.classList.add('is-loaded');
      requestAnimationFrame(() => { img.style.transition = ''; });
      continue;
    }
    const show = () => img.classList.add('is-loaded');
    img.addEventListener('load', show, { once: true });
    // On error, reveal anyway so the alt text is visible.
    img.addEventListener('error', show, { once: true });
  }
}
