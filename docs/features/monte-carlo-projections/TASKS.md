# Monte Carlo + Guardrails: Revised Implementation Plan (v2)

## Changes from v1

| Issue | v1 Approach | v2 Fix |
|-------|-------------|--------|
| No validation | Trust the math | Compare against FIRECalc, add unit tests |
| Performance hand-waved | "Should be fast" | Prototype first, measure, decide architecture |
| Over-engineered Goal Sets | Full versioning system | Simple assumptions + what-if calculator |
| No failure visualization | Only show success % | Show what failure looks like |
| Edge cases ignored | Hope for the best | Explicit handling |
| No sensitivity analysis | Single result | Show which inputs matter most |
| Data quality assumed | Trust spending data | Validate before using |

---

## New Phase Structure

```
Phase 0: Validate Approach (1-2 days)        ← NEW
Phase 1: Data Foundation (2-3 days)
Phase 2: Core Engine (3-4 days)
Phase 3: Visualization & UX (3-4 days)
Phase 4: Polish (1-2 days)

Total: 10-15 days
```

---

## Phase 0: Validate Approach (Do First!)

> Don't build a Monte Carlo engine until you know it works.

### Task 0.1: Performance Prototype
**Why**: Confirm simulations are fast enough before building full feature
**Effort**: 2-4 hours

Create a standalone script (not in the app) to test:

```typescript
// scripts/perf-test.ts
function runSimulation(years: number): boolean {
  let portfolio = 1000000;
  const spending = 40000;

  for (let y = 0; y < years; y++) {
    const return_ = normalRandom(0.07, 0.15);
    portfolio = portfolio * (1 + return_) - spending;
    if (portfolio <= 0) return false;
  }
  return true;
}

// Test performance
console.time('1000 sims');
let successes = 0;
for (let i = 0; i < 1000; i++) {
  if (runSimulation(30)) successes++;
}
console.timeEnd('1000 sims');
console.log(`Success rate: ${successes / 10}%`);

// Test binary search (solver)
console.time('solver');
// ... binary search with 15 iterations × 1000 sims each
console.timeEnd('solver');
```

**Decision point**:
- If < 1 second for 1000 sims → Run in Convex action ✅
- If 1-5 seconds → Run in Convex action with loading state
- If > 5 seconds → Need Web Worker or reduce iterations

**Acceptance Criteria**:
- [ ] Measure time for 1000 simulations
- [ ] Measure time for binary search solver
- [ ] Document performance characteristics
- [ ] Decide: Convex action vs Web Worker

---

### Task 0.2: Validation Against Known Results
**Why**: Ensure your Monte Carlo produces correct results
**Effort**: 2-3 hours

Compare your engine against:
1. **The 4% Rule** (Bengen 1994): $1M portfolio, $40K/year, 30 years → ~95% historical success
2. **FIRECalc results**: Use their tool, compare to your output
3. **cFIREsim**: Another validation source

```typescript
// tests/monteCarlo.validation.test.ts

describe('Monte Carlo Validation', () => {
  it('matches 4% rule expectations', () => {
    const result = runSimulation({
      portfolio: 1_000_000,
      spending: 40_000,
      years: 30,
      return: 0.07,
      stdDev: 0.12,
      iterations: 10_000
    });

    // 4% rule historically succeeds ~95% of time
    // Monte Carlo with 7% return should be similar
    expect(result.successRate).toBeGreaterThan(0.90);
    expect(result.successRate).toBeLessThan(0.99);
  });

  it('fails appropriately at high withdrawal rates', () => {
    const result = runSimulation({
      portfolio: 1_000_000,
      spending: 80_000, // 8% withdrawal - should mostly fail
      years: 30,
      return: 0.07,
      stdDev: 0.12,
      iterations: 10_000
    });

    expect(result.successRate).toBeLessThan(0.50);
  });

  it('handles edge case: spending > portfolio return', () => {
    const result = runSimulation({
      portfolio: 100_000,
      spending: 50_000, // 50% withdrawal
      years: 30,
      return: 0.07,
      stdDev: 0.12,
      iterations: 1_000
    });

    expect(result.successRate).toBeLessThan(0.10);
    expect(result.averageYearsLasted).toBeLessThan(5);
  });
});
```

