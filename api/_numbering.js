// Display numbering for waitlist positions (underscore = not a route).
//
// `rank` is the stored, 1-based signup order (waitlist.signups.rank, assigned
// as max(rank) + 1 under an advisory lock). Ranks 1..9 show as 771..779;
// rank 10 onwards shows as 7771, 7772, ... (rank <= 9 ? 770 + rank : 7761 + rank).
// Rank 0 (no signups yet) shows as 770. Ranks are stored, so deleting rows
// leaves a gap but never changes anyone else's number.
export function displayNumber(rank) {
    const n = Number(rank);
    if (!Number.isInteger(n) || n < 0) throw new RangeError(`invalid rank: ${rank}`);
    return n <= 9 ? 770 + n : 7761 + n;
}
