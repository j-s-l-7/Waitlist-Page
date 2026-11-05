// API handler tests. Uses only node:test / node:assert and a stubbed pool:
// no database is ever contacted.
import { test, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import signup, { RANK_LOCK_KEY } from '../api/waitlist.js';
import count from '../api/waitlist/count.js';
import health, { resetHealthMemoForTesting } from '../api/health.js';
import {
    setPoolForTesting,
    setPoolFactoryForTesting,
    query,
    withTransaction,
    isTransientError,
    sanitizeConnectionString,
    poolConfig,
} from '../api/_db.js';
import { displayNumber } from '../api/_numbering.js';

function makeRes() {
    return {
        statusCode: 200,
        headers: {},
        body: undefined,
        ended: false,
        setHeader(name, value) {
            this.headers[name.toLowerCase()] = value;
        },
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(obj) {
            this.body = obj;
            this.ended = true;
            return this;
        },
        end() {
            this.ended = true;
            return this;
        },
    };
}

function makeReq({ method = 'POST', body, headers = {} } = {}) {
    return { method, body, headers };
}

const TX_CONTROL = /^(BEGIN|COMMIT|ROLLBACK)$|pg_advisory_xact_lock/;

// Stub pool. `handlers` answer the non-control queries in order, whether sent
// via pool.query or via a client from pool.connect(). BEGIN/COMMIT/ROLLBACK
// and the advisory lock are answered automatically and recorded in `tx`.
function stubPool(...handlers) {
    const calls = [];
    const tx = [];
    const releases = [];
    const answer = async (text, params) => {
        const sql = typeof text === 'string' ? text : text.text;
        if (TX_CONTROL.test(sql)) {
            tx.push({ sql, params });
            return { rows: [] };
        }
        calls.push({ text, params });
        const next = handlers.shift();
        if (!next) throw new Error(`unexpected query: ${sql}`);
        return next(text, params);
    };
    setPoolForTesting({
        query: answer,
        async connect() {
            return { query: answer, release: (arg) => releases.push(arg) };
        },
    });
    return Object.assign(calls, { tx, releases });
}

const rows = (...r) => () => ({ rows: r });
const fail = (code, message = 'boom') => () => {
    const err = new Error(message);
    err.code = code;
    throw err;
};

// Keep handler error logs out of the test output; restored afterwards.
let savedConsoleError;
before(() => {
    savedConsoleError = console.error;
    console.error = () => {};
});
after(() => {
    console.error = savedConsoleError;
});

afterEach(() => {
    setPoolForTesting(null);
    resetHealthMemoForTesting();
});

async function run(handler, req) {
    const res = makeRes();
    await handler(req, res);
    return res;
}

// ---- numbering ----

for (const [rank, shown] of [[0, 770], [1, 771], [9, 779], [10, 7771], [18, 7779], [19, 7780], [100, 7861]]) {
    test(`numbering: rank ${rank} displays as ${shown}`, () => {
        assert.equal(displayNumber(rank), shown);
    });
}

test('numbering: rejects invalid ranks', () => {
    assert.throws(() => displayNumber(-1), RangeError);
    assert.throws(() => displayNumber(1.5), RangeError);
    assert.throws(() => displayNumber('abc'), RangeError);
});

// ---- POST /api/waitlist ----

test('signup: wrong method returns 405', async () => {
    const res = await run(signup, makeReq({ method: 'GET' }));
    assert.equal(res.statusCode, 405);
    assert.match(res.headers.allow, /POST/);
});

test('signup: OPTIONS preflight is answered without touching the DB', async () => {
    const calls = stubPool();
    const res = await run(signup, makeReq({ method: 'OPTIONS', headers: { origin: 'https://analyez.com' } }));
    assert.equal(res.statusCode, 204);
    assert.equal(res.headers['access-control-allow-origin'], 'https://analyez.com');
    assert.equal(calls.length + calls.tx.length, 0);
});

test('signup: disallowed origin gets no CORS header', async () => {
    const res = await run(signup, makeReq({ method: 'OPTIONS', headers: { origin: 'https://evil.example' } }));
    assert.equal(res.headers['access-control-allow-origin'], undefined);
});

for (const [name, body] of [
    ['no body', undefined],
    ['null body', null],
    ['invalid JSON string body', '{"email": '],
    ['array body', ['a@b.co']],
    ['non-string email (number)', { email: 12345 }],
    ['non-string email (object)', { email: { $ne: '' } }],
    ['empty email', { email: '' }],
    ['whitespace email', { email: '   ' }],
    ['email without @', { email: 'not-an-email' }],
    ['email without TLD', { email: 'user@localhost' }],
    ['email with spaces', { email: 'a b@example.com' }],
    ['over-length email', { email: `${'a'.repeat(250)}@example.com` }],
]) {
    test(`signup: ${name} returns 400`, async () => {
        const calls = stubPool();
        const res = await run(signup, makeReq({ body }));
        assert.equal(res.statusCode, 400);
        assert.deepEqual(res.body, { error: 'Valid email required' });
        assert.equal(calls.length + calls.tx.length, 0);
    });
}

test('signup: req.body getter that throws (Vercel invalid JSON) returns 400', async () => {
    const req = makeReq();
    Object.defineProperty(req, 'body', {
        get() {
            throw new Error('Invalid JSON');
        },
    });
    const res = await run(signup, req);
    assert.equal(res.statusCode, 400);
});

test('signup: valid JSON string body is parsed', async () => {
    stubPool(rows(), rows({ rank: 2 }));
    const res = await run(signup, makeReq({ body: JSON.stringify({ email: 'str@example.com' }) }));
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { success: true, position: 772, alreadyRegistered: false });
});

