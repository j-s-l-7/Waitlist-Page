import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowRight, X, Copy, Check } from 'lucide-react';

type CTAState = 'hidden' | 'button' | 'input' | 'submitting' | 'modal' | 'collapsed';

interface FloatingCTAProps {
    visible: boolean;
}

export function FloatingCTA({ visible }: FloatingCTAProps) {
    const [state, setState] = useState<CTAState>('hidden');
    const [email, setEmail] = useState('');
    const [waitlistPosition, setWaitlistPosition] = useState<number | null>(null);
    const [copied, setCopied] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const hasSubmitted = useRef(false);
    const shareLink = 'anlyz.co/xwab9fn0';

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
        if (!email || !email.includes('@')) return;
        setState('submitting');
        hasSubmitted.current = true;

        try {
            const res = await fetch('/api/waitlist', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, market: 'india' }),
            });

            if (res.ok) {
                const data = await res.json();
                if (data.success && data.position) {
                    setWaitlistPosition(data.position);
                }
            }
        } catch (err) {
            console.error('Waitlist API error:', err);
        }

        // Brief delay for submitting animation, then show modal
        setTimeout(() => {
            setState('modal');
        }, 1200);
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
                            {state === 'button' ? 'Get early access' : `You are #${waitlistPosition?.toLocaleString() ?? '—'}`}
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
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                        />
                        <button className="fcta-submit-btn" onClick={handleSubmit}>
                            <ArrowRight size={20} />
                        </button>
                    </div>
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
                            <p className="fcta-modal-label">You are</p>
                            <h2 className="fcta-modal-number">{waitlistPosition?.toLocaleString() ?? '—'}</h2>
                            <p className="fcta-modal-sublabel">on the waitlist</p>

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
