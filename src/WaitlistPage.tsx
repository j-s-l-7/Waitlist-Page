/**
 * Analyez — Agentic Investing Waitlist Page
 * Premium single-page landing with immersive hero, feature showcase, and waitlist capture.
 */

import { useState, useEffect, useRef } from 'react';
import { ArrowRight } from 'lucide-react';
import { indiaConfig } from './config/india';
import type { MarketConfig } from './config/india';
import { usConfig } from './config/us';

// Components
import { ImmersiveHero } from './components/hero/ImmersiveHero';
import { FeatureAnimation } from './components/features/FeatureAnimation';
import { FloatingCTA } from './components/cta/FloatingCTA';
import { FAQItem } from './components/faq/FAQItem';


interface WaitlistPageProps {
    market: 'india' | 'us';
}

// Main Page Component
export default function WaitlistPage({ market }: WaitlistPageProps) {
    const config: MarketConfig = market === 'india' ? indiaConfig : usConfig;

    const [navDark, setNavDark] = useState(false);
    // Lifted state from ImmersiveHero
    const [heroPhase, setHeroPhase] = useState<'idle' | 'writing' | 'loading' | 'result'>('idle');
    const [waitlistEmail, setWaitlistEmail] = useState('');
    const [emailSubmitting, setEmailSubmitting] = useState(false);
    const [emailSubmitted, setEmailSubmitted] = useState(false);
    const [waitlistPosition, setWaitlistPosition] = useState<number | null>(null);

    const WHATSAPP_LINK = 'https://chat.whatsapp.com/JRpzRy4APUZ8w4vmNiTjek?mode=gi_c';

    const handleWaitlistSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!waitlistEmail || !waitlistEmail.includes('@')) return;

        setEmailSubmitting(true);
        try {
            const res = await fetch('/api/waitlist', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: waitlistEmail, market }),
            });
            const data = await res.json();
            if (data?.position) {
                setWaitlistPosition(data.position);
            }
        } catch (err) {
            console.log('API not available locally, skipping save');
        }
        setEmailSubmitted(true);
        setEmailSubmitting(false);
        // Redirect to WhatsApp after a brief delay
        setTimeout(() => {
            window.open(WHATSAPP_LINK, '_blank');
        }, 1200);
    };
    const [isScrolled, setIsScrolled] = useState(false);
    // Track whether immersive experience has completed — prevents scroll lock from re-engaging
    const hasCompletedImmersive = useRef(false);

    // Global page zoom — scales everything proportionally with viewport width
    const [pageZoom, setPageZoom] = useState(1);
    useEffect(() => {
        const calcZoom = () => {
            // Disable zoom on mobile — let native responsive CSS handle layout
            if (window.innerWidth < 768) {
                setPageZoom(1);
                return;
            }
            setPageZoom(Math.min(window.innerWidth / 1200, 1));
        };
        calcZoom();
        window.addEventListener('resize', calcZoom);
        return () => window.removeEventListener('resize', calcZoom);
    }, []);

    // Animation Phase for steps
    const [animationPhase, setAnimationPhase] = useState<'idle' | 'prompt' | 'loading' | 'step3' | 'step4'>('idle');

    // SCROLL LOCK & TRIGGER LOGIC
    useEffect(() => {
        // Mark immersive as completed once we reach 'result'
        if (heroPhase === 'result') {
            hasCompletedImmersive.current = true;
        }

        // If immersive already completed, never re-lock scroll
        if (hasCompletedImmersive.current) {
            document.body.style.overflow = '';
            return;
        }

        // Handler to prevent scroll and trigger animation if idle AND at top
        const handleScrollInteraction = (e: Event) => {
            if (window.scrollY < 10) {
                if (heroPhase === 'idle' || heroPhase === 'writing' || heroPhase === 'loading') {
                    e.preventDefault();
                }
                if (heroPhase === 'idle') {
                    setHeroPhase('writing');
                }
            }
        };

        const handleKeyInteraction = (e: KeyboardEvent) => {
            if (['ArrowDown', 'Space', 'PageDown'].includes(e.code)) {
                if (window.scrollY < 10 && (heroPhase === 'idle' || heroPhase === 'writing' || heroPhase === 'loading')) {
                    e.preventDefault();
                }
                if (window.scrollY < 10 && heroPhase === 'idle') {
                    setHeroPhase('writing');
                }
            }
        };

        // Click anywhere triggers immersive on first visit
        const handleClickTrigger = (e: MouseEvent) => {
            if (heroPhase === 'idle' && window.scrollY < 10) {
                setHeroPhase('writing');
            }
        };

        // Only lock body overflow if at top and not in result phase
        if (heroPhase !== 'result') {
            if (window.scrollY < 10) {
                document.body.style.overflow = 'hidden';
            }
            window.addEventListener('wheel', handleScrollInteraction, { passive: false });
            window.addEventListener('touchmove', handleScrollInteraction, { passive: false });
            window.addEventListener('keydown', handleKeyInteraction);
            window.addEventListener('click', handleClickTrigger);
        } else {
            document.body.style.overflow = '';
        }

        return () => {
            document.body.style.overflow = '';
            window.removeEventListener('wheel', handleScrollInteraction);
            window.removeEventListener('touchmove', handleScrollInteraction);
            window.removeEventListener('keydown', handleKeyInteraction);
            window.removeEventListener('click', handleClickTrigger);
        };
    }, [heroPhase]);

    // Reset hero to normal state after immersive completes and user scrolls past
    useEffect(() => {
        if (heroPhase === 'result' && hasCompletedImmersive.current) {
            const handleScrollReset = () => {
                if (window.scrollY > window.innerHeight * 0.8) {
                    setHeroPhase('idle');
                }
            };
            window.addEventListener('scroll', handleScrollReset);
            return () => window.removeEventListener('scroll', handleScrollReset);
        }
    }, [heroPhase]);

    const featuresRightRef = useRef<HTMLDivElement>(null);

    // Auto-scroll steps on mobile based on animation phase
    useEffect(() => {
        if (!featuresRightRef.current) return;
        // Simple check, though CSS handles visual layout
        if (window.innerWidth > 768) return;

        let activeIndex = 0;
        if (animationPhase === 'idle' || animationPhase === 'prompt') activeIndex = 0;
        else if (animationPhase === 'loading') activeIndex = 1;
        else if (animationPhase === 'step3') activeIndex = 2;
        else if (animationPhase === 'step4') activeIndex = 3;


        const container = featuresRightRef.current;
        const firstStep = container.querySelector('.ga-step');
        // 16px is the gap
        const scrollAmount = firstStep ? (firstStep.clientWidth + 16) * activeIndex : 0;

        container.scrollTo({
            left: scrollAmount,
            behavior: 'smooth'
        });
    }, [animationPhase]);

    // Detect scroll position to change nav color AND reset hero
    useEffect(() => {
        const handleScroll = () => {
            // Reset Hero if scrolled away
            if (window.scrollY > 400 && heroPhase === 'result') {
                setHeroPhase('idle');
            }

            const navHeight = 80; // Standard threshold
            setIsScrolled(window.scrollY > 20);
            let isOverDark = false;

            // List of dark section selectors
            // Note: .ga-waitlist-cta is only dark on mobile (<768px)
            const darkSectionSelectors = ['.ga-comparison', '.ga-ideas'];

            for (const selector of darkSectionSelectors) {
                const element = document.querySelector(selector);
                if (element) {
                    const rect = element.getBoundingClientRect();
                    // Check if the section hits the nav area
                    if (rect.top <= navHeight && rect.bottom >= navHeight) {
                        isOverDark = true;
                        break; // Found a dark section, no need to check others
                    }
                }
            }

            // Nav is dark if over a dark section
            setNavDark(isOverDark);
        };

        window.addEventListener('scroll', handleScroll);
        // Call once to set initial state
        handleScroll();

        return () => window.removeEventListener('scroll', handleScroll);
    }, [heroPhase]); // Re-run when heroPhase changes

    return (
        <div className="waitlist-page" style={{ zoom: pageZoom }}>
            {/* Navigation */}
            <nav className={`ga-nav ${navDark ? 'dark' : ''} ${isScrolled ? 'scrolled' : ''} ${!hasCompletedImmersive.current && heroPhase !== 'result' ? 'nav-locked' : ''}`}>
                <div className="ga-nav-logo">
                    <div className="ga-logo-icon"></div>
                    Analyez
                </div>


            </nav>

            {/* IMMERSIVE HERO - Full-viewport experience */}
            <ImmersiveHero phase={heroPhase} setPhase={setHeroPhase} />

            {/* Features Section - "How it works" */}
            <section className="ga-features" id="features">
                <h2 className="ga-features-title">
                    Turn any idea into<br />an investable Portfolio
                </h2>

                <div className="ga-features-content">
                    <div className="ga-features-left">
                        <FeatureAnimation market={market} onPhaseChange={setAnimationPhase} />
                    </div>

                    <div className="ga-features-right" ref={featuresRightRef}>
                        {config.steps.map((step: { number: string; title: string; description: string }, index: number) => {
                            // Determine if this step is active based on animation phase
                            const isActive =
                                ((animationPhase === 'idle' || animationPhase === 'prompt') && index === 0) ||
                                (animationPhase === 'loading' && index === 1) ||
                                (animationPhase === 'step3' && index === 2) ||
                                (animationPhase === 'step4' && index === 3);

                            return (
                                <div key={step.number} className={`ga-step ${isActive ? 'active' : ''}`}>
                                    <span className="ga-step-number">{step.number}</span>
                                    <div className="ga-step-content">
                                        <h3>{step.title}</h3>
                                        <p>{step.description}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>



            {/* Comparison Section - Dark background */}
            <section className="ga-comparison" id="compare">
                {/* Decorative visuals */}
                <div className="ga-comparison-arcs">
                    {/* SVG Arcs or background image would go here if needed, for now keeping existing structure */}
                </div>
                <div className="ga-comp-glow top-left"></div>
                <div className="ga-glow-bottom-right"></div>

                <div className="ga-comp-content">
                    <h2 className="ga-comparison-title">
                        Advisers/PMS are one-size-fits-all.<br />
                        Agentic Investing is <span style={{ whiteSpace: 'nowrap' }}>one-of-a-kind.</span>
                    </h2>
                    <p className="ga-comparison-subtitle">
                        Traditional Advisers charge 2% of portfolio value annually. Agentic Investing is built for new era of Investing.
                    </p>

                    {/* Desktop: Side-by-side table */}
                    <div className="ga-comparison-table ga-comparison-desktop">
                        <div className="ga-comparison-header">
                            <div className="ga-comparison-header-cell">Agentic Investing</div>
                            <div className="ga-comparison-header-cell muted">Advisers/PMS</div>
                        </div>

                        <div className="ga-comparison-row">
                            <div className="ga-comparison-cell highlight">Built by you with AI</div>
                            <div className="ga-comparison-cell muted">Traditional Advisers</div>
                        </div>

                        <div className="ga-comparison-row">
                            <div className="ga-comparison-cell highlight">Based on your thesis</div>
                            <div className="ga-comparison-cell muted">Based on a predefined strategy</div>
                        </div>

                        <div className="ga-comparison-row">
                            <div className="ga-comparison-cell highlight">Endlessly customizable</div>
                            <div className="ga-comparison-cell muted">No customization</div>
                        </div>

                        <div className="ga-comparison-row">
                            <div className="ga-comparison-cell highlight">Any Amount</div>
                            <div className="ga-comparison-cell muted">50L+ only</div>
                        </div>
                    </div>

                    {/* Mobile: Vertical stacked sections */}
                    <div className="ga-comparison-mobile">
                        {/* Section 1: Agentic Investing */}
                        <div className="ga-comparison-mobile-section">
                            <h3 className="ga-comparison-mobile-header">Agentic Investing</h3>
                            <div className="ga-comparison-mobile-item highlight">Built by you with AI</div>
                            <div className="ga-comparison-mobile-item highlight">Based on your thesis</div>
                            <div className="ga-comparison-mobile-item highlight">Endlessly customizable</div>
                            <div className="ga-comparison-mobile-item highlight">Any Amount</div>
                        </div>

                        {/* Section 2: Advisers/PMS */}
                        <div className="ga-comparison-mobile-section">
                            <h3 className="ga-comparison-mobile-header muted">Advisers/PMS</h3>
                            <div className="ga-comparison-mobile-item muted">Traditional Advisers</div>
                            <div className="ga-comparison-mobile-item muted">Based on a predefined strategy</div>
                            <div className="ga-comparison-mobile-item muted">No customization</div>
                            <div className="ga-comparison-mobile-item muted">50L+ only</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Customization Section — "Make it yours" */}
            <section className="ga-customize">
                <div className="ga-customize-visual">
                    {/* Blurred background mock */}
                    <div className="ga-customize-blur">
                        <div className="ga-blur-row text" style={{ width: '60%' }}></div>
                        <div className="ga-blur-row text" style={{ width: '80%' }}></div>
                        <div className="ga-blur-row text" style={{ width: '40%' }}></div>
                        <div className="ga-blur-row chart"></div>
                    </div>

                    {/* Floating Context Card */}
                    <div className="ga-prompt-card">
                        <div className="ga-prompt-line">
                            Limit to <span className="ga-token">Basic Materials</span> sector
                        </div>
                        <div className="ga-prompt-line">
                            Revenue growth over <span className="ga-token">1Y</span> in the <span className="ga-token">&gt;10%</span> range
                        </div>
                        <div className="ga-prompt-line">
                            R&D as percentage of sales in the <span className="ga-token">&gt;5%</span> range
                        </div>
                        <div className="ga-prompt-section">
                            <div className="ga-prompt-label">Custom criteria</div>
                            <div className="ga-prompt-text mono">
                                Has more than 30% revenue exposure to China
                            </div>
                        </div>
                    </div>
                </div>

                <div className="ga-customize-content">
                    <span className="ga-customize-label">Customization</span>
                    <h2 className="ga-customize-title">
                        Make it yours.<br />
                        Down to the last detail.
                    </h2>
                    <p className="ga-customize-desc">
                        The conversation doesn't stop at creation. You can continue to refine your asset with follow-up prompts—adjust weightings, remove tickers, and more.
                    </p>
                </div>
            </section>

            {/* Ideas Section — "The market is full of untapped ideas" */}
            <section className="ga-ideas" id="untapped-ideas">
                <div className="ga-ideas-content">
                    <h2 className="ga-ideas-title">
                        The market is full of <br />
                        untapped ideas.<br />
                        What's yours?
                    </h2>



                    <p className="ga-ideas-footnote">
                        * For illustrative purposes only. Not a recommendation of any security or strategy.
                    </p>
                </div>

                {/* Grid Overlay / Visuals */}
                <div className="ga-ideas-visual">
                    <div className="ga-grid-overlay">
                        <div className="ga-grid-cell"></div>
                        <div className="ga-grid-cell"></div>
                        <div className="ga-grid-cell"></div>
                        <div className="ga-grid-cell active-idea">
                            <span className="ga-dot"></span>
                            <span className="ga-idea-text">
                                GLP-1 drug manufacturers with R&D spend above 20% of revenue.
                            </span>
                        </div>
                        <div className="ga-grid-cell"></div>
                        <div className="ga-grid-cell"></div>
                    </div>
                </div>
            </section>

            {/* FAQ Section */}
            <section className="ga-faq" id="faq">
                <h2 className="ga-faq-title">Frequently asked questions</h2>
                <div className="ga-faq-grid">
                    {config.faq.map((item: { question: string; answer: string }, i: number) => (
                        <FAQItem key={i} question={item.question} answer={item.answer} />
                    ))}
                </div>
            </section>


            {/* Footer */}
            <footer className="ga-footer">
                <div className="ga-footer-content">
                    <div className="ga-footer-logo">Agentic Investing</div>
                    <div className="ga-footer-links">
                        <a href="#">Privacy Policy</a>
                        <a href="#">Terms of Service</a>
                        <a href="https://mail.google.com/mail/?view=cm&fs=1&to=JayeshLutthra77@gmail.com" target="_blank" rel="noopener noreferrer">Contact</a>
                    </div>
                    <div className="ga-copyright">
                        © 2026 Agentic Investing. All rights reserved.
                    </div>
                </div>
            </footer>

            {/* Floating CTA — appears after immersive hero completes */}
            <FloatingCTA visible={heroPhase === 'result' || (hasCompletedImmersive.current && heroPhase === 'idle')} />
        </div >
    );
}
