import { db } from '../index';
import { accounts } from '../schema';
import { eq, and, asc } from 'drizzle-orm';

export function listAccounts(activeOnly = false) {
  if (activeOnly) {
    return db.select()
      .from(accounts)
      .where(eq(accounts.isActive, true))
      .orderBy(asc(accounts.name))
      .all();
  }
  return db.select()
    .from(accounts)
    .orderBy(asc(accounts.name))
    .all();
}

export function getAccountById(id: string) {
  return db.select()
    .from(accounts)
    .where(eq(accounts.id, id))
    .get();
}

export function getAccountsByType(type: typeof accounts.$inferSelect['type']) {
  return db.select()
    .from(accounts)
    .where(eq(accounts.type, type))
    .all();
}

export function getRetirementAccounts() {
  return db.select()
    .from(accounts)
    .where(and(
      eq(accounts.isRetirement, true),
      eq(accounts.isActive, true)
    ))
    .all();
}

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
