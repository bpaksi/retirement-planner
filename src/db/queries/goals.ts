import { db } from '../index';
import { goals } from '../schema';
import { eq, asc } from 'drizzle-orm';

export function listGoals() {
  return db.select()
    .from(goals)
    .orderBy(asc(goals.name))
    .all();
}

export function getGoalById(id: string) {
  return db.select()
    .from(goals)
    .where(eq(goals.id, id))
    .get();
}

export function getGoalsByType(type: typeof goals.$inferSelect['type']) {
  return db.select()
    .from(goals)
    .where(eq(goals.type, type))
    .all();
}

export function getAchievedGoals() {
  return db.select()
    .from(goals)
    .where(eq(goals.isAchieved, true))
    .all();
}

export function getPendingGoals() {
  return db.select()
    .from(goals)
    .where(eq(goals.isAchieved, false))
    .all();
}

export type Goal = typeof goals.$inferSelect;
export type NewGoal = typeof goals.$inferInsert;
