'use server';

import { db } from '@/db';
import { transactions, categorizationRules } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export type CreateTransactionInput = {
  accountId: string;
  date: number;
  description: string;
  amount: number;
  categoryId?: string;
  isRecurring?: boolean;
  isFlagged?: boolean;
  confidenceScore?: number;
  tags?: string[];
  importBatchId?: string;
  sourceFile?: string;
  linkedTransactionId?: string;
  isTransfer?: boolean;
};

export async function createTransaction(input: CreateTransactionInput) {
  const result = db.insert(transactions).values({
    accountId: input.accountId,
    date: input.date,
    description: input.description,
    amount: input.amount,
    categoryId: input.categoryId,
    isRecurring: input.isRecurring ?? false,
    isFlagged: input.isFlagged ?? false,
    confidenceScore: input.confidenceScore,
    tags: input.tags ?? [],
    importBatchId: input.importBatchId,
    sourceFile: input.sourceFile,
    linkedTransactionId: input.linkedTransactionId,
    isTransfer: input.isTransfer ?? false,
    createdAt: Date.now(),
  }).returning().get();

  revalidatePath('/transactions');
  revalidatePath('/spending');
  revalidatePath('/');
  return result;
}

export type UpdateTransactionInput = {
  id: string;
  categoryId?: string;
  isRecurring?: boolean;
  isFlagged?: boolean;
  tags?: string[];
  description?: string;
};

export async function updateTransaction(input: UpdateTransactionInput) {
  const { id, ...updates } = input;

  // Filter out undefined values
  const cleanUpdates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      cleanUpdates[key] = value;
    }
  }

  db.update(transactions)
    .set(cleanUpdates)
    .where(eq(transactions.id, id))
    .run();

  revalidatePath('/transactions');
  revalidatePath('/spending');
  return id;
}

