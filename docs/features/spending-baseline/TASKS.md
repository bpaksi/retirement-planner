# Spending Baseline - Implementation Tasks

## Overview

**Goal**: Calculate a single monthly spending baseline from transaction data.

**Output**: "Your baseline spending is $5,500/mo"

**Estimated time**: 1-2 weeks (reduced - significant foundation already exists)

---

## Existing Foundation (Already Built)

| Component | Location | Notes |
|-----------|----------|-------|
| `isRecurring` flag | `transactions` table | Manual flag - will enhance with auto-detection |
| `isEssential` flag | `categories` table | ✅ Ready to use |
| `monthlyBaseLivingExpense` | `retirementProfile` | ✅ Will store the calculated baseline |
| `getSpendingSummary` | `analytics/spending.ts` | Has monthly avg, outliers, data quality |
| Account types | `accounts` table | ✅ `taxTreatment` field exists |
| Income sources | `incomeSources` table | ✅ Has start/end dates |
| Similarity scoring | `lib/similarity.ts` | Can reuse for payee matching |

---

## Phase 1A: Recurring Transaction Detection (3-4 days)

### Task 1.1: Define Recurring Pattern Criteria
**Time**: 2 hours

- [ ] Define what "recurring" means:
  - Same payee (fuzzy match - "NETFLIX" vs "NETFLIX.COM")
  - Similar amount (within ±10%)
  - Regular interval (weekly, bi-weekly, monthly, quarterly, annual)
  - Minimum occurrences (3+ to confirm pattern)

**Output**: TypeScript types for `RecurringPattern`

```typescript
type RecurringPattern = {
  payee: string;
  normalizedPayee: string;  // For matching
  amount: number;
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annual';
  confidence: number;  // 0-1
  transactions: Transaction[];
};
```

---

### Task 1.2: Payee Normalization
**Time**: 4 hours

