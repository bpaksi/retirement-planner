# Feature Specification: Monte Carlo + Guardrails Optimization

## Overview

A retirement success prediction system that combines Monte Carlo simulation with dynamic guardrails to answer the question: **"What's the maximum I can withdraw on day 1 of retirement while maintaining my target success probability?"**

---

## Core Concepts

### Success Definition (User-Configurable)
- **Primary**: Money lasts until end of time horizon (portfolio ≥ $0)
- **With Legacy**: Money lasts AND leaves target inheritance amount
- **Success Threshold**: User targets ~70% (not the industry-standard 90-95%)
  - Rationale: Higher success rates = dying with too much money = under-living

### The "Tipping Point"
The inflection point on the success curve where increasing withdrawal causes success probability to drop rapidly. This is the optimal withdrawal rate.

---

## Goal Set Model

A **Goal Set** is a complete, versionable retirement plan that can be tested and compared.

### Goal Set Fields

```typescript
interface GoalSet {
  id: string;
  name: string;
  isCurrent: boolean;           // Only one can be "current"
  createdAt: Date;

  // Retirement Timing
  retirementAge: number;
  lifeExpectancyAge: number;    // Adjustable: 90, 95, 100

  // Spending
  initialAnnualSpending: number;
  spendingInflationRate: number;
  essentialSpendingFloor: number; // Minimum (can't go below this)

  // Guardrails
  guardrails: {
    enabled: boolean;
    upperThreshold: number;     // e.g., 1.20 (20% above target)
    lowerThreshold: number;     // e.g., 0.80 (20% below target)
    ceilingAdjustment: number;  // e.g., 0.10 (increase 10%)
    floorAdjustment: number;    // e.g., 0.10 (decrease 10%)
  };

  // Social Security
  socialSecurity: {
    claimingAge: number;        // 62, 67, or 70
    monthlyBenefit: number;     // At claiming age
    colaRate: number;           // Annual COLA assumption
  };

  // Part-Time Work
  partTimeWork: {
    enabled: boolean;
    annualIncome: number;
    yearsAfterRetirement: number; // e.g., work 5 years post-retirement
  };

  // Legacy
  legacyTarget: number;         // Target inheritance amount (can be 0)

  // Return Assumptions
  preRetirementReturn: number;
  postRetirementReturn: number;
  returnStdDev: number;         // Volatility assumption
  inflationRate: number;
}
```

### Goal Set Workflow

```
┌─────────────────────────────────────────────────────────────────────┐
│                        GOAL SETS                                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────┐    ┌─────────────────────┐                │
│  │ ★ CURRENT           │    │   TEST: Early SS    │                │
│  │ "Retire at 62"      │    │   Claim SS at 62    │                │
│  │                     │    │   instead of 67     │                │
│  │ Retire: 62          │    │                     │                │
│  │ Spend: $72K/yr      │    │   [Compare]         │                │
│  │ SS at 67: $2,800/mo │    │   [Promote to       │                │
│  │ Legacy: $100K       │    │    Current]         │                │
│  │                     │    │   [Delete]          │                │
│  │ Success: 73%        │    │                     │                │
│  │ Max Withdraw: $74K  │    │   Success: 68%      │                │
│  └─────────────────────┘    └─────────────────────┘                │
│                                                                     │
│  [+ Create Test Goal]                                               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Primary Visualization: Success Curve

### The Curve

```
Success   │
Rate      │
100%      │████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
          │██████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
 90%      │████████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░
          │██████████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░
 80%      │████████████████████████████░░░░░░░░░░░░░░░░░░░░░░░░
          │██████████████████████████████░░░░░░░░░░░░░░░░░░░░░░
 70%      │─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─●─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  ← Target
          │████████████████████████████████░░░░░░░░░░░░░░░░░░░░     $72K
 60%      │██████████████████████████████████░░░░░░░░░░░░░░░░░░
          │████████████████████████████████████░░░░░░░░░░░░░░░░
 50%      │██████████████████████████████████████░░░░░░░░░░░░░░
          │██████████████████████████████████████████░░░░░░░░░░
 40%      │████████████████████████████████████████████░░░░░░░░
          └────────────────────────────────────────────────────────
          $40K   $50K   $60K   $70K   $80K   $90K  $100K  $110K
                        Initial Annual Withdrawal

          Legend:
          ████ = With Guardrails
          ░░░░ = Without Guardrails (for comparison)
          ● = Your max withdrawal at 70% success
