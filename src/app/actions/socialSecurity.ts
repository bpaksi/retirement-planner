'use server';

import { db } from '@/db';
import { socialSecurity } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export type UpsertSocialSecurityInput = {
  benefitAt62: number;
  benefitAt67: number;
  benefitAt70: number;
  birthYear: number;
  birthMonth: number;
  colaRate: number;
  plannedClaimingAge?: number;
  hasSpouse?: boolean;
  spouseBenefitAt67?: number;
  spouseBirthYear?: number;
  spousePlannedClaimingAge?: number;
};

export async function upsertSocialSecurity(input: UpsertSocialSecurityInput) {
  const existing = db.select().from(socialSecurity).get();

  if (existing) {
    db.update(socialSecurity)
      .set({
        ...input,
        updatedAt: Date.now(),
      })
      .where(eq(socialSecurity.id, existing.id))
      .run();

    revalidatePath('/projections');
    revalidatePath('/goals');
    return existing.id;
  } else {
    const result = db.insert(socialSecurity).values({
      ...input,
      updatedAt: Date.now(),
    }).returning().get();

    revalidatePath('/projections');
    revalidatePath('/goals');
    return result.id;
  }
}

export async function updateSocialSecurity(input: Partial<UpsertSocialSecurityInput>) {
  const existing = db.select().from(socialSecurity).get();

  if (!existing) {
    throw new Error('Social Security info not found. Create one first.');
  }

  const cleanUpdates: Record<string, unknown> = {
    updatedAt: Date.now(),
  };
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      cleanUpdates[key] = value;
    }
  }

  db.update(socialSecurity)
    .set(cleanUpdates)
    .where(eq(socialSecurity.id, existing.id))
    .run();

  revalidatePath('/projections');
  revalidatePath('/goals');
  return existing.id;
}
