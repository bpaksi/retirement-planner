# Retirement Planner App - Project Plan

## Research Summary: What Makes Great Retirement Apps

### Key Insights from Competitors

| App | Standout Features | Key Takeaway |
|-----|-------------------|--------------|
| **Empower** | 5,000 Monte Carlo sims, ~90% auto-categorization, recession simulation | Automatic categorization is killer; visualization matters |
| **Boldin** | 75+ spending categories, phase-based spending, side-by-side scenarios | Tax awareness and scenario comparison are essential |
| **Projection Lab** | Sankey diagrams, historical backtesting, 94 simulation variants | Beautiful visualizations make complex data accessible |
| **WealthTrace** | Clean UI, rental property analysis, daily sync | Simplicity + depth; don't overwhelm users |

### Features Users Love
- **Automatic transaction categorization** (with ability to customize)
- **Monte Carlo simulations** for success probability
- **Side-by-side scenario comparison** ("what if I retire at 60 vs 65?")
- **Beautiful visualizations** (Sankey diagrams, progress charts)
- **Phase-based modeling** (different spending in early vs late retirement)
- **Tax-aware projections**

### Pain Points to Avoid
- Overcomplicated UIs that overwhelm
- Poor data sync/import reliability
- Lack of scenario comparison
- No way to track actual vs projected progress

---

## Your App: "Retirement Planner" (Working Title)

### Tech Stack
- **Frontend**: Next.js 14+ (App Router)
- **Database**: Browser IndexedDB (via Dexie.js) for local-first storage
- **State**: Zustand or Jotai (lightweight, works with local storage)
- **Charts**: Recharts + D3.js for advanced visualizations
- **Styling**: Tailwind CSS
- **CSV Parsing**: Papa Parse
- **Market Data**: Free APIs (Alpha Vantage, FRED, Yahoo Finance)

### Security for Public Repo
```
.env.local          # API keys (gitignored)
.env.example        # Template with placeholder values
```
- All sensitive data stays in browser (IndexedDB)
- No backend server = no API keys needed for core features
- Market data APIs use free tiers with client-side calls (rate limited)

---

## Data Model

### Core Entities

```javascript
// Account - represents a financial account
{
  id: uuid,
  name: "Edward Jones IRA",
  type: "investment" | "checking" | "savings" | "credit",
  institution: "Edward Jones",
  balance: 150000,
  lastUpdated: Date
}

// Transaction - imported from CSV
{
  id: uuid,
  accountId: uuid,
  date: Date,
  description: "AMAZON MARKETPLACE",
  amount: -45.99,
  category: "Shopping",
  subcategory: "Online Shopping",
  isRecurring: boolean,
  tags: ["discretionary"]
}

// Category - spending categories with budgets
{
  id: uuid,
  name: "Groceries",
  parentId: null | uuid,  // for subcategories
  monthlyBudget: 600,
  color: "#4CAF50",
  icon: "shopping-cart"
}

// Scenario - for what-if planning
{
  id: uuid,
  name: "Retire at 62",
  assumptions: {
    retirementAge: 62,
    annualSpending: 60000,
    inflationRate: 0.03,
    returnRate: 0.07,
    socialSecurityAge: 67,
    socialSecurityMonthly: 2800
  },
  createdAt: Date
}

// MarketNote - research journal entries
{
  id: uuid,
  title: "Fed Rate Decision Analysis",
  content: "markdown content...",
  tags: ["fed", "interest-rates"],
  linkedIndicators: ["FEDFUNDS", "SP500"],
  createdAt: Date,
  predictions: [{
    description: "S&P will hit 5500 by Q3",
    targetDate: Date,
    outcome: null | "correct" | "incorrect"
  }]
}
```

---

## Feature Roadmap

### Phase 1: MVP - Spending Analysis (4-6 weeks)

#### 1.1 Transaction Import
- [ ] CSV upload with drag-and-drop
- [ ] Auto-detect CSV format (Ed Jones, Capital One, USA Bank)
- [ ] Column mapping UI for unknown formats
- [ ] Duplicate detection
- [ ] Store in IndexedDB

#### 1.2 Auto-Categorization
- [ ] Rule-based categorization (regex patterns)
- [ ] Learn from user corrections
- [ ] Default category set (groceries, utilities, entertainment, etc.)
- [ ] Custom categories and subcategories
- [ ] Bulk recategorization

#### 1.3 Spending Dashboard
- [ ] Monthly spending by category (pie/bar chart)
- [ ] Spending trends over time (line chart)
- [ ] Category drill-down
- [ ] Month-over-month comparison
- [ ] Top merchants list
- [ ] Recurring expense detection

#### 1.4 Basic Patterns
- [ ] Average monthly spending calculation
- [ ] Identify spending spikes
- [ ] Essential vs discretionary breakdown
- [ ] Seasonal patterns (holidays, summer, etc.)

### Phase 2: Investment Tracking (3-4 weeks)

#### 2.1 Portfolio Management
- [ ] Manual account entry
- [ ] Holdings tracking (stocks, funds, ETFs)
- [ ] Real-time price updates (free API)
- [ ] Asset allocation view
- [ ] Performance over time

#### 2.2 Net Worth Tracking
- [ ] Combined view of all accounts
- [ ] Net worth history chart
- [ ] Monthly snapshots
- [ ] Growth projections

### Phase 3: Forecasting & Scenarios (4-5 weeks)

#### 3.1 Retirement Projections
- [ ] Basic compound growth calculator
- [ ] Monte Carlo simulation (1000 runs)
- [ ] Success probability display
- [ ] Sankey diagram for cash flows