**Acceptance Criteria**:
- [ ] Results within 5% of FIRECalc for same inputs
- [ ] Edge cases handled correctly
- [ ] Unit tests pass

---

## Phase 1: Data Foundation

### Task 1.1: Monthly Spending Aggregation
**Why**: Need accurate baseline for simulations
**Effort**: Low-Medium

```typescript
// convex/analytics/spending.ts
export const getSpendingSummary = query({
  args: {
    monthsBack: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const months = args.monthsBack || 12;
    // ... get transactions, group by month

    return {
      monthlyAverage: number,
      monthlyMedian: number,        // More robust than average
      monthlyMin: number,
      monthlyMax: number,
      trend: 'increasing' | 'stable' | 'decreasing',
      dataQuality: {
        monthsWithData: number,
        missingMonths: string[],
        hasOutliers: boolean,       // Flag unusual months
        outlierMonths: string[],
      }
    };
  }
});
```

**Data Quality Checks** (NEW):
- Flag months with < 10 transactions (incomplete data)
- Flag months with spending > 2x average (outliers)
- Warn if < 6 months of data

**Acceptance Criteria**:
- [ ] Calculate monthly average and median
- [ ] Identify trend (increasing/stable/decreasing)
- [ ] Flag data quality issues
- [ ] Exclude transfers from spending

---

### Task 1.2: Essential Spending Floor
**Why**: Guardrails need to know minimum viable spending
**Effort**: Medium

**Simplified approach** (v2):
```typescript
// User inputs their floor directly
// Don't try to auto-calculate from categories initially

settings: {
  key: "essentialMonthlySpending",
  value: 3500  // User enters this
}
```

**UI**: Simple input with guidance
```
┌─────────────────────────────────────────────────────────────┐
│ What's the minimum you could live on per month?             │
│                                                             │
│ This is your "floor" - the absolute minimum if times get    │
│ tough. Include only: housing, utilities, food, healthcare,  │
│ insurance, transportation basics.                           │
│                                                             │
│ Your average spending: $5,200/month                         │
│                                                             │
│ Essential floor: $ [3,500________]                          │
│                                                             │
│ 💡 Most people's floor is 50-70% of normal spending        │
└─────────────────────────────────────────────────────────────┘
```

**Acceptance Criteria**:
- [ ] User can input essential spending floor
- [ ] Show comparison to average spending
- [ ] Validate: floor < average spending
- [ ] Persist in settings

---

### Task 1.3: Social Security Input
**Why**: Major income source affects withdrawal needs
**Effort**: Low

```typescript
// convex/schema.ts
socialSecurity: defineTable({
  benefitAt62: v.number(),
  benefitAt67: v.number(),
  benefitAt70: v.number(),
  birthYear: v.number(),
  birthMonth: v.number(),
})
```

**UI**: Simple form matching SSA.gov statement format

**Acceptance Criteria**:
- [ ] Store benefits at 62, 67, 70
- [ ] Calculate benefit at any claiming age
- [ ] Apply COLA assumption (default 2%)

---

### Task 1.4: Retirement Assumptions
**Why**: Core inputs for simulation
**Effort**: Low

```typescript
// convex/schema.ts
retirementAssumptions: defineTable({
  // Timing
  currentAge: v.number(),
  retirementAge: v.number(),
  planToAge: v.number(),           // Life expectancy assumption

  // Returns (use sensible defaults)
  expectedReturn: v.number(),       // Default: 0.06 (6%)
  returnVolatility: v.number(),     // Default: 0.12 (12%)
  inflationRate: v.number(),        // Default: 0.03 (3%)

  // Spending
  plannedAnnualSpending: v.number(),
  essentialSpendingFloor: v.number(),

  // Social Security
  ssClaimingAge: v.number(),

  // Part-time work (optional)
  partTimeIncome: v.optional(v.number()),
  partTimeYears: v.optional(v.number()),

  // Legacy goal (optional)
  legacyTarget: v.optional(v.number()),
})
```

