import { mutation } from "../_generated/server";
import { v } from "convex/values";

/**
 * Save or update Social Security information.
 * Values should match the SSA statement format.
 */
export const upsert = mutation({
  args: {
    // Monthly benefits from SSA statement
    benefitAt62: v.number(),
    benefitAt67: v.number(),
    benefitAt70: v.number(),
    // Birth date
    birthYear: v.number(),
    birthMonth: v.number(),
    // COLA assumption (default: 2%)
    colaRate: v.optional(v.number()),
    // Planned claiming age
    plannedClaimingAge: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("socialSecurity").first();

    const data = {
      benefitAt62: args.benefitAt62,
      benefitAt67: args.benefitAt67,
      benefitAt70: args.benefitAt70,
      birthYear: args.birthYear,
      birthMonth: args.birthMonth,
      colaRate: args.colaRate ?? 0.02,
      plannedClaimingAge: args.plannedClaimingAge,
      updatedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, data);
      return existing._id;
    }

    return await ctx.db.insert("socialSecurity", data);
  },
});

/**
 * Update just the planned claiming age.
 */
export const updateClaimingAge = mutation({
  args: {
    plannedClaimingAge: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("socialSecurity").first();

    if (!existing) {
      throw new Error("Social Security info not set up. Please enter your benefits first.");
    }

    await ctx.db.patch(existing._id, {
      plannedClaimingAge: args.plannedClaimingAge,
      updatedAt: Date.now(),
    });

    return existing._id;
  },
});

/**
 * Add spouse Social Security information.
 */
export const updateSpouse = mutation({
  args: {
    hasSpouse: v.boolean(),
    spouseBenefitAt67: v.optional(v.number()),
    spouseBirthYear: v.optional(v.number()),
    spousePlannedClaimingAge: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("socialSecurity").first();

    if (!existing) {
      throw new Error("Social Security info not set up. Please enter your benefits first.");
    }

    await ctx.db.patch(existing._id, {
      hasSpouse: args.hasSpouse,
      spouseBenefitAt67: args.spouseBenefitAt67,
      spouseBirthYear: args.spouseBirthYear,
      spousePlannedClaimingAge: args.spousePlannedClaimingAge,
      updatedAt: Date.now(),
    });

    return existing._id;
  },
});

/**
 * Update COLA assumption.
 */
export const updateColaRate = mutation({
  args: {
    colaRate: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("socialSecurity").first();

    if (!existing) {
      throw new Error("Social Security info not set up. Please enter your benefits first.");
    }

    await ctx.db.patch(existing._id, {
      colaRate: args.colaRate,
      updatedAt: Date.now(),
    });

    return existing._id;
  },
});

/**
 * Delete Social Security information.
 */
export const remove = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("socialSecurity").first();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});
