import { mutation } from "../_generated/server";
import { v } from "convex/values";

const assetClassValidator = v.union(
  v.literal("us_stock"),
  v.literal("intl_stock"),
  v.literal("bond"),
  v.literal("cash"),
  v.literal("real_estate"),
  v.literal("other")
);

// Set all allocation targets at once (validates sum = 100%)
export const setAllTargets = mutation({
  args: {
    accountId: v.optional(v.id("accounts")),
    targets: v.array(
      v.object({
        assetClass: assetClassValidator,
        targetPercent: v.number(),
        rebalanceThreshold: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    // Validate that percentages sum to 100% (or close to it due to floating point)
    const totalPercent = args.targets.reduce(
      (sum, t) => sum + t.targetPercent,
      0
    );
    if (Math.abs(totalPercent - 1) > 0.001) {
      throw new Error(
        `Target percentages must sum to 100%. Current sum: ${(totalPercent * 100).toFixed(1)}%`
      );
    }

    // Validate each target
    for (const target of args.targets) {
      if (target.targetPercent < 0 || target.targetPercent > 1) {
        throw new Error(
          `Invalid target percentage for ${target.assetClass}: must be between 0 and 100%`
        );
      }
      if (target.rebalanceThreshold < 0 || target.rebalanceThreshold > 1) {
        throw new Error(
          `Invalid threshold for ${target.assetClass}: must be between 0 and 100%`
        );
      }
    }

    // If accountId provided, verify account exists
    if (args.accountId) {
      const account = await ctx.db.get(args.accountId);
      if (!account) {
        throw new Error("Account not found");
      }
    }

    // Delete existing targets for this account (or global)
    const existingTargets = await ctx.db
      .query("allocationTargets")
      .withIndex("by_account", (q) => q.eq("accountId", args.accountId))
      .collect();

    for (const existing of existingTargets) {
      await ctx.db.delete(existing._id);
    }

    // Insert new targets
    const insertedIds = [];
    for (const target of args.targets) {
      const id = await ctx.db.insert("allocationTargets", {
        accountId: args.accountId,
        assetClass: target.assetClass,
        targetPercent: target.targetPercent,
        rebalanceThreshold: target.rebalanceThreshold,
      });
      insertedIds.push(id);
    }

    return {
      success: true,
      count: insertedIds.length,
    };
  },
});

// Delete account-specific targets (reverts to global defaults)
export const deleteAccountTargets = mutation({
  args: {
    accountId: v.id("accounts"),
  },
  handler: async (ctx, args) => {
    const targets = await ctx.db
      .query("allocationTargets")
      .withIndex("by_account", (q) => q.eq("accountId", args.accountId))
      .collect();

    for (const target of targets) {
      await ctx.db.delete(target._id);
    }

    return {
      success: true,
      deleted: targets.length,
    };
  },
});