**Defaults with explanations**:
```
Expected Return: 6%
  → Conservative blend of stocks/bonds, after inflation adjustment

Volatility: 12%
  → Historical stock market standard deviation

Inflation: 3%
  → Slightly above Fed target to be conservative

Plan to Age: 95
  → ~25% of 65-year-olds live past 90
```

**Acceptance Criteria**:
- [ ] Store all assumptions
- [ ] Provide sensible defaults
- [ ] Explain each assumption to user
- [ ] Validate reasonable ranges

---

## Phase 2: Core Engine

### Task 2.1: Monte Carlo Engine (Simplified)
**Why**: Core simulation logic
**Effort**: High

```typescript
// convex/projections/monteCarlo.ts

interface SimulationInput {
  startingPortfolio: number;
  annualSpending: number;
  years: number;
  expectedReturn: number;
  volatility: number;
  inflation: number;

  // Optional
  socialSecurity?: { startYear: number; annualAmount: number };
  partTimeWork?: { income: number; years: number };
  guardrails?: GuardrailsConfig;
  essentialFloor?: number;
}

interface YearResult {
  year: number;
  startBalance: number;
  return: number;
  spending: number;
  endBalance: number;
  ssIncome: number;
  workIncome: number;
  guardrailTriggered: 'ceiling' | 'floor' | null;
}

interface SimulationResult {
  success: boolean;
  endingBalance: number;
  yearsLasted: number;
  lowestBalance: number;
  lowestBalanceYear: number;
  yearByYear: YearResult[];
}

function runSingleSimulation(input: SimulationInput): SimulationResult {
  let balance = input.startingPortfolio;
  let spending = input.annualSpending;
  const yearResults: YearResult[] = [];
  let lowestBalance = balance;
  let lowestBalanceYear = 0;

  for (let year = 0; year < input.years; year++) {
    const startBalance = balance;

    // 1. Generate return
    const annualReturn = normalRandom(input.expectedReturn, input.volatility);
    balance *= (1 + annualReturn);

    // 2. Add income
    const ssIncome = (input.socialSecurity && year >= input.socialSecurity.startYear)
      ? input.socialSecurity.annualAmount
      : 0;
    const workIncome = (input.partTimeWork && year < input.partTimeWork.years)
      ? input.partTimeWork.income
      : 0;
    balance += ssIncome + workIncome;

    // 3. Apply guardrails (if enabled)
    let guardrailTriggered: 'ceiling' | 'floor' | null = null;
    if (input.guardrails) {
      const result = applyGuardrails(balance, spending, input);
      spending = result.adjustedSpending;
      guardrailTriggered = result.triggered;
    }

    // 4. Inflate spending for next year
    spending *= (1 + input.inflation);

    // 5. Withdraw
    balance -= spending;

    // Track lowest point
    if (balance < lowestBalance) {
      lowestBalance = balance;
      lowestBalanceYear = year;
    }

    yearResults.push({
      year,
      startBalance,
      return: annualReturn,
      spending,
      endBalance: balance,
      ssIncome,
      workIncome,
      guardrailTriggered,
    });

    // 6. Check failure
    if (balance <= 0) {
      return {
        success: false,
        endingBalance: 0,
        yearsLasted: year + 1,
        lowestBalance: 0,
        lowestBalanceYear: year,
        yearByYear: yearResults,
      };
    }
  }

  return {
    success: true,
    endingBalance: balance,
    yearsLasted: input.years,
    lowestBalance,
    lowestBalanceYear,
    yearByYear: yearResults,
  };
}
```

**Acceptance Criteria**:
- [ ] Run single simulation with all inputs
- [ ] Handle Social Security income
- [ ] Handle part-time work income
- [ ] Apply guardrails if enabled
- [ ] Track year-by-year results
- [ ] Identify lowest balance point

---

### Task 2.2: Guardrails Logic
**Why**: Dynamic spending adjustment
**Effort**: Medium

