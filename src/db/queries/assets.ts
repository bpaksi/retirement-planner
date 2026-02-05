import { db } from '../index';
import { assets } from '../schema';
import { eq, asc } from 'drizzle-orm';

export function listAssets() {
  return db.select()
    .from(assets)
    .orderBy(asc(assets.name))
    .all();
}

export function getAssetById(id: string) {
  return db.select()
    .from(assets)
    .where(eq(assets.id, id))
    .get();
}

export function getAssetsByType(type: 'home' | 'vehicle' | 'other') {
  return db.select()
    .from(assets)
    .where(eq(assets.type, type))
    .all();
}

export function getTotalAssetValue() {
  const allAssets = db.select().from(assets).all();
  return allAssets.reduce((sum, a) => sum + a.currentValue, 0);
}

export type Asset = typeof assets.$inferSelect;
export type NewAsset = typeof assets.$inferInsert;
