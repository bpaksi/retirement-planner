import { db } from '../index';
import { annualBudgets } from '../schema';
import { eq, asc } from 'drizzle-orm';

export function listAnnualBudgets() {
  return db.select()
    .from(annualBudgets)
    .orderBy(asc(annualBudgets.name))
    .all();
}

export function getAnnualBudgetById(id: string) {
  return db.select()
    .from(annualBudgets)
    .where(eq(annualBudgets.id, id))
    .get();
}

export function getEssentialBudgets() {
  return db.select()
    .from(annualBudgets)
    .where(eq(annualBudgets.isEssential, true))
    .all();
}

export type AnnualBudget = typeof annualBudgets.$inferSelect;
export type NewAnnualBudget = typeof annualBudgets.$inferInsert;