```typescript
interface GuardrailsConfig {
  enabled: boolean;
  upperThreshold: number;     // e.g., 1.25 (25% above target)
  lowerThreshold: number;     // e.g., 0.75 (25% below target)
  increasePercent: number;    // e.g., 0.10 (10% increase when ceiling hit)
  decreasePercent: number;    // e.g., 0.10 (10% decrease when floor hit)
}

function applyGuardrails(
  currentBalance: number,
  currentSpending: number,
  input: SimulationInput
): { adjustedSpending: number; triggered: 'ceiling' | 'floor' | null } {

  if (!input.guardrails?.enabled) {
    return { adjustedSpending: currentSpending, triggered: null };
  }

  // Calculate target balance (what we expect if on track)
  // Simplified: use initial portfolio as reference
  const targetBalance = input.startingPortfolio; // Could be more sophisticated

  const ratio = currentBalance / targetBalance;
  const config = input.guardrails;

  if (ratio >= config.upperThreshold) {
    // Doing well - can spend more
    const increased = currentSpending * (1 + config.increasePercent);
    return { adjustedSpending: increased, triggered: 'ceiling' };
  }

  if (ratio <= config.lowerThreshold) {
    // Struggling - must spend less
    const decreased = currentSpending * (1 - config.decreasePercent);
    const floor = input.essentialFloor || decreased;
    return {
      adjustedSpending: Math.max(decreased, floor),
      triggered: 'floor'
    };
  }

  return { adjustedSpending: currentSpending, triggered: null };
}
```

**Acceptance Criteria**:
- [ ] Increase spending when above ceiling
- [ ] Decrease spending when below floor
- [ ] Never go below essential spending
- [ ] Track trigger frequency

---

### Task 2.3: Aggregated Results
**Why**: Compile results from many simulations
**Effort**: Medium

```typescript
export const runMonteCarloSimulation = action({
  args: {
    iterations: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Get inputs from database
    const assumptions = await ctx.runQuery(/* get assumptions */);
    const portfolio = await ctx.runQuery(/* get current portfolio value */);
    const ss = await ctx.runQuery(/* get SS estimates */);

    const iterations = args.iterations || 1000;
    const results: SimulationResult[] = [];

    for (let i = 0; i < iterations; i++) {
      results.push(runSingleSimulation({
        startingPortfolio: portfolio,
        annualSpending: assumptions.plannedAnnualSpending,
        years: assumptions.planToAge - assumptions.retirementAge,
        expectedReturn: assumptions.expectedReturn,
        volatility: assumptions.returnVolatility,
        inflation: assumptions.inflationRate,
        socialSecurity: ss ? {
          startYear: assumptions.ssClaimingAge - assumptions.retirementAge,
          annualAmount: ss.benefitAt67 * 12, // TODO: adjust for claiming age
        } : undefined,
        guardrails: assumptions.guardrailsEnabled ? {
          enabled: true,
          upperThreshold: 1.25,
          lowerThreshold: 0.75,
          increasePercent: 0.10,
          decreasePercent: 0.10,
        } : undefined,
        essentialFloor: assumptions.essentialSpendingFloor,
      }));
    }

    return aggregateResults(results, iterations);
  }
});

function aggregateResults(results: SimulationResult[], iterations: number) {
  const successes = results.filter(r => r.success);
  const failures = results.filter(r => !r.success);

  return {
    // Core metrics
    successRate: successes.length / iterations,
    iterations,

    // Success scenarios
    success: {
      count: successes.length,
      medianEndingBalance: median(successes.map(r => r.endingBalance)),
      p10EndingBalance: percentile(successes.map(r => r.endingBalance), 10),
      p90EndingBalance: percentile(successes.map(r => r.endingBalance), 90),
    },

    // Failure scenarios (NEW - important!)
    failure: {
      count: failures.length,
      averageYearsLasted: average(failures.map(r => r.yearsLasted)),
      medianYearsLasted: median(failures.map(r => r.yearsLasted)),
      worstCase: Math.min(...failures.map(r => r.yearsLasted)),
    },

    // Risk metrics (NEW)
    risk: {
      averageLowestBalance: average(results.map(r => r.lowestBalance)),
      percentHittingFloor: results.filter(r =>
        r.yearByYear.some(y => y.guardrailTriggered === 'floor')
      ).length / iterations,
    },

    // Sample paths for visualization (10 random)
    samplePaths: results.slice(0, 10).map(r => r.yearByYear),
  };
}
```

