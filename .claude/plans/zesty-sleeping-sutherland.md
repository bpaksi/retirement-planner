# Improve Transaction Categorization

## Problem
Most transactions showing as "Uncategorized" + transfers incorrectly counted as spending.

## User Requirements
1. **No hardcoded rules** - All rules configurable via Settings UI
2. **Full Settings UI** - Dedicated page to manage categorization rules (CRUD)
3. **Transfers shown separately** - Not in spending totals, but visible with explanation of what they are

---

## Implementation Plan

### Phase 1: Spending Analytics - Separate Transfers

**Files to modify:**
- `convex/analytics/spending.ts`
- `src/app/spending/page.tsx`

**Changes to `getSpendingByCategory`:**
```typescript
// Get categories to identify transfer type
const transferCategoryIds = new Set(
  categories.filter(c => c.type === "transfer").map(c => c._id)
);

// Split transactions into spending vs transfers
const spendingTxs = filtered.filter(t => !transferCategoryIds.has(t.categoryId));
const transferTxs = filtered.filter(t => transferCategoryIds.has(t.categoryId));

// Return both
return {
  byCategory: spendingResults,  // excludes transfers
  totalSpending,                // excludes transfers
  essentialSpending,
  discretionarySpending,
  transactionCount: spendingTxs.length,
  transfers: {
    total: transferTotal,
    count: transferTxs.length,
  },
};
```

**Changes to spending page:**
- New summary card "Transfers" with info icon tooltip:
  > "Transfers include credit card payments, bank transfers, loan payments, and money moved between accounts. These aren't counted as spending since they don't represent actual purchases."

### Phase 2: Categorization Rules Settings UI

**Files to create:**
- `convex/categorizationRules/queries.ts`
- `convex/categorizationRules/mutations.ts`
- `src/app/settings/rules/page.tsx`

**Files to modify:**
- `src/app/settings/page.tsx` (add link to rules page)

**Convex queries:**
```typescript
// queries.ts
export const list = query({...}); // All rules, sorted by priority
export const testPattern = query({...}); // Test regex against transactions
```

**Convex mutations:**
```typescript
// mutations.ts
export const create = mutation({...});
export const update = mutation({...});
export const remove = mutation({...});
export const toggleActive = mutation({...});
```

**Rules Page UI:**
- Table: Pattern | Category | Priority | Source | Matches | Active | Actions
- "Add Rule" button → modal with form
- "Test Pattern" shows matching transaction descriptions
- Edit inline or via modal
- Delete with confirmation
- "Re-categorize All" button at top

### Phase 3: Re-categorization Feature

**File:** `convex/transactions/mutations.ts`

```typescript
export const recategorizeUncategorized = mutation({
  args: {},
  handler: async (ctx) => {
    // Get uncategorized transactions
    // Get active rules sorted by priority
    // Match and update
    // Return { updated, stillUncategorized }
  },
});
```

### Phase 4: Expand Default Rules (One-time seed update)

**File:** `convex/seed.ts`

Since rules are already seeded, we'll add a migration or "refresh defaults" option. For now, focus on the UI so user can add rules manually.

Recommended patterns to add (user can do via UI):
- Groceries: `ALDI|KROGER|MEIJER STORE|TRADER|WHOLE FOODS|SAFEWAY|PUBLIX|FOOD`
- Dining: `RESTAURANT|GRILL|PUB|BAR|CAFE|PIZZA|BUFFET|SUSHI|BAKERY|BREWING|TAVERN`
- Shopping: `WALMART|TARGET|AMAZON|COSTCO|HOBBY LOBBY|DOLLAR|MENARDS|HOME DEPOT`
- Transfers: `TRANSFER|AUTOPAY|CRCARDPMT|PAYMENT/CREDIT|LOAN PAYMENT|BILLPAY`

---

## Files Summary

| File | Action |
|------|--------|
| `convex/analytics/spending.ts` | Modify - separate transfers |
| `src/app/spending/page.tsx` | Modify - transfers card |
| `convex/categorizationRules/queries.ts` | Create |
| `convex/categorizationRules/mutations.ts` | Create |
| `src/app/settings/rules/page.tsx` | Create |
| `src/app/settings/page.tsx` | Modify - link to rules |
| `convex/transactions/mutations.ts` | Modify - add recategorize |

---

## Verification

1. **Spending page**:
   - Transfers card shows with correct total
   - Total Spending excludes transfers
   - Pie chart doesn't show Transfers slice

2. **Settings → Import Rules**:
   - Lists all rules from database
   - Can add new rule with pattern/category/priority
   - Can edit existing rule
   - Can delete user rules
   - Can toggle active/inactive
   - "Test Pattern" shows matching descriptions

3. **Re-categorize**:
   - Button shows count of uncategorized
   - After click, count decreases
   - Spending page updates

---

## Implementation Order

1. **Phase 1** - Transfers separation (quick win, improves accuracy)
2. **Phase 2** - Rules Settings UI (main deliverable)
3. **Phase 3** - Re-categorize mutation (lets user benefit immediately)
