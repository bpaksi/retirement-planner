import { mutation } from "../_generated/server";
import { v } from "convex/values";

export const upsert = mutation({
  args: {
    retirementDate: v.number(),
    currentAge: v.number(),
    annualSpending: v.number(),
    isSpendingAutoCalculated: v.boolean(),
    // New: Base living expense (monthly)
    monthlyBaseLivingExpense: v.optional(v.number()),
    isBaseLivingExpenseAutoCalculated: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Check if a profile already exists
    const existing = await ctx.db.query("retirementProfile").first();

    const data = {
      retirementDate: args.retirementDate,
      currentAge: args.currentAge,
      annualSpending: args.annualSpending,
      isSpendingAutoCalculated: args.isSpendingAutoCalculated,
      monthlyBaseLivingExpense: args.monthlyBaseLivingExpense,
      isBaseLivingExpenseAutoCalculated: args.isBaseLivingExpenseAutoCalculated,
    };

    if (existing) {
      await ctx.db.patch(existing._id, data);
      return existing._id;
    }

    // Create new profile
    return await ctx.db.insert("retirementProfile", data);
  },
});

/**
 * Update just the base living expense.
 */
export const updateBaseLivingExpense = mutation({
  args: {
    monthlyBaseLivingExpense: v.number(),
    isBaseLivingExpenseAutoCalculated: v.boolean(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("retirementProfile").first();

    if (!existing) {
      throw new Error("No retirement profile found. Create one first.");
    }

    await ctx.db.patch(existing._id, {
      monthlyBaseLivingExpense: args.monthlyBaseLivingExpense,
      isBaseLivingExpenseAutoCalculated: args.isBaseLivingExpenseAutoCalculated,
    });

    return existing._id;
  },
});
