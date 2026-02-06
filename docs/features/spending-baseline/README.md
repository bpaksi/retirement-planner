# Spending Baseline Feature

## The Core Insight

> "I spend more than I thought."

This is the **aha moment**. Most people underestimate their spending. This feature helps users see reality.

---

## Why This Is The Foundation

```
┌─────────────────────────────────────────────────────────────┐
│  THE RETIREMENT QUESTION ISN'T "HOW MUCH DO I HAVE?"        │
│                                                             │
│  IT'S "HOW MUCH DO I NEED?"                                 │
│                                                             │
│  Person A: $1M portfolio, $3,500/mo spending → CAN retire   │
│  Person B: $2M portfolio, $9,000/mo spending → CAN'T retire │
└─────────────────────────────────────────────────────────────┘
```

**Feature hierarchy:**

```
1. SPENDING BASELINE (this feature)     ← Foundation
   └── "What do I actually spend?"

2. ESSENTIAL vs DISCRETIONARY           ← Flexibility insight
   └── "What MUST I spend vs COULD cut?"

3. MONTE CARLO PROJECTIONS              ← Validation
   └── "Will my portfolio support this spending?"

4. MAX WITHDRAWAL SOLVER                ← Optimization
   └── "What's the most I can withdraw?"
```

---

## Current State (Already Built)

- Transaction import from banks (CSV)
- Categorization (manual + rule-based + bank pre-categorized)
- Spending totals by category (monthly/yearly)

---

## New Feature: Spending Baseline Calculator

### Inputs

| Source | How It Works |
|--------|--------------|
| **Recurring transactions** | Auto-detected from patterns (same payee, similar amount, regular interval) |
| **Variable spending** | 12-month average by category |
| **Annual expenses** | Detected and spread across 12 months |

### Output

**Primary**: Single number

> "Your baseline spending is **$5,500/mo**"

**On demand**: Breakdown by category, recurring vs variable, essential vs discretionary

---

## Sub-Features

### 1. Recurring Transaction Detection

**Goal**: Auto-identify subscriptions and regular payments

**Detection criteria:**
- Same payee (fuzzy match)
- Similar amount (±10%)
- Regular interval (weekly, monthly, quarterly, annual)

**Output:**
```
RECURRING CHARGES: $487/mo
├── Netflix         $15.99/mo
├── Spotify         $10.99/mo
├── Gym             $49.00/mo
├── Car Insurance   $125.00/mo (annual spread)
├── Electric        $145.00/mo (average)
└── ... 12 more
```

### 2. Vampire Account Detection

**Goal**: Flag forgotten or unused subscriptions

**Criteria:**
- Recurring charge
- No other transactions with that vendor
- Running for 6+ months

**Alert:**
> "You've paid **$12.99/mo** to OLD_SERVICE for **18 months** ($234 total). Still using it?"

### 3. Next Month Prediction

**Goal**: Estimate next month's baseline before it happens

**Calculation:**
```
Predicted = Known recurring + Average variable spending
         = $487 (recurring) + $2,100 (avg groceries, gas, etc.)
         = $2,587 baseline
```

### 4. Essential vs Discretionary Marking

**Goal**: User identifies which spending is "must have" vs "nice to have"

**Flow:**
1. App presents detected recurring items
2. User marks each as Essential or Discretionary
3. Variable categories get default (user can override)

**Defaults:**
| Category | Default |
|----------|---------|
| Utilities | Essential |
| Insurance | Essential |
| Groceries | Essential |
| Mortgage/Rent | Essential |
| Dining Out | Discretionary |
| Entertainment | Discretionary |
| Subscriptions | Discretionary |

**Output:**
```
MONTHLY BASELINE: $5,500

Essential (floor):    $2,500/mo
├── Mortgage          $1,800
├── Utilities         $280
├── Insurance         $220
└── Groceries         $200 (minimum)

Discretionary:        $3,000/mo
├── Dining            $450
├── Entertainment     $280
├── Subscriptions     $120
├── Shopping          $650
└── Groceries (extra) $400
└── ... etc
```

---

## Liabilities (Ending Expenses)

**Goal**: Track expenses that will end at a known date

**Input:**
```
Liability: Mortgage
Amount: $1,800/mo
End Date: January 2032
```

**Effect on projections:**
- Baseline is $5,500/mo until Jan 2032
- Baseline drops to $3,700/mo after mortgage payoff
- Monte Carlo adjusts spending year-by-year

---

## Connection to Monte Carlo

**Flow:**
1. Spending Baseline calculates: `$5,500/mo`
2. System suggests this as withdrawal amount for projections
3. User can override (adjust up/down)
4. Monte Carlo validates sustainability

**UI:**
```
┌─────────────────────────────────────────────────────────────┐
│  RETIREMENT PROJECTIONS                                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Monthly Withdrawal: [$5,500] ← suggested from baseline     │
│                      (Your spending baseline is $5,500)     │
│                                                             │
│  Essential Floor:    $2,500/mo (from your marked items)     │
│                                                             │
│  [Run Projection]                                           │
└─────────────────────────────────────────────────────────────┘
```

---

## Income (MVP - Basic)

**For MVP**: Single "Other Income" field

```
Other Income: $2,000/mo
Starting: Age 67
```

**Effect:**
- Net withdrawal = Spending - Income
- $5,500 spending - $2,000 SS = $3,500/mo from portfolio

**Future enhancement:** Multiple income streams with COLA adjustments

---

## Success Metrics

| Metric | Target |
|--------|--------|
| User sees baseline number | 100% of users |
| User marks essential vs discretionary | 80% of users |
| User discovers a "vampire" subscription | 50% of users |
| User adjusts behavior based on insight | Qualitative |

---

## Open Questions

1. **Categorization accuracy**: How good is auto-detection? Need fallback for edge cases?
2. **Historical data**: How many months of data needed for reliable baseline?
3. **Inflation adjustment**: Should baseline auto-inflate for projections?
4. **Joint accounts**: Single user for now, but how to handle shared expenses?