export async function updateTransactionCategory(
  id: string,
  categoryId: string,
  unflag = false
) {
  const updates: Record<string, unknown> = {
    categoryId,
  };

  if (unflag) {
    updates.isFlagged = false;
    updates.confidenceScore = 1.0;
  }

  db.update(transactions)
    .set(updates)
    .where(eq(transactions.id, id))
    .run();

  // Optionally create a learned rule from this categorization
  const transaction = db.select().from(transactions).where(eq(transactions.id, id)).get();
  if (transaction) {
    const existingRules = db.select()
      .from(categorizationRules)
      .where(eq(categorizationRules.categoryId, categoryId))
      .all();

    const description = transaction.description.toUpperCase();
    const hasExisting = existingRules.some(r => {
      try {
        return new RegExp(r.pattern, 'i').test(description);
      } catch {
        return false;
      }
    });

    if (!hasExisting && description.length > 3) {
      const words = description.split(/\s+/).filter((w: string) => w.length > 3);
      if (words.length > 0) {
        const pattern = words[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        db.insert(categorizationRules).values({
          pattern,
          categoryId,
          priority: 50,
          isActive: true,
          createdBy: 'learned',
          matchCount: 1,
        }).run();
      }
    }
  }

  revalidatePath('/transactions');
  revalidatePath('/spending');
  return id;
}

export async function bulkUpdateTransactionCategory(
  ids: string[],
  categoryId: string,
  unflag = false
) {
  const updates: Record<string, unknown> = {
    categoryId,
  };

  if (unflag) {
    updates.isFlagged = false;
    updates.confidenceScore = 1.0;
  }

  for (const id of ids) {
    db.update(transactions)
      .set(updates)
      .where(eq(transactions.id, id))
      .run();
  }

  revalidatePath('/transactions');
  revalidatePath('/spending');
  return ids.length;
}

export async function deleteTransaction(id: string) {
  const transaction = db.select().from(transactions).where(eq(transactions.id, id)).get();

  // If this transaction is linked, unlink the paired transaction
  if (transaction?.linkedTransactionId) {
    const linkedTx = db.select()
      .from(transactions)
      .where(eq(transactions.id, transaction.linkedTransactionId))
      .get();
    if (linkedTx) {
      db.update(transactions)
        .set({ linkedTransactionId: null, isTransfer: false })
        .where(eq(transactions.id, linkedTx.id))
        .run();
    }
  }

  db.delete(transactions).where(eq(transactions.id, id)).run();

  revalidatePath('/transactions');
  revalidatePath('/spending');
  return id;
}

export async function bulkDeleteTransactions(ids: string[]) {
  // Collect linked transactions that need to be unlinked
  const linkedIdsToUnlink = new Set<string>();

  for (const id of ids) {
    const transaction = db.select().from(transactions).where(eq(transactions.id, id)).get();
    if (transaction?.linkedTransactionId) {
      if (!ids.includes(transaction.linkedTransactionId)) {
        linkedIdsToUnlink.add(transaction.linkedTransactionId);
      }
    }
  }

  // Unlink paired transactions
  for (const linkedId of linkedIdsToUnlink) {
    db.update(transactions)
      .set({ linkedTransactionId: null, isTransfer: false })
      .where(eq(transactions.id, linkedId))
      .run();
  }

  // Delete the transactions
  for (const id of ids) {
    db.delete(transactions).where(eq(transactions.id, id)).run();
  }

  revalidatePath('/transactions');
  revalidatePath('/spending');
  return ids.length;
}

export async function deleteTransactionsByAccount(accountId: string) {
  const txns = db.select()
    .from(transactions)
    .where(eq(transactions.accountId, accountId))
    .all();

  for (const tx of txns) {
    db.delete(transactions).where(eq(transactions.id, tx.id)).run();
  }

  revalidatePath('/transactions');
  revalidatePath('/spending');
  return { deleted: txns.length };
}

/**
 * Link two transactions together as a transfer.
 * Creates bidirectional references and sets isTransfer=true on both.
 */
export async function linkTransactions(transactionId1: string, transactionId2: string) {
  const tx1 = db.select().from(transactions).where(eq(transactions.id, transactionId1)).get();
  const tx2 = db.select().from(transactions).where(eq(transactions.id, transactionId2)).get();

  if (!tx1 || !tx2) {
    throw new Error("One or both transactions not found");
  }

  // Validation: same account not allowed
  if (tx1.accountId === tx2.accountId) {
    throw new Error("Cannot link transactions from the same account");
  }

  // Validation: already linked to different transaction
  if (tx1.linkedTransactionId && tx1.linkedTransactionId !== transactionId2) {
    throw new Error("Transaction 1 is already linked to a different transaction");
  }
  if (tx2.linkedTransactionId && tx2.linkedTransactionId !== transactionId1) {
    throw new Error("Transaction 2 is already linked to a different transaction");
  }

  // Link both transactions
  db.update(transactions)
    .set({
      linkedTransactionId: transactionId2,
      isTransfer: true,
    })
    .where(eq(transactions.id, transactionId1))
    .run();

  db.update(transactions)
    .set({
      linkedTransactionId: transactionId1,
      isTransfer: true,
    })
    .where(eq(transactions.id, transactionId2))
    .run();

  revalidatePath('/transactions');
  revalidatePath('/spending');
  return { success: true };
}

/**
 * Unlink two transactions.
 * Removes bidirectional references and sets isTransfer=false on both.
 */
export async function unlinkTransactions(transactionId: string) {
  const tx = db.select().from(transactions).where(eq(transactions.id, transactionId)).get();
  if (!tx) {
    throw new Error("Transaction not found");
  }

  if (!tx.linkedTransactionId) {
    throw new Error("Transaction is not linked");
  }

  const linkedTx = db.select().from(transactions).where(eq(transactions.id, tx.linkedTransactionId)).get();

  // Unlink the target transaction
  db.update(transactions)
    .set({
      linkedTransactionId: null,
      isTransfer: false,
    })
    .where(eq(transactions.id, transactionId))
    .run();

  // Unlink the paired transaction if it exists
  if (linkedTx) {
    db.update(transactions)
      .set({
        linkedTransactionId: null,
        isTransfer: false,
      })
      .where(eq(transactions.id, linkedTx.id))
      .run();
  }

  revalidatePath('/transactions');
  revalidatePath('/spending');
  return { success: true };
}

export async function recategorizeUncategorized() {
  // Get all uncategorized transactions
  const allTransactions = db.select().from(transactions).all();
  const uncategorized = allTransactions.filter(t => !t.categoryId);

  if (uncategorized.length === 0) {
    return { updated: 0, stillUncategorized: 0 };
  }

  // Get active categorization rules sorted by priority
  const rules = db.select().from(categorizationRules).all();
  const activeRules = rules
    .filter(r => r.isActive)
    .sort((a, b) => b.priority - a.priority);

  if (activeRules.length === 0) {
    return { updated: 0, stillUncategorized: uncategorized.length };
  }

  let updated = 0;

  for (const tx of uncategorized) {
    for (const rule of activeRules) {
      try {
        const regex = new RegExp(rule.pattern, 'i');
        if (regex.test(tx.description)) {
          const confidenceScore =
            rule.createdBy === 'user'
              ? 1.0
              : rule.createdBy === 'learned'
                ? 0.85
                : rule.priority >= 80
                  ? 0.9
                  : 0.75;

          const isFlagged = confidenceScore < 0.8;

          db.update(transactions)
            .set({
              categoryId: rule.categoryId,
              confidenceScore,
              isFlagged,
            })
            .where(eq(transactions.id, tx.id))
            .run();

          db.update(categorizationRules)
            .set({ matchCount: rule.matchCount + 1 })
            .where(eq(categorizationRules.id, rule.id))
            .run();

          updated++;
          break;
        }
      } catch {
        // Invalid regex, skip
      }
    }
  }

  revalidatePath('/transactions');
  revalidatePath('/spending');
  return {
    updated,
    stillUncategorized: uncategorized.length - updated,
  };
}

// Import batch types and function
export type ImportBatchInput = {
  accountId: string;
  transactions: Array<{
    date: number;
    description: string;
    amount: number;
    originalCategory?: string;
  }>;
  sourceFile: string;
  institution: string;
};

export async function importBatch(input: ImportBatchInput) {
  const { accountId, transactions: txns, sourceFile } = input;
  const errors: string[] = [];
  let imported = 0;
  let duplicates = 0;

  // Generate a batch ID for this import
  const importBatchId = crypto.randomUUID();

  // Get active categorization rules sorted by priority
  const rules = db.select().from(categorizationRules).all();
  const activeRules = rules
    .filter(r => r.isActive)
    .sort((a, b) => b.priority - a.priority);

  // Get existing transactions for this account to check duplicates
  const existingTxns = db.select()
    .from(transactions)
    .where(eq(transactions.accountId, accountId))
    .all();

  // Create a set of existing transaction fingerprints for duplicate detection
  const existingFingerprints = new Set(
    existingTxns.map(t => `${t.date}-${t.description}-${t.amount}`)
  );

  for (const tx of txns) {
    try {
      // Check for duplicates using date + description + amount
      const fingerprint = `${tx.date}-${tx.description}-${tx.amount}`;
      if (existingFingerprints.has(fingerprint)) {
        duplicates++;
        continue;
      }

      // Auto-categorize the transaction
      let categoryId: string | undefined;
      let confidenceScore: number | undefined;
      let isFlagged = false;

      for (const rule of activeRules) {
        try {
          const regex = new RegExp(rule.pattern, 'i');
          if (regex.test(tx.description)) {
            categoryId = rule.categoryId;
            confidenceScore =
              rule.createdBy === 'user'
                ? 1.0
                : rule.createdBy === 'learned'
                  ? 0.85
                  : rule.priority >= 80
                    ? 0.9
                    : 0.75;
            isFlagged = confidenceScore < 0.8;

            // Update rule match count
            db.update(categorizationRules)
              .set({ matchCount: rule.matchCount + 1 })
              .where(eq(categorizationRules.id, rule.id))
              .run();

            break;
          }
        } catch {
          // Invalid regex, skip
        }
      }

      // If no category was matched, flag for review
      if (!categoryId) {
        isFlagged = true;
      }

      // Insert the transaction
      db.insert(transactions).values({
        accountId,
        date: tx.date,
        description: tx.description,
        amount: tx.amount,
        categoryId,
        isRecurring: false,
        isFlagged,
        confidenceScore,
        tags: [],
        importBatchId,
        sourceFile,
        isTransfer: false,
        createdAt: Date.now(),
      }).run();

      // Add to existing fingerprints to prevent duplicates within the same batch
      existingFingerprints.add(fingerprint);
      imported++;
    } catch (error) {
      errors.push(`Failed to import transaction: ${tx.description} - ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  revalidatePath('/transactions');
  revalidatePath('/spending');
  revalidatePath('/');

  return {
    imported,
    duplicates,
    errors,
    importBatchId,
  };
}
