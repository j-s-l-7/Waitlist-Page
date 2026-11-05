// Shared HTTP helpers for the API routes (underscore prefix = not a route).

const ALLOWED_ORIGINS = new Set([
    'https://analyez.com',
    'https://www.analyez.com',
    'http://localhost:3000',
    'http://localhost:4173',
    'http://localhost:5173',
]);

// The site calls the API same-origin, so CORS is only needed for the
// allowlisted origins above (other origins get no CORS headers).
export function applyCors(req, res, methods) {
    const origin = req.headers?.origin;
    if (origin && ALLOWED_ORIGINS.has(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Methods', methods);
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    }
}
