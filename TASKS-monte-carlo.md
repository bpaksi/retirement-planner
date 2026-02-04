# Monte Carlo + Guardrails: Implementation Tasks

## Phase 0: Data Foundation (Do First)

These must be solid before Monte Carlo makes sense.

### Task 0.1: Monthly Spending Aggregation
**Why**: Monte Carlo needs accurate spending baseline
**Effort**: Low

```typescript
// convex/analytics/spending.ts
export const getMonthlySpendingAverage = query({
  args: {
    monthsBack: v.optional(v.number()), // Default 12
  },
  handler: async (ctx, args) => {
    const months = args.monthsBack || 12;
    const startDate = /* 12 months ago */;

    const transactions = await ctx.db
      .query("transactions")
      .withIndex("by_date")
      .filter(q => q.gte(q.field("date"), startDate))
      .filter(q => q.lt(q.field("amount"), 0)) // Expenses only
      .collect();

    // Group by month, calculate average
    // Exclude transfers, one-time large purchases (optional)

    return {
      monthlyAverage: number,
      monthlyData: [{ month, total, essential, discretionary }],
      trend: "increasing" | "stable" | "decreasing"
    };
  }
});
```

**Acceptance Criteria**:
- [ ] Calculate average monthly spending from last 12 months
- [ ] Exclude transfers (category-based)
- [ ] Show month-by-month breakdown
- [ ] Identify spending trend

---

### Task 0.2: Essential vs Discretionary Spending Split
**Why**: Guardrails need to know your spending floor
**Effort**: Medium

**Option A: Category-based**
```typescript
// Mark categories as essential or discretionary
categories: defineTable({
  name: v.string(),
  isEssential: v.boolean(),  // Housing, utilities, groceries, healthcare = true
  // ...
})
```

**Option B: User-defined floor**
```typescript
// User inputs their minimum monthly spending
settings: defineTable({
  key: v.string(),
  value: v.any(),
})
// key: "essentialMonthlySpending", value: 3500
```

**Recommended**: Both - derive from categories, allow user override.

**Acceptance Criteria**:
- [ ] Each category tagged as essential/discretionary
- [ ] Auto-calculate essential spending from transactions
- [ ] User can override with manual floor
- [ ] Show split on spending dashboard

---

### Task 0.3: Social Security Input
**Why**: Major income source, affects withdrawal needs
**Effort**: Low

```typescript
// convex/schema.ts
socialSecurityEstimates: defineTable({
  monthlyBenefitAt62: v.number(),
  monthlyBenefitAt67: v.number(),  // FRA
  monthlyBenefitAt70: v.number(),
  birthDate: v.number(),           // To calculate current age
  colaAssumption: v.number(),      // e.g., 0.02 (2%)
})
```

**UI**: Simple form to input SSA.gov estimates at 62/67/70

**Acceptance Criteria**:
- [ ] Store SS benefit at 62, 67, 70
- [ ] Calculate benefit at any age (with early/late adjustment)
- [ ] Apply COLA assumption
- [ ] Show in retirement income summary

---

### Task 0.4: Return & Volatility Assumptions
**Why**: Monte Carlo needs these for simulations
**Effort**: Low

```typescript
// Default assumptions (user can override)
const DEFAULT_ASSUMPTIONS = {
  stockReturn: 0.07,        // 7% nominal
  bondReturn: 0.04,         // 4% nominal
  stockVolatility: 0.15,    // 15% std dev
  bondVolatility: 0.05,     // 5% std dev
  inflationRate: 0.03,      // 3%
  correlationStockBond: 0.2 // Low correlation
};

// Or simplified:
const SIMPLE_ASSUMPTIONS = {
  preRetirementReturn: 0.07,
  postRetirementReturn: 0.05,  // More conservative after retirement
  returnVolatility: 0.12,
  inflationRate: 0.03,
};
```

**UI**: Settings page with sliders/inputs, "Use defaults" button

**Acceptance Criteria**:
- [ ] Store return assumptions in settings
- [ ] Provide sensible defaults
- [ ] Show impact of different assumptions
- [ ] Validate reasonable ranges

---

## Phase 1: Core Engine

### Task 1.1: Goal Set Data Model
**Why**: Foundation for testing/comparing retirement plans
**Effort**: Medium

```typescript
// convex/schema.ts
goalSets: defineTable({
  name: v.string(),
  isCurrent: v.boolean(),

  // Timing
  retirementAge: v.number(),
  currentAge: v.number(),
  lifeExpectancyAge: v.number(),

  // Spending
  initialAnnualSpending: v.number(),
  essentialSpendingFloor: v.number(),

  // Guardrails
  guardrailsEnabled: v.boolean(),
  guardrailUpperThreshold: v.number(),   // e.g., 1.20
  guardrailLowerThreshold: v.number(),   // e.g., 0.80
  guardrailCeilingAdjustment: v.number(), // e.g., 0.10
  guardrailFloorAdjustment: v.number(),   // e.g., 0.10

  // Social Security
  ssClaimingAge: v.number(),

  // Part-time work
  partTimeEnabled: v.boolean(),
  partTimeAnnualIncome: v.optional(v.number()),
  partTimeYears: v.optional(v.number()),

  // Legacy
  legacyTarget: v.number(),

  // Cached results (updated when simulation runs)
  lastSuccessRate: v.optional(v.number()),
  lastMaxWithdrawal: v.optional(v.number()),
  lastSimulationDate: v.optional(v.number()),

  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_current", ["isCurrent"]),
```

