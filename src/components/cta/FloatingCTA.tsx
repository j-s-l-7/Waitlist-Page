import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowRight, X, Copy, Check } from 'lucide-react';

type CTAState = 'hidden' | 'button' | 'input' | 'submitting' | 'modal' | 'collapsed';

// Keep in sync with api/waitlist.js.
const EMAIL_MAX_LENGTH = 254;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function isValidEmail(value: string) {
    const email = value.trim().toLowerCase();
    return email.length > 0 && email.length <= EMAIL_MAX_LENGTH && EMAIL_RE.test(email);
}

interface SubmitError {
    message: string;
    retryable: boolean;
    savedForRetry?: boolean;
}

const WHATSAPP_COMMUNITY_URL = 'https://chat.whatsapp.com/EIYeyk69kfAJfUWsTN0vc2';

// Device-local memory of the signup. Every access is guarded: storage can be
// unavailable (private mode, blocked site data) and the CTA must still work.
const JOINED_KEY = 'analyez_waitlist_joined';
const PENDING_KEY = 'analyez_waitlist_pending';

interface JoinedRecord {
    position: number | null;
    alreadyRegistered: boolean;
}

function readJoined(): JoinedRecord | null {
    try {
        const raw = window.localStorage.getItem(JOINED_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return null;
        return {
            position: typeof parsed.position === 'number' ? parsed.position : null,
            alreadyRegistered: parsed.alreadyRegistered === true,
        };
    } catch {
        return null;
    }
}

function saveJoined(record: JoinedRecord) {
    try {
        window.localStorage.setItem(JOINED_KEY, JSON.stringify(record));
        window.localStorage.removeItem(PENDING_KEY);
    } catch {
        // ignore: storage unavailable
    }
}

function clearJoined() {
    try {
        window.localStorage.removeItem(JOINED_KEY);
    } catch {
        // ignore: storage unavailable
    }
}

// Normalized on read; anything invalid is discarded, never POSTed.
function readPending(): string | null {
    try {
        const raw = window.localStorage.getItem(PENDING_KEY);
        if (!raw) return null;
        const value = raw.trim().toLowerCase();
        if (isValidEmail(value)) return value;
        window.localStorage.removeItem(PENDING_KEY);
        return null;
    } catch {
        return null;
    }
}

function savePending(email: string): boolean {
    try {
        window.localStorage.setItem(PENDING_KEY, email);
        return true;
    } catch {
        return false;
    }
}

function clearPending() {
    try {
        window.localStorage.removeItem(PENDING_KEY);
    } catch {
        // ignore: storage unavailable
    }
}

type PostResult =
    | { kind: 'ok'; position: number | null; alreadyRegistered: boolean }
    | { kind: 'invalid' }
    | { kind: 'failed'; status: number | null; timedOut?: boolean };

// Above the worst-case server path (15s connect + one retry) so slow pooler moments still succeed.
const SIGNUP_TIMEOUT_MS = 40000;

async function postSignup(email: string): Promise<PostResult> {
    // Never let the UI hang: abort after SIGNUP_TIMEOUT_MS (retryable failure).
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SIGNUP_TIMEOUT_MS);
    try {
        const res = await fetch('/api/waitlist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, market: 'india' }),
            signal: controller.signal,
        });
        const data = await res.json().catch(() => null);
        if (res.ok && data?.success === true) {
            return {
                kind: 'ok',
                position: typeof data.position === 'number' ? data.position : null,
                alreadyRegistered: data.alreadyRegistered === true,
            };
        }
        return res.status === 400 ? { kind: 'invalid' } : { kind: 'failed', status: res.status };
    } catch (err) {
        const timedOut = controller.signal.aborted;
        console.error(timedOut ? 'Waitlist API timed out' : 'Waitlist API error:', err);
        return { kind: 'failed', status: null, timedOut };
    } finally {
        clearTimeout(timer);
    }
}

interface FloatingCTAProps {
    visible: boolean;
}

