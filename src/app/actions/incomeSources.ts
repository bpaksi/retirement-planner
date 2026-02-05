'use server';

import { db } from '@/db';
import { incomeSources } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export type CreateIncomeSourceInput = {
  type: typeof incomeSources.$inferSelect['type'];
  name: string;
  annualAmount: number;
  startDate?: number;
  endDate?: number;
  growthRate: number;
  isTaxable: boolean;
};

export async function createIncomeSource(input: CreateIncomeSourceInput) {
  const result = db.insert(incomeSources).values({
    ...input,
    createdAt: Date.now(),
  }).returning().get();

  revalidatePath('/goals');
  revalidatePath('/projections');
  return result;
}

export type UpdateIncomeSourceInput = {
  id: string;
  type?: typeof incomeSources.$inferSelect['type'];
  name?: string;
  annualAmount?: number;
  startDate?: number;
  endDate?: number;
  growthRate?: number;
  isTaxable?: boolean;
};

export async function updateIncomeSource(input: UpdateIncomeSourceInput) {
  const { id, ...updates } = input;

  const cleanUpdates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      cleanUpdates[key] = value;
    }
  }

  db.update(incomeSources)
    .set(cleanUpdates)
    .where(eq(incomeSources.id, id))
    .run();

  revalidatePath('/goals');
  revalidatePath('/projections');
  return id;
}

export async function deleteIncomeSource(id: string) {
  db.delete(incomeSources).where(eq(incomeSources.id, id)).run();

  revalidatePath('/goals');
  revalidatePath('/projections');
  return id;
}
