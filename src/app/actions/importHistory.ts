'use server';

import { db } from '@/db';
import { importHistory } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export type CreateImportHistoryInput = {
  filename: string;
  institution: string;
  accountId?: string;
  transactionCount: number;
  duplicatesSkipped: number;
  status: 'success' | 'partial' | 'failed';
  errors?: string[];
};

export async function createImportHistory(input: CreateImportHistoryInput) {
  const result = db.insert(importHistory).values({
    ...input,
    importedAt: Date.now(),
  }).returning().get();

  revalidatePath('/transactions');
  return result;
}

export async function deleteImportHistory(id: string) {
  db.delete(importHistory).where(eq(importHistory.id, id)).run();

  revalidatePath('/transactions');
  return id;
}
