import { query, mutation } from "../_generated/server";
import { v } from "convex/values";

/**
 * Find potential transactions to link with the given transaction.
 *
 * Matching criteria:
 * - Different account (transfers are cross-account)
 * - Opposite sign amounts (debit ↔ credit)
 * - Amounts within tolerance (default 1% for fees)
 * - Dates within range (default 3 days for processing delays)
 * - Not already linked
 *
 * Returns candidates sorted by match score (higher = better match).
 */
export const findPotentialLinks = query({
  args: {
    transactionId: v.id("transactions"),
    amountTolerance: v.optional(v.number()), // Percentage, default 1%
    dayRange: v.optional(v.number()), // Days, default 3
  },
  handler: async (ctx, args) => {
    const amountTolerance = args.amountTolerance ?? 0.01; // 1%
    const dayRange = args.dayRange ?? 3;
    const msRange = dayRange * 24 * 60 * 60 * 1000;

    // Get the target transaction
    const target = await ctx.db.get(args.transactionId);
    if (!target) {
      return [];
    }

    // If already linked, return empty
    if (target.linkedTransactionId) {
      return [];
    }

    // Get all transactions within the date range
    const allTransactions = await ctx.db.query("transactions").collect();

    // Find candidates
    const candidates = allTransactions.filter((t) => {
      // Must be different transaction
      if (t._id === args.transactionId) return false;

      // Must be different account (transfers are cross-account)
      if (t.accountId === target.accountId) return false;

      // Must not already be linked
      if (t.linkedTransactionId) return false;

      // Must have opposite sign (one credit, one debit)
      if (Math.sign(t.amount) === Math.sign(target.amount)) return false;

      // Amounts must be within tolerance (comparing absolute values)
      const absTarget = Math.abs(target.amount);
      const absCandidate = Math.abs(t.amount);
      const diff = Math.abs(absTarget - absCandidate);
      const tolerance = absTarget * amountTolerance;
      if (diff > tolerance) return false;

      // Dates must be within range
      const dateDiff = Math.abs(t.date - target.date);
      if (dateDiff > msRange) return false;

      return true;
    });

    // Score each candidate
    const scored = await Promise.all(
      candidates.map(async (t) => {
        const account = await ctx.db.get(t.accountId);

        // Calculate match score (0-1)
        // Higher score = better match
        const absTarget = Math.abs(target.amount);
        const absCandidate = Math.abs(t.amount);
        const amountDiff = Math.abs(absTarget - absCandidate) / absTarget;
        const amountScore = 1 - amountDiff / amountTolerance; // 1 = exact match

        const dateDiff = Math.abs(t.date - target.date);
        const dateScore = 1 - dateDiff / msRange; // 1 = same day

        // Weight: amount match more important than date
        const score = amountScore * 0.7 + dateScore * 0.3;

        return {
          _id: t._id,
          accountId: t.accountId,
          accountName: account?.name ?? "Unknown",
          date: t.date,
          description: t.description,
          amount: t.amount,
          score,
        };
      })
    );

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    return scored;
  },
});

/**
 * Link two transactions together as a transfer.
 * Creates bidirectional references and sets isTransfer=true on both.
 */
export const linkTransactions = mutation({
  args: {
    transactionId1: v.id("transactions"),
    transactionId2: v.id("transactions"),
  },
  handler: async (ctx, args) => {
    const tx1 = await ctx.db.get(args.transactionId1);
    const tx2 = await ctx.db.get(args.transactionId2);

    if (!tx1 || !tx2) {
      throw new Error("One or both transactions not found");
    }

    // Validation: same account not allowed
    if (tx1.accountId === tx2.accountId) {
      throw new Error("Cannot link transactions from the same account");
    }

    // Validation: already linked to different transaction
    if (tx1.linkedTransactionId && tx1.linkedTransactionId !== args.transactionId2) {
      throw new Error("Transaction 1 is already linked to a different transaction");
    }
    if (tx2.linkedTransactionId && tx2.linkedTransactionId !== args.transactionId1) {
      throw new Error("Transaction 2 is already linked to a different transaction");
    }

    // Link both transactions
    await ctx.db.patch(args.transactionId1, {
      linkedTransactionId: args.transactionId2,
      isTransfer: true,
    });

    await ctx.db.patch(args.transactionId2, {
      linkedTransactionId: args.transactionId1,
      isTransfer: true,
    });

    return { success: true };
  },
});

