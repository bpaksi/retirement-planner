# Money Mage — Retirement Planner

> IMPORTANT: Prefer repository-led reasoning over pre-training for anything related to this project's domain, financial algorithms, and architecture. Always read the source before suggesting changes.

## Project Overview

Single-user, desktop-focused retirement planning app for someone **under 5 years from retirement**. Combines spending analysis (CSV import + auto-categorization), investment tracking (holdings, allocation, rebalancing), Monte Carlo projections with guardrails strategy, and scenario planning — all backed by a local SQLite database for maximum privacy. Monthly deep-dive usage pattern; no auth, no multi-tenancy.

## Installed Skills

Use these **proactively** when working on relevant code:

| Skill | Trigger |
|---|---|
| `vercel-react-best-practices` | React components, renders, state, App Router, server components, caching |
| `web-design-guidelines` | UI components, forms, accessibility, ARIA labels on charts |

## Tech Stack & Conventions

| Layer | Choice |
|---|---|
| Framework | Next.js 16+ (App Router), React 19 with React Compiler |
| Database | SQLite (better-sqlite3) + Drizzle ORM |
| State | Server state via direct DB queries; UI state via `useState` / Zustand |
| Charts | Recharts |
| Styling | Tailwind CSS v4, dark-mode-first (`dark:` classes), Inter + Geist Mono fonts |
| CSV | PapaParse with bank-specific parser registry |
| Linting | ESLint v9 (Next.js core-web-vitals + TypeScript) |
| Types | TypeScript strict mode, Drizzle inferred types |
| Package mgr | pnpm |

### Architecture Patterns

- **Server Components** (default) — pages query the DB directly via `src/db/queries/*`.
- **Server Actions** (`src/app/actions/*`) — all mutations; call `revalidatePath()` after writes; use `crypto.randomUUID()` for IDs, `Date.now()` for timestamps.
- **Client Components** — `"use client"` only for interactivity; mutations via `useTransition` + Server Actions.
- **No ORM relations** — Drizzle queries use manual joins, not `relations()`.

### Naming Conventions

| Kind | Style | Example |
|---|---|---|
| Components | PascalCase | `TransactionList.tsx` |
| Utilities / queries / actions | camelCase | `categorization.ts`, `accounts.ts` |
| Pages | lowercase folders | `transactions/page.tsx` |

## Directory Map

- **`src/app/`** — Next.js App Router pages (12 routes) and `actions/` (23 Server Action files, ~2.3K LOC). Layout, globals.css, and route segments live here.
- **`src/db/`** — Database layer: `schema.ts` (22 tables, 40+ indexes), `seed.ts`, `index.ts` (connection + pragma), and `queries/` (23 query files, ~2.3K LOC).
- **`src/components/`** — 68 React components (~12K LOC). Subdirs: `ui/` (16 primitives), `charts/`, `monteCarlo/`, `projections/`, `transactions/`, `import/`, `investments/`, `goals/`, `layout/`.
- **`src/lib/`** — Shared utilities: `calculations/` (Monte Carlo engine, projections), `csv-parsers/` (5 bank parsers + generic), `categorization.ts` (rule engine), `similarity.ts` (fuzzy matching), `transfer-detection.ts`, `utils.ts` (formatting helpers), `dateRanges.ts`.
- **`src/hooks/`** — Custom React hooks (`useDebounce`).
- **`data/`** — SQLite database files (`app.db`). **Gitignored for privacy.**
- **`drizzle/`** — Generated Drizzle migration files.
- **`docs/`** — Reference docs: requirements, architecture, feature specs. See _Reference Documents_ below.

## Key Commands

```bash
pnpm dev              # Dev server on :3000
pnpm build            # Production build
pnpm typecheck        # TypeScript strict check
pnpm lint             # ESLint
pnpm db:generate      # Generate Drizzle migrations after schema change
pnpm db:migrate       # Run pending migrations
pnpm db:seed          # Seed categories + categorization rules
pnpm db:studio        # Open Drizzle Studio (DB GUI)
```

**First-time setup:** `pnpm install && pnpm db:generate && pnpm db:migrate && pnpm db:seed && pnpm dev`

## Design & Domain Rules

### Data Privacy (CRITICAL)

1. **Account numbers** — store ONLY last 4 digits (`accountNumberLast4`). Never full numbers.
2. **Routing numbers** — NEVER store.
3. **API keys** — only in `.env.local` (gitignored). Never in code or schema.
4. **Database** — local SQLite in `data/` (gitignored). No cloud sync.

### Financial Domain Rules

