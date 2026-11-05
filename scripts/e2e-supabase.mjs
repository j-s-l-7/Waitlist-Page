// End-to-end check of the REAL API handlers against the Supabase database in
// DATABASE_URL. Contains no secrets and never prints the connection string,
// host or password.
//
//   node --env-file=.env.local scripts/e2e-supabase.mjs
//
// Requires db/schema.sql to have been applied. Uses clearly fake emails
// (e2e-test-<timestamp>-*@analyez-test.dev), checks numbering, dedupe, count,
// health and 10 truly concurrent signups, then deletes exactly those emails
// (in `finally`) and confirms the table is back to its starting state.
import assert from 'node:assert/strict';
import pg from 'pg';

import signup from '../api/waitlist.js';
import count from '../api/waitlist/count.js';
import health from '../api/health.js';
import { query, poolConfig, setPoolFactoryForTesting } from '../api/_db.js';
import { displayNumber } from '../api/_numbering.js';

function checkConnectionString() {
    let url;
    try {
        url = new URL(process.env.DATABASE_URL ?? '');
    } catch {
        throw new Error('DATABASE_URL: FAIL (missing or not a URL)');
    }
    const pooler = /\.pooler\.supabase\.com$/.test(url.hostname);
    const port = url.port === '6543';
    console.log(`DATABASE_URL pooler host: ${pooler ? 'pass' : 'FAIL'}`);
    console.log(`DATABASE_URL port 6543:   ${port ? 'pass' : 'FAIL'}`);
    console.log(`DATABASE_URL has sslmode: ${url.searchParams.has('sslmode') ? 'yes (stripped by _db.js)' : 'no'}`);
    if (!pooler || !port) throw new Error('DATABASE_URL must be the transaction pooler URI on port 6543');
}

function makeRes() {
    return {
        statusCode: 200,
        headers: {},
        body: undefined,
        setHeader(n, v) { this.headers[n.toLowerCase()] = v; },
        status(c) { this.statusCode = c; return this; },
        json(o) { this.body = o; return this; },
        end() { return this; },
    };
}

async function call(handler, method, body) {
    const res = makeRes();
    await handler({ method, body, headers: { 'x-real-ip': '192.0.2.1' } }, res);
    return res;
}

const mask = (email) => email.replace(/^[^@]+/, (local) => `${local.slice(0, 9)}***`);

async function state() {
    const r = await query('SELECT count(*) AS n, coalesce(max(rank), 0) AS max_rank FROM waitlist.signups');
    return { rows: Number(r.rows[0].n), maxRank: Number(r.rows[0].max_rank) };
}

checkConnectionString();

const stamp = Date.now();
const emailA = `e2e-test-${stamp}-a@analyez-test.dev`;
const emailB = `e2e-test-${stamp}-b@analyez-test.dev`;
const parallel = Array.from({ length: 10 }, (_, i) => `e2e-test-${stamp}-p${i}@analyez-test.dev`);
const allEmails = [emailA, emailB, ...parallel];

const baseline = await state();
console.log(`baseline: rows=${baseline.rows} max_rank=${baseline.maxRank}${baseline.rows === 0 ? '' : ' (not empty: expectations adjusted)'}`);
const n0 = baseline.maxRank;

let failed = false;
try {
    const h = await call(health, 'GET');
    console.log('health:', h.statusCode, JSON.stringify(h.body));
    assert.deepEqual(h.body, { ok: true, db: 'up' });

    const a1 = await call(signup, 'POST', { email: emailA });
    console.log(`signup ${mask(emailA)}:`, a1.statusCode, JSON.stringify(a1.body));
    assert.deepEqual(a1.body, { success: true, position: displayNumber(n0 + 1), alreadyRegistered: false });

    const a2 = await call(signup, 'POST', { email: `  ${emailA.toUpperCase()} ` });
    console.log(`resubmit ${mask(emailA)} (upper + spaces):`, a2.statusCode, JSON.stringify(a2.body));
    assert.deepEqual(a2.body, { success: true, position: displayNumber(n0 + 1), alreadyRegistered: true });

    const b1 = await call(signup, 'POST', { email: emailB });
    console.log(`signup ${mask(emailB)}:`, b1.statusCode, JSON.stringify(b1.body));
    assert.deepEqual(b1.body, { success: true, position: displayNumber(n0 + 2), alreadyRegistered: false });

    const c = await call(count, 'GET');
    console.log('count:', c.statusCode, JSON.stringify(c.body));
    assert.deepEqual(c.body, { count: displayNumber(n0 + 2) });

    // Remove a and b so the concurrency phase starts from the baseline again.
    await query('DELETE FROM waitlist.signups WHERE email = ANY($1::text[])', [[emailA, emailB]]);
    const mid = await state();
    assert.equal(mid.rows, baseline.rows);

    // 10 truly concurrent signups: a real pool with 10 connections, so the
    // transactions overlap on the server and contend for the advisory lock.
    setPoolFactoryForTesting(() => new pg.Pool({ ...poolConfig(), max: 10 }));
    const results = await Promise.all(parallel.map((e) => call(signup, 'POST', { email: e })));
    const positions = results.map((r) => r.body?.position).sort((x, y) => x - y);
    const expected = Array.from({ length: 10 }, (_, i) => displayNumber(n0 + 1 + i));
    console.log('parallel x10 statuses:', results.map((r) => r.statusCode).join(','));
    console.log('parallel x10 positions:', positions.join(','));
    assert.ok(results.every((r) => r.statusCode === 200 && r.body.alreadyRegistered === false));
    assert.deepEqual(positions, expected);
    assert.equal(new Set(positions).size, 10, 'no duplicate numbers');

    console.log('E2E: PASS');
} catch (err) {
    failed = true;
    console.error('E2E: FAIL', err?.code ?? '', err?.message ?? err);
} finally {
    const del = await query('DELETE FROM waitlist.signups WHERE email = ANY($1::text[])', [allEmails]);
    const after = await state();
    console.log(`cleanup: deleted ${del.rowCount}, rows now ${after.rows} (baseline ${baseline.rows})`);
    if (after.rows !== baseline.rows) failed = true;
}

process.exit(failed ? 1 : 0);
