import { db } from '../index';
import { accountSnapshots, accounts } from '../schema';
import { eq, desc, inArray } from 'drizzle-orm';

export function listSnapshots() {
  return db.select()
    .from(accountSnapshots)
    .orderBy(desc(accountSnapshots.date))
    .all();
}

export function getSnapshotsByAccount(accountId: string) {
  return db.select()
    .from(accountSnapshots)
    .where(eq(accountSnapshots.accountId, accountId))
    .orderBy(desc(accountSnapshots.date))
    .all();
}

export function getLatestSnapshotByAccount(accountId: string) {
  return db.select()
    .from(accountSnapshots)
    .where(eq(accountSnapshots.accountId, accountId))
    .orderBy(desc(accountSnapshots.date))
    .limit(1)
    .get();
}

export function getLatestSnapshots() {
  const allSnapshots = db.select().from(accountSnapshots).all();

  // Group by account and get latest for each
  const latestByAccount = new Map<string, typeof accountSnapshots.$inferSelect>();

  for (const snapshot of allSnapshots) {
    const existing = latestByAccount.get(snapshot.accountId);
    if (!existing || snapshot.date > existing.date) {
      latestByAccount.set(snapshot.accountId, snapshot);
    }
  }

  return Array.from(latestByAccount.values());
}

export function getSnapshotsWithAccounts() {
  const snapshots = getLatestSnapshots();

  const accountIds = [...new Set(snapshots.map(s => s.accountId))];
  const allAccounts = accountIds.length > 0
    ? db.select().from(accounts).where(inArray(accounts.id, accountIds)).all()
    : [];
  const accountMap = new Map(allAccounts.map(a => [a.id, a]));

  return snapshots.map(s => ({
    ...s,
    account: accountMap.get(s.accountId),
  }));
}

export type AccountSnapshot = typeof accountSnapshots.$inferSelect;
export type NewAccountSnapshot = typeof accountSnapshots.$inferInsert;
