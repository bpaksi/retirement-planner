import { mutation } from "../_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    accountId: v.id("accounts"),
    date: v.number(),
    description: v.string(),
    amount: v.number(),
    categoryId: v.optional(v.id("categories")),
    isRecurring: v.optional(v.boolean()),
    isFlagged: v.optional(v.boolean()),
    confidenceScore: v.optional(v.number()),
    tags: v.optional(v.array(v.string())),
    importBatchId: v.optional(v.string()),
    sourceFile: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("transactions", {
      accountId: args.accountId,
      date: args.date,
      description: args.description,
      amount: args.amount,
      categoryId: args.categoryId,
      isRecurring: args.isRecurring ?? false,
      isFlagged: args.isFlagged ?? false,
      confidenceScore: args.confidenceScore,
      tags: args.tags ?? [],
      importBatchId: args.importBatchId,
      sourceFile: args.sourceFile,
      createdAt: Date.now(),
    });

    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id("transactions"),
    categoryId: v.optional(v.id("categories")),
    isRecurring: v.optional(v.boolean()),
    isFlagged: v.optional(v.boolean()),
    tags: v.optional(v.array(v.string())),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;

    // Filter out undefined values
    const cleanUpdates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        cleanUpdates[key] = value;
      }
    }

    await ctx.db.patch(id, cleanUpdates);
    return id;
  },
});

export const updateCategory = mutation({
  args: {
    id: v.id("transactions"),
    categoryId: v.id("categories"),
    unflag: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const updates: Record<string, unknown> = {
      categoryId: args.categoryId,
    };

    if (args.unflag) {
      updates.isFlagged = false;
      updates.confidenceScore = 1.0; // User-confirmed category
    }

    await ctx.db.patch(args.id, updates);

    // Optionally create a learned rule from this categorization
    // This helps improve future auto-categorization
    const transaction = await ctx.db.get(args.id);
    if (transaction) {
      // Check if a similar rule already exists
      const existingRules = await ctx.db
        .query("categorizationRules")
        .withIndex("by_category", (q) => q.eq("categoryId", args.categoryId))
        .collect();

      // Simple duplicate check - look for exact description match
      const description = transaction.description.toUpperCase();
      const hasExisting = existingRules.some((r) => {
        try {
          return new RegExp(r.pattern, "i").test(description);
        } catch {
          return false;
        }
      });

      if (!hasExisting && description.length > 3) {
        // Create a learned rule based on the first significant word
        const words = description.split(/\s+/).filter((w) => w.length > 3);
        if (words.length > 0) {
          const pattern = words[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          await ctx.db.insert("categorizationRules", {
            pattern,
            categoryId: args.categoryId,
            priority: 50, // Lower than system rules
            isActive: true,
            createdBy: "learned",
            matchCount: 1,
          });
        }
      }
    }

    return args.id;
  },
});

export const bulkUpdateCategory = mutation({
  args: {
    ids: v.array(v.id("transactions")),
    categoryId: v.id("categories"),
    unflag: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const updates: Record<string, unknown> = {
      categoryId: args.categoryId,
    };

    if (args.unflag) {
      updates.isFlagged = false;
      updates.confidenceScore = 1.0;
    }

    for (const id of args.ids) {
      await ctx.db.patch(id, updates);
    }

    return args.ids.length;
  },
});

export const remove = mutation({
  args: { id: v.id("transactions") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return args.id;
  },
});

export const bulkRemove = mutation({
  args: { ids: v.array(v.id("transactions")) },
  handler: async (ctx, args) => {
    for (const id of args.ids) {
      await ctx.db.delete(id);
    }
    return args.ids.length;
  },
});

export const removeByAccount = mutation({
  args: { accountId: v.id("accounts") },
  handler: async (ctx, args) => {
    const transactions = await ctx.db
      .query("transactions")
      .withIndex("by_account", (q) => q.eq("accountId", args.accountId))
      .collect();

    for (const tx of transactions) {
      await ctx.db.delete(tx._id);
    }

    return { deleted: transactions.length };
  },
});

export const recategorizeUncategorized = mutation({
  args: {},
  handler: async (ctx) => {
    // Get all uncategorized transactions
    const allTransactions = await ctx.db.query("transactions").collect();
    const uncategorized = allTransactions.filter((t) => !t.categoryId);

    if (uncategorized.length === 0) {
      return { updated: 0, stillUncategorized: 0 };
    }

    // Get active categorization rules sorted by priority
    const rules = await ctx.db
      .query("categorizationRules")
      .collect();

    const activeRules = rules
      .filter((r) => r.isActive)
      .sort((a, b) => b.priority - a.priority);

    if (activeRules.length === 0) {
      return { updated: 0, stillUncategorized: uncategorized.length };
    }

    let updated = 0;

    for (const tx of uncategorized) {
      // Try to match against rules
      for (const rule of activeRules) {
        try {
          const regex = new RegExp(rule.pattern, "i");
          if (regex.test(tx.description)) {
            // Calculate confidence based on rule source
            const confidenceScore =
              rule.createdBy === "user"
                ? 1.0
                : rule.createdBy === "learned"
                  ? 0.85
                  : rule.priority >= 80
                    ? 0.9
                    : 0.75;

            const isFlagged = confidenceScore < 0.8;

            // Update the transaction
            await ctx.db.patch(tx._id, {
              categoryId: rule.categoryId,
              confidenceScore,
              isFlagged,
            });

            // Increment match count for the rule
            await ctx.db.patch(rule._id, {
              matchCount: rule.matchCount + 1,
            });

            updated++;
            break; // Stop at first match
          }
        } catch {
          // Invalid regex, skip
        }
      }
    }

    return {
      updated,
      stillUncategorized: uncategorized.length - updated,
    };
  },
});
