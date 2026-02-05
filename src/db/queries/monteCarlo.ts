import { db } from '../index';
import {
  monteCarloAssumptions,
  monteCarloCache,
  retirementProfile,
  socialSecurity,
  guardrailsConfig,
  annualBudgets,
  holdings,
  accounts,
  accountSnapshots,
} from '../schema';
import { eq } from 'drizzle-orm';

/**
 * Default Monte Carlo assumptions.
 * Conservative values based on historical data:
 * - 5% real return: Balanced portfolio (60/40) historical average after inflation
 * - 12% volatility: Standard deviation for a diversified portfolio
 * - Plan to age 95: ~25% of 65-year-olds live past 90
 * - 90% success rate: Standard target for retirement planning
 */
export const MONTE_CARLO_DEFAULTS = {
  realReturn: 0.05,
  volatility: 0.12,
  planToAge: 95,
  targetSuccessRate: 0.9,
  iterations: 1000,
} as const;

/**
 * Generate a hash of simulation inputs for cache lookup.
 */
function generateInputsHash(inputs: {
  portfolioValue: number;
  baseLivingExpense: number;
  totalGoalsAmount: number;
  essentialFloor: number;
  retirementAge: number | null;
  planToAge: number;
  realReturn: number;
  volatility: number;
  socialSecurityAmount?: number | null;
  guardrailsEnabled?: boolean;
  spendingCeiling?: number | null;
}): string {
  return [
    Math.round(inputs.portfolioValue / 1000),
    Math.round(inputs.baseLivingExpense / 100),
    Math.round(inputs.totalGoalsAmount / 100),
    Math.round(inputs.essentialFloor / 100),
    inputs.retirementAge ?? 0,
    inputs.planToAge,
    Math.round(inputs.realReturn * 1000),
    Math.round(inputs.volatility * 1000),
    Math.round((inputs.socialSecurityAmount ?? 0) / 100),
    inputs.guardrailsEnabled ? 1 : 0,
    Math.round((inputs.spendingCeiling ?? 0) / 100),
  ].join('-');
}

export function getAssumptions() {
  return db.select().from(monteCarloAssumptions).get();
}

export function getAssumptionsWithDefaults() {
  const assumptions = db.select().from(monteCarloAssumptions).get();

  return {
    realReturn: assumptions?.realReturn ?? MONTE_CARLO_DEFAULTS.realReturn,
    volatility: assumptions?.volatility ?? MONTE_CARLO_DEFAULTS.volatility,
    planToAge: assumptions?.planToAge ?? MONTE_CARLO_DEFAULTS.planToAge,
    targetSuccessRate: assumptions?.targetSuccessRate ?? MONTE_CARLO_DEFAULTS.targetSuccessRate,
    iterations: assumptions?.iterations ?? MONTE_CARLO_DEFAULTS.iterations,
    partTimeAnnualIncome: assumptions?.partTimeAnnualIncome,
    partTimeYears: assumptions?.partTimeYears,
    legacyTarget: assumptions?.legacyTarget,
    id: assumptions?.id,
    updatedAt: assumptions?.updatedAt,
  };
}

