import { query } from "../_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const budgets = await ctx.db.query("annualBudgets").collect();
    // Sort by amount (largest first)
    return budgets.sort((a, b) => b.annualAmount - a.annualAmount);
  },
});

export const get = query({
  args: { id: v.id("annualBudgets") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Get total annual budgets for a specific year
export const getTotalForYear = query({
  args: { year: v.number() },
  handler: async (ctx, args) => {
    const budgets = await ctx.db.query("annualBudgets").collect();

    let total = 0;
    const activeBudgets: Array<{
      name: string;
      amount: number;
    }> = [];

    for (const budget of budgets) {
      // Check if budget is active during this year
      const startsBeforeOrDuringYear = !budget.startYear || budget.startYear <= args.year;
      const endsAfterOrDuringYear = !budget.endYear || budget.endYear >= args.year;

      if (startsBeforeOrDuringYear && endsAfterOrDuringYear) {
        total += budget.annualAmount;
        activeBudgets.push({
          name: budget.name,
          amount: budget.annualAmount,
        });
      }
    }

    return {
      total,
      budgets: activeBudgets,
      year: args.year,
    };
  },
});

// Get all budgets that will be active during retirement
export const getActiveInRetirement = query({
  args: {
    retirementYear: v.number(),
  },
  handler: async (ctx, args) => {
    const budgets = await ctx.db.query("annualBudgets").collect();

    return budgets.filter((budget) => {
      // If no end year, include it
      if (!budget.endYear) return true;

      // If ends after retirement starts, include it
      return budget.endYear >= args.retirementYear;
    });
  },
});