test('signup: new email runs one locked transaction and stores max(rank)+1', async () => {
    const calls = stubPool(rows(), rows({ rank: 1 }));
    const res = await run(signup, makeReq({
        body: { email: '  New.User@Example.COM ', market: 'india' },
        headers: { 'x-real-ip': '203.0.113.9' },
    }));
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { success: true, position: 771, alreadyRegistered: false });

    assert.deepEqual(calls.tx.map((t) => t.sql.split(' ')[0]), ['BEGIN', 'SELECT', 'COMMIT']);
    assert.match(calls.tx[1].sql, /pg_advisory_xact_lock\(\$1::bigint\)/);
    assert.deepEqual(calls.tx[1].params, [RANK_LOCK_KEY]);

    assert.equal(calls.length, 2);
    assert.match(calls[0].text, /SELECT rank FROM waitlist\.signups WHERE lower\(email\) = \$1/);
    assert.deepEqual(calls[0].params, ['new.user@example.com']);
    assert.match(calls[1].text, /INSERT INTO waitlist\.signups \(email, source, ip_address, rank\)/);
    assert.match(calls[1].text, /coalesce\(max\(rank\), 0\) \+ 1 FROM waitlist\.signups/);
    assert.deepEqual(calls[1].params, ['new.user@example.com', 'website', '203.0.113.9']);
    assert.deepEqual(calls.releases, [undefined], 'client released for reuse');
});

test('signup: 10th signup displays 7771', async () => {
    stubPool(rows(), rows({ rank: 10 }));
    const res = await run(signup, makeReq({ body: { email: 'ten@example.com' } }));
    assert.equal(res.body.position, 7771);
});

test('signup: already registered returns stored rank without inserting', async () => {
    const calls = stubPool(rows({ rank: 3 }));
    const res = await run(signup, makeReq({ body: { email: ' OLD@Example.com ' } }));
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { success: true, position: 773, alreadyRegistered: true });
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].params, ['old@example.com']);
    assert.ok(calls.tx.some((t) => t.sql === 'COMMIT'));
});

test('signup: 23505 on INSERT rolls back and returns alreadyRegistered via re-lookup', async () => {
    const calls = stubPool(rows(), fail('23505', 'duplicate key'), rows({ rank: 9 }));
    const res = await run(signup, makeReq({ body: { email: 'race@example.com' } }));
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { success: true, position: 779, alreadyRegistered: true });
    assert.equal(calls.length, 3);
    assert.ok(calls.tx.some((t) => t.sql === 'ROLLBACK'));
    assert.ok(!calls.tx.some((t) => t.sql === 'COMMIT'));
});