```

### Comparison View (Current vs Test)

```
Success   │
Rate      │
100%      │▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
          │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
 90%      │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
          │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
 80%      │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
          │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░
 70%      │─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─●─ ─ ─◆─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
          │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░
 60%      │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░
          └────────────────────────────────────────────────────────
          $40K   $50K   $60K   $70K   $80K   $90K  $100K  $110K

          Legend:
          ▓▓▓▓ = Current Goal (SS at 67)     ● Max: $72K
          ░░░░ = Test Goal (SS at 62)        ◆ Max: $78K
```

---

## Solver: Find Max Withdrawal

### Algorithm

```typescript
function findMaxWithdrawal(
  goalSet: GoalSet,
  targetSuccessRate: number,  // e.g., 0.70
  iterations: number = 1000
): { maxWithdrawal: number; actualSuccessRate: number } {

  // Binary search for optimal withdrawal
  let low = goalSet.essentialSpendingFloor;
  let high = goalSet.initialAnnualSpending * 2;  // Upper bound
  let result = low;

  while (high - low > 100) {  // $100 precision
    const mid = (low + high) / 2;

    // Run simulation with this withdrawal amount
    const testGoal = { ...goalSet, initialAnnualSpending: mid };
    const successRate = runMonteCarloSimulation(testGoal, iterations);

    if (successRate >= targetSuccessRate) {
      result = mid;
      low = mid;  // Can try higher
    } else {
      high = mid;  // Need to go lower
    }
  }

  // Final verification
  const finalGoal = { ...goalSet, initialAnnualSpending: result };
  const actualRate = runMonteCarloSimulation(finalGoal, iterations);

  return {
    maxWithdrawal: result,
    actualSuccessRate: actualRate
  };
}
```

### Output Display

```
┌─────────────────────────────────────────────────────────────────────┐
│  MAXIMUM SAFE WITHDRAWAL CALCULATOR                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Goal Set: "Retire at 62" (Current)                                │
│  Target Success Rate: 70%                                           │
│  Time Horizon: 33 years (to age 95)                                │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                                                             │   │
│  │   YOUR MAXIMUM DAY-1 WITHDRAWAL                             │   │
│  │                                                             │   │
│  │        ╔═══════════════════════════════════╗               │   │
│  │        ║                                   ║               │   │
│  │        ║      $72,400 / year              ║               │   │
│  │        ║      ($6,033 / month)            ║               │   │
│  │        ║                                   ║               │   │
│  │        ║      4.02% withdrawal rate       ║               │   │
│  │        ║                                   ║               │   │
│  │        ╚═══════════════════════════════════╝               │   │
│  │                                                             │   │
│  │   Success Rate: 71.2% (1000 simulations)                   │   │
│  │                                                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  WITH GUARDRAILS (±20%):                                           │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Good Years (ceiling):  Up to $86,880/year                  │   │
│  │  Base Spending:         $72,400/year                        │   │
│  │  Tough Years (floor):   Down to $57,920/year               │   │
│  │  Absolute Minimum:      $45,000/year (your essentials)     │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  [Find Max Withdrawal]   [Update Goal]   [Save as New Goal]        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Part-Time Work Modeling

```typescript
interface PartTimeWork {
  enabled: boolean;
  annualIncome: number;           // e.g., $30,000/year
  yearsAfterRetirement: number;   // e.g., 5 years
}

// In simulation, add income for first N years:
for (let year = 0; year < yearsInRetirement; year++) {
  // ... portfolio return logic ...

  // Add part-time income if within working years
  if (partTimeWork.enabled && year < partTimeWork.yearsAfterRetirement) {
    portfolio += partTimeWork.annualIncome;
  }

  // ... withdrawal logic ...
}
```

---

## Life Expectancy: Adjustable Range

Allow testing multiple horizons to see sensitivity:

```
┌─────────────────────────────────────────────────────────────────────┐
│  HORIZON SENSITIVITY                                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Your Age: 62    Retirement Age: 62                                │
│                                                                     │
│  Life Expectancy    Years in Retirement    Max Withdrawal @ 70%    │
│  ─────────────────────────────────────────────────────────────     │
│       90                 28 years              $78,200/year        │
│       95                 33 years              $72,400/year  ←     │
│      100                 38 years              $67,100/year        │
│                                                                     │
│  [Set Horizon: 95] ────────────○──────────────── [90] [95] [100]   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Data Model Updates

### New Convex Tables

```typescript
// convex/schema.ts additions

