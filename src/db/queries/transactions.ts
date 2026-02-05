import { db } from '../index';
import { transactions, categories, accounts } from '../schema';
import { eq, desc, inArray } from 'drizzle-orm';
import { calculateSimilarityScore, getMatchLevel } from '@/lib/similarity';

export interface ListTransactionsArgs {
  accountId?: string;
  accountIds?: string[];
  startDate?: number;
  endDate?: number;
  categoryId?: string;
  categoryIds?: string[];
  flaggedOnly?: boolean;
  uncategorizedOnly?: boolean;
  linkedOnly?: boolean;
  searchQuery?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'date' | 'amount' | 'category';
  sortOrder?: 'asc' | 'desc';
}

export function listTransactions(args: ListTransactionsArgs = {}) {
  // Get all transactions first, then filter
  let allTransactions = db.select().from(transactions).all();

  // Apply filters
  if (args.accountId) {
    allTransactions = allTransactions.filter(t => t.accountId === args.accountId);
  }
  if (args.accountIds && args.accountIds.length > 0) {
    const accountSet = new Set(args.accountIds);
    allTransactions = allTransactions.filter(t => accountSet.has(t.accountId));
  }
  if (args.flaggedOnly) {
    allTransactions = allTransactions.filter(t => t.isFlagged);
  }
  if (args.uncategorizedOnly) {
    allTransactions = allTransactions.filter(t => !t.categoryId);
  }
  if (args.linkedOnly) {
    allTransactions = allTransactions.filter(t => !!t.linkedTransactionId);
  }
  if (args.startDate) {
    allTransactions = allTransactions.filter(t => t.date >= args.startDate!);
  }
  if (args.endDate) {
    allTransactions = allTransactions.filter(t => t.date <= args.endDate!);
  }
  if (args.categoryId) {
    allTransactions = allTransactions.filter(t => t.categoryId === args.categoryId);
  }
  if (args.categoryIds && args.categoryIds.length > 0) {
    const categorySet = new Set(args.categoryIds);
    allTransactions = allTransactions.filter(t => t.categoryId && categorySet.has(t.categoryId));
  }
  if (args.searchQuery && args.searchQuery.trim()) {
    const searchLower = args.searchQuery.trim().toLowerCase();
    allTransactions = allTransactions.filter(t =>
      t.description.toLowerCase().includes(searchLower)
    );
  }

  // Get categories for sorting and display
  const allCategoryIds = [...new Set(allTransactions.map(t => t.categoryId).filter(Boolean))] as string[];
  const allCategories = allCategoryIds.length > 0
    ? db.select().from(categories).where(inArray(categories.id, allCategoryIds)).all()
    : [];
  const categoryMap = new Map(allCategories.map(c => [c.id, c]));

  // Sort transactions
  const sortBy = args.sortBy || 'date';
  const sortOrder = args.sortOrder || 'desc';
  const multiplier = sortOrder === 'asc' ? 1 : -1;

  allTransactions.sort((a, b) => {
    switch (sortBy) {
      case 'date':
        return (a.date - b.date) * multiplier;
      case 'amount':
        return (a.amount - b.amount) * multiplier;
      case 'category': {
        const catA = a.categoryId ? categoryMap.get(a.categoryId)?.name || '' : '';
        const catB = b.categoryId ? categoryMap.get(b.categoryId)?.name || '' : '';
        return catA.localeCompare(catB) * multiplier;
      }
      default:
        return (b.date - a.date);
    }
  });

  // Apply pagination
  const offset = args.offset || 0;
  const limit = args.limit || 50;
  const paginated = allTransactions.slice(offset, offset + limit);

  // Get accounts
  const accountIds = [...new Set(paginated.map(t => t.accountId))];
  const accountsList = accountIds.length > 0
    ? db.select().from(accounts).where(inArray(accounts.id, accountIds)).all()
    : [];
  const accountMap = new Map(accountsList.map(a => [a.id, a]));

  // Get linked transactions and their accounts
  const linkedTxIds = paginated.filter(t => t.linkedTransactionId).map(t => t.linkedTransactionId!);
  const linkedTransactions = linkedTxIds.length > 0
    ? db.select().from(transactions).where(inArray(transactions.id, linkedTxIds)).all()
    : [];
  const linkedTxMap = new Map(linkedTransactions.map(t => [t.id, t]));

  const linkedAccountIds = [...new Set(linkedTransactions.map(t => t.accountId))];
  const linkedAccounts = linkedAccountIds.length > 0
    ? db.select().from(accounts).where(inArray(accounts.id, linkedAccountIds)).all()
    : [];
  const linkedAccountMap = new Map(linkedAccounts.map(a => [a.id, a]));

  return {
    transactions: paginated.map(t => {
      const linkedTx = t.linkedTransactionId ? linkedTxMap.get(t.linkedTransactionId) : null;
      const linkedAccount = linkedTx ? linkedAccountMap.get(linkedTx.accountId) : null;

      return {
        ...t,
        category: t.categoryId ? categoryMap.get(t.categoryId) : null,
        account: accountMap.get(t.accountId),
        hasLinkedTransaction: !!t.linkedTransactionId,
        linkedAccountName: linkedAccount?.name ?? null,
      };
    }),
    total: allTransactions.length,
    hasMore: offset + limit < allTransactions.length,
  };
}

