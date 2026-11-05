/**
 * US Market Configuration for Agentic Investing Waitlist
 */

import type { MarketConfig } from './india';

export const usConfig: MarketConfig = {
    market: 'us' as const,

    // Branding
    title: 'Build your portfolios with just a prompt.',
    subtitle: 'Create portfolios customized to your investment goals and preferences with infinite possibilities—without advisory fees.',
    benchmark: 'S&P 500',
    currency: '$',

    // Prompt Examples (for typewriter effect)
    prompts: [
        'AI infrastructure companies with recurring revenue',
        'Semiconductors with high margins and low P/E',
        'Biotech companies in Phase 3 trials',
        'Clean energy with government contracts',
        'Electric vehicle battery makers with revenue growth over 25% YoY',
        'Cybersecurity firms with enterprise ARR growth',
    ],

    // Feature Steps
    steps: [
        {
            number: '01',
            title: 'Start with a prompt',
            description: 'It all starts with your ideas—from themes like "Mars exploration" to specific criteria like "stocks with accelerating EPS but flat revenue growth".',
        },
        {
            number: '02',
            title: 'Watch AI go to work',
            description: 'Your prompt dispatches AI agents that research and screen thousands of stocks to build a portfolio that matches your criteria.',
        },
        {
            number: '03',
            title: 'Backtest your ideas',
            description: 'See how your portfolio compares to the S&P 500, with historical returns, volatility analysis, and risk metrics.',
        },
        {
            number: '04',
            title: 'Invest in your creations',
            description: 'Once refined, invest directly and manage it alongside your other holdings—your own custom index.',
        },
    ],

    // Comparison Table
    comparison: {
        header: 'ETFs are one-size-fits-all.',
        subheader: 'Agentic Investing is one-of-a-kind. Index ETFs were built for the \'90s. Generated portfolios are the next leap.',
        features: [
            {
                name: 'Built by',
                agenticAssetz: 'You with AI',
                traditional: 'ETF sponsor',
            },
            {
                name: 'Based on',
                agenticAssetz: 'Your own thesis',
                traditional: 'Predefined index',
            },
            {
                name: 'Customization',
                agenticAssetz: 'Endless',
                traditional: 'No customization',
            },
            {
                name: 'Management fees',
                agenticAssetz: '0%',
                traditional: '0.03-1% annually',
            },
            {
                name: 'Opportunities',
                agenticAssetz: 'Unlimited',
                traditional: '~2,100 US-Listed ETFs',
            },
        ],
    },

    // FAQ
    faq: [
        {
            question: 'What is Agentic Investing?',
            answer: 'Agentic Investing allows you to create custom indices with AI using a natural-language prompt. Your idea dispatches a swarm of AI evaluation agents that research and screen stocks based on your criteria, then assemble an index you can analyze and invest in—similar to an ETF, but built around your own thesis.',
        },
        {
            question: 'What\'s the difference between an Agentic Asset and an ETF?',
            answer: 'ETFs are predefined indices managed by sponsors. They\'re rigid by design with no room for personalization. Agentic Investing is built by you with AI, based on your thesis, and endlessly customizable.',
        },
        {
            question: 'Can I backtest my Agentic Asset?',
            answer: 'Yes. Before investing, you can see how your index would have performed historically compared to the S&P 500, including unique asset scores based on returns, stability, and diversification.',
        },
        {
            question: 'Can I invest directly in an Agentic Asset?',
            answer: 'Yes. Once you\'ve finished refining your Agentic Asset, you can invest directly and manage it alongside your other holdings, like your very own custom index.',
        },
        {
            question: 'What data does the AI use to build an Agentic Asset?',
            answer: 'Our AI agents analyze fundamentals (revenue, margins, ROE), historical performance, growth metrics, sector data, SEC filings, and earnings call transcripts to match your screening criteria.',
        },
    ],

    // CTA
    cta: {
        headline: 'The market is full of untapped ideas.',
        subheadline: 'What\'s yours?',
    },
};
