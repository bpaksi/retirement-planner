/**
 * Monte Carlo Performance Prototype
 *
 * Purpose: Test Monte Carlo simulation performance before building the full feature.
 * Run with: npx tsx scripts/monte-carlo-perf-test.ts
 *
 * Decision points:
 * - < 1 second for 1000 sims → Run in Convex action
 * - 1-5 seconds → Run in Convex action with loading state
 * - > 5 seconds → Need Web Worker or reduce iterations
 */

// Box-Muller transform for normal distribution
function normalRandom(mean: number, stdDev: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return z0 * stdDev + mean;
}

interface SimulationInput {
  startingPortfolio: number;
  annualSpending: number; // In today's dollars
  years: number;
  realReturn: number; // Return AFTER inflation (e.g., 0.05 = 5%)
  volatility: number;
  socialSecurity?: { startYear: number; annualAmount: number }; // In today's dollars
  essentialFloor?: number; // In today's dollars
  guardrails?: {
    enabled: boolean;
    upperThreshold: number;
    lowerThreshold: number;
    increasePercent: number;
    decreasePercent: number;
  };
}

interface SimulationResult {
  success: boolean;
  endingBalance: number; // In today's dollars (real terms)
  yearsLasted: number;
  lowestBalance: number;
  lowestBalanceYear: number;
}

/**
 * Run a single Monte Carlo simulation.
 *
 * Key insight: We use REAL returns (after inflation), so spending stays constant
 * in real terms. This matches the 4% rule methodology.
 */
function runSingleSimulation(input: SimulationInput): SimulationResult {
  let balance = input.startingPortfolio;
  let spending = input.annualSpending;
  let lowestBalance = balance;
  let lowestBalanceYear = 0;
  const initialPortfolio = input.startingPortfolio;

  for (let year = 0; year < input.years; year++) {
    // 1. Generate random REAL return (already inflation-adjusted)
    const realReturn = normalRandom(input.realReturn, input.volatility);
    balance *= (1 + realReturn);

    // 2. Add Social Security income if applicable (in real dollars)
    if (input.socialSecurity && year >= input.socialSecurity.startYear) {
      balance += input.socialSecurity.annualAmount;
    }

    // 3. Apply guardrails if enabled
    if (input.guardrails?.enabled) {
      const ratio = balance / initialPortfolio;

      if (ratio >= input.guardrails.upperThreshold) {
        spending *= (1 + input.guardrails.increasePercent);
      } else if (ratio <= input.guardrails.lowerThreshold) {
        const decreased = spending * (1 - input.guardrails.decreasePercent);
        spending = Math.max(decreased, input.essentialFloor ?? decreased);
      }
    }

    // 4. Withdraw spending (constant in real terms - no inflation adjustment needed)
    balance -= spending;

    // Track lowest point
    if (balance < lowestBalance) {
      lowestBalance = balance;
      lowestBalanceYear = year;
    }

    // 5. Check failure
    if (balance <= 0) {
      return {
        success: false,
        endingBalance: 0,
        yearsLasted: year + 1,
        lowestBalance: 0,
        lowestBalanceYear: year,
      };
    }
  }

  return {
    success: true,
    endingBalance: balance,
    yearsLasted: input.years,
    lowestBalance,
    lowestBalanceYear,
  };
}

interface AggregatedResult {
  successRate: number;
  iterations: number;
  success: {
    count: number;
    medianEndingBalance: number;
    p10EndingBalance: number;
    p90EndingBalance: number;
  };
  failure: {
    count: number;
    averageYearsLasted: number;
    medianYearsLasted: number;
    worstCase: number;
  };
}

function runMonteCarloSimulations(
  input: SimulationInput,
  iterations: number
): AggregatedResult {
  const results: SimulationResult[] = [];

  for (let i = 0; i < iterations; i++) {
    results.push(runSingleSimulation(input));
  }

  const successes = results.filter(r => r.success);
  const failures = results.filter(r => !r.success);

  // Sort for percentiles
  const endingBalances = successes.map(r => r.endingBalance).sort((a, b) => a - b);
  const failureYears = failures.map(r => r.yearsLasted).sort((a, b) => a - b);

  const percentile = (arr: number[], p: number): number => {
    if (arr.length === 0) return 0;
    const index = Math.floor(arr.length * p);
    return arr[Math.min(index, arr.length - 1)];
  };

  const average = (arr: number[]): number => {
    if (arr.length === 0) return 0;
    return arr.reduce((sum, v) => sum + v, 0) / arr.length;
  };

  return {
    successRate: successes.length / iterations,
    iterations,
    success: {
      count: successes.length,
      medianEndingBalance: percentile(endingBalances, 0.5),
      p10EndingBalance: percentile(endingBalances, 0.1),
      p90EndingBalance: percentile(endingBalances, 0.9),
    },
    failure: {
      count: failures.length,
      averageYearsLasted: average(failureYears),
      medianYearsLasted: percentile(failureYears, 0.5),
      worstCase: failureYears.length > 0 ? failureYears[0] : input.years,
    },
  };
}

