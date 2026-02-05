'use server';

import { db } from '@/db';
import { monteCarloAssumptions, monteCarloCache } from '@/db/schema';
import { eq, lt } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import {
  runMonteCarloSimulations,
  findMaxWithdrawal,
  type SimulationInput,
  type AggregatedResults,
  type MaxWithdrawalResult,
} from '@/lib/calculations/monteCarlo';
import { getSimulationInputs, getInputsHash } from '@/db/queries/monteCarlo';

export type UpsertMonteCarloAssumptionsInput = {
  realReturn: number;
  volatility: number;
  planToAge: number;
  targetSuccessRate: number;
  iterations?: number;
  partTimeAnnualIncome?: number;
  partTimeYears?: number;
  legacyTarget?: number;
};

export async function upsertMonteCarloAssumptions(input: UpsertMonteCarloAssumptionsInput) {
  const existing = db.select().from(monteCarloAssumptions).get();

  if (existing) {
    db.update(monteCarloAssumptions)
      .set({
        ...input,
        updatedAt: Date.now(),
      })
      .where(eq(monteCarloAssumptions.id, existing.id))
      .run();

    revalidatePath('/projections');
    return existing.id;
  } else {
    const result = db.insert(monteCarloAssumptions).values({
      ...input,
      updatedAt: Date.now(),
    }).returning().get();

    revalidatePath('/projections');
    return result.id;
  }
}

export async function runSimulation(): Promise<AggregatedResults & { cachedAt?: number }> {
  const inputs = getSimulationInputs();

  if (!inputs.isReady) {
    throw new Error(`Missing inputs: ${inputs.missingInputs.join(', ')}`);
  }

  // Check cache first
  const inputsHash = getInputsHash();
  const cached = db.select()
    .from(monteCarloCache)
    .where(eq(monteCarloCache.inputsHash, inputsHash))
    .get();

  if (cached && cached.expiresAt > Date.now()) {
    return {
      ...cached.results,
      cachedAt: cached.createdAt,
    };
  }

  // Build simulation inputs
  const simulationInputs: SimulationInput = {
    startingPortfolio: inputs.portfolioValue,
    annualSpending: inputs.totalAnnualSpending,
    years: inputs.planToAge - (inputs.retirementAge ?? 65),
    realReturn: inputs.realReturn,
    volatility: inputs.volatility,
    essentialFloor: inputs.simulationEssentialFloor,
    spendingCeiling: inputs.spendingCeiling ?? undefined,
    socialSecurity: inputs.socialSecurity ? {
      startYear: inputs.socialSecurity.startYear,
      annualAmount: inputs.socialSecurity.annualAmount,
    } : undefined,
    guardrails: inputs.guardrails ? {
      enabled: inputs.guardrails.enabled,
      upperThreshold: inputs.guardrails.upperThreshold,
      lowerThreshold: inputs.guardrails.lowerThreshold,
      increasePercent: inputs.guardrails.increasePercent,
      decreasePercent: inputs.guardrails.decreasePercent,
    } : undefined,
  };

  // Run simulation
  const results = runMonteCarloSimulations(simulationInputs, inputs.iterations);

  // Cache results (24 hour TTL)
  const now = Date.now();
  const expiresAt = now + 24 * 60 * 60 * 1000;

  if (cached) {
    db.update(monteCarloCache)
      .set({
        results,
        createdAt: now,
        expiresAt,
      })
      .where(eq(monteCarloCache.id, cached.id))
      .run();
  } else {
    db.insert(monteCarloCache).values({
      inputsHash,
      results,
      createdAt: now,
      expiresAt,
    }).run();
  }

  // Clean up expired cache entries
  db.delete(monteCarloCache)
    .where(lt(monteCarloCache.expiresAt, now))
    .run();

  revalidatePath('/projections');
  return results;
}

export async function runWhatIfSimulation(overrides: Partial<SimulationInput>): Promise<AggregatedResults> {
  const inputs = getSimulationInputs();

  if (!inputs.isReady) {
    throw new Error(`Missing inputs: ${inputs.missingInputs.join(', ')}`);
  }

  const simulationInputs: SimulationInput = {
    startingPortfolio: overrides.startingPortfolio ?? inputs.portfolioValue,
    annualSpending: overrides.annualSpending ?? inputs.totalAnnualSpending,
    years: overrides.years ?? (inputs.planToAge - (inputs.retirementAge ?? 65)),
    realReturn: overrides.realReturn ?? inputs.realReturn,
    volatility: overrides.volatility ?? inputs.volatility,
    essentialFloor: overrides.essentialFloor ?? inputs.simulationEssentialFloor,
    spendingCeiling: overrides.spendingCeiling ?? inputs.spendingCeiling ?? undefined,
    socialSecurity: overrides.socialSecurity ?? (inputs.socialSecurity ? {
      startYear: inputs.socialSecurity.startYear,
      annualAmount: inputs.socialSecurity.annualAmount,
    } : undefined),
    guardrails: overrides.guardrails ?? (inputs.guardrails ? {
      enabled: inputs.guardrails.enabled,
      upperThreshold: inputs.guardrails.upperThreshold,
      lowerThreshold: inputs.guardrails.lowerThreshold,
      increasePercent: inputs.guardrails.increasePercent,
      decreasePercent: inputs.guardrails.decreasePercent,
    } : undefined),
  };

  // Don't cache what-if simulations
  return runMonteCarloSimulations(simulationInputs, inputs.iterations);
}

export async function findMaxSafeWithdrawal(targetSuccessRate = 0.9): Promise<MaxWithdrawalResult> {
  const inputs = getSimulationInputs();

  if (!inputs.isReady) {
    throw new Error(`Missing inputs: ${inputs.missingInputs.join(', ')}`);
  }

  const simulationInputs: Omit<SimulationInput, 'annualSpending'> = {
    startingPortfolio: inputs.portfolioValue,
    years: inputs.planToAge - (inputs.retirementAge ?? 65),
    realReturn: inputs.realReturn,
    volatility: inputs.volatility,
    essentialFloor: inputs.simulationEssentialFloor,
    socialSecurity: inputs.socialSecurity ? {
      startYear: inputs.socialSecurity.startYear,
      annualAmount: inputs.socialSecurity.annualAmount,
    } : undefined,
    guardrails: inputs.guardrails ? {
      enabled: inputs.guardrails.enabled,
      upperThreshold: inputs.guardrails.upperThreshold,
      lowerThreshold: inputs.guardrails.lowerThreshold,
      increasePercent: inputs.guardrails.increasePercent,
      decreasePercent: inputs.guardrails.decreasePercent,
    } : undefined,
  };

  return findMaxWithdrawal(simulationInputs, targetSuccessRate);
}

export async function clearMonteCarloCache() {
  db.delete(monteCarloCache).run();
  revalidatePath('/projections');
}
