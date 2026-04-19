import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { ChevronDown, Settings, Share2 } from 'lucide-react';

interface TagPart {
    text: string;
    style: 'normal' | 'pill';
}

interface TagLine {
    type: 'line';
    parts: TagPart[];
}

interface TagCustom {
    type: 'custom';
    title: string;
    text: string;
}

type DashboardTag = TagLine | TagCustom;

export interface Allocation {
    ticker: string;
    name: string;
    industry: string;
    price: string;
    change: string;
    weight: string;
    color: string;
}

export interface DashboardData {
    title: string;
    assetsTotal: number;
    description: string;
    tags: DashboardTag[];
    metrics: {
        returns: string;
        benchReturns: string;
        drawdown: string;
        benchDrawdown: string;
        score: string;
        totalReturn: string;
        cagr: string;
        avgAnnual: string;
        returnsScore: string;
        stability: string;
        maxDd: string;
        avgDd: string;
        ddDuration: string;
        diversification: string;
    };
    allocations: Allocation[];
}

interface DashboardViewProps {
    data: DashboardData;
    startReveal?: boolean;
}

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.12, delayChildren: 0.2 }
    }
};

const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
};

// Design dimensions — the dashboard is designed to look perfect at this size
const DESIGN_WIDTH = 1100;
const DESIGN_HEIGHT = 950;

// Vertical space consumed by nav, padding, CTA, and margins
const CHROME_VERTICAL = 200;
// Horizontal padding inside the immersive content area
const CHROME_HORIZONTAL = 80;

