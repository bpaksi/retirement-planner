import { mutation, query } from "../_generated/server";
import { v } from "convex/values";

// Transaction input for import
const transactionInput = v.object({
  date: v.number(),
  description: v.string(),
  amount: v.number(),
  originalCategory: v.optional(v.string()),
});

export const importBatch = mutation({
  args: {
    accountId: v.id("accounts"),
    transactions: v.array(transactionInput),
    sourceFile: v.string(),
    institution: v.string(),
  },
  handler: async (ctx, args) => {
    const batchId = `import_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const now = Date.now();

    // Get all categories for categorization
    const categories = await ctx.db.query("categories").collect();
    const categoryByName = new Map(categories.map((c) => [c.name, c._id]));

    // Get categorization rules
    const rules = await ctx.db
      .query("categorizationRules")
      .withIndex("by_priority")
      .collect();

    // Sort rules by priority (higher first)
    rules.sort((a, b) => b.priority - a.priority);

    // Check for existing transactions to avoid duplicates
    const existingTransactions = await ctx.db
      .query("transactions")
      .withIndex("by_account", (q) => q.eq("accountId", args.accountId))
      .collect();

    // Create a set of existing transaction signatures for duplicate detection
    const existingSignatures = new Set(
      existingTransactions.map(
        (t) => `${t.date}_${t.description}_${t.amount}`
      )
    );

    let imported = 0;
    let duplicates = 0;
    const errors: string[] = [];

    for (const tx of args.transactions) {
      // Check for duplicate
      const signature = `${tx.date}_${tx.description}_${tx.amount}`;
      if (existingSignatures.has(signature)) {
        duplicates++;
        continue;
      }

      // Auto-categorize
      let categoryId: typeof rules[0]["categoryId"] | undefined = undefined;
      let confidenceScore = 0;
      let isFlagged = true; // Flag by default, unflag if confident match

      // Try to match against rules
      for (const rule of rules) {
        try {
          const regex = new RegExp(rule.pattern, "i");
          if (regex.test(tx.description)) {
            categoryId = rule.categoryId;
            // Confidence based on rule source and priority
            confidenceScore =
              rule.createdBy === "user"
                ? 1.0
                : rule.createdBy === "learned"
                  ? 0.85
                  : rule.priority >= 80
                    ? 0.9
                    : 0.75;
            isFlagged = confidenceScore < 0.8;

            // Increment match count for the rule
            await ctx.db.patch(rule._id, {
              matchCount: rule.matchCount + 1,
            });

            break;
          }
        } catch (e) {
          // Invalid regex pattern, skip
        }
      }

      // If no category found, check if original category maps to our categories
      if (!categoryId && tx.originalCategory) {
        const mappedCategoryId = categoryByName.get(tx.originalCategory);
        if (mappedCategoryId) {
          categoryId = mappedCategoryId;
          confidenceScore = 0.6; // Lower confidence for mapped categories
          isFlagged = true;
        }
      }

      // Insert the transaction
      try {
        await ctx.db.insert("transactions", {
          accountId: args.accountId,
          date: tx.date,
          description: tx.description,
          amount: tx.amount,
          categoryId,
          isRecurring: false,
          isFlagged,
          confidenceScore: confidenceScore || undefined,
          tags: [],
          importBatchId: batchId,
          sourceFile: args.sourceFile,
          createdAt: now,
        });

        imported++;
        existingSignatures.add(signature); // Prevent duplicates within batch
      } catch (e) {
        errors.push(
          `Failed to import "${tx.description}": ${e instanceof Error ? e.message : "Unknown error"}`
        );
      }
    }

    // Record import history
    await ctx.db.insert("importHistory", {
      filename: args.sourceFile,
      institution: args.institution,
      accountId: args.accountId,
      transactionCount: imported,
      duplicatesSkipped: duplicates,
      importedAt: now,
      status:
        errors.length === 0
          ? "success"
          : imported > 0
            ? "partial"
            : "failed",
      errors: errors.length > 0 ? errors : undefined,
    });

    return {
      batchId,
      imported,
      duplicates,
      errors,
      total: args.transactions.length,
    };
  },
});

export const getImportHistory = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const history = await ctx.db
      .query("importHistory")
      .withIndex("by_date")
      .order("desc")
      .take(args.limit || 20);

    // Get account names
    const accountIds = [
      ...new Set(history.map((h) => h.accountId).filter(Boolean)),
    ];
    const accounts = await Promise.all(
      accountIds.map((id) => ctx.db.get(id!))
    );
    const accountMap = new Map(
      accounts.filter(Boolean).map((a) => [a!._id, a])
    );

    return history.map((h) => ({
      ...h,
      account: h.accountId ? accountMap.get(h.accountId) : null,
    }));
  },
});

export const undoImport = mutation({
  args: {
    batchId: v.string(),
  },
  handler: async (ctx, args) => {
    // Get all transactions from this batch
    const transactions = await ctx.db
      .query("transactions")
      .withIndex("by_import_batch", (q) => q.eq("importBatchId", args.batchId))
      .collect();

    // Delete them
    for (const tx of transactions) {
      await ctx.db.delete(tx._id);
    }

    return { deleted: transactions.length };
  },
});
