import { db } from '../index';
import { oneTimeEvents } from '../schema';
import { eq, asc } from 'drizzle-orm';

export function listOneTimeEvents() {
  return db.select()
    .from(oneTimeEvents)
    .orderBy(asc(oneTimeEvents.year))
    .all();
}

export function getOneTimeEventById(id: string) {
  return db.select()
    .from(oneTimeEvents)
    .where(eq(oneTimeEvents.id, id))
    .get();
}

export function getOneTimeEventsByYear(year: number) {
  return db.select()
    .from(oneTimeEvents)
    .where(eq(oneTimeEvents.year, year))
    .all();
}

export type OneTimeEvent = typeof oneTimeEvents.$inferSelect;
export type NewOneTimeEvent = typeof oneTimeEvents.$inferInsert;