test('signup: transient failure before COMMIT retries the whole transaction once', async () => {
    const calls = stubPool(fail('ECONNRESET', 'read ECONNRESET'), rows(), rows({ rank: 4 }));
    const res = await run(signup, makeReq({ body: { email: 'retry@example.com' } }));
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { success: true, position: 774, alreadyRegistered: false });
    assert.equal(calls.tx.filter((t) => t.sql === 'BEGIN').length, 2);
    assert.equal(calls.releases[0], true, 'dead client destroyed, not reused');
});

test('signup: DB connection failure (after one retry) returns 503', async () => {
    stubPool(fail('ECONNREFUSED', 'connect ECONNREFUSED'), fail('ECONNREFUSED', 'connect ECONNREFUSED'));
    const res = await run(signup, makeReq({ body: { email: 'a@example.com' } }));
    assert.equal(res.statusCode, 503);
    assert.ok(res.body.error);
});

test('signup: other INSERT failure returns 503 and rolls back', async () => {
    const calls = stubPool(rows(), fail('42P01', 'relation "waitlist.signups" does not exist'));
    const res = await run(signup, makeReq({ body: { email: 'a@example.com' } }));
    assert.equal(res.statusCode, 503);
    assert.ok(calls.tx.some((t) => t.sql === 'ROLLBACK'));
});

test('signup: missing DATABASE_URL returns 503 and does not leak config', async () => {
    const saved = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    try {
        setPoolForTesting(null);
        const res = await run(signup, makeReq({ body: { email: 'a@example.com' } }));
        assert.equal(res.statusCode, 503);
        assert.doesNotMatch(JSON.stringify(res.body), /DATABASE_URL/);
    } finally {
        if (saved !== undefined) process.env.DATABASE_URL = saved;
    }
});

test('signup: comma-separated x-forwarded-for stores only the first IP', async () => {
    const calls = stubPool(rows(), rows({ rank: 1 }));
    await run(signup, makeReq({
        body: { email: 'xff@example.com' },
        headers: { 'x-forwarded-for': ' 198.51.100.7 , 10.0.0.1, 172.16.0.1' },
    }));
    assert.equal(calls[1].params[2], '198.51.100.7');
});

test('signup: garbage forwarded IP is stored as null', async () => {
    const calls = stubPool(rows(), rows({ rank: 1 }));
    await run(signup, makeReq({
        body: { email: 'junk@example.com' },
        headers: { 'x-forwarded-for': "'; DROP TABLE x; --" },
    }));
    assert.equal(calls[1].params[2], null);
});

// ---- GET|HEAD /api/waitlist/count ----

test('count: GET returns displayed number of max(rank) with cache header', async () => {
    const calls = stubPool(rows({ rank: 123 }));
    const res = await run(count, makeReq({ method: 'GET' }));
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { count: 7884 });
    assert.equal(res.headers['cache-control'], 'public, s-maxage=60, stale-while-revalidate=300');
    assert.match(calls[0].text, /coalesce\(max\(rank\), 0\) AS rank FROM waitlist\.signups/);
});

test('count: empty table returns 770', async () => {
    stubPool(rows({ rank: 0 }));
    const res = await run(count, makeReq({ method: 'GET' }));
    assert.deepEqual(res.body, { count: 770 });
});

test('count: rank 2 returns 772', async () => {
    stubPool(rows({ rank: '2' }));
    const res = await run(count, makeReq({ method: 'GET' }));
    assert.deepEqual(res.body, { count: 772 });
});

test('count: HEAD returns same headers and no body', async () => {
    stubPool(rows({ rank: 5 }));
    const res = await run(count, makeReq({ method: 'HEAD' }));
    assert.equal(res.statusCode, 200);
    assert.equal(res.body, undefined);
    assert.equal(res.ended, true);
    assert.equal(res.headers['cache-control'], 'public, s-maxage=60, stale-while-revalidate=300');
});

