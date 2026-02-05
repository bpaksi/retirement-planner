'use server';

import { db } from '@/db';
import { accounts, transactions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export type CreateAccountInput = {
  name: string;
  type: typeof accounts.$inferSelect['type'];
  institution: string;
  accountNumberLast4?: string;
  taxTreatment: typeof accounts.$inferSelect['taxTreatment'];
  isRetirement: boolean;
  notes?: string;
};

export async function createAccount(input: CreateAccountInput) {
  const now = Date.now();

  const result = db.insert(accounts).values({
    ...input,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  }).returning().get();

  revalidatePath('/accounts');
  revalidatePath('/');
  return result;
}

export type UpdateAccountInput = {
  id: string;
  name?: string;
  institution?: string;
  accountNumberLast4?: string;
  taxTreatment?: typeof accounts.$inferSelect['taxTreatment'];
  notes?: string;
  isActive?: boolean;
};

export async function updateAccount(input: UpdateAccountInput) {
  const { id, ...updates } = input;

  // Filter out undefined values
  const cleanUpdates: Record<string, unknown> = {
    updatedAt: Date.now(),
  };
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      cleanUpdates[key] = value;
    }
  }

  db.update(accounts)
    .set(cleanUpdates)
    .where(eq(accounts.id, id))
    .run();

  revalidatePath('/accounts');
  revalidatePath('/');
  return id;
}

export async function archiveAccount(id: string) {
  db.update(accounts)
    .set({
      isActive: false,
      updatedAt: Date.now(),
    })
    .where(eq(accounts.id, id))
    .run();

  revalidatePath('/accounts');
  revalidatePath('/');
  return id;
}

export async function deleteAccount(id: string) {
  // Check if account has transactions
  const txn = db.select()
    .from(transactions)
    .where(eq(transactions.accountId, id))
    .get();

  if (txn) {
    throw new Error('Cannot delete account with transactions. Archive it instead.');
  }

  db.delete(accounts).where(eq(accounts.id, id)).run();

  revalidatePath('/accounts');
  revalidatePath('/');
  return id;
}