**Acceptance Criteria**:
- [ ] Calculate success rate
- [ ] Provide percentile outcomes
- [ ] **Show failure details (years lasted, worst case)**
- [ ] Track risk metrics
- [ ] Return sample paths for charts

---

### Task 2.4: Max Withdrawal Solver
**Why**: Answer "What's the most I can withdraw?"
**Effort**: Medium

```typescript
export const findMaxWithdrawal = action({
  args: {
    targetSuccessRate: v.number(), // e.g., 0.70
    precision: v.optional(v.number()), // Default $500
  },
  handler: async (ctx, args) => {
    const assumptions = await ctx.runQuery(/* ... */);
    const portfolio = await ctx.runQuery(/* ... */);

    // Binary search bounds
    let low = assumptions.essentialSpendingFloor || 20000;
    let high = portfolio * 0.10; // 10% withdrawal as upper bound
    const precision = args.precision || 500;

    let bestWithdrawal = low;
    let bestSuccessRate = 1.0;

    while (high - low > precision) {
      const mid = Math.round((low + high) / 2);

      // Run simulation with this withdrawal
      const result = await runSimulationWithSpending(ctx, mid, 500); // Fewer iterations for speed

      if (result.successRate >= args.targetSuccessRate) {
        bestWithdrawal = mid;
        bestSuccessRate = result.successRate;
        low = mid;
      } else {
        high = mid;
      }
    }

    // Final verification with more iterations
    const finalResult = await runSimulationWithSpending(ctx, bestWithdrawal, 1000);

    return {
      maxWithdrawal: bestWithdrawal,
      monthlyAmount: Math.round(bestWithdrawal / 12),
      withdrawalRate: bestWithdrawal / portfolio,
      successRate: finalResult.successRate,
      targetSuccessRate: args.targetSuccessRate,
    };
  }
});
```

**Acceptance Criteria**:
- [ ] Find max withdrawal at target success rate
- [ ] Complete in < 10 seconds
- [ ] Return withdrawal rate percentage
- [ ] Handle edge cases (no valid withdrawal)

---

## Phase 3: Visualization & UX

### Task 3.1: What-If Calculator (Simplified from Goal Sets)
**Why**: Test different scenarios without full versioning
**Effort**: Medium

Instead of Goal Set versioning, create a simple what-if calculator:

```tsx
// components/projections/WhatIfCalculator.tsx
interface WhatIfState {
  spending: number;
  retirementAge: number;
  ssClaimingAge: number;
  planToAge: number;
  guardrailsEnabled: boolean;
}

function WhatIfCalculator() {
  // Load saved assumptions as defaults
  const savedAssumptions = useQuery(api.assumptions.get);

  // Local state for what-if adjustments
  const [whatIf, setWhatIf] = useState<WhatIfState | null>(null);

  // Results for saved vs what-if
  const savedResults = useQuery(api.projections.getResults);
  const whatIfResults = useAction(api.projections.runWhatIf, whatIf);

  return (
    <div className="grid grid-cols-2 gap-8">
      {/* Left: Current Plan */}
      <Card>
        <h2>Current Plan</h2>
        <ResultsSummary results={savedResults} />
      </Card>

      {/* Right: What-If */}
      <Card>
        <h2>What If...</h2>
        <WhatIfInputs value={whatIf} onChange={setWhatIf} />
        {whatIfResults && <ResultsSummary results={whatIfResults} />}
        {whatIfBetter && <Button>Save as Current Plan</Button>}
      </Card>
    </div>
  );
}
```

**Acceptance Criteria**:
- [ ] Side-by-side current vs what-if
- [ ] Real-time recalculation on input change
- [ ] "Save as Current" if user likes the result
- [ ] No complex versioning needed

---

### Task 3.2: Success Curve Chart
**Why**: Main visualization
**Effort**: Medium