test('count: POST returns 405 with Allow listing HEAD', async () => {
    const calls = stubPool();
    const res = await run(count, makeReq({ method: 'POST' }));
    assert.equal(res.statusCode, 405);
    assert.equal(res.headers.allow, 'GET, HEAD, OPTIONS');
    assert.equal(calls.length, 0);
});

test('count: DB failure returns 503 and is not cached', async () => {
    stubPool(fail('28P01', 'password authentication failed'));
    const res = await run(count, makeReq({ method: 'GET' }));
    assert.equal(res.statusCode, 503);
    assert.equal(res.headers['cache-control'], 'no-store');
});

// ---- _db.js: connection string, transient retry, transactions ----

test('db: SSL params in DATABASE_URL are stripped so the ssl object wins', () => {
    const cleaned = sanitizeConnectionString(
        'postgresql://u:p@host.example:6543/postgres?sslmode=require&sslrootcert=x&ssl=true&uselibpqcompat=true&application_name=w'
    );
    assert.doesNotMatch(cleaned, /ssl|uselibpqcompat/);
    assert.match(cleaned, /application_name=w/);
    assert.match(cleaned, /:6543\/postgres/);
});

test('db: poolConfig keeps explicit ssl authoritative over ?sslmode=require', () => {
    const saved = { url: process.env.DATABASE_URL, ca: process.env.DATABASE_CA_CERT };
    try {
        process.env.DATABASE_URL = 'postgresql://u:p@host.example:6543/postgres?sslmode=require';
        delete process.env.DATABASE_CA_CERT;
        let cfg = poolConfig();
        assert.doesNotMatch(cfg.connectionString, /sslmode/);
        assert.deepEqual(cfg.ssl, { rejectUnauthorized: false });
        assert.equal(cfg.max, 1);

        process.env.DATABASE_CA_CERT = '-----BEGIN CERTIFICATE-----\\nabc\\n-----END CERTIFICATE-----';
        cfg = poolConfig();
        assert.equal(cfg.ssl.rejectUnauthorized, true);
        assert.match(cfg.ssl.ca, /\nabc\n/);
    } finally {
        if (saved.url === undefined) delete process.env.DATABASE_URL;
        else process.env.DATABASE_URL = saved.url;
        if (saved.ca === undefined) delete process.env.DATABASE_CA_CERT;
        else process.env.DATABASE_CA_CERT = saved.ca;
    }
});

function trackingFactory(perPoolHandlers) {
    const pools = [];
    setPoolFactoryForTesting(() => {
        const handlers = perPoolHandlers[pools.length] ?? [];
        const p = {
            ended: false,
            calls: 0,
            async query() {
                p.calls += 1;
                const next = handlers.shift();
                if (!next) throw new Error('unexpected query');
                return next();
            },
            async end() {
                p.ended = true;
            },
        };
        pools.push(p);
        return p;
    });
    return pools;
}

