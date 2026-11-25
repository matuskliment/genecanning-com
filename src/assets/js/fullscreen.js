/**
 * "See it full screen" — the painting only, across the window.
 * This stays an overlay on the page. It does not use the browser's
 * full-screen mode, so closing it does not flash the window.
 * Escape, Leave full screen, or a click on the picture returns to the page.
 *
 *   <figure id="painting" data-gc-fullscreen>…</figure>
 *   <button type="button" class="gc-tool" data-gc-fullscreen-toggle
 *           aria-controls="painting" aria-expanded="false" hidden>See it full screen</button>
 */

import { reducedMotion } from './motion-utils.js';

const FADE_MS = 200;

export function initFullscreen() {
  for (const fig of document.querySelectorAll('[data-gc-fullscreen]')) {
    if (fig.dataset.gcFsBound) continue;
    fig.dataset.gcFsBound = '1';
    setup(fig);
  }
}

function setup(fig) {
  const toggles = fig.id
    ? [...document.querySelectorAll(`[data-gc-fullscreen-toggle][aria-controls="${fig.id}"]`)]
    : [];
  if (!toggles.length) return;
  for (const t of toggles) t.hidden = false;

  const exit = document.createElement('button');
  exit.type = 'button';
  exit.className = 'gc-tool gc-fs-exit';
  exit.textContent = 'Leave full screen';
  exit.hidden = true;
  fig.append(exit);

  let closing = false;
  const isOn = () => fig.classList.contains('gc-fs-cover');

  const sync = () => {
    const on = isOn();
    for (const t of toggles) {
      t.setAttribute('aria-expanded', String(on));
      t.textContent = on ? 'Leave full screen' : 'See it full screen';
    }
    exit.hidden = !on;
  };

  const enter = () => {
    if (isOn() || closing) return;
    fig.classList.add('gc-fs-cover');
    document.documentElement.classList.add('gc-fs-lock');
    if (!reducedMotion()) fig.classList.add('gc-fs-fading');
    sync();
    exit.focus();
    if (reducedMotion()) return;
    // Paint at opacity 0, then fade in.
    void fig.offsetWidth;
    fig.classList.remove('gc-fs-fading');
  };

  const finishLeave = () => {
    if (!isOn() && !closing) return;
    closing = false;
    fig.classList.remove('gc-fs-cover', 'gc-fs-fading');
    document.documentElement.classList.remove('gc-fs-lock');
    sync();
    toggles[0]?.focus();
  };

  const leave = () => {
    if (!isOn() || closing) return;
    if (reducedMotion()) {
      finishLeave();
      return;
    }
    closing = true;
    fig.classList.add('gc-fs-fading');
    let settled = false;
    const done = (event) => {
      if (settled) return;
      if (event && event.target !== fig) return;
      if (event && event.propertyName && event.propertyName !== 'opacity') return;
      settled = true;
      fig.removeEventListener('transitionend', done);
      finishLeave();
    };
    fig.addEventListener('transitionend', done);
    window.setTimeout(done, FADE_MS + 60);
  };

  const toggle = () => (isOn() ? leave() : enter());
  for (const t of toggles) t.addEventListener('click', toggle);
  const img = fig.querySelector('img');
  if (img) {
    img.style.cursor = 'pointer';
    img.addEventListener('click', toggle);
  }
  exit.addEventListener('click', (e) => {
    e.stopPropagation();
    leave();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOn()) {
      e.preventDefault();
      leave();
    }
  });
}
