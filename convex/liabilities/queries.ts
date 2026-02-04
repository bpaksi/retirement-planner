import { query } from "../_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("liabilities").collect();
  },
});

// Find loan/mortgage accounts that don't have linked liabilities
export const getUnlinkedLoanAccounts = query({
  args: {},
  handler: async (ctx) => {
    // Get all loan/mortgage accounts
    const allAccounts = await ctx.db.query("accounts").collect();
    const loanAccounts = allAccounts.filter(
      (a) => a.isActive && (a.type === "loan" || a.type === "mortgage")
    );

    // Get all liabilities with linked accounts
    const liabilities = await ctx.db.query("liabilities").collect();
    const linkedAccountIds = new Set(
      liabilities
        .filter((l) => l.linkedAccountId)
        .map((l) => l.linkedAccountId)
    );

    // Return loan accounts that don't have a linked liability
    return loanAccounts.filter((a) => !linkedAccountIds.has(a._id));
  },
});

export const get = query({
  args: { id: v.id("liabilities") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getByAccount = query({
  args: { accountId: v.id("accounts") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("liabilities")
      .withIndex("by_linked_account", (q) => q.eq("linkedAccountId", args.accountId))
      .first();
  },
});

// Generate amortization schedule for a liability
export const getAmortizationSchedule = query({
  args: {
    id: v.id("liabilities"),
    // Optional: calculate from a specific start point
    fromPaymentNumber: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const liability = await ctx.db.get(args.id);
    if (!liability) return null;

    const {
      originalAmount,
      termMonths,
      interestRate,
      startDate,
      extraPaymentMonthly = 0,
      currentBalance,
    } = liability;

    // Need these fields for amortization
    if (!originalAmount || !termMonths || !interestRate || !startDate) {
      return {
        error: "Missing amortization data",
        liability,
        schedule: null,
      };
    }

    const monthlyRate = interestRate / 12;
    const monthlyPayment = liability.minimumPayment;
    const totalPayment = monthlyPayment + extraPaymentMonthly;

    const schedule: Array<{
      paymentNumber: number;
      date: number;
      payment: number;
      principal: number;
      interest: number;
      extraPrincipal: number;
      balance: number;
      totalInterestPaid: number;
      totalPrincipalPaid: number;
    }> = [];

    let balance = originalAmount;
    let totalInterestPaid = 0;
    let totalPrincipalPaid = 0;
    let paymentNumber = 0;

    // Calculate each payment until paid off
    while (balance > 0.01 && paymentNumber < termMonths + 120) {
      // +120 safety limit
      paymentNumber++;

      const interestPayment = balance * monthlyRate;
      let principalPayment = monthlyPayment - interestPayment;
      let extraPrincipal = extraPaymentMonthly;

      // Last payment adjustment
      if (principalPayment + extraPrincipal >= balance) {
        principalPayment = balance;
        extraPrincipal = 0;
      }

      balance -= principalPayment + extraPrincipal;
      if (balance < 0) balance = 0;

      totalInterestPaid += interestPayment;
      totalPrincipalPaid += principalPayment + extraPrincipal;

      // Calculate payment date
      const paymentDate = new Date(startDate);
      paymentDate.setMonth(paymentDate.getMonth() + paymentNumber);

      schedule.push({
        paymentNumber,
        date: paymentDate.getTime(),
        payment: Math.round((monthlyPayment + extraPrincipal) * 100) / 100,
        principal: Math.round(principalPayment * 100) / 100,
        interest: Math.round(interestPayment * 100) / 100,
        extraPrincipal: Math.round(extraPrincipal * 100) / 100,
        balance: Math.round(balance * 100) / 100,
        totalInterestPaid: Math.round(totalInterestPaid * 100) / 100,
        totalPrincipalPaid: Math.round(totalPrincipalPaid * 100) / 100,
      });
    }

    // Calculate summary stats
    const originalPayoffDate = new Date(startDate);
    originalPayoffDate.setMonth(originalPayoffDate.getMonth() + termMonths);

    const actualPayoffDate = schedule.length > 0 ? schedule[schedule.length - 1].date : null;

    const interestWithoutExtra = calculateTotalInterest(
      originalAmount,
      monthlyRate,
      termMonths,
      monthlyPayment
    );

    return {
      liability,
      summary: {
        originalAmount,
        currentBalance,
        monthlyPayment,
        extraPaymentMonthly,
        totalMonthlyPayment: totalPayment,
        interestRate,
        termMonths,
        totalPayments: schedule.length,
        monthsSaved: termMonths - schedule.length,
        totalInterest: Math.round(totalInterestPaid * 100) / 100,
        interestSaved: Math.round((interestWithoutExtra - totalInterestPaid) * 100) / 100,
        originalPayoffDate: originalPayoffDate.getTime(),
        actualPayoffDate,
        startDate,
      },
      // Return subset if requested
      schedule:
        args.fromPaymentNumber !== undefined
          ? schedule.slice(args.fromPaymentNumber - 1)
          : schedule,
    };
  },
});

// Helper to calculate total interest without extra payments
function calculateTotalInterest(
  principal: number,
  monthlyRate: number,
  termMonths: number,
  monthlyPayment: number
): number {
  let balance = principal;
  let totalInterest = 0;

  for (let i = 0; i < termMonths && balance > 0.01; i++) {
    const interest = balance * monthlyRate;
    totalInterest += interest;
    balance -= monthlyPayment - interest;
  }

  return totalInterest;
}

// Forecast payoff with hypothetical extra payments
export const forecastPayoff = query({
  args: {
    id: v.id("liabilities"),
    extraMonthly: v.optional(v.number()),
    oneTimePayment: v.optional(v.number()),
    oneTimePaymentDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const liability = await ctx.db.get(args.id);
    if (!liability) return null;

    const {
      originalAmount,
      termMonths,
      interestRate,
      startDate,
      currentBalance,
      minimumPayment,
    } = liability;

    if (!originalAmount || !termMonths || !interestRate || !startDate) {
      return { error: "Missing amortization data", liability };
    }

    const monthlyRate = interestRate / 12;
    const extraMonthly = args.extraMonthly ?? 0;
    const oneTimePayment = args.oneTimePayment ?? 0;
    const oneTimeDate = args.oneTimePaymentDate ?? Date.now();

    // Calculate baseline (no extra payments)
    const baselineResult = calculatePayoff(
      currentBalance,
      monthlyRate,
      minimumPayment,
      0,
      0,
      0,
      startDate,
      termMonths
    );

    // Calculate with extra payments
    const forecastResult = calculatePayoff(
      currentBalance,
      monthlyRate,
      minimumPayment,
      extraMonthly,
      oneTimePayment,
      oneTimeDate,
      startDate,
      termMonths
    );

    return {
      liability,
      baseline: baselineResult,
      forecast: forecastResult,
      savings: {
        monthsSaved: baselineResult.totalPayments - forecastResult.totalPayments,
        interestSaved: Math.round((baselineResult.totalInterest - forecastResult.totalInterest) * 100) / 100,
      },
    };
  },
});

function calculatePayoff(
  startingBalance: number,
  monthlyRate: number,
  monthlyPayment: number,
  extraMonthly: number,
  oneTimePayment: number,
  oneTimeDate: number,
  loanStartDate: number,
  maxMonths: number
): {
  totalPayments: number;
  payoffDate: number;
  totalInterest: number;
  totalPaid: number;
} {
  let balance = startingBalance;
  let totalInterest = 0;
  let totalPaid = 0;
  let paymentNumber = 0;
  let oneTimeApplied = false;

  const now = Date.now();
  const monthsSinceLoanStart = Math.floor(
    (now - loanStartDate) / (30 * 24 * 60 * 60 * 1000)
  );

  while (balance > 0.01 && paymentNumber < maxMonths + 120) {
    paymentNumber++;

    const paymentDate = new Date(now);
    paymentDate.setMonth(paymentDate.getMonth() + paymentNumber);
    const paymentTimestamp = paymentDate.getTime();

    // Check if one-time payment should be applied this month
    let extraThisMonth = extraMonthly;
    if (!oneTimeApplied && oneTimePayment > 0 && paymentTimestamp >= oneTimeDate) {
      extraThisMonth += oneTimePayment;
      oneTimeApplied = true;
    }

    const interest = balance * monthlyRate;
    let principal = monthlyPayment - interest + extraThisMonth;

    if (principal >= balance) {
      principal = balance;
      totalPaid += balance + interest;
      totalInterest += interest;
      balance = 0;
    } else {
      balance -= principal;
      totalPaid += monthlyPayment + extraThisMonth;
      totalInterest += interest;
    }
  }

  const payoffDate = new Date(now);
  payoffDate.setMonth(payoffDate.getMonth() + paymentNumber);

  return {
    totalPayments: paymentNumber,
    payoffDate: payoffDate.getTime(),
    totalInterest: Math.round(totalInterest * 100) / 100,
    totalPaid: Math.round(totalPaid * 100) / 100,
  };
}

// Get current payment info (where we are in the schedule)
export const getCurrentPaymentInfo = query({
  args: { id: v.id("liabilities") },
  handler: async (ctx, args) => {
    const liability = await ctx.db.get(args.id);
    if (!liability) return null;

    const { originalAmount, termMonths, interestRate, startDate, currentBalance } =
      liability;

    if (!originalAmount || !termMonths || !interestRate || !startDate) {
      return { error: "Missing amortization data", liability };
    }

    const monthlyRate = interestRate / 12;
    const monthlyPayment = liability.minimumPayment;

    // Estimate current payment number based on balance
    let balance = originalAmount;
    let paymentNumber = 0;

    while (balance > currentBalance + 0.01 && paymentNumber < termMonths) {
      paymentNumber++;
      const interest = balance * monthlyRate;
      balance -= monthlyPayment - interest;
    }

    const remainingPayments = termMonths - paymentNumber;
    const payoffDate = new Date(startDate);
    payoffDate.setMonth(payoffDate.getMonth() + termMonths);

    // Next payment breakdown
    const nextInterest = currentBalance * monthlyRate;
    const nextPrincipal = monthlyPayment - nextInterest;

    return {
      liability,
      currentPaymentNumber: paymentNumber,
      remainingPayments,
      estimatedPayoffDate: payoffDate.getTime(),
      nextPayment: {
        total: monthlyPayment,
        principal: Math.round(nextPrincipal * 100) / 100,
        interest: Math.round(nextInterest * 100) / 100,
      },
      equityPercent: Math.round(((originalAmount - currentBalance) / originalAmount) * 100),
    };
  },
});