for (const [label, err] of [
    ['ECONNRESET', Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' })],
    ['57P01', Object.assign(new Error('terminating connection due to administrator command'), { code: '57P01' })],
    ['Connection terminated', new Error('Connection terminated unexpectedly')],
    ['pg connect timeout', new Error('timeout exceeded when trying to connect')],
    ['connection timeout termination', new Error('Connection terminated due to connection timeout')],
]) {
    test(`db: transient ${label} is retried once on a fresh pool`, async () => {
        const pools = trackingFactory([[() => { throw err; }], [rows({ ok: 1 })]]);
        const result = await query('SELECT 1');
        assert.deepEqual(result.rows, [{ ok: 1 }]);
        assert.equal(pools.length, 2, 'pool was recreated');
        await new Promise((r) => setImmediate(r));
        assert.equal(pools[0].ended, true, 'dead pool was ended');
    });
}

for (const code of ['23505', '42P01']) {
    test(`db: ${code} is not retried`, async () => {
        const pools = trackingFactory([[fail(code)], [rows()]]);
        await assert.rejects(query('SELECT 1'), (e) => e.code === code);
        assert.equal(pools.length, 1);
        assert.equal(pools[0].calls, 1);
    });
}

test('db: retry: false fails fast on transient errors', async () => {
    const pools = trackingFactory([[fail('ECONNRESET')], [rows()]]);
    await assert.rejects(query('SELECT 1', undefined, { retry: false }));
    assert.equal(pools.length, 1);
});

test('db: a second transient failure is surfaced', async () => {
    trackingFactory([[fail('ETIMEDOUT')], [fail('ETIMEDOUT')]]);
    await assert.rejects(query('SELECT 1'), (e) => e.code === 'ETIMEDOUT');
});

test('db: isTransientError classification', () => {
    assert.equal(isTransientError({ code: '08006' }), true);
    assert.equal(isTransientError({ code: '23505' }), false);
    assert.equal(isTransientError(new Error('syntax error')), false);
    assert.equal(isTransientError(null), false);
});

test('db: transaction is never retried when COMMIT itself fails', async () => {
    let begins = 0;
    const releases = [];
    setPoolForTesting({
        async connect() {
            return {
                async query(sql) {
                    if (sql === 'BEGIN') begins += 1;
                    if (sql === 'COMMIT') throw Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' });
                    return { rows: [] };
                },
                release: (arg) => releases.push(arg),
            };
        },
    });
    await assert.rejects(withTransaction(async (c) => c.query('INSERT ...')), (e) => e.commitSent === true);
    assert.equal(begins, 1, 'no second attempt after COMMIT was sent');
    assert.deepEqual(releases, [true], 'connection destroyed');
});

test('db: transient connect() failure retries the transaction', async () => {
    let connects = 0;
    setPoolForTesting({
        async connect() {
            connects += 1;
            if (connects === 1) throw Object.assign(new Error('connect ETIMEDOUT'), { code: 'ETIMEDOUT' });
            return { query: async () => ({ rows: [{ v: 1 }] }), release() {} };
        },
    });
    const out = await withTransaction(async (c) => (await c.query('SELECT 1')).rows[0].v);
    assert.equal(out, 1);
    assert.equal(connects, 2);
});

// ---- GET|HEAD /api/health ----

test('health: DB up returns ok with short CDN cache', async () => {
    const calls = stubPool(rows({ '?column?': 1 }));
    const res = await run(health, makeReq({ method: 'GET' }));
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { ok: true, db: 'up' });
    assert.equal(res.headers['cache-control'], 'public, s-maxage=15, stale-while-revalidate=15');
    assert.equal(calls[0].text.text, 'SELECT 1');
    assert.ok(calls[0].text.query_timeout > 0);
});

test('health: result is memoized per instance (one DB hit for repeated calls)', async () => {
    const calls = stubPool(rows({ '?column?': 1 }));
    await run(health, makeReq({ method: 'GET' }));
    await run(health, makeReq({ method: 'GET' }));
    const res = await run(health, makeReq({ method: 'HEAD' }));
    assert.equal(calls.length, 1);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body, undefined);
});

test('health: DB down returns 503 with code only (no message, no retry)', async () => {
    const calls = stubPool(fail('ECONNREFUSED', 'connect ECONNREFUSED secret-host.example:6543'));
    const res = await run(health, makeReq({ method: 'GET' }));
    assert.equal(res.statusCode, 503);
    assert.deepEqual(res.body, { ok: false, db: 'down', code: 'ECONNREFUSED' });
    assert.doesNotMatch(JSON.stringify(res.body), /secret-host/);
    assert.equal(calls.length, 1);
});

test('health: error without a code reports UNKNOWN', async () => {
    stubPool(() => { throw new Error('Connection terminated: host db.secret.example'); });
    const res = await run(health, makeReq({ method: 'GET' }));
    assert.deepEqual(res.body, { ok: false, db: 'down', code: 'UNKNOWN' });
});

test('health: POST returns 405', async () => {
    const res = await run(health, makeReq({ method: 'POST' }));
    assert.equal(res.statusCode, 405);
});
