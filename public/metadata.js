const META_URL  = 'https://d3d4yli4hf5bmh.cloudfront.net/metadatav2.json';
const COVER_URL = 'https://d3d4yli4hf5bmh.cloudfront.net/cover.jpg';
const POLL_MS   = 20000;

const artistEl       = document.getElementById('np-artist');
const titleEl        = document.getElementById('np-title');
const albumEl        = document.getElementById('np-album');
const yearEl         = document.getElementById('np-year');
const qualSrcEl      = document.getElementById('np-quality-source');
const qualStreamEl   = document.getElementById('np-quality-stream');
const coverEl        = document.getElementById('np-cover');
const recentEl       = document.getElementById('recent');
const ratingsEl      = document.getElementById('np-ratings');
const btnUp          = document.getElementById('btn-up');
const btnDown        = document.getElementById('btn-down');
const countUp        = document.getElementById('count-up');
const countDown      = document.getElementById('count-down');

let abort        = null;
let timer        = null;
let lastTrackKey = '';

// ── Cover art ─────────────────────────────────────────────────────────────────

coverEl.addEventListener('error', () => {
  coverEl.removeAttribute('src');
  lastTrackKey = '';
});

function updateCover(m) {
  const key = `${m.artist ?? ''}|${m.title ?? ''}`;
  if (key === lastTrackKey) return;
  lastTrackKey = key;
  coverEl.src = `${COVER_URL}?v=${encodeURIComponent(key)}`;
  coverEl.alt = m.album ? `Album cover: ${m.album}` : m.title ? `Cover: ${m.title}` : '';
  if (m.date) {
    yearEl.textContent = m.date;
    yearEl.classList.remove('hidden');
  } else {
    yearEl.classList.add('hidden');
  }
  resetRatingsUI();
}

// ── Ratings ───────────────────────────────────────────────────────────────────

function applyBtnState(btn, state) {
  btn.className = btn.dataset[state];
  btn.disabled  = state !== 'default';
}

function resetRatingsUI() {
  countUp.textContent   = '0';
  countDown.textContent = '0';
  applyBtnState(btnUp,   'default');
  applyBtnState(btnDown, 'default');
  btnUp.onclick   = () => submitRating(1);
  btnDown.onclick = () => submitRating(-1);
}

function renderRatings({ up, down, user_vote }) {
  countUp.textContent   = up;
  countDown.textContent = down;
  ratingsEl.style.display = 'flex';

  btnUp.onclick   = () => submitRating(1);
  btnDown.onclick = () => submitRating(-1);

  if (user_vote === 1) {
    applyBtnState(btnUp,   'active');
    applyBtnState(btnDown, 'default');
  } else if (user_vote === -1) {
    applyBtnState(btnUp,   'default');
    applyBtnState(btnDown, 'active');
  } else {
    applyBtnState(btnUp,   'default');
    applyBtnState(btnDown, 'default');
  }
}

async function fetchRatings() {
  if (!lastTrackKey) return;
  const res = await fetch(`/api/ratings?track_key=${encodeURIComponent(lastTrackKey)}`);
  if (res.ok) renderRatings(await res.json());
}

async function submitRating(rating) {
  applyBtnState(btnUp,   'dimmed');
  applyBtnState(btnDown, 'dimmed');
  const res = await fetch('/api/ratings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ track_key: lastTrackKey, rating }),
  });
  const data = await res.json().catch(() => null);
  if (data) renderRatings(data);
}

// ── Metadata ──────────────────────────────────────────────────────────────────

function renderMeta(m) {
  artistEl.textContent = m.artist ?? 'Live stream';
  titleEl.textContent  = m.title
    ? (m.date ? `${m.title} (${m.date})` : m.title)
    : '';
  albumEl.textContent = m.album ?? '';
  qualSrcEl.textContent = m.bit_depth && m.sample_rate
    ? `Source quality: ${m.bit_depth}-bit ${(m.sample_rate / 1000).toFixed(1)} kHz`
    : '';
  qualStreamEl.textContent = 'Stream quality: FLAC / HiFi Lossless';
}

// ── Recently played ───────────────────────────────────────────────────────────

function extractRecent(m) {
  const out = [];
  for (let i = 1; i <= 5; i++) {
    const artist = m[`prev_artist_${i}`];
    const title  = m[`prev_title_${i}`];
    if (artist || title) out.push({ artist, title });
  }
  return out;
}

function renderRecent(items) {
  recentEl.innerHTML = '';
  for (const it of items) {
    const li     = document.createElement('li');
    li.className = 'text-sm';
    const artist = document.createElement('span');
    artist.className   = 'text-charcoal/60 dark:text-cream/60';
    artist.textContent = it.artist ?? '';
    const sep    = document.createElement('span');
    sep.className   = 'text-charcoal/30 dark:text-cream/30 mx-1.5';
    sep.textContent = '—';
    const title  = document.createElement('span');
    title.className   = 'text-charcoal/80 dark:text-cream/80';
    title.textContent = it.title ?? '';
    li.append(artist, sep, title);
    recentEl.appendChild(li);
  }
}

// ── Poll loop ─────────────────────────────────────────────────────────────────

async function fetchOnce() {
  abort?.abort();
  abort = new AbortController();
  try {
    const res = await fetch(META_URL, { cache: 'no-store', signal: abort.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const m = await res.json();
    renderMeta(m);
    updateCover(m);
    await fetchRatings();
    renderRecent(extractRecent(m));
  } catch (e) {
    if (e.name !== 'AbortError') console.warn('metadata fetch failed:', e);
  }
}

function start() {
  fetchOnce();
  timer = setInterval(fetchOnce, POLL_MS);
}

function stop() {
  if (timer) { clearInterval(timer); timer = null; }
  abort?.abort();
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) stop();
  else if (!timer) start();
});

start();
