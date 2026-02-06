# Spending Baseline - Gap Analysis

## What Already Exists

### Database Schema
| Table | Field | Purpose | Status |
|-------|-------|---------|--------|
| `transactions` | `isRecurring` | Flag for recurring | Manual only |
| `transactions` | `description` | Payee info | ✅ |
| `transactions` | `amount` | Transaction amount | ✅ |
| `transactions` | `date` | For interval detection | ✅ |
| `categories` | `isEssential` | Essential vs discretionary | ✅ |
| `retirementProfile` | `monthlyBaseLivingExpense` | Store the baseline | ✅ |
| `retirementProfile` | `annualSpending` | Annualized spending | ✅ |

### Queries & Logic
| Function | Location | What It Does | Status |
|----------|----------|--------------|--------|
| `getSpendingSummary` | `analytics/spending.ts` | Monthly avg, median, outliers, data quality | ✅ |
| `getSpendingByCategory` | `analytics/spending.ts` | Category totals, essential vs discretionary | ✅ |
| `getSpendingTrend` | `analytics/spending.ts` | Monthly trend over time | ✅ |
| `calculateSimilarityScore` | `lib/similarity.ts` | Payee matching with aliases | ✅ |
| `getFirstSignificantWord` | `lib/similarity.ts` | Extract merchant name | ✅ |

---

## What's Missing

### 1. Recurring Pattern Detection
**Gap**: `isRecurring` is a manual flag. No auto-detection.

**Need**:
```typescript
// New table: recurringPatterns
{
  normalizedPayee: string;      // "netflix", "costco", etc.
  exampleDescription: string;   // "NETFLIX.COM" (for display)
  averageAmount: number;
  frequency: "weekly" | "biweekly" | "monthly" | "quarterly" | "annual";
  confidence: number;           // 0-1
  transactionCount: number;
  firstSeen: number;
  lastSeen: number;
  isEssential: boolean | null;  // User marks this
  isActive: boolean;            // User can dismiss false positives
}
```

**Algorithm**:
1. Group transactions by normalized payee (reuse `getFirstSignificantWord`)
2. For each group with 3+ transactions:
   - Check amount consistency (std dev < 15% of mean)
   - Check date intervals (detect frequency)
   - Calculate confidence score

### 2. Baseline Aggregation Query
**Gap**: No single query returns "Your baseline is $X/mo"

**Need**:
```typescript
// New query: getSpendingBaseline
{
  total: number;              // Monthly baseline
  recurring: number;          // Sum of detected recurring
  variableAverage: number;    // 12-month avg of non-recurring
  annualSpread: number;       // Annual expenses / 12
  essential: number;          // Sum of essential categories
  discretionary: number;      // total - essential
  confidence: "high" | "medium" | "low";
  calculatedAt: number;
}
```

### 3. Annual Expense Detection
**Gap**: No detection of annual patterns (car insurance, property tax)

**Need**: Enhance recurring detection to identify yearly patterns

### 4. Vampire Account Detection
**Gap**: No alerting for potentially unused subscriptions

**Need**:
```typescript
// New query: getVampireAccounts
{
  payee: string;
  amount: number;
  monthsActive: number;
  lastTransaction: number;
  // Flag if: recurring, small amount, no other activity with vendor
}
```

### 5. UI Components
**Gap**: No baseline dashboard card

**Need**:
- Baseline summary card with single number
- Breakdown view (recurring/variable/annual)
- Recurring items list with essential toggle
- Vampire alerts

---

## Implementation Priority

### Must Have (MVP)
1. ✅ Schema: Add `recurringPatterns` table
2. ✅ Detection: Auto-detect recurring from transaction patterns
3. ✅ Query: `getSpendingBaseline` returns single number
4. ✅ UI: Baseline card on dashboard

### Should Have
5. Annual expense detection (spread over 12 months)
6. Essential marking UI for recurring items
7. Sync baseline to `retirementProfile.monthlyBaseLivingExpense`

### Nice to Have
8. Vampire account alerts
9. "Recalculate" button with loading state
10. Trend comparison ("vs last year")

---

## Estimated Effort (Revised)

| Task | Estimate | Notes |
|------|----------|-------|
| Schema + recurring detection | 4-6 hours | Reuse similarity.ts |
| Baseline aggregation query | 2-3 hours | Combine existing queries |
| UI components | 4-6 hours | Dashboard card + breakdown |
| Testing | 2-3 hours | Edge cases |
| **Total** | **12-18 hours** | ~2-3 days focused work |

---

## Files to Create/Modify

### New Files
```
src/
├── db/
│   └── queries/
│       └── recurring.ts    # getRecurringPatterns, detectRecurring
├── app/
│   ├── actions/
│   │   └── recurring.ts    # markEssential, dismissPattern
│   └── spending/
│       └── baseline/
│           └── page.tsx    # Baseline dashboard view
└── components/
    └── spending/
        ├── BaselineCard.tsx
        ├── RecurringList.tsx
        └── BaselineBreakdown.tsx
```

### Modified Files
```
src/db/schema.ts            # Add recurringPatterns table
src/db/queries/analytics.ts # Add getSpendingBaseline query
src/app/spending/page.tsx   # Add baseline card to existing page
```
