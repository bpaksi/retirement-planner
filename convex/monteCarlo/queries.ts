import { query } from "../_generated/server";

/**
 * Generate a hash of simulation inputs for cache lookup.
 * Uses a simple string concatenation approach - good enough for our needs.
 */
function generateInputsHash(inputs: {
  portfolioValue: number;
  annualSpending: number;
  retirementAge: number | null;
  planToAge: number;
  realReturn: number;
  volatility: number;
  socialSecurityAmount?: number | null;
  guardrailsEnabled?: boolean;
}): string {
  return [
    Math.round(inputs.portfolioValue / 1000), // Round to nearest $1k
    Math.round(inputs.annualSpending / 100), // Round to nearest $100
    inputs.retirementAge ?? 0,
    inputs.planToAge,
    Math.round(inputs.realReturn * 1000),
    Math.round(inputs.volatility * 1000),
    Math.round((inputs.socialSecurityAmount ?? 0) / 100),
    inputs.guardrailsEnabled ? 1 : 0,
  ].join("-");
}

/**
 * Default Monte Carlo assumptions.
 *
 * These are intentionally conservative:
 * - 5% real return: Balanced portfolio (60/40) historical average after inflation
 * - 12% volatility: Accounts for market swings in a diversified portfolio
 * - Plan to age 95: ~25% of 65-year-olds live past 90
 * - 90% success rate: Standard target for retirement planning
 */
export const MONTE_CARLO_DEFAULTS = {
  realReturn: 0.05, // 5% real return after inflation
  volatility: 0.12, // 12% standard deviation
  planToAge: 95, // Conservative life expectancy
  targetSuccessRate: 0.9, // 90% success target
  iterations: 1000, // Balance of accuracy and speed
} as const;

/**
 * Get Monte Carlo assumptions.
 */
export const getAssumptions = query({
  args: {},
  handler: async (ctx) => {
    const assumptions = await ctx.db.query("monteCarloAssumptions").first();
    return assumptions;
  },
});

/**
 * Get Monte Carlo assumptions with defaults filled in.
 * Use this for running simulations.
 */
export const getAssumptionsWithDefaults = query({
  args: {},
  handler: async (ctx) => {
    const assumptions = await ctx.db.query("monteCarloAssumptions").first();

    return {
      realReturn: assumptions?.realReturn ?? MONTE_CARLO_DEFAULTS.realReturn,
      volatility: assumptions?.volatility ?? MONTE_CARLO_DEFAULTS.volatility,
      planToAge: assumptions?.planToAge ?? MONTE_CARLO_DEFAULTS.planToAge,
      targetSuccessRate:
        assumptions?.targetSuccessRate ?? MONTE_CARLO_DEFAULTS.targetSuccessRate,
      iterations: assumptions?.iterations ?? MONTE_CARLO_DEFAULTS.iterations,
      partTimeAnnualIncome: assumptions?.partTimeAnnualIncome,
      partTimeYears: assumptions?.partTimeYears,
      legacyTarget: assumptions?.legacyTarget,
      _id: assumptions?._id,
      updatedAt: assumptions?.updatedAt,
    };
  },
});

/**
 * Get all inputs needed to run a Monte Carlo simulation.
 * Combines data from multiple tables into a single query.
 */
