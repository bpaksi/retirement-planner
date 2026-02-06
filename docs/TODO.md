# Retirement Planner - Master TODO

## Phase 0: Convex → SQLite Migration (BLOCKING)
*Goal: Replace Convex with SQLite + Drizzle (free, no limits)*

See: [Migration Plan](./migrations/convex-to-sqlite/TASKS.md)

- [ ] **Task 1**: Setup Drizzle + SQLite
- [ ] **Task 2**: Translate schema (15 tables)
- [ ] **Task 3**: Create query functions
- [ ] **Task 4**: Create Server Actions
- [ ] **Task 5**: Update React components
- [ ] **Task 6**: Cleanup (delete Convex)
- [ ] **Task 7**: Testing

**Estimated: 2 days**

---

## Phase 1: Recurring Transactions & Spending Grid
*Goal: Grid view of recurring expenses with monthly breakdown and totals*

### 1.1 Schema Updates
- [ ] Add `recurringFrequency` to transactions table
- [ ] Add `recurringGroupId` to transactions table
- [ ] Create `recurringPatternSuggestions` table
- [ ] Run schema migration

### 1.2 Recurring Detection Algorithm
- [ ] Create detection algorithm (reuse `lib/similarity.ts`)
- [ ] Create `runDetection` mutation
- [ ] Create `getSuggestions` query
- [ ] Create `confirmSuggestion` mutation
- [ ] Create `dismissSuggestion` mutation
- [ ] Test with sample data

### 1.3 Transactions Page - Recurring Management
- [ ] Add suggestion banner component
- [ ] Add "Mark as Recurring" to context menu
- [ ] Add frequency selector modal
- [ ] Add visual indicator (↻) for recurring transactions
- [ ] Wire up to Convex mutations

### 1.4 Spending Page - Recurring Grid
- [ ] Create `getRecurringGrid` query
- [ ] Build grid header component (months)
- [ ] Build grid row component (item + amounts + total)
- [ ] Build category subtotal rows
- [ ] Build footer with month totals + annual total + monthly avg
- [ ] Add date range selector
- [ ] Style with Tailwind (dark mode)

### 1.5 Testing & Polish
- [ ] Empty state (no recurring)
- [ ] Monthly recurring (Netflix)
- [ ] Quarterly recurring (Trash)
- [ ] Annual recurring (Car insurance)
- [ ] Variable amount (Electric)
- [ ] Grid totals calculate correctly
- [ ] Date range changes update grid

---

## Phase 2: Essential vs Discretionary
*Goal: "$2,500 essential + $3,000 discretionary"*

- [ ] Add essential toggle on recurring grid rows
- [ ] Update `monthlyBaseLivingExpense` in retirementProfile
- [ ] Category default essential flags
- [ ] Two-number summary display
- [ ] Essential/Discretionary subtotals in grid

---

## Phase 3: Preparedness Score
*Goal: "Score: 78/100 - Well Prepared"*

- [ ] Tax-equivalent portfolio calculation by account type
- [ ] Income integration (Social Security, pension, etc.)
- [ ] Score algorithm (Monte Carlo → 0-100)
- [ ] Score card UI with breakdown
- [ ] "To increase your score..." recommendations

---

## Phase 4: Monte Carlo + Solver
*Goal: "85% success, max withdrawal $67k/yr"*

- [ ] Locked scenarios (generate once, reuse)
- [ ] Recovery-first guardrails
- [ ] Three-tier success (Full / Soft / Hard)
- [ ] Max withdrawal solver (binary search)
- [ ] Fan chart visualization
- [ ] Year-by-year breakdown

---

## Future Enhancements

- [ ] Vampire account alerts ("Still using Netflix?")
- [ ] Roth conversion recommendations
- [ ] Tax bracket optimization
- [ ] Multiple income streams with COLA
- [ ] RMD modeling
- [ ] What-if scenario comparisons
