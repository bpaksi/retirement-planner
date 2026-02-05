'use server';

import { db } from '@/db';
import { annualBudgets } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export type CreateAnnualBudgetInput = {
  name: string;
  annualAmount: number;
  startYear?: number;
  endYear?: number;
  notes?: string;
  isEssential?: boolean;
};

export async function createAnnualBudget(input: CreateAnnualBudgetInput) {
  const result = db.insert(annualBudgets).values({
    ...input,
    createdAt: Date.now(),
  }).returning().get();

  revalidatePath('/goals');
  revalidatePath('/projections');
  return result;
}

export type UpdateAnnualBudgetInput = {
  id: string;
  name?: string;
  annualAmount?: number;
  startYear?: number;
  endYear?: number;
  notes?: string;
  isEssential?: boolean;
};

export async function updateAnnualBudget(input: UpdateAnnualBudgetInput) {
  const { id, ...updates } = input;

  const cleanUpdates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      cleanUpdates[key] = value;
    }
  }

  db.update(annualBudgets)
    .set(cleanUpdates)
    .where(eq(annualBudgets.id, id))
    .run();

  revalidatePath('/goals');
  revalidatePath('/projections');
  return id;
}

export async function deleteAnnualBudget(id: string) {
  db.delete(annualBudgets).where(eq(annualBudgets.id, id)).run();

  revalidatePath('/goals');
  revalidatePath('/projections');
  return id;
}