export const getSimulationInputs = query({
  args: {},
  handler: async (ctx) => {
    // Get Monte Carlo assumptions
    const assumptions = await ctx.db.query("monteCarloAssumptions").first();

    // Get retirement profile
    const profile = await ctx.db.query("retirementProfile").first();

    // Get Social Security
    const ss = await ctx.db.query("socialSecurity").first();

    // Get guardrails config
    const guardrails = await ctx.db.query("guardrailsConfig").first();

    // Calculate current portfolio value
    const holdings = await ctx.db.query("holdings").collect();
    let investmentValue = 0;
    for (const holding of holdings) {
      const price = holding.lastPrice ?? 0;
      investmentValue += holding.shares * price;
    }

    // Get cash accounts
    const accounts = await ctx.db.query("accounts").collect();
    const activeAccounts = accounts.filter((a) => a.isActive);
    const cashAccountTypes = new Set(["checking", "savings", "money_market"]);

    const accountSnapshots = await ctx.db.query("accountSnapshots").collect();
    const latestSnapshots = new Map<string, number>();
    for (const snapshot of accountSnapshots) {
      const accountId = snapshot.accountId.toString();
      const existing = latestSnapshots.get(accountId);
      if (!existing || snapshot.date > existing) {
        latestSnapshots.set(accountId, snapshot.balance);
      }
    }

    let cashValue = 0;
    for (const account of activeAccounts) {
      if (cashAccountTypes.has(account.type)) {
        const balance = latestSnapshots.get(account._id.toString()) ?? 0;
        cashValue += balance;
      }
    }

    const portfolioValue = investmentValue + cashValue;

    // Calculate current age if profile exists
    let currentAge: number | null = null;
    let retirementAge: number | null = null;
    if (profile) {
      currentAge = profile.currentAge;
      const retireDate = new Date(profile.retirementDate);
      const now = new Date();
      const yearsUntil =
        (retireDate.getTime() - now.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      retirementAge = Math.round(currentAge + yearsUntil);
    }

    // Calculate Social Security claiming details
    let socialSecurityInput = null;
    if (ss && profile) {
      const claimingAge = ss.plannedClaimingAge ?? 67;
      const retirementAgeActual = retirementAge ?? 65;

      // Years from retirement until SS starts
      const ssStartYear = Math.max(0, claimingAge - retirementAgeActual);

      // Calculate benefit at claiming age (simplified - use stored value)
      let monthlyBenefit = ss.benefitAt67;
      if (claimingAge === 62) monthlyBenefit = ss.benefitAt62;
      if (claimingAge === 70) monthlyBenefit = ss.benefitAt70;

      socialSecurityInput = {
        startYear: ssStartYear,
        annualAmount: Math.round(monthlyBenefit * 12),
        claimingAge,
      };
    }

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

    return {
      // Portfolio
      portfolioValue,
      investmentValue,
      cashValue,

      // Profile
      currentAge,
      retirementAge,
      annualSpending: profile?.annualSpending ?? 0,

      // Monte Carlo assumptions
      realReturn: assumptions?.realReturn ?? MONTE_CARLO_DEFAULTS.realReturn,
      volatility: assumptions?.volatility ?? MONTE_CARLO_DEFAULTS.volatility,
      planToAge: assumptions?.planToAge ?? MONTE_CARLO_DEFAULTS.planToAge,
      targetSuccessRate:
        assumptions?.targetSuccessRate ?? MONTE_CARLO_DEFAULTS.targetSuccessRate,
      iterations: assumptions?.iterations ?? MONTE_CARLO_DEFAULTS.iterations,

      // Part-time work (if configured)
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
      essentialFloor: guardrails?.spendingFloor,

      // Validation
      isReady:
        portfolioValue > 0 &&
        currentAge !== null &&
        retirementAge !== null &&
        (profile?.annualSpending ?? 0) > 0,
      missingInputs: [
        portfolioValue <= 0 ? "portfolio value" : null,
        currentAge === null ? "current age" : null,
        retirementAge === null ? "retirement age" : null,
        (profile?.annualSpending ?? 0) <= 0 ? "annual spending" : null,
      ].filter(Boolean) as string[],
    };
  },
});

/**
 * Check for cached simulation results.
 * Returns cached results if:
 * 1. Inputs hash matches (key inputs haven't changed)
 * 2. Cache hasn't expired (24 hour TTL)
 */
export const getCachedResults = query({
  args: {},
  handler: async (ctx) => {
    // First, get current inputs to generate hash
    const assumptions = await ctx.db.query("monteCarloAssumptions").first();
    const profile = await ctx.db.query("retirementProfile").first();
    const ss = await ctx.db.query("socialSecurity").first();
    const guardrails = await ctx.db.query("guardrailsConfig").first();

    // Calculate portfolio value (simplified)
    const holdings = await ctx.db.query("holdings").collect();
    let portfolioValue = 0;
    for (const holding of holdings) {
      const price = holding.lastPrice ?? 0;
      portfolioValue += holding.shares * price;
    }

    // Calculate retirement age
    let retirementAge: number | null = null;
    if (profile) {
      const retireDate = new Date(profile.retirementDate);
      const now = new Date();
      const yearsUntil =
        (retireDate.getTime() - now.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      retirementAge = Math.round(profile.currentAge + yearsUntil);
    }

    // Generate hash from current inputs
    const inputsHash = generateInputsHash({
      portfolioValue,
      annualSpending: profile?.annualSpending ?? 0,
      retirementAge,
      planToAge: assumptions?.planToAge ?? 95,
      realReturn: assumptions?.realReturn ?? 0.05,
      volatility: assumptions?.volatility ?? 0.12,
      socialSecurityAmount: ss
        ? (ss.plannedClaimingAge === 62
            ? ss.benefitAt62
            : ss.plannedClaimingAge === 70
              ? ss.benefitAt70
              : ss.benefitAt67) * 12
        : null,
      guardrailsEnabled: guardrails?.isEnabled ?? false,
    });

    // Look up cached results
    const cached = await ctx.db
      .query("monteCarloCache")
      .withIndex("by_hash", (q) => q.eq("inputsHash", inputsHash))
      .first();

    if (!cached) {
      return null;
    }

    // Check if expired
    if (cached.expiresAt < Date.now()) {
      return null;
    }

    return {
      ...cached.results,
      cachedAt: cached.createdAt,
      inputsHash,
    };
  },
});

/**
 * Generate an inputs hash for caching purposes.
 * This is exported so the UI can compare hashes.
 */
export const getInputsHash = query({
  args: {},
  handler: async (ctx) => {
    const assumptions = await ctx.db.query("monteCarloAssumptions").first();
    const profile = await ctx.db.query("retirementProfile").first();
    const ss = await ctx.db.query("socialSecurity").first();
    const guardrails = await ctx.db.query("guardrailsConfig").first();

    const holdings = await ctx.db.query("holdings").collect();
    let portfolioValue = 0;
    for (const holding of holdings) {
      const price = holding.lastPrice ?? 0;
      portfolioValue += holding.shares * price;
    }

    let retirementAge: number | null = null;
    if (profile) {
      const retireDate = new Date(profile.retirementDate);
      const now = new Date();
      const yearsUntil =
        (retireDate.getTime() - now.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      retirementAge = Math.round(profile.currentAge + yearsUntil);
    }

    return generateInputsHash({
      portfolioValue,
      annualSpending: profile?.annualSpending ?? 0,
      retirementAge,
      planToAge: assumptions?.planToAge ?? 95,
      realReturn: assumptions?.realReturn ?? 0.05,
      volatility: assumptions?.volatility ?? 0.12,
      socialSecurityAmount: ss
        ? (ss.plannedClaimingAge === 62
            ? ss.benefitAt62
            : ss.plannedClaimingAge === 70
              ? ss.benefitAt70
              : ss.benefitAt67) * 12
        : null,
      guardrailsEnabled: guardrails?.isEnabled ?? false,
    });
  },
});