goalSets: defineTable({
  name: v.string(),
  isCurrent: v.boolean(),

  // Timing
  retirementAge: v.number(),
  lifeExpectancyAge: v.number(),

  // Spending
  initialAnnualSpending: v.number(),
  spendingInflationRate: v.number(),
  essentialSpendingFloor: v.number(),

  // Guardrails
  guardrailsEnabled: v.boolean(),
  guardrailUpperThreshold: v.number(),
  guardrailLowerThreshold: v.number(),
  guardrailCeilingAdjustment: v.number(),
  guardrailFloorAdjustment: v.number(),

  // Social Security
  ssClaimingAge: v.number(),
  ssMonthlyBenefit: v.number(),
  ssColaRate: v.number(),

  // Part-time work
  partTimeEnabled: v.boolean(),
  partTimeAnnualIncome: v.number(),
  partTimeYears: v.number(),

  // Legacy
  legacyTarget: v.number(),

  // Return assumptions
  preRetirementReturn: v.number(),
  postRetirementReturn: v.number(),
  returnStdDev: v.number(),
  inflationRate: v.number(),

  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_current", ["isCurrent"]),

simulationResults: defineTable({
  goalSetId: v.id("goalSets"),

  // Results
  successRate: v.number(),
  maxWithdrawalAtTarget: v.number(),
  targetSuccessRate: v.number(),
  iterations: v.number(),

  // Spending stats
  avgSpending: v.number(),
  minSpending: v.number(),
  maxSpending: v.number(),

  // Ending balance percentiles
  endingBalanceP10: v.number(),
  endingBalanceP50: v.number(),
  endingBalanceP90: v.number(),

  // Guardrail triggers
  avgCeilingHits: v.number(),
  avgFloorHits: v.number(),

  // Curve data (for visualization)
  successCurve: v.array(v.object({
    withdrawal: v.number(),
    successRate: v.number(),
  })),

  calculatedAt: v.number(),
})
  .index("by_goalSet", ["goalSetId"]),
```

---

## UI Components

```
components/projections/
├── GoalSetManager.tsx           # List, create, compare goal sets
├── GoalSetForm.tsx              # Edit goal set parameters
├── GoalSetCard.tsx              # Summary card for a goal set
├── SuccessCurveChart.tsx        # The main success vs withdrawal chart
├── SuccessCurveComparison.tsx   # Overlay multiple goal sets
├── MaxWithdrawalSolver.tsx      # Calculate + display max withdrawal
├── HorizonSensitivity.tsx       # Test different life expectancies
├── GuardrailsConfig.tsx         # Configure ceiling/floor/adjustments
├── SpendingRangeDisplay.tsx     # Show min/max spending with guardrails
└── PartTimeWorkConfig.tsx       # Configure post-retirement income
```

---

## User Flow

```
1. User opens Projections page
   └── Sees current Goal Set with success rate

2. User clicks "Find Max Withdrawal"
   └── System runs solver (1000 iterations, ~3 seconds)
   └── Displays max withdrawal at 70% success
   └── Shows success curve visualization

3. User wants to test "What if I claim SS at 62?"
   └── Clicks "Create Test Goal"
   └── Adjusts SS claiming age to 62
   └── Runs simulation
   └── Sees side-by-side curve comparison

4. Test goal looks better
   └── User clicks "Promote to Current"
   └── Test goal becomes the new baseline

5. User adjusts life expectancy slider
   └── Sees how max withdrawal changes
   └── Decides on conservative horizon (95)
```

---

## Performance Considerations

- **1000 simulations**: ~2-3 seconds (balanced)
- **Binary search for max**: ~10-15 iterations = 10-15 simulations per iteration
- **Total solver time**: ~3-5 seconds
- **Curve generation**: Pre-compute points at $5K intervals

### Caching Strategy

- Cache simulation results per Goal Set
- Invalidate when Goal Set changes
- Store success curve data for instant re-display

---

## Open Questions

1. **Mortality tables**: Should we offer actuarial survival probabilities instead of fixed horizon?
2. **Tax-aware**: Should withdrawals account for tax brackets (Roth vs Traditional)?
3. **Sequence of returns risk**: Highlight early-retirement vulnerability?
4. **Healthcare**: Separate feature or integrate here?
