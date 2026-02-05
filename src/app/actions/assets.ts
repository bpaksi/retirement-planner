'use server';

import { db } from '@/db';
import { assets } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export type CreateAssetInput = {
  type: 'home' | 'vehicle' | 'other';
  name: string;
  address?: string;
  zillowId?: string;
  currentValue: number;
  isAutoUpdated?: boolean;
  purchasePrice?: number;
  purchaseDate?: number;
  notes?: string;
};

export async function createAsset(input: CreateAssetInput) {
  const result = db.insert(assets).values({
    ...input,
    isAutoUpdated: input.isAutoUpdated ?? false,
    lastUpdated: Date.now(),
  }).returning().get();

  revalidatePath('/');
  return result;
}

export type UpdateAssetInput = {
  id: string;
  name?: string;
  address?: string;
  zillowId?: string;
  currentValue?: number;
  isAutoUpdated?: boolean;
  purchasePrice?: number;
  purchaseDate?: number;
  notes?: string;
};

export async function updateAsset(input: UpdateAssetInput) {
  const { id, ...updates } = input;

  const cleanUpdates: Record<string, unknown> = {
    lastUpdated: Date.now(),
  };
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      cleanUpdates[key] = value;
    }
  }

  db.update(assets)
    .set(cleanUpdates)
    .where(eq(assets.id, id))
    .run();

  revalidatePath('/');
  return id;
}

export async function deleteAsset(id: string) {
  db.delete(assets).where(eq(assets.id, id)).run();

  revalidatePath('/');
  return id;
}
