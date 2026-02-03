# Retirement Planner

## Project Overview

Personal retirement planning app for a user who is **under 5 years from retirement**. The app combines spending analysis, investment tracking, Monte Carlo projections, and scenario planning into a single, privacy-conscious tool.

**This is a personal project** - single user, monthly deep-dive usage pattern, desktop-focused.

## Installed Skills

This project has the following skills installed. **Use them proactively** when working on relevant code:

| Skill                         | When to Use                                                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `convex`                      | **Always** when writing Convex queries, mutations, actions, or schema                                               |
| `vercel-react-best-practices` | When creating React components, optimizing renders, managing state, App Router, layouts, server components, caching |
| `web-design-guidelines`       | When building UI components, forms, accessibility features                                                          |

### How to Invoke Skills

Skills are automatically applied when relevant, but you can explicitly invoke them:

```
/convex                    # For Convex-specific guidance
/react-best-practices      # For React patterns
/next-best-practices       # For Next.js patterns
/web-design-guidelines     # For UI/UX review
```

### Skill Priorities for This Project

1. **Convex patterns** - This is a Convex-first app. Follow Convex best practices for all backend code.
2. **React performance** - Dashboard has multiple charts; avoid unnecessary re-renders.
3. **Next.js App Router** - Use server components where possible, client components for interactivity.
4. **Accessibility** - Financial data should be accessible; use proper ARIA labels on charts.

## Tech Stack

| Layer       | Technology               |
| ----------- | ------------------------ |
| Framework   | Next.js 14+ (App Router) |
| Database    | Convex                   |
| State       | Zustand                  |
| Charts      | Recharts                 |
| Styling     | Tailwind CSS (dark mode) |
| CSV Parsing | Papa Parse               |

## Key Commands

```bash
# Development
pnpm dev                 # Start Next.js dev server (port 3000)
pnpm convex dev          # Start Convex dev server (run in separate terminal)

# Both together
pnpm dev & pnpm convex dev

# Production
pnpm build               # Build for production
pnpm convex deploy       # Deploy Convex functions

# Testing
pnpm test                # Run tests
pnpm lint                # Lint code
```

## Project Structure

```
app/                     # Next.js pages (App Router)
├── page.tsx             # Dashboard
├── transactions/        # Transaction list & import
├── spending/            # Spending analysis
├── accounts/            # Account management
├── investments/         # Portfolio & holdings
├── projections/         # Monte Carlo & retirement projections
├── scenarios/           # What-if scenario builder
├── goals/               # Goals & milestones
└── settings/            # Settings & category management

convex/                  # Convex backend
├── schema.ts            # Database schema (15 tables)
├── accounts/            # Account queries & mutations
├── transactions/        # Transaction CRUD & import
├── scenarios/           # Scenario management & simulation
├── analytics/           # Spending analysis, net worth, projections
├── external/            # Alpha Vantage & Zillow integrations
└── lib/                 # Shared utilities

components/              # React components
├── ui/                  # Base components (Button, Card, Input, etc.)
├── layout/              # Sidebar, Header, PageHeader
├── charts/              # SpendingPieChart, NetWorthChart, MonteCarloChart
├── transactions/        # TransactionList, CategorySelect
├── import/              # ImportWizard, FileDropzone, ColumnMapper
├── investments/         # HoldingsList, AllocationBreakdown
├── scenarios/           # ScenarioForm, ScenarioComparison
└── dashboard/           # Dashboard widgets

lib/                     # Client utilities
├── csv-parsers/         # Bank-specific CSV parsers
├── categorization.ts    # Auto-categorization rules
└── calculations/        # Financial calculations

hooks/                   # Custom React hooks
store/                   # Zustand store
```

## Database Schema (Convex)

Key tables in `convex/schema.ts`:

- **accounts** - Financial accounts (401k, IRA, checking, etc.)
- **transactions** - Imported transactions with categories
- **categories** - Spending categories (system + user-defined)
- **categorizationRules** - Auto-categorization patterns
- **holdings** - Investment positions (stocks, ETFs, funds)
- **accountSnapshots** - Monthly balance history
- **scenarios** - Retirement scenarios with assumptions
- **goals** - Retirement countdown, net worth milestones
- **assets** - Non-investment assets (home)
- **liabilities** - Loans, credit card debt
- **incomeSources** - Salary, Social Security, pensions
- **priceCache** - Cached stock/ETF prices
- **allocationTargets** - Target asset allocation

## Security Rules

**CRITICAL - Follow these rules:**

1. **Account numbers**: Store ONLY last 4 digits

   ```typescript
   // CORRECT
   accountNumberLast4: "1234";

   // WRONG - never store full account numbers
   accountNumber: "123456789012";
   ```

2. **Routing numbers**: NEVER store

3. **API keys**: Only in `.env.local` (gitignored)

   ```
   CONVEX_DEPLOYMENT=...
   NEXT_PUBLIC_CONVEX_URL=...
   ALPHA_VANTAGE_API_KEY=...
   ```