#### 3.2 Scenario Planning
- [ ] Create multiple scenarios
- [ ] Side-by-side comparison
- [ ] Key variables:
  - Retirement age
  - Annual spending
  - Inflation rate
  - Return rate
  - Social Security timing
  - Major expenses (house, college, etc.)
- [ ] "What breaks first" analysis

#### 3.3 Tax Awareness
- [ ] Account type tax treatment
- [ ] Basic RMD calculations
- [ ] Withdrawal order optimization (basic)

### Phase 4: Market Research Hub (3-4 weeks)

#### 4.1 Economic Indicators Dashboard
- [ ] S&P 500, NASDAQ indices
- [ ] Federal Funds Rate
- [ ] Inflation (CPI)
- [ ] Unemployment rate
- [ ] 10-year Treasury yield
- [ ] Fear & Greed Index

#### 4.2 Research Journal
- [ ] Markdown note editor
- [ ] Tag system
- [ ] Link notes to indicators
- [ ] Prediction tracking
- [ ] Historical accuracy score

#### 4.3 Watchlists
- [ ] Custom stock/ETF watchlists
- [ ] Price alerts (browser notifications)
- [ ] News aggregation (RSS feeds)

---

## Page Structure

```
/                       # Dashboard - overview of everything
/transactions           # Transaction list & import
/spending               # Spending analysis & patterns
/accounts               # Account management
/investments            # Portfolio & holdings
/projections            # Retirement forecasting
/scenarios              # What-if scenario builder
/research               # Market research hub
  /research/indicators  # Economic indicators
  /research/notes       # Research journal
  /research/watchlist   # Stock watchlists
/settings               # App settings, categories, import rules
```

---

## CSV Import Strategy

### Known Formats

```javascript
const CSV_FORMATS = {
  'edward_jones': {
    detect: (headers) => headers.includes('Settlement Date'),
    mapping: {
      date: 'Settlement Date',
      description: 'Description',
      amount: 'Amount',
    },
    dateFormat: 'MM/DD/YYYY'
  },
  'capital_one': {
    detect: (headers) => headers.includes('Transaction Date') && headers.includes('Card No.'),
    mapping: {
      date: 'Transaction Date',
      description: 'Description',
      amount: 'Debit', // or 'Credit'
    },
    dateFormat: 'YYYY-MM-DD'
  },
  'usa_bank': {
    // Define based on actual format
  },
  'generic': {
    // Fallback with column mapping UI
  }
};
```

### Auto-Categorization Rules

```javascript
const CATEGORIZATION_RULES = [
  { pattern: /AMAZON|AMZN/i, category: 'Shopping', subcategory: 'Online' },
  { pattern: /WALMART|TARGET|COSTCO/i, category: 'Shopping', subcategory: 'Retail' },
  { pattern: /KROGER|SAFEWAY|WHOLE FOODS|TRADER JOE/i, category: 'Groceries' },
  { pattern: /SHELL|EXXON|CHEVRON|BP|GAS/i, category: 'Transportation', subcategory: 'Gas' },
  { pattern: /NETFLIX|HULU|SPOTIFY|DISNEY\+/i, category: 'Entertainment', subcategory: 'Streaming' },
  { pattern: /ELECTRIC|GAS CO|WATER|UTILITY/i, category: 'Utilities' },
  // ... extensible
];
```

---

## Free APIs for Market Data

| API | Data | Rate Limit | Notes |
|-----|------|------------|-------|
| Alpha Vantage | Stocks, ETFs | 25/day free | Good for prices |
| FRED (St. Louis Fed) | Economic indicators | Unlimited | Best for macro data |
| Yahoo Finance (unofficial) | Stocks, news | Varies | Use with caution |
| CoinGecko | Crypto | 10-30/min | If needed |

---

## Project Structure

```
retirement-planner/
├── app/
│   ├── layout.js
│   ├── page.js                 # Dashboard
│   ├── transactions/
│   ├── spending/
│   ├── accounts/
│   ├── investments/
│   ├── projections/
│   ├── scenarios/
│   ├── research/
│   │   ├── indicators/
│   │   ├── notes/
│   │   └── watchlist/
│   └── settings/
├── components/
│   ├── ui/                     # Reusable UI components
│   ├── charts/                 # Chart components
│   ├── import/                 # CSV import components
│   └── scenarios/              # Scenario builder
├── lib/
│   ├── db.js                   # Dexie.js database setup
│   ├── categorization.js       # Auto-categorization logic
│   ├── csv-parsers/            # Bank-specific parsers
│   ├── monte-carlo.js          # Simulation logic
│   └── market-data.js          # API integrations
├── hooks/
│   ├── useTransactions.js
│   ├── useCategories.js
│   └── useScenarios.js
├── store/
│   └── index.js                # Zustand store
├── .env.example
├── .env.local                  # Gitignored
└── README.md
```

---

## Security Checklist

- [ ] `.env.local` in `.gitignore`
- [ ] No hardcoded API keys
- [ ] All financial data in IndexedDB (never transmitted)
- [ ] API keys only for public market data (not personal financial APIs)
- [ ] Clear data export (JSON) for user backup
- [ ] No analytics/tracking that could leak financial data

---

## Next Steps

1. **Initialize Project**
   ```bash
   npx create-next-app@latest retirement-planner
   cd retirement-planner
   npm install dexie recharts papaparse zustand
   ```

2. **Set up Database Schema** (Dexie.js)

3. **Build CSV Import** - Start with Capital One format (most common)

4. **Create Spending Dashboard** - Basic charts first

5. **Iterate** - Add features based on actual usage

---

## Questions to Consider

1. **Branding**: What do you want to call this app?
2. **Design**: Any color scheme / aesthetic preferences?
3. **Bank formats**: Can you share sample CSVs (with fake data) to map columns?
4. **Deployment**: Vercel (free tier) for hosting?
