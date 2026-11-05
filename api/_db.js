// Shared Postgres access for the Vercel serverless functions.
// The leading underscore keeps Vercel from exposing this file as a route.
import pg from 'pg';

const { Pool } = pg;

let pool = null;
let poolFactory = createPool;

function sslConfig() {
    const ca = process.env.DATABASE_CA_CERT;
    if (ca && ca.trim()) {
        // Opt-in certificate verification (PEM CA bundle).
        return { ca: ca.replace(/\\n/g, '\n'), rejectUnauthorized: true };
    }
    // Encrypted, but the server certificate is NOT verified. Set
    // DATABASE_CA_CERT to enable verification.
    return { rejectUnauthorized: false };
}

// pg lets SSL query params in the connection string (e.g. Supabase's
// `?sslmode=require`) override the explicit `ssl` object, and newer
// pg-connection-string treats `require` as verify-full. Strip them so the
// `ssl` config below stays authoritative.
const SSL_URL_PARAMS = ['sslmode', 'ssl', 'sslrootcert', 'sslcert', 'sslkey', 'uselibpqcompat'];

export function sanitizeConnectionString(connectionString) {
    let url;
    try {
        url = new URL(connectionString);
    } catch {
        return connectionString;
    }
    for (const key of SSL_URL_PARAMS) url.searchParams.delete(key);
    return url.toString();
}

export function poolConfig() {
    return {
        connectionString: sanitizeConnectionString(process.env.DATABASE_URL),
        ssl: sslConfig(),
        // One connection per serverless instance; the Supabase transaction
        // pooler (port 6543) multiplexes these onto a few real connections.
        max: 1,
        connectionTimeoutMillis: 5000,
        idleTimeoutMillis: 10000,
    };
}

function createPool() {
    if (!process.env.DATABASE_URL) {
        const err = new Error('DATABASE_URL is not set');
        err.code = 'DB_CONFIG_MISSING';
        throw err;
    }

    const created = new Pool(poolConfig());

    // An idle client error must not crash the function instance.
    created.on('error', (err) => {
        console.error('Postgres pool error:', err.code, err.message);
    });

    return created;
}

export function getPool() {
    if (!pool) pool = poolFactory();
    return pool;
}

// Drop the current pool (e.g. after a dead connection) so the next query
// gets a fresh one instead of reusing a poisoned connection.
function discardPool() {
    const old = pool;
    pool = null;
    if (old && typeof old.end === 'function') {
        Promise.resolve()
            .then(() => old.end())
            .catch(() => {});
    }
}

// Connection-level failures worth one retry. SQL/constraint errors
// (23505, 42P01, ...) are never retried.
const TRANSIENT_CODES = new Set([
    'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EPIPE',
    '57P01', // admin_shutdown
    '57P03', // cannot_connect_now
    '08000', // connection_exception
    '08003', // connection_does_not_exist
    '08006', // connection_failure
]);

// Includes pg's code-less connect timeout ("timeout exceeded when trying to
// connect") and "Connection terminated [due to connection timeout|unexpectedly]".
const TRANSIENT_MESSAGE = /connection terminated|timeout exceeded when trying to connect/i;

export function isTransientError(err) {
    if (!err) return false;
    if (TRANSIENT_CODES.has(err.code)) return true;
    return typeof err.message === 'string' && TRANSIENT_MESSAGE.test(err.message);
}

export const RETRY_DELAY_MS = 250;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Runs a query; on a transient connection error, recreates the pool and
// retries once. Pass { retry: false } to fail fast (e.g. health checks).
export async function query(text, params, { retry = true } = {}) {
    try {
        return await getPool().query(text, params);
    } catch (err) {
        if (!retry || !isTransientError(err)) throw err;
        logDbError('Transient DB error, retrying once', err);
        discardPool();
        await sleep(RETRY_DELAY_MS);
        return getPool().query(text, params);
    }
}

// Runs `fn(client)` inside BEGIN/COMMIT on one pooled client (a transaction
// stays on one server connection under the transaction pooler). Rolls back on
// error and always releases. A transient connection error is retried once on
// a fresh pool, but ONLY if COMMIT was never sent, so a retry cannot double
// apply a committed transaction.
export async function withTransaction(fn, { retry = true } = {}) {
    try {
        return await runTransaction(fn);
    } catch (err) {
        if (!retry || err?.commitSent || !isTransientError(err)) throw err;
        logDbError('Transient DB error in transaction, retrying once', err);
        discardPool();
        await sleep(RETRY_DELAY_MS);
        return runTransaction(fn);
    }
}

async function runTransaction(fn) {
    const client = await getPool().connect();
    let commitSent = false;
    let broken = false;
    try {
        await client.query('BEGIN');
        const result = await fn(client);
        commitSent = true;
        await client.query('COMMIT');
        return result;
    } catch (err) {
        broken = isTransientError(err);
        if (!commitSent && !broken) {
            await client.query('ROLLBACK').catch(() => {
                broken = true;
            });
        }
        if (commitSent) {
            // COMMIT outcome unknown: never retry, never reuse this connection.
            broken = true;
            if (err && typeof err === 'object') err.commitSent = true;
        }
        throw err;
    } finally {
        // Destroy (not reuse) a connection that may be dead or mid-transaction.
        client.release(broken ? true : undefined);
    }
}

// Test seams. setPoolForTesting(stub) makes every (re)created pool be `stub`;
// setPoolFactoryForTesting(fn) lets a test observe pool recreation.
// Passing null restores the real pg pool.
export function setPoolForTesting(stub) {
    setPoolFactoryForTesting(stub ? () => stub : null);
}

export function setPoolFactoryForTesting(factory) {
    pool = null;
    poolFactory = factory ?? createPool;
}

// Logs a DB error without leaking the connection string.
export function logDbError(label, err) {
    console.error(`${label}:`, err?.code ?? 'NO_CODE', err?.message ?? String(err));
}

// Error code that is safe to return to clients: a short code only, never a
// message (messages can contain hostnames).
export function safeErrorCode(err) {
    const code = err?.code;
    return typeof code === 'string' && /^[A-Z0-9_]{1,40}$/.test(code) ? code : 'UNKNOWN';
}
