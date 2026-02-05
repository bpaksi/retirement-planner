'use server';

import { db } from '@/db';
import { allocationTargets } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export type CreateAllocationTargetInput = {
  accountId?: string;
  assetClass: typeof allocationTargets.$inferSelect['assetClass'];
  targetPercent: number;
  rebalanceThreshold: number;
};

export async function createAllocationTarget(input: CreateAllocationTargetInput) {
  const result = db.insert(allocationTargets).values(input).returning().get();

  revalidatePath('/investments');
  return result;
}

export async function upsertAllocationTarget(input: CreateAllocationTargetInput) {
  // Check if target already exists for this account + asset class
  let existing;
  if (input.accountId) {
    existing = db.select()
      .from(allocationTargets)
      .where(and(
        eq(allocationTargets.accountId, input.accountId),
        eq(allocationTargets.assetClass, input.assetClass)
      ))
      .get();
  } else {
    existing = db.select()
      .from(allocationTargets)
      .where(and(
        isNull(allocationTargets.accountId),
        eq(allocationTargets.assetClass, input.assetClass)
      ))
      .get();
  }

  if (existing) {
    db.update(allocationTargets)
      .set({
        targetPercent: input.targetPercent,
        rebalanceThreshold: input.rebalanceThreshold,
      })
      .where(eq(allocationTargets.id, existing.id))
      .run();

    revalidatePath('/investments');
    return existing.id;
  } else {
    const result = db.insert(allocationTargets).values(input).returning().get();

    revalidatePath('/investments');
    return result.id;
  }
}

export type UpdateAllocationTargetInput = {
  id: string;
  targetPercent?: number;
  rebalanceThreshold?: number;
};

export async function updateAllocationTarget(input: UpdateAllocationTargetInput) {
  const { id, ...updates } = input;

  const cleanUpdates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      cleanUpdates[key] = value;
    }
  }

  db.update(allocationTargets)
    .set(cleanUpdates)
    .where(eq(allocationTargets.id, id))
    .run();

  revalidatePath('/investments');
  return id;
}

export async function deleteAllocationTarget(id: string) {
  db.delete(allocationTargets).where(eq(allocationTargets.id, id)).run();

  revalidatePath('/investments');
  return id;
}