- [ ] Create payee normalizer function:
  - Lowercase
  - Remove common suffixes (LLC, INC, .COM, etc.)
  - Remove location info (city, state, store #)
  - Handle common variations (AMZN vs AMAZON)

**Examples**:
```
"NETFLIX.COM" → "netflix"
"COSTCO WHSE #1234 SEATTLE WA" → "costco"
"AMAZON.COM*AB1CD2EF3" → "amazon"
"SHELL OIL 57442" → "shell"
```

**Output**: `normalizePayee(rawPayee: string): string`

---

### Task 1.3: Recurring Detection Algorithm
**Time**: 8 hours

- [ ] Group transactions by normalized payee
- [ ] For each group, analyze:
  - Amount consistency (std dev < 10% of mean)
  - Date intervals (detect frequency)
  - Confirm minimum occurrences
- [ ] Calculate confidence score
- [ ] Return list of detected recurring transactions

**Output**: `detectRecurring(transactions: Transaction[]): RecurringPattern[]`

**Test cases**:
- Monthly subscription (Netflix $15.99 on 15th each month)
- Variable utility (Electric $120-$180 monthly)
- Annual payment (Car insurance $1,200 once per year)
- False positive rejection (random Amazon purchases)

---

### Task 1.4: Drizzle Schema Updates
**Time**: 2 hours

- [ ] Update `transactions` table in `src/db/schema.ts`:
  ```typescript
  // Add to existing transactions table
  recurringFrequency: text("recurring_frequency"), // 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annual'
  recurringGroupId: text("recurring_group_id"),
  ```

- [ ] Add `recurringPatterns` table in `src/db/schema.ts`:
  ```typescript
  export const recurringPatterns = sqliteTable("recurring_patterns", {
    id: text("id").primaryKey(),
    normalizedPayee: text("normalized_payee").notNull(),
    exampleDescription: text("example_description").notNull(),
    averageAmount: real("average_amount").notNull(),
    frequency: text("frequency").notNull(), // weekly/biweekly/monthly/quarterly/annual
    confidence: real("confidence").notNull(),
    isEssential: integer("is_essential", { mode: "boolean" }),
    lastDetected: integer("last_detected").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  });
  ```

- [ ] Add Server Action to save detected patterns (`src/app/actions/recurring.ts`)
- [ ] Add query to fetch recurring patterns (`src/db/queries/recurring.ts`)
- [ ] Run `pnpm db:generate` and `pnpm db:migrate`

---

### Task 1.5: Detection Trigger (Server Actions)
**Time**: 3 hours

- [ ] Create `runDetection` Server Action in `src/app/actions/recurring.ts`
- [ ] Call detection after transaction import
- [ ] Re-run detection on demand (button)
- [ ] Show "last analyzed" timestamp
- [ ] Handle incremental updates (new transactions)

---

## Phase 1B: Baseline Calculation (3-4 days)

### Task 1.6: Monthly Recurring Total
**Time**: 2 hours

- [ ] Sum all detected recurring transactions
- [ ] Normalize to monthly:
  - Weekly × 4.33
  - Bi-weekly × 2.17
  - Quarterly ÷ 3
  - Annual ÷ 12

**Output**: `calculateMonthlyRecurring(patterns: RecurringPattern[]): number`

---

### Task 1.7: Variable Spending Average
**Time**: 4 hours

- [ ] Identify non-recurring transactions
- [ ] Group by category
- [ ] Calculate 12-month average per category
- [ ] Sum for total variable spending

**Output**: `calculateVariableSpending(transactions: Transaction[], months: number): number`

**Edge cases**:
- Less than 12 months of data → use available months
- Category with no transactions → $0
- Outlier months (vacation, medical emergency) → flag but include

---

### Task 1.8: Annual Expense Detection & Spreading
**Time**: 4 hours

- [ ] Detect annual patterns (same payee, ~12 months apart)
- [ ] Spread across 12 months in baseline
- [ ] Examples:
  - Car insurance: $1,200/year → $100/mo in baseline
  - Property tax: $4,800/year → $400/mo in baseline
  - Amazon Prime: $139/year → $11.58/mo in baseline

**Output**: `detectAnnualExpenses(transactions: Transaction[]): AnnualExpense[]`

---

### Task 1.9: Baseline Aggregation
**Time**: 2 hours

- [ ] Combine all components:
  ```
  Baseline = Monthly Recurring
           + Variable Average
           + (Annual Expenses ÷ 12)
  ```
- [ ] Create `getSpendingBaseline` query in `src/db/queries/analytics.ts`
- [ ] Track calculation date and inputs

**Output**: `getSpendingBaseline(): BaselineResult`

```typescript
type BaselineResult = {
  total: number;  // Monthly baseline
  breakdown: {
    recurring: number;
    variable: number;
    annualSpread: number;
  };
  calculatedAt: Date;
  dataRange: { start: Date; end: Date };
};
```

---

## Phase 1C: UI Components (3-4 days)

### Task 1.10: Baseline Dashboard Card
**Time**: 4 hours

- [ ] Large number display: "$5,500/mo"
- [ ] Subtitle: "Based on 12 months of transactions"
- [ ] "View breakdown" expandable section
- [ ] "Recalculate" button

**Wireframe**:
```
┌─────────────────────────────────────┐
│  YOUR SPENDING BASELINE             │
│                                     │
│         $5,500/mo                   │
│                                     │
│  Based on 12 months of data         │
│  Last calculated: Jan 15, 2026      │
│                                     │
│  [View Breakdown ▼]  [Recalculate]  │
└─────────────────────────────────────┘
```

---

### Task 1.11: Breakdown View
**Time**: 4 hours

- [ ] Pie or bar chart showing composition
- [ ] List view with categories
- [ ] Recurring vs variable split

**Wireframe**:
```
┌─────────────────────────────────────┐
│  BASELINE BREAKDOWN                 │
│                                     │
│  Recurring:        $2,100/mo        │
│  ├── Mortgage      $1,800           │
│  ├── Utilities     $180             │
│  ├── Subscriptions $120             │
│                                     │
│  Variable (avg):   $2,900/mo        │
│  ├── Groceries     $850             │
│  ├── Dining        $420             │
│  ├── Gas           $280             │
│  └── Shopping      $1,350           │
│                                     │
│  Annual (spread):  $500/mo          │
│  ├── Car Insurance $125             │
│  ├── Property Tax  $375             │
└─────────────────────────────────────┘
```

---

### Task 1.12: Recurring Transactions List
**Time**: 4 hours

- [ ] Table of detected recurring items
- [ ] Columns: Payee, Amount, Frequency, Confidence
- [ ] Allow user to dismiss false positives
- [ ] Allow user to add missed recurring manually

---

### Task 1.13: Vampire Account Alerts
**Time**: 3 hours

- [ ] Detect subscriptions with:
  - No other activity with vendor
  - Running 6+ months
  - Small amounts (< $50/mo)
- [ ] Show alert: "Still using [Service]? $12.99/mo for 18 months"
- [ ] Actions: "Keep" or "Remind me to cancel"

---

## Phase 1D: Testing & Polish (2-3 days)

### Task 1.14: Unit Tests
**Time**: 4 hours

- [ ] Payee normalization tests
- [ ] Recurring detection tests (various patterns)
- [ ] Baseline calculation tests
- [ ] Edge case tests (sparse data, outliers)

---

### Task 1.15: Integration Tests
**Time**: 3 hours

- [ ] Full flow: Import → Detect → Calculate → Display
- [ ] Test with real-ish data (anonymized patterns)

---

### Task 1.16: Performance Testing
**Time**: 2 hours

- [ ] Test with 1 year of transactions (~500-1000 txns)
- [ ] Test with 3 years of transactions (~2000-3000 txns)
- [ ] Ensure detection runs < 2 seconds

---

### Task 1.17: Error Handling & Edge Cases
**Time**: 3 hours

- [ ] No transactions → helpful empty state
- [ ] < 3 months data → warning about accuracy
- [ ] Missing categories → fallback handling
- [ ] Duplicate transactions → deduplication

---

## Deliverables Checklist

At the end of Phase 1, user can:

- [ ] See their monthly spending baseline (single number)
- [ ] View breakdown by recurring/variable/annual
- [ ] See list of detected recurring transactions
- [ ] Dismiss false positives
- [ ] Get alerted about potential vampire subscriptions
- [ ] Recalculate baseline on demand

---

## Dependencies

| Task | Depends On |
|------|------------|
| 1.3 Detection Algorithm | 1.1 Criteria, 1.2 Normalizer |
| 1.4 Schema | 1.1 Criteria |
| 1.5 Trigger | 1.3 Algorithm, 1.4 Schema |
| 1.6 Recurring Total | 1.3 Algorithm |
| 1.7 Variable Average | Existing transaction data |
| 1.8 Annual Detection | 1.2 Normalizer |
| 1.9 Aggregation | 1.6, 1.7, 1.8 |
| 1.10-1.13 UI | 1.9 Aggregation |
| 1.14-1.17 Testing | All above |

---

## Next Phase Preview

**Phase 2: Essential vs Discretionary** will add:
- `isEssential` flag to recurring items
- UI for user to mark each item
- Two-number output: "$2,500 essential + $3,000 discretionary"
