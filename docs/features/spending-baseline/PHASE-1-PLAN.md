# Phase 1: Spending Baseline - Implementation Plan

## Goal
> Grid view of recurring expenses with monthly breakdown and totals

## Timeline
**Estimated: 2-3 weeks**

---

## UI Overview

### Transactions Page (Management)
- Mark transactions as recurring (Monthly/Quarterly/Annual)
- Auto-detection suggests recurring patterns
- User confirms, dismisses, or manually creates recurring units

### Spending Page (View)
- Grid view: Months across top, Category/Description on Y-axis
- Row totals for each item
- Category subtotals
- Monthly column totals
- Annual total and monthly average

---

## Task Breakdown

### 1.1 Schema Updates
**Time: 2 hours**

Add to `src/db/schema.ts`:

```typescript
// Add to transactions table
recurringFrequency: text("recurring_frequency"), // 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annual'
recurringGroupId: text("recurring_group_id"),    // Groups related transactions

// New table for recurring pattern suggestions (auto-detected)
export const recurringPatterns = sqliteTable("recurring_patterns", {
  id: text("id").primaryKey(),
  normalizedPayee: text("normalized_payee").notNull(),
  exampleDescription: text("example_description").notNull(),
  averageAmount: real("average_amount").notNull(),
  suggestedFrequency: text("suggested_frequency").notNull(), // weekly/biweekly/monthly/quarterly/annual
  confidence: real("confidence").notNull(),
  transactionCount: integer("transaction_count").notNull(),
  status: text("status").notNull().default("pending"), // pending/confirmed/dismissed
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

// Index for efficient queries
export const recurringPatternsStatusIdx = index("recurring_patterns_status_idx").on(recurringPatterns.status);
export const recurringPatternsPayeeIdx = index("recurring_patterns_payee_idx").on(recurringPatterns.normalizedPayee);
```

**Checklist:**
- [ ] Add `recurringFrequency` to transactions table
- [ ] Add `recurringGroupId` to transactions table
- [ ] Create `recurringPatterns` table
- [ ] Run `pnpm db:generate` and `pnpm db:migrate`

---

### 1.2 Recurring Detection Algorithm
**Time: 4-6 hours**

**Files:**
```
src/db/queries/recurring.ts     # getSuggestions, getRecurringTransactions, detection logic
src/app/actions/recurring.ts    # confirmSuggestion, dismissSuggestion, markAsRecurring
src/lib/recurring/detection.ts  # Core detection algorithm
```

**Algorithm:**
1. Group transactions by normalized payee
2. For groups with 3+ transactions:
   - Check amount consistency (std dev < 15%)
   - Detect interval pattern
   - Calculate confidence score
3. Store as suggestions (status: "pending")

**Checklist:**
- [ ] Create detection algorithm (reuse `lib/similarity.ts`)
- [ ] Create `runDetection` Server Action
- [ ] Create `getSuggestions` query (pending only)
- [ ] Create `confirmSuggestion` Server Action
- [ ] Create `dismissSuggestion` Server Action
- [ ] Test with sample data

---

### 1.3 Transactions Page - Recurring Management
**Time: 4-6 hours**

**Features:**
1. Suggestion banner when pending suggestions exist
2. "Mark as Recurring" in transaction context menu
3. Visual indicator (↻) on recurring transactions
4. Frequency selector (Monthly/Quarterly/Annual)

**Files:**
```
src/components/transactions/
├── RecurringSuggestionBanner.tsx
├── RecurringIndicator.tsx
└── MarkRecurringModal.tsx
```

**Checklist:**
- [ ] Add suggestion banner component
- [ ] Add "Mark as Recurring" to context menu
- [ ] Add frequency selector modal
- [ ] Add visual indicator for recurring transactions
- [ ] Wire up to Server Actions

---

### 1.4 Spending Page - Recurring Grid
**Time: 6-8 hours**

**Grid Structure:**
```
                    Jan    Feb    Mar   ...   Dec   │ TOTAL
─────────────────────────────────────────────────────────────
CATEGORY
  Description       $XX    $XX    $XX   ...   $XX   │ $XXXX
  Description       $XX    $XX    $XX   ...   $XX   │ $XXXX
                   ─────────────────────────────────┼───────
  Subtotal          $XX    $XX    $XX   ...   $XX   │ $XXXX

MONTH TOTAL         $XX    $XX    $XX   ...   $XX   │ $XXXX
─────────────────────────────────────────────────────────────
                                    ANNUAL TOTAL:   │ $XXXX
                                    MONTHLY AVG:    │ $XXXX
```

**Files:**
```
src/app/spending/recurring/page.tsx
src/components/spending/
├── RecurringGrid.tsx
├── RecurringGridRow.tsx
├── RecurringGridHeader.tsx
└── RecurringGridTotals.tsx
```

**Query needed:**
```typescript
// src/db/queries/recurring.ts
export function getRecurringGrid(startDate: number, endDate: number): RecurringGridData {
  // Returns:
  // {
  //   categories: [{
  //     name: string,
  //     items: [{
  //       description: string,
  //       frequency: string,
  //       months: { [month: string]: number },
  //       total: number,
  //     }],
  //     subtotal: { months: {...}, total: number },
  //   }],
  //   monthTotals: { [month: string]: number },
  //   annualTotal: number,
  //   monthlyAverage: number,
  // }
}
```

**Checklist:**
- [ ] Create `getRecurringGrid` query
- [ ] Build grid header component (months)
- [ ] Build grid row component (item + amounts + total)
- [ ] Build category subtotal rows
- [ ] Build footer with month totals
- [ ] Add date range selector
- [ ] Style with Tailwind (dark mode)

---

### 1.5 Testing & Polish
**Time: 2-3 hours**

**Test Cases:**
- [ ] No recurring transactions → empty state
- [ ] Monthly recurring (Netflix $15.99)
- [ ] Quarterly recurring (Trash $89)
- [ ] Annual recurring (Car insurance $1,500)
- [ ] Variable amount recurring (Electric $120-180)
- [ ] Grid totals calculate correctly
- [ ] Date range changes update grid

---

## Dependencies

```
1.1 Schema
    │
    ▼
1.2 Detection ───────► 1.3 Transactions UI
    │                         │
    │                         │
    └─────────► 1.4 Spending Grid
                      │
                      ▼
                1.5 Testing
```

---

## Definition of Done

Phase 1 is complete when:

- [ ] User can mark transactions as recurring on Transactions page
- [ ] Auto-detection suggests recurring patterns
- [ ] User can confirm/dismiss suggestions
- [ ] Spending page shows recurring grid with:
  - [ ] Months across top
  - [ ] Category/Description on Y-axis
  - [ ] Row totals for each item
  - [ ] Category subtotals
  - [ ] Monthly column totals
  - [ ] Annual total and monthly average
- [ ] Date range selector works
- [ ] All totals calculate correctly
