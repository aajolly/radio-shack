// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  applyBtnState,
  renderRatings,
  resetRatingsUI,
  formatArtist,
  formatTitle,
  formatAlbum,
  formatSourceQuality,
} from '../public/ratings-ui.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeBtn() {
  const btn = document.createElement('button');
  btn.dataset.default = 'cls-default';
  btn.dataset.active  = 'cls-active';
  btn.dataset.dimmed  = 'cls-dimmed';
  btn.className       = 'cls-default';
  return btn;
}

function makeEls() {
  const countUp   = document.createElement('span');
  const countDown = document.createElement('span');
  const ratingsEl = document.createElement('div');
  ratingsEl.style.display = 'none';
  const btnUp   = makeBtn();
  const btnDown = makeBtn();
  return { countUp, countDown, ratingsEl, btnUp, btnDown };
}

// ── applyBtnState ─────────────────────────────────────────────────────────────

describe('applyBtnState', () => {
  it('sets className from the named data-* attribute', () => {
    const btn = makeBtn();
    applyBtnState(btn, 'active');
    expect(btn.className).toBe('cls-active');
  });

  it('disables the button for the active state', () => {
    const btn = makeBtn();
    applyBtnState(btn, 'active');
    expect(btn.disabled).toBe(true);
  });

  it('disables the button for the dimmed state', () => {
    const btn = makeBtn();
    applyBtnState(btn, 'dimmed');
    expect(btn.disabled).toBe(true);
  });

  it('enables the button for the default state', () => {
    const btn = makeBtn();
    btn.disabled = true;
    applyBtnState(btn, 'default');
    expect(btn.disabled).toBe(false);
  });

  it('applies all three states in sequence correctly', () => {
    const btn = makeBtn();
    applyBtnState(btn, 'active');
    expect(btn.className).toBe('cls-active');
    applyBtnState(btn, 'dimmed');
    expect(btn.className).toBe('cls-dimmed');
    applyBtnState(btn, 'default');
    expect(btn.className).toBe('cls-default');
  });
});

// ── renderRatings ─────────────────────────────────────────────────────────────

describe('renderRatings', () => {
  let els;
  beforeEach(() => { els = makeEls(); });

  it('sets the up count', () => {
    renderRatings({ up: 7, down: 0, user_vote: null }, els);
    expect(els.countUp.textContent).toBe('7');
  });

  it('sets the down count', () => {
    renderRatings({ up: 0, down: 3, user_vote: null }, els);
    expect(els.countDown.textContent).toBe('3');
  });

  it('makes the ratings container visible', () => {
    renderRatings({ up: 0, down: 0, user_vote: null }, els);
    expect(els.ratingsEl.style.display).toBe('flex');
  });

  it('activates btnUp and leaves btnDown default when user voted up', () => {
    renderRatings({ up: 1, down: 0, user_vote: 1 }, els);
    expect(els.btnUp.className).toBe('cls-active');
    expect(els.btnUp.disabled).toBe(true);
    expect(els.btnDown.className).toBe('cls-default');
    expect(els.btnDown.disabled).toBe(false);
  });

  it('activates btnDown and leaves btnUp default when user voted down', () => {
    renderRatings({ up: 0, down: 1, user_vote: -1 }, els);
    expect(els.btnDown.className).toBe('cls-active');
    expect(els.btnDown.disabled).toBe(true);
    expect(els.btnUp.className).toBe('cls-default');
    expect(els.btnUp.disabled).toBe(false);
  });

  it('leaves both buttons enabled when user has not voted', () => {
    renderRatings({ up: 5, down: 2, user_vote: null }, els);
    expect(els.btnUp.className).toBe('cls-default');
    expect(els.btnDown.className).toBe('cls-default');
    expect(els.btnUp.disabled).toBe(false);
    expect(els.btnDown.disabled).toBe(false);
  });

  it('switches from voted-up to voted-down correctly', () => {
    renderRatings({ up: 1, down: 0, user_vote: 1  }, els);
    renderRatings({ up: 0, down: 1, user_vote: -1 }, els);
    expect(els.btnDown.className).toBe('cls-active');
    expect(els.btnUp.className).toBe('cls-default');
  });
});

// ── resetRatingsUI ────────────────────────────────────────────────────────────

describe('resetRatingsUI', () => {
  it('resets the up count to zero', () => {
    const els = makeEls();
    els.countUp.textContent = '99';
    resetRatingsUI(els);
    expect(els.countUp.textContent).toBe('0');
  });

  it('resets the down count to zero', () => {
    const els = makeEls();
    els.countDown.textContent = '42';
    resetRatingsUI(els);
    expect(els.countDown.textContent).toBe('0');
  });

  it('resets btnUp to default state', () => {
    const els = makeEls();
    applyBtnState(els.btnUp, 'active');
    resetRatingsUI(els);
    expect(els.btnUp.className).toBe('cls-default');
    expect(els.btnUp.disabled).toBe(false);
  });

  it('resets btnDown to default state', () => {
    const els = makeEls();
    applyBtnState(els.btnDown, 'dimmed');
    resetRatingsUI(els);
    expect(els.btnDown.className).toBe('cls-default');
    expect(els.btnDown.disabled).toBe(false);
  });
});

// ── Format functions ──────────────────────────────────────────────────────────

describe('formatArtist', () => {
  it('returns the artist name when present', () =>
    expect(formatArtist({ artist: 'Shandi Sinnamon' })).toBe('Shandi Sinnamon'));
  it('falls back to "Live stream" when artist is absent', () =>
    expect(formatArtist({})).toBe('Live stream'));
  it('falls back to "Live stream" when artist is null', () =>
    expect(formatArtist({ artist: null })).toBe('Live stream'));
});

describe('formatTitle', () => {
  it('appends the year in parentheses when date is present', () =>
    expect(formatTitle({ title: "He's A Dream", date: '1983' })).toBe("He's A Dream (1983)"));
  it('returns just the title when date is absent', () =>
    expect(formatTitle({ title: 'Cocaine' })).toBe('Cocaine'));
  it('returns an empty string when title is absent', () =>
    expect(formatTitle({})).toBe(''));
  it('returns an empty string when title is null', () =>
    expect(formatTitle({ title: null })).toBe(''));
});

describe('formatAlbum', () => {
  it('returns the album name when present', () =>
    expect(formatAlbum({ album: 'Flashdance OST' })).toBe('Flashdance OST'));
  it('returns an empty string when album is absent', () =>
    expect(formatAlbum({})).toBe(''));
});

describe('formatSourceQuality', () => {
  it('formats bit depth and sample rate correctly', () =>
    expect(formatSourceQuality({ bit_depth: 16, sample_rate: 44100 }))
      .toBe('Source quality: 16-bit 44.1 kHz'));
  it('handles 24-bit hi-res values', () =>
    expect(formatSourceQuality({ bit_depth: 24, sample_rate: 96000 }))
      .toBe('Source quality: 24-bit 96.0 kHz'));
  it('returns an empty string when bit_depth is missing', () =>
    expect(formatSourceQuality({ sample_rate: 44100 })).toBe(''));
  it('returns an empty string when sample_rate is missing', () =>
    expect(formatSourceQuality({ bit_depth: 16 })).toBe(''));
  it('returns an empty string for an empty metadata object', () =>
    expect(formatSourceQuality({})).toBe(''));
});
