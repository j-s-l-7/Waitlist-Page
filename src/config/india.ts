/**
 * India Market Configuration for Agentic Investing Waitlist
 */

export const indiaConfig = {
  market: 'india' as const,

  // Branding
  title: 'Build your portfolios with just a prompt.',
  subtitle: 'Create portfolios customised to your investment goals and preferences with infinite possibilities—without advisory fees.',
  benchmark: 'NIFTY 50',
  currency: '₹',

  // Prompt Examples (for typewriter effect) - Single prompt only
  prompts: [
    'Build me a portfolio of mid-cap tech stocks with high R&D spend as a % of revenue',
  ],

  // Feature Steps
  steps: [
    {
      number: '01',
      title: 'Start with a prompt',
      description: 'It all starts with your ideas—from themes like "Atmanirbhar Bharat plays" to specific criteria like "stocks with PE below sector average".',
    },
    {
      number: '02',
      title: 'Watch AI go to work',
      description: 'Your prompt dispatches AI agents that research and screen thousands of NSE stocks to build a portfolio that matches your criteria.',
    },
    {
      number: '03',
      title: 'Backtest your ideas',
      description: 'See how your portfolio compares to the NIFTY 50, with historical returns, volatility analysis, and risk metrics.',
    },
    {
      number: '04',
      title: 'Invest in your creations',
      description: 'Once refined, invest directly and manage it alongside your other holdings—your own custom index.',
    },
  ],

  // Comparison Table
  comparison: {
    header: 'Advisory fees are a thing of the past.',
    subheader: 'Traditional Advisers charge 1-2% annually. Agentic Investing is built for the new era of investing.',
    features: [
      {
        name: 'Built by',
        agenticAssetz: 'Built by you with AI',
        traditional: 'Traditional Adviser',
      },
      {
        name: 'Based on',
        agenticAssetz: 'Your own thesis',
        traditional: 'Predefined strategy',
      },
      {
        name: 'Customization',
        agenticAssetz: 'Endlessly Customizable',
        traditional: 'No Customization',
      },
      {
        name: 'Advisory fees',
        agenticAssetz: '0% Fees',
        traditional: '1-2% Fees annually',
      },
      {
        name: 'Minimum investment',
        agenticAssetz: 'Any amount',
        traditional: '₹50 lakhs+',
      },
    ],
  },

  // FAQ
  faq: [
    {
      question: 'What is Agentic Investing?',
      answer: 'Agentic Investing allows you to create custom portfolios with AI using natural language. Your idea dispatches AI agents that research stocks based on your criteria, then assemble a portfolio you can analyze and invest in—similar to an index, but built around your own thesis.',
    },
    {
      question: 'How is this different from mutual funds?',
      answer: 'Mutual funds are predefined and managed by fund managers. Agentic Investing is built by you with AI, based on your thesis, and endlessly customizable. You get personalization without the advisory fees.',
    },
    {
      question: 'Can I backtest my portfolio?',
      answer: 'Yes. Before investing, you can see how your portfolio would have performed historically compared to NIFTY 50, including returns, drawdowns, and risk metrics.',
    },
    {
      question: 'Can I invest directly?',
      answer: 'Yes. Once you\'ve finalized your portfolio, you can invest directly through your existing Demat account and manage it alongside your other holdings.',
    },
    {
      question: 'What data does the AI use?',
      answer: 'Our AI agents analyze fundamentals (revenue, margins, ROE), historical performance, growth metrics, sector data, concall transcripts, and annual reports to match your screening criteria.',
    },
  ],

  // CTA
  cta: {
    headline: 'The market is full of untapped ideas.',
    subheadline: 'What\'s yours?',
  },
};

export type MarketConfig = Omit<typeof indiaConfig, 'market'> & { market: 'india' | 'us' };