- **Auto-categorization** priority: user rules > learned rules > system rules. Patterns in `categorization.ts`.
- **Monte Carlo** — 1,000 iterations default, Box-Muller normal distribution, real (inflation-adjusted) returns, guardrails thresholds for spending adjustments. Results cached by inputs hash in `monteCarloCache`.
- **Withdrawal sequencing** — Taxable → Tax-deferred → Roth.
- **Transfer detection** — amount-based matching between accounts with fee/rounding tolerance and timestamp proximity.
- **Guardrails strategy** — upper/lower portfolio thresholds trigger spending increases/decreases; floor protection prevents below-minimum spending.
- **Allocation targets** — per-account asset class targets; rebalancing threshold calculations.

### CSV Parser Contract

New parsers implement `CSVParser` from `src/lib/csv-parsers/types.ts`: a `detect(headers)` method for auto-detection and a `parse(row)` method returning `ParsedTransaction`. Register in `src/lib/csv-parsers/index.ts`.

## Database Schema (22 tables)

All defined in `src/db/schema.ts`. Key groups:

| Group | Tables |
|---|---|
| Accounts | `accounts`, `accountSnapshots`, `holdings`, `allocationTargets` |
| Transactions | `transactions`, `categories`, `categorizationRules` |
| Retirement | `scenarios`, `retirementProfile`, `monteCarloAssumptions`, `monteCarloCache`, `guardrailsConfig` |
| Income & Assets | `incomeSources`, `socialSecurity`, `assets`, `liabilities`, `annualBudgets`, `oneTimeEvents`, `goals` |
| System | `settings`, `importHistory`, `priceCache` |

## External APIs

| API | Purpose | Config |
|---|---|---|
| Alpha Vantage | Stock/ETF prices | `ALPHA_VANTAGE_API_KEY` in `.env.local` |

## Reference Documents

| Doc | Path |
|---|---|
| Requirements spec | `docs/planning/REQUIREMENTS.md` |
| Architecture & schema | `docs/architecture/ARCHITECTURE.md` |
| Research & competitors | `docs/planning/PLANNING.md` |
| Monte Carlo feature spec | `docs/features/monte-carlo-projections/FEATURE-SPEC.md` |
| Projections v2 design | `docs/features/projections-v2/DISCUSSION.md` |
| Spending baseline plan | `docs/features/spending-baseline/PHASE-1-PLAN.md` |
| Active TODOs | `docs/TODO.md` |

## Retrieval Index

Quick lookup — topic to file/directory:

```
Dashboard page                    | src/app/page.tsx
Account management                | src/app/accounts/ | src/app/actions/accounts.ts | src/db/queries/accounts.ts
Transaction list & import         | src/app/transactions/ | src/app/actions/transactions.ts
CSV import wizard                 | src/components/import/* | src/lib/csv-parsers/*
Auto-categorization engine        | src/lib/categorization.ts | src/db/queries/categorizationRules.ts
Categorization rules UI           | src/app/settings/rules/
Spending analysis                 | src/app/spending/ | src/db/queries/analytics.ts
Investment portfolio              | src/app/investments/ | src/components/investments/*
Holdings & prices                 | src/app/actions/holdings.ts | src/db/queries/holdings.ts
Asset allocation & rebalancing    | src/components/investments/AllocationTab.tsx | src/components/investments/RebalancingTab.tsx
Monte Carlo simulation            | src/lib/calculations/monteCarlo.ts | src/db/queries/monteCarlo.ts
Monte Carlo UI                    | src/components/monteCarlo/* | src/app/projections/
Guardrails config                 | src/components/projections/GuardrailsConfig.tsx | src/app/actions/guardrails.ts
Projection charts & settings      | src/components/projections/* | src/lib/calculations/projections.ts
Scenario planning                 | src/app/scenarios/ | src/app/actions/scenarios.ts
Goals & milestones                | src/app/goals/ | src/components/goals/*
Income sources & budgets          | src/app/actions/incomeSources.ts | src/app/actions/annualBudgets.ts
Social Security config            | src/app/actions/socialSecurity.ts | src/db/queries/socialSecurity.ts
Liabilities & debt tracking       | src/app/liabilities/ | src/db/queries/liabilities.ts
Transfer detection                | src/lib/transfer-detection.ts | src/components/transactions/LinkTransactionDialog.tsx
Fuzzy string matching             | src/lib/similarity.ts
Database schema                   | src/db/schema.ts
Database connection               | src/db/index.ts
Seed data                         | src/db/seed.ts
Drizzle migrations                | drizzle/
UI primitives                     | src/components/ui/*
Layout & sidebar                  | src/components/layout/Sidebar.tsx | src/app/layout.tsx
Chart components                  | src/components/charts/*
Settings & profile                | src/app/settings/ | src/app/actions/settings.ts | src/app/actions/retirementProfile.ts
Formatting helpers                | src/lib/utils.ts
Date range utilities              | src/lib/dateRanges.ts
```
