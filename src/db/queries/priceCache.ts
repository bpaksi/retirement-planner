import { db } from '../index';
import { priceCache } from '../schema';
import { eq, inArray } from 'drizzle-orm';

export function getPriceBySymbol(symbol: string) {
  return db.select()
    .from(priceCache)
    .where(eq(priceCache.symbol, symbol))
    .get();
}

export function getPricesBySymbols(symbols: string[]) {
  if (symbols.length === 0) return [];
  return db.select()
    .from(priceCache)
    .where(inArray(priceCache.symbol, symbols))
    .all();
}

export function listAllPrices() {
  return db.select().from(priceCache).all();
}

export type PriceCache = typeof priceCache.$inferSelect;
export type NewPriceCache = typeof priceCache.$inferInsert;
