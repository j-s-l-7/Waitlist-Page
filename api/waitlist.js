import { isIP } from 'node:net';
import { query, withTransaction, logDbError } from './_db.js';
import { applyCors } from './_http.js';
import { displayNumber } from './_numbering.js';

// Keep in sync with src/components/cta/FloatingCTA.tsx.
const EMAIL_MAX_LENGTH = 254;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Returns the parsed body object, or null if it is missing or not valid JSON.
function readBody(req) {
    let body;
    try {
        // On Vercel, req.body is a getter that throws on malformed JSON.
        body = req.body;
    } catch {
        return null;
    }
    if (typeof body === 'string') {
        try {
            body = JSON.parse(body);
        } catch {
            return null;
        }
    }
    return body && typeof body === 'object' && !Array.isArray(body) ? body : null;
}

export function normalizeEmail(value) {
    if (typeof value !== 'string') return null;
    const email = value.trim().toLowerCase();
    if (!email || email.length > EMAIL_MAX_LENGTH || !EMAIL_RE.test(email)) return null;
    return email;
}

function firstHeader(req, name) {
    const value = req.headers?.[name];
    return Array.isArray(value) ? value[0] : value;
}

// Prefer the headers Vercel sets itself; otherwise use the first
// X-Forwarded-For entry. Anything that is not a valid IP becomes null.
export function clientIp(req) {
    const candidates = [
        firstHeader(req, 'x-real-ip'),
        firstHeader(req, 'x-vercel-forwarded-for'),
        firstHeader(req, 'x-forwarded-for'),
    ];
    for (const raw of candidates) {
        if (typeof raw !== 'string') continue;
        const ip = raw.split(',')[0].trim();
        if (isIP(ip)) return ip;
    }
    return null;
}

// Transaction-level advisory lock key that serializes rank assignment.
// Arbitrary constant, specific to this app (the database is shared).
export const RANK_LOCK_KEY = '7717761001';

// Stored rank of an existing signup (case-insensitive), or null.
async function findRank(db, email) {
    const existing = await db.query(
        'SELECT rank FROM waitlist.signups WHERE lower(email) = $1 ORDER BY id LIMIT 1',
        [email]
    );
    return existing.rows.length > 0 ? Number(existing.rows[0].rank) : null;
}

// One transaction: lock, look up, insert with rank = max(rank) + 1.
// Ranks are stored, so they are unique and never shift when rows are deleted.
async function joinWaitlist(email, ip) {
    return withTransaction(async (client) => {
        await client.query('SELECT pg_advisory_xact_lock($1::bigint)', [RANK_LOCK_KEY]);
        const existingRank = await findRank(client, email);
        if (existingRank !== null) return { rank: existingRank, alreadyRegistered: true };
        const inserted = await client.query(
            `INSERT INTO waitlist.signups (email, source, ip_address, rank)
             VALUES ($1, $2, $3, (SELECT coalesce(max(rank), 0) + 1 FROM waitlist.signups))
             RETURNING rank`,
            [email, 'website', ip]
        );
        return { rank: Number(inserted.rows[0].rank), alreadyRegistered: false };
    });
}

export default async function handler(req, res) {
    applyCors(req, res, 'POST, OPTIONS');

    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST, OPTIONS');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const body = readBody(req);
    const email = normalizeEmail(body?.email);
    if (!email) {
        return res.status(400).json({ error: 'Valid email required' });
    }

    try {
        let outcome;
        try {
            outcome = await joinWaitlist(email, clientIp(req));
        } catch (err) {
            // Safety net: a unique violation means the email is already there.
            if (err?.code !== '23505') throw err;
            const rank = await findRank({ query }, email);
            if (rank === null) throw err;
            outcome = { rank, alreadyRegistered: true };
        }
        return res.status(200).json({
            success: true,
            position: displayNumber(outcome.rank),
            alreadyRegistered: outcome.alreadyRegistered,
        });
    } catch (err) {
        logDbError('Waitlist signup failed', err);
        return res.status(503).json({ error: 'Waitlist is temporarily unavailable. Please try again.' });
    }
}
