import { mutation } from "../_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    type: v.union(
      v.literal("mortgage"),
      v.literal("auto_loan"),
      v.literal("student_loan"),
      v.literal("personal_loan"),
      v.literal("credit_card"),
      v.literal("other")
    ),
    name: v.string(),
    currentBalance: v.number(),
    interestRate: v.number(),
    minimumPayment: v.optional(v.number()),
    // Amortization fields
    originalAmount: v.optional(v.number()),
    termMonths: v.optional(v.number()),
    startDate: v.optional(v.number()),
    extraPaymentMonthly: v.optional(v.number()),
    payoffDate: v.optional(v.number()),
    linkedAccountId: v.optional(v.id("accounts")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Calculate monthly payment if not provided but we have amortization data
    let minimumPayment = args.minimumPayment;
    if (
      !minimumPayment &&
      args.originalAmount &&
      args.termMonths &&
      args.interestRate > 0
    ) {
      const monthlyRate = args.interestRate / 12;
      const n = args.termMonths;
      const p = args.originalAmount;
      // Standard amortization formula: M = P * [r(1+r)^n] / [(1+r)^n - 1]
      minimumPayment =
        (p * (monthlyRate * Math.pow(1 + monthlyRate, n))) /
        (Math.pow(1 + monthlyRate, n) - 1);
      minimumPayment = Math.round(minimumPayment * 100) / 100;
    }

    const id = await ctx.db.insert("liabilities", {
      type: args.type,
      name: args.name,
      currentBalance: args.currentBalance,
      interestRate: args.interestRate,
      minimumPayment: minimumPayment ?? 0,
      originalAmount: args.originalAmount,
      termMonths: args.termMonths,
      startDate: args.startDate,
      extraPaymentMonthly: args.extraPaymentMonthly,
      payoffDate: args.payoffDate,
      linkedAccountId: args.linkedAccountId,
      createdAt: now,
      updatedAt: now,
    });

    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id("liabilities"),
    name: v.optional(v.string()),
    currentBalance: v.optional(v.number()),
    interestRate: v.optional(v.number()),
    minimumPayment: v.optional(v.number()),
    originalAmount: v.optional(v.number()),
    termMonths: v.optional(v.number()),
    startDate: v.optional(v.number()),
    extraPaymentMonthly: v.optional(v.number()),
    payoffDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;

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

export const remove = mutation({
  args: { id: v.id("liabilities") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return args.id;
  },
});
