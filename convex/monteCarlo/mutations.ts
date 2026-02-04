import { mutation } from "../_generated/server";
import { v } from "convex/values";

/**
 * Save or update Monte Carlo assumptions.
 */
export const upsertAssumptions = mutation({
  args: {
    realReturn: v.number(),
    volatility: v.number(),
    planToAge: v.number(),
    targetSuccessRate: v.number(),
    iterations: v.optional(v.number()),
    partTimeAnnualIncome: v.optional(v.number()),
    partTimeYears: v.optional(v.number()),
    legacyTarget: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Validate inputs
    if (args.realReturn < -0.1 || args.realReturn > 0.2) {
      throw new Error("Real return should be between -10% and 20%");
    }
    if (args.volatility < 0 || args.volatility > 0.5) {
      throw new Error("Volatility should be between 0% and 50%");
    }
    if (args.planToAge < 70 || args.planToAge > 120) {
      throw new Error("Plan to age should be between 70 and 120");
    }
    if (args.targetSuccessRate < 0.5 || args.targetSuccessRate > 0.99) {
      throw new Error("Target success rate should be between 50% and 99%");
    }

    const existing = await ctx.db.query("monteCarloAssumptions").first();

    const data = {
      realReturn: args.realReturn,
      volatility: args.volatility,
      planToAge: args.planToAge,
      targetSuccessRate: args.targetSuccessRate,
      iterations: args.iterations,
      partTimeAnnualIncome: args.partTimeAnnualIncome,
      partTimeYears: args.partTimeYears,
      legacyTarget: args.legacyTarget,
      updatedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, data);
      return existing._id;
    }

    return await ctx.db.insert("monteCarloAssumptions", data);
  },
});

/**
 * Update just the return assumptions.
 */
