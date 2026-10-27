/**
 * "Hear Gene tell it" — a large, simple player for a short recording.
 * Never autoplays. Only one recording plays at a time.
 *
 * Markup (works as a native player without JS):
 *   <figure class="gc-audio" data-gc-audio data-duration-label="About a minute">
 *     <audio controls preload="none" src="/audio/treetop-leopard.mp3"></audio>
 *     <figcaption>Hear Gene tell the story of this painting</figcaption>
 *   </figure>
 *
 * Provide an MP3 (AAC .m4a also fine). Add a transcript link next to the
 * player for visitors who can't listen (WCAG 1.2.1).
 */

const ICON_PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>';
const ICON_PAUSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor"/></svg>';

const players = new Set();

const fmt = (s) => {
  if (!Number.isFinite(s)) return '–:––';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
};

export function initAudio() {
  for (const fig of document.querySelectorAll('[data-gc-audio]')) {
    if (fig.dataset.gcBound) continue;
    const audio = fig.querySelector('audio');
    if (!audio) continue;
    fig.dataset.gcBound = '1';
    enhance(fig, audio);
  }
}

function enhance(fig, audio) {
  const caption = fig.querySelector('figcaption');
  const title = caption?.textContent.trim() || 'Hear Gene tell the story';
  const durationLabel = fig.dataset.durationLabel || '';

  audio.controls = false;
  audio.hidden = true;
  audio.preload = 'none';
  players.add(audio);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'gc-audio-play';

  const body = document.createElement('div');
  body.className = 'gc-audio-body';
  if (caption) {
    caption.classList.add('gc-audio-title');
    body.append(caption);
  }
  const seek = document.createElement('input');
  seek.type = 'range';
  seek.className = 'gc-audio-seek';
  seek.min = '0';
  seek.max = '1000';
  seek.step = '1';
  seek.value = '0';
  seek.setAttribute('aria-label', `Position in “${title}”`);
  const time = document.createElement('p');
  time.className = 'gc-audio-time';
  body.append(seek, time);
  fig.prepend(btn);
  fig.append(body);

  const render = () => {
    const playing = !audio.paused && !audio.ended;
    btn.innerHTML = playing ? ICON_PAUSE : ICON_PLAY;
    btn.setAttribute('aria-label', `${playing ? 'Pause' : 'Play'}: ${title}`);
    const d = audio.duration;
    if (Number.isFinite(d) && d > 0) {
      time.textContent = `${fmt(audio.currentTime)} / ${fmt(d)}`;
      if (document.activeElement !== seek) seek.value = String(Math.round((audio.currentTime / d) * 1000));
      seek.setAttribute('aria-valuetext', `${fmt(audio.currentTime)} of ${fmt(d)}`);
    } else {
      time.textContent = durationLabel || 'Tap play to listen';
    }
  };

  btn.addEventListener('click', () => {
    if (audio.paused || audio.ended) {
      for (const other of players) if (other !== audio) other.pause();
      audio.play().catch(() => {
        time.textContent = 'Sorry, the recording could not be played.';
      });
    } else {
      audio.pause();
    }
  });

  seek.addEventListener('input', () => {
    const d = audio.duration;
    if (Number.isFinite(d) && d > 0) audio.currentTime = (Number(seek.value) / 1000) * d;
  });

  for (const ev of ['play', 'pause', 'ended', 'timeupdate', 'loadedmetadata', 'durationchange']) {
    audio.addEventListener(ev, render);
  }
  audio.addEventListener('ended', () => { audio.currentTime = 0; render(); });
  render();
}
