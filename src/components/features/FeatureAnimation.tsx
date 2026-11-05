import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle } from 'lucide-react';

export const FeatureAnimation = ({ market, onPhaseChange }: { market: 'india' | 'us', onPhaseChange?: (phase: 'idle' | 'prompt' | 'loading' | 'step3' | 'step4') => void }) => {
    // Animation Phase: 'idle' | 'prompt' | 'loading' | 'step3' | 'step4'
    const [phase, setPhase] = useState<'idle' | 'prompt' | 'loading' | 'step3' | 'step4'>('idle');
    const [typedText, setTypedText] = useState('');
    const [buttonClicked, setButtonClicked] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const fullPrompt = market === 'india'
        ? "Build me a portfolio of large cap, high free cash flow stocks with low pe ratios"
        : "Build me a portfolio of large cap, high free cash flow stocks with low pe ratios";

    const isVisibleRef = useRef(false);
    const savedPhaseRef = useRef<'idle' | 'prompt' | 'loading' | 'step3' | 'step4'>('prompt');

    // Track visibility — pause when leaving viewport, resume when entering
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        isVisibleRef.current = true;
                        // Resume from saved phase (or restart if idle)
                        const resumePhase = savedPhaseRef.current === 'idle' ? 'prompt' : savedPhaseRef.current;
                        setPhase(resumePhase);
                        setTypedText('');
                    } else {
                        isVisibleRef.current = false;
                        // Save current phase before pausing
                        setPhase((currentPhase) => {
                            savedPhaseRef.current = currentPhase;
                            return 'idle';
                        });
                    }
                });
            },
            { threshold: 0.3 }
        );

        if (containerRef.current) {
            observer.observe(containerRef.current);
        }

        return () => observer.disconnect();
    }, []);

    // Cycle Logic — only runs when visible
    useEffect(() => {
        if (!isVisibleRef.current && phase !== 'idle') return;

        let timeout: ReturnType<typeof setTimeout>;
        let cancelled = false;

        const runCycle = async () => {
            if (phase === 'prompt') {
                // Typewriter effect
                setTypedText('');
                await new Promise(r => setTimeout(r, 300));
                for (let i = 0; i <= fullPrompt.length; i++) {
                    if (cancelled || !isVisibleRef.current) return;
                    setTypedText(fullPrompt.slice(0, i));
                    await new Promise(r => setTimeout(r, 35));
                }
                // Wait 1.5s after typing finishes before moving to Step 2
                timeout = setTimeout(() => {
                    if (isVisibleRef.current) setPhase('loading');
                }, 1500);
            } else if (phase === 'loading') {
                // Step 2: Show stock list for 5 seconds
                timeout = setTimeout(() => {
                    if (isVisibleRef.current) setPhase('step3');
                }, 5000);
            } else if (phase === 'step3') {
                // Step 3: Show dashboard for 3s, then animate button click, then move to step4
                setButtonClicked(false);
                timeout = setTimeout(() => {
                    if (isVisibleRef.current) {
                        setButtonClicked(true);
                        // After button click animation, move to step4
                        setTimeout(() => {
                            if (isVisibleRef.current) setPhase('step4');
                        }, 1500);
                    }
                }, 3000);
            } else if (phase === 'step4') {
                // Step 4: Show result (final) for 5 seconds then loop
                timeout = setTimeout(() => {
                    if (isVisibleRef.current) setPhase('prompt');
                }, 5000);
            }
        };

        runCycle();

        return () => {
            cancelled = true;
            clearTimeout(timeout);
        };
    }, [phase]);

    // Notify parent of phase changes
    useEffect(() => {
        onPhaseChange?.(phase);
    }, [phase, onPhaseChange]);

    // Stock data for animation display
    const stocks = market === 'india' ? [
        { ticker: 'RELIANCE', name: 'Reliance Industries', sector: 'Energy', relevance: 5, weight: '10.20%', color: '#0ea5e9' },
        { ticker: 'TCS', name: 'Tata Consultancy', sector: 'Technology', relevance: 5, weight: '8.50%', color: '#3b82f6' },
        { ticker: 'HDFCBANK', name: 'HDFC Bank', sector: 'Financial', relevance: 5, weight: '9.10%', color: '#1e3a8a' },
        { ticker: 'INFY', name: 'Infosys', sector: 'Technology', relevance: 4, weight: '7.20%', color: '#2563eb' },
        { ticker: 'ICICIBANK', name: 'ICICI Bank', sector: 'Financial', relevance: 4, weight: '6.80%', color: '#033a63' }
    ] : [
        { ticker: 'PGR', name: 'Progressive', sector: 'Financial', relevance: 4, weight: '11.50%', color: '#3b82f6' },
        { ticker: 'MRK', name: 'Merck', sector: 'Healthcare', relevance: 4, weight: '9.10%', color: '#0d9488' },
        { ticker: 'VZ', name: 'Verizon', sector: 'Communication', relevance: 4, weight: '8.50%', color: '#000000' },
        { ticker: 'CMCSA', name: 'Comcast', sector: 'Consumer', relevance: 4, weight: '7.70%', color: '#6366f1' },
        { ticker: 'UBER', name: 'Uber', sector: 'Transportation', relevance: 3, weight: '6.90%', color: '#9ca3af' }
    ];

    return (
        <div ref={containerRef} className="ga-portfolio-card">
            {(phase === 'idle' || phase === 'prompt') ? (
                <div className="ga-card-prompt-state">
                    <div className="ga-clean-prompt-box">
                        <span className="ga-typing-text">{typedText}{(phase === 'prompt' && typedText.length < fullPrompt.length) && <span className="ga-cursor"></span>}</span>
                        <button className="ga-clean-submit">
                            <ArrowRight size={16} color="white" />
                        </button>
                    </div>
                </div>
            ) : (
                /* Glass Container - visible in 'loading', 'step3', and 'step4' phases */
                <div className={`ga-glass-container ${phase === 'step3' || phase === 'step4' ? 'populated' : 'loading'}`}>

                    {/* Step 2: Finding Matches List (visible during loading) */}
                    {phase === 'loading' && (
                        <div className="ga-searching-state fade-in">
                            <div className="ga-search-header">
                                <div className="ga-search-icon"></div>
                                <h3 className="ga-search-title">Large Cap, High Cash Flow Portfolio</h3>
                            </div>

                            <div className="ga-search-table">
                                <div className="ga-search-row header">
                                    <span className="col-ticker">Large cap 38</span>
                                    <span className="col-sector">Sector</span>
                                    <span className="col-rel">Relevance</span>
                                    <span className="col-weight">Weight</span>
                                </div>
                                {stocks.map((stock, i) => (
                                    <div key={i} className="ga-search-row item" style={{ animationDelay: `${i * 0.1}s` }}>
                                        <div className="col-ticker">
                                            <div className="stock-logo" style={{ backgroundColor: stock.color }}>{stock.ticker[0]}</div>
                                            <span className="stock-ticker ga-stock-ticker">{stock.ticker}</span>
                                        </div>
                                        <span className="col-sector">{stock.sector}</span>
                                        <div className="col-rel">
                                            <div className="relevance-bars">
                                                {[1, 2, 3, 4, 5].map(ba => (
                                                    <div key={ba} className={`rel-bar ${ba <= stock.relevance ? 'active' : ''}`}></div>
                                                ))}
                                            </div>
                                        </div>
                                        <span className="col-weight">{stock.weight}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="ga-search-footer">
                                <div className="ga-search-progress-bar">
                                    <div className="ga-search-progress-fill"></div>
                                </div>
                                <span className="ga-search-status">Finding matches</span>
                            </div>
                        </div>
                    )}

                    {/* Render Dashboard ONLY in step3 phase */}
                    {phase === 'step3' && (
                        <div className="ga-result-card fade-in">
                            {/* Row 1: Icon and Add Button */}
                            <div className="ga-result-top-row">
                                <div className="ga-result-icon">
                                    <div className="icon-circle"></div>
                                    <div className="icon-sparkle"></div>
                                </div>
                                <button className={`ga-add-portfolio-btn ${buttonClicked ? 'clicked' : ''}`}>
                                    {buttonClicked ? 'Adding...' : 'Add to portfolio'}
                                </button>
                            </div>

                            {/* Row 2: Title */}
                            <h2 className="ga-result-title">Large Cap, High Cash Flow</h2>

                            {/* Row 3: Description */}
                            <p className="ga-result-description">
                                A collection of companies building the fundamental infrastructure, technologies, and platforms that will power the immersive digital worlds of the metaverse, including hardware, software, networking, computing, and content creation tools.
                            </p>

                            {/* Row 4: Metrics Header */}
                            <h4 className="ga-historical-title">Historical return &amp; drawdown</h4>

                            {/* Row 5: Metrics & Legend */}
                            <div className="ga-metrics-legend-row">
                                <div className="ga-metrics-group">
                                    <div className="ga-metric-item">
                                        <span className="label">Historical returns</span>
                                        <span className="value positive" style={{ color: '#22c55e' }}>+232.23%</span>
                                        <span className="sub">{market === 'india' ? '+202.2% NIFTY 50' : '+202.2% S&P 500'}</span>
                                    </div>
                                    <div className="ga-metric-item">
                                        <span className="label">Max drawdown</span>
                                        <span className="value negative" style={{ color: '#ef4444' }}>-18.23%</span>
                                        <span className="sub">{market === 'india' ? '-61.65% NIFTY 50' : '-61.65% S&P 500'}</span>
                                    </div>
                                </div>
                                <div className="ga-chart-legend">
                                    <span className="legend-item portfolio"><span className="dot"></span> Portfolio</span>
                                    <span className="legend-item sp" style={{ color: '#93c5fd' }}>
                                        <span className="dot" style={{ backgroundColor: '#93c5fd' }}></span> {market === 'india' ? 'NIFTY 50' : 'S&P'}
                                    </span>
                                </div>
                            </div>

                            {/* Row 6: Chart with Pixel-Perfect Animated Paths */}
                            <div className="ga-main-result-chart">
                                <svg viewBox="0 0 420 160" className="ga-dash-chart-svg" style={{ overflow: 'visible', background: 'transparent' }}>
                                    {/* Portfolio line (blue) - High Fidelity Traced Path */}
                                    <motion.path
                                        d="M10,120 L25,118 L40,125 L55,135 L70,125 L85,140 L100,128 L115,145 L130,135 L145,150 L160,150 L175,130 L190,115 L205,120 L219,85 L231,105 L244,90 L257,93 L270,75 L285,60 L300,68 L315,90 L330,82 L345,85 L360,85 L375,70 L390,62 L405,80 L415,70"
                                        fill="none"
                                        stroke="#3b82f6"
                                        strokeWidth="2.5"
                                        strokeLinejoin="round"
                                        strokeLinecap="round"
                                        initial={{ pathLength: 0, opacity: 0 }}
                                        animate={{ pathLength: 1, opacity: 1 }}
                                        transition={{ duration: 1.5, ease: "easeInOut" }}
                                    />

                                    {/* S&P line (Light Blue) - High Fidelity Traced Path */}
                                    <motion.path
                                        d="M10,120 L30,115 L50,121 L70,118 L90,112 L110,115 L130,108 L150,112 L170,105 L190,110 L210,100 L230,125 L250,115 L270,118 L290,110 L310,105 L330,108 L350,108 L370,102 L390,105 L415,98"
                                        fill="none"
                                        stroke="#93c5fd"
                                        strokeWidth="2"
                                        strokeLinejoin="round"
                                        strokeLinecap="round"
                                        initial={{ pathLength: 0, opacity: 0 }}
                                        animate={{ pathLength: 1, opacity: 1 }}
                                        transition={{ duration: 1.5, ease: "easeInOut", delay: 0.2 }}
                                    />

                                    {/* High-Density Ticks at Bottom - Animated Fade In */}
                                    <motion.g
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ duration: 0.8, delay: 1 }}
                                    >
                                        {Array.from({ length: 90 }).map((_, i) => {
                                            const x = 10 + (i * 4.5);
                                            const height = i % 10 === 0 ? 12 : 6;
                                            return (
                                                <line
                                                    key={i}
                                                    x1={x} y1="160" x2={x} y2={160 - height}
                                                    stroke="#cbd5e1"
                                                    strokeWidth="0.8"
                                                    opacity={i % 5 === 0 ? 0.6 : 0.3}
                                                />
                                            );
                                        })}
                                    </motion.g>
                                </svg>
                            </div>
                        </div>
                    )}

                    {/* Step 4: Success Card (Investment Initiated) */}
                    {phase === 'step4' && (
                        <div className="ga-success-card fade-in">
                            <div className="ga-success-icon-container">
                                <CheckCircle size={48} color="#22c55e" fill="#dcfce7" strokeWidth={2} />
                            </div>
                            <h3 className="ga-success-title">₹15,000 investment initiated</h3>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
