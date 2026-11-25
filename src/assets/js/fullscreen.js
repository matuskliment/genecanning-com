/**
 * "See it full screen" — the painting only, across the screen.
 * Escape, or Leave full screen, returns to the painting page.
 * If the browser will not go truly full screen, the picture covers the window instead.
 *
 *   <figure id="painting" data-gc-fullscreen>…</figure>
 *   <button type="button" class="gc-tool" data-gc-fullscreen-toggle
 *           aria-controls="painting" aria-expanded="false" hidden>See it full screen</button>
 */

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

  const nativeEl = () => document.fullscreenElement || document.webkitFullscreenElement;
  const isOn = () => nativeEl() === fig || fig.classList.contains('gc-fs-cover');

  const sync = () => {
    const on = isOn();
    for (const t of toggles) {
      t.setAttribute('aria-expanded', String(on));
      t.textContent = on ? 'Leave full screen' : 'See it full screen';
    }
    exit.hidden = !on;
  };

  const enter = async () => {
    const req = fig.requestFullscreen || fig.webkitRequestFullscreen;
    if (req) {
      try {
        await req.call(fig);
        return;
      } catch {
        /* Fall through to the in-page cover. */
      }
    }
    fig.classList.add('gc-fs-cover');
    document.documentElement.classList.add('gc-fs-lock');
    sync();
  };

  const leave = async () => {
    if (nativeEl() === fig) {
      const exitFs = document.exitFullscreen || document.webkitExitFullscreen;
      if (exitFs) {
        try { await exitFs.call(document); } catch { /* already closed */ }
      }
    }
    fig.classList.remove('gc-fs-cover');
    document.documentElement.classList.remove('gc-fs-lock');
    sync();
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
  document.addEventListener('fullscreenchange', sync);
  document.addEventListener('webkitfullscreenchange', sync);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && fig.classList.contains('gc-fs-cover')) leave();
  });
}
