// Pure rating UI functions — no module-level DOM access.
// Each function receives the DOM elements it needs as explicit parameters,
// making them importable and testable outside a browser environment.

/**
 * @param {HTMLButtonElement} btn
 * @param {'default'|'active'|'dimmed'} state
 */
export function applyBtnState(btn, state) {
  btn.className = btn.dataset[state];
  btn.disabled  = state !== 'default';
}

/**
 * @param {{ up: number, down: number, user_vote: 1|-1|null }} data
 * @param {{ countUp: Element, countDown: Element, ratingsEl: Element,
 *           btnUp: HTMLButtonElement, btnDown: HTMLButtonElement }} els
 */
export function renderRatings({ up, down, user_vote }, { countUp, countDown, ratingsEl, btnUp, btnDown }) {
  countUp.textContent   = up;
  countDown.textContent = down;
  ratingsEl.style.display = 'flex';

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

/**
 * @param {{ countUp: Element, countDown: Element,
 *           btnUp: HTMLButtonElement, btnDown: HTMLButtonElement }} els
 */
export function resetRatingsUI({ countUp, countDown, btnUp, btnDown }) {
  countUp.textContent   = '0';
  countDown.textContent = '0';
  applyBtnState(btnUp,   'default');
  applyBtnState(btnDown, 'default');
}

// ── Format functions (pure, no DOM) ──────────────────────────────────────────

export function formatArtist(m) {
  return m.artist ?? 'Live stream';
}

export function formatTitle(m) {
  if (!m.title) return '';
  return m.date ? `${m.title} (${m.date})` : m.title;
}

export function formatAlbum(m) {
  return m.album ?? '';
}

export function formatSourceQuality(m) {
  if (!m.bit_depth || !m.sample_rate) return '';
  return `Source quality: ${m.bit_depth}-bit ${(m.sample_rate / 1000).toFixed(1)} kHz`;
}