export function getSimulationInputs() {
  // Get Monte Carlo assumptions
  const assumptions = db.select().from(monteCarloAssumptions).get();

  // Get retirement profile
  const profile = db.select().from(retirementProfile).get();

  // Get Social Security
  const ss = db.select().from(socialSecurity).get();

  // Get guardrails config
  const guardrails = db.select().from(guardrailsConfig).get();

  // Get annual budgets (goals)
  const budgets = db.select().from(annualBudgets).all();

  // Calculate current portfolio value
  const allHoldings = db.select().from(holdings).all();
  let investmentValue = 0;
  for (const holding of allHoldings) {
    const price = holding.lastPrice ?? 0;
    investmentValue += holding.shares * price;
  }

  // Get cash accounts
  const allAccounts = db.select().from(accounts).all();
  const activeAccounts = allAccounts.filter(a => a.isActive);
  const cashAccountTypes = new Set(['checking', 'savings', 'money_market']);

  const snapshots = db.select().from(accountSnapshots).all();
  const latestSnapshots = new Map<string, number>();
  for (const snapshot of snapshots) {
    const existing = latestSnapshots.get(snapshot.accountId);
    if (!existing || snapshot.date > existing) {
      latestSnapshots.set(snapshot.accountId, snapshot.balance);
    }
  }

  let cashValue = 0;
  for (const account of activeAccounts) {
    if (cashAccountTypes.has(account.type)) {
      const balance = latestSnapshots.get(account.id) ?? 0;
      cashValue += balance;
    }
  }

  const portfolioValue = investmentValue + cashValue;

  // Calculate current age if profile exists
  let currentAge: number | null = null;
  let retirementAge: number | null = null;
  let retirementYear: number | null = null;
  if (profile) {
    currentAge = profile.currentAge;
    const retireDate = new Date(profile.retirementDate);
    const now = new Date();
    const yearsUntil = (retireDate.getTime() - now.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    retirementAge = Math.round(currentAge + yearsUntil);
    retirementYear = retireDate.getFullYear();
  }

  // Calculate Social Security claiming details
  let socialSecurityInput = null;
  if (ss && profile) {
    const claimingAge = ss.plannedClaimingAge ?? 67;
    const retirementAgeActual = retirementAge ?? 65;

    const ssStartYear = Math.max(0, claimingAge - retirementAgeActual);

    let monthlyBenefit = ss.benefitAt67;
    if (claimingAge === 62) monthlyBenefit = ss.benefitAt62;
    if (claimingAge === 70) monthlyBenefit = ss.benefitAt70;

    socialSecurityInput = {
      startYear: ssStartYear,
      annualAmount: Math.round(monthlyBenefit * 12),
      claimingAge,
    };
  }

  // SPENDING BREAKDOWN
  let baseLivingExpense: number;
  if (profile?.monthlyBaseLivingExpense !== undefined && profile.monthlyBaseLivingExpense !== null) {
    baseLivingExpense = profile.monthlyBaseLivingExpense * 12;
  } else {
    baseLivingExpense = profile?.annualSpending ?? 0;
  }

  // Convert annual budgets to goals format
  const goals = budgets.map(budget => ({
    id: budget.id,
    name: budget.name,
    annualAmount: budget.annualAmount,
    isEssential: budget.isEssential ?? false,
    startYear: budget.startYear && retirementYear
      ? Math.max(0, budget.startYear - retirementYear)
      : undefined,
    endYear: budget.endYear && retirementYear
      ? Math.max(0, budget.endYear - retirementYear)
      : undefined,
  }));

  const totalGoalsAmount = goals.reduce((sum, g) => sum + g.annualAmount, 0);
  const essentialGoalsAmount = goals
    .filter(g => g.isEssential)
    .reduce((sum, g) => sum + g.annualAmount, 0);
  const discretionaryGoalsAmount = goals
    .filter(g => !g.isEssential)
    .reduce((sum, g) => sum + g.annualAmount, 0);

  const totalAnnualSpending = baseLivingExpense + totalGoalsAmount;
  const essentialFloor = baseLivingExpense + essentialGoalsAmount;
  const discretionaryAmount = discretionaryGoalsAmount;

  // Format guardrails for simulation
  let guardrailsInput = null;
  if (guardrails?.isEnabled) {
    guardrailsInput = {
      enabled: true,
      upperThreshold: 1 + guardrails.upperThresholdPercent,
      lowerThreshold: 1 - guardrails.lowerThresholdPercent,
      increasePercent: guardrails.spendingAdjustmentPercent,
      decreasePercent: guardrails.spendingAdjustmentPercent,
    };
  }

  const simulationEssentialFloor = guardrails?.spendingFloor ?? essentialFloor;

  return {
    // Portfolio
    portfolioValue,
    investmentValue,
    cashValue,

    // Profile
    currentAge,
    retirementAge,
    retirementYear,

    // SPENDING BREAKDOWN
    baseLivingExpense,
    goals,
    totalGoalsAmount,
    essentialGoalsAmount,
    discretionaryGoalsAmount,
    totalAnnualSpending,
    essentialFloor,
    discretionaryAmount,

    // Legacy
    annualSpending: totalAnnualSpending,

    // Monte Carlo assumptions
    realReturn: assumptions?.realReturn ?? MONTE_CARLO_DEFAULTS.realReturn,
    volatility: assumptions?.volatility ?? MONTE_CARLO_DEFAULTS.volatility,
    planToAge: assumptions?.planToAge ?? MONTE_CARLO_DEFAULTS.planToAge,
    targetSuccessRate: assumptions?.targetSuccessRate ?? MONTE_CARLO_DEFAULTS.targetSuccessRate,
    iterations: assumptions?.iterations ?? MONTE_CARLO_DEFAULTS.iterations,

    // Part-time work
    partTimeWork: assumptions?.partTimeAnnualIncome
      ? {
          income: assumptions.partTimeAnnualIncome,
          years: assumptions.partTimeYears ?? 0,
        }
      : null,

    // Legacy target
    legacyTarget: assumptions?.legacyTarget,

    // Social Security
    socialSecurity: socialSecurityInput,

    // Guardrails
    guardrails: guardrailsInput,
    guardrailsConfig: guardrails ? {
      isEnabled: guardrails.isEnabled,
      spendingFloor: guardrails.spendingFloor,
      spendingCeiling: guardrails.spendingCeiling,
    } : null,

    // Essential floor for simulation
    simulationEssentialFloor,
    spendingCeiling: guardrails?.spendingCeiling,

    // Validation
    isReady:
      portfolioValue > 0 &&
      currentAge !== null &&
      retirementAge !== null &&
      totalAnnualSpending > 0,
    missingInputs: [
      portfolioValue <= 0 ? 'portfolio value' : null,
      currentAge === null ? 'current age' : null,
      retirementAge === null ? 'retirement age' : null,
      totalAnnualSpending <= 0 ? 'annual spending' : null,
    ].filter(Boolean) as string[],
  };
}

export function getCachedResults() {
  const inputs = getSimulationInputs();

  // Generate hash from current inputs
  const inputsHash = generateInputsHash({
    portfolioValue: inputs.portfolioValue,
    baseLivingExpense: inputs.baseLivingExpense,
    totalGoalsAmount: inputs.totalGoalsAmount,
    essentialFloor: inputs.essentialFloor,
    retirementAge: inputs.retirementAge,
    planToAge: inputs.planToAge,
    realReturn: inputs.realReturn,
    volatility: inputs.volatility,
    socialSecurityAmount: inputs.socialSecurity?.annualAmount,
    guardrailsEnabled: inputs.guardrails?.enabled ?? false,
    spendingCeiling: inputs.spendingCeiling,
  });

  // Look up cached results
  const cached = db.select()
    .from(monteCarloCache)
    .where(eq(monteCarloCache.inputsHash, inputsHash))
    .get();

  if (!cached) return null;

  // Check if expired
  if (cached.expiresAt < Date.now()) return null;

  return {
    ...cached.results,
    cachedAt: cached.createdAt,
    inputsHash,
  };
}

export function getInputsHash() {
  const inputs = getSimulationInputs();

  return generateInputsHash({
    portfolioValue: inputs.portfolioValue,
    baseLivingExpense: inputs.baseLivingExpense,
    totalGoalsAmount: inputs.totalGoalsAmount,
    essentialFloor: inputs.essentialFloor,
    retirementAge: inputs.retirementAge,
    planToAge: inputs.planToAge,
    realReturn: inputs.realReturn,
    volatility: inputs.volatility,
    socialSecurityAmount: inputs.socialSecurity?.annualAmount,
    guardrailsEnabled: inputs.guardrails?.enabled ?? false,
    spendingCeiling: inputs.spendingCeiling,
  });
}
