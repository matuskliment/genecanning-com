/**
 * "Look closely" — see the brushwork.
 * A close-up of the high-resolution file appears over the painting. Mouse:
 * move to explore, click to finish. Touch: drag to explore. Keyboard: arrow
 * keys move, Escape finishes. The large file loads only when asked for.
 *
 * Markup:
 *   <figure class="gc-mat gc-zoom" id="painting" data-gc-zoom
 *           data-zoom-src="/img/treetop-leopard-4000.jpg">
 *     <img src="/img/treetop-leopard-1800.jpg" alt="Treetop Leopard, …" width="1800" height="1005">
 *   </figure>
 *   <button type="button" class="gc-tool" data-gc-zoom-toggle
 *           aria-controls="painting" aria-expanded="false" hidden>Look closely</button>
 */

const MIN_FACTOR = 2;
const MAX_FACTOR = 4;

export function initZoom() {
  for (const fig of document.querySelectorAll('[data-gc-zoom]')) {
    if (fig.dataset.gcBound) continue;
    const img = fig.querySelector('img');
    if (!img || !fig.dataset.zoomSrc) continue;
    fig.dataset.gcBound = '1';
    setup(fig, img);
  }
}

function setup(fig, img) {
  const toggles = fig.id
    ? [...document.querySelectorAll(`[data-gc-zoom-toggle][aria-controls="${fig.id}"]`)]
    : [];
  const title = img.alt || 'the painting';
  let lens = null;
  let hint = null;
  let big = null;
  let pos = { x: 0.5, y: 0.5 };
  let factor = MIN_FACTOR;
  let drag = null;

  img.style.cursor = 'zoom-in';
  for (const t of toggles) t.hidden = false;

  const setExpanded = (v) => toggles.forEach((t) => t.setAttribute('aria-expanded', String(v)));

  const place = () => {
    if (!lens) return;
    lens.style.left = `${img.offsetLeft}px`;
    lens.style.top = `${img.offsetTop}px`;
    lens.style.width = `${img.offsetWidth}px`;
    lens.style.height = `${img.offsetHeight}px`;
    lens.style.right = 'auto';
    lens.style.bottom = 'auto';
    if (big?.naturalWidth) {
      factor = Math.min(MAX_FACTOR, Math.max(MIN_FACTOR, big.naturalWidth / img.offsetWidth));
      lens.style.backgroundSize = `${img.offsetWidth * factor}px ${img.offsetHeight * factor}px`;
    }
    paint();
  };

  const paint = () => {
    if (!lens) return;
    pos.x = Math.min(1, Math.max(0, pos.x));
    pos.y = Math.min(1, Math.max(0, pos.y));
    lens.style.backgroundPosition = `${(pos.x * 100).toFixed(2)}% ${(pos.y * 100).toFixed(2)}%`;
  };

  const start = () => {
    if (lens) return;
    lens = document.createElement('div');
    lens.className = 'gc-zoom-lens';
    lens.tabIndex = 0;
    lens.setAttribute('role', 'img');
    lens.setAttribute('aria-label', `Close-up of ${title}. Use the arrow keys to move around. Press Escape to finish.`);
    hint = document.createElement('p');
    hint.className = 'gc-zoom-hint';
    hint.textContent = 'Loading close-up…';
    fig.append(lens, hint);
    setExpanded(true);
    place();
    lens.focus({ preventScroll: true });

    big = new Image();
    big.decoding = 'async';
    big.onload = () => {
      if (!lens) return;
      lens.style.backgroundImage = `url("${big.src}")`;
      hint.textContent = matchMedia('(pointer: coarse)').matches
        ? 'Drag to explore · tap “Look closely” to finish'
        : 'Move across the painting to explore · click to finish';
      place();
    };
    big.onerror = () => { if (hint) hint.textContent = 'Sorry, the close-up could not be loaded.'; };
    big.src = fig.dataset.zoomSrc;

    lens.addEventListener('pointermove', onMove);
    lens.addEventListener('pointerdown', onDown);
    lens.addEventListener('pointerup', onUp);
    lens.addEventListener('pointercancel', () => { drag = null; });
    lens.addEventListener('keydown', onKey);
    window.addEventListener('resize', place);
  };

  const stop = (returnFocus = true) => {
    if (!lens) return;
    window.removeEventListener('resize', place);
    lens.remove();
    hint.remove();
    lens = hint = null;
    drag = null;
    setExpanded(false);
    if (returnFocus) (toggles[0] || img).focus?.({ preventScroll: true });
  };

  function onMove(e) {
    if (e.pointerType === 'mouse') {
      const r = lens.getBoundingClientRect();
      pos = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
      paint();
    } else if (drag) {
      // Touch / pen: drag the painting under the finger.
      const r = lens.getBoundingClientRect();
      const span = factor - 1 || 1;
      pos.x = drag.pos.x - (e.clientX - drag.x) / (r.width * span);
      pos.y = drag.pos.y - (e.clientY - drag.y) / (r.height * span);
      paint();
    }
  }
  function onDown(e) {
    drag = { x: e.clientX, y: e.clientY, pos: { ...pos }, moved: false };
    if (e.pointerType !== 'mouse') lens.setPointerCapture(e.pointerId);
  }
  function onUp(e) {
    const wasClick = drag && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 6;
    drag = null;
    if (e.pointerType === 'mouse' && wasClick) stop();
  }
  function onKey(e) {
    const step = e.shiftKey ? 0.15 : 0.05;
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[e.key]) {
      e.preventDefault();
      pos.x += moves[e.key][0];
      pos.y += moves[e.key][1];
      paint();
    } else if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      stop();
    }
  }

  img.addEventListener('click', () => start());
  for (const t of toggles) t.addEventListener('click', () => (lens ? stop() : start()));
}
