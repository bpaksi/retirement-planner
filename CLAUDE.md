# Retirement Planner

## Project Overview

Personal retirement planning app for a user who is **under 5 years from retirement**. The app combines spending analysis, investment tracking, Monte Carlo projections, and scenario planning into a single, privacy-conscious tool.

**This is a personal project** - single user, monthly deep-dive usage pattern, desktop-focused.

## Installed Skills

This project has the following skills installed. **Use them proactively** when working on relevant code:

| Skill                         | When to Use                                                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `vercel-react-best-practices` | When creating React components, optimizing renders, managing state, App Router, layouts, server components, caching |
| `web-design-guidelines`       | When building UI components, forms, accessibility features                                                          |

### How to Invoke Skills

Skills are automatically applied when relevant, but you can explicitly invoke them:

```
/react-best-practices      # For React patterns
/next-best-practices       # For Next.js patterns
/web-design-guidelines     # For UI/UX review
```

### Skill Priorities for This Project

1. **React performance** - Dashboard has multiple charts; avoid unnecessary re-renders.
2. **Next.js App Router** - Use server components where possible, client components for interactivity.
3. **Accessibility** - Financial data should be accessible; use proper ARIA labels on charts.

## Tech Stack

| Layer       | Technology                   |
| ----------- | ---------------------------- |
| Framework   | Next.js 16+ (App Router)     |
| Database    | SQLite + Drizzle ORM         |
| State       | Zustand                      |
| Charts      | Recharts                     |
| Styling     | Tailwind CSS (dark mode)     |
| CSV Parsing | Papa Parse                   |

## Key Commands

```bash
# Development
pnpm dev                 # Start Next.js dev server (port 3000)

# Database
pnpm db:generate         # Generate Drizzle migrations
pnpm db:migrate          # Run migrations
pnpm db:studio           # Open Drizzle Studio (database GUI)
pnpm db:seed             # Seed default categories and rules

# Production
pnpm build               # Build for production

# Testing
pnpm typecheck           # TypeScript check
pnpm lint                # Lint code
```

## Project Structure

```
src/
├── app/                     # Next.js pages (App Router)
│   ├── page.tsx             # Dashboard
│   ├── transactions/        # Transaction list & import
│   ├── spending/            # Spending analysis
│   ├── accounts/            # Account management
│   ├── investments/         # Portfolio & holdings
│   ├── projections/         # Monte Carlo & retirement projections
│   ├── goals/               # Goals & milestones
│   ├── liabilities/         # Debt tracking
│   ├── settings/            # Settings & category management
│   └── actions/             # Server Actions for mutations
│
├── db/                      # Database layer
│   ├── index.ts             # Database connection
│   ├── schema.ts            # Drizzle schema (22 tables)
│   ├── seed.ts              # Seed data (categories, rules)
│   └── queries/             # Query functions by domain
│
├── components/              # React components
│   ├── ui/                  # Base components (Button, Card, Input, etc.)
│   ├── layout/              # Sidebar, Header, PageHeader
│   ├── charts/              # SpendingPieChart, NetWorthChart, MonteCarloChart
│   ├── transactions/        # TransactionList, CategorySelect
│   ├── import/              # ImportWizard, FileDropzone, ColumnMapper
│   ├── investments/         # HoldingsList, AllocationBreakdown
│   ├── monteCarlo/          # Monte Carlo simulation components
│   ├── projections/         # Projection & guardrails components
│   ├── goals/               # Income sources, budgets, events
│   └── dashboard/           # Dashboard widgets
│
└── lib/                     # Client utilities
    ├── csv-parsers/         # Bank-specific CSV parsers
    ├── categorization.ts    # Auto-categorization rules
    ├── calculations/        # Financial calculations (Monte Carlo, projections)
    └── utils.ts             # Formatting, helpers

data/                        # SQLite database files (gitignored)
├── app.db                   # Main database
└── app.db-journal           # SQLite journal
```

## Database Schema (SQLite + Drizzle)

Key tables in `src/db/schema.ts`:

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
- **annualBudgets** - Year-over-year budget planning
- **oneTimeEvents** - One-time financial events
- **priceCache** - Cached stock/ETF prices
- **allocationTargets** - Target asset allocation
- **retirementProfile** - User profile (age, retirement age)
- **socialSecurity** - SS benefits configuration
- **monteCarloAssumptions** - Simulation assumptions
- **monteCarloCache** - Cached simulation results
- **guardrailsConfig** - Dynamic spending guardrails

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
   ALPHA_VANTAGE_API_KEY=...
   ```

4. **No secrets in code**: All sensitive config via environment variables

## Architecture Patterns

### Data Fetching

**Server Components (preferred for data display):**
```tsx
// src/app/accounts/page.tsx
import { listAccounts } from "@/db/queries/accounts";

export default function AccountsPage() {
  const accounts = listAccounts();
  return <AccountsList accounts={accounts} />;
}
```

**Server Actions (for mutations):**
```tsx
// src/app/actions/accounts.ts
"use server";
import { db } from "@/db";
import { accounts } from "@/db/schema";
import { revalidatePath } from "next/cache";

export async function createAccount(data: CreateAccountInput) {
  const result = db.insert(accounts).values({
    id: crypto.randomUUID(),
    ...data,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }).returning().get();

  revalidatePath("/accounts");
  return result;
}
```

**Client Components (for interactivity):**
```tsx
"use client";
import { useTransition } from "react";
import { createAccount } from "@/app/actions/accounts";

export function CreateForm() {
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (formData: FormData) => {
    startTransition(async () => {
      await createAccount(formData);
    });
  };

  return <form action={handleSubmit}>...</form>;
}
```

## Coding Conventions

1. **TypeScript**: Use strict types, Drizzle's inferred types
2. **Components**: Functional components with hooks
3. **Styling**: Tailwind CSS, dark mode first (`dark:` classes)
4. **State**:
   - Server state → Direct database queries
   - UI state → Zustand store or useState
5. **File naming**:
   - Components: PascalCase (`TransactionList.tsx`)
   - Utilities: camelCase (`categorization.ts`)
   - Pages: lowercase with folders (`transactions/page.tsx`)
   - Queries: camelCase (`src/db/queries/accounts.ts`)
   - Actions: camelCase (`src/app/actions/accounts.ts`)

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
2. **Monte Carlo**: 1000 iterations, normal distribution returns, real (inflation-adjusted) returns
3. **Guardrails**: Upper/lower thresholds trigger spending adjustments
4. **Withdrawal sequencing**: Taxable → Tax-deferred → Roth

## External APIs

| API           | Purpose      | Key Location                          |
| ------------- | ------------ | ------------------------------------- |
| Alpha Vantage | Stock prices | `ALPHA_VANTAGE_API_KEY` in .env.local |
| Zillow        | Home values  | Manual fallback for MVP               |

## Getting Started

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Set up the database:

   ```bash
   pnpm db:generate   # Generate migrations
   pnpm db:migrate    # Run migrations
   pnpm db:seed       # Seed categories and rules
   ```

3. Create `.env.local` (optional):

   ```
   ALPHA_VANTAGE_API_KEY=your_key_here
   ```

4. Start development:
   ```bash
   pnpm dev
   ```

## Reference Documents

- `docs/REQUIREMENTS.md` - Full requirements specification
- `docs/ARCHITECTURE.md` - Technical architecture, schema, components
- `docs/PLANNING.md` - Research notes and competitor analysis

---

_Database files are stored in `data/app.db` and are gitignored for privacy._
