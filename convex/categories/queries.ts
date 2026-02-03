import { query } from "../_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const categories = await ctx.db.query("categories").collect();
    return categories.sort((a, b) => a.sortOrder - b.sortOrder);
  },
});

export const listByType = query({
  args: {
    type: v.union(
      v.literal("expense"),
      v.literal("income"),
      v.literal("transfer")
    ),
  },
  handler: async (ctx, args) => {
    const categories = await ctx.db
      .query("categories")
      .withIndex("by_type", (q) => q.eq("type", args.type))
      .collect();

    return categories.sort((a, b) => a.sortOrder - b.sortOrder);
  },
});

export const getById = query({
  args: { id: v.id("categories") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getByName = query({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("categories")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();
  },
});
