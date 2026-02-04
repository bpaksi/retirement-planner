import { mutation } from "../_generated/server";
import { v } from "convex/values";

const incomeSourceType = v.union(
  v.literal("salary"),
  v.literal("self_employment"),
  v.literal("social_security"),
  v.literal("pension"),
  v.literal("rental"),
  v.literal("dividends"),
  v.literal("other")
);

export const create = mutation({
  args: {
    type: incomeSourceType,
    name: v.string(),
    annualAmount: v.number(),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    growthRate: v.number(),
    isTaxable: v.boolean(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("incomeSources", {
      type: args.type,
      name: args.name,
      annualAmount: args.annualAmount,
      startDate: args.startDate,
      endDate: args.endDate,
      growthRate: args.growthRate,
      isTaxable: args.isTaxable,
      createdAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("incomeSources"),
    type: v.optional(incomeSourceType),
    name: v.optional(v.string()),
    annualAmount: v.optional(v.number()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    growthRate: v.optional(v.number()),
    isTaxable: v.optional(v.boolean()),
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
  args: { id: v.id("incomeSources") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
