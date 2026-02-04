import { query } from "../_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const events = await ctx.db.query("oneTimeEvents").collect();
    // Sort by year
    return events.sort((a, b) => a.year - b.year);
  },
});

export const get = query({
  args: { id: v.id("oneTimeEvents") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Get events for a specific year
export const getByYear = query({
  args: { year: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("oneTimeEvents")
      .withIndex("by_year", (q) => q.eq("year", args.year))
      .collect();
  },
});

// Get events within a year range (for projection chart)
export const getByYearRange = query({
  args: {
    startYear: v.number(),
    endYear: v.number(),
  },
  handler: async (ctx, args) => {
    const allEvents = await ctx.db.query("oneTimeEvents").collect();
    return allEvents.filter(
      (event) => event.year >= args.startYear && event.year <= args.endYear
    );
  },
});

// Get total impact for a specific year
export const getTotalForYear = query({
  args: { year: v.number() },
  handler: async (ctx, args) => {
    const events = await ctx.db
      .query("oneTimeEvents")
      .withIndex("by_year", (q) => q.eq("year", args.year))
      .collect();

    let totalIncome = 0;
    let totalExpense = 0;

    for (const event of events) {
      if (event.amount > 0) {
        totalIncome += event.amount;
      } else {
        totalExpense += Math.abs(event.amount);
      }
    }

    return {
      year: args.year,
      totalIncome,
      totalExpense,
      netImpact: totalIncome - totalExpense,
      events,
    };
  },
});
