'use server';

import { db } from '@/db';
import { oneTimeEvents } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export type CreateOneTimeEventInput = {
  name: string;
  year: number;
  amount: number;
  category?: string;
  notes?: string;
};

export async function createOneTimeEvent(input: CreateOneTimeEventInput) {
  const result = db.insert(oneTimeEvents).values({
    ...input,
    createdAt: Date.now(),
  }).returning().get();

  revalidatePath('/goals');
  revalidatePath('/projections');
  return result;
}

export type UpdateOneTimeEventInput = {
  id: string;
  name?: string;
  year?: number;
  amount?: number;
  category?: string;
  notes?: string;
};

export async function updateOneTimeEvent(input: UpdateOneTimeEventInput) {
  const { id, ...updates } = input;

  const cleanUpdates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      cleanUpdates[key] = value;
    }
  }

  db.update(oneTimeEvents)
    .set(cleanUpdates)
    .where(eq(oneTimeEvents.id, id))
    .run();

  revalidatePath('/goals');
  revalidatePath('/projections');
  return id;
}

export async function deleteOneTimeEvent(id: string) {
  db.delete(oneTimeEvents).where(eq(oneTimeEvents.id, id)).run();

  revalidatePath('/goals');
  revalidatePath('/projections');
  return id;
}