function findMaxWithdrawal(
  baseInput: Omit<SimulationInput, 'annualSpending'>,
  targetSuccessRate: number,
  iterationsPerTest: number,
  precision: number = 500
): { maxWithdrawal: number; successRate: number; searchIterations: number } {
  let low = baseInput.essentialFloor || 20000;
  let high = baseInput.startingPortfolio * 0.10; // 10% withdrawal as upper bound
  let searchIterations = 0;

  let bestWithdrawal = low;
  let bestSuccessRate = 1.0;

  while (high - low > precision) {
    searchIterations++;
    const mid = Math.round((low + high) / 2);

    const result = runMonteCarloSimulations(
      { ...baseInput, annualSpending: mid },
      iterationsPerTest
    );

    if (result.successRate >= targetSuccessRate) {
      bestWithdrawal = mid;
      bestSuccessRate = result.successRate;
      low = mid;
    } else {
      high = mid;
    }
  }

  return {
    maxWithdrawal: bestWithdrawal,
    successRate: bestSuccessRate,
    searchIterations,
  };
}

// ============================================================================
// Performance Tests
// ============================================================================

console.log('='.repeat(70));
console.log('Monte Carlo Performance Prototype');
console.log('='.repeat(70));
console.log();

// NOTE: Using REAL returns (after inflation)
// Historical US stock market: ~7% real return, ~15-20% volatility
// Balanced portfolio (60/40): ~5% real return, ~10-12% volatility
const baseInput: SimulationInput = {
  startingPortfolio: 1_000_000,
  annualSpending: 40_000,
  years: 30,
  realReturn: 0.05,  // 5% real return (conservative balanced portfolio)
  volatility: 0.12,  // 12% standard deviation
};

// Test 1: Basic simulation (1000 iterations)
console.log('Test 1: Basic Monte Carlo (1000 iterations, 30 years)');
console.log('-'.repeat(50));

let start = performance.now();
let result = runMonteCarloSimulations(baseInput, 1000);
let elapsed = performance.now() - start;

console.log(`Time: ${elapsed.toFixed(2)}ms`);
console.log(`Success rate: ${(result.successRate * 100).toFixed(1)}%`);
console.log(`Median ending balance: $${result.success.medianEndingBalance.toLocaleString()}`);
if (result.failure.count > 0) {
  console.log(`Failures: ${result.failure.count}, avg years lasted: ${result.failure.averageYearsLasted.toFixed(1)}`);
}
console.log();

// Test 2: More iterations (5000)
console.log('Test 2: More iterations (5000 iterations, 30 years)');
console.log('-'.repeat(50));

start = performance.now();
result = runMonteCarloSimulations(baseInput, 5000);
elapsed = performance.now() - start;

console.log(`Time: ${elapsed.toFixed(2)}ms`);
console.log(`Success rate: ${(result.successRate * 100).toFixed(1)}%`);
console.log();

// Test 3: Even more iterations (10000)
console.log('Test 3: High precision (10000 iterations, 30 years)');
console.log('-'.repeat(50));

start = performance.now();
result = runMonteCarloSimulations(baseInput, 10000);
elapsed = performance.now() - start;

console.log(`Time: ${elapsed.toFixed(2)}ms`);
console.log(`Success rate: ${(result.successRate * 100).toFixed(1)}%`);
console.log();

// Test 4: With Social Security
console.log('Test 4: With Social Security (1000 iterations)');
console.log('-'.repeat(50));

const inputWithSS: SimulationInput = {
  ...baseInput,
  socialSecurity: { startYear: 5, annualAmount: 24000 }, // $24K SS starting year 5
};

start = performance.now();
result = runMonteCarloSimulations(inputWithSS, 1000);
elapsed = performance.now() - start;

console.log(`Time: ${elapsed.toFixed(2)}ms`);
console.log(`Success rate: ${(result.successRate * 100).toFixed(1)}%`);
console.log();

// Test 5: With Guardrails
console.log('Test 5: With Guardrails (1000 iterations)');
console.log('-'.repeat(50));

const inputWithGuardrails: SimulationInput = {
  ...baseInput,
  essentialFloor: 30000,
  guardrails: {
    enabled: true,
    upperThreshold: 1.25,
    lowerThreshold: 0.75,
    increasePercent: 0.10,
    decreasePercent: 0.10,
  },
};

