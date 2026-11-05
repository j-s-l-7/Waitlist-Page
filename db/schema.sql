-- Analyez waitlist schema for Supabase (idempotent).
--
-- Run once in the Supabase SQL editor (or psql) when setting up a project.
-- Nothing in this repo runs it automatically. Every statement is
-- CREATE ... IF NOT EXISTS / ENABLE / REVOKE, so re-running it is safe.
--
-- It only touches the `waitlist` schema. The Supabase project may be shared
-- with other apps (e.g. a scraper using `equity` / `mf`); nothing here
-- touches `public` or any other schema.
--
-- The API connects as the database owner via the transaction pooler and
-- always schema-qualifies `waitlist.signups` (the pooler's search_path does
-- not include `waitlist`). The Supabase Data API roles get no access.

-- One transaction; SET LOCAL keeps the timeout from leaking onto a pooled
-- server connection (Supabase's transaction pooler shares connections).
BEGIN;
SET LOCAL statement_timeout = '15s';

CREATE SCHEMA IF NOT EXISTS waitlist;

CREATE TABLE IF NOT EXISTS waitlist.signups (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email       text        NOT NULL,           -- stored trimmed + lowercased by the API
    source      text        NOT NULL DEFAULT 'website',
    ip_address  text,                           -- validated client IP, may be NULL
    created_at  timestamptz NOT NULL DEFAULT now(),
    rank        integer     NOT NULL            -- stored waitlist rank (1, 2, 3, ...)
);

-- For tables created before the rank column existed.
ALTER TABLE waitlist.signups ADD COLUMN IF NOT EXISTS rank integer;

-- Make rank NOT NULL only when no row lacks one (e.g. a fresh/empty table).
-- Otherwise backfill first:  UPDATE waitlist.signups s SET rank = r.n
--   FROM (SELECT id, row_number() OVER (ORDER BY id) AS n FROM waitlist.signups) r
--   WHERE s.id = r.id;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM waitlist.signups WHERE rank IS NULL) THEN
        ALTER TABLE waitlist.signups ALTER COLUMN rank SET NOT NULL;
    END IF;
END
$$;

-- Ranks are unique; also lets max(rank) be read straight from the index.
CREATE UNIQUE INDEX IF NOT EXISTS signups_rank_key
    ON waitlist.signups (rank);

-- One signup per email. The API treats a unique violation (23505) as
-- "already registered". On a table that already has duplicate emails this
-- fails; find them with:
--   SELECT lower(email), count(*) FROM waitlist.signups
--   GROUP BY lower(email) HAVING count(*) > 1;
CREATE UNIQUE INDEX IF NOT EXISTS signups_email_lower_key
    ON waitlist.signups (lower(email));

-- Keep the table private: RLS on (no policies = no rows for API roles), and
-- no privileges for the Data API roles.
ALTER TABLE waitlist.signups ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON SCHEMA waitlist FROM anon, authenticated, public;
REVOKE ALL ON ALL TABLES IN SCHEMA waitlist FROM anon, authenticated, public;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA waitlist FROM anon, authenticated, public;

-- Rank assignment: the API takes pg_advisory_xact_lock(7717761001) inside a
-- transaction and inserts with rank = coalesce(max(rank), 0) + 1, so ranks are
-- unique and stable (deleting a row leaves a gap; later numbers do not shift).
-- Displayed number = (rank <= 9 ? 770 + rank : 7761 + rank).

COMMIT;
