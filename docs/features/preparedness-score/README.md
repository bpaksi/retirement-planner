# Preparedness Score Feature

## The Vision

> A single number (0-100) that represents how prepared you are for retirement.

Like a credit score, but for retirement readiness.

---

## Why This Matters

**Two people with $1,000,000 portfolios can have very different preparedness:**

| Person | Portfolio | Account Mix | Income | Score |
|--------|-----------|-------------|--------|-------|
| Alice | $1M | 100% Roth IRA | SS: $2,500/mo | **92** |
| Bob | $1M | 100% Traditional 401k | None | **68** |
| Carol | $1M | 50% Taxable, 50% Traditional | Pension: $1,500/mo | **81** |

**Why the difference?**

- **Alice**: Tax-free withdrawals (Roth), plus Social Security income
- **Bob**: Every dollar withdrawn is taxed, no other income, will face RMDs
- **Carol**: Mixed tax treatment, pension reduces portfolio dependency

---

## Score Definition

```
100 = Can maintain full lifestyle forever (never cut spending)
 75 = High confidence, may need minor adjustments
 50 = Borderline - significant risk of needing cuts
 25 = Underfunded - will likely need to reduce lifestyle
  0 = Cannot afford even essentials
```

---

## Factors That Affect The Score

### 1. Account Type Mix (Tax-Equivalent Value)

Not all dollars are equal. A dollar in a Roth is worth more than a dollar in a Traditional account.

**Tax-Equivalent Calculation:**

| Account Type | $100,000 Nominal | Tax-Equivalent Value* |
|--------------|------------------|----------------------|
| Roth IRA | $100,000 | **$100,000** (no tax) |
| Traditional IRA/401k | $100,000 | **$78,000** (at 22% bracket) |
| Taxable (50% gains) | $100,000 | **$92,500** (at 15% cap gains) |
| HSA (medical use) | $100,000 | **$100,000** (tax-free) |

*Assumes 22% marginal bracket in retirement, 15% long-term cap gains

**Why this matters:**
- Bob's $1M Traditional = ~$780k tax-equivalent
- Alice's $1M Roth = $1M tax-equivalent
- Alice has 28% more "real" money

### 2. Income Sources (Reduces Portfolio Dependency)

Income sources offset how much you need from your portfolio:

```
Monthly Need:        $5,500
Social Security:    -$2,000
Pension:            -$1,500
─────────────────────────────
Portfolio Must Fund: $2,000/mo ($24,000/yr)
```

**Effect on score:**
- Without income: $1M portfolio funds $5,500/mo for ~15 years
- With income: $1M portfolio funds $2,000/mo for ~40+ years

Income sources dramatically increase preparedness.

### 3. Spending Baseline (From Spending Analysis)

Lower spending = higher preparedness for the same portfolio.

```
$1M portfolio, $3,000/mo spending → High preparedness
$1M portfolio, $8,000/mo spending → Low preparedness
```

### 4. Time Horizon

How long does the money need to last?

```
Retire at 65, plan to 90 = 25 years
Retire at 55, plan to 95 = 40 years
```

Longer horizon = lower score (all else equal).

---

## Score Calculation (Conceptual)

```typescript
function calculatePreparednessScore(inputs: {
  accounts: Account[];           // Holdings with account types
  spending: SpendingBaseline;    // From spending analysis
  incomeSources: IncomeSource[]; // SS, pension, etc.
  timeHorizon: number;           // Years in retirement
}): number {

  // 1. Calculate tax-equivalent portfolio value
  const taxEquivalentValue = accounts.reduce((sum, acct) => {
    return sum + applyTaxEquivalentMultiplier(acct);
  }, 0);

  // 2. Calculate net withdrawal need (spending - income)
  const annualSpending = spending.baseline * 12;
  const annualIncome = incomeSources.reduce((sum, src) => {
    return sum + src.annualAmount;
  }, 0);
  const netWithdrawalNeed = Math.max(0, annualSpending - annualIncome);

  // 3. Run Monte Carlo with these inputs
  const mcResult = runMonteCarloProjection({
    startingPortfolio: taxEquivalentValue,
    annualWithdrawal: netWithdrawalNeed,
    essentialFloor: spending.essential * 12,
    years: timeHorizon,
  });

  // 4. Convert to 0-100 score
  //    100 = 100% full success (never cut)
  //    0 = 0% combined success (always fails)
  const score = calculateScoreFromResults(mcResult);

  return score;
}
```

