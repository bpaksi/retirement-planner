'use server';

import { db } from '@/db';
import { categorizationRules } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export type CreateRuleInput = {
  pattern: string;
  categoryId: string;
  priority: number;
  isActive?: boolean;
  createdBy?: 'system' | 'user' | 'learned';
};

export async function createCategorizationRule(input: CreateRuleInput) {
  const result = db.insert(categorizationRules).values({
    pattern: input.pattern,
    categoryId: input.categoryId,
    priority: input.priority,
    isActive: input.isActive ?? true,
    createdBy: input.createdBy ?? 'user',
    matchCount: 0,
  }).returning().get();

  revalidatePath('/settings/rules');
  return result;
}

export type UpdateRuleInput = {
  id: string;
  pattern?: string;
  categoryId?: string;
  priority?: number;
  isActive?: boolean;
};

export async function updateCategorizationRule(input: UpdateRuleInput) {
  const { id, ...updates } = input;

  // Filter out undefined values
  const cleanUpdates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      cleanUpdates[key] = value;
    }
  }

  db.update(categorizationRules)
    .set(cleanUpdates)
    .where(eq(categorizationRules.id, id))
    .run();

  revalidatePath('/settings/rules');
  return id;
}

export async function deleteCategorizationRule(id: string) {
  db.delete(categorizationRules).where(eq(categorizationRules.id, id)).run();

  revalidatePath('/settings/rules');
  return id;
}

export async function incrementRuleMatchCount(id: string) {
  const rule = db.select().from(categorizationRules).where(eq(categorizationRules.id, id)).get();
  if (rule) {
    db.update(categorizationRules)
      .set({ matchCount: rule.matchCount + 1 })
      .where(eq(categorizationRules.id, id))
      .run();
  }
  return id;
}
