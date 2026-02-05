import { db } from '../index';
import { allocationTargets, accounts } from '../schema';
import { eq, isNull, inArray } from 'drizzle-orm';

export function listAllocationTargets() {
  return db.select().from(allocationTargets).all();
}

export function getGlobalAllocationTargets() {
  return db.select()
    .from(allocationTargets)
    .where(isNull(allocationTargets.accountId))
    .all();
}

export function getAllocationTargetsByAccount(accountId: string) {
  return db.select()
    .from(allocationTargets)
    .where(eq(allocationTargets.accountId, accountId))
    .all();
}

export function getAllocationTargetById(id: string) {
  return db.select()
    .from(allocationTargets)
    .where(eq(allocationTargets.id, id))
    .get();
}

export function getAllocationTargetsWithAccounts() {
  const targets = db.select().from(allocationTargets).all();

  const accountIds = [...new Set(targets.map(t => t.accountId).filter(Boolean))] as string[];
  const allAccounts = accountIds.length > 0
    ? db.select().from(accounts).where(inArray(accounts.id, accountIds)).all()
    : [];
  const accountMap = new Map(allAccounts.map(a => [a.id, a]));

  return targets.map(t => ({
    ...t,
    account: t.accountId ? accountMap.get(t.accountId) : null,
  }));
}

export type AllocationTarget = typeof allocationTargets.$inferSelect;
export type NewAllocationTarget = typeof allocationTargets.$inferInsert;
