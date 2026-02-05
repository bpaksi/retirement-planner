import { db } from '../index';
import { retirementProfile } from '../schema';

export function getRetirementProfile() {
  return db.select().from(retirementProfile).get();
}

export type RetirementProfile = typeof retirementProfile.$inferSelect;
export type NewRetirementProfile = typeof retirementProfile.$inferInsert;
