import { db } from '../index';
import { holdings, accounts } from '../schema';
import { eq, inArray } from 'drizzle-orm';

export function listHoldings() {
  return db.select().from(holdings).all();
}

export function listHoldingsWithAccounts() {
  const allHoldings = db.select().from(holdings).all();

  const accountIds = [...new Set(allHoldings.map(h => h.accountId))];
  const allAccounts = accountIds.length > 0
    ? db.select().from(accounts).where(inArray(accounts.id, accountIds)).all()
    : [];
  const accountMap = new Map(allAccounts.map(a => [a.id, a]));

  return allHoldings.map(h => ({
    ...h,
    account: accountMap.get(h.accountId),
  }));
}

export function getHoldingById(id: string) {
  return db.select().from(holdings).where(eq(holdings.id, id)).get();
}

export function getHoldingsByAccount(accountId: string) {
  return db.select().from(holdings).where(eq(holdings.accountId, accountId)).all();
}

export function getHoldingsBySymbol(symbol: string) {
  return db.select().from(holdings).where(eq(holdings.symbol, symbol)).all();
}

export function getHoldingsByAssetClass(assetClass: typeof holdings.$inferSelect['assetClass']) {
  return db.select().from(holdings).where(eq(holdings.assetClass, assetClass)).all();
}

export function getTotalPortfolioValue() {
  const allHoldings = db.select().from(holdings).all();
  return allHoldings.reduce((sum, h) => {
    const price = h.lastPrice ?? 0;
    return sum + (h.shares * price);
  }, 0);
}

export function getPortfolioByAssetClass() {
  const allHoldings = db.select().from(holdings).all();

  const byClass: Record<string, { value: number; count: number }> = {};

  for (const h of allHoldings) {
    const price = h.lastPrice ?? 0;
    const value = h.shares * price;

    if (!byClass[h.assetClass]) {
      byClass[h.assetClass] = { value: 0, count: 0 };
    }
    byClass[h.assetClass].value += value;
    byClass[h.assetClass].count += 1;
  }

  return byClass;
}

export type Holding = typeof holdings.$inferSelect;
export type NewHolding = typeof holdings.$inferInsert;
