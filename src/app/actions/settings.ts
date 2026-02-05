'use server';

import { db } from '@/db';
import { settings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function setSetting(key: string, value: unknown) {
  const existing = db.select().from(settings).where(eq(settings.key, key)).get();

  if (existing) {
    db.update(settings)
      .set({ value })
      .where(eq(settings.id, existing.id))
      .run();

    revalidatePath('/settings');
    return existing.id;
  } else {
    const result = db.insert(settings).values({ key, value }).returning().get();

    revalidatePath('/settings');
    return result.id;
  }
}

export async function deleteSetting(key: string) {
  db.delete(settings).where(eq(settings.key, key)).run();

  revalidatePath('/settings');
  return key;
}