```tsx
// components/projections/SuccessCurveChart.tsx
interface SuccessCurveProps {
  data: { withdrawal: number; successRate: number }[];
  targetRate: number;
  maxWithdrawal: number;
  comparisonData?: { withdrawal: number; successRate: number }[]; // For what-if
}

function SuccessCurveChart({ data, targetRate, maxWithdrawal, comparisonData }: SuccessCurveProps) {
  return (
    <ResponsiveContainer>
      <LineChart>
        {/* Main curve */}
        <Line data={data} dataKey="successRate" stroke="#10b981" />

        {/* Comparison curve (what-if) */}
        {comparisonData && (
          <Line data={comparisonData} dataKey="successRate" stroke="#6366f1" strokeDasharray="5 5" />
        )}

        {/* Target line */}
        <ReferenceLine y={targetRate} stroke="#f59e0b" strokeDasharray="3 3" />

        {/* Max withdrawal point */}
        <ReferenceDot x={maxWithdrawal} y={targetRate} r={8} fill="#10b981" />

        <XAxis dataKey="withdrawal" tickFormatter={formatCurrency} />
        <YAxis tickFormatter={formatPercent} domain={[0, 1]} />
        <Tooltip />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

**Acceptance Criteria**:
- [ ] Clear curve showing withdrawal vs success
- [ ] Horizontal line at target (70%)
- [ ] Dot marking max withdrawal
- [ ] Support comparison overlay
- [ ] Tooltips with exact values

---

### Task 3.3: Failure Visualization (NEW - Critical)
**Why**: User needs to understand the 30% failure scenario
**Effort**: Medium

```tsx
// components/projections/FailureAnalysis.tsx
function FailureAnalysis({ results }: { results: SimulationResults }) {
  const { failure } = results;

  if (failure.count === 0) {
    return <div>No failures in simulation! 🎉</div>;
  }

  return (
    <Card className="border-red-500/50">
      <h3>Understanding the {Math.round((1 - results.successRate) * 100)}% Failure Scenarios</h3>

      <div className="grid grid-cols-3 gap-4">
        <Stat
          label="If it fails, money lasts..."
          value={`${failure.medianYearsLasted} years`}
          subtext={`(Age ${retirementAge + failure.medianYearsLasted})`}
        />
        <Stat
          label="Worst case"
          value={`${failure.worstCase} years`}
          subtext="Earliest you could run out"
        />
        <Stat
          label="Failure scenarios"
          value={`${failure.count} of ${results.iterations}`}
        />
      </div>

      <div className="mt-4">
        <h4>What does failure look like?</h4>
        <ul className="text-sm text-gray-400">
          <li>• You'd need to cut spending significantly</li>
          <li>• Or return to part-time work</li>
          <li>• Or rely on family/government assistance</li>
        </ul>
      </div>

      <div className="mt-4">
        <h4>How to improve your odds:</h4>
        <ul className="text-sm">
          <li>• Reduce spending by $X → Success rate becomes Y%</li>
          <li>• Work 2 more years → Success rate becomes Z%</li>
          <li>• Enable guardrails → Success rate becomes W%</li>
        </ul>
      </div>
    </Card>
  );
}
```

**Acceptance Criteria**:
- [ ] Show years money lasts in failure cases
- [ ] Explain what failure means practically
- [ ] Suggest ways to improve odds
- [ ] Don't hide the downside

---

### Task 3.4: Sensitivity Analysis (NEW)
**Why**: Show which inputs matter most
**Effort**: Medium

```typescript
// convex/projections/sensitivity.ts
export const runSensitivityAnalysis = action({
  handler: async (ctx) => {
    const baseResult = await runSimulation(/* base case */);

    // Test each variable ±20%
    const variables = [
      { name: 'spending', low: 0.8, high: 1.2 },
      { name: 'expectedReturn', low: 0.8, high: 1.2 },
      { name: 'inflation', low: 0.8, high: 1.2 },
      { name: 'planToAge', low: -5, high: +5 }, // Years, not percent
    ];

    const sensitivity = [];

    for (const v of variables) {
      const lowResult = await runSimulation(/* with v.low */);
      const highResult = await runSimulation(/* with v.high */);

      sensitivity.push({
        variable: v.name,
        impact: Math.abs(highResult.successRate - lowResult.successRate),
        lowValue: lowResult.successRate,
        highValue: highResult.successRate,
      });
    }

    // Sort by impact
    return sensitivity.sort((a, b) => b.impact - a.impact);
  }
});
```

**Display**:
```
┌─────────────────────────────────────────────────────────────┐
│ What Matters Most                                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Annual Spending       ████████████████████  High Impact     │
│ -20% → 89% success    +20% → 52% success                   │
│                                                             │
│ Life Expectancy       ████████████         Medium Impact    │
│ Age 90 → 82% success  Age 100 → 61% success               │
│                                                             │
│ Expected Return       ████████             Medium Impact    │
│ 5% → 64% success      7% → 78% success                    │
│                                                             │
│ Inflation Rate        ████                 Low Impact       │
│ 2% → 74% success      4% → 68% success                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Acceptance Criteria**:
- [ ] Test each major variable
- [ ] Rank by impact on success rate
- [ ] Show specific numbers for each scenario
- [ ] Help user focus on what to control

