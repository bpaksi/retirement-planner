'use server';

import { db } from '@/db';
import { liabilities } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import type { ScheduledPayment } from '@/db/schema';

export type CreateLiabilityInput = {
  type: typeof liabilities.$inferSelect['type'];
  name: string;
  currentBalance: number;
  interestRate: number;
  minimumPayment: number;
  originalAmount?: number;
  termMonths?: number;
  startDate?: number;
  extraPaymentMonthly?: number;
  payoffDate?: number;
  linkedAccountId?: string;
  scheduledPayments?: ScheduledPayment[];
};

export async function createLiability(input: CreateLiabilityInput) {
  const now = Date.now();

  const result = db.insert(liabilities).values({
    ...input,
    createdAt: now,
    updatedAt: now,
  }).returning().get();

  revalidatePath('/liabilities');
  revalidatePath('/');
  return result;
}

export type UpdateLiabilityInput = {
  id: string;
  name?: string;
  currentBalance?: number;
  interestRate?: number;
  minimumPayment?: number;
  originalAmount?: number;
  termMonths?: number;
  startDate?: number;
  extraPaymentMonthly?: number;
  payoffDate?: number;
  linkedAccountId?: string;
  scheduledPayments?: ScheduledPayment[];
};

export async function updateLiability(input: UpdateLiabilityInput) {
  const { id, ...updates } = input;

  const cleanUpdates: Record<string, unknown> = {
    updatedAt: Date.now(),
  };
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      cleanUpdates[key] = value;
    }
  }

  db.update(liabilities)
    .set(cleanUpdates)
    .where(eq(liabilities.id, id))
    .run();

  revalidatePath('/liabilities');
  revalidatePath(`/liabilities/${id}`);
  revalidatePath('/');
  return id;
}

export async function deleteLiability(id: string) {
  db.delete(liabilities).where(eq(liabilities.id, id)).run();

  revalidatePath('/liabilities');
  revalidatePath('/');
  return id;
}

export async function syncLiabilityBalance(id: string, balance: number) {
  db.update(liabilities)
    .set({
      currentBalance: balance,
      updatedAt: Date.now(),
    })
    .where(eq(liabilities.id, id))
    .run();

  revalidatePath('/liabilities');
  revalidatePath(`/liabilities/${id}`);
  return id;
}

export async function addScheduledPayment(id: string, payment: ScheduledPayment) {
  const liability = db.select().from(liabilities).where(eq(liabilities.id, id)).get();
  if (!liability) throw new Error('Liability not found');

  const currentPayments = liability.scheduledPayments ?? [];
  const newPayments = [...currentPayments, payment].sort((a, b) => a.date - b.date);

  db.update(liabilities)
    .set({
      scheduledPayments: newPayments,
      updatedAt: Date.now(),
    })
    .where(eq(liabilities.id, id))
    .run();

  revalidatePath('/liabilities');
  revalidatePath(`/liabilities/${id}`);
  return id;
}

export async function removeScheduledPayment(id: string, paymentIndex: number) {
  const liability = db.select().from(liabilities).where(eq(liabilities.id, id)).get();
  if (!liability) throw new Error('Liability not found');

  const currentPayments = liability.scheduledPayments ?? [];
  const newPayments = currentPayments.filter((_, i) => i !== paymentIndex);

  db.update(liabilities)
    .set({
      scheduledPayments: newPayments,
      updatedAt: Date.now(),
    })
    .where(eq(liabilities.id, id))
    .run();

  revalidatePath('/liabilities');
  revalidatePath(`/liabilities/${id}`);
  return id;
}

export async function clearScheduledPayments(id: string) {
  db.update(liabilities)
    .set({
      scheduledPayments: [],
      updatedAt: Date.now(),
    })
    .where(eq(liabilities.id, id))
    .run();

  revalidatePath('/liabilities');
  revalidatePath(`/liabilities/${id}`);
  return id;
}