// Minimum gap between signup attempts from this page, so Retry can never hammer the API.
const MIN_ATTEMPT_GAP_MS = 2000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Maps a failed POST to the inline error. Returns whether to queue the email
// on this device for a silent retry on the next visit.
function describeFailure(result: Exclude<PostResult, { kind: 'ok' }>): { error: SubmitError; queue: boolean } {
    if (result.kind === 'invalid') {
        return { error: { message: 'Please enter a valid email address.', retryable: false }, queue: false };
    }
    if (result.status === 429) {
        return { error: { message: 'Too many attempts. Please wait a minute and try again.', retryable: true }, queue: true };
    }
    if (result.status === null || result.status >= 500) {
        return {
            error: {
                message: result.timedOut
                    ? 'The request timed out. Please try again.'
                    : result.status === null
                        ? 'Network error. Check your connection and try again.'
                        : "We couldn't add you to the waitlist. Please try again.",
                retryable: true,
            },
            queue: true,
        };
    }
    // Any other 4xx: not something a retry will fix.
    return { error: { message: 'Something went wrong. Please try again later.', retryable: false }, queue: false };
}

export function FloatingCTA({ visible }: FloatingCTAProps) {
    const [state, setState] = useState<CTAState>('hidden');
    const [email, setEmail] = useState('');
    const [waitlistPosition, setWaitlistPosition] = useState<number | null>(null);
    const [alreadyRegistered, setAlreadyRegistered] = useState(false);
    const [submitError, setSubmitError] = useState<SubmitError | null>(null);
    const [copied, setCopied] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const hasSubmitted = useRef(false);
    const submitting = useRef(false);
    const lastAttemptAt = useRef(0);
    const pendingRetried = useRef(false);
    // The background retry of a queued email, so a manual submit of the same
    // email can await it instead of being dropped or double-posting.
    const silentRetry = useRef<{ email: string; promise: Promise<PostResult> } | null>(null);
    const modalTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Latest values for async callbacks.
    const stateRef = useRef(state);
    const visibleRef = useRef(visible);
    const emailRef = useRef(email);
    stateRef.current = state;
    visibleRef.current = visible;
    emailRef.current = email;
    const shareLink = 'anlyz.co/xwab9fn0';

    const clearModalTimer = () => {
        if (modalTimer.current !== null) {
            clearTimeout(modalTimer.current);
            modalTimer.current = null;
        }
    };

    useEffect(() => clearModalTimer, []);

    const applyJoined = (result: { position: number | null; alreadyRegistered: boolean }) => {
        saveJoined({ position: result.position, alreadyRegistered: result.alreadyRegistered });
        setWaitlistPosition(result.position);
        setAlreadyRegistered(result.alreadyRegistered);
        hasSubmitted.current = true;
    };

    // Returning visitor: if this device already joined, start collapsed.
    // Otherwise, silently retry a signup queued after an earlier
    // server/network failure (once per page load, never in a loop).
    useEffect(() => {
        const joined = readJoined();
        if (joined) {
            setWaitlistPosition(joined.position);
            setAlreadyRegistered(joined.alreadyRegistered);
            hasSubmitted.current = true;
            setState((s) => (s === 'button' ? 'collapsed' : s));
            return;
        }

        const pending = readPending();
        if (!pending || pendingRetried.current) return;
        pendingRetried.current = true;
        // Prefill only if the user has not typed anything.
        setEmail((current) => current || pending);

        lastAttemptAt.current = Date.now();
        const promise = postSignup(pending);
        silentRetry.current = { email: pending, promise };
        promise.then((result) => {
            silentRetry.current = null;
            if (result.kind === 'ok') {
                applyJoined(result);
                setSubmitError(null);
                // Collapse only if the user is not in the middle of something else.
                const current = stateRef.current;
                const typedOther = emailRef.current.trim().toLowerCase() !== pending && emailRef.current.trim() !== '';
                if (current === 'button' || (current === 'input' && !typedOther)) {
                    setState('collapsed');
                }
            } else if (!describeFailure(result).queue) {
                clearPending();
            }
            // Otherwise keep it queued for the next visit.
        });
    }, []);

    // Show/hide based on visibility prop
    useEffect(() => {
        if (visible && state === 'hidden') {
            // Small delay before showing for smooth appearance
            const timer = setTimeout(() => {
                setState(hasSubmitted.current ? 'collapsed' : 'button');
            }, 400);
            return () => clearTimeout(timer);
        } else if (!visible && state !== 'hidden') {
            // Hide CTA when immersive experience replays
            clearModalTimer();
            setState('hidden');
        }
    }, [visible, state]);

    // Revert from email input back to button if user scrolls away (DESKTOP ONLY).
    // On mobile, the input stays open permanently — the virtual keyboard causes
    // scroll events that would incorrectly dismiss the input.
    useEffect(() => {
        if (state !== 'input') return;

        // Skip scroll listener entirely on mobile — keep input open
        const isMobile = window.innerWidth <= 768;
        if (isMobile) return;

        const scrollYOnOpen = window.scrollY;
        let armed = false;

        // Grace period before listening for scroll
        const graceTimer = setTimeout(() => {
            armed = true;
        }, 600);

        const handleScroll = () => {
            if (!armed) return;
            if (Math.abs(window.scrollY - scrollYOnOpen) > 30) {
                setState('button');
            }
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => {
            clearTimeout(graceTimer);
            window.removeEventListener('scroll', handleScroll);
        };
    }, [state]);

    const handleButtonClick = () => {
        if (state === 'button') {
            setState('input');
            setTimeout(() => inputRef.current?.focus(), 350);
        } else if (state === 'collapsed') {
            setState('modal');
        }
    };

    const handleSubmit = async () => {
        if (submitting.current) return;
        const normalized = email.trim().toLowerCase();
        if (!isValidEmail(normalized)) {
            setSubmitError({ message: 'Please enter a valid email address.', retryable: false });
            return;
        }

        submitting.current = true;
        setSubmitError(null);
        setState('submitting');
        const startedAt = Date.now();

        let result: PostResult;
        const background = silentRetry.current;
        if (background && background.email === normalized) {
            // Same email is already being retried in the background: reuse it.
            result = await background.promise;
        } else {
            const gap = MIN_ATTEMPT_GAP_MS - (Date.now() - lastAttemptAt.current);
            if (gap > 0) await sleep(gap);
            lastAttemptAt.current = Date.now();
            result = await postSignup(normalized);
        }
        submitting.current = false;

        if (result.kind === 'ok') {
            applyJoined(result);
            // Keep the submitting animation visible briefly, as before.
            const wait = Math.max(0, 1200 - (Date.now() - startedAt));
            clearModalTimer();
            modalTimer.current = setTimeout(() => {
                modalTimer.current = null;
                if (visibleRef.current && stateRef.current === 'submitting') {
                    setState('modal');
                }
            }, wait);
            return;
        }

        // Never fake success: show the honest error, and queue the email on
        // this device for a silent retry on the next visit when that can help.
        const { error, queue } = describeFailure(result);
        const savedForRetry = queue && savePending(normalized);
        setSubmitError({ ...error, savedForRetry });

        // Back to the input with the typed email intact (unless hidden meanwhile).
        if (stateRef.current === 'submitting') {
            setState('input');
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    };

    const handleJoinDifferentEmail = () => {
        clearJoined();
        hasSubmitted.current = false;
        setWaitlistPosition(null);
        setAlreadyRegistered(false);
        setSubmitError(null);
        setEmail('');
        setState('input');
        setTimeout(() => inputRef.current?.focus(), 350);
    };

    const handleCloseModal = () => {
        setState('collapsed');
    };

    const handleCopyLink = () => {
        navigator.clipboard.writeText(`https://${shareLink}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleShare = (platform: string) => {
        const text = `I just joined the Analyez waitlist! Join me: https://${shareLink}`;
        const urls: Record<string, string> = {
            'X.com': `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`,
            'Threads': `https://threads.net/intent/post?text=${encodeURIComponent(text)}`,
            'LinkedIn': `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(`https://${shareLink}`)}`,
        };
        window.open(urls[platform], '_blank');
    };

    if (state === 'hidden') return null;

    return (
        <>
            {/* Backdrop for modal */}
            {state === 'modal' && (
                <div className="fcta-backdrop" onClick={handleCloseModal} />
            )}

            <div className={`fcta-container fcta-state-${state}`}>
                {/* State: Button / Collapsed */}
                {(state === 'button' || state === 'collapsed') && (
                    <button className="fcta-pill" onClick={handleButtonClick}>
                        <span className="fcta-pill-text">
                            {state === 'button' ? 'Get early access' : `You are #${waitlistPosition ?? '—'}`}
                        </span>
                    </button>
                )}

                {/* State: Input */}
                {state === 'input' && (
                    <div className="fcta-pill fcta-pill-input">
                        <input
                            ref={inputRef}
                            type="email"
                            className="fcta-email-input"
                            placeholder="Enter your email to join our waitlist"
                            maxLength={EMAIL_MAX_LENGTH}
                            autoComplete="email"
                            aria-invalid={submitError ? true : undefined}
                            aria-describedby={submitError ? 'fcta-error' : undefined}
                            value={email}
                            onChange={(e) => {
                                setEmail(e.target.value);
                                if (submitError) setSubmitError(null);
                            }}
                            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                        />
                        <button className="fcta-submit-btn" onClick={handleSubmit} aria-label="Join the waitlist">
                            <ArrowRight size={20} />
                        </button>
                    </div>
                )}

                {state === 'input' && submitError && (
                    <p className="fcta-error" id="fcta-error" role="alert">
                        <span>
                            {submitError.message}
                            {submitError.savedForRetry && (
                                <span className="fcta-error-note">
                                    We've saved your email on this device and will retry automatically.
                                </span>
                            )}
                        </span>
                        {submitError.retryable && (
                            <button className="fcta-error-retry" onClick={handleSubmit}>
                                Retry
                            </button>
                        )}
                    </p>
                )}

                {/* State: Submitting */}
                {state === 'submitting' && (
                    <div className="fcta-pill fcta-pill-submitting">
                        <span className="fcta-pill-text">Submitting...</span>
                    </div>
                )}

                {/* State: Modal */}
                {state === 'modal' && (
                    <div className="fcta-modal">
                        <button className="fcta-modal-close" onClick={handleCloseModal}>
                            <X size={20} />
                        </button>

                        <div className="fcta-modal-content">
                            <p className="fcta-modal-label">{alreadyRegistered ? "You're already on the list. You are" : 'You are'}</p>
                            <h2 className="fcta-modal-number">{waitlistPosition ?? '—'}</h2>
                            <p className="fcta-modal-sublabel">on the waitlist</p>

                            <a
                                className="fcta-whatsapp-link"
                                href={WHATSAPP_COMMUNITY_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                Join our WhatsApp community
                            </a>

                            <button className="fcta-different-email" onClick={handleJoinDifferentEmail}>
                                Join with a different email
                            </button>

                            <p className="fcta-modal-share-text">
                                Share your unique link below to get priority access. The more friends who join with your link, the sooner you'll get access.
                            </p>

                            <div className="fcta-share-link-row">
                                <span className="fcta-share-link">{shareLink}</span>
                                <button className="fcta-copy-btn" onClick={handleCopyLink}>
                                    {copied ? <Check size={16} /> : <Copy size={16} />}
                                </button>
                            </div>

                            <p className="fcta-share-or">or share directly to your favorite network</p>

                            <div className="fcta-social-row">
                                {['X.com', 'Threads', 'LinkedIn'].map((platform) => (
                                    <button
                                        key={platform}
                                        className="fcta-social-btn"
                                        onClick={() => handleShare(platform)}
                                    >
                                        {platform}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
