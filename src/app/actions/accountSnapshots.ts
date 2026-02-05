'use server';

import { db } from '@/db';
import { accountSnapshots } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export type CreateSnapshotInput = {
  accountId: string;
  date: number;
  balance: number;
  isManual?: boolean;
};

export async function createAccountSnapshot(input: CreateSnapshotInput) {
  const result = db.insert(accountSnapshots).values({
    accountId: input.accountId,
    date: input.date,
    balance: input.balance,
    isManual: input.isManual ?? true,
  }).returning().get();

  revalidatePath('/accounts');
  revalidatePath('/');
  return result;
}

export async function upsertAccountSnapshot(input: CreateSnapshotInput) {
  // Check if snapshot exists for this account and date
  // Use start of day for comparison
  const dateStart = new Date(input.date);
  dateStart.setHours(0, 0, 0, 0);
  const dateEnd = new Date(input.date);
  dateEnd.setHours(23, 59, 59, 999);

  const existing = db.select()
    .from(accountSnapshots)
    .where(eq(accountSnapshots.accountId, input.accountId))
    .all()
    .find(s => s.date >= dateStart.getTime() && s.date <= dateEnd.getTime());

  if (existing) {
    db.update(accountSnapshots)
      .set({
        balance: input.balance,
        isManual: input.isManual ?? true,
      })
      .where(eq(accountSnapshots.id, existing.id))
      .run();

    revalidatePath('/accounts');
    revalidatePath('/');
    return existing.id;
  } else {
    const result = db.insert(accountSnapshots).values({
      accountId: input.accountId,
      date: input.date,
      balance: input.balance,
      isManual: input.isManual ?? true,
    }).returning().get();

    revalidatePath('/accounts');
    revalidatePath('/');
    return result.id;
  }
}

export async function deleteAccountSnapshot(id: string) {
  db.delete(accountSnapshots).where(eq(accountSnapshots.id, id)).run();

  revalidatePath('/accounts');
  revalidatePath('/');
  return id;
}