---

## Phase 4: Polish

### Task 4.1: Data Quality Warnings
**Why**: Don't simulate with bad data
**Effort**: Low

```tsx
function DataQualityCheck() {
  const spending = useQuery(api.analytics.getSpendingSummary);

  const warnings = [];

  if (spending.dataQuality.monthsWithData < 6) {
    warnings.push({
      severity: 'error',
      message: `Only ${spending.dataQuality.monthsWithData} months of spending data. Need at least 6 for reliable projections.`
    });
  }

  if (spending.dataQuality.hasOutliers) {
    warnings.push({
      severity: 'warning',
      message: `Unusual spending in ${spending.dataQuality.outlierMonths.join(', ')}. This may skew projections.`
    });
  }

  if (!assumptions.essentialSpendingFloor) {
    warnings.push({
      severity: 'warning',
      message: 'No essential spending floor set. Guardrails won\'t work properly.'
    });
  }

  return warnings.length > 0 ? <WarningBanner warnings={warnings} /> : null;
}
```

### Task 4.2: Results Caching
**Why**: Don't re-run expensive simulations unnecessarily
**Effort**: Low

```typescript
// Cache results with input hash
simulationCache: defineTable({
  inputHash: v.string(),  // Hash of all inputs
  results: v.any(),
  calculatedAt: v.number(),
})
  .index("by_hash", ["inputHash"])
```

### Task 4.3: Loading States
**Why**: Simulations take time
**Effort**: Low

- Show progress during simulation
- Skeleton loaders for charts
- "Calculating..." states

---

## Summary: Revised Task List

| Phase | Task | Effort | Priority |
|-------|------|--------|----------|
| **0** | Performance prototype | 2-4 hrs | **P0** |
| **0** | Validation tests | 2-3 hrs | **P0** |
| **1** | Monthly spending aggregation | 3-4 hrs | P1 |
| **1** | Essential spending floor | 2-3 hrs | P1 |
| **1** | Social Security input | 2 hrs | P1 |
| **1** | Retirement assumptions | 2 hrs | P1 |
| **2** | Monte Carlo engine | 4-6 hrs | P1 |
| **2** | Guardrails logic | 2-3 hrs | P1 |
| **2** | Aggregated results | 2-3 hrs | P1 |
| **2** | Max withdrawal solver | 3-4 hrs | P1 |
| **3** | What-if calculator | 4-5 hrs | P2 |
| **3** | Success curve chart | 3-4 hrs | P2 |
| **3** | Failure visualization | 3-4 hrs | P2 |
| **3** | Sensitivity analysis | 3-4 hrs | P2 |
| **4** | Data quality warnings | 2 hrs | P3 |
| **4** | Results caching | 2 hrs | P3 |
| **4** | Loading states | 1 hr | P3 |

**Total: ~45-55 hours (10-14 days)**

---

## Key Improvements from v1

1. ✅ **Validate before building** - Phase 0 ensures correctness
2. ✅ **Show failure scenarios** - User sees the downside
3. ✅ **Simplified Goal Sets** - What-if calculator instead of versioning
4. ✅ **Sensitivity analysis** - User knows what matters
5. ✅ **Data quality checks** - Don't simulate with garbage
6. ✅ **Performance first** - Prototype before committing to architecture