**Mutations**:
- `createGoalSet`
- `updateGoalSet`
- `duplicateGoalSet` (for creating test variations)
- `promoteToCurrentGoalSet`
- `deleteGoalSet`

**Acceptance Criteria**:
- [ ] CRUD operations for Goal Sets
- [ ] Only one Goal Set can be "current"
- [ ] Duplicate Goal Set for testing
- [ ] Promote test to current

---

### Task 1.2: Monte Carlo Engine (Core)
**Why**: The simulation engine
**Effort**: High

```typescript
// convex/projections/monteCarlo.ts

interface SimulationConfig {
  startingPortfolio: number;
  annualSpending: number;
  essentialFloor: number;
  yearsInRetirement: number;
  expectedReturn: number;
  returnStdDev: number;
  inflationRate: number;
  socialSecurity: { startYear: number; annualAmount: number } | null;
  partTimeWork: { annualIncome: number; years: number } | null;
  guardrails: GuardrailsConfig | null;
}

interface SimulationResult {
  success: boolean;
  endingBalance: number;
  yearsLasted: number;
  minSpending: number;
  maxSpending: number;
  spendingHistory: number[];
  portfolioHistory: number[];
  guardrailTriggers: { ceilingHits: number; floorHits: number };
}

export const runSimulation = action({
  args: {
    goalSetId: v.id("goalSets"),
    iterations: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<AggregatedResults> => {
    const goalSet = await ctx.runQuery(/* get goal set */);
    const portfolio = await ctx.runQuery(/* get current portfolio value */);
    const ssEstimates = await ctx.runQuery(/* get SS estimates */);
    const assumptions = await ctx.runQuery(/* get return assumptions */);

    const iterations = args.iterations || 1000;
    const results: SimulationResult[] = [];

    for (let i = 0; i < iterations; i++) {
      results.push(runSingleSimulation(/* config from goalSet */));
    }

    return aggregateResults(results);
  }
});
```

**Acceptance Criteria**:
- [ ] Run N iterations with random returns
- [ ] Apply guardrails logic each year
- [ ] Track spending and portfolio history
- [ ] Calculate success rate
- [ ] Return percentile outcomes

---

### Task 1.3: Guardrails Logic
**Why**: Dynamic spending adjustment
**Effort**: Medium

```typescript
function applyGuardrails(
  currentPortfolio: number,
  targetPortfolio: number,
  baseSpending: number,
  essentialFloor: number,
  config: GuardrailsConfig
): { spending: number; trigger: 'ceiling' | 'floor' | 'none' } {

  const ratio = currentPortfolio / targetPortfolio;

  if (ratio >= config.upperThreshold) {
    // Portfolio doing great - increase spending
    return {
      spending: Math.min(
        baseSpending * (1 + config.ceilingAdjustment),
        baseSpending * 1.5 // Cap at 50% increase
      ),
      trigger: 'ceiling'
    };
  }

  if (ratio <= config.lowerThreshold) {
    // Portfolio struggling - decrease spending
    return {
      spending: Math.max(
        baseSpending * (1 - config.floorAdjustment),
        essentialFloor // Never go below essentials
      ),
      trigger: 'floor'
    };
  }

  return { spending: baseSpending, trigger: 'none' };
}
```

**Acceptance Criteria**:
- [ ] Increase spending when portfolio exceeds ceiling
- [ ] Decrease spending when portfolio hits floor
- [ ] Never go below essential spending floor
- [ ] Track trigger frequency

---

## Phase 2: Solver & Visualization

### Task 2.1: Max Withdrawal Solver
**Why**: Answer "What's the most I can withdraw?"
**Effort**: Medium

```typescript
export const findMaxWithdrawal = action({
  args: {
    goalSetId: v.id("goalSets"),
    targetSuccessRate: v.number(), // e.g., 0.70
  },
  handler: async (ctx, args) => {
    // Binary search for optimal withdrawal
    let low = /* essential floor */;
    let high = /* 2x current spending */;

    while (high - low > 500) { // $500 precision
      const mid = (low + high) / 2;
      const result = await runSimulationWithSpending(mid);

      if (result.successRate >= args.targetSuccessRate) {
        low = mid; // Can try higher
      } else {
        high = mid; // Need lower
      }
    }

    return {
      maxWithdrawal: low,
      actualSuccessRate: /* final rate */,
      withdrawalRate: low / portfolio,
    };
  }
});
```

**Acceptance Criteria**:
- [ ] Find max withdrawal at target success rate
- [ ] Return within 3-5 seconds
- [ ] Show withdrawal rate percentage
- [ ] Cache result on Goal Set

---

### Task 2.2: Success Curve Generator
**Why**: Visualize withdrawal vs success rate
**Effort**: Medium

