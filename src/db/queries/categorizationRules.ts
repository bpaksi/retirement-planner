import { db } from '../index';
import { categorizationRules, categories } from '../schema';
import { eq, desc } from 'drizzle-orm';

export function listRules() {
  return db.select()
    .from(categorizationRules)
    .orderBy(desc(categorizationRules.priority))
    .all();
}

export function listActiveRules() {
  return db.select()
    .from(categorizationRules)
    .where(eq(categorizationRules.isActive, true))
    .orderBy(desc(categorizationRules.priority))
    .all();
}

export function listRulesWithCategories() {
  const rules = db.select()
    .from(categorizationRules)
    .orderBy(desc(categorizationRules.priority))
    .all();

  const allCategories = db.select().from(categories).all();
  const categoryMap = new Map(allCategories.map(c => [c.id, c]));

  type CategoryType = typeof allCategories[number];
  type RuleWithCategory = CategorizationRule & { category: CategoryType | null };

  return rules.map((rule): RuleWithCategory => ({
    ...rule,
    category: categoryMap.get(rule.categoryId) ?? null,
  }));
}

export function getRuleById(id: string) {
  return db.select()
    .from(categorizationRules)
    .where(eq(categorizationRules.id, id))
    .get();
}

export function getRulesByCategory(categoryId: string) {
  return db.select()
    .from(categorizationRules)
    .where(eq(categorizationRules.categoryId, categoryId))
    .all();
}

export type CategorizationRule = typeof categorizationRules.$inferSelect;
export type NewCategorizationRule = typeof categorizationRules.$inferInsert;
