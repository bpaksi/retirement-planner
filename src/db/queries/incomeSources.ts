import { db } from '../index';
import { incomeSources } from '../schema';
import { eq, asc } from 'drizzle-orm';

export function listIncomeSources() {
  return db.select()
    .from(incomeSources)
    .orderBy(asc(incomeSources.name))
    .all();
}

export function getIncomeSourceById(id: string) {
  return db.select()
    .from(incomeSources)
    .where(eq(incomeSources.id, id))
    .get();
}

export function getIncomeSourcesByType(type: typeof incomeSources.$inferSelect['type']) {
  return db.select()
    .from(incomeSources)
    .where(eq(incomeSources.type, type))
    .all();
}

export type IncomeSource = typeof incomeSources.$inferSelect;
export type NewIncomeSource = typeof incomeSources.$inferInsert;
