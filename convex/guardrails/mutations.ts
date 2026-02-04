import { mutation } from "../_generated/server";
import { v } from "convex/values";

export const upsert = mutation({
  args: {
    isEnabled: v.boolean(),
    upperThresholdPercent: v.number(),
    lowerThresholdPercent: v.number(),
    spendingAdjustmentPercent: v.number(),
    strategyType: v.union(v.literal("percentage"), v.literal("fixed")),
    spendingFloor: v.optional(v.number()),
    spendingCeiling: v.optional(v.number()),
    fixedAdjustmentAmount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Check if config already exists
    const existing = await ctx.db.query("guardrailsConfig").first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        isEnabled: args.isEnabled,
        upperThresholdPercent: args.upperThresholdPercent,
        lowerThresholdPercent: args.lowerThresholdPercent,
        spendingAdjustmentPercent: args.spendingAdjustmentPercent,
        strategyType: args.strategyType,
        spendingFloor: args.spendingFloor,
        spendingCeiling: args.spendingCeiling,
        fixedAdjustmentAmount: args.fixedAdjustmentAmount,
        updatedAt: Date.now(),
      });
      return existing._id;
    }

    // Create new config
    return await ctx.db.insert("guardrailsConfig", {
      isEnabled: args.isEnabled,
      upperThresholdPercent: args.upperThresholdPercent,
      lowerThresholdPercent: args.lowerThresholdPercent,
      spendingAdjustmentPercent: args.spendingAdjustmentPercent,
      strategyType: args.strategyType,
      spendingFloor: args.spendingFloor,
      spendingCeiling: args.spendingCeiling,
      fixedAdjustmentAmount: args.fixedAdjustmentAmount,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Update just the essential spending floor.
 * This is the minimum amount needed to cover essential expenses.
 */
export const updateSpendingFloor = mutation({
  args: {
    spendingFloor: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("guardrailsConfig").first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        spendingFloor: args.spendingFloor,
        updatedAt: Date.now(),
      });
      return existing._id;
    }

    // Create with defaults if doesn't exist
    return await ctx.db.insert("guardrailsConfig", {
      isEnabled: false,
      upperThresholdPercent: 0.20,
      lowerThresholdPercent: 0.20,
      spendingAdjustmentPercent: 0.10,
      strategyType: "percentage",
      spendingFloor: args.spendingFloor,
      updatedAt: Date.now(),
    });
  },
});

export const toggleEnabled = mutation({
  args: { isEnabled: v.boolean() },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("guardrailsConfig").first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        isEnabled: args.isEnabled,
        updatedAt: Date.now(),
      });
      return existing._id;
    }

    // Create with defaults if doesn't exist
    return await ctx.db.insert("guardrailsConfig", {
      isEnabled: args.isEnabled,
      upperThresholdPercent: 0.20,
      lowerThresholdPercent: 0.20,
      spendingAdjustmentPercent: 0.10,
      strategyType: "percentage",
      updatedAt: Date.now(),
    });
  },
});
