# Analyez Waitlist — Operational Frontend

This is the frontend codebase for the **Analyez** waitlist page (deployed at [analyez.com](https://analyez.com)). It features an immersive, engaging UI designed to showcase the "Agentic Investing" concept and capture early user interest.

## Tech Stack

* **Framework:** React 19
* **Build Tool:** Vite
* **Styling:** Vanilla CSS (custom design system, glassmorphism)
* **Animations:** Framer Motion (`framer-motion`)
* **Icons:** Lucide React (`lucide-react`)
* **API / Backend:** Vercel Serverless Functions (`api/`) connected to a PostgreSQL RDS database.

## Project Structure

The project has been structured according to standard Vite/React best practices:

```
Operational Frontend/
├── api/                  # Vercel Serverless Functions (Backend)
│   ├── waitlist.js       # Handles POST requests to add users to the waitlist
│   └── waitlist/count.js # Handles GET requests to retrieve the current waitlist size
├── public/               # Static assets served at the root (favicon, hero bg)
├── src/                  # React Source Code
│   ├── components/       # Reusable UI components (Hero, CTA, Features, etc.)
│   ├── config/           # Market configurations (content for US/India)
│   ├── hooks/            # Custom React hooks
│   ├── styles/           # CSS stylesheets (Waitlist.css, tokens.css)
│   ├── main.tsx          # React application entry point
│   └── WaitlistPage.tsx  # Main page component
├── index.html            # HTML entry point (requires `src/main.tsx`)
├── package.json          # Dependencies and npm scripts
└── vercel.json           # Vercel deployment configuration (if any overrides exist)
```

## Key Features

1. **Immersive Hero Animation:** A state-machine-driven sequence (`ImmersiveHero.tsx`) that simulates an AI generating a portfolio based on a user prompt.
2. **Contextual Onboarding:** The UI transitions from a simple search-like interface to a complex data dashboard seamlessly.
3. **Waitlist Capture:** A floating Call-to-Action (`FloatingCTA.tsx`) that captures email addresses, posts them securely to the database, and returns the user's real-time position in the queue.

## Development

### Running Locally

To run the frontend locally for development:

```bash
# 1. Install dependencies
npm install

# 2. Start the Vite development server
npm run dev
```

*Note: The local Vite dev server does not execute Vercel Serverless Functions (`/api/*`). API calls to the waitlist endpoint will fail locally unless you use the Vercel CLI (`vercel dev`).*

### Building for Production

```bash
npm run build
```

The output will be generated in the `dist/` directory.

## Deployment

This project is deployed automatically via Vercel. 

* The `index.html` and `src/` files are compiled by Vite into static assets.
* The files inside the `api/` directory are automatically deployed as Vercel Serverless Functions.

To deploy manually from the CLI:

```bash
vercel deploy --prod
```