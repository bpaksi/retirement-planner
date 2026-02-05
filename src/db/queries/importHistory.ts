import { db } from '../index';
import { importHistory, accounts } from '../schema';
import { eq, desc, inArray } from 'drizzle-orm';

export function listImportHistory() {
  return db.select()
    .from(importHistory)
    .orderBy(desc(importHistory.importedAt))
    .all();
}

export function getImportById(id: string) {
  return db.select()
    .from(importHistory)
    .where(eq(importHistory.id, id))
    .get();
}

export function getRecentImports(limit = 10) {
  return db.select()
    .from(importHistory)
    .orderBy(desc(importHistory.importedAt))
    .limit(limit)
    .all();
}

export function listImportHistoryWithAccounts() {
  const imports = db.select()
    .from(importHistory)
    .orderBy(desc(importHistory.importedAt))
    .all();

  const accountIds = [...new Set(imports.map(i => i.accountId).filter(Boolean))] as string[];
  const allAccounts = accountIds.length > 0
    ? db.select().from(accounts).where(inArray(accounts.id, accountIds)).all()
    : [];
  const accountMap = new Map(allAccounts.map(a => [a.id, a]));

  return imports.map(i => ({
    ...i,
    account: i.accountId ? accountMap.get(i.accountId) : null,
  }));
}

export type ImportHistory = typeof importHistory.$inferSelect;
export type NewImportHistory = typeof importHistory.$inferInsert;
