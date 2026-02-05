"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";
import {
  runMonteCarloSimulations,
  findMaxWithdrawal,
  SimulationInput,
  AggregatedResults,
  MaxWithdrawalResult,
} from "./engine";

/**
 * Run a Monte Carlo simulation using saved assumptions and current portfolio.
 *
 * Performance: ~13ms for 1,000 iterations, ~130ms for 10,000
 * Caching: Results are cached for 24 hours when inputs don't change.
 */
export const runSimulation = action({
  args: {
    iterations: v.optional(v.number()),
    skipCache: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<AggregatedResults & {
    inputs: Record<string, unknown>;
    fromCache?: boolean;
    cachedAt?: number;
  }> => {
    // Get all simulation inputs from the database
    const inputs = await ctx.runQuery(api.monteCarlo.queries.getSimulationInputs);

    if (!inputs.isReady) {
      throw new Error(
        `Missing required inputs: ${inputs.missingInputs.join(", ")}`
      );
    }

    // Check cache unless explicitly skipped
    if (!args.skipCache) {
      const cached = await ctx.runQuery(api.monteCarlo.queries.getCachedResults);
      if (cached && cached.successRate !== undefined) {
        // Return cached results
        return {
          successRate: cached.successRate,
          iterations: cached.iterations,
          success: cached.success,
          failure: cached.failure,
          risk: {
            averageLowestBalance: 0,
            percentHittingFloor: 0,
            guardrailTriggerStats: { ceilingTriggerPercent: 0, floorTriggerPercent: 0 },
          },
          samplePaths: [], // Don't cache full paths to save storage
          inputs: {
            portfolioValue: inputs.portfolioValue,
            annualSpending: inputs.annualSpending,
            years: inputs.planToAge - (inputs.retirementAge ?? 65),
            realReturn: inputs.realReturn,
            volatility: inputs.volatility,
            retirementAge: inputs.retirementAge,
            planToAge: inputs.planToAge,
            hasSocialSecurity: !!inputs.socialSecurity,
            hasGuardrails: !!inputs.guardrails,
            hasPartTimeWork: !!inputs.partTimeWork,
          },
          fromCache: true,
          cachedAt: cached.cachedAt,
        };
      }
    }

    // Calculate years in retirement
    const years = inputs.planToAge - (inputs.retirementAge ?? 65);

    // Build simulation input with spending breakdown
    const simulationInput: SimulationInput = {
      startingPortfolio: inputs.portfolioValue,
      // NEW: Use spending breakdown
      baseLivingExpense: inputs.baseLivingExpense,
      goals: inputs.goals?.map((g) => ({
        annualAmount: g.annualAmount,
        isEssential: g.isEssential,
        startYear: g.startYear,
        endYear: g.endYear,
      })),
      years,
      realReturn: inputs.realReturn,
      volatility: inputs.volatility,
      socialSecurity: inputs.socialSecurity
        ? {
            startYear: inputs.socialSecurity.startYear,
            annualAmount: inputs.socialSecurity.annualAmount,
          }
        : undefined,
      partTimeWork: inputs.partTimeWork
        ? {
            income: inputs.partTimeWork.income,
            years: inputs.partTimeWork.years,
          }
        : undefined,
      // Use calculated essential floor (base + essential goals) or manual override
      essentialFloor: inputs.simulationEssentialFloor,
      spendingCeiling: inputs.spendingCeiling,
      guardrails: inputs.guardrails ?? undefined,
    };

    // Run simulation
    const iterations = args.iterations ?? inputs.iterations;
    const results = runMonteCarloSimulations(simulationInput, iterations);

    // Save to cache
    const inputsHash = await ctx.runQuery(api.monteCarlo.queries.getInputsHash);
    await ctx.runMutation(api.monteCarlo.mutations.saveToCache, {
      inputsHash,
      results: {
        successRate: results.successRate,
        iterations: results.iterations,
        success: results.success,
        failure: results.failure,
      },
    });

    // Return results with input summary (including spending breakdown)
    return {
      ...results,
      inputs: {
        portfolioValue: inputs.portfolioValue,
        // Spending breakdown
        baseLivingExpense: inputs.baseLivingExpense,
        totalGoalsAmount: inputs.totalGoalsAmount,
        essentialFloor: inputs.essentialFloor,
        discretionaryAmount: inputs.discretionaryAmount,
        totalAnnualSpending: inputs.totalAnnualSpending,
        // Legacy
        annualSpending: inputs.annualSpending,
        years,
        realReturn: inputs.realReturn,
        volatility: inputs.volatility,
        retirementAge: inputs.retirementAge,
        planToAge: inputs.planToAge,
        hasSocialSecurity: !!inputs.socialSecurity,
        hasGuardrails: !!inputs.guardrails,
        hasPartTimeWork: !!inputs.partTimeWork,
        goalsCount: inputs.goals?.length ?? 0,
      },
      fromCache: false,
    };
  },
});

/**
 * Find the maximum sustainable withdrawal at the target success rate.
 *
 * Uses binary search - typically completes in ~50ms.
 * Caches result alongside simulation results.
 */
export const findMaxSustainableWithdrawal = action({
  args: {
    targetSuccessRate: v.optional(v.number()),
    skipCache: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<MaxWithdrawalResult & {
    comparison: Record<string, unknown>;
    fromCache?: boolean;
  }> => {
    // Get all simulation inputs from the database
    const inputs = await ctx.runQuery(api.monteCarlo.queries.getSimulationInputs);

    if (!inputs.isReady) {
      throw new Error(
        `Missing required inputs: ${inputs.missingInputs.join(", ")}`
      );
    }

    // Check cache for max withdrawal
    if (!args.skipCache) {
      const cached = await ctx.runQuery(api.monteCarlo.queries.getCachedResults);
      if (cached?.maxWithdrawal) {
        const currentSpending = inputs.annualSpending;
        const difference = cached.maxWithdrawal.amount - currentSpending;
        const percentDifference = (difference / currentSpending) * 100;

        return {
          maxWithdrawal: cached.maxWithdrawal.amount,
          monthlyAmount: Math.round(cached.maxWithdrawal.amount / 12),
          withdrawalRate: cached.maxWithdrawal.rate,
          successRate: cached.successRate,
          targetSuccessRate: inputs.targetSuccessRate,
          searchIterations: 0,
          comparison: {
            currentSpending,
            maxSustainableSpending: cached.maxWithdrawal.amount,
            difference,
            percentDifference: Math.round(percentDifference * 10) / 10,
            canAffordCurrentSpending: cached.maxWithdrawal.amount >= currentSpending,
            currentWithdrawalRate: currentSpending / inputs.portfolioValue,
          },
          fromCache: true,
        };
      }
    }

    const targetSuccessRate = args.targetSuccessRate ?? inputs.targetSuccessRate;
    const years = inputs.planToAge - (inputs.retirementAge ?? 65);

    // Build base input (without spending - solver will find optimal)
    // Note: For max withdrawal, we use baseLivingExpense as the starting point
    // and let the solver find the maximum total spending
    const baseInput: Omit<SimulationInput, "annualSpending"> = {
      startingPortfolio: inputs.portfolioValue,
      baseLivingExpense: inputs.baseLivingExpense,
      goals: inputs.goals?.map((g) => ({
        annualAmount: g.annualAmount,
        isEssential: g.isEssential,
        startYear: g.startYear,
        endYear: g.endYear,
      })),
      years,
      realReturn: inputs.realReturn,
      volatility: inputs.volatility,
      socialSecurity: inputs.socialSecurity
        ? {
            startYear: inputs.socialSecurity.startYear,
            annualAmount: inputs.socialSecurity.annualAmount,
          }
        : undefined,
      partTimeWork: inputs.partTimeWork
        ? {
            income: inputs.partTimeWork.income,
            years: inputs.partTimeWork.years,
          }
        : undefined,
      essentialFloor: inputs.simulationEssentialFloor,
      spendingCeiling: inputs.spendingCeiling,
      guardrails: inputs.guardrails ?? undefined,
    };

    // Find max withdrawal
    const result = findMaxWithdrawal(baseInput, targetSuccessRate);

    // Update cache with max withdrawal result
    const inputsHash = await ctx.runQuery(api.monteCarlo.queries.getInputsHash);
    const existingCache = await ctx.runQuery(api.monteCarlo.queries.getCachedResults);

    if (existingCache && existingCache.successRate !== undefined) {
      // Update existing cache entry with max withdrawal
      await ctx.runMutation(api.monteCarlo.mutations.saveToCache, {
        inputsHash,
        results: {
          successRate: existingCache.successRate,
          iterations: existingCache.iterations,
          success: existingCache.success,
          failure: existingCache.failure,
          maxWithdrawal: {
            amount: result.maxWithdrawal,
            rate: result.withdrawalRate,
          },
        },
      });
    }

    // Compare to current spending
    const currentSpending = inputs.annualSpending;
    const difference = result.maxWithdrawal - currentSpending;
    const percentDifference = (difference / currentSpending) * 100;

    return {
      ...result,
      comparison: {
        currentSpending,
        maxSustainableSpending: result.maxWithdrawal,
        difference,
        percentDifference: Math.round(percentDifference * 10) / 10,
        canAffordCurrentSpending: result.maxWithdrawal >= currentSpending,
        currentWithdrawalRate: currentSpending / inputs.portfolioValue,
      },
      fromCache: false,
    };
  },
});

/**
 * Run a what-if simulation with custom parameters.
 * Useful for comparing scenarios without saving changes.
 */
export const runWhatIfSimulation = action({
  args: {
    // Override any of the saved values
    annualSpending: v.optional(v.number()),
    retirementAge: v.optional(v.number()),
    planToAge: v.optional(v.number()),
    realReturn: v.optional(v.number()),
    volatility: v.optional(v.number()),
    ssClaimingAge: v.optional(v.number()),
    partTimeIncome: v.optional(v.number()),
    partTimeYears: v.optional(v.number()),
    guardrailsEnabled: v.optional(v.boolean()),
    iterations: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<AggregatedResults & {
    scenario: Record<string, unknown>;
    changesFromBaseline: string[];
  }> => {
    // Get baseline inputs from the database
    const inputs = await ctx.runQuery(api.monteCarlo.queries.getSimulationInputs);

    if (inputs.portfolioValue <= 0) {
      throw new Error("No portfolio value found");
    }

    // Track what changed from baseline
    const changes: string[] = [];

    // Apply overrides
    const annualSpending = args.annualSpending ?? inputs.annualSpending;
    if (args.annualSpending && args.annualSpending !== inputs.annualSpending) {
      changes.push(`Spending: $${inputs.annualSpending.toLocaleString()} → $${args.annualSpending.toLocaleString()}`);
    }

    const retirementAge = args.retirementAge ?? inputs.retirementAge ?? 65;
    if (args.retirementAge && args.retirementAge !== inputs.retirementAge) {
      changes.push(`Retirement age: ${inputs.retirementAge} → ${args.retirementAge}`);
    }

    const planToAge = args.planToAge ?? inputs.planToAge;
    if (args.planToAge && args.planToAge !== inputs.planToAge) {
      changes.push(`Plan to age: ${inputs.planToAge} → ${args.planToAge}`);
    }

    const realReturn = args.realReturn ?? inputs.realReturn;
    if (args.realReturn && args.realReturn !== inputs.realReturn) {
      changes.push(`Real return: ${(inputs.realReturn * 100).toFixed(1)}% → ${(args.realReturn * 100).toFixed(1)}%`);
    }

    const volatility = args.volatility ?? inputs.volatility;
    if (args.volatility && args.volatility !== inputs.volatility) {
      changes.push(`Volatility: ${(inputs.volatility * 100).toFixed(1)}% → ${(args.volatility * 100).toFixed(1)}%`);
    }

    // Handle Social Security override
    let socialSecurity = inputs.socialSecurity;
    if (args.ssClaimingAge !== undefined && inputs.socialSecurity) {
      const ssStartYear = Math.max(0, args.ssClaimingAge - retirementAge);
      socialSecurity = {
        ...inputs.socialSecurity,
        startYear: ssStartYear,
      };
      changes.push(`SS claiming age: ${inputs.socialSecurity.claimingAge} → ${args.ssClaimingAge}`);
    }

    // Handle part-time work override
    let partTimeWork = inputs.partTimeWork;
    if (args.partTimeIncome !== undefined || args.partTimeYears !== undefined) {
      partTimeWork = {
        income: args.partTimeIncome ?? inputs.partTimeWork?.income ?? 0,
        years: args.partTimeYears ?? inputs.partTimeWork?.years ?? 0,
      };
      if (partTimeWork.income > 0 && partTimeWork.years > 0) {
        changes.push(`Part-time work: $${partTimeWork.income.toLocaleString()}/yr for ${partTimeWork.years} years`);
      }
    }

    // Handle guardrails override
    let guardrails: {
      enabled: boolean;
      upperThreshold: number;
      lowerThreshold: number;
      increasePercent: number;
      decreasePercent: number;
    } | null = inputs.guardrails;
    if (args.guardrailsEnabled !== undefined) {
      if (args.guardrailsEnabled && !inputs.guardrails) {
        // Enable with defaults
        guardrails = {
          enabled: true,
          upperThreshold: 1.2,
          lowerThreshold: 0.8,
          increasePercent: 0.1,
          decreasePercent: 0.1,
        };
        changes.push("Guardrails: disabled → enabled");
      } else if (!args.guardrailsEnabled && inputs.guardrails) {
        guardrails = null;
        changes.push("Guardrails: enabled → disabled");
      }
    }

    const years = planToAge - retirementAge;

    // Calculate effective base living expense for what-if
    // If annualSpending override is provided, use it as base (no goals for what-if)
    // Otherwise use the inputs breakdown
    const baseLivingExpense = args.annualSpending ?? inputs.baseLivingExpense;
    const goals = args.annualSpending
      ? [] // Override means ignore goals
      : inputs.goals?.map((g) => ({
          annualAmount: g.annualAmount,
          isEssential: g.isEssential,
          startYear: g.startYear,
          endYear: g.endYear,
        }));

    // Build simulation input with spending breakdown
    const simulationInput: SimulationInput = {
      startingPortfolio: inputs.portfolioValue,
      baseLivingExpense,
      goals,
      years,
      realReturn,
      volatility,
      socialSecurity: socialSecurity
        ? {
            startYear: socialSecurity.startYear,
            annualAmount: socialSecurity.annualAmount,
          }
        : undefined,
      partTimeWork: partTimeWork && partTimeWork.income > 0
        ? {
            income: partTimeWork.income,
            years: partTimeWork.years,
          }
        : undefined,
      essentialFloor: args.annualSpending
        ? args.annualSpending * 0.7 // Fallback floor for what-if
        : inputs.simulationEssentialFloor,
      spendingCeiling: inputs.spendingCeiling,
      guardrails: guardrails ?? undefined,
    };

    // Run simulation
    const iterations = args.iterations ?? inputs.iterations;
    const results = runMonteCarloSimulations(simulationInput, iterations);

    return {
      ...results,
      scenario: {
        portfolioValue: inputs.portfolioValue,
        baseLivingExpense,
        totalAnnualSpending: baseLivingExpense + (goals?.reduce((s, g) => s + g.annualAmount, 0) ?? 0),
        annualSpending,
        years,
        retirementAge,
        planToAge,
        realReturn,
        volatility,
        hasSocialSecurity: !!socialSecurity,
        hasGuardrails: !!guardrails,
        hasPartTimeWork: !!(partTimeWork && partTimeWork.income > 0),
      },
      changesFromBaseline: changes,
    };
  },
});

/**
 * Run sensitivity analysis to see which inputs matter most.
 */
export const runSensitivityAnalysis = action({
  args: {},
  handler: async (ctx): Promise<{
    baseline: { successRate: number };
    sensitivity: Array<{
      variable: string;
      impact: number;
      lowValue: number;
      lowSuccessRate: number;
      highValue: number;
      highSuccessRate: number;
    }>;
  }> => {
    const inputs = await ctx.runQuery(api.monteCarlo.queries.getSimulationInputs);

    if (!inputs.isReady) {
      throw new Error(
        `Missing required inputs: ${inputs.missingInputs.join(", ")}`
      );
    }

    const years = inputs.planToAge - (inputs.retirementAge ?? 65);

    const baseInput: SimulationInput = {
      startingPortfolio: inputs.portfolioValue,
      baseLivingExpense: inputs.baseLivingExpense,
      goals: inputs.goals?.map((g) => ({
        annualAmount: g.annualAmount,
        isEssential: g.isEssential,
        startYear: g.startYear,
        endYear: g.endYear,
      })),
      years,
      realReturn: inputs.realReturn,
      volatility: inputs.volatility,
      socialSecurity: inputs.socialSecurity
        ? {
            startYear: inputs.socialSecurity.startYear,
            annualAmount: inputs.socialSecurity.annualAmount,
          }
        : undefined,
      essentialFloor: inputs.simulationEssentialFloor,
      spendingCeiling: inputs.spendingCeiling,
      guardrails: inputs.guardrails ?? undefined,
    };

    // Run baseline
    const baseline = runMonteCarloSimulations(baseInput, 1000);

    // Test each variable ±20%
    const variables = [
      {
        name: "Base Spending",
        key: "baseLivingExpense",
        lowMult: 0.8,
        highMult: 1.2,
        format: (v: number) => `$${Math.round(v).toLocaleString()}`,
      },
      {
        name: "Expected Return",
        key: "realReturn",
        lowMult: 0.7,
        highMult: 1.3,
        format: (v: number) => `${(v * 100).toFixed(1)}%`,
      },
      {
        name: "Volatility",
        key: "volatility",
        lowMult: 0.7,
        highMult: 1.3,
        format: (v: number) => `${(v * 100).toFixed(1)}%`,
      },
      {
        name: "Planning Horizon",
        key: "years",
        lowMult: 0.83, // ~5 years shorter
        highMult: 1.17, // ~5 years longer
        format: (v: number) => `${Math.round(v)} years`,
      },
    ];

    const sensitivity = [];

    for (const variable of variables) {
      const baseValue = baseInput[variable.key as keyof SimulationInput] as number;
      const lowValue = baseValue * variable.lowMult;
      const highValue = baseValue * variable.highMult;

      const lowResult = runMonteCarloSimulations(
        { ...baseInput, [variable.key]: lowValue },
        500
      );
      const highResult = runMonteCarloSimulations(
        { ...baseInput, [variable.key]: highValue },
        500
      );

      sensitivity.push({
        variable: variable.name,
        impact: Math.abs(highResult.successRate - lowResult.successRate),
        lowValue,
        lowSuccessRate: lowResult.successRate,
        highValue,
        highSuccessRate: highResult.successRate,
      });
    }

    // Sort by impact (highest first)
    sensitivity.sort((a, b) => b.impact - a.impact);

    return {
      baseline: { successRate: baseline.successRate },
      sensitivity,
    };
  },
});