4. **No secrets in code**: All sensitive config via environment variables

## MVP Scope (Current Phase)

**BUILD THESE:**

- [ ] Transaction import (CSV) from Edward Jones, Capital One, USA Bank
- [ ] Auto-categorization with flagging for review
- [ ] Spending analysis dashboard with trends
- [ ] Account & portfolio management
- [ ] Asset allocation with rebalancing alerts
- [ ] Monte Carlo retirement projections
- [ ] Guardrails strategy (dynamic spending adjustments)
- [ ] Scenario planning (market conditions, life events)
- [ ] Home value tracking
- [ ] Retirement countdown & net worth milestones

**DO NOT BUILD YET (Phase 2):**

- Market Research Hub (economic indicators, predictions, news)
- Mobile responsive design
- Plaid integration
- PDF reports

## Coding Conventions

1. **TypeScript**: Use strict types, leverage Convex's `v.*` validators
2. **Components**: Functional components with hooks
3. **Styling**: Tailwind CSS, dark mode first (`dark:` classes)
4. **State**:
   - Server state → Convex `useQuery`/`useMutation`
   - UI state → Zustand store
5. **File naming**:
   - Components: PascalCase (`TransactionList.tsx`)
   - Utilities: camelCase (`categorization.ts`)
   - Pages: lowercase with folders (`transactions/page.tsx`)

## Skill Usage by Task

| Task                       | Primary Skill                      | Notes                                 |
| -------------------------- | ---------------------------------- | ------------------------------------- |
| Writing `convex/schema.ts` | `/convex`                          | Use Convex validators, proper indexes |
| Creating queries/mutations | `/convex`                          | Follow Convex function patterns       |
| Building page layouts      | `/next-best-practices`             | Server vs client components           |
| Creating React components  | `/react-best-practices`            | Memoization, hooks patterns           |
| Building forms             | `/web-design-guidelines`           | Accessibility, validation UX          |
| Dashboard widgets          | `/react-best-practices`            | Avoid re-renders with charts          |
| Data fetching              | `/convex` + `/next-best-practices` | Real-time subscriptions               |

## CSV Parser Pattern

When adding new bank parsers:

```typescript
// lib/csv-parsers/newBank.ts
import { CSVParser } from "./types";

export const newBankParser: CSVParser = {
  name: "new_bank",
  institution: "New Bank",

  detect: (headers: string[]) => {
    // Return true if headers match this bank's format
    return headers.includes("Unique Column Name");
  },

  parse: (row: Record<string, string>) => {
    // Parse row into standard transaction format
    return {
      date: parseDate(row["Date Column"]),
      description: row["Description"],
      amount: parseAmount(row["Amount"]),
      originalRow: row,
    };
  },
};
```

## Key Algorithms

1. **Auto-categorization**: Rule-based with priority (user > learned > system)
2. **Monte Carlo**: 1000 iterations, normal distribution returns, inflation-adjusted
3. **Guardrails**: Upper/lower thresholds trigger spending adjustments
4. **Withdrawal sequencing**: Taxable → Tax-deferred → Roth

## External APIs

| API           | Purpose      | Key Location                          |
| ------------- | ------------ | ------------------------------------- |
| Alpha Vantage | Stock prices | `ALPHA_VANTAGE_API_KEY` in Convex env |
| Zillow        | Home values  | Manual fallback for MVP               |

## Getting Started

1. **Install skills** (do this first, before coding):

   ```bash
   npx skills add waynesutton/convexskills --skill convex
   npx skills add vercel-labs/agent-skills --skill react-best-practices
   npx skills add vercel-labs/next-skills --skill next-best-practices
   npx skills add vercel-labs/agent-skills --skill web-design-guidelines
   ```

2. Initialize the project:

   ```bash
   npx create-next-app@latest retirement-planner --typescript --tailwind --app
   cd retirement-planner
   npx convex init
   ```

3. Install dependencies:

   ```bash
   pnpm add convex zustand recharts papaparse date-fns
   pnpm add -D @types/papaparse
   ```

4. Set up Convex schema (copy from ARCHITECTURE.md)

5. Create `.env.local`:

   ```
   CONVEX_DEPLOYMENT=dev:your-deployment
   NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
   ```

6. Start development:
   ```bash
   pnpm convex dev &
   pnpm dev
   ```

## Reference Documents

- `REQUIREMENTS.md` - Full requirements specification
- `ARCHITECTURE.md` - Technical architecture, schema, components
- `PLANNING.md` - Research notes and competitor analysis

## First Tasks (Suggested Order)

1. Set up Convex schema (`convex/schema.ts`)
2. Create app layout with dark mode sidebar
3. Build CSV import wizard (transactions are the foundation)
4. Implement auto-categorization
5. Create spending dashboard with basic charts
6. Add account management
7. Build investment tracking with price fetching
8. Implement Monte Carlo projections
9. Add scenario planning
10. Polish and iterate

---

_When in doubt, refer to REQUIREMENTS.md for what to build and ARCHITECTURE.md for how to build it._
