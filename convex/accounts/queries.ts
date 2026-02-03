import { query } from "../_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {
    activeOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    let accounts = await ctx.db.query("accounts").collect();

    if (args.activeOnly) {
      accounts = accounts.filter((a) => a.isActive);
    }

    return accounts.sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const getById = query({
  args: { id: v.id("accounts") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getByType = query({
  args: {
    type: v.union(
      v.literal("401k"),
      v.literal("403b"),
      v.literal("traditional_ira"),
      v.literal("roth_ira"),
      v.literal("roth_401k"),
      v.literal("brokerage"),
      v.literal("checking"),
      v.literal("savings"),
      v.literal("money_market"),
      v.literal("credit_card"),
      v.literal("loan"),
      v.literal("other")
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("accounts")
      .withIndex("by_type", (q) => q.eq("type", args.type))
      .collect();
  },
});

export const getRetirementAccounts = query({
  args: {},
  handler: async (ctx) => {
    const accounts = await ctx.db.query("accounts").collect();
    return accounts.filter((a) => a.isRetirement && a.isActive);
  },
});