### Score Mapping (Draft)

| Monte Carlo Result | Score Range |
|--------------------|-------------|
| 100% full success | 90-100 |
| 95-99% full success | 80-89 |
| 85-94% full success | 70-79 |
| 100% combined success (may cut discretionary) | 60-69 |
| 90-99% combined success | 50-59 |
| 80-89% combined success | 40-49 |
| 70-79% combined success | 30-39 |
| Below 70% combined | 0-29 |

---

## Using Investment Data

### Data Already Available

| Data | Use In Preparedness Score |
|------|---------------------------|
| Account balances | Starting portfolio value |
| Account types (401k, Roth, etc.) | Tax-equivalent multiplier |
| Holdings | Asset allocation → Monte Carlo assumptions |
| Expense ratios | Reduce effective returns |

### Tax-Equivalent Multipliers

```typescript
const TAX_MULTIPLIERS = {
  'roth_ira': 1.00,        // No tax on withdrawal
  'roth_401k': 1.00,
  'hsa': 1.00,             // Tax-free for medical
  'traditional_ira': 0.78, // Assumes 22% bracket
  'traditional_401k': 0.78,
  'brokerage': 0.925,      // Assumes 50% basis, 15% LTCG
  'money_market': 1.00,    // Already taxed
  'bank': 1.00,
};

function getTaxEquivalentValue(account: Account): number {
  const multiplier = TAX_MULTIPLIERS[account.type] ?? 0.85;
  return account.balance * multiplier;
}
```

---

## UI Concept

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                    RETIREMENT PREPAREDNESS                      │
│                                                                 │
│                          ┌─────┐                                │
│                          │ 78  │                                │
│                          └─────┘                                │
│                                                                 │
│                    "Well Prepared"                              │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  WHAT'S HELPING                    WHAT'S HURTING              │
│  ✓ Social Security: +12 pts        ✗ High spending: -8 pts     │
│  ✓ Roth accounts: +6 pts           ✗ 40-year horizon: -5 pts   │
│  ✓ Pension income: +4 pts                                       │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  TO INCREASE YOUR SCORE:                                        │
│  • Reduce discretionary spending by $500/mo → +8 pts            │
│  • Delay retirement 2 years → +6 pts                            │
│  • Convert $50k to Roth this year → +2 pts                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Relationship to Other Features

```
┌─────────────────────────────────────────────────────────────────┐
│  INVESTMENT HOLDINGS          SPENDING BASELINE                 │
│  (account types, balances)    (monthly need, essential floor)   │
│           │                            │                        │
│           └──────────┬─────────────────┘                        │
│                      ▼                                          │
│           ┌─────────────────────┐                               │
│           │ PREPAREDNESS SCORE  │  ← Synthesizes everything     │
│           │      (0-100)        │                               │
│           └─────────────────────┘                               │
│                      │                                          │
│           ┌──────────┴──────────┐                               │
│           ▼                     ▼                               │
│    Monte Carlo             Max Withdrawal                       │
│    (detailed view)         Solver                               │
└─────────────────────────────────────────────────────────────────┘
```

**The Preparedness Score is the "headline" - Monte Carlo is the "details"**

---

## Open Questions

1. **Calibration**: How do we ensure the score feels "right"? (78 should feel meaningfully different from 65)

2. **Tax bracket estimation**: Should we ask user's expected retirement tax bracket, or estimate from income sources?

3. **RMDs**: Traditional accounts have Required Minimum Distributions at 73. Should this affect the score?

4. **Sequence of withdrawals**: Standard advice is taxable → tax-deferred → Roth. Should score assume optimal ordering?

5. **Inflation on income**: SS has COLA, pensions often don't. Model this?

---

## MVP vs Future

### MVP
- Tax-equivalent portfolio value
- Single income source (Other Income field)
- Basic score calculation from Monte Carlo results

### Future
- Multiple income sources with start dates
- RMD modeling
- Roth conversion recommendations
- Tax bracket optimization
- "What-if" score comparisons
