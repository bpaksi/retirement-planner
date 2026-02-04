import { query } from "../_generated/server";
import { v } from "convex/values";
import { calculateSimilarityScore, getMatchLevel } from "../lib/similarity";

export const list = query({
  args: {
    accountId: v.optional(v.id("accounts")),
    accountIds: v.optional(v.array(v.id("accounts"))),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    categoryId: v.optional(v.id("categories")),
    categoryIds: v.optional(v.array(v.id("categories"))),
    flaggedOnly: v.optional(v.boolean()),
    uncategorizedOnly: v.optional(v.boolean()),
    linkedOnly: v.optional(v.boolean()),
    searchQuery: v.optional(v.string()),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
    sortBy: v.optional(v.union(v.literal("date"), v.literal("amount"), v.literal("category"))),
    sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
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

    // Multi-account filter (takes precedence if accountId wasn't used for index)
    if (args.accountIds && args.accountIds.length > 0 && !args.accountId) {
      const accountSet = new Set(args.accountIds);
      filtered = filtered.filter((t) => accountSet.has(t.accountId));
    }

    // Search query filter (case-insensitive description contains)
    if (args.searchQuery && args.searchQuery.trim()) {
      const searchLower = args.searchQuery.trim().toLowerCase();
      filtered = filtered.filter((t) =>
        t.description.toLowerCase().includes(searchLower)
      );
    }

    if (args.startDate) {
      filtered = filtered.filter((t) => t.date >= args.startDate!);
    }
    if (args.endDate) {
      filtered = filtered.filter((t) => t.date <= args.endDate!);
    }
    if (args.categoryId) {
      filtered = filtered.filter((t) => t.categoryId === args.categoryId);
    }
    if (args.categoryIds && args.categoryIds.length > 0) {
      const categorySet = new Set(args.categoryIds);
      filtered = filtered.filter((t) => t.categoryId && categorySet.has(t.categoryId));
    }
    if (args.flaggedOnly && args.accountId) {
      // Need to filter by flagged if we used account index
      filtered = filtered.filter((t) => t.isFlagged);
    }
    if (args.uncategorizedOnly) {
      filtered = filtered.filter((t) => !t.categoryId);
    }
    if (args.linkedOnly) {
      filtered = filtered.filter((t) => !!t.linkedTransactionId);
    }

    // Get categories for sorting and display (need all categories for sort)
    const allCategoryIds = [
      ...new Set(filtered.map((t) => t.categoryId).filter(Boolean)),
    ];
    const allCategories = await Promise.all(
      allCategoryIds.map((id) => ctx.db.get(id!))
    );
    const categoryMap = new Map(
      allCategories.filter(Boolean).map((c) => [c!._id, c])
    );

    // Sort transactions
    const sortBy = args.sortBy || "date";
    const sortOrder = args.sortOrder || "desc";
    const multiplier = sortOrder === "asc" ? 1 : -1;

    filtered.sort((a, b) => {
      switch (sortBy) {
        case "date":
          return (a.date - b.date) * multiplier;
        case "amount":
          return (a.amount - b.amount) * multiplier;
        case "category": {
          const catA = a.categoryId ? categoryMap.get(a.categoryId)?.name || "" : "";
          const catB = b.categoryId ? categoryMap.get(b.categoryId)?.name || "" : "";
          return catA.localeCompare(catB) * multiplier;
        }
        default:
          return (b.date - a.date);
      }
    });

    // Apply pagination
    const offset = args.offset || 0;
    const limit = args.limit || 50;
    const paginated = filtered.slice(offset, offset + limit);

    // Get accounts for the transactions
    const accountIds = [...new Set(paginated.map((t) => t.accountId))];
    const accounts = await Promise.all(accountIds.map((id) => ctx.db.get(id)));
    const accountMap = new Map(
      accounts.filter(Boolean).map((a) => [a!._id, a])
    );

    // Get linked transaction account names for transactions that have links
    const linkedTxIds = paginated
      .filter((t) => t.linkedTransactionId)
      .map((t) => t.linkedTransactionId!);
    const linkedTransactions = await Promise.all(
      linkedTxIds.map((id) => ctx.db.get(id))
    );
    const linkedTxMap = new Map(
      linkedTransactions.filter(Boolean).map((t) => [t!._id, t])
    );

    // Build map of linked account names
    const linkedAccountIds = [
      ...new Set(
        linkedTransactions.filter(Boolean).map((t) => t!.accountId)
      ),
    ];
    const linkedAccounts = await Promise.all(
      linkedAccountIds.map((id) => ctx.db.get(id))
    );
    const linkedAccountMap = new Map(
      linkedAccounts.filter(Boolean).map((a) => [a!._id, a])
    );

    return {
      transactions: paginated.map((t) => {
        const linkedTx = t.linkedTransactionId
          ? linkedTxMap.get(t.linkedTransactionId)
          : null;
        const linkedAccount = linkedTx
          ? linkedAccountMap.get(linkedTx.accountId)
          : null;

        return {
          ...t,
          category: t.categoryId ? categoryMap.get(t.categoryId) : null,
          account: accountMap.get(t.accountId),
          hasLinkedTransaction: !!t.linkedTransactionId,
          linkedAccountName: linkedAccount?.name ?? null,
        };
      }),
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

    // Get linked transaction details if exists
    let linkedTransaction = null;
    if (transaction.linkedTransactionId) {
      const linkedTx = await ctx.db.get(transaction.linkedTransactionId);
      if (linkedTx) {
        const linkedAccount = await ctx.db.get(linkedTx.accountId);
        const linkedCategory = linkedTx.categoryId
          ? await ctx.db.get(linkedTx.categoryId)
          : null;
        linkedTransaction = {
          ...linkedTx,
          account: linkedAccount,
          category: linkedCategory,
        };
      }
    }

    return {
      ...transaction,
      category,
      account,
      linkedTransaction,
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

/**
 * Finds similar uncategorized transactions for batch categorization.
 *
 * Returns transactions that are:
 * 1. Not the target transaction
 * 2. Uncategorized (no categoryId)
 * 3. Above the similarity threshold (0.4)
 *
 * Results are sorted by similarity score descending.
 */
export const findSimilar = query({
  args: {
    transactionId: v.id("transactions"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10;
    const SIMILARITY_THRESHOLD = 0.4;

    // Get the target transaction
    const target = await ctx.db.get(args.transactionId);
    if (!target) {
      return [];
    }

    // Get all uncategorized transactions (excluding target)
    const allTransactions = await ctx.db.query("transactions").collect();
    const uncategorized = allTransactions.filter(
      (t) => !t.categoryId && t._id !== args.transactionId
    );

    // Score each transaction
    const scored = uncategorized.map((t) => {
      const similarityScore = calculateSimilarityScore(
        { description: target.description, amount: target.amount },
        { description: t.description, amount: t.amount }
      );
      return {
        ...t,
        similarityScore,
        matchLevel: getMatchLevel(similarityScore),
      };
    });

    // Filter by threshold, sort by score, take limit
    const filtered = scored
      .filter((t) => t.similarityScore >= SIMILARITY_THRESHOLD)
      .sort((a, b) => b.similarityScore - a.similarityScore)
      .slice(0, limit);

    // Get accounts for context
    const accountIds = [...new Set(filtered.map((t) => t.accountId))];
    const accounts = await Promise.all(accountIds.map((id) => ctx.db.get(id)));
    const accountMap = new Map(
      accounts.filter(Boolean).map((a) => [a!._id, a])
    );

    return filtered.map((t) => ({
      _id: t._id,
      description: t.description,
      amount: t.amount,
      date: t.date,
      similarityScore: t.similarityScore,
      matchLevel: t.matchLevel as "strong" | "good" | "weak",
      account: accountMap.get(t.accountId),
    }));
  },
});
