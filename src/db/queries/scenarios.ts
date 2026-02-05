import { db } from '../index';
import { scenarios } from '../schema';
import { eq, asc } from 'drizzle-orm';

export function listScenarios() {
  return db.select()
    .from(scenarios)
    .orderBy(asc(scenarios.name))
    .all();
}

export function getScenarioById(id: string) {
  return db.select()
    .from(scenarios)
    .where(eq(scenarios.id, id))
    .get();
}

export function getBaselineScenario() {
  return db.select()
    .from(scenarios)
    .where(eq(scenarios.isBaseline, true))
    .get();
}

export type Scenario = typeof scenarios.$inferSelect;
export type NewScenario = typeof scenarios.$inferInsert;
