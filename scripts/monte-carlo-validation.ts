/**
 * Monte Carlo Validation Tests
 *
 * Purpose: Validate Monte Carlo simulation produces correct results.
 * Run with: npx tsx scripts/monte-carlo-validation.ts
 *
 * Reference sources:
 * - Trinity Study (4% rule): https://www.aaii.com/journal/article/retirement-savings-choosing-a-withdrawal-rate-that-is-sustainable
 * - FIRECalc: https://firecalc.com/
 * - cFIREsim: https://www.cfiresim.com/
 *
 * Expected results are based on historical data and Monte Carlo simulations
 * using similar assumptions. Results should be within ±5% of expectations.
 */

// ============================================================================
// Monte Carlo Engine (same as production code)
// ============================================================================

function normalRandom(mean: number, stdDev: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return z0 * stdDev + mean;
}

interface SimulationInput {
  startingPortfolio: number;
  annualSpending: number;
  years: number;
  realReturn: number;
  volatility: number;
  socialSecurity?: { startYear: number; annualAmount: number };
  essentialFloor?: number;
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
  endingBalance: number;
  yearsLasted: number;
  lowestBalance: number;
  lowestBalanceYear: number;
}

function runSingleSimulation(input: SimulationInput): SimulationResult {
  let balance = input.startingPortfolio;
  let spending = input.annualSpending;
  let lowestBalance = balance;
  let lowestBalanceYear = 0;
  const initialPortfolio = input.startingPortfolio;

  for (let year = 0; year < input.years; year++) {
    const realReturn = normalRandom(input.realReturn, input.volatility);
    balance *= (1 + realReturn);

    if (input.socialSecurity && year >= input.socialSecurity.startYear) {
      balance += input.socialSecurity.annualAmount;
    }

    if (input.guardrails?.enabled) {
      const ratio = balance / initialPortfolio;
      if (ratio >= input.guardrails.upperThreshold) {
        spending *= (1 + input.guardrails.increasePercent);
      } else if (ratio <= input.guardrails.lowerThreshold) {
        const decreased = spending * (1 - input.guardrails.decreasePercent);
        spending = Math.max(decreased, input.essentialFloor ?? decreased);
      }
    }

    balance -= spending;

    if (balance < lowestBalance) {
      lowestBalance = balance;
      lowestBalanceYear = year;
    }

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

// ============================================================================
// Test Utilities
// ============================================================================

interface TestResult {
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
  details?: string;
}

const results: TestResult[] = [];

function test(
  name: string,
  expected: string,
  condition: boolean,
  actual: string,
  details?: string
) {
  results.push({
    name,
    passed: condition,
    expected,
    actual,
    details,
  });
}

function assertInRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

// ============================================================================
// Validation Tests
// ============================================================================

console.log('='.repeat(70));
console.log('Monte Carlo Validation Test Suite');
console.log('='.repeat(70));
console.log();

const ITERATIONS = 10000; // High iteration count for accuracy

// ---------------------------------------------------------------------------
// Test 1: 4% Rule (Trinity Study Baseline)
// ---------------------------------------------------------------------------
console.log('Test 1: 4% Rule Validation (Trinity Study)');
console.log('-'.repeat(50));
console.log('Scenario: $1M portfolio, $40K/year (4%), 30 years');
console.log('Expected: 85-95% success rate');
console.log();

// Using 5% real return (after inflation) and 12% volatility
// This is conservative compared to historical stock market
const fourPercentResult = runMonteCarloSimulations({
  startingPortfolio: 1_000_000,
  annualSpending: 40_000,
  years: 30,
  realReturn: 0.05,
  volatility: 0.12,
}, ITERATIONS);

console.log(`Result: ${(fourPercentResult.successRate * 100).toFixed(1)}% success rate`);

test(
  '4% rule success rate',
  '85-95%',
  assertInRange(fourPercentResult.successRate, 0.85, 0.95),
  `${(fourPercentResult.successRate * 100).toFixed(1)}%`,
  'Trinity Study historical data shows ~95% success. Monte Carlo with normal distribution may be slightly lower due to fat tails.'
);

// ---------------------------------------------------------------------------
// Test 2: 3% Rule (Conservative)
// ---------------------------------------------------------------------------
console.log();
console.log('Test 2: 3% Rule (Conservative Withdrawal)');
console.log('-'.repeat(50));
console.log('Scenario: $1M portfolio, $30K/year (3%), 30 years');
console.log('Expected: 95-100% success rate');
console.log();

const threePercentResult = runMonteCarloSimulations({
  startingPortfolio: 1_000_000,
  annualSpending: 30_000,
  years: 30,
  realReturn: 0.05,
  volatility: 0.12,
}, ITERATIONS);

console.log(`Result: ${(threePercentResult.successRate * 100).toFixed(1)}% success rate`);

test(
  '3% rule success rate',
  '95-100%',
  assertInRange(threePercentResult.successRate, 0.95, 1.0),
  `${(threePercentResult.successRate * 100).toFixed(1)}%`,
  'Conservative withdrawal rate should almost always succeed.'
);

// ---------------------------------------------------------------------------
// Test 3: 5% Rule (Aggressive)
// ---------------------------------------------------------------------------
console.log();
console.log('Test 3: 5% Rule (Aggressive Withdrawal)');
console.log('-'.repeat(50));
console.log('Scenario: $1M portfolio, $50K/year (5%), 30 years');
console.log('Expected: 60-80% success rate');
console.log();

const fivePercentResult = runMonteCarloSimulations({
  startingPortfolio: 1_000_000,
  annualSpending: 50_000,
  years: 30,
  realReturn: 0.05,
  volatility: 0.12,
}, ITERATIONS);

console.log(`Result: ${(fivePercentResult.successRate * 100).toFixed(1)}% success rate`);

test(
  '5% rule success rate',
  '60-80%',
  assertInRange(fivePercentResult.successRate, 0.60, 0.80),
  `${(fivePercentResult.successRate * 100).toFixed(1)}%`,
  '5% withdrawal is considered risky but not disastrous.'
);

// ---------------------------------------------------------------------------
// Test 4: 8% Rule (Unsustainable)
// ---------------------------------------------------------------------------
console.log();
console.log('Test 4: 8% Rule (Unsustainable Withdrawal)');
console.log('-'.repeat(50));
console.log('Scenario: $1M portfolio, $80K/year (8%), 30 years');
console.log('Expected: <30% success rate');
console.log();

const eightPercentResult = runMonteCarloSimulations({
  startingPortfolio: 1_000_000,
  annualSpending: 80_000,
  years: 30,
  realReturn: 0.05,
  volatility: 0.12,
}, ITERATIONS);

console.log(`Result: ${(eightPercentResult.successRate * 100).toFixed(1)}% success rate`);
console.log(`Avg years lasted on failure: ${eightPercentResult.failure.averageYearsLasted.toFixed(1)}`);

test(
  '8% rule success rate',
  '<30%',
  eightPercentResult.successRate < 0.30,
  `${(eightPercentResult.successRate * 100).toFixed(1)}%`,
  '8% withdrawal rate is historically unsustainable.'
);

// ---------------------------------------------------------------------------
// Test 5: Longer Retirement (40 years)
// ---------------------------------------------------------------------------
console.log();
console.log('Test 5: Longer Retirement (40 years)');
console.log('-'.repeat(50));
console.log('Scenario: $1M portfolio, $40K/year (4%), 40 years');
console.log('Expected: 70-85% success rate (lower than 30-year)');
console.log();

const longRetirementResult = runMonteCarloSimulations({
  startingPortfolio: 1_000_000,
  annualSpending: 40_000,
  years: 40,
  realReturn: 0.05,
  volatility: 0.12,
}, ITERATIONS);

console.log(`Result: ${(longRetirementResult.successRate * 100).toFixed(1)}% success rate`);

test(
  '40-year retirement success rate',
  '70-85%',
  assertInRange(longRetirementResult.successRate, 0.70, 0.85),
  `${(longRetirementResult.successRate * 100).toFixed(1)}%`,
  'Longer retirement increases failure risk.'
);

test(
  '40-year < 30-year success',
  'true',
  longRetirementResult.successRate < fourPercentResult.successRate,
  `${longRetirementResult.successRate < fourPercentResult.successRate}`,
  'Longer retirement should have lower success rate.'
);

// ---------------------------------------------------------------------------
// Test 6: Social Security Impact
// ---------------------------------------------------------------------------
console.log();
console.log('Test 6: Social Security Impact');
console.log('-'.repeat(50));
console.log('Scenario: $1M portfolio, $40K/year, 30 years, $24K SS at year 5');
console.log('Expected: Higher success rate than baseline');
console.log();

const withSSResult = runMonteCarloSimulations({
  startingPortfolio: 1_000_000,
  annualSpending: 40_000,
  years: 30,
  realReturn: 0.05,
  volatility: 0.12,
  socialSecurity: { startYear: 5, annualAmount: 24000 },
}, ITERATIONS);

console.log(`Without SS: ${(fourPercentResult.successRate * 100).toFixed(1)}%`);
console.log(`With SS: ${(withSSResult.successRate * 100).toFixed(1)}%`);

test(
  'SS improves success rate',
  'true',
  withSSResult.successRate > fourPercentResult.successRate,
  `${withSSResult.successRate > fourPercentResult.successRate}`,
  'Social Security income should significantly improve success.'
);

test(
  'SS brings success rate > 95%',
  '>95%',
  withSSResult.successRate > 0.95,
  `${(withSSResult.successRate * 100).toFixed(1)}%`,
  '$24K SS covers 60% of spending, dramatically reducing portfolio draw.'
);

// ---------------------------------------------------------------------------
// Test 7: Guardrails Strategy
// ---------------------------------------------------------------------------
console.log();
console.log('Test 7: Guardrails Strategy');
console.log('-'.repeat(50));
console.log('Scenario: $1M portfolio, $50K/year (5%), 30 years, with guardrails');
console.log('Expected: Guardrails improve success rate');
console.log();

const withoutGuardrails = runMonteCarloSimulations({
  startingPortfolio: 1_000_000,
  annualSpending: 50_000,
  years: 30,
  realReturn: 0.05,
  volatility: 0.12,
}, ITERATIONS);

const withGuardrails = runMonteCarloSimulations({
  startingPortfolio: 1_000_000,
  annualSpending: 50_000,
  years: 30,
  realReturn: 0.05,
  volatility: 0.12,
  essentialFloor: 35000,
  guardrails: {
    enabled: true,
    upperThreshold: 1.20,
    lowerThreshold: 0.80,
    increasePercent: 0.10,
    decreasePercent: 0.10,
  },
}, ITERATIONS);

console.log(`Without guardrails: ${(withoutGuardrails.successRate * 100).toFixed(1)}%`);
console.log(`With guardrails: ${(withGuardrails.successRate * 100).toFixed(1)}%`);

test(
  'Guardrails improve success',
  'true',
  withGuardrails.successRate > withoutGuardrails.successRate,
  `${withGuardrails.successRate > withoutGuardrails.successRate}`,
  'Dynamic spending adjustments should reduce failure risk.'
);

// ---------------------------------------------------------------------------
// Test 8: Extreme Edge Cases
// ---------------------------------------------------------------------------
console.log();
console.log('Test 8: Extreme Edge Cases');
console.log('-'.repeat(50));

// Case A: 50% withdrawal - should fail almost immediately
const extreme50 = runMonteCarloSimulations({
  startingPortfolio: 100_000,
  annualSpending: 50_000,
  years: 30,
  realReturn: 0.05,
  volatility: 0.12,
}, ITERATIONS);

console.log('50% withdrawal: ' + `${(extreme50.successRate * 100).toFixed(1)}% success, avg ${extreme50.failure.averageYearsLasted.toFixed(1)} years`);

test(
  '50% withdrawal fails quickly',
  '<5% success, <4 years avg',
  extreme50.successRate < 0.05 && extreme50.failure.averageYearsLasted < 4,
  `${(extreme50.successRate * 100).toFixed(1)}% success, ${extreme50.failure.averageYearsLasted.toFixed(1)} years`,
  'Extreme withdrawal should fail within first few years.'
);

// Case B: 1% withdrawal - should never fail
const extreme1 = runMonteCarloSimulations({
  startingPortfolio: 1_000_000,
  annualSpending: 10_000,
  years: 30,
  realReturn: 0.05,
  volatility: 0.12,
}, ITERATIONS);

console.log('1% withdrawal: ' + `${(extreme1.successRate * 100).toFixed(1)}% success`);

test(
  '1% withdrawal never fails',
  '100%',
  extreme1.successRate >= 0.999,
  `${(extreme1.successRate * 100).toFixed(1)}%`,
  'Ultra-conservative withdrawal should virtually never fail.'
);

// Case C: Zero volatility - deterministic
const zeroVol = runMonteCarloSimulations({
  startingPortfolio: 1_000_000,
  annualSpending: 40_000,
  years: 30,
  realReturn: 0.05,
  volatility: 0.0,
}, 100); // Fewer iterations since deterministic

console.log('Zero volatility: ' + `${(zeroVol.successRate * 100).toFixed(1)}% success`);

test(
  'Zero volatility is deterministic',
  '100% or 0%',
  zeroVol.successRate === 1.0 || zeroVol.successRate === 0.0,
  `${(zeroVol.successRate * 100).toFixed(1)}%`,
  'With no randomness, all simulations should have same outcome.'
);

// ---------------------------------------------------------------------------
// Test 9: Failure Analysis
// ---------------------------------------------------------------------------
console.log();
console.log('Test 9: Failure Analysis');
console.log('-'.repeat(50));

test(
  'Failures have meaningful years lasted',
  '>0 years',
  eightPercentResult.failure.averageYearsLasted > 0,
  `${eightPercentResult.failure.averageYearsLasted.toFixed(1)} years`,
  'Failed simulations should track when they ran out.'
);

test(
  'Worst case < average years lasted',
  'true',
  eightPercentResult.failure.worstCase <= eightPercentResult.failure.averageYearsLasted,
  `worst: ${eightPercentResult.failure.worstCase}, avg: ${eightPercentResult.failure.averageYearsLasted.toFixed(1)}`,
  'Worst case should be the minimum, not exceed average.'
);

// ---------------------------------------------------------------------------
// Test 10: Higher Returns Improve Outcomes
// ---------------------------------------------------------------------------
console.log();
console.log('Test 10: Return Sensitivity');
console.log('-'.repeat(50));

const lowReturn = runMonteCarloSimulations({
  startingPortfolio: 1_000_000,
  annualSpending: 40_000,
  years: 30,
  realReturn: 0.03, // 3% real return
  volatility: 0.12,
}, ITERATIONS);

const highReturn = runMonteCarloSimulations({
  startingPortfolio: 1_000_000,
  annualSpending: 40_000,
  years: 30,
  realReturn: 0.07, // 7% real return
  volatility: 0.12,
}, ITERATIONS);

console.log(`3% real return: ${(lowReturn.successRate * 100).toFixed(1)}%`);
console.log(`5% real return: ${(fourPercentResult.successRate * 100).toFixed(1)}%`);
console.log(`7% real return: ${(highReturn.successRate * 100).toFixed(1)}%`);

test(
  'Higher returns improve success',
  '3% < 5% < 7%',
  lowReturn.successRate < fourPercentResult.successRate && fourPercentResult.successRate < highReturn.successRate,
  `${(lowReturn.successRate * 100).toFixed(1)}% < ${(fourPercentResult.successRate * 100).toFixed(1)}% < ${(highReturn.successRate * 100).toFixed(1)}%`,
  'Success rate should increase with expected returns.'
);

// ============================================================================
// Summary
// ============================================================================

console.log();
console.log('='.repeat(70));
console.log('TEST RESULTS SUMMARY');
console.log('='.repeat(70));
console.log();

const passed = results.filter(r => r.passed).length;
const failed = results.filter(r => !r.passed).length;

for (const r of results) {
  const status = r.passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status}: ${r.name}`);
  if (!r.passed) {
    console.log(`       Expected: ${r.expected}`);
    console.log(`       Actual: ${r.actual}`);
    if (r.details) {
      console.log(`       Note: ${r.details}`);
    }
  }
}

console.log();
console.log('-'.repeat(70));
console.log(`Total: ${results.length} tests, ${passed} passed, ${failed} failed`);
console.log();

if (failed === 0) {
  console.log('✅ All validation tests passed!');
  console.log('   Monte Carlo engine produces results consistent with expectations.');
} else {
  console.log('⚠️ Some tests failed - review the results above.');
  console.log('   Failures may indicate bugs or overly strict expectations.');
}

console.log();
console.log('='.repeat(70));
console.log('COMPARISON WITH EXTERNAL TOOLS');
console.log('='.repeat(70));
console.log();
console.log('For manual validation, compare results with:');
console.log('- FIRECalc: https://firecalc.com/');
console.log('- cFIREsim: https://www.cfiresim.com/');
console.log('- Portfolio Visualizer: https://www.portfoliovisualizer.com/monte-carlo-simulation');
console.log();
console.log('Note: Historical simulators (FIRECalc) use actual market returns,');
console.log('while Monte Carlo uses a probability distribution. Results will vary');
console.log('but should be in similar ranges for reasonable assumptions.');
console.log();

// Exit with error code if tests failed
process.exit(failed > 0 ? 1 : 0);
