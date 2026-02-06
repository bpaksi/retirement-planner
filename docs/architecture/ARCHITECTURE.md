# Retirement Planner - Architecture Document

## Overview

This document defines the technical architecture for the Retirement Planner application. It covers the database schema, component hierarchy, data flow, and integration patterns.

---

## 1. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (Client)                         │
├─────────────────────────────────────────────────────────────────┤
│  Next.js App (App Router)                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │    Pages     │  │  Components  │  │    Hooks     │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│           │                │                │                   │
│           └────────────────┼────────────────┘                   │
│                            ▼                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Zustand Store                         │   │
│  │  (UI state, filters, temporary data)                     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                            │                                    │
├────────────────────────────┼────────────────────────────────────┤
│                            ▼                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   Convex Client                          │   │
│  │  useQuery() / useMutation() / useAction()                │   │
│  └─────────────────────────────────────────────────────────┘   │
└────────────────────────────┼────────────────────────────────────┘
                             │ WebSocket (real-time)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Convex Backend                             │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Queries    │  │  Mutations   │  │   Actions    │          │
│  │  (read data) │  │ (write data) │  │ (external API)│          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                            │                                    │
│                            ▼                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   Convex Database                        │   │
│  │  (Document store with real-time subscriptions)           │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     External APIs                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Alpha Vantage│  │    Zillow    │  │     FRED     │          │
│  │ (stock prices)│  │(home values) │  │ (Phase 2)    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Convex Database Schema

### 2.1 Core Tables