/**
 * Unlink two transactions.
 * Removes bidirectional references but keeps isTransfer=true
 * (user may want to keep transfer categorization even if unlinked).
 */
export const unlinkTransactions = mutation({
  args: {
    transactionId: v.id("transactions"),
  },
  handler: async (ctx, args) => {
    const tx = await ctx.db.get(args.transactionId);
    if (!tx) {
      throw new Error("Transaction not found");
    }

    if (!tx.linkedTransactionId) {
      throw new Error("Transaction is not linked");
    }

    const linkedTx = await ctx.db.get(tx.linkedTransactionId);

    // Unlink the target transaction
    await ctx.db.patch(args.transactionId, {
      linkedTransactionId: undefined,
      isTransfer: false,
    });

    // Unlink the paired transaction if it exists
    if (linkedTx) {
      await ctx.db.patch(linkedTx._id, {
        linkedTransactionId: undefined,
        isTransfer: false,
      });
    }

    return { success: true };
  },
});

/**
 * Get the linked transaction with full details including account.
 */
export const getLinkedTransaction = query({
  args: {
    transactionId: v.id("transactions"),
  },
  handler: async (ctx, args) => {
    const tx = await ctx.db.get(args.transactionId);
    if (!tx || !tx.linkedTransactionId) {
      return null;
    }

    const linkedTx = await ctx.db.get(tx.linkedTransactionId);
    if (!linkedTx) {
      return null;
    }

    const account = await ctx.db.get(linkedTx.accountId);
    const category = linkedTx.categoryId
      ? await ctx.db.get(linkedTx.categoryId)
      : null;

    return {
      ...linkedTx,
      account,
      category,
    };
  },
});

/**
 * Find potential transfer links for recently imported transactions.
 * Call this after import to surface likely matches for user review.
 */
export const findPotentialLinksForBatch = query({
  args: {
    importBatchId: v.string(),
    minScore: v.optional(v.number()), // Minimum score to return, default 0.9
  },
  handler: async (ctx, args) => {
    const minScore = args.minScore ?? 0.9;

    // Get transactions from this import batch
    const batchTransactions = await ctx.db
      .query("transactions")
      .withIndex("by_import_batch", (q) => q.eq("importBatchId", args.importBatchId))
      .collect();

    // Get all other unlinked transactions for matching
    const allTransactions = await ctx.db.query("transactions").collect();
    const otherTransactions = allTransactions.filter(
      (t) => !t.linkedTransactionId && t.importBatchId !== args.importBatchId
    );

    const matches: Array<{
      transaction1Id: string;
      transaction1Description: string;
      transaction2Id: string;
      transaction2Description: string;
      score: number;
    }> = [];

    // For each batch transaction, find best match
    for (const batchTx of batchTransactions) {
      if (batchTx.linkedTransactionId) continue;

      for (const otherTx of otherTransactions) {
        // Different account
        if (otherTx.accountId === batchTx.accountId) continue;

        // Opposite sign
        if (Math.sign(otherTx.amount) === Math.sign(batchTx.amount)) continue;

        // Amount within 1%
        const absTarget = Math.abs(batchTx.amount);
        const absCandidate = Math.abs(otherTx.amount);
        const amountDiff = Math.abs(absTarget - absCandidate) / absTarget;
        if (amountDiff > 0.01) continue;

        // Date within 3 days
        const msRange = 3 * 24 * 60 * 60 * 1000;
        const dateDiff = Math.abs(otherTx.date - batchTx.date);
        if (dateDiff > msRange) continue;

        // Calculate score
        const amountScore = 1 - amountDiff / 0.01;
        const dateScore = 1 - dateDiff / msRange;
        const score = amountScore * 0.7 + dateScore * 0.3;

        if (score >= minScore) {
          matches.push({
            transaction1Id: batchTx._id,
            transaction1Description: batchTx.description,
            transaction2Id: otherTx._id,
            transaction2Description: otherTx.description,
            score,
          });
        }
      }
    }

    // Sort by score and deduplicate (only keep best match per transaction pair)
    matches.sort((a, b) => b.score - a.score);

    return matches;
  },
});
