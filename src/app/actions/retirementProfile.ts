'use server';

import { db } from '@/db';
import { retirementProfile } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export type UpsertRetirementProfileInput = {
  retirementDate: number;
  currentAge: number;
  annualSpending: number;
  isSpendingAutoCalculated: boolean;
  monthlyBaseLivingExpense?: number;
  isBaseLivingExpenseAutoCalculated?: boolean;
};

export async function upsertRetirementProfile(input: UpsertRetirementProfileInput) {
  const existing = db.select().from(retirementProfile).get();

  if (existing) {
    db.update(retirementProfile)
      .set(input)
      .where(eq(retirementProfile.id, existing.id))
      .run();

    revalidatePath('/projections');
    revalidatePath('/goals');
    revalidatePath('/');
    return existing.id;
  } else {
    const result = db.insert(retirementProfile).values(input).returning().get();

    revalidatePath('/projections');
    revalidatePath('/goals');
    revalidatePath('/');
    return result.id;
  }
}

export async function updateRetirementProfile(input: Partial<UpsertRetirementProfileInput>) {
  const existing = db.select().from(retirementProfile).get();

  if (!existing) {
    throw new Error('Retirement profile not found. Create one first.');
  }

  const cleanUpdates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      cleanUpdates[key] = value;
    }
  }

  db.update(retirementProfile)
    .set(cleanUpdates)
    .where(eq(retirementProfile.id, existing.id))
    .run();

  revalidatePath('/projections');
  revalidatePath('/goals');
  revalidatePath('/');
  return existing.id;
}
