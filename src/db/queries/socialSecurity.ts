import { db } from '../index';
import { socialSecurity } from '../schema';

export function getSocialSecurity() {
  return db.select().from(socialSecurity).get();
}

export type SocialSecurity = typeof socialSecurity.$inferSelect;
export type NewSocialSecurity = typeof socialSecurity.$inferInsert;