export function getTransactionById(id: string) {
  const transaction = db.select()
    .from(transactions)
    .where(eq(transactions.id, id))
    .get();

  if (!transaction) return null;

  const category = transaction.categoryId
    ? db.select().from(categories).where(eq(categories.id, transaction.categoryId)).get()
    : null;
  const account = db.select().from(accounts).where(eq(accounts.id, transaction.accountId)).get();

  // Get linked transaction details if exists
  let linkedTransaction = null;
  if (transaction.linkedTransactionId) {
    const linkedTx = db.select()
      .from(transactions)
      .where(eq(transactions.id, transaction.linkedTransactionId))
      .get();
    if (linkedTx) {
      const linkedAccount = db.select().from(accounts).where(eq(accounts.id, linkedTx.accountId)).get();
      const linkedCategory = linkedTx.categoryId
        ? db.select().from(categories).where(eq(categories.id, linkedTx.categoryId)).get()
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
}

export function getFlaggedTransactions(limit = 100) {
  const txns = db.select()
    .from(transactions)
    .where(eq(transactions.isFlagged, true))
    .limit(limit)
    .all();

  const categoryIds = [...new Set(txns.map(t => t.categoryId).filter(Boolean))] as string[];
  const allCategories = categoryIds.length > 0
    ? db.select().from(categories).where(inArray(categories.id, categoryIds)).all()
    : [];
  const categoryMap = new Map(allCategories.map(c => [c.id, c]));

  return txns.map(t => ({
    ...t,
    category: t.categoryId ? categoryMap.get(t.categoryId) : null,
  }));
}

export function getRecentTransactions(limit = 10) {
  const txns = db.select()
    .from(transactions)
    .orderBy(desc(transactions.date))
    .limit(limit)
    .all();

  const categoryIds = [...new Set(txns.map(t => t.categoryId).filter(Boolean))] as string[];
  const allCategories = categoryIds.length > 0
    ? db.select().from(categories).where(inArray(categories.id, categoryIds)).all()
    : [];
  const categoryMap = new Map(allCategories.map(c => [c.id, c]));

  const accountIds = [...new Set(txns.map(t => t.accountId))];
  const allAccounts = accountIds.length > 0
    ? db.select().from(accounts).where(inArray(accounts.id, accountIds)).all()
    : [];
  const accountMap = new Map(allAccounts.map(a => [a.id, a]));

  return txns.map(t => ({
    ...t,
    category: t.categoryId ? categoryMap.get(t.categoryId) : null,
    account: accountMap.get(t.accountId),
  }));
}

export function countTransactionsByAccount(accountId: string) {
  const txns = db.select()
    .from(transactions)
    .where(eq(transactions.accountId, accountId))
    .all();
  return txns.length;
}

export function findSimilarTransactions(transactionId: string, limit = 10) {
  const SIMILARITY_THRESHOLD = 0.4;

  const target = db.select().from(transactions).where(eq(transactions.id, transactionId)).get();
  if (!target) return [];

  // Get all uncategorized transactions (excluding target)
  const allTxns = db.select().from(transactions).all();
  const uncategorized = allTxns.filter(t => !t.categoryId && t.id !== transactionId);

  // Score each transaction
  type ScoredTransaction = typeof transactions.$inferSelect & {
    similarityScore: number;
    matchLevel: 'strong' | 'good' | 'weak' | 'none';
  };

  const scored: ScoredTransaction[] = uncategorized.map(t => {
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
    .filter(t => t.similarityScore >= SIMILARITY_THRESHOLD)
    .sort((a, b) => b.similarityScore - a.similarityScore)
    .slice(0, limit);

  // Get accounts for context
  const accountIds = [...new Set(filtered.map(t => t.accountId))];
  const accountsList = accountIds.length > 0
    ? db.select().from(accounts).where(inArray(accounts.id, accountIds)).all()
    : [];
  const accountMap = new Map(accountsList.map(a => [a.id, a]));

  return filtered.map(t => ({
    id: t.id,
    description: t.description,
    amount: t.amount,
    date: t.date,
    similarityScore: t.similarityScore,
    matchLevel: t.matchLevel as 'strong' | 'good' | 'weak',
    account: accountMap.get(t.accountId),
  }));
}

/**
 * Find potential transactions to link with the given transaction.
 *
 * Matching criteria:
 * - Different account (transfers are cross-account)
 * - Opposite sign amounts (debit <-> credit)
 * - Amounts within tolerance (default 1% for fees)
 * - Dates within range (default 3 days for processing delays)
 * - Not already linked
 *
 * Returns candidates sorted by match score (higher = better match).
 */
export function findPotentialLinks(
  transactionId: string,
  amountTolerance = 0.01,
  dayRange = 3
) {
  const msRange = dayRange * 24 * 60 * 60 * 1000;

  // Get the target transaction
  const target = db.select().from(transactions).where(eq(transactions.id, transactionId)).get();
  if (!target) {
    return [];
  }

  // If already linked, return empty
  if (target.linkedTransactionId) {
    return [];
  }

  // Get all transactions
  const allTransactions = db.select().from(transactions).all();

  // Find candidates
  const candidates = allTransactions.filter((t) => {
    // Must be different transaction
    if (t.id === transactionId) return false;

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

  // Get all accounts for candidates
  const accountIds = [...new Set(candidates.map(c => c.accountId))];
  const accountsList = accountIds.length > 0
    ? db.select().from(accounts).where(inArray(accounts.id, accountIds)).all()
    : [];
  const accountMap = new Map(accountsList.map(a => [a.id, a]));

  // Score each candidate
  const scored = candidates.map((t) => {
    const account = accountMap.get(t.accountId);

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
      _id: t.id,
      accountId: t.accountId,
      accountName: account?.name ?? "Unknown",
      date: t.date,
      description: t.description,
      amount: t.amount,
      score,
    };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  return scored;
}

/**
 * Get the linked transaction with full details including account.
 */
export function getLinkedTransaction(transactionId: string) {
  const tx = db.select().from(transactions).where(eq(transactions.id, transactionId)).get();
  if (!tx || !tx.linkedTransactionId) {
    return null;
  }

  const linkedTx = db.select().from(transactions).where(eq(transactions.id, tx.linkedTransactionId)).get();
  if (!linkedTx) {
    return null;
  }

  const account = db.select().from(accounts).where(eq(accounts.id, linkedTx.accountId)).get();
  const category = linkedTx.categoryId
    ? db.select().from(categories).where(eq(categories.id, linkedTx.categoryId)).get()
    : null;

  return {
    ...linkedTx,
    account,
    category,
  };
}

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