export const DashboardView = ({ data, startReveal = false }: DashboardViewProps) => {
    const [scale, setScale] = useState(1);
    const [visibleCards, setVisibleCards] = useState(0);
    const [chartReady, setChartReady] = useState(false);

    useEffect(() => {
        if (startReveal && visibleCards === 0) {
            setVisibleCards(1);
        }
    }, [startReveal]);

    const handleCardRevealed = (cardNum: number) => {
        // Only advance on clip-path transition end
        if (cardNum === 1 && visibleCards === 1) setVisibleCards(2);
        else if (cardNum === 2 && visibleCards === 2) setVisibleCards(3);
        else if (cardNum === 3 && visibleCards === 3) setChartReady(true);
    };

    useEffect(() => {
        const calcScale = () => {
            const vw = window.innerWidth;
            if (vw < 768) {
                setScale(1);
                return;
            }
            const vh = window.innerHeight;
            // Available space after nav, padding, CTA
            const availableH = vh - CHROME_VERTICAL;
            const availableW = vw - CHROME_HORIZONTAL;
            // Scale to fit both vertically and horizontally
            const s = Math.min(availableH / DESIGN_HEIGHT, availableW / DESIGN_WIDTH, 1);
            setScale(Math.max(s, 0.55)); // Floor to prevent too-tiny rendering
        };
        calcScale();
        window.addEventListener('resize', calcScale);
        return () => window.removeEventListener('resize', calcScale);
    }, []);
    return (
        <motion.div
            className="ga-immersive-dashboard-wrapper"
            initial="hidden"
            animate="visible"
            variants={containerVariants}
            style={{
                zoom: scale,
            }}
        >
            {/* Three-Card Layout */}
            {/* Vertical Stack Layout — Context, Analytics, Allocation */}
            <div className="ga-dashboard-stack">
                {/* SECTION 1: Context/Criteria (Top) — sequential reveal */}
                <motion.div
                    className={`ga-card ga-card-context ${visibleCards >= 1 ? 'card-revealed' : 'card-hidden'}`}
                    onTransitionEnd={(e) => { if ((e as any).propertyName === 'clip-path') handleCardRevealed(1); }}
                >
                    <div className="ga-dash-header">
                        <span className="title">{data.title}</span>
                        <span className="progress">100%</span>
                    </div>
                    <div className="ga-dash-tags">
                        {data.tags.map((tag: DashboardTag, i: number) => (
                            <div key={i} className="ga-dash-tag">
                                {tag.type === 'custom' ? (
                                    <>
                                        <span className="tag-title">{tag.title}</span>
                                        <p className="tag-text">{tag.text}</p>
                                    </>
                                ) : (
                                    <div className="ga-tag-line">
                                        {tag.parts.map((part: TagPart, k: number) => (
                                            <span key={k} className={part.style === 'pill' ? 'ga-pill' : 'ga-text'}>
                                                {part.text}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </motion.div>

                {/* SECTION 2: Analytics & Chart (Middle) */}
                <motion.div
                    className={`ga-card ga-card-analytics ${visibleCards >= 2 ? 'card-revealed' : 'card-hidden'}`}
                    onTransitionEnd={(e) => { if ((e as any).propertyName === 'clip-path') handleCardRevealed(2); }}
                >
                    <div className="ga-dash-header">
                        <div className="ga-dash-title-row">
                            <span className="small-green-dot"></span>
                            <span className="serif-title">{data.title}</span>
                        </div>
                        <span className="assets-count-cyan">{data.assetsTotal} assets total</span>
                    </div>
                    <p className="ga-dash-desc-refined">{data.description}</p>

                    <div className="ga-dash-main-grid-refined">
                        {/* Left: Historical Metrics & Graph */}
                        <div className="ga-dash-chart-section-refined">
                            <div className="section-title-refined">Historical return & drawdown</div>

                            <div className="ga-hist-metrics-row">
                                <div className="metrics-group-outer">
                                    <div className="metric-group">
                                        <span className="metric-label">Historical returns</span>
                                        <span className="metric-value-large green">{data.metrics.returns}</span>
                                        <span className="metric-comparison">{data.metrics.benchReturns}</span>
                                    </div>
                                    <div className="metric-group">
                                        <span className="metric-label">Max drawdown</span>
                                        <span className="metric-value-large red">{data.metrics.drawdown}</span>
                                        <span className="metric-comparison">{data.metrics.benchDrawdown}</span>
                                    </div>
                                </div>

                                <div className="ga-chart-legend-pills-vertical">
                                    <div className="legend-pill-blue">
                                        <span className="dot blue"></span> Portfolio
                                    </div>
                                    <div className="legend-pill-grey">
                                        <span className="dot grey"></span> SENSEX
                                    </div>
                                </div>
                            </div>

                            <div className="ga-chart-container-refined">
                                <svg viewBox="0 0 400 140" className="chart-svg-refined" preserveAspectRatio="none">
                                    {/* Subtle horizontal grid lines */}
                                    <line x1="0" y1="20" x2="400" y2="20" stroke="#f1f5f9" strokeWidth="0.5" />
                                    <line x1="0" y1="40" x2="400" y2="40" stroke="#f1f5f9" strokeWidth="0.5" />
                                    <line x1="0" y1="60" x2="400" y2="60" stroke="#f1f5f9" strokeWidth="0.5" />
                                    <line x1="0" y1="80" x2="400" y2="80" stroke="#f1f5f9" strokeWidth="0.5" />

                                    {/* Blue "Portfolio" line — strong upward trend with natural dips */}
                                    <path
                                        className={`chart-line-blue ${chartReady ? 'draw' : ''}`}
                                        d="M0,82 C10,80 20,78 30,76 C40,74 50,77 60,75 C70,73 80,68 90,64 C100,60 110,63 120,66 C130,69 135,65 140,60 C150,55 160,52 170,48 C180,44 190,46 200,50 C210,54 215,48 220,42 C230,36 240,33 250,30 C260,27 270,32 280,35 C290,38 295,30 300,25 C310,20 320,22 330,18 C340,14 350,16 360,20 C370,24 380,15 390,12 L400,10"
                                        fill="none"
                                        stroke="#3b82f6"
                                        strokeWidth="1.8"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />

                                    {/* Grey "SENSEX" line — flatter, modest growth */}
                                    <path
                                        className={`chart-line-grey ${chartReady ? 'draw' : ''}`}
                                        d="M0,82 C10,81 20,82 30,80 C40,79 50,81 60,80 C70,79 80,77 90,76 C100,75 110,77 120,78 C130,79 135,77 140,75 C150,73 160,74 170,72 C180,70 190,72 200,74 C210,76 215,73 220,71 C230,69 240,70 250,68 C260,66 270,68 280,70 C290,72 295,69 300,67 C310,65 320,66 330,64 C340,62 350,64 360,66 C370,68 380,63 390,62 L400,60"
                                        fill="none"
                                        stroke="#94a3b8"
                                        strokeWidth="1.2"
                                        strokeDasharray="4 2"
                                        strokeLinecap="round"
                                    />

                                    {/* Drawdown bars — hanging downward from baseline */}
                                    {Array.from({ length: 80 }).map((_, i) => {
                                        const h = 4 + Math.abs(Math.sin(i * 0.7) * 14 + Math.cos(i * 1.3) * 6);
                                        const isNeg = Math.sin(i * 0.9 + 1) > 0.3;
                                        return (
                                            <rect
                                                key={i}
                                                x={i * 5}
                                                y={108}
                                                width="2.5"
                                                height={h}
                                                fill={isNeg ? '#cbd5e1' : '#93c5fd'}
                                                opacity={0.8}
                                                rx="0.5"
                                            />
                                        );
                                    })}
                                </svg>
                            </div>

                            <div className="ga-dash-bottom-controls">
                                <div className="time-selectors-group">
                                    <button className="time-btn-sq">1Y</button>
                                    <button className="time-btn-sq">3Y</button>
                                    <button className="time-btn-sq">5Y</button>
                                    <button className="time-btn-sq">10Y</button>
                                    <button className="time-btn-sq">Max</button>
                                    <button className="time-btn-sq custom">Custom <ChevronDown size={12} /></button>
                                </div>
                                <div className="chart-actions-refined">
                                    <button className="icon-btn-refined"><Settings size={14} /></button>
                                    <button className="icon-btn-refined"><Share2 size={14} /></button>
                                </div>
                            </div>
                        </div>

                        {/* Right: Score Panel */}
                        <div className="ga-dash-score-panel-refined">
                            <div className="score-header-refined">
                                <span className="score-label-refined">Asset score</span>
                                <span className="score-value-huge">{data.metrics.score}</span>
                                <div className="rainbow-progress-bar"></div>
                            </div>

                            <div className="score-section-refined">
                                <div className="section-header-row">
                                    <span className="section-label-refined">Returns</span>
                                    <span className="section-value-bold">{data.metrics.returnsScore}</span>
                                </div>
                                <div className="detail-rows-compact">
                                    <div className="detail-row"><span>Total return</span><b>{data.metrics.totalReturn}</b></div>
                                    <div className="detail-row"><span>CAGR</span><b>{data.metrics.cagr}</b></div>
                                    <div className="detail-row"><span>Avg. annual return</span><b>{data.metrics.avgAnnual}</b></div>
                                </div>
                            </div>

                            <div className="score-section-refined">
                                <div className="section-header-row">
                                    <span className="section-label-refined">Stability</span>
                                    <span className="section-value-bold">{data.metrics.stability}</span>
                                </div>
                                <div className="detail-rows-compact">
                                    <div className="detail-row"><span>Max drawdown</span><b>{data.metrics.maxDd}</b></div>
                                    <div className="detail-row"><span>Avg. drawdown</span><b>{data.metrics.avgDd}</b></div>
                                    <div className="detail-row"><span>Avg. drawdown duration</span><b>{data.metrics.ddDuration}</b></div>
                                </div>
                            </div>

                            <div className="score-section-refined">
                                <div className="section-header-row">
                                    <span className="section-label-refined">Diversification</span>
                                    <span className="section-value-bold">{data.metrics.diversification}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* SECTION 3: Allocation Table (Bottom) */}
                <motion.div
                    className={`ga-card ga-card-allocation ${visibleCards >= 3 ? 'card-revealed' : 'card-hidden'}`}
                    onTransitionEnd={(e) => { if ((e as any).propertyName === 'clip-path') handleCardRevealed(3); }}
                >
                    <div className="alloc-header">
                        <span className="alloc-title">Allocation</span>
                    </div>
                    <div className="alloc-table-header">
                        <span className="col-asset">Assets {data.assetsTotal}</span>
                        <span className="col-ind">Industry ▾</span>
                        <span className="col-price">Price</span>
                        <span className="col-change">1Y change ▾</span>
                        <span className="col-weight">Weight ▾</span>
                    </div>
                    <div className="alloc-rows-container">
                        {data.allocations.map((stock: Allocation, i: number) => (
                            <div key={i} className="alloc-row">
                                <div className="col-asset">
                                    <span className={`badge ${stock.ticker.toLowerCase()}`}>{stock.ticker[0]}</span>
                                    <span className="ticker">{stock.ticker}</span>
                                </div>
                                <span className="col-ind">{stock.industry}</span>
                                <span className="col-price">{stock.price}</span>
                                <span className={`col-change ${stock.change.startsWith('+') ? 'pos' : 'neg'}`}>{stock.change}</span>
                                <span className="col-weight">{stock.weight}</span>
                            </div>
                        ))}
                    </div>
                </motion.div>
            </div>
            {/* Scroll indicator */}
            <div className="ga-immersive-scroll">
                <span>Scroll for more</span>
                <ChevronDown size={16} />
            </div>
        </motion.div>
    );
};
