import { query, logDbError } from '../_db.js';
import { applyCors } from '../_http.js';
import { displayNumber } from '../_numbering.js';

// Returns the displayed number of the latest signup (770 when empty),
// never the raw row count. max(rank) is served from the unique rank index.
export default async function handler(req, res) {
    applyCors(req, res, 'GET, HEAD, OPTIONS');

    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.setHeader('Allow', 'GET, HEAD, OPTIONS');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const result = await query('SELECT coalesce(max(rank), 0) AS rank FROM waitlist.signups');
        const count = displayNumber(Number(result.rows[0].rank));
        // Cache at the edge so every hit does not reach the database.
        res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
        if (req.method === 'HEAD') return res.status(200).end();
        return res.status(200).json({ count });
    } catch (err) {
        logDbError('Waitlist count failed', err);
        res.setHeader('Cache-Control', 'no-store');
        if (req.method === 'HEAD') return res.status(503).end();
        return res.status(503).json({ error: 'Failed to get count' });
    }
}
