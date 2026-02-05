'use server';

import { db } from '@/db';
import { guardrailsConfig } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export type UpsertGuardrailsInput = {
  isEnabled: boolean;
  upperThresholdPercent: number;
  lowerThresholdPercent: number;
  spendingAdjustmentPercent: number;
  spendingFloor?: number;
  spendingCeiling?: number;
  strategyType: 'percentage' | 'fixed';
  fixedAdjustmentAmount?: number;
};

export async function upsertGuardrailsConfig(input: UpsertGuardrailsInput) {
  const existing = db.select().from(guardrailsConfig).get();

  if (existing) {
    db.update(guardrailsConfig)
      .set({
        ...input,
        updatedAt: Date.now(),
      })
      .where(eq(guardrailsConfig.id, existing.id))
      .run();

    revalidatePath('/projections');
    return existing.id;
  } else {
    const result = db.insert(guardrailsConfig).values({
      ...input,
      updatedAt: Date.now(),
    }).returning().get();

    revalidatePath('/projections');
    return result.id;
  }
}

export async function toggleGuardrails(enabled: boolean) {
  const existing = db.select().from(guardrailsConfig).get();

  if (!existing) {
    // Create with defaults
    const result = db.insert(guardrailsConfig).values({
      isEnabled: enabled,
      upperThresholdPercent: 0.2,
      lowerThresholdPercent: 0.2,
      spendingAdjustmentPercent: 0.1,
      strategyType: 'percentage',
      updatedAt: Date.now(),
    }).returning().get();

    revalidatePath('/projections');
    return result.id;
  }

  db.update(guardrailsConfig)
    .set({
      isEnabled: enabled,
      updatedAt: Date.now(),
    })
    .where(eq(guardrailsConfig.id, existing.id))
    .run();

  revalidatePath('/projections');
  return existing.id;
}