```typescript
// convex/schema.ts

import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ============================================
  // ACCOUNTS
  // ============================================
  accounts: defineTable({
    name: v.string(),                    // "Edward Jones IRA"
    type: v.union(
      v.literal("401k"),
      v.literal("403b"),
      v.literal("traditional_ira"),
      v.literal("roth_ira"),
      v.literal("roth_401k"),
      v.literal("brokerage"),
      v.literal("checking"),
      v.literal("savings"),
      v.literal("money_market"),
      v.literal("credit_card"),
      v.literal("loan"),
      v.literal("other")
    ),
    institution: v.string(),             // "Edward Jones"
    accountNumberLast4: v.optional(v.string()), // "1234" (masked)
    taxTreatment: v.union(
      v.literal("taxable"),
      v.literal("tax_deferred"),
      v.literal("tax_free")
    ),
    isRetirement: v.boolean(),
    isActive: v.boolean(),
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_type", ["type"])
    .index("by_institution", ["institution"]),

  // ============================================
  // TRANSACTIONS
  // ============================================
  transactions: defineTable({
    accountId: v.id("accounts"),
    date: v.number(),                    // Unix timestamp
    description: v.string(),             // Original description from bank
    amount: v.number(),                  // Negative for expenses, positive for income
    categoryId: v.optional(v.id("categories")),
    isRecurring: v.boolean(),
    isFlagged: v.boolean(),              // Flagged for review
    confidenceScore: v.optional(v.number()), // 0-1, how confident auto-categorization was
    tags: v.array(v.string()),
    importBatchId: v.optional(v.string()), // Group imports together
    sourceFile: v.optional(v.string()),  // Original CSV filename
    createdAt: v.number(),
  })
    .index("by_account", ["accountId"])
    .index("by_date", ["date"])
    .index("by_category", ["categoryId"])
    .index("by_flagged", ["isFlagged"])
    .index("by_account_date", ["accountId", "date"]),

  // ============================================
  // CATEGORIES
  // ============================================
  categories: defineTable({
    name: v.string(),                    // "Groceries"
    parentId: v.optional(v.id("categories")), // For subcategories
    type: v.union(
      v.literal("expense"),
      v.literal("income"),
      v.literal("transfer")
    ),
    isEssential: v.boolean(),            // Essential vs discretionary
    color: v.string(),                   // Hex color for charts
    icon: v.optional(v.string()),        // Icon name
    sortOrder: v.number(),
    isSystem: v.boolean(),               // System-provided vs user-created
  })
    .index("by_parent", ["parentId"])
    .index("by_type", ["type"]),

  // ============================================
  // CATEGORIZATION RULES
  // ============================================
  categorizationRules: defineTable({
    pattern: v.string(),                 // Regex pattern
    categoryId: v.id("categories"),
    priority: v.number(),                // Higher = checked first
    isActive: v.boolean(),
    createdBy: v.union(
      v.literal("system"),
      v.literal("user"),
      v.literal("learned")               // Learned from user corrections
    ),
    matchCount: v.number(),              // How many times this rule matched
  })
    .index("by_priority", ["priority"])
    .index("by_category", ["categoryId"]),

  // ============================================
  // HOLDINGS (Investment positions)
  // ============================================
  holdings: defineTable({
    accountId: v.id("accounts"),
    symbol: v.string(),                  // "VTI", "AAPL"
    name: v.string(),                    // "Vanguard Total Stock Market ETF"
    shares: v.number(),
    costBasis: v.optional(v.number()),   // Total cost basis
    assetClass: v.union(
      v.literal("us_stock"),
      v.literal("intl_stock"),
      v.literal("bond"),
      v.literal("cash"),
      v.literal("real_estate"),
      v.literal("other")
    ),
    lastPrice: v.optional(v.number()),
    lastPriceUpdated: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_account", ["accountId"])
    .index("by_symbol", ["symbol"])
    .index("by_asset_class", ["assetClass"]),

  // ============================================
  // ACCOUNT SNAPSHOTS (Monthly balances)
  // ============================================
  accountSnapshots: defineTable({
    accountId: v.id("accounts"),
    date: v.number(),                    // First of month timestamp
    balance: v.number(),
    isManual: v.boolean(),               // Manual entry vs calculated
  })
    .index("by_account", ["accountId"])
    .index("by_date", ["date"])
    .index("by_account_date", ["accountId", "date"]),

  // ============================================
  // SCENARIOS
  // ============================================
  scenarios: defineTable({
    name: v.string(),                    // "Retire at 62"
    isBaseline: v.boolean(),             // Primary scenario
    assumptions: v.object({
      retirementAge: v.number(),
      currentAge: v.number(),
      lifeExpectancy: v.number(),
      annualSpending: v.number(),
      spendingGrowthRate: v.number(),    // Usually inflation
      inflationRate: v.number(),
      preRetirementReturn: v.number(),
      postRetirementReturn: v.number(),
      socialSecurityAge: v.optional(v.number()),
      socialSecurityMonthly: v.optional(v.number()),
      // Guardrails
      upperGuardrail: v.optional(v.number()),  // e.g., 1.2 (20% above)
      lowerGuardrail: v.optional(v.number()),  // e.g., 0.8 (20% below)
      spendingAdjustment: v.optional(v.number()), // How much to adjust
    }),
    // Major life events
    events: v.array(v.object({
      name: v.string(),
      year: v.number(),
      amount: v.number(),                // Negative for expense, positive for income
      isRecurring: v.boolean(),
      recurringYears: v.optional(v.number()),
    })),
    createdAt: v.number(),
    updatedAt: v.number(),
  }),

  // ============================================
  // GOALS
  // ============================================
  goals: defineTable({
    type: v.union(
      v.literal("retirement_date"),
      v.literal("net_worth"),
      v.literal("savings_target"),
      v.literal("spending_target")
    ),
    name: v.string(),
    targetValue: v.number(),
    targetDate: v.optional(v.number()),
    isAchieved: v.boolean(),
    achievedDate: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_type", ["type"]),

  // ============================================
  // ASSETS (Non-investment assets like home)
  // ============================================
  assets: defineTable({
    type: v.union(
      v.literal("home"),
      v.literal("vehicle"),
      v.literal("other")
    ),
    name: v.string(),                    // "Primary Residence"
    address: v.optional(v.string()),     // For Zillow lookup
    zillowId: v.optional(v.string()),    // Zillow property ID
    currentValue: v.number(),
    isAutoUpdated: v.boolean(),          // Using Zillow
    lastUpdated: v.number(),
    purchasePrice: v.optional(v.number()),
    purchaseDate: v.optional(v.number()),
    notes: v.optional(v.string()),
  })
    .index("by_type", ["type"]),

  // ============================================
  // LIABILITIES
  // ============================================
  liabilities: defineTable({
    type: v.union(
      v.literal("mortgage"),
      v.literal("auto_loan"),
      v.literal("student_loan"),
      v.literal("personal_loan"),
      v.literal("credit_card"),
      v.literal("other")
    ),
    name: v.string(),
    currentBalance: v.number(),
    interestRate: v.number(),
    minimumPayment: v.number(),
    payoffDate: v.optional(v.number()),
    linkedAccountId: v.optional(v.id("accounts")), // Link to credit card account
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_type", ["type"]),

  // ============================================
  // INCOME SOURCES
  // ============================================
  incomeSources: defineTable({
    type: v.union(
      v.literal("salary"),
      v.literal("self_employment"),
      v.literal("social_security"),
      v.literal("pension"),
      v.literal("rental"),
      v.literal("dividends"),
      v.literal("other")
    ),
    name: v.string(),
    annualAmount: v.number(),
    startDate: v.optional(v.number()),   // When income starts (e.g., SS at 67)
    endDate: v.optional(v.number()),     // When income ends (e.g., salary at retirement)
    growthRate: v.number(),              // Annual growth/COLA
    isTaxable: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_type", ["type"]),

  // ============================================
  // SETTINGS
  // ============================================
  settings: defineTable({
    key: v.string(),
    value: v.any(),
  })
    .index("by_key", ["key"]),

  // ============================================
  // IMPORT HISTORY
  // ============================================
  importHistory: defineTable({
    filename: v.string(),
    institution: v.string(),
    transactionCount: v.number(),
    duplicatesSkipped: v.number(),
    importedAt: v.number(),
    status: v.union(
      v.literal("success"),
      v.literal("partial"),
      v.literal("failed")
    ),
    errors: v.optional(v.array(v.string())),
  })
    .index("by_date", ["importedAt"]),

  // ============================================
  // PRICE CACHE (for stock/ETF prices)
  // ============================================
  priceCache: defineTable({
    symbol: v.string(),
    price: v.number(),
    change: v.optional(v.number()),
    changePercent: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_symbol", ["symbol"]),

  // ============================================
  // ALLOCATION TARGETS
  // ============================================
  allocationTargets: defineTable({
    assetClass: v.string(),              // "us_stock", "bond", etc.
    targetPercent: v.number(),           // 0-100
    rebalanceThreshold: v.number(),      // Trigger alert when drift exceeds this
  })
    .index("by_asset_class", ["assetClass"]),
});
```

### 2.2 Default Categories

