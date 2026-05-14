import express from 'express';
import morgan from 'morgan';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { openDb, initSchema, seedIfEmpty } from './db/init.js';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const PORT       = Number(process.env.PORT) || 3000;
const VOTER_SALT = process.env.VOTER_SALT || 'radio-shack-dev';

// Derive a stable, opaque voter ID from the request — no client storage needed.
// Behind a reverse proxy, set `trust proxy` and VOTER_SALT in the environment.
function getVoterId(req) {
  const ip = req.ip ?? req.socket?.remoteAddress ?? 'unknown';
  const ua = req.headers['user-agent'] ?? '';
  return createHash('sha256').update(`${VOTER_SALT}|${ip}|${ua}`).digest('hex').slice(0, 32);
}

const db = openDb();
initSchema(db);
seedIfEmpty(db);

const stmtRatingCounts = db.prepare(`
  SELECT
    COALESCE(SUM(CASE WHEN rating =  1 THEN 1 ELSE 0 END), 0) AS up,
    COALESCE(SUM(CASE WHEN rating = -1 THEN 1 ELSE 0 END), 0) AS down
  FROM ratings WHERE track_key = ?
`);
const stmtUserVote    = db.prepare('SELECT rating FROM ratings WHERE track_key = ? AND voter_id = ?');
const stmtUpsertRating = db.prepare(`
  INSERT INTO ratings (track_key, voter_id, rating) VALUES (?, ?, ?)
  ON CONFLICT(track_key, voter_id) DO UPDATE SET rating = excluded.rating
`);

const app = express();
app.use(morgan('dev'));
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.get('/api/stations', (_req, res) => {
  const rows = db.prepare('SELECT * FROM stations ORDER BY id').all();
  res.json(rows);
});

app.get('/api/stations/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM stations WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'not found' });
  res.json(row);
});

app.post('/api/stations', (req, res) => {
  const { name, stream_url, genre } = req.body ?? {};
  if (!name || !stream_url) {
    return res.status(400).json({ error: 'name and stream_url are required' });
  }
  const info = db
    .prepare('INSERT INTO stations (name, stream_url, genre) VALUES (?, ?, ?)')
    .run(name, stream_url, genre ?? null);
  const row = db.prepare('SELECT * FROM stations WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(row);
});

app.get('/api/ratings', (req, res) => {
  const { track_key } = req.query;
  if (!track_key) return res.status(400).json({ error: 'track_key required' });
  const voterId = getVoterId(req);
  const counts  = stmtRatingCounts.get(track_key);
  const userRow = stmtUserVote.get(track_key, voterId);
  res.json({ ...counts, user_vote: userRow?.rating ?? null });
});

app.post('/api/ratings', (req, res) => {
  const { track_key, rating } = req.body ?? {};
  if (!track_key) return res.status(400).json({ error: 'track_key required' });
  if (rating !== 1 && rating !== -1)
    return res.status(400).json({ error: 'rating must be 1 or -1' });
  const voterId = getVoterId(req);
  stmtUpsertRating.run(track_key, voterId, rating);
  const counts = stmtRatingCounts.get(track_key);
  res.json({ ...counts, user_vote: rating });
});

app.delete('/api/stations/:id', (req, res) => {
  const info = db.prepare('DELETE FROM stations WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'not found' });
  res.status(204).end();
});

app.listen(PORT, () => {
  console.log(`radio-shack listening on http://localhost:${PORT}`);
});
