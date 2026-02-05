'use server';

import { db } from '@/db';
import { holdings, priceCache } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export type CreateHoldingInput = {
  accountId: string;
  symbol: string;
  name: string;
  shares: number;
  costBasis?: number;
  assetClass: typeof holdings.$inferSelect['assetClass'];
  lastPrice?: number;
  lastPriceUpdated?: number;
};

export async function createHolding(input: CreateHoldingInput) {
  const now = Date.now();

  const result = db.insert(holdings).values({
    ...input,
    createdAt: now,
    updatedAt: now,
  }).returning().get();

  revalidatePath('/investments');
  revalidatePath('/');
  return result;
}

export type UpdateHoldingInput = {
  id: string;
  symbol?: string;
  name?: string;
  shares?: number;
  costBasis?: number;
  assetClass?: typeof holdings.$inferSelect['assetClass'];
  lastPrice?: number;
  lastPriceUpdated?: number;
};

export async function updateHolding(input: UpdateHoldingInput) {
  const { id, ...updates } = input;

  const cleanUpdates: Record<string, unknown> = {
    updatedAt: Date.now(),
  };
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      cleanUpdates[key] = value;
    }
  }

  db.update(holdings)
    .set(cleanUpdates)
    .where(eq(holdings.id, id))
    .run();

  revalidatePath('/investments');
  revalidatePath('/');
  return id;
}

export async function deleteHolding(id: string) {
  db.delete(holdings).where(eq(holdings.id, id)).run();

  revalidatePath('/investments');
  revalidatePath('/');
  return id;
}

export async function updateHoldingPrice(id: string, price: number) {
  db.update(holdings)
    .set({
      lastPrice: price,
      lastPriceUpdated: Date.now(),
      updatedAt: Date.now(),
    })
    .where(eq(holdings.id, id))
    .run();

  revalidatePath('/investments');
  revalidatePath('/');
  return id;
}

export async function updatePriceCache(symbol: string, price: number, change?: number, changePercent?: number) {
  const existing = db.select().from(priceCache).where(eq(priceCache.symbol, symbol)).get();

  if (existing) {
    db.update(priceCache)
      .set({
        price,
        change,
        changePercent,
        updatedAt: Date.now(),
      })
      .where(eq(priceCache.id, existing.id))
      .run();
  } else {
    db.insert(priceCache).values({
      symbol,
      price,
      change,
      changePercent,
      updatedAt: Date.now(),
    }).run();
  }

  revalidatePath('/investments');
  return symbol;
}

// Import holdings types and function
export type ImportHoldingsInput = {
  accountId: string;
  holdings: Array<{
    symbol: string;
    name: string;
    shares: number;
    currentValue: number;
    costBasis?: number;
    lastPrice?: number;
    unrealizedGainLoss?: number;
    assetClass: typeof holdings.$inferSelect['assetClass'];
  }>;
  sourceFile: string;
};

export async function importHoldings(input: ImportHoldingsInput) {
  const { accountId, holdings: holdingsData } = input;
  const errors: string[] = [];
  let inserted = 0;
  let updated = 0;
  const now = Date.now();

  // Get existing holdings for this account
  const existingHoldings = db.select()
    .from(holdings)
    .where(eq(holdings.accountId, accountId))
    .all();

  const existingBySymbol = new Map(
    existingHoldings.map(h => [h.symbol.toUpperCase(), h])
  );

  for (const holding of holdingsData) {
    try {
      const symbolUpper = holding.symbol.toUpperCase();
      const existing = existingBySymbol.get(symbolUpper);

      // Calculate lastPrice from currentValue and shares if not provided
      const lastPrice = holding.lastPrice ?? (holding.shares > 0 ? holding.currentValue / holding.shares : 0);

      if (existing) {
        // Update existing holding
        db.update(holdings)
          .set({
            name: holding.name,
            shares: holding.shares,
            costBasis: holding.costBasis,
            assetClass: holding.assetClass,
            lastPrice,
            lastPriceUpdated: now,
            updatedAt: now,
          })
          .where(eq(holdings.id, existing.id))
          .run();
        updated++;
      } else {
        // Insert new holding
        db.insert(holdings).values({
          accountId,
          symbol: holding.symbol,
          name: holding.name,
          shares: holding.shares,
          costBasis: holding.costBasis,
          assetClass: holding.assetClass,
          lastPrice,
          lastPriceUpdated: now,
          createdAt: now,
          updatedAt: now,
        }).run();
        inserted++;
      }

      // Update price cache
      const existingCache = db.select().from(priceCache).where(eq(priceCache.symbol, symbolUpper)).get();
      if (existingCache) {
        db.update(priceCache)
          .set({
            price: lastPrice,
            updatedAt: now,
          })
          .where(eq(priceCache.id, existingCache.id))
          .run();
      } else {
        db.insert(priceCache).values({
          symbol: symbolUpper,
          price: lastPrice,
          updatedAt: now,
        }).run();
      }
    } catch (error) {
      errors.push(`Failed to import holding: ${holding.symbol} - ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  revalidatePath('/investments');
  revalidatePath('/');

  return {
    inserted,
    updated,
    errors,
  };
}