```typescript
// convex/seed/defaultCategories.ts

export const DEFAULT_CATEGORIES = [
  // Income
  { name: "Salary", type: "income", isEssential: true, color: "#4CAF50", sortOrder: 1 },
  { name: "Investment Income", type: "income", isEssential: true, color: "#8BC34A", sortOrder: 2 },
  { name: "Other Income", type: "income", isEssential: false, color: "#CDDC39", sortOrder: 3 },

  // Essential Expenses
  { name: "Housing", type: "expense", isEssential: true, color: "#2196F3", sortOrder: 10 },
  { name: "Utilities", type: "expense", isEssential: true, color: "#03A9F4", sortOrder: 11 },
  { name: "Groceries", type: "expense", isEssential: true, color: "#00BCD4", sortOrder: 12 },
  { name: "Healthcare", type: "expense", isEssential: true, color: "#009688", sortOrder: 13 },
  { name: "Insurance", type: "expense", isEssential: true, color: "#4DB6AC", sortOrder: 14 },
  { name: "Transportation", type: "expense", isEssential: true, color: "#FF9800", sortOrder: 15 },

  // Discretionary Expenses
  { name: "Dining Out", type: "expense", isEssential: false, color: "#FF5722", sortOrder: 20 },
  { name: "Entertainment", type: "expense", isEssential: false, color: "#E91E63", sortOrder: 21 },
  { name: "Shopping", type: "expense", isEssential: false, color: "#9C27B0", sortOrder: 22 },
  { name: "Travel", type: "expense", isEssential: false, color: "#673AB7", sortOrder: 23 },
  { name: "Subscriptions", type: "expense", isEssential: false, color: "#3F51B5", sortOrder: 24 },
  { name: "Personal Care", type: "expense", isEssential: false, color: "#7C4DFF", sortOrder: 25 },
  { name: "Gifts", type: "expense", isEssential: false, color: "#F44336", sortOrder: 26 },

  // Other
  { name: "Transfers", type: "transfer", isEssential: false, color: "#9E9E9E", sortOrder: 90 },
  { name: "Uncategorized", type: "expense", isEssential: false, color: "#607D8B", sortOrder: 99 },
];
```

---

## 3. Convex Functions

### 3.1 Directory Structure

```
convex/
├── schema.ts                 # Database schema
├── _generated/               # Auto-generated types
├──
├── accounts/
│   ├── queries.ts            # getAccounts, getAccountById, etc.
│   └── mutations.ts          # createAccount, updateAccount, etc.
├──
├── transactions/
│   ├── queries.ts            # getTransactions, getSpendingByCategory, etc.
│   ├── mutations.ts          # createTransaction, updateCategory, etc.
│   └── import.ts             # CSV import logic
├──
├── categories/
│   ├── queries.ts
│   └── mutations.ts
├──
├── holdings/
│   ├── queries.ts
│   └── mutations.ts
├──
├── scenarios/
│   ├── queries.ts
│   ├── mutations.ts
│   └── simulation.ts         # Monte Carlo logic
├──
├── analytics/
│   ├── spending.ts           # Spending analysis queries
│   ├── netWorth.ts           # Net worth calculations
│   └── projections.ts        # Retirement projections
├──
├── external/
│   ├── alphavantage.ts       # Stock price fetching (action)
│   └── zillow.ts             # Home value fetching (action)
├──
├── seed/
│   ├── defaultCategories.ts
│   └── categorizationRules.ts
└──
└── lib/
    ├── categorization.ts     # Auto-categorization logic
    └── calculations.ts       # Financial calculations
```

### 3.2 Key Function Examples

```typescript
// convex/transactions/queries.ts

import { query } from "./_generated/server";
import { v } from "convex/values";

export const getTransactions = query({
  args: {
    accountId: v.optional(v.id("accounts")),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    categoryId: v.optional(v.id("categories")),
    flaggedOnly: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let q = ctx.db.query("transactions");

    if (args.accountId) {
      q = q.withIndex("by_account", (q) => q.eq("accountId", args.accountId));
    }

    const transactions = await q.collect();

    // Apply filters
    let filtered = transactions;

    if (args.startDate) {
      filtered = filtered.filter(t => t.date >= args.startDate!);
    }
    if (args.endDate) {
      filtered = filtered.filter(t => t.date <= args.endDate!);
    }
    if (args.categoryId) {
      filtered = filtered.filter(t => t.categoryId === args.categoryId);
    }
    if (args.flaggedOnly) {
      filtered = filtered.filter(t => t.isFlagged);
    }

    // Sort by date descending
    filtered.sort((a, b) => b.date - a.date);

    if (args.limit) {
      filtered = filtered.slice(0, args.limit);
    }

    return filtered;
  },
});

export const getSpendingByCategory = query({
  args: {
    startDate: v.number(),
    endDate: v.number(),
  },
  handler: async (ctx, args) => {
    const transactions = await ctx.db
      .query("transactions")
      .withIndex("by_date")
      .filter((q) =>
        q.and(
          q.gte(q.field("date"), args.startDate),
          q.lte(q.field("date"), args.endDate),
          q.lt(q.field("amount"), 0) // Expenses only
        )
      )
      .collect();

    const categories = await ctx.db.query("categories").collect();
    const categoryMap = new Map(categories.map(c => [c._id, c]));

    // Group by category
    const spending: Record<string, { category: any; total: number; count: number }> = {};

    for (const t of transactions) {
      const catId = t.categoryId?.toString() || "uncategorized";
      if (!spending[catId]) {
        spending[catId] = {
          category: t.categoryId ? categoryMap.get(t.categoryId) : { name: "Uncategorized" },
          total: 0,
          count: 0,
        };
      }
      spending[catId].total += Math.abs(t.amount);
      spending[catId].count += 1;
    }

    return Object.values(spending).sort((a, b) => b.total - a.total);
  },
});
```

