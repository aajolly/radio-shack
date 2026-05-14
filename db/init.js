import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const DB_PATH = join(__dirname, 'data.db');

export function openDb() {
  const db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  return db;
}

export function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS stations (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      stream_url  TEXT    NOT NULL,
      genre       TEXT,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS ratings (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      track_key   TEXT    NOT NULL,
      voter_id    TEXT    NOT NULL,
      rating      INTEGER NOT NULL CHECK (rating IN (1, -1)),
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE (track_key, voter_id)
    );
  `);
}

export function seedIfEmpty(db) {
  const { count } = db.prepare('SELECT COUNT(*) AS count FROM stations').get();
  if (count > 0) return 0;
  const insert = db.prepare(
    'INSERT INTO stations (name, stream_url, genre) VALUES (?, ?, ?)'
  );
  const rows = [
    ['SomaFM Groove Salad', 'https://ice1.somafm.com/groovesalad-128-mp3', 'ambient'],
    ['SomaFM Drone Zone',   'https://ice1.somafm.com/dronezone-128-mp3',   'ambient'],
    ['BBC Radio 6 Music',   'http://stream.live.vc.bbcmedia.co.uk/bbc_6music', 'alternative'],
  ];
  for (const r of rows) insert.run(...r);
  return rows.length;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const db = openDb();
  initSchema(db);
  const seeded = seedIfEmpty(db);
  console.log(`Schema ready at ${DB_PATH}`);
  if (seeded) console.log(`Seeded ${seeded} stations.`);
  db.close();
}
