import { query } from "../_generated/server";

export const get = query({
  args: {},
  handler: async (ctx) => {
    // There should only be one profile (single user app)
    const profile = await ctx.db.query("retirementProfile").first();
    return profile;
  },
});
