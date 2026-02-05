import { db } from '../index';
import { categories } from '../schema';
import { eq, asc } from 'drizzle-orm';

export function listCategories() {
  return db.select()
    .from(categories)
    .orderBy(asc(categories.sortOrder))
    .all();
}

export function getCategoryById(id: string) {
  return db.select()
    .from(categories)
    .where(eq(categories.id, id))
    .get();
}

export function getCategoriesByType(type: 'expense' | 'income' | 'transfer') {
  return db.select()
    .from(categories)
    .where(eq(categories.type, type))
    .orderBy(asc(categories.sortOrder))
    .all();
}

export function getCategoryByName(name: string) {
  return db.select()
    .from(categories)
    .where(eq(categories.name, name))
    .get();
}

export function getTransferCategoryIds(): string[] {
  const transferCategories = db.select({ id: categories.id })
    .from(categories)
    .where(eq(categories.type, 'transfer'))
    .all();
  return transferCategories.map(c => c.id);
}

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
