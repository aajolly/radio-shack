# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Tailwind watch + nodemon (two prefixed log streams: [css] and [srv])
npm start          # css:build then node server.js (one-shot, no reload)
npm run css:build  # Compile src/input.css → public/style.css (minified)
npm run css:watch  # Tailwind watch mode only
npm run db:init    # Drop and recreate DB schema, insert seed stations
```

**Node requirement:** >= 22.5 (uses the built-in `node:sqlite` module). Run `nvm use` if needed — `.nvmrc` pins `lts/*`.

**Assume the server is already running.** Do not start it in the foreground — that blocks. If a restart is truly necessary use `run_in_background: true`, then verify with `curl http://localhost:3000/api/health`.

## Architecture

### Request path

```
Browser → Express (server.js) → node:sqlite (db/data.db)
                ↓
          /public/* served statically
```

The frontend is plain HTML + three vanilla JS modules (`player.js`, `metadata.js`, `app.js`) — no bundler. Tailwind is compiled separately by the CLI.

### server.js

Single-file Express app. All SQLite statements are prepared once at startup (after `initSchema`/`seedIfEmpty`) and reused across requests.

**Voter identity** — `getVoterId(req)` returns `SHA-256(VOTER_SALT | ip | user-agent).slice(0, 32)`. Never stored client-side. Set `VOTER_SALT` env var in production; defaults to `'radio-shack-dev'`. Behind a reverse proxy add `app.set('trust proxy', 1)`.

**Routes:**

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/health` | |
| GET/POST/DELETE | `/api/stations[/:id]` | `POST` requires `name` + `stream_url` |
| GET | `/api/ratings?track_key=` | returns `{up, down, user_vote}` |
| POST | `/api/ratings` | body `{track_key, rating: 1\|-1}`; upserts via `ON CONFLICT DO UPDATE` |

### Database (db/init.js)

`node:sqlite` (built-in, no native compile). Two tables:

- **stations** — `id, name, stream_url, genre, created_at`
- **ratings** — `id, track_key, voter_id, rating (1|-1), created_at`; `UNIQUE(track_key, voter_id)` enforces one vote per identity per track. Upsert allows vote changes.

`initSchema` uses `CREATE TABLE IF NOT EXISTS` so it is safe to call on every server start without wiping data. Only `db:init` (which calls `seedIfEmpty`) resets the seed rows.

### Frontend JS — DOM ownership

Each file owns a distinct set of element IDs; they do not share references.

| File | IDs owned | Responsibility |
|------|-----------|----------------|
| `player.js` | `#player`, `#np-status` | HLS playback via hls.js; pins to FLAC level; recovers on errors |
| `metadata.js` | `#np-artist/title/album/year/quality-source/quality-stream`, `#np-cover`, `#np-ratings`, `#btn-up/down`, `#count-up/down`, `#recent` | Polls `metadatav2.json` every 20 s; pauses when tab hidden; fetches/submits ratings |
| `app.js` | `#stations`, `#add-form` | Station list CRUD |

**Metadata polling** — `track_key = "${artist}|${title}"` is the cache key for cover art (`?v={key}`) and the rating lookup. On track change: cover updates, year badge shows/hides, ratings reset and re-fetch.

**Rating button states** — `data-default / data-active / data-dimmed` HTML attributes hold the full Tailwind class strings; `applyBtnState(btn, state)` swaps `btn.className` from those attributes. Tailwind scans these attributes at build time, so all classes are included in the output.

### Styling (Tailwind v4 + brand theme)

`src/input.css` is the only source file; `public/style.css` is generated (gitignored).

Custom tokens defined in `@theme`:

| Token | Value | Usage |
|-------|-------|-------|
| `--color-mint` | `#D8F2D5` | Track bg (light), previous-tracks section, hover fills |
| `--color-forest` | `#1F4E23` | Primary button bg, headings, borders |
| `--color-teal` | `#38A29D` | Primary button hover, form focus ring |
| `--color-charcoal` | `#231F20` | Body text (light), page bg (dark) |
| `--color-cream` | `#F5EADA` | Footer bg (light), body text (dark) |
| `--font-heading` | Montserrat | All `font-heading` elements |
| `--font-body` | Open Sans | Default body font |

**Dark mode** — class-based via `@custom-variant dark (&:where(.dark, .dark *))`. The `.dark` class is toggled on `<html>` by the theme slider. An anti-flash inline `<script>` in `<head>` applies the saved preference from `localStorage.theme` before first paint. The slider checkbox (`#theme-toggle`) state is synced to the DOM class on load.

**`.brand-input`** — component-layer class for all form inputs; includes the teal focus glow from the style guide. Dark-mode override lives in `:where(.dark) .brand-input` inside the same `@layer components` block.

### External dependencies (runtime, no server involvement)

- `hls.js` — loaded from jsDelivr CDN in `index.html`
- Google Fonts (Montserrat + Open Sans) — loaded via `<link>` in `<head>`
- Metadata + cover art — polled directly from `https://d3d4yli4hf5bmh.cloudfront.net` (CORS `*` is set upstream)
