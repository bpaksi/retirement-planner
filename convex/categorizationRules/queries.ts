import { query } from "../_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const rules = await ctx.db
      .query("categorizationRules")
      .collect();

    // Get all categories for joining
    const categories = await ctx.db.query("categories").collect();
    const categoryMap = new Map(categories.map((c) => [c._id, c]));

    // Sort by priority (highest first)
    const sortedRules = rules.sort((a, b) => b.priority - a.priority);

    return sortedRules.map((rule) => ({
      ...rule,
      category: categoryMap.get(rule.categoryId) || null,
    }));
  },
});

export const getById = query({
  args: { id: v.id("categorizationRules") },
  handler: async (ctx, args) => {
    const rule = await ctx.db.get(args.id);
    if (!rule) return null;

    const category = await ctx.db.get(rule.categoryId);
    return { ...rule, category };
  },
});

export const testPattern = query({
  args: {
    pattern: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Validate regex
    try {
      new RegExp(args.pattern, "i");
    } catch {
      return { valid: false, error: "Invalid regex pattern", matches: [] };
    }

    const regex = new RegExp(args.pattern, "i");
    const transactions = await ctx.db.query("transactions").collect();

    const matches = transactions
      .filter((t) => regex.test(t.description))
      .slice(0, args.limit || 10)
      .map((t) => ({
        description: t.description,
        amount: t.amount,
        date: t.date,
      }));

    return {
      valid: true,
      matchCount: transactions.filter((t) => regex.test(t.description)).length,
      matches,
    };
  },
});

export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const rules = await ctx.db.query("categorizationRules").collect();
    const transactions = await ctx.db.query("transactions").collect();

    const uncategorizedCount = transactions.filter((t) => !t.categoryId).length;
    const totalRules = rules.length;
    const activeRules = rules.filter((r) => r.isActive).length;
    const systemRules = rules.filter((r) => r.createdBy === "system").length;
    const userRules = rules.filter((r) => r.createdBy === "user").length;
    const learnedRules = rules.filter((r) => r.createdBy === "learned").length;

    return {
      uncategorizedCount,
      totalTransactions: transactions.length,
      totalRules,
      activeRules,
      systemRules,
      userRules,
      learnedRules,
    };
  },
});
