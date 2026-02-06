# Projections v2: Understanding Monte Carlo + Guardrails

> A discussion document capturing the mental model for retirement projections.

---

## Prerequisites: Spending Baseline Is The Foundation

**Monte Carlo doesn't answer the most important question.**

```
THE RETIREMENT QUESTION ISN'T:  "Will my money last?"
THE RETIREMENT QUESTION IS:     "What do I actually need?"
```

**The hierarchy:**

| Layer | Question | Feature |
|-------|----------|---------|
| 1. Foundation | "What do I spend?" | [Spending Baseline](../spending-baseline/) |
| 2. Flexibility | "What's essential vs cuttable?" | Essential/Discretionary split |
| 3. Validation | "Will my portfolio support this?" | Monte Carlo (this doc) |
| 4. Optimization | "What's the max I can withdraw?" | Solver |

**Before running projections, you need:**
- A spending baseline (from transaction analysis)
- Essential floor (non-discretionary minimum)
- Discretionary buffer (what you COULD cut)

Without this foundation, Monte Carlo is just math on made-up numbers.

---

## Part 1: Core Monte Carlo Understanding

### What Monte Carlo Does

Monte Carlo simulation answers: **"If I retire with $X and spend $Y/year, what's the probability my money lasts?"**

It works by:
1. **Simulating many possible futures** (1,000+ runs)
2. **Each run uses random market returns** (not the same sequence)
3. **Counting how many runs succeed** (money lasts to life expectancy)

```
Run 1:   Good returns early  → Portfolio grows → SUCCESS (ends with $800K)
Run 2:   Bad returns early   → Portfolio depletes → FAILURE (runs out year 22)
Run 3:   Average returns     → Portfolio survives → SUCCESS (ends with $200K)
...
Run 1000: Mixed returns      → Portfolio survives → SUCCESS (ends with $450K)

Result: 720 successes / 1000 runs = 72% success rate
```

### How "Random" Returns Are Generated

Returns follow a **normal distribution** (bell curve):

- **Mean (expected return)**: e.g., 7% annually
- **Standard deviation (volatility)**: e.g., 15%

This produces:
- Most years: returns between -8% and +22% (within 1 std dev)
- Some years: returns between -23% and +37% (within 2 std dev)
- Rare years: extreme crashes or booms (beyond 2 std dev)

**Why not replay history?**
- Only ~100 years of market data
- Monte Carlo generates thousands of *plausible* scenarios
- Including scenarios worse than any historical period

### The Basic Simulation Loop

```
FOR each year (1 to retirement_length):
    1. Generate random return (normal distribution around 7%, std dev 15%)
    2. portfolio = portfolio × (1 + return)
    3. portfolio = portfolio - annual_spending
    4. IF portfolio ≤ 0:
         STOP, mark as FAILURE, record years_lasted
END FOR

IF reached final year with portfolio > 0:
    Mark as SUCCESS, record ending_balance
```

### When Portfolio Hits Zero

