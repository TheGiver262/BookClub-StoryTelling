import test from 'node:test';
import assert from 'node:assert/strict';
import { DbHarness } from './db-harness.ts';
import { prepareBetaSql } from '../../scripts/prepare-beta-db.mjs';
import { listPublicReservationBooks } from '../../src/server/reservations/service.ts';

test('PG: clean beta bootstrap applies migrations and isolates backend privileges', async () => {
  const harness = new DbHarness();
  try {
    await harness.resetSchema();
    const pool = harness.getPool();
    const { schema, access, tables } = prepareBetaSql();
    await pool.query(schema);
    await pool.query("DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF; END $$");
    await pool.query('GRANT EXECUTE ON FUNCTION public.update_book_title_search_vector() TO anon');
    await pool.query(access);
    assert.equal((await pool.query("SELECT has_function_privilege('anon', 'public.update_book_title_search_vector()', 'EXECUTE') AS allowed")).rows[0].allowed, false);
    assert.equal(Number((await pool.query('SELECT count(*) FROM funds')).rows[0].count), 2);
    assert.equal(Number((await pool.query('SELECT count(*) FROM members')).rows[0].count), 0);
    const rls = await pool.query(`SELECT count(*) FROM pg_class WHERE oid = ANY($1::regclass[]) AND relrowsecurity`, [tables.map(table => `public.${table}`)]);
    assert.equal(Number(rls.rows[0].count), tables.length);
    await harness.withClient(async client => {
      await client.query('SET ROLE ysbk_app');
      assert.equal(Number((await client.query('SELECT count(*) FROM funds')).rows[0].count), 2);
      await client.query("INSERT INTO book_titles (title) VALUES ('Beta role permission test')");
      await assert.rejects(client.query('TRUNCATE funds CASCADE'), /permission denied/);
      await assert.rejects(client.query('CREATE TABLE public.should_not_exist (id int)'), /permission denied/);
      await client.query('SET ROLE anon');
      await assert.rejects(client.query('SELECT * FROM reservations'), /permission denied/);
    });
    await pool.query(`WITH titles AS (
      INSERT INTO book_titles(title) SELECT 'Beta Book ' || lpad(n::text, 4, '0') FROM generate_series(1, 3000) n RETURNING id, title
    ), editions AS (
      INSERT INTO book_editions(title_id, publisher) SELECT id, 'Beta Publisher' FROM titles RETURNING id
    ) INSERT INTO book_copies(edition_id, barcode, location)
      SELECT id, 'BETA-' || id, 'KHO_THU_VIEN' FROM editions`);
    await harness.withClient(async client => {
      await client.query('SET ROLE ysbk_app');
      const first = await listPublicReservationBooks(client, { page: 1, limit: 24 });
      const last = await listPublicReservationBooks(client, { page: 125, limit: 24 });
      assert.equal(first.total, 3000);
      assert.equal(last.items.length, 24);
      assert.ok(last.items.every(item => !first.items.some(other => other.titleId === item.titleId)));
      const searched = await listPublicReservationBooks(client, { search: 'Beta Book 2999', limit: 24 });
      assert.equal(searched.total, 1);
      assert.equal(searched.items[0].title, 'Beta Book 2999');
    });
    await assert.rejects(pool.query(schema), /YSBK_BOOTSTRAP_REQUIRES_EMPTY_DATABASE/);
  } finally { await harness.close(); }
});
