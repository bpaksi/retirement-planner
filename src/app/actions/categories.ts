'use server';

import { db } from '@/db';
import { categories, categorizationRules } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export type CreateCategoryInput = {
  name: string;
  parentId?: string;
  type: 'expense' | 'income' | 'transfer';
  isEssential: boolean;
  color: string;
  icon?: string;
  sortOrder: number;
};

export async function createCategory(input: CreateCategoryInput) {
  const result = db.insert(categories).values({
    ...input,
    isSystem: false,
  }).returning().get();

  revalidatePath('/settings');
  revalidatePath('/transactions');
  revalidatePath('/spending');
  return result;
}

export type UpdateCategoryInput = {
  id: string;
  name?: string;
  parentId?: string;
  type?: 'expense' | 'income' | 'transfer';
  isEssential?: boolean;
  color?: string;
  icon?: string;
  sortOrder?: number;
};

export async function updateCategory(input: UpdateCategoryInput) {
  const { id, ...updates } = input;

  // Filter out undefined values
  const cleanUpdates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      cleanUpdates[key] = value;
    }
  }

  db.update(categories)
    .set(cleanUpdates)
    .where(eq(categories.id, id))
    .run();

  revalidatePath('/settings');
  revalidatePath('/transactions');
  revalidatePath('/spending');
  return id;
}

export async function deleteCategory(id: string) {
  // Check if category is system
  const category = db.select().from(categories).where(eq(categories.id, id)).get();
  if (category?.isSystem) {
    throw new Error('Cannot delete system categories');
  }

  // Delete associated rules
  db.delete(categorizationRules)
    .where(eq(categorizationRules.categoryId, id))
    .run();

  // Delete the category
  db.delete(categories).where(eq(categories.id, id)).run();

  revalidatePath('/settings');
  revalidatePath('/transactions');
  revalidatePath('/spending');
  return id;
}
