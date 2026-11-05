import { query, logDbError, safeErrorCode } from './_db.js';

// GET|HEAD /api/health: { ok: true, db: "up" } or 503 { ok: false, db: "down", code }.
// For uptime monitors. Flood protection: the CDN caches for 15 s and each
// instance memoizes the result for 10 s, so the database sees at most one
// `SELECT 1` per instance per 10 s.
export const HEALTH_MEMO_MS = 10000;
let memo = null; // { at, status, body }

export function resetHealthMemoForTesting() {
    memo = null;
}

async function check() {
    try {
        await query({ text: 'SELECT 1', query_timeout: 3000 }, undefined, { retry: false });
        return { status: 200, body: { ok: true, db: 'up' } };
    } catch (err) {
        logDbError('Health check failed', err);
        return { status: 503, body: { ok: false, db: 'down', code: safeErrorCode(err) } };
    }
}

export default async function handler(req, res) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.setHeader('Allow', 'GET, HEAD');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!memo || Date.now() - memo.at >= HEALTH_MEMO_MS) {
        memo = { at: Date.now(), ...(await check()) };
    }

    res.setHeader('Cache-Control', 'public, s-maxage=15, stale-while-revalidate=15');
    if (req.method === 'HEAD') return res.status(memo.status).end();
    return res.status(memo.status).json(memo.body);
}
