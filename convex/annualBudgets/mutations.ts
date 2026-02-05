import { mutation } from "../_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    name: v.string(),
    annualAmount: v.number(),
    startYear: v.optional(v.number()),
    endYear: v.optional(v.number()),
    notes: v.optional(v.string()),
    isEssential: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("annualBudgets", {
      name: args.name,
      annualAmount: args.annualAmount,
      startYear: args.startYear,
      endYear: args.endYear,
      notes: args.notes,
      isEssential: args.isEssential ?? false,
      createdAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("annualBudgets"),
    name: v.optional(v.string()),
    annualAmount: v.optional(v.number()),
    startYear: v.optional(v.number()),
    endYear: v.optional(v.number()),
    notes: v.optional(v.string()),
    isEssential: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;

    // Filter out undefined values
    const filteredUpdates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        filteredUpdates[key] = value;
      }
    }

    await ctx.db.patch(id, filteredUpdates);
    return id;
  },
});

export const remove = mutation({
  args: { id: v.id("annualBudgets") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
