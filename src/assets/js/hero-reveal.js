/**
 * Homepage hero — "See what I painted here".
 *
 * The winter location photo stays fixed. Each click on the button hangs a
 * random landscape Tom Thomson painting on the wall (pool from
 * #gc-hero-reveal-pool). Portrait files are excluded at build time.
 *
 * Markup (works without JS: photo + heading show, button stays hidden):
 *
 *   <script type="application/json" id="gc-hero-reveal-pool">[…]</script>
 *   <div class="gc-hero" data-gc-hero …>
 *     <figure class="gc-hero-frame" style="aspect-ratio: 2 / 1">
 *       <img class="gc-hero-photo" …>
 *       <div class="gc-hero-painting" hidden>
 *         <img data-src="…" width="…" height="…" alt="…">
 *         <p class="gc-hero-caption"><a href="…">[Title]</a> · painted here</p>
 *       </div>
 *       <button type="button" class="gc-hero-btn" data-gc-hero-toggle hidden
 *               data-label-photo="See what I painted here"
 *               data-label-painting="Back to the photo"><span class="gc-btn-label">See what I painted here</span></button>
 *     </figure>
 *     <h1 class="gc-hero-title">Hello, I am<br> Gene Canning…</h1>
 *   </div>
 */

export function initHeroReveal() {
  for (const hero of document.querySelectorAll('[data-gc-hero]')) {
    if (hero.dataset.gcBound) continue;
    const btn = hero.querySelector('[data-gc-hero-toggle]');
    const layer = hero.querySelector('.gc-hero-painting');
    const photo = hero.querySelector('.gc-hero-photo');
    if (!btn || !layer) continue;
    hero.dataset.gcBound = '1';
    setup(hero, btn, layer, photo);
  }
}

function readPool() {
  const el = document.getElementById('gc-hero-reveal-pool');
  if (!el) return [];
  try {
    const list = JSON.parse(el.textContent);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function applyPainting(layer, painting) {
  if (!painting || !layer) return;
  const art = layer.querySelector('img');
  if (art) {
    art.removeAttribute('src');
    art.removeAttribute('srcset');
    art.dataset.src = painting.src;
    art.width = painting.w;
    art.height = painting.h;
    art.alt = painting.alt || '';
  }
  const cap = layer.querySelector('.gc-hero-caption a');
  if (cap) {
    cap.href = painting.href;
    cap.textContent = painting.title;
  }
}

function pickPainting(pool, lastSrc) {
  if (!pool.length) return null;
  if (pool.length === 1) return pool[0];
  const others = pool.filter((p) => p.src !== lastSrc);
  const list = others.length ? others : pool;
  return list[Math.floor(Math.random() * list.length)];
}

function setup(hero, btn, layer, photo) {
  const art = layer.querySelector('img');
  const labels = {
    photo: btn.dataset.labelPhoto || btn.textContent.trim(),
    el: btn.querySelector('.gc-btn-label') || btn,
    painting: btn.dataset.labelPainting || 'Back to the photo',
  };
  const pool = readPool();
  let lastSrc = art?.dataset?.src || '';
  let ready = null;

  const canMask = CSS.supports('mask-image', 'url("x.svg")') || CSS.supports('-webkit-mask-image', 'url("x.svg")');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const useBrush = () => hero.classList.toggle('gc-brush', canMask && !motion.matches);
  useBrush();
  motion.addEventListener?.('change', useBrush);

  layer.hidden = false;
  layer.inert = true;
  layer.setAttribute('aria-hidden', 'true');
  btn.hidden = false;
  btn.setAttribute('aria-pressed', 'false');

  const loadChosen = () => {
    if (!art || !art.dataset.src) return Promise.resolve();
    if (art.src && art.getAttribute('src') === art.dataset.src && art.complete) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const done = () => {
        art.removeEventListener('load', done);
        art.removeEventListener('error', done);
        resolve();
      };
      art.addEventListener('load', done);
      art.addEventListener('error', done);
      art.src = art.dataset.src;
    });
  };

  const choose = () => {
    const painting = pickPainting(pool, lastSrc);
    if (painting) {
      applyPainting(layer, painting);
      lastSrc = painting.src;
    }
    ready = loadChosen();
    return ready;
  };

  // Prefetch a random painting on first interest so the reveal isn't empty.
  const prefetch = () => { choose(); };
  btn.addEventListener('pointerenter', prefetch, { once: true });
  btn.addEventListener('focus', prefetch, { once: true });

  const set = (painted) => {
    hero.classList.toggle('is-painted', painted);
    btn.setAttribute('aria-pressed', String(painted));
    labels.el.textContent = painted ? labels.painting : labels.photo;
    layer.inert = !painted;
    layer.setAttribute('aria-hidden', String(!painted));
    if (photo) photo.setAttribute('aria-hidden', String(painted));
  };

  btn.addEventListener('click', async () => {
    const painted = !hero.classList.contains('is-painted');
    if (!painted) {
      set(false);
      return;
    }

    // New landscape painting each time the visitor asks to see one.
    btn.setAttribute('aria-busy', 'true');
    try {
      await choose();
    } finally {
      btn.removeAttribute('aria-busy');
    }
    set(true);
  });
}
