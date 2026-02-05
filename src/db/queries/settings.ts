import { db } from '../index';
import { settings } from '../schema';
import { eq } from 'drizzle-orm';

export function getSetting(key: string) {
  return db.select()
    .from(settings)
    .where(eq(settings.key, key))
    .get();
}

export function getSettingValue<T>(key: string, defaultValue: T): T {
  const setting = getSetting(key);
  return setting?.value as T ?? defaultValue;
}

export function listSettings() {
  return db.select().from(settings).all();
}

export type Setting = typeof settings.$inferSelect;
export type NewSetting = typeof settings.$inferInsert;
