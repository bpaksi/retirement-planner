import { mutation } from "../_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    name: v.string(),
    type: v.union(
      v.literal("401k"),
      v.literal("403b"),
      v.literal("traditional_ira"),
      v.literal("roth_ira"),
      v.literal("roth_401k"),
      v.literal("brokerage"),
      v.literal("checking"),
      v.literal("savings"),
      v.literal("money_market"),
      v.literal("credit_card"),
      v.literal("loan"),
      v.literal("other")
    ),
    institution: v.string(),
    accountNumberLast4: v.optional(v.string()),
    taxTreatment: v.union(
      v.literal("taxable"),
      v.literal("tax_deferred"),
      v.literal("tax_free")
    ),
    isRetirement: v.boolean(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const id = await ctx.db.insert("accounts", {
      ...args,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id("accounts"),
    name: v.optional(v.string()),
    institution: v.optional(v.string()),
    accountNumberLast4: v.optional(v.string()),
    notes: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;

    // Filter out undefined values
    const cleanUpdates: Record<string, unknown> = {
      updatedAt: Date.now(),
    };
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        cleanUpdates[key] = value;
      }
    }

    await ctx.db.patch(id, cleanUpdates);
    return id;
  },
});

export const archive = mutation({
  args: { id: v.id("accounts") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      isActive: false,
      updatedAt: Date.now(),
    });
    return args.id;
  },
});

export const remove = mutation({
  args: { id: v.id("accounts") },
  handler: async (ctx, args) => {
    // Check if account has transactions
    const transactions = await ctx.db
      .query("transactions")
      .withIndex("by_account", (q) => q.eq("accountId", args.id))
      .first();

    if (transactions) {
      throw new Error(
        "Cannot delete account with transactions. Archive it instead."
      );
    }

    await ctx.db.delete(args.id);
    return args.id;
  },
});
