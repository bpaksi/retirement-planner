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

// Add a scheduled one-time payment
export const addScheduledPayment = mutation({
  args: {
    id: v.id("liabilities"),
    amount: v.number(),
    date: v.number(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const liability = await ctx.db.get(args.id);
    if (!liability) {
      throw new Error("Liability not found");
    }

    const newPayment = {
      amount: args.amount,
      date: args.date,
      description: args.description,
    };

    const existingPayments = liability.scheduledPayments ?? [];
    const updatedPayments = [...existingPayments, newPayment];

    // Sort by date
    updatedPayments.sort((a, b) => a.date - b.date);

    await ctx.db.patch(args.id, {
      scheduledPayments: updatedPayments,
      updatedAt: Date.now(),
    });

    return args.id;
  },
});

// Remove a scheduled one-time payment
export const removeScheduledPayment = mutation({
  args: {
    id: v.id("liabilities"),
    index: v.number(),
  },
  handler: async (ctx, args) => {
    const liability = await ctx.db.get(args.id);
    if (!liability) {
      throw new Error("Liability not found");
    }

    const existingPayments = liability.scheduledPayments ?? [];
    if (args.index < 0 || args.index >= existingPayments.length) {
      throw new Error("Invalid payment index");
    }

    const updatedPayments = existingPayments.filter((_, i) => i !== args.index);

    await ctx.db.patch(args.id, {
      scheduledPayments: updatedPayments.length > 0 ? updatedPayments : undefined,
      updatedAt: Date.now(),
    });

    return args.id;
  },
});

// Clear all scheduled one-time payments
export const clearScheduledPayments = mutation({
  args: {
    id: v.id("liabilities"),
  },
  handler: async (ctx, args) => {
    const liability = await ctx.db.get(args.id);
    if (!liability) {
      throw new Error("Liability not found");
    }

    await ctx.db.patch(args.id, {
      scheduledPayments: undefined,
      updatedAt: Date.now(),
    });

    return args.id;
  },
});

// Sync balance from linked account transactions
export const syncBalanceFromTransactions = mutation({
  args: { id: v.id("liabilities") },
  handler: async (ctx, args) => {
    const liability = await ctx.db.get(args.id);
    if (!liability) {
      throw new Error("Liability not found");
    }

    if (!liability.linkedAccountId) {
      throw new Error("No linked account - cannot calculate balance from transactions");
    }

    // Get all transactions for the linked account
    const transactions = await ctx.db
      .query("transactions")
      .withIndex("by_account", (q) => q.eq("accountId", liability.linkedAccountId!))
      .collect();

    // Separate loan funding from payments
    const loanFundingTxn = transactions.find(
      (t) => t.description.toLowerCase().includes("loan funding")
    );
    const paymentTransactions = transactions.filter(
      (t) => !t.description.toLowerCase().includes("loan funding")
    );

    // Determine original amount
    const originalAmount = liability.originalAmount ??
      (loanFundingTxn ? Math.abs(loanFundingTxn.amount) : 0);

    if (!originalAmount) {
      throw new Error("Original amount is required. Add a 'Loan Funding' transaction or set the original amount manually.");
    }

    // Sort payments by date (oldest first)
    const sortedPayments = [...paymentTransactions].sort((a, b) => a.date - b.date);

    // Detect typical payment amount to identify principal-only payments
    const paymentAmounts = sortedPayments.map(p => p.amount).sort((a, b) => a - b);
    const medianPayment = paymentAmounts.length > 0
      ? paymentAmounts[Math.floor(paymentAmounts.length / 2)]
      : 0;
    const principalOnlyThreshold = medianPayment * 1.5;

    // Calculate balance accounting for interest using daily accrual
    const dailyRate = liability.interestRate / 365;
    let balance = originalAmount;
    let totalPrincipal = 0;
    let totalInterest = 0;

    if (dailyRate > 0 && sortedPayments.length > 0) {
      const loanStartDate = liability.startDate ??
        (loanFundingTxn?.date) ??
        sortedPayments[0].date;

      let lastPaymentDate = loanStartDate;
      let lastRegularPaymentDate = loanStartDate;

      for (const payment of sortedPayments) {
        if (balance <= 0) break;

        const description = payment.description.toLowerCase();
        const isPrincipalOnly =
          description.includes("principal") ||
          description.includes("extra") ||
          description.includes("additional");

        const daysSinceLastPayment = Math.round(
          (payment.date - lastPaymentDate) / (24 * 60 * 60 * 1000)
        );
        const isLikelyPrincipalOnly =
          payment.amount > principalOnlyThreshold && daysSinceLastPayment < 15;

        if (isPrincipalOnly || isLikelyPrincipalOnly) {
          balance = Math.max(0, balance - payment.amount);
          totalPrincipal += payment.amount;
        } else {
          const daysSinceRegular = Math.max(1, Math.round(
            (payment.date - lastRegularPaymentDate) / (24 * 60 * 60 * 1000)
          ));

          const interestAccrued = balance * dailyRate * daysSinceRegular;
          const interestPortion = Math.min(interestAccrued, payment.amount);
          const principalPortion = Math.max(0, payment.amount - interestPortion);

          balance = Math.max(0, balance - principalPortion);
          totalPrincipal += principalPortion;
          totalInterest += interestPortion;
          lastRegularPaymentDate = payment.date;
        }

        lastPaymentDate = payment.date;
      }
    } else if (sortedPayments.length > 0) {
      const totalPayments = sortedPayments.reduce((sum, t) => sum + t.amount, 0);
      balance = originalAmount - totalPayments;
      totalPrincipal = totalPayments;
    }

    const newBalance = Math.max(0, Math.round(balance * 100) / 100);
    const previousBalance = liability.currentBalance;

    // Update the liability (also update originalAmount if derived from transaction)
    const updates: Record<string, unknown> = {
      currentBalance: newBalance,
      updatedAt: Date.now(),
    };
    if (!liability.originalAmount && loanFundingTxn) {
      updates.originalAmount = Math.abs(loanFundingTxn.amount);
    }

    await ctx.db.patch(args.id, updates);

    return {
      previousBalance,
      newBalance,
      originalAmount,
      difference: Math.round((newBalance - previousBalance) * 100) / 100,
      transactionCount: transactions.length,
      paymentCount: sortedPayments.length,
      totalPrincipal: Math.round(totalPrincipal * 100) / 100,
      totalInterest: Math.round(totalInterest * 100) / 100,
      totalPayments: Math.round((totalPrincipal + totalInterest) * 100) / 100,
    };
  },
});