```typescript
// convex/scenarios/simulation.ts

import { action } from "./_generated/server";
import { v } from "convex/values";

export const runMonteCarloSimulation = action({
  args: {
    scenarioId: v.id("scenarios"),
    iterations: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const scenario = await ctx.runQuery(internal.scenarios.getById, {
      id: args.scenarioId
    });

    if (!scenario) throw new Error("Scenario not found");

    const iterations = args.iterations || 1000;
    const results: number[] = [];

    const {
      currentAge,
      retirementAge,
      lifeExpectancy,
      annualSpending,
      inflationRate,
      preRetirementReturn,
      postRetirementReturn,
    } = scenario.assumptions;

    // Get current portfolio value
    const netWorth = await ctx.runQuery(internal.analytics.getCurrentNetWorth);

    for (let i = 0; i < iterations; i++) {
      let portfolio = netWorth;
      let spending = annualSpending;
      let success = true;

      for (let age = currentAge; age <= lifeExpectancy; age++) {
        const isRetired = age >= retirementAge;

        // Random return with normal distribution
        const meanReturn = isRetired ? postRetirementReturn : preRetirementReturn;
        const stdDev = 0.15; // 15% standard deviation
        const annualReturn = normalRandom(meanReturn, stdDev);

        // Apply return
        portfolio *= (1 + annualReturn);

        // Withdraw if retired
        if (isRetired) {
          portfolio -= spending;
        }

        // Inflate spending
        spending *= (1 + inflationRate);

        // Check if failed
        if (portfolio <= 0) {
          success = false;
          break;
        }
      }

      results.push(success ? portfolio : 0);
    }

    // Calculate success rate
    const successCount = results.filter(r => r > 0).length;
    const successRate = successCount / iterations;

    // Calculate percentiles
    const sorted = results.sort((a, b) => a - b);
    const p10 = sorted[Math.floor(iterations * 0.1)];
    const p25 = sorted[Math.floor(iterations * 0.25)];
    const p50 = sorted[Math.floor(iterations * 0.5)];
    const p75 = sorted[Math.floor(iterations * 0.75)];
    const p90 = sorted[Math.floor(iterations * 0.9)];

    return {
      successRate,
      iterations,
      percentiles: { p10, p25, p50, p75, p90 },
      averageEndingBalance: results.reduce((a, b) => a + b, 0) / iterations,
    };
  },
});

// Helper: Normal distribution random number
function normalRandom(mean: number, stdDev: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + stdDev * z;
}
```

---

## 4. Frontend Architecture

### 4.1 Page Structure

```
app/
├── layout.tsx                 # Root layout with providers
├── page.tsx                   # Dashboard (home)
├──
├── accounts/
│   ├── page.tsx               # Account list
│   └── [id]/
│       └── page.tsx           # Account detail
├──
├── transactions/
│   ├── page.tsx               # Transaction list with filters
│   └── import/
│       └── page.tsx           # CSV import wizard
├──
├── spending/
│   └── page.tsx               # Spending analysis dashboard
├──
├── investments/
│   ├── page.tsx               # Portfolio overview
│   └── holdings/
│       └── page.tsx           # Individual holdings
├──
├── projections/
│   └── page.tsx               # Retirement projections + Monte Carlo
├──
├── scenarios/
│   ├── page.tsx               # Scenario list
│   ├── new/
│   │   └── page.tsx           # Create scenario
│   └── [id]/
│       └── page.tsx           # Scenario detail + comparison
├──
├── goals/
│   └── page.tsx               # Goals and milestones
├──
└── settings/
    ├── page.tsx               # General settings
    ├── categories/
    │   └── page.tsx           # Category management
    └── import-rules/
        └── page.tsx           # Categorization rules
```

### 4.2 Component Hierarchy

```
components/
├── ui/                        # Base UI components (shadcn/ui style)
│   ├── Button.tsx
│   ├── Card.tsx
│   ├── Dialog.tsx
│   ├── Input.tsx
│   ├── Select.tsx
│   ├── Table.tsx
│   ├── Tabs.tsx
│   └── ...
├──
├── layout/
│   ├── Sidebar.tsx            # Main navigation
│   ├── Header.tsx             # Top bar with search, user menu
│   ├── PageHeader.tsx         # Page title and actions
│   └── Container.tsx          # Content container
├──
├── charts/
│   ├── SpendingPieChart.tsx
│   ├── SpendingTrendChart.tsx
│   ├── NetWorthChart.tsx
│   ├── AllocationChart.tsx
│   ├── MonteCarloChart.tsx
│   └── SankeyDiagram.tsx      # Cash flow visualization
├──
├── transactions/
│   ├── TransactionList.tsx
│   ├── TransactionRow.tsx
│   ├── TransactionFilters.tsx
│   ├── CategorySelect.tsx
│   └── BulkActions.tsx
├──
├── import/
│   ├── ImportWizard.tsx       # Multi-step import flow
│   ├── FileDropzone.tsx
│   ├── ColumnMapper.tsx       # Map CSV columns
│   ├── PreviewTable.tsx
│   └── ImportProgress.tsx
├──
├── accounts/
│   ├── AccountCard.tsx
│   ├── AccountList.tsx
│   ├── AccountForm.tsx
│   └── AccountTypeIcon.tsx
├──
├── investments/
│   ├── HoldingsList.tsx
│   ├── HoldingRow.tsx
│   ├── AllocationBreakdown.tsx
│   ├── RebalanceAlert.tsx
│   └── PriceDisplay.tsx
├──
├── scenarios/
│   ├── ScenarioCard.tsx
│   ├── ScenarioForm.tsx
│   ├── ScenarioComparison.tsx
│   ├── AssumptionsEditor.tsx
│   └── LifeEventEditor.tsx
├──
├── projections/
│   ├── RetirementCountdown.tsx
│   ├── SuccessProbability.tsx
│   ├── ProjectionSummary.tsx
│   └── GuardrailsDisplay.tsx
├──
├── goals/
│   ├── GoalCard.tsx
│   ├── GoalProgress.tsx
│   └── MilestoneTimeline.tsx
├──
└── dashboard/
    ├── NetWorthWidget.tsx
    ├── SpendingSummaryWidget.tsx
    ├── AllocationWidget.tsx
    ├── RetirementWidget.tsx
    ├── AlertsWidget.tsx
    └── GoalsWidget.tsx
```