export const updateReturnAssumptions = mutation({
  args: {
    realReturn: v.number(),
    volatility: v.number(),
  },
  handler: async (ctx, args) => {
    if (args.realReturn < -0.1 || args.realReturn > 0.2) {
      throw new Error("Real return should be between -10% and 20%");
    }
    if (args.volatility < 0 || args.volatility > 0.5) {
      throw new Error("Volatility should be between 0% and 50%");
    }

    const existing = await ctx.db.query("monteCarloAssumptions").first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        realReturn: args.realReturn,
        volatility: args.volatility,
        updatedAt: Date.now(),
      });
      return existing._id;
    }

    // Create with defaults
    return await ctx.db.insert("monteCarloAssumptions", {
      realReturn: args.realReturn,
      volatility: args.volatility,
      planToAge: 95,
      targetSuccessRate: 0.9,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Update the planning horizon.
 */
export const updatePlanToAge = mutation({
  args: {
    planToAge: v.number(),
  },
  handler: async (ctx, args) => {
    if (args.planToAge < 70 || args.planToAge > 120) {
      throw new Error("Plan to age should be between 70 and 120");
    }

    const existing = await ctx.db.query("monteCarloAssumptions").first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        planToAge: args.planToAge,
        updatedAt: Date.now(),
      });
      return existing._id;
    }

    // Create with defaults
    return await ctx.db.insert("monteCarloAssumptions", {
      realReturn: 0.05,
      volatility: 0.12,
      planToAge: args.planToAge,
      targetSuccessRate: 0.9,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Update target success rate.
 */
export const updateTargetSuccessRate = mutation({
  args: {
    targetSuccessRate: v.number(),
  },
  handler: async (ctx, args) => {
    if (args.targetSuccessRate < 0.5 || args.targetSuccessRate > 0.99) {
      throw new Error("Target success rate should be between 50% and 99%");
    }

    const existing = await ctx.db.query("monteCarloAssumptions").first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        targetSuccessRate: args.targetSuccessRate,
        updatedAt: Date.now(),
      });
      return existing._id;
    }

    // Create with defaults
    return await ctx.db.insert("monteCarloAssumptions", {
      realReturn: 0.05,
      volatility: 0.12,
      planToAge: 95,
      targetSuccessRate: args.targetSuccessRate,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Update part-time work assumptions.
 */
export const updatePartTimeWork = mutation({
  args: {
    partTimeAnnualIncome: v.optional(v.number()),
    partTimeYears: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("monteCarloAssumptions").first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        partTimeAnnualIncome: args.partTimeAnnualIncome,
        partTimeYears: args.partTimeYears,
        updatedAt: Date.now(),
      });
      return existing._id;
    }

    // Create with defaults
    return await ctx.db.insert("monteCarloAssumptions", {
      realReturn: 0.05,
      volatility: 0.12,
      planToAge: 95,
      targetSuccessRate: 0.9,
      partTimeAnnualIncome: args.partTimeAnnualIncome,
      partTimeYears: args.partTimeYears,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Update legacy target.
 */
export const updateLegacyTarget = mutation({
  args: {
    legacyTarget: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("monteCarloAssumptions").first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        legacyTarget: args.legacyTarget,
        updatedAt: Date.now(),
      });
      return existing._id;
    }

    // Create with defaults
    return await ctx.db.insert("monteCarloAssumptions", {
      realReturn: 0.05,
      volatility: 0.12,
      planToAge: 95,
      targetSuccessRate: 0.9,
      legacyTarget: args.legacyTarget,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Reset to defaults.
 */
export const resetToDefaults = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("monteCarloAssumptions").first();

    const defaults = {
      realReturn: 0.05,
      volatility: 0.12,
      planToAge: 95,
      targetSuccessRate: 0.9,
      iterations: 1000,
      partTimeAnnualIncome: undefined,
      partTimeYears: undefined,
      legacyTarget: undefined,
      updatedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, defaults);
      return existing._id;
    }

    return await ctx.db.insert("monteCarloAssumptions", defaults);
  },
});

// ============================================
// CACHE MUTATIONS
// ============================================

/**
 * Save simulation results to cache.
 */
export const saveToCache = mutation({
  args: {
    inputsHash: v.string(),
    results: v.object({
      successRate: v.number(),
      iterations: v.number(),
      success: v.object({
        count: v.number(),
        medianEndingBalance: v.number(),
        p10EndingBalance: v.number(),
        p90EndingBalance: v.number(),
      }),
      failure: v.object({
        count: v.number(),
        averageYearsLasted: v.number(),
        medianYearsLasted: v.number(),
        worstCase: v.number(),
      }),
      maxWithdrawal: v.optional(
        v.object({
          amount: v.number(),
          rate: v.number(),
        })
      ),
    }),
  },
  handler: async (ctx, args) => {
    // Delete any existing cache for this hash
    const existing = await ctx.db
      .query("monteCarloCache")
      .withIndex("by_hash", (q) => q.eq("inputsHash", args.inputsHash))
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
    }

    // Also clean up expired entries (limit to 10 to avoid slow mutations)
    const expired = await ctx.db
      .query("monteCarloCache")
      .filter((q) => q.lt(q.field("expiresAt"), Date.now()))
      .take(10);

    for (const entry of expired) {
      await ctx.db.delete(entry._id);
    }

    // Save new cache entry (24 hour TTL)
    const CACHE_TTL = 24 * 60 * 60 * 1000;

    return await ctx.db.insert("monteCarloCache", {
      inputsHash: args.inputsHash,
      results: args.results,
      createdAt: Date.now(),
      expiresAt: Date.now() + CACHE_TTL,
    });
  },
});

/**
 * Clear all cached simulation results.
 */
export const clearCache = mutation({
  args: {},
  handler: async (ctx) => {
    const allCached = await ctx.db.query("monteCarloCache").collect();

    for (const entry of allCached) {
      await ctx.db.delete(entry._id);
    }

    return { deleted: allCached.length };
  },
});
