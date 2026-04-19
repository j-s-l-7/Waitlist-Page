import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});



export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { email } = req.body;

    if (!email || !email.includes('@')) {
        return res.status(400).json({ error: 'Valid email required' });
    }

    try {
        const existing = await pool.query(
            'SELECT id FROM waitlist_emails WHERE email = $1',
            [email.toLowerCase().trim()]
        );

        if (existing.rows.length > 0) {
            const position = existing.rows[0].id;
            return res.json({ success: true, position, alreadyRegistered: true });
        }

        const ip = req.headers['x-forwarded-for'] || '';
        const result = await pool.query(
            'INSERT INTO waitlist_emails (email, source, ip_address) VALUES ($1, $2, $3) RETURNING id',
            [email.toLowerCase().trim(), 'website', ip]
        );

        const position = result.rows[0].id;
        res.json({ success: true, position, alreadyRegistered: false });
    } catch (err) {
        console.error('Waitlist error:', err);
        res.status(500).json({ error: 'Failed to join waitlist' });
    }
}