### 4.3 State Management (Zustand)

```typescript
// store/index.ts

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppState {
  // UI State
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;

  // Filters (persisted across sessions)
  transactionFilters: {
    dateRange: { start: Date | null; end: Date | null };
    accountIds: string[];
    categoryIds: string[];
    showFlaggedOnly: boolean;
  };
  setTransactionFilters: (filters: Partial<AppState['transactionFilters']>) => void;

  // Selected items
  selectedTransactions: string[];
  toggleTransactionSelection: (id: string) => void;
  clearTransactionSelection: () => void;

  // Import wizard state
  importWizard: {
    step: number;
    file: File | null;
    detectedFormat: string | null;
    columnMapping: Record<string, string>;
    previewData: any[];
  };
  setImportWizardStep: (step: number) => void;
  setImportFile: (file: File | null) => void;
  setColumnMapping: (mapping: Record<string, string>) => void;
  resetImportWizard: () => void;

  // Comparison mode
  comparisonScenarios: string[];
  addComparisonScenario: (id: string) => void;
  removeComparisonScenario: (id: string) => void;
  clearComparison: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // UI State
      sidebarCollapsed: false,
      toggleSidebar: () => set((state) => ({
        sidebarCollapsed: !state.sidebarCollapsed
      })),

      // Filters
      transactionFilters: {
        dateRange: { start: null, end: null },
        accountIds: [],
        categoryIds: [],
        showFlaggedOnly: false,
      },
      setTransactionFilters: (filters) => set((state) => ({
        transactionFilters: { ...state.transactionFilters, ...filters },
      })),

      // Selection
      selectedTransactions: [],
      toggleTransactionSelection: (id) => set((state) => ({
        selectedTransactions: state.selectedTransactions.includes(id)
          ? state.selectedTransactions.filter(i => i !== id)
          : [...state.selectedTransactions, id],
      })),
      clearTransactionSelection: () => set({ selectedTransactions: [] }),

      // Import wizard
      importWizard: {
        step: 0,
        file: null,
        detectedFormat: null,
        columnMapping: {},
        previewData: [],
      },
      setImportWizardStep: (step) => set((state) => ({
        importWizard: { ...state.importWizard, step },
      })),
      setImportFile: (file) => set((state) => ({
        importWizard: { ...state.importWizard, file },
      })),
      setColumnMapping: (mapping) => set((state) => ({
        importWizard: { ...state.importWizard, columnMapping: mapping },
      })),
      resetImportWizard: () => set({
        importWizard: {
          step: 0,
          file: null,
          detectedFormat: null,
          columnMapping: {},
          previewData: [],
        },
      }),

      // Comparison
      comparisonScenarios: [],
      addComparisonScenario: (id) => set((state) => ({
        comparisonScenarios: state.comparisonScenarios.includes(id)
          ? state.comparisonScenarios
          : [...state.comparisonScenarios, id].slice(0, 3), // Max 3
      })),
      removeComparisonScenario: (id) => set((state) => ({
        comparisonScenarios: state.comparisonScenarios.filter(i => i !== id),
      })),
      clearComparison: () => set({ comparisonScenarios: [] }),
    }),
    {
      name: 'retirement-planner-storage',
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        transactionFilters: state.transactionFilters,
      }),
    }
  )
);
```

---

## 5. CSV Parsing Architecture

### 5.1 Parser Interface

```typescript
// lib/csv-parsers/types.ts

export interface ParsedTransaction {
  date: Date;
  description: string;
  amount: number;
  originalRow: Record<string, string>;
}

export interface CSVParser {
  name: string;
  institution: string;
  detect: (headers: string[]) => boolean;
  parse: (row: Record<string, string>) => ParsedTransaction | null;
}

export interface ColumnMapping {
  date: string;
  description: string;
  amount: string;        // Or debit/credit columns
  debit?: string;
  credit?: string;
}
```

### 5.2 Bank-Specific Parsers

```typescript
// lib/csv-parsers/capitalOne.ts

import { CSVParser, ParsedTransaction } from './types';
import { parse } from 'date-fns';

export const capitalOneParser: CSVParser = {
  name: 'capital_one',
  institution: 'Capital One',

  detect: (headers: string[]) => {
    const required = ['Transaction Date', 'Posted Date', 'Description', 'Debit', 'Credit'];
    return required.every(h => headers.includes(h));
  },

  parse: (row: Record<string, string>): ParsedTransaction | null => {
    try {
      const dateStr = row['Transaction Date'] || row['Posted Date'];
      const date = parse(dateStr, 'yyyy-MM-dd', new Date());

      const debit = parseFloat(row['Debit'] || '0');
      const credit = parseFloat(row['Credit'] || '0');
      const amount = credit > 0 ? credit : -debit;

      return {
        date,
        description: row['Description'],
        amount,
        originalRow: row,
      };
    } catch (e) {
      console.error('Failed to parse Capital One row:', e);
      return null;
    }
  },
};
```