start = performance.now();
result = runMonteCarloSimulations(inputWithGuardrails, 1000);
elapsed = performance.now() - start;

console.log(`Time: ${elapsed.toFixed(2)}ms`);
console.log(`Success rate: ${(result.successRate * 100).toFixed(1)}%`);
console.log();

// Test 6: Binary Search Solver
console.log('Test 6: Max Withdrawal Solver (binary search)');
console.log('-'.repeat(50));
console.log('Finding max withdrawal for 90% success rate...');

start = performance.now();
const solverResult = findMaxWithdrawal(
  {
    startingPortfolio: 1_000_000,
    years: 30,
    realReturn: 0.05,
    volatility: 0.12,
  },
  0.90, // 90% success rate target
  500,  // 500 iterations per test (for speed during search)
  500   // $500 precision
);
elapsed = performance.now() - start;

console.log(`Time: ${elapsed.toFixed(2)}ms`);
console.log(`Search iterations: ${solverResult.searchIterations}`);
console.log(`Max withdrawal: $${solverResult.maxWithdrawal.toLocaleString()}/year`);
console.log(`Withdrawal rate: ${((solverResult.maxWithdrawal / 1_000_000) * 100).toFixed(2)}%`);
console.log(`Actual success rate: ${(solverResult.successRate * 100).toFixed(1)}%`);
console.log();

// Test 7: Longer retirement (40 years)
console.log('Test 7: Longer retirement (40 years, 1000 iterations)');
console.log('-'.repeat(50));

const longRetirement: SimulationInput = {
  ...baseInput,
  years: 40,
};

start = performance.now();
result = runMonteCarloSimulations(longRetirement, 1000);
elapsed = performance.now() - start;

console.log(`Time: ${elapsed.toFixed(2)}ms`);
console.log(`Success rate: ${(result.successRate * 100).toFixed(1)}%`);
console.log();

// Summary
console.log('='.repeat(70));
console.log('PERFORMANCE SUMMARY');
console.log('='.repeat(70));
console.log();

const testTimes = [
  { name: '1000 basic sims', time: 0 },
  { name: '5000 sims', time: 0 },
  { name: '10000 sims', time: 0 },
  { name: 'Solver (binary search)', time: 0 },
];

// Re-run for accurate timing
start = performance.now();
runMonteCarloSimulations(baseInput, 1000);
testTimes[0].time = performance.now() - start;

start = performance.now();
runMonteCarloSimulations(baseInput, 5000);
testTimes[1].time = performance.now() - start;

start = performance.now();
runMonteCarloSimulations(baseInput, 10000);
testTimes[2].time = performance.now() - start;

start = performance.now();
findMaxWithdrawal(
  { startingPortfolio: 1_000_000, years: 30, realReturn: 0.05, volatility: 0.12 },
  0.90, 500, 500
);
testTimes[3].time = performance.now() - start;

for (const test of testTimes) {
  const status = test.time < 1000 ? '✅ Convex action OK' :
                 test.time < 5000 ? '⚠️ Needs loading state' :
                 '❌ Consider Web Worker';
  console.log(`${test.name.padEnd(25)} ${test.time.toFixed(0).padStart(6)}ms  ${status}`);
}

console.log();
console.log('RECOMMENDATION:');
if (testTimes[3].time < 1000) {
  console.log('→ All operations fast enough for Convex action');
} else if (testTimes[0].time < 1000 && testTimes[3].time < 5000) {
  console.log('→ Run in Convex action with loading state for solver operations');
} else {
  console.log('→ Consider Web Worker for heavy operations');
}
console.log();

// ============================================================================
// Validation Tests
// ============================================================================

console.log('='.repeat(70));
console.log('VALIDATION TESTS');
console.log('='.repeat(70));
console.log();

// Test: 4% Rule (Trinity Study basis)
// The 4% rule historically shows ~95% success over 30 years
// With Monte Carlo using 5% real return (conservative), we expect ~90-95%
console.log('Validation 1: 4% Rule ($1M portfolio, $40K/year, 30 years)');
console.log('-'.repeat(50));
console.log('Expected: ~90-95% success (historical 4% rule)');

const fourPercentResult = runMonteCarloSimulations(
  {
    startingPortfolio: 1_000_000,
    annualSpending: 40_000,
    years: 30,
    realReturn: 0.05,  // 5% real return
    volatility: 0.12,
  },
  10000
);

