import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import request from 'supertest';
import { createApp, getVoterId } from '../server.js';
import { initSchema } from '../db/init.js';

// ── getVoterId ────────────────────────────────────────────────────────────────

describe('getVoterId', () => {
  const makeReq = (ip, ua) => ({
    ip,
    socket: { remoteAddress: ip },
    headers: { 'user-agent': ua },
  });

  it('returns a 32-character lowercase hex string', () => {
    const id = getVoterId(makeReq('1.2.3.4', 'TestBrowser'));
    expect(id).toMatch(/^[0-9a-f]{32}$/);
  });

  it('is deterministic for the same IP and User-Agent', () => {
    const req = makeReq('1.2.3.4', 'TestBrowser');
    expect(getVoterId(req)).toBe(getVoterId(req));
  });

  it('differs for different IP addresses', () => {
    expect(getVoterId(makeReq('1.2.3.4', 'Browser'))).not.toBe(
      getVoterId(makeReq('5.6.7.8', 'Browser'))
    );
  });

  it('differs for different User-Agents', () => {
    expect(getVoterId(makeReq('1.2.3.4', 'Chrome'))).not.toBe(
      getVoterId(makeReq('1.2.3.4', 'Firefox'))
    );
  });

  it('handles a missing User-Agent header gracefully', () => {
    const req = { ip: '1.2.3.4', socket: {}, headers: {} };
    expect(() => getVoterId(req)).not.toThrow();
    expect(getVoterId(req)).toMatch(/^[0-9a-f]{32}$/);
  });
});

// ── Shared test DB setup ──────────────────────────────────────────────────────

function makeTestContext() {
  const db  = new DatabaseSync(':memory:');
  initSchema(db);
  const app = createApp(db);
  return { db, app };
}

// ── GET /api/ratings ──────────────────────────────────────────────────────────

describe('GET /api/ratings', () => {
  let ctx;
  beforeEach(() => { ctx = makeTestContext(); });
  afterEach(()  => { ctx.db.close(); });

  it('returns 400 when track_key is missing', async () => {
    const res = await request(ctx.app).get('/api/ratings');
    expect(res.status).toBe(400);
  });

  it('returns zero counts and null user_vote for an unknown track', async () => {
    const res = await request(ctx.app).get('/api/ratings?track_key=nobody%7Cnothing');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ up: 0, down: 0, user_vote: null });
  });

  it('reflects votes that were seeded directly in the DB', async () => {
    ctx.db.prepare('INSERT INTO ratings (track_key, voter_id, rating) VALUES (?, ?, ?)').run('a|b', 'v1', 1);
    ctx.db.prepare('INSERT INTO ratings (track_key, voter_id, rating) VALUES (?, ?, ?)').run('a|b', 'v2', -1);
    const res = await request(ctx.app).get('/api/ratings?track_key=a%7Cb');
    expect(res.body).toMatchObject({ up: 1, down: 1 });
  });

  it('returns user_vote for the requesting client after they voted', async () => {
    // POST first to register the vote under the client's derived voter_id
    await request(ctx.app)
      .post('/api/ratings')
      .set('User-Agent', 'SameClient')
      .send({ track_key: 'a|b', rating: 1 });

    // Same UA → same voter_id → should get user_vote back
    const res = await request(ctx.app)
      .get('/api/ratings?track_key=a%7Cb')
      .set('User-Agent', 'SameClient');
    expect(res.body.user_vote).toBe(1);
  });

  it('returns null user_vote for a different client', async () => {
    ctx.db.prepare('INSERT INTO ratings (track_key, voter_id, rating) VALUES (?, ?, ?)').run('a|b', 'someone-else', 1);
    const res = await request(ctx.app)
      .get('/api/ratings?track_key=a%7Cb')
      .set('User-Agent', 'DifferentClient');
    expect(res.body.user_vote).toBeNull();
  });
});

// ── POST /api/ratings ─────────────────────────────────────────────────────────

describe('POST /api/ratings', () => {
  let ctx;
  beforeEach(() => { ctx = makeTestContext(); });
  afterEach(()  => { ctx.db.close(); });

  it('returns 400 when track_key is missing', async () => {
    const res = await request(ctx.app).post('/api/ratings').send({ rating: 1 });
    expect(res.status).toBe(400);
  });

  it('returns 400 for an invalid rating value', async () => {
    const res = await request(ctx.app).post('/api/ratings').send({ track_key: 'a|b', rating: 99 });
    expect(res.status).toBe(400);
  });

  it('records a thumbs-up and returns updated counts', async () => {
    const res = await request(ctx.app).post('/api/ratings').send({ track_key: 'a|b', rating: 1 });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ up: 1, down: 0, user_vote: 1 });
  });

  it('records a thumbs-down and returns updated counts', async () => {
    const res = await request(ctx.app).post('/api/ratings').send({ track_key: 'a|b', rating: -1 });
    expect(res.body).toMatchObject({ up: 0, down: 1, user_vote: -1 });
  });

  it('allows changing a vote from up to down', async () => {
    const ua = 'VoteChanger';
    await request(ctx.app).post('/api/ratings').set('User-Agent', ua).send({ track_key: 'a|b', rating: 1 });
    const res = await request(ctx.app).post('/api/ratings').set('User-Agent', ua).send({ track_key: 'a|b', rating: -1 });
    expect(res.body).toMatchObject({ up: 0, down: 1, user_vote: -1 });
  });

  it('allows changing a vote from down to up', async () => {
    const ua = 'FlipFlopper';
    await request(ctx.app).post('/api/ratings').set('User-Agent', ua).send({ track_key: 'a|b', rating: -1 });
    const res = await request(ctx.app).post('/api/ratings').set('User-Agent', ua).send({ track_key: 'a|b', rating: 1 });
    expect(res.body).toMatchObject({ up: 1, down: 0, user_vote: 1 });
  });

  it('counts votes from two different clients independently', async () => {
    await request(ctx.app).post('/api/ratings').set('User-Agent', 'ClientA').send({ track_key: 'a|b', rating: 1 });
    const res = await request(ctx.app).post('/api/ratings').set('User-Agent', 'ClientB').send({ track_key: 'a|b', rating: 1 });
    expect(res.body).toMatchObject({ up: 2, down: 0 });
  });

  it('does not mix ratings across different tracks', async () => {
    await request(ctx.app).post('/api/ratings').send({ track_key: 'track|one', rating: 1 });
    const res = await request(ctx.app).get('/api/ratings?track_key=track%7Ctwo');
    expect(res.body).toMatchObject({ up: 0, down: 0 });
  });
});
