import { query } from "../_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {
    accountId: v.optional(v.id("accounts")),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    categoryId: v.optional(v.id("categories")),
    flaggedOnly: v.optional(v.boolean()),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let transactions;

    // Use appropriate index based on filter
    if (args.accountId) {
      transactions = await ctx.db
        .query("transactions")
        .withIndex("by_account", (q) => q.eq("accountId", args.accountId!))
        .collect();
    } else if (args.flaggedOnly) {
      transactions = await ctx.db
        .query("transactions")
        .withIndex("by_flagged", (q) => q.eq("isFlagged", true))
        .collect();
    } else {
      transactions = await ctx.db.query("transactions").collect();
    }

    // Apply additional filters
    let filtered = transactions;

    if (args.startDate) {
      filtered = filtered.filter((t) => t.date >= args.startDate!);
    }
    if (args.endDate) {
      filtered = filtered.filter((t) => t.date <= args.endDate!);
    }
    if (args.categoryId) {
      filtered = filtered.filter((t) => t.categoryId === args.categoryId);
    }
    if (args.flaggedOnly && args.accountId) {
      // Need to filter by flagged if we used account index
      filtered = filtered.filter((t) => t.isFlagged);
    }

    // Sort by date descending
    filtered.sort((a, b) => b.date - a.date);

    // Apply pagination
    const offset = args.offset || 0;
    const limit = args.limit || 50;
    const paginated = filtered.slice(offset, offset + limit);

    // Get categories for the transactions
    const categoryIds = [
      ...new Set(paginated.map((t) => t.categoryId).filter(Boolean)),
    ];
    const categories = await Promise.all(
      categoryIds.map((id) => ctx.db.get(id!))
    );
    const categoryMap = new Map(
      categories.filter(Boolean).map((c) => [c!._id, c])
    );

    // Get accounts for the transactions
    const accountIds = [...new Set(paginated.map((t) => t.accountId))];
    const accounts = await Promise.all(accountIds.map((id) => ctx.db.get(id)));
    const accountMap = new Map(
      accounts.filter(Boolean).map((a) => [a!._id, a])
    );

    return {
      transactions: paginated.map((t) => ({
        ...t,
        category: t.categoryId ? categoryMap.get(t.categoryId) : null,
        account: accountMap.get(t.accountId),
      })),
      total: filtered.length,
      hasMore: offset + limit < filtered.length,
    };
  },
});

export const getById = query({
  args: { id: v.id("transactions") },
  handler: async (ctx, args) => {
    const transaction = await ctx.db.get(args.id);
    if (!transaction) return null;

    const category = transaction.categoryId
      ? await ctx.db.get(transaction.categoryId)
      : null;
    const account = await ctx.db.get(transaction.accountId);

    return {
      ...transaction,
      category,
      account,
    };
  },
});

export const getFlagged = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const transactions = await ctx.db
      .query("transactions")
      .withIndex("by_flagged", (q) => q.eq("isFlagged", true))
      .take(args.limit || 100);

    // Get categories
    const categoryIds = [
      ...new Set(transactions.map((t) => t.categoryId).filter(Boolean)),
    ];
    const categories = await Promise.all(
      categoryIds.map((id) => ctx.db.get(id!))
    );
    const categoryMap = new Map(
      categories.filter(Boolean).map((c) => [c!._id, c])
    );

    return transactions.map((t) => ({
      ...t,
      category: t.categoryId ? categoryMap.get(t.categoryId) : null,
    }));
  },
});

export const getRecent = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const transactions = await ctx.db
      .query("transactions")
      .withIndex("by_date")
      .order("desc")
      .take(args.limit || 10);

    // Get categories
    const categoryIds = [
      ...new Set(transactions.map((t) => t.categoryId).filter(Boolean)),
    ];
    const categories = await Promise.all(
      categoryIds.map((id) => ctx.db.get(id!))
    );
    const categoryMap = new Map(
      categories.filter(Boolean).map((c) => [c!._id, c])
    );

    // Get accounts
    const accountIds = [...new Set(transactions.map((t) => t.accountId))];
    const accounts = await Promise.all(accountIds.map((id) => ctx.db.get(id)));
    const accountMap = new Map(
      accounts.filter(Boolean).map((a) => [a!._id, a])
    );

    return transactions.map((t) => ({
      ...t,
      category: t.categoryId ? categoryMap.get(t.categoryId) : null,
      account: accountMap.get(t.accountId),
    }));
  },
});

export const countByAccount = query({
  args: { accountId: v.id("accounts") },
  handler: async (ctx, args) => {
    const transactions = await ctx.db
      .query("transactions")
      .withIndex("by_account", (q) => q.eq("accountId", args.accountId))
      .collect();

    return transactions.length;
  },
});
