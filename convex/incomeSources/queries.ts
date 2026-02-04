import { query } from "../_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const sources = await ctx.db.query("incomeSources").collect();
    // Sort by type then by name
    return sources.sort((a, b) => {
      if (a.type !== b.type) {
        // Priority order for types
        const typeOrder = [
          "social_security",
          "pension",
          "salary",
          "self_employment",
          "rental",
          "dividends",
          "other",
        ];
        return typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type);
      }
      return a.name.localeCompare(b.name);
    });
  },
});

export const get = query({
  args: { id: v.id("incomeSources") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Get income sources that will be active during retirement
export const getActiveInRetirement = query({
  args: {
    retirementDate: v.number(),
  },
  handler: async (ctx, args) => {
    const sources = await ctx.db.query("incomeSources").collect();

    // Filter to sources that start on or after retirement
    // or have no start date (assumed to be always active)
    return sources.filter((source) => {
      // If no start date, include it
      if (!source.startDate) return true;

      // If start date is before retirement ends (we don't have end date from profile)
      // Just include sources that haven't ended yet
      if (source.endDate && source.endDate < args.retirementDate) return false;

      return true;
    });
  },
});

// Calculate total annual income from all sources for a given year
export const getTotalIncomeForYear = query({
  args: {
    year: v.number(),
  },
  handler: async (ctx, args) => {
    const sources = await ctx.db.query("incomeSources").collect();
    const yearTimestamp = new Date(args.year, 0, 1).getTime();
    const yearEndTimestamp = new Date(args.year, 11, 31).getTime();

    let total = 0;
    const activeSources: Array<{
      name: string;
      type: string;
      amount: number;
    }> = [];

    for (const source of sources) {
      // Check if source is active during this year
      const startsBeforeYearEnd = !source.startDate || source.startDate <= yearEndTimestamp;
      const endsAfterYearStart = !source.endDate || source.endDate >= yearTimestamp;

      if (startsBeforeYearEnd && endsAfterYearStart) {
        total += source.annualAmount;
        activeSources.push({
          name: source.name,
          type: source.type,
          amount: source.annualAmount,
        });
      }
    }

    return {
      total,
      sources: activeSources,
      year: args.year,
    };
  },
});