- **Simulation stops** (can't recover from $0)
- Mark as **FAILURE**
- Record **how many years it lasted** (important for understanding risk)

---

## Part 2: Guardrails - Dynamic Spending

### What Guardrails Add

Basic Monte Carlo uses **fixed spending** (adjusted only for inflation).

Guardrails add **dynamic spending** that responds to portfolio performance:
- Portfolio doing well → Can spend more
- Portfolio struggling → Must spend less

### The Baseline: Expected Portfolio Path

**Key insight**: We compare the portfolio to where it *should* be, not where it started.

**Baseline calculation**:
```
Year 0: $1,500,000 (starting)
Year 1: $1,500,000 × 1.07 - $60,000 = $1,545,000
Year 2: $1,545,000 × 1.07 - $60,000 = $1,593,150
...
Year N: Previous × (1 + expected_return) - planned_spending
```

This creates an **expected path** assuming returns match expectations.

**Why not compare to starting balance?**
- A declining portfolio might be *on track* (withdrawals are planned)
- Comparing to $1.5M starting would trigger false alarms
- Expected path accounts for planned drawdown

### The Recovery-First Guardrails Model

```
┌─────────────────────────────────────────────────────────────────────┐
│                    SPENDING DECISION EACH YEAR                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Calculate: ratio = current_portfolio / expected_baseline           │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ IF ratio < FLOOR (e.g., 0.80):                              │   │
│  │     → CUT spending proportionally                           │   │
│  │     → But NEVER below essential minimum                     │   │
│  │     → Enter RECOVERY MODE                                   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ IF ratio is between FLOOR and CEILING:                      │   │
│  │     → MAINTAIN baseline spending                            │   │
│  │     → If in RECOVERY MODE, stay in it                       │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ IF ratio > CEILING (e.g., 1.20):                            │   │
│  │     → Check: Are we in RECOVERY MODE?                       │   │
│  │       → YES: BANK the excess (don't increase spending)      │   │
│  │       → NO:  Can INCREASE spending (with cap)               │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  RECOVERY MODE exits when: portfolio ≥ expected_baseline           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Proportional Spending Cuts

When portfolio is below floor, cut **proportionally to the shortfall**:

```typescript
const ratio = currentPortfolio / expectedBaseline;
const floor = 0.80; // 80% of expected

if (ratio < floor) {
  const shortfall = floor - ratio; // e.g., 0.80 - 0.65 = 0.15 (15% below floor)
  const cutPercent = shortfall * 1.5; // e.g., 15% × 1.5 = 22.5% cut

  const newSpending = Math.max(
    currentSpending * (1 - cutPercent),
    essentialMinimum // Never go below essentials
  );
}
```

**Why proportional?**
- Small shortfall → small cut (less disruptive)
- Large shortfall → larger cut (more urgent)
- Better than fixed cuts that might be too aggressive or too timid

### The Essential Minimum Floor

**Absolute minimum** that spending cannot drop below:
- Housing (mortgage/rent, utilities)
- Food (basic groceries)
- Healthcare (insurance, medications)
- Transportation (basic needs)
- Insurance (essential policies)

Typically **50-70% of normal spending**.

Even if math says "cut 50%", you can't go below essentials.

### Spending Increases: Recovery-First Logic

**Key insight**: After lean years, don't immediately increase spending when things improve.

**The sequence**:
1. Good year after lean period → **BANK IT** (rebuild cushion)
2. Portfolio climbs back toward baseline → **STAY CONSERVATIVE**
3. Portfolio exceeds baseline → **EXIT RECOVERY MODE**
4. Portfolio well above baseline → **CAN INCREASE** (with cap)

**Why?**
- One good year doesn't erase years of underperformance
- Need a buffer before lifestyle increases
- Prevents whipsaw (cut → increase → cut → increase)

---

## Part 3: Putting It Together

### The Full Algorithm

```typescript
function simulateWithGuardrails(config: SimConfig): SimResult {
  let portfolio = config.startingPortfolio;
  let spending = config.baselineSpending;
  let inRecoveryMode = false;

  const expectedPath = calculateExpectedPath(config);
  const history: YearRecord[] = [];

  for (let year = 0; year < config.years; year++) {
    // 1. Generate random return
    const return_ = normalRandom(config.expectedReturn, config.volatility);

    // 2. Apply return
    portfolio *= (1 + return_);

    // 3. Add any income (Social Security, part-time work)
    portfolio += getIncome(year, config);

    // 4. Calculate ratio vs expected
    const expected = expectedPath[year];
    const ratio = portfolio / expected;

    // 5. Apply guardrails
    let guardrailAction: 'cut' | 'maintain' | 'bank' | 'increase' = 'maintain';

    if (ratio < config.floor) {
      // Below floor: cut proportionally
      const shortfall = config.floor - ratio;
      const cutPercent = shortfall * config.cutMultiplier;
      spending = Math.max(
        spending * (1 - cutPercent),
        config.essentialMinimum
      );
      inRecoveryMode = true;
      guardrailAction = 'cut';

    } else if (ratio > config.ceiling) {
      if (inRecoveryMode) {
        // In recovery: bank the excess, don't increase spending
        guardrailAction = 'bank';
        // Check if we've recovered
        if (portfolio >= expected) {
          inRecoveryMode = false;
        }
      } else {
        // Not in recovery: can increase spending (capped)
        const excess = ratio - config.ceiling;
        const increasePercent = Math.min(excess * config.increaseMultiplier, config.maxIncrease);
        spending = spending * (1 + increasePercent);
        guardrailAction = 'increase';
      }
    }

    // 6. Inflate baseline spending for next year
    spending *= (1 + config.inflation);

    // 7. Withdraw
    portfolio -= spending;

    // 8. Record history
    history.push({ year, portfolio, spending, return_, ratio, guardrailAction });

    // 9. Check for failure
    if (portfolio <= 0) {
      return { success: false, yearsLasted: year + 1, history };
    }
  }

  return { success: true, endingBalance: portfolio, history };
}
```

### What This Model Captures

| Scenario | Without Guardrails | With Your Guardrails |
|----------|-------------------|----------------------|
| Bad early years | Fixed spending depletes portfolio | Cuts spending, preserves capital |
| Recovery after bad years | N/A | Banks gains, rebuilds before increasing |
| Sustained good returns | Fixed spending, dies wealthy | Increases spending to enjoy life |
| Prolonged downturn | Runs out of money | Cuts to essentials, survives longer |

---

## Part 4: Open Questions

1. **How quickly should spending recover after cuts?**
   - Immediately when back to baseline?
   - Gradually over 2-3 years?

2. **Should there be a "buffer" before exiting recovery?**
   - Exit at 100% of baseline?
   - Exit at 105% or 110%?

3. **How to handle sequence of returns risk?**
   - Bad returns in years 1-5 are worse than bad returns in years 25-30
   - Should guardrails be more aggressive early in retirement?

4. **What about inflation variability?**
   - Current model uses fixed inflation (3%)
   - Real inflation varies (2022 was 8%+)
   - **Decision**: Nice to have, not MVP. Start with fixed 3%.
   - Future enhancement: Variable inflation with normal distribution (mean 3%, std dev 1.5%)
   - Advanced option: Model inflation "regimes" (periods of low/normal/high inflation)

---

## Part 5: Inflation Variability (Future Enhancement)

### Current Approach: Fixed Inflation
```typescript
spending = baseSpending * Math.pow(1.03, year); // 3% every year
```

### Future Enhancement: Variable Inflation
```typescript
const inflationMean = 0.03;      // 3% average
const inflationStdDev = 0.015;   // 1.5% standard deviation

// Each year, random inflation
const inflation = normalRandom(inflationMean, inflationStdDev);
spending = spending * (1 + inflation);
```

### Why It Matters
- High inflation early in retirement compounds
- If years 1-5 have 6% inflation instead of 3%, year-30 spending is **15% higher** than planned
- 2022 showed inflation can spike unexpectedly (8%+)

### Decision
**MVP**: Fixed 3% inflation (simpler, focuses on market risk)
**Phase 2**: Add variable inflation option

---

## Part 6: Dynamic Spending Model

### Spending = Non-Discretionary + Discretionary

Total spending is one value composed of two parts:

```
TOTAL MONTHLY SPENDING = $6,000

┌─────────────────────────────────────────────────────────────┐
│  DISCRETIONARY (buffer that can be cut)         $2,000     │
│  Travel, dining out, entertainment, upgrades               │
│                                                            │
│  ═══════════════ GUARDRAIL FLOOR ══════════════════════   │
│                                                            │
│  NON-DISCRETIONARY (essential - CANNOT cut)     $4,000     │
│  Housing, utilities, food, healthcare, insurance           │
└─────────────────────────────────────────────────────────────┘
```

### Liabilities Affect the Base Over Time

The app auto-calculates how liabilities reduce base spending:

```
Year 1-8:  Mortgage $2,000/mo → Base = $6,000/mo
Year 9+:   Mortgage $0/mo     → Base = $4,000/mo (paid off!)
```

### Goals Add to Spending in Specific Years

Goals are time-sensitive additions to the base spending:

**Goal Types:**
1. **One-time**: Roof repair in Year 5 = $20K
2. **Recurring**: Annual travel = $5K every year
3. **Recurring for N years**: Help kids = $10K/yr for years 1-10

**In the simulation:**
```
Year 5 Total Spending = Base ($60K) + Roof Goal ($20K) = $80,000
```

### Success Categories (Refined)

| Outcome | Definition | Meaning |
|---------|------------|---------|
| **Full Success** | Never dipped below planned spending | Lived desired lifestyle |
| **Soft Success** | Cut into discretionary, but never essentials | Survived with compromises |
| **Hard Failure** | Couldn't afford non-discretionary | Ran out of money |

### Simulation Output

```
SIMULATION RESULTS (1000 runs)

Full Success:    620 / 1000 (62%)
→ Never had to cut spending

Soft Success:    230 / 1000 (23%)
→ Had to cut discretionary in some years
→ Average years with cuts: 4.2
→ Average cut depth: 18% of discretionary

Hard Failure:    150 / 1000 (15%)
→ Ran out of money
→ Average years lasted: 22

TOTAL SUCCESS (Full + Soft): 85%
```

---

## Summary: Your Complete Mental Model

```
PROJECTIONS V2: MONTE CARLO + RECOVERY-FIRST GUARDRAILS
═══════════════════════════════════════════════════════════

SPENDING MODEL:
• Total Spending = Non-Discretionary + Discretionary
• Liabilities auto-reduce base over time (mortgage payoff, etc.)
• Goals add to specific years (one-time, recurring, or N-year)
• Guardrail floor = Non-discretionary (essentials)

SIMULATION:
1. Run 1000 simulations, each with random returns

2. Each year in each simulation:
   a. Apply random return to portfolio
   b. Add income (Social Security, part-time work)
   c. Calculate spending for this year (base + goals)
   d. Compare portfolio to expected baseline
   e. Apply guardrails:
      - Below 80%: Cut discretionary first, then base (min = essentials)
      - 80-120%: Maintain spending, stay in recovery if applicable
      - Above 120%:
        - If recovering: Bank excess
        - If healthy: Increase spending (capped)
   f. Subtract spending from portfolio
   g. If portfolio < essentials needed: HARD FAILURE

3. Categorize outcomes:
   - Full Success: Never cut spending
   - Soft Success: Cut discretionary but survived
   - Hard Failure: Couldn't afford essentials

4. Report:
   - Full success rate
   - Soft success rate
   - Combined success rate
   - Failure analysis (years lasted)
   - Spending variability
   - Years in recovery mode
```

---

## Part 7: Max Withdrawal Solver

### The Core Question

The simulation tells us success rates for a **given withdrawal**. But what we really want to know is:

> "What's the MAXIMUM I can withdraw and still hit my success target?"

### Success Targets

Three different questions a user might ask:

| Target | Question | Use Case |
|--------|----------|----------|
| **100% Full Success** | Max withdrawal where I never cut spending? | Conservative, lifestyle-preserving |
| **100% Combined Success** | Max withdrawal where I never run out? | Flexible, willing to cut discretionary |
| **Custom % (e.g., 85%)** | Max withdrawal at 85% success rate? | Risk-tolerant, willing to accept some failure |

### The Locked-Scenario Algorithm

**Key insight**: Generate scenarios ONCE, then test withdrawals against the SAME market futures.

```typescript
// A single scenario = one possible future (30 years of returns + inflation)
type Scenario = {
  years: Array<{
    return: number;      // e.g., 0.07 for 7% return
    inflation: number;   // e.g., 0.03 for 3% inflation
  }>;
};

function solveMaxWithdrawal(config: SimConfig): SolverResults {

  // ═══════════════════════════════════════════════════════════
  // STEP 1: Generate scenarios ONCE
  // ═══════════════════════════════════════════════════════════
  const scenarios: Scenario[] = [];
  for (let i = 0; i < 1000; i++) {
    scenarios.push(generateScenario(config.timeHorizon, config.assumptions));
  }
  // Now we have 1000 possible futures, LOCKED IN

  // ═══════════════════════════════════════════════════════════
  // STEP 2: Test withdrawals against SAME scenarios
  // ═══════════════════════════════════════════════════════════
  function testWithdrawal(withdrawal: number): SimResults {
    let fullSuccess = 0;
    let softSuccess = 0;
    let hardFailure = 0;

    for (const scenario of scenarios) {
      const outcome = runSingleSimulation(config, scenario, withdrawal);
      if (outcome === 'full') fullSuccess++;
      else if (outcome === 'soft') softSuccess++;
      else hardFailure++;
    }

    return {
      fullSuccessRate: fullSuccess / scenarios.length,
      combinedSuccessRate: (fullSuccess + softSuccess) / scenarios.length,
      failureRate: hardFailure / scenarios.length
    };
  }

  // ═══════════════════════════════════════════════════════════
  // STEP 3: Binary search to find thresholds
  // ═══════════════════════════════════════════════════════════
  const tolerance = 100; // $100 precision

  function findMax(getRate: (r: SimResults) => number, targetRate: number): number {
    let low = 0;
    let high = config.startingPortfolio * 0.15; // 15% as upper bound

    while (high - low > tolerance) {
      const mid = (low + high) / 2;
      const results = testWithdrawal(mid);

      if (getRate(results) >= targetRate) {
        low = mid;   // Can withdraw more
      } else {
        high = mid;  // Need to withdraw less
      }
    }
    return low;
  }

  return {
    maxFullSuccess: findMax(r => r.fullSuccessRate, 1.0),
    maxCombinedSuccess: findMax(r => r.combinedSuccessRate, 1.0),
    max85Percent: findMax(r => r.combinedSuccessRate, 0.85),
  };
}
```

**Why this approach?**

| Aspect | Locked Scenarios | Fresh Randomness Each Test |
|--------|------------------|---------------------------|
| Comparison | Apples-to-apples | Apples-to-oranges |
| Question answered | "Given THESE futures, max withdrawal?" | "Statistically, max withdrawal?" |
| Noise | Low (same scenarios) | High (different randomness) |
| Performance | Faster (generate once) | Slower (regenerate each time) |
| Reproducibility | Deterministic for same seed | Varies each run |

### Handling "Impossible" Scenarios

Sometimes the target is unachievable:

```
Essential Spending:  $4,000/mo ($48,000/yr)
Max Sustainable:     $3,200/mo ($38,400/yr)  ← at 100% combined success

RESULT: Impossible to achieve 100% success
        Gap: $800/mo shortfall
```

**UI Display**:
```
┌─────────────────────────────────────────────────────────────────┐
│  ⚠️  IMPOSSIBLE SCENARIO                                        │
│                                                                 │
│  Your essential spending ($48,000/yr) exceeds the maximum       │
│  sustainable withdrawal ($38,400/yr) at 100% success.           │
│                                                                 │
│  Gap: $9,600/yr ($800/mo)                                       │
│                                                                 │
│  Options to close the gap:                                      │
│  • Reduce essential spending                                    │
│  • Increase starting portfolio                                  │
│  • Add income sources (Social Security, part-time work)         │
│  • Accept lower success rate (current: 73% at essentials)       │
└─────────────────────────────────────────────────────────────────┘
```

### Solver Output Display

For achievable scenarios:

```
┌─────────────────────────────────────────────────────────────────┐
│  MAX WITHDRAWAL SOLVER                          [Run Solver]    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Starting Portfolio: $1,500,000                                 │
│  Essential Spending: $48,000/yr                                 │
│  Time Horizon: 30 years                                         │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Target                    Max Withdrawal    SWR         │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │ 100% Full Success         $52,400/yr       3.49%       │   │
│  │ 100% Combined Success     $67,200/yr       4.48%       │   │
│  │ 85% Combined Success      $78,900/yr       5.26%       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Your current planned spending: $60,000/yr                      │
│  → Falls between Full (100%) and Combined (100%) success        │
│  → You may need to cut discretionary in some years              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### User Interaction

**Trigger**: Button click (not automatic)

**Why not automatic?**
- Solver runs many simulations (binary search × 1000 runs each)
- User may want to tweak inputs before running
- Provides clear feedback that calculation is happening

**Flow**:
1. User adjusts inputs (portfolio, spending, time horizon, etc.)
2. User clicks "Run Solver"
3. Loading indicator shows progress
4. Results display with all three targets

### Performance Considerations

With locked scenarios, we generate randomness ONCE:

```
Scenario generation: 1,000 scenarios × 30 years = 30,000 random values (once)

Binary search iterations: ~10-11 per target (to reach $100 precision)

Per iteration: Run 1,000 scenarios (but NO random generation, just math)

Total work per target: 11 iterations × 1,000 scenarios = 11,000 scenario runs
Total for 3 targets: 33,000 scenario runs

Key difference: Scenario runs are MUCH faster than full simulations
               because random numbers are pre-computed.
```

**Performance benefits of locked scenarios:**
- Random number generation happens once upfront
- Each "test withdrawal" is pure arithmetic (no RNG calls)
- Scenarios can be stored in typed arrays for cache efficiency
- Results are deterministic (same seed → same answer)