```typescript
// lib/csv-parsers/edwardJones.ts

import { CSVParser, ParsedTransaction } from './types';
import { parse } from 'date-fns';

export const edwardJonesParser: CSVParser = {
  name: 'edward_jones',
  institution: 'Edward Jones',

  detect: (headers: string[]) => {
    // Edward Jones typically has these columns
    const indicators = ['Settlement Date', 'Trade Date', 'Symbol', 'Description'];
    return indicators.filter(h => headers.includes(h)).length >= 2;
  },

  parse: (row: Record<string, string>): ParsedTransaction | null => {
    try {
      const dateStr = row['Settlement Date'] || row['Trade Date'];
      const date = parse(dateStr, 'MM/dd/yyyy', new Date());

      const amount = parseFloat(row['Amount']?.replace(/[,$]/g, '') || '0');

      return {
        date,
        description: row['Description'] || row['Activity'],
        amount,
        originalRow: row,
      };
    } catch (e) {
      console.error('Failed to parse Edward Jones row:', e);
      return null;
    }
  },
};
```

### 5.3 Auto-Detection Logic

```typescript
// lib/csv-parsers/index.ts

import Papa from 'papaparse';
import { capitalOneParser } from './capitalOne';
import { edwardJonesParser } from './edwardJones';
import { usaBankParser } from './usaBank';
import { CSVParser, ParsedTransaction, ColumnMapping } from './types';

const PARSERS: CSVParser[] = [
  capitalOneParser,
  edwardJonesParser,
  usaBankParser,
];

export async function parseCSVFile(file: File): Promise<{
  parser: CSVParser | null;
  headers: string[];
  rows: Record<string, string>[];
  transactions: ParsedTransaction[];
}> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields || [];
        const rows = results.data as Record<string, string>[];

        // Try to detect parser
        const parser = PARSERS.find(p => p.detect(headers));

        // Parse transactions if parser found
        const transactions: ParsedTransaction[] = [];
        if (parser) {
          for (const row of rows) {
            const parsed = parser.parse(row);
            if (parsed) {
              transactions.push(parsed);
            }
          }
        }

        resolve({ parser, headers, rows, transactions });
      },
      error: reject,
    });
  });
}

export function parseWithCustomMapping(
  rows: Record<string, string>[],
  mapping: ColumnMapping
): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];

  for (const row of rows) {
    try {
      const dateStr = row[mapping.date];
      // Try multiple date formats
      const date = parseFlexibleDate(dateStr);
      if (!date) continue;

      let amount: number;
      if (mapping.amount) {
        amount = parseAmount(row[mapping.amount]);
      } else if (mapping.debit && mapping.credit) {
        const debit = parseAmount(row[mapping.debit] || '0');
        const credit = parseAmount(row[mapping.credit] || '0');
        amount = credit > 0 ? credit : -debit;
      } else {
        continue;
      }

      transactions.push({
        date,
        description: row[mapping.description] || '',
        amount,
        originalRow: row,
      });
    } catch (e) {
      console.warn('Failed to parse row with custom mapping:', e);
    }
  }

  return transactions;
}

function parseAmount(str: string): number {
  // Handle formats: "1,234.56", "$1,234.56", "(1,234.56)", "-1234.56"
  const cleaned = str
    .replace(/[$,]/g, '')
    .replace(/^\((.+)\)$/, '-$1');
  return parseFloat(cleaned) || 0;
}

function parseFlexibleDate(str: string): Date | null {
  const formats = [
    'yyyy-MM-dd',
    'MM/dd/yyyy',
    'M/d/yyyy',
    'MM-dd-yyyy',
    'dd/MM/yyyy',
  ];

  for (const fmt of formats) {
    try {
      const date = parse(str, fmt, new Date());
      if (!isNaN(date.getTime())) return date;
    } catch {}
  }

  // Try native Date parsing as fallback
  const native = new Date(str);
  return isNaN(native.getTime()) ? null : native;
}
```

---

## 6. Key Algorithms

### 6.1 Auto-Categorization

