'use server';

import { db } from '@/db';
import { goals } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export type CreateGoalInput = {
  type: typeof goals.$inferSelect['type'];
  name: string;
  targetValue: number;
  targetDate?: number;
};

export async function createGoal(input: CreateGoalInput) {
  const result = db.insert(goals).values({
    ...input,
    isAchieved: false,
    createdAt: Date.now(),
  }).returning().get();

  revalidatePath('/goals');
  return result;
}

export type UpdateGoalInput = {
  id: string;
  name?: string;
  targetValue?: number;
  targetDate?: number;
  isAchieved?: boolean;
  achievedDate?: number;
};

export async function updateGoal(input: UpdateGoalInput) {
  const { id, ...updates } = input;

  const cleanUpdates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      cleanUpdates[key] = value;
    }
  }

  db.update(goals)
    .set(cleanUpdates)
    .where(eq(goals.id, id))
    .run();

  revalidatePath('/goals');
  return id;
}

export async function markGoalAchieved(id: string) {
  db.update(goals)
    .set({
      isAchieved: true,
      achievedDate: Date.now(),
    })
    .where(eq(goals.id, id))
    .run();

  revalidatePath('/goals');
  return id;
}

export async function deleteGoal(id: string) {
  db.delete(goals).where(eq(goals.id, id)).run();

  revalidatePath('/goals');
  return id;
}
