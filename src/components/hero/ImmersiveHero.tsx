import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ArrowRight } from 'lucide-react';
import { DashboardView } from '../views/DashboardView';
import type { DashboardData } from '../views/DashboardView';

// Immersive Hero Component - Controls the full Normal -> Immersive -> Dashboard -> Normal loop
interface ImmersiveHeroProps {
    phase: 'idle' | 'writing' | 'loading' | 'result';
    setPhase: (phase: 'idle' | 'writing' | 'loading' | 'result') => void;
}

export const ImmersiveHero = ({ phase, setPhase }: ImmersiveHeroProps) => {

    const [typedText, setTypedText] = useState('');
    const [userStopped, setUserStopped] = useState(false);
    const [arrowClicked, setArrowClicked] = useState(false);

    const fullPrompt = "Build me a portfolio of mid-cap tech stocks with high R&D spend as a % of revenue";

    // Dashboard data
    const dashboardData: DashboardData = {
        title: "Mid-Cap Tech R&D Innovators",
        assetsTotal: 12,
        description: "A portfolio of mid-cap technology companies that allocate a high percentage of their revenue to research and development, indicating potential for innovation and future growth.",
        tags: [
            {
                type: 'line',
                parts: [
                    { text: "Weighted", style: "normal" },
                    { text: "evenly", style: "pill" }
                ]
            },
            {
                type: 'line',
                parts: [
                    { text: "Limit to", style: "normal" },
                    { text: "Technology", style: "pill" },
                    { text: "sector and", style: "normal" },
                    { text: "$2B-$10B", style: "pill" },
                    { text: "range.", style: "normal" }
                ]
            },
            {
                type: 'custom',
                title: "Custom criteria",
                text: "High research and development spending as a percentage of revenue compared to industry peers."
            },
            {
                type: 'custom',
                title: "Custom criteria",
                text: "Companies with consistent and growing R&D spend."
            },
            {
                type: 'line',
                parts: [
                    { text: "Top 100 by", style: "normal" },
                    { text: "R&D department spend", style: "pill" }
                ]
            }
        ],
        metrics: {
            returns: "+1,226.1%",
            benchReturns: "+202.2% SENSEX",
            drawdown: "-33.21%",
            benchDrawdown: "-61.65% SENSEX",
            score: "1.82x",
            totalReturn: "+1,226.1%",
            cagr: "30.2%",
            avgAnnual: "+25.7%",
            returnsScore: "5.68x",
            stability: "0.96x",
            maxDd: "-33.1%",
            avgDd: "-6.8%",
            ddDuration: "3D",
            diversification: "0.12x"
        },
        allocations: [
            { ticker: "PERSISTENT", name: "Persistent Systems", industry: "Technology", price: "₹5,234", change: "-9.24%", weight: "6.25%", color: "#1a1a1a" },
            { ticker: "LTIM", name: "LTIMindtree", industry: "Technology", price: "₹5,678", change: "+2.91%", weight: "6.25%", color: "#ef4444" },
            { ticker: "COFORGE", name: "Coforge Ltd", industry: "Technology", price: "₹6,890", change: "+11.09%", weight: "6.25%", color: "#3b82f6" },
            { ticker: "MPHASIS", name: "Mphasis Ltd", industry: "Technology", price: "₹2,456", change: "+2.74%", weight: "6.25%", color: "#a855f7" }
        ]
    };

    // Main Cycle Logic — fast, seamless transitions
    useEffect(() => {
        if (userStopped && (phase === 'idle' || phase === 'writing')) return;

        let timeout: ReturnType<typeof setTimeout>;
        let cancelled = false;

        const runCycle = async () => {
            if (phase === 'writing') {
                // IMMEDIATELY start typing — no delay
                setTypedText('');
                setArrowClicked(false);

                // Fast typing: ~25ms per char = ~2s for 82 chars
                for (let i = 0; i <= fullPrompt.length && !cancelled; i++) {
                    setTypedText(fullPrompt.slice(0, i));
                    await new Promise(r => setTimeout(r, 32 + Math.random() * 12));
                }

                if (!cancelled && !userStopped) {
                    // Arrow button "click" animation
                    setArrowClicked(true);
                    await new Promise(r => setTimeout(r, 500));

                    // Seamlessly transition to loading (same prompt box morphs)
                    if (!cancelled) setPhase('loading');
                }
            }
            else if (phase === 'loading') {
                // Show loading for 1.2 seconds, then reveal dashboard
                timeout = setTimeout(() => {
                    setPhase('result');
                }, 1200);
            }
            else if (phase === 'result') {
                setUserStopped(true);
            }
        };

        runCycle();

        return () => {
            cancelled = true;
            clearTimeout(timeout);
        };
    }, [phase, userStopped]);

    const handleManualRestart = () => {
        setUserStopped(false);
        setTypedText('');
        setArrowClicked(false);
        setPhase('writing');
    };

    // Is the immersive experience active? (writing, loading, or result)
    const isImmersive = phase === 'writing' || phase === 'loading' || phase === 'result';

    return (
        <section className="ga-hero-wrapper">

            {/* 1. NORMAL HERO CONTENT — visible only when idle */}
            <div className={`ga-hero-normal ${isImmersive ? 'hidden' : ''}`}>
                <div className="ga-hero-content">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                    >
                        <span className="ga-hero-badge">Agentic Investing</span>
                    </motion.div>

                    <h1 className="ga-hero-title">
                        Portfolio<br />
                        Generated with AI.
                    </h1>

                    <p className="ga-hero-subtitle">
                        Now, you can create an investable Portfolio with AI & infinite possibilities.
                    </p>

                    {/* Normal Prompt Box */}
                    <div className="ga-prompt-box">
                        <textarea
                            className="ga-prompt-input"
                            value={typedText}
                            placeholder="Enter a prompt..."
                            readOnly
                            rows={1}
                        />
                        <button
                            className="ga-prompt-submit"
                            onClick={handleManualRestart}
                        >
                            <ArrowRight size={18} />
                        </button>
                    </div>


                </div>
            </div>


            {/* 2. IMMERSIVE OVERLAY — appears immediately on scroll (writing phase) */}
            <AnimatePresence>
                {isImmersive && (
                    <motion.div
                        className="ga-immersive-hero"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.4 }}
                    >
                        {/* Blurred Background — immediately visible during writing */}
                        <div
                            className="ga-immersive-bg"
                            style={{
                                backgroundImage: 'url(/images/hero-bg.png)',
                                filter: `blur(${phase === 'result' ? 4 : 12}px)`,
                                transform: `scale(${phase === 'result' ? 1.05 : 1.08})`
                            }}
                        />
                        <div className="ga-immersive-overlay" />

                        <div className={`ga-immersive-content ${phase === 'result' ? 'phase-result' : ''}`}>
                            {/* PHASE 1 & 2: Prompt box that morphs into generating */}
                            {(phase === 'writing' || phase === 'loading') && (
                                <motion.div
                                    className="ga-immersive-prompt-container"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -20, scale: 0.95 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    <div className={`ga-prompt-box immersive ${phase === 'loading' ? 'generating' : ''}`}>
                                        {/* Prompt content — always in DOM, hidden when generating */}
                                        <div className={`ga-prompt-writing ${phase === 'loading' ? 'hidden' : ''}`}>
                                            <textarea
                                                className="ga-prompt-input"
                                                value={typedText}
                                                placeholder="Enter a prompt..."
                                                readOnly
                                                rows={1}
                                            />
                                            <button
                                                className={`ga-prompt-submit ${arrowClicked ? 'clicked' : ''}`}
                                            >
                                                <ArrowRight size={18} />
                                            </button>
                                        </div>
                                        {/* Generating content — always in DOM, shown when generating */}
                                        <div className={`ga-prompt-generating ${phase === 'loading' ? 'visible' : ''}`}>
                                            <span className="ga-generating-inline">
                                                Generating
                                                <span className="ga-dots">
                                                    <span className="dot">.</span>
                                                    <span className="dot">.</span>
                                                    <span className="dot">.</span>
                                                </span>
                                            </span>
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {/* PHASE 3: Dashboard with sequential card reveal */}
                            {phase === 'result' && (
                                <DashboardView data={dashboardData} startReveal={phase === 'result'} />
                            )}
                        </div>

                        {/* Scroll indicator */}
                        {phase === 'result' && (
                            <motion.div
                                className="ga-immersive-scroll"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.5 }}
                            >
                                <span>Scroll for more</span>
                                <ChevronDown size={16} />
                            </motion.div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </section>
    );
};