```typescript
// lib/categorization.ts

interface CategorizationRule {
  pattern: RegExp;
  categoryId: string;
  priority: number;
}

const SYSTEM_RULES: CategorizationRule[] = [
  // Income patterns
  { pattern: /PAYROLL|DIRECT DEP|SALARY/i, categoryId: 'salary', priority: 100 },
  { pattern: /DIVIDEND|DIV\s+/i, categoryId: 'investment_income', priority: 100 },

  // Essential expenses
  { pattern: /MORTGAGE|HOME LOAN/i, categoryId: 'housing', priority: 90 },
  { pattern: /RENT\s+PAYMENT/i, categoryId: 'housing', priority: 90 },
  { pattern: /ELECTRIC|GAS\s+CO|WATER\s+UTIL|UTILITY/i, categoryId: 'utilities', priority: 90 },
  { pattern: /KROGER|SAFEWAY|WHOLE\s*FOODS|TRADER\s*JOE|PUBLIX|WEGMANS|ALDI/i, categoryId: 'groceries', priority: 85 },
  { pattern: /PHARMACY|CVS|WALGREENS|RITE\s*AID|MEDICATION/i, categoryId: 'healthcare', priority: 85 },
  { pattern: /INSURANCE|GEICO|STATE\s*FARM|ALLSTATE|PROGRESSIVE/i, categoryId: 'insurance', priority: 85 },

  // Transportation
  { pattern: /SHELL|EXXON|CHEVRON|BP|MOBIL|GAS\s*STATION|FUEL/i, categoryId: 'transportation', priority: 80 },
  { pattern: /UBER|LYFT|TAXI/i, categoryId: 'transportation', priority: 80 },

  // Discretionary
  { pattern: /RESTAURANT|DOORDASH|GRUBHUB|UBER\s*EATS|MCDONALD|STARBUCKS|CHIPOTLE/i, categoryId: 'dining_out', priority: 75 },
  { pattern: /NETFLIX|HULU|SPOTIFY|DISNEY\+|HBO|AMAZON\s*PRIME|YOUTUBE/i, categoryId: 'subscriptions', priority: 75 },
  { pattern: /AMAZON|AMZN|WALMART|TARGET|COSTCO|BEST\s*BUY/i, categoryId: 'shopping', priority: 70 },
  { pattern: /MOVIE|CINEMA|THEATER|CONCERT|TICKET/i, categoryId: 'entertainment', priority: 70 },
  { pattern: /AIRLINE|HOTEL|AIRBNB|BOOKING\.COM|EXPEDIA/i, categoryId: 'travel', priority: 70 },

  // Transfers (should not count in spending)
  { pattern: /TRANSFER|XFER|VENMO|ZELLE|PAYPAL/i, categoryId: 'transfers', priority: 60 },
];

export function categorizeTransaction(
  description: string,
  userRules: CategorizationRule[] = [],
  learnedRules: CategorizationRule[] = []
): { categoryId: string | null; confidence: number } {
  // Combine rules: user > learned > system
  const allRules = [
    ...userRules.map(r => ({ ...r, priority: r.priority + 200 })),
    ...learnedRules.map(r => ({ ...r, priority: r.priority + 100 })),
    ...SYSTEM_RULES,
  ].sort((a, b) => b.priority - a.priority);

  for (const rule of allRules) {
    if (rule.pattern.test(description)) {
      // Confidence based on priority tier
      const confidence = rule.priority >= 200 ? 1.0 :
                         rule.priority >= 100 ? 0.9 :
                         rule.priority >= 80 ? 0.8 : 0.7;
      return { categoryId: rule.categoryId, confidence };
    }
  }

  return { categoryId: null, confidence: 0 };
}
```

### 6.2 Guardrails Strategy

```typescript
// lib/calculations/guardrails.ts

interface GuardrailsConfig {
  upperGuardrail: number;    // e.g., 1.20 (20% above target)
  lowerGuardrail: number;    // e.g., 0.80 (20% below target)
  ceilingAdjustment: number; // e.g., 0.10 (increase spending by 10%)
  floorAdjustment: number;   // e.g., 0.10 (decrease spending by 10%)
}

interface GuardrailsResult {
  currentRatio: number;           // Current portfolio / target portfolio
  status: 'ceiling' | 'normal' | 'floor';
  recommendedSpending: number;
  spendingChange: number;         // Percentage change from base
  message: string;
}

export function calculateGuardrails(
  currentPortfolio: number,
  targetPortfolio: number,
  baseSpending: number,
  config: GuardrailsConfig
): GuardrailsResult {
  const ratio = currentPortfolio / targetPortfolio;

  if (ratio >= config.upperGuardrail) {
    // Portfolio doing well - can increase spending
    const increase = config.ceilingAdjustment;
    return {
      currentRatio: ratio,
      status: 'ceiling',
      recommendedSpending: baseSpending * (1 + increase),
      spendingChange: increase,
      message: `Portfolio is ${((ratio - 1) * 100).toFixed(0)}% above target. Consider increasing spending by ${(increase * 100).toFixed(0)}%.`,
    };
  }

  if (ratio <= config.lowerGuardrail) {
    // Portfolio struggling - reduce spending
    const decrease = config.floorAdjustment;
    return {
      currentRatio: ratio,
      status: 'floor',
      recommendedSpending: baseSpending * (1 - decrease),
      spendingChange: -decrease,
      message: `Portfolio is ${((1 - ratio) * 100).toFixed(0)}% below target. Consider reducing spending by ${(decrease * 100).toFixed(0)}%.`,
    };
  }

  // Within guardrails - maintain current spending
  return {
    currentRatio: ratio,
    status: 'normal',
    recommendedSpending: baseSpending,
    spendingChange: 0,
    message: 'Portfolio is within target range. Maintain current spending.',
  };
}
```

---

## 7. External API Integrations

### 7.1 Alpha Vantage (Stock Prices)

```typescript
// convex/external/alphavantage.ts

import { action, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

const ALPHA_VANTAGE_BASE = "https://www.alphavantage.co/query";

export const fetchStockPrice = action({
  args: { symbol: v.string() },
  handler: async (ctx, { symbol }) => {
    const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
    if (!apiKey) throw new Error("Alpha Vantage API key not configured");

    const url = `${ALPHA_VANTAGE_BASE}?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${apiKey}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data["Error Message"]) {
      throw new Error(`Alpha Vantage error: ${data["Error Message"]}`);
    }

    if (data["Note"]) {
      // Rate limited
      throw new Error("API rate limit reached. Try again later.");
    }

    const quote = data["Global Quote"];
    if (!quote) {
      throw new Error(`No data found for symbol: ${symbol}`);
    }

    const price = parseFloat(quote["05. price"]);
    const change = parseFloat(quote["09. change"]);
    const changePercent = parseFloat(quote["10. change percent"]?.replace('%', ''));

    // Cache the price
    await ctx.runMutation(internal.external.cachePriceInternal, {
      symbol,
      price,
      change,
      changePercent,
    });

    return { symbol, price, change, changePercent };
  },
});