```typescript
export const generateSuccessCurve = action({
  args: {
    goalSetId: v.id("goalSets"),
    withdrawalMin: v.number(),
    withdrawalMax: v.number(),
    steps: v.optional(v.number()), // Default 20
  },
  handler: async (ctx, args) => {
    const steps = args.steps || 20;
    const stepSize = (args.withdrawalMax - args.withdrawalMin) / steps;

    const curve: { withdrawal: number; successRate: number }[] = [];

    for (let i = 0; i <= steps; i++) {
      const withdrawal = args.withdrawalMin + (stepSize * i);
      const result = await runSimulationWithSpending(withdrawal, 500); // Fewer iterations for speed
      curve.push({ withdrawal, successRate: result.successRate });
    }

    return curve;
  }
});
```

**Acceptance Criteria**:
- [ ] Generate 20+ data points for curve
- [ ] Complete in <10 seconds
- [ ] Include inflection point detection
- [ ] Support comparison (multiple curves)

---

### Task 2.3: Success Curve Chart Component
**Why**: Main visualization
**Effort**: Medium

```tsx
// components/projections/SuccessCurveChart.tsx
interface SuccessCurveChartProps {
  curves: {
    name: string;
    color: string;
    data: { withdrawal: number; successRate: number }[];
  }[];
  targetSuccessRate: number;
  maxWithdrawal?: number;
}
```

Features:
- Line chart with withdrawal on X, success rate on Y
- Horizontal line at target success rate (70%)
- Vertical line at max withdrawal point
- Multiple curves for comparison
- Hover to see exact values
- Highlight "tipping point" zone

**Acceptance Criteria**:
- [ ] Clear, readable chart
- [ ] Target line at 70%
- [ ] Comparison mode (2+ curves)
- [ ] Tooltip with exact values
- [ ] Responsive sizing

---

### Task 2.4: Goal Set Manager UI
**Why**: Create, test, compare Goal Sets
**Effort**: Medium

```tsx
// components/projections/GoalSetManager.tsx
```

Features:
- List all Goal Sets (current marked with star)
- Card view with key metrics
- "Create Test" button
- "Compare" button (select 2)
- "Promote to Current" action
- Delete with confirmation

**Acceptance Criteria**:
- [ ] View all Goal Sets
- [ ] Create new Goal Set
- [ ] Duplicate existing (for testing)
- [ ] Side-by-side comparison
- [ ] Promote test to current

---

## Phase 3: Polish & Integration

### Task 3.1: Goal Set Form
**Why**: Edit all Goal Set parameters
**Effort**: Medium

Sections:
1. Basic Info (name, retirement age, life expectancy)
2. Spending (initial, essential floor)
3. Guardrails toggle & settings
4. Social Security (claiming age selector)
5. Part-time Work (toggle, income, years)
6. Legacy Target

### Task 3.2: Results Summary Card
**Why**: Show simulation results at a glance
**Effort**: Low

Display:
- Success rate (big number)
- Max withdrawal at target
- Spending range (with guardrails)
- Expected legacy
- "Run Simulation" button

### Task 3.3: Horizon Sensitivity
**Why**: Test different life expectancies
**Effort**: Low

- Slider: 90 / 95 / 100
- Shows max withdrawal at each
- Quick comparison without creating separate Goal Sets

---

## Dependency Graph

```
Phase 0 (Foundation)
├── 0.1 Monthly Spending ─────────────────────┐
├── 0.2 Essential/Discretionary Split ────────┤
├── 0.3 Social Security Input ────────────────┼──▶ Phase 1
└── 0.4 Return Assumptions ───────────────────┘

Phase 1 (Core Engine)
├── 1.1 Goal Set Model ───────────────────────┐
├── 1.2 Monte Carlo Engine ───────────────────┼──▶ Phase 2
└── 1.3 Guardrails Logic ─────────────────────┘

Phase 2 (Solver & Viz)
├── 2.1 Max Withdrawal Solver ────────────────┐
├── 2.2 Success Curve Generator ──────────────┼──▶ Phase 3
├── 2.3 Success Curve Chart ──────────────────┤
└── 2.4 Goal Set Manager UI ──────────────────┘

Phase 3 (Polish)
├── 3.1 Goal Set Form
├── 3.2 Results Summary Card
└── 3.3 Horizon Sensitivity
```

---

## Estimated Timeline

| Phase | Effort | Description |
|-------|--------|-------------|
| Phase 0 | 2-3 days | Data foundation |
| Phase 1 | 3-4 days | Core engine |
| Phase 2 | 3-4 days | Solver & visualization |
| Phase 3 | 2-3 days | Polish & integration |
| **Total** | **10-14 days** | Full feature |

---

## Quick Wins (Start Here)

If you want to see progress fast:

1. **Task 0.4**: Add return assumptions (30 min)
2. **Task 0.3**: Add Social Security input (1 hour)
3. **Task 1.1**: Create Goal Set schema (1 hour)
4. **Task 1.2**: Basic Monte Carlo (no guardrails) (2-3 hours)

This gives you a working simulation in ~half a day, then iterate.
