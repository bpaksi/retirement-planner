import { db } from '../index';
import { guardrailsConfig } from '../schema';

export function getGuardrailsConfig() {
  return db.select().from(guardrailsConfig).get();
}

export type GuardrailsConfig = typeof guardrailsConfig.$inferSelect;
export type NewGuardrailsConfig = typeof guardrailsConfig.$inferInsert;
