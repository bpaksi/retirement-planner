import { mutation } from "../_generated/server";
import { v } from "convex/values";

export const upsert = mutation({
  args: {
    retirementDate: v.number(),
    currentAge: v.number(),
    annualSpending: v.number(),
    isSpendingAutoCalculated: v.boolean(),
  },
  handler: async (ctx, args) => {
    // Check if a profile already exists
    const existing = await ctx.db.query("retirementProfile").first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        retirementDate: args.retirementDate,
        currentAge: args.currentAge,
        annualSpending: args.annualSpending,
        isSpendingAutoCalculated: args.isSpendingAutoCalculated,
      });
      return existing._id;
    }

    // Create new profile
    return await ctx.db.insert("retirementProfile", {
      retirementDate: args.retirementDate,
      currentAge: args.currentAge,
      annualSpending: args.annualSpending,
      isSpendingAutoCalculated: args.isSpendingAutoCalculated,
    });
  },
});