export const cachePriceInternal = internalMutation({
  args: {
    symbol: v.string(),
    price: v.number(),
    change: v.optional(v.number()),
    changePercent: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("priceCache")
      .withIndex("by_symbol", (q) => q.eq("symbol", args.symbol))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        price: args.price,
        change: args.change,
        changePercent: args.changePercent,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("priceCache", {
        symbol: args.symbol,
        price: args.price,
        change: args.change,
        changePercent: args.changePercent,
        updatedAt: Date.now(),
      });
    }
  },
});
```

### 7.2 Zillow (Home Values)

```typescript
// convex/external/zillow.ts

import { action } from "./_generated/server";
import { v } from "convex/values";

// Note: Zillow's official API requires partnership.
// This uses a workaround approach - may need adjustment based on available APIs.

export const fetchHomeValue = action({
  args: {
    address: v.string(),
    zipCode: v.string(),
  },
  handler: async (ctx, { address, zipCode }) => {
    // Option 1: Use Zillow's unofficial API (may break)
    // Option 2: Use a third-party service like RapidAPI's Zillow endpoints
    // Option 3: Manual entry with periodic user updates

    // For MVP, return a placeholder that prompts manual entry
    // Replace with actual API integration when available

    console.log(`Would fetch home value for: ${address}, ${zipCode}`);

    return {
      success: false,
      message: "Automatic home value lookup not yet configured. Please enter value manually.",
      manualEntryRequired: true,
    };

    // When API is available:
    // const response = await fetch(`...`);
    // return { success: true, value: response.zestimate };
  },
});
```

---

## 8. Testing Strategy

### 8.1 Test Structure

```
__tests__/
├── unit/
│   ├── categorization.test.ts
│   ├── calculations.test.ts
│   ├── csv-parsers.test.ts
│   └── guardrails.test.ts
├── integration/
│   ├── import-flow.test.ts
│   └── monte-carlo.test.ts
└── e2e/
    ├── dashboard.spec.ts
    └── import-wizard.spec.ts
```

### 8.2 Key Test Cases

```typescript
// __tests__/unit/categorization.test.ts

import { categorizeTransaction } from '@/lib/categorization';

describe('categorizeTransaction', () => {
  it('categorizes grocery stores correctly', () => {
    const result = categorizeTransaction('KROGER #1234 COLUMBUS OH');
    expect(result.categoryId).toBe('groceries');
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it('categorizes streaming services as subscriptions', () => {
    const result = categorizeTransaction('NETFLIX.COM');
    expect(result.categoryId).toBe('subscriptions');
  });

  it('returns null for unknown transactions', () => {
    const result = categorizeTransaction('RANDOM BUSINESS XYZ123');
    expect(result.categoryId).toBeNull();
    expect(result.confidence).toBe(0);
  });

  it('prioritizes user rules over system rules', () => {
    const userRules = [
      { pattern: /KROGER/i, categoryId: 'custom_category', priority: 100 }
    ];
    const result = categorizeTransaction('KROGER #1234', userRules);
    expect(result.categoryId).toBe('custom_category');
  });
});
```

---

## 9. Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Vercel                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Next.js App                           │   │
│  │  - Static pages (SSG where possible)                     │   │
│  │  - API routes for server-side logic                      │   │
│  │  - Edge functions for performance                        │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                             │
                             │ HTTPS
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Convex Cloud                             │
│  - Database                                                     │
│  - Real-time subscriptions                                      │
│  - Serverless functions                                         │
│  - Scheduled jobs (price updates)                               │
└─────────────────────────────────────────────────────────────────┘

Environment Variables (Vercel):
- CONVEX_DEPLOYMENT
- NEXT_PUBLIC_CONVEX_URL

Environment Variables (Convex):
- ALPHA_VANTAGE_API_KEY
```

---

## 10. Security Considerations

### 10.1 Data Protection

| Layer | Protection |
|-------|------------|
| Transit | HTTPS/WSS (Convex default) |
| Storage | Convex encryption at rest |
| Account numbers | Masked to last 4 digits before storage |
| API keys | Environment variables only |
| Client code | No secrets, all in server functions |

### 10.2 Input Validation

```typescript
// All Convex mutations validate inputs via v.* validators
// Additional validation in CSV parsing:

function sanitizeDescription(desc: string): string {
  // Remove potential XSS vectors
  return desc
    .replace(/<[^>]*>/g, '')      // Strip HTML tags
    .replace(/[<>"'&]/g, '')      // Remove dangerous chars
    .slice(0, 500);               // Limit length
}

function maskAccountNumber(num: string): string {
  if (!num || num.length < 4) return '****';
  return '****' + num.slice(-4);
}
```

---

## Appendix: File Tree Summary

```
retirement-planner/
├── app/                       # Next.js pages
├── components/                # React components
├── convex/                    # Convex backend
│   ├── schema.ts
│   ├── accounts/
│   ├── transactions/
│   ├── scenarios/
│   ├── analytics/
│   ├── external/
│   └── lib/
├── lib/                       # Client-side utilities
│   ├── csv-parsers/
│   ├── categorization.ts
│   └── calculations/
├── hooks/                     # Custom React hooks
├── store/                     # Zustand store
├── styles/                    # Global styles
├── public/                    # Static assets
├── __tests__/                 # Test files
├── .env.local                 # Local env vars (gitignored)
├── .env.example               # Env var template
├── CLAUDE.md                  # Claude Code context
├── REQUIREMENTS.md            # Requirements doc
├── ARCHITECTURE.md            # This file
└── README.md                  # Project readme
```