console.log(`Actual: ${(fourPercentResult.successRate * 100).toFixed(1)}% success rate`);
if (fourPercentResult.successRate >= 0.88 && fourPercentResult.successRate <= 0.98) {
  console.log('✅ PASS: Result in expected range');
} else {
  console.log('⚠️ INVESTIGATE: Result outside expected range');
}
console.log();

// Test: 8% withdrawal should fail most of the time
console.log('Validation 2: 8% Rule (should fail more often)');
console.log('-'.repeat(50));
console.log('Expected: <50% success (8% withdrawal is unsustainable)');

const eightPercentResult = runMonteCarloSimulations(
  {
    startingPortfolio: 1_000_000,
    annualSpending: 80_000, // 8% withdrawal
    years: 30,
    realReturn: 0.05,
    volatility: 0.12,
  },
  10000
);

console.log(`Actual: ${(eightPercentResult.successRate * 100).toFixed(1)}% success rate`);
if (eightPercentResult.failure.count > 0) {
  console.log(`Avg years lasted on failure: ${eightPercentResult.failure.averageYearsLasted.toFixed(1)}`);
}
if (eightPercentResult.successRate < 0.50) {
  console.log('✅ PASS: High withdrawal rate fails as expected');
} else {
  console.log('⚠️ INVESTIGATE: 8% rule succeeding too often');
}
console.log();

// Test: 3% withdrawal should almost always succeed
console.log('Validation 3: 3% Rule (should almost always succeed)');
console.log('-'.repeat(50));
console.log('Expected: >98% success (3% is very conservative)');

const threePercentResult = runMonteCarloSimulations(
  {
    startingPortfolio: 1_000_000,
    annualSpending: 30_000, // 3% withdrawal
    years: 30,
    realReturn: 0.05,
    volatility: 0.12,
  },
  10000
);

console.log(`Actual: ${(threePercentResult.successRate * 100).toFixed(1)}% success rate`);
if (threePercentResult.successRate >= 0.98) {
  console.log('✅ PASS: Conservative withdrawal succeeds as expected');
} else {
  console.log('⚠️ INVESTIGATE: 3% rule failing too often');
}
console.log();

// Test: Short retirement with high spending
console.log('Validation 4: Edge case - 50% withdrawal, 30 years');
console.log('-'.repeat(50));
console.log('Expected: <5% success, avg ~2-3 years lasted');

const extremeResult = runMonteCarloSimulations(
  {
    startingPortfolio: 100_000,
    annualSpending: 50_000, // 50% withdrawal!
    years: 30,
    realReturn: 0.05,
    volatility: 0.12,
  },
  10000
);

console.log(`Actual: ${(extremeResult.successRate * 100).toFixed(1)}% success rate`);
if (extremeResult.failure.count > 0) {
  console.log(`Avg years lasted: ${extremeResult.failure.averageYearsLasted.toFixed(1)}`);
  console.log(`Worst case: ${extremeResult.failure.worstCase} years`);
}
if (extremeResult.successRate < 0.05 && extremeResult.failure.averageYearsLasted < 5) {
  console.log('✅ PASS: Extreme withdrawal fails quickly as expected');
} else {
  console.log('⚠️ INVESTIGATE: Extreme case not behaving as expected');
}
console.log();

// Test: Guardrails should improve success rate
console.log('Validation 5: Guardrails should improve success');
console.log('-'.repeat(50));
console.log('Testing 5% withdrawal with and without guardrails...');

const baselineResult = runMonteCarloSimulations(
  {
    startingPortfolio: 1_000_000,
    annualSpending: 50_000, // 5% - borderline
    years: 30,
    realReturn: 0.05,
    volatility: 0.12,
  },
  5000
);

const guardrailsResult = runMonteCarloSimulations(
  {
    startingPortfolio: 1_000_000,
    annualSpending: 50_000,
    years: 30,
    realReturn: 0.05,
    volatility: 0.12,
    essentialFloor: 35000,
    guardrails: {
      enabled: true,
      upperThreshold: 1.20,  // 20% above target
      lowerThreshold: 0.80,  // 20% below target
      increasePercent: 0.10, // 10% increase
      decreasePercent: 0.10, // 10% decrease
    },
  },
  5000
);

console.log(`Without guardrails: ${(baselineResult.successRate * 100).toFixed(1)}% success`);
console.log(`With guardrails: ${(guardrailsResult.successRate * 100).toFixed(1)}% success`);
if (guardrailsResult.successRate > baselineResult.successRate) {
  console.log('✅ PASS: Guardrails improve success rate');
} else {
  console.log('⚠️ INVESTIGATE: Guardrails not helping');
}
console.log();

console.log('='.repeat(70));
console.log('ALL TESTS COMPLETE');
console.log('='.repeat(70));
