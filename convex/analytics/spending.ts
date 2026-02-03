import { query } from "../_generated/server";
import { v } from "convex/values";

export const getSpendingByCategory = query({
  args: {
    startDate: v.number(),
    endDate: v.number(),
    accountId: v.optional(v.id("accounts")),
  },
  handler: async (ctx, args) => {
    let transactions;

    if (args.accountId) {
      transactions = await ctx.db
        .query("transactions")
        .withIndex("by_account", (q) => q.eq("accountId", args.accountId!))
        .collect();
    } else {
      transactions = await ctx.db.query("transactions").collect();
    }

    // Filter by date range and expenses only (negative amounts)
    const filtered = transactions.filter(
      (t) =>
        t.date >= args.startDate &&
        t.date <= args.endDate &&
        t.amount < 0
    );

    // Get all categories
    const categories = await ctx.db.query("categories").collect();
    const categoryMap = new Map(categories.map((c) => [c._id, c]));

    // Identify transfer category IDs
    const transferCategoryIds = new Set(
      categories.filter((c) => c.type === "transfer").map((c) => c._id)
    );

    // Split transactions into spending vs transfers
    // A transaction is a transfer if isTransfer is true OR it has a transfer category
    const spendingTxs = filtered.filter(
      (t) =>
        !t.isTransfer &&
        (!t.categoryId || !transferCategoryIds.has(t.categoryId))
    );
    const transferTxs = filtered.filter(
      (t) =>
        t.isTransfer ||
        (t.categoryId && transferCategoryIds.has(t.categoryId))
    );

    // Group spending by category (excludes transfers)
    const spending: Record<
      string,
      {
        category: {
          _id: string;
          name: string;
          color: string;
          isEssential: boolean;
        } | null;
        total: number;
        count: number;
      }
    > = {};

    for (const t of spendingTxs) {
      const catId = t.categoryId?.toString() || "uncategorized";
      const category = t.categoryId ? categoryMap.get(t.categoryId) : null;

      if (!spending[catId]) {
        spending[catId] = {
          category: category
            ? {
                _id: category._id,
                name: category.name,
                color: category.color,
                isEssential: category.isEssential,
              }
            : {
                _id: "uncategorized",
                name: "Uncategorized",
                color: "#607D8B",
                isEssential: false,
              },
          total: 0,
          count: 0,
        };
      }

      spending[catId].total += Math.abs(t.amount);
      spending[catId].count += 1;
    }

    const results = Object.values(spending).sort((a, b) => b.total - a.total);

    const totalSpending = results.reduce((sum, s) => sum + s.total, 0);
    const essentialSpending = results
      .filter((s) => s.category?.isEssential)
      .reduce((sum, s) => sum + s.total, 0);
    const discretionarySpending = totalSpending - essentialSpending;

    // Calculate transfer totals
    const transferTotal = transferTxs.reduce(
      (sum, t) => sum + Math.abs(t.amount),
      0
    );

    return {
      byCategory: results,
      totalSpending,
      essentialSpending,
      discretionarySpending,
      transactionCount: spendingTxs.length,
      transfers: {
        total: transferTotal,
        count: transferTxs.length,
      },
    };
  },
});

export const getSpendingTrend = query({
  args: {
    months: v.optional(v.number()),
    accountId: v.optional(v.id("accounts")),
  },
  handler: async (ctx, args) => {
    const monthsToFetch = args.months || 12;
    const now = new Date();
    const startDate = new Date(
      now.getFullYear(),
      now.getMonth() - monthsToFetch + 1,
      1
    ).getTime();

    let transactions;

    if (args.accountId) {
      transactions = await ctx.db
        .query("transactions")
        .withIndex("by_account", (q) => q.eq("accountId", args.accountId!))
        .collect();
    } else {
      transactions = await ctx.db.query("transactions").collect();
    }

    // Get all categories to identify transfer categories
    const categories = await ctx.db.query("categories").collect();
    const transferCategoryIds = new Set(
      categories.filter((c) => c.type === "transfer").map((c) => c._id)
    );

    // Filter by date range and exclude transfers (both by isTransfer flag and transfer category)
    const filtered = transactions.filter(
      (t) =>
        t.date >= startDate &&
        !t.isTransfer &&
        (!t.categoryId || !transferCategoryIds.has(t.categoryId))
    );

    // Group by month
    const monthlyData: Record<
      string,
      {
        month: string;
        year: number;
        monthNum: number;
        income: number;
        expenses: number;
        net: number;
      }
    > = {};

    for (const t of filtered) {
      const date = new Date(t.date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

      if (!monthlyData[key]) {
        monthlyData[key] = {
          month: date.toLocaleDateString("en-US", { month: "short" }),
          year: date.getFullYear(),
          monthNum: date.getMonth(),
          income: 0,
          expenses: 0,
          net: 0,
        };
      }

      if (t.amount > 0) {
        monthlyData[key].income += t.amount;
      } else {
        monthlyData[key].expenses += Math.abs(t.amount);
      }
      monthlyData[key].net += t.amount;
    }

    // Sort by date
    const results = Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([_, data]) => data);

    return results;
  },
});

export const getMonthlyTotals = query({
  args: {
    year: v.number(),
    month: v.number(),
    accountId: v.optional(v.id("accounts")),
  },
  handler: async (ctx, args) => {
    const startDate = new Date(args.year, args.month - 1, 1).getTime();
    const endDate = new Date(args.year, args.month, 0, 23, 59, 59).getTime();

    let transactions;

    if (args.accountId) {
      transactions = await ctx.db
        .query("transactions")
        .withIndex("by_account", (q) => q.eq("accountId", args.accountId!))
        .collect();
    } else {
      transactions = await ctx.db.query("transactions").collect();
    }

    // Get all categories to identify transfer categories
    const categories = await ctx.db.query("categories").collect();
    const transferCategoryIds = new Set(
      categories.filter((c) => c.type === "transfer").map((c) => c._id)
    );

    // Filter by date range and exclude transfers (both by isTransfer flag and transfer category)
    const filtered = transactions.filter(
      (t) =>
        t.date >= startDate &&
        t.date <= endDate &&
        !t.isTransfer &&
        (!t.categoryId || !transferCategoryIds.has(t.categoryId))
    );

    // Count transfers separately
    const transfers = transactions.filter(
      (t) =>
        t.date >= startDate &&
        t.date <= endDate &&
        (t.isTransfer || (t.categoryId && transferCategoryIds.has(t.categoryId)))
    );

    let income = 0;
    let expenses = 0;

    for (const t of filtered) {
      if (t.amount > 0) {
        income += t.amount;
      } else {
        expenses += Math.abs(t.amount);
      }
    }

    const transferTotal = transfers.reduce(
      (sum, t) => sum + Math.abs(t.amount),
      0
    );

    return {
      income,
      expenses,
      net: income - expenses,
      transactionCount: filtered.length,
      transfers: {
        total: transferTotal,
        count: transfers.length,
      },
    };
  },
});
