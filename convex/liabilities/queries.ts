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

    // Combine saved extra monthly with calculator extra monthly
    const savedExtraMonthly = liability.extraPaymentMonthly ?? 0;
    const calculatorExtraMonthly = args.extraMonthly ?? 0;
    const totalExtraMonthly = savedExtraMonthly + calculatorExtraMonthly;

    // Combine saved scheduled payments with calculator one-time payment
    const savedScheduledPayments = (liability.scheduledPayments ?? []).map(p => ({
      amount: p.amount,
      date: p.date,
    }));

    const allOneTimePayments: Array<{ amount: number; date: number }> = [...savedScheduledPayments];
    if (args.oneTimePayment && args.oneTimePayment > 0 && args.oneTimePaymentDate) {
      allOneTimePayments.push({
        amount: args.oneTimePayment,
        date: args.oneTimePaymentDate,
      });
    }

    // Sort by date
    allOneTimePayments.sort((a, b) => a.date - b.date);

    // Calculate baseline (minimum payment only, no extras)
    // This shows what would happen with just the minimum payment
    const baselineResult = calculatePayoffWithMultipleOneTime(
      currentBalance,
      monthlyRate,
      minimumPayment,
      0,  // No extra monthly
      [], // No one-time payments
      termMonths
    );

    // Calculate forecast with all applied extras (saved + calculator)
    const forecastResult = calculatePayoffWithMultipleOneTime(
      currentBalance,
      monthlyRate,
      minimumPayment,
      totalExtraMonthly,
      allOneTimePayments,
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

function calculatePayoffWithMultipleOneTime(
  startingBalance: number,
  monthlyRate: number,
  monthlyPayment: number,
  extraMonthly: number,
  oneTimePayments: Array<{ amount: number; date: number }>,
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
  const appliedOneTimePayments = new Set<number>();

  const now = Date.now();

  while (balance > 0.01 && paymentNumber < maxMonths + 120) {
    paymentNumber++;

    const paymentDate = new Date(now);
    paymentDate.setMonth(paymentDate.getMonth() + paymentNumber);
    const paymentTimestamp = paymentDate.getTime();

    // Check if any one-time payments should be applied this month
    let extraThisMonth = extraMonthly;
    for (let i = 0; i < oneTimePayments.length; i++) {
      if (appliedOneTimePayments.has(i)) continue;

      const oneTime = oneTimePayments[i];
      if (paymentTimestamp >= oneTime.date) {
        extraThisMonth += oneTime.amount;
        appliedOneTimePayments.add(i);
      }
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

// Calculate liability balance from linked account transactions
export const getCalculatedBalance = query({
  args: { id: v.id("liabilities") },
  handler: async (ctx, args) => {
    const liability = await ctx.db.get(args.id);
    if (!liability) return null;

    // Check prerequisites
    if (!liability.linkedAccountId) {
      return {
        error: "no_linked_account",
        message: "Link an account to enable transaction-based balance calculation",
        liability,
      };
    }

    // Get all transactions for the linked account
    const transactions = await ctx.db
      .query("transactions")
      .withIndex("by_account", (q) => q.eq("accountId", liability.linkedAccountId!))
      .collect();

    if (transactions.length === 0) {
      const originalAmount = liability.originalAmount ?? 0;
      return {
        error: "no_transactions",
        message: "No transactions found for linked account",
        liability,
        calculatedBalance: originalAmount,
        currentBalance: liability.currentBalance,
        difference: originalAmount - liability.currentBalance,
        transactionCount: 0,
        dateRange: null,
      };
    }

    // Separate loan funding from payments
    // "Loan Funding" transaction represents the original loan amount (negative = debt created)
    // All other transactions are payments (positive = reduces debt)
    const loanFundingTxn = transactions.find(
      (t) => t.description.toLowerCase().includes("loan funding")
    );
    const paymentTransactions = transactions.filter(
      (t) => !t.description.toLowerCase().includes("loan funding")
    );

    // Determine original amount:
    // 1. Use liability.originalAmount if set
    // 2. Otherwise, derive from loan funding transaction (absolute value)
    const originalAmount = liability.originalAmount ??
      (loanFundingTxn ? Math.abs(loanFundingTxn.amount) : 0);

    if (!originalAmount) {
      return {
        error: "no_original_amount",
        message: "Original loan amount is required. Add a 'Loan Funding' transaction or set the original amount manually.",
        liability,
      };
    }

    // Sort payments by date (oldest first) to calculate principal correctly
    const sortedPayments = [...paymentTransactions].sort((a, b) => a.date - b.date);

    // Detect typical payment amount to identify principal-only payments
    // Use median to avoid skewing from large one-time payments
    const paymentAmounts = sortedPayments.map(p => p.amount).sort((a, b) => a - b);
    const medianPayment = paymentAmounts.length > 0
      ? paymentAmounts[Math.floor(paymentAmounts.length / 2)]
      : 0;
    // Payments > 1.5x median are likely principal-only (or have large extra principal)
    const principalOnlyThreshold = medianPayment * 1.5;

    // Calculate balance accounting for interest
    // Each payment = principal + interest, only principal reduces balance
    // Use daily interest accrual for accuracy
    const dailyRate = liability.interestRate / 365;
    let balance = originalAmount;
    let totalPrincipal = 0;
    let totalInterest = 0;
    let principalOnlyCount = 0;
    const warnings: string[] = [];

    if (dailyRate > 0 && sortedPayments.length > 0) {
      // Determine loan start date for first payment's interest calculation
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

        // Large payments (>1.5x median) that come within 15 days of another payment
        // are likely principal-only extra payments
        const daysSinceLastPayment = Math.round(
          (payment.date - lastPaymentDate) / (24 * 60 * 60 * 1000)
        );
        const isLikelyPrincipalOnly =
          payment.amount > principalOnlyThreshold && daysSinceLastPayment < 15;

        if (isPrincipalOnly || isLikelyPrincipalOnly) {
          // Principal-only payment - 100% goes to principal
          balance = Math.max(0, balance - payment.amount);
          totalPrincipal += payment.amount;
          principalOnlyCount++;
          // Don't update lastRegularPaymentDate - interest continues accruing for next regular payment
        } else {
          // Regular payment - calculate interest since last regular payment
          const daysSinceRegular = Math.max(1, Math.round(
            (payment.date - lastRegularPaymentDate) / (24 * 60 * 60 * 1000)
          ));

          // Interest accrued based on actual days
          const interestAccrued = balance * dailyRate * daysSinceRegular;

          // Principal is what's left after covering accrued interest
          const interestPortion = Math.min(interestAccrued, payment.amount);
          const principalPortion = Math.max(0, payment.amount - interestPortion);

          // Reduce balance by principal only
          balance = Math.max(0, balance - principalPortion);

          totalPrincipal += principalPortion;
          totalInterest += interestPortion;
          lastRegularPaymentDate = payment.date;
        }

        lastPaymentDate = payment.date;
      }

      if (principalOnlyCount > 0) {
        warnings.push(`${principalOnlyCount} payment${principalOnlyCount > 1 ? 's' : ''} detected as principal-only`);
      }
    } else if (sortedPayments.length > 0) {
      // No interest rate - fall back to simple subtraction (principal only payments)
      const totalPayments = sortedPayments.reduce((sum, t) => sum + t.amount, 0);
      balance = originalAmount - totalPayments;
      totalPrincipal = totalPayments;
      warnings.push("No interest rate set - assuming all payments are principal only");
    }

    // Clamp to 0 if overpaid
    const calculatedBalance = Math.max(0, balance);
    const isOverpaid = balance < 0;

    // Get date range of all transactions
    const dates = transactions.map((t) => t.date);
    const minDate = Math.min(...dates);
    const maxDate = Math.max(...dates);

    const difference = calculatedBalance - liability.currentBalance;

    if (isOverpaid) {
      warnings.push(`Overpayment detected: ${Math.abs(balance).toFixed(2)} paid beyond original amount`);
    }
    if (!liability.originalAmount && loanFundingTxn) {
      warnings.push(`Original amount derived from "Loan Funding" transaction: ${Math.abs(loanFundingTxn.amount).toFixed(2)}`);
    }

    return {
      liability,
      originalAmount: Math.round(originalAmount * 100) / 100,
      calculatedBalance: Math.round(calculatedBalance * 100) / 100,
      currentBalance: liability.currentBalance,
      difference: Math.round(difference * 100) / 100,
      totalPrincipal: Math.round(totalPrincipal * 100) / 100,
      totalInterest: Math.round(totalInterest * 100) / 100,
      totalPayments: Math.round((totalPrincipal + totalInterest) * 100) / 100,
      transactionCount: transactions.length,
      paymentCount: sortedPayments.length,
      dateRange: {
        start: minDate,
        end: maxDate,
      },
      warnings,
    };
  },
});

// Get combined payment schedule: actual past transactions + projected future payments
export const getPaymentSchedule = query({
  args: {
    id: v.id("liabilities"),
    extraMonthly: v.optional(v.number()),
    oneTimePayment: v.optional(v.number()),
    oneTimePaymentDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const liability = await ctx.db.get(args.id);
    if (!liability) return null;

    const { originalAmount, interestRate, minimumPayment, linkedAccountId } = liability;

    if (!originalAmount || !interestRate || !minimumPayment) {
      return {
        error: "Missing loan data for payment schedule",
        liability,
      };
    }

    // Get actual transactions if linked account exists
    let actualPayments: Array<{
      type: "actual";
      date: number;
      payment: number;
      principal: number;
      interest: number;
      balance: number;
      description: string;
    }> = [];

    let currentBalance = originalAmount;
    const dailyRate = interestRate / 365;

    if (linkedAccountId) {
      const transactions = await ctx.db
        .query("transactions")
        .withIndex("by_account", (q) => q.eq("accountId", linkedAccountId))
        .collect();

      // Filter out loan funding and sort by date
      const payments = transactions
        .filter((t) => !t.description.toLowerCase().includes("loan funding"))
        .sort((a, b) => a.date - b.date);

      // Detect principal-only payments
      const paymentAmounts = payments.map(p => p.amount).sort((a, b) => a - b);
      const medianPayment = paymentAmounts.length > 0
        ? paymentAmounts[Math.floor(paymentAmounts.length / 2)]
        : 0;
      const principalOnlyThreshold = medianPayment * 1.5;

      const loanStartDate = liability.startDate ?? payments[0]?.date ?? Date.now();
      let lastPaymentDate = loanStartDate;
      let lastRegularPaymentDate = loanStartDate;

      for (const payment of payments) {
        if (currentBalance <= 0) break;

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

        let interestPortion = 0;
        let principalPortion = payment.amount;

        if (isPrincipalOnly || isLikelyPrincipalOnly) {
          // Principal-only payment
          principalPortion = payment.amount;
          interestPortion = 0;
        } else {
          // Regular payment
          const daysSinceRegular = Math.max(1, Math.round(
            (payment.date - lastRegularPaymentDate) / (24 * 60 * 60 * 1000)
          ));
          const interestAccrued = currentBalance * dailyRate * daysSinceRegular;
          interestPortion = Math.min(interestAccrued, payment.amount);
          principalPortion = Math.max(0, payment.amount - interestPortion);
          lastRegularPaymentDate = payment.date;
        }

        currentBalance = Math.max(0, currentBalance - principalPortion);
        lastPaymentDate = payment.date;

        actualPayments.push({
          type: "actual",
          date: payment.date,
          payment: Math.round(payment.amount * 100) / 100,
          principal: Math.round(principalPortion * 100) / 100,
          interest: Math.round(interestPortion * 100) / 100,
          balance: Math.round(currentBalance * 100) / 100,
          description: payment.description,
        });
      }
    }

    // Collect all one-time payments (saved + calculator simulated)
    // Saved scheduled payments from DB
    const savedScheduledPayments = (liability.scheduledPayments ?? []).map(p => ({
      amount: p.amount,
      date: p.date,
      description: p.description ?? "Scheduled payment",
      isSimulated: false,
    }));

    // Calculator one-time payment (simulated, not yet saved)
    const simulatedPayments: Array<{
      amount: number;
      date: number;
      description: string;
      isSimulated: boolean;
    }> = [];

    if (args.oneTimePayment && args.oneTimePayment > 0 && args.oneTimePaymentDate) {
      simulatedPayments.push({
        amount: args.oneTimePayment,
        date: args.oneTimePaymentDate,
        description: "One-time payment (simulated)",
        isSimulated: true,
      });
    }

    // Merge and sort all one-time payments by date
    const allOneTimePayments = [...savedScheduledPayments, ...simulatedPayments].sort(
      (a, b) => a.date - b.date
    );

    // Generate projected future payments
    const projectedPayments: Array<{
      type: "projected";
      date: number;
      payment: number;
      principal: number;
      interest: number;
      balance: number;
      paymentNumber: number;
      isSimulated?: boolean;
      description?: string;
    }> = [];

    if (currentBalance > 0.01) {
      const monthlyRate = interestRate / 12;
      // Include both saved extra payment and calculator extra payment
      const savedExtraPayment = liability.extraPaymentMonthly ?? 0;
      const calculatorExtraMonthly = args.extraMonthly ?? 0;
      const totalExtraMonthly = savedExtraPayment + calculatorExtraMonthly;
      const totalMonthlyPayment = minimumPayment + totalExtraMonthly;

      // Track which one-time payments have been applied
      const appliedOneTimePayments = new Set<number>();

      let balance = currentBalance;
      let paymentNumber = 0;

      // Start projections from next month
      const now = new Date();
      const nextPaymentDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      while (balance > 0.01 && paymentNumber < 600) {
        paymentNumber++;

        const paymentDate = new Date(nextPaymentDate);
        paymentDate.setMonth(paymentDate.getMonth() + paymentNumber - 1);
        const paymentTimestamp = paymentDate.getTime();

        // Check if any one-time payments should be applied this month
        for (let i = 0; i < allOneTimePayments.length; i++) {
          if (appliedOneTimePayments.has(i)) continue;

          const oneTime = allOneTimePayments[i];
          const oneTimeDate = new Date(oneTime.date);
          const paymentMonth = paymentDate.getMonth();
          const paymentYear = paymentDate.getFullYear();
          const oneTimeMonth = oneTimeDate.getMonth();
          const oneTimeYear = oneTimeDate.getFullYear();

          if (oneTimeYear < paymentYear || (oneTimeYear === paymentYear && oneTimeMonth <= paymentMonth)) {
            // Apply one-time payment as principal-only
            const oneTimePrincipal = Math.min(oneTime.amount, balance);
            balance = Math.max(0, balance - oneTimePrincipal);
            appliedOneTimePayments.add(i);

            projectedPayments.push({
              type: "projected",
              date: oneTime.date,
              payment: Math.round(oneTimePrincipal * 100) / 100,
              principal: Math.round(oneTimePrincipal * 100) / 100,
              interest: 0,
              balance: Math.round(balance * 100) / 100,
              paymentNumber: 0, // Special marker for one-time
              isSimulated: oneTime.isSimulated,
              description: oneTime.description,
            });

            if (balance <= 0.01) break;
          }
        }

        if (balance <= 0.01) break;

        const interestPayment = balance * monthlyRate;
        let principalPayment = totalMonthlyPayment - interestPayment;
        let payment = totalMonthlyPayment;

        // Last payment adjustment
        if (principalPayment >= balance) {
          principalPayment = balance;
          payment = balance + interestPayment;
        }

        balance = Math.max(0, balance - principalPayment);

        const isSimulated = calculatorExtraMonthly > 0;
        let description: string | undefined;
        if (isSimulated) {
          description = `Payment + $${calculatorExtraMonthly.toFixed(0)} extra (simulated)`;
        } else if (savedExtraPayment > 0) {
          description = `Payment + $${savedExtraPayment.toFixed(0)} extra`;
        }

        projectedPayments.push({
          type: "projected",
          date: paymentTimestamp,
          payment: Math.round(payment * 100) / 100,
          principal: Math.round(principalPayment * 100) / 100,
          interest: Math.round(interestPayment * 100) / 100,
          balance: Math.round(balance * 100) / 100,
          paymentNumber,
          isSimulated,
          description,
        });
      }

      // Sort by date in case one-time payments were inserted
      projectedPayments.sort((a, b) => a.date - b.date);
    }

    return {
      liability,
      actualPayments,
      projectedPayments,
      currentBalance: Math.round(currentBalance * 100) / 100,
      originalAmount,
      totalActualPayments: actualPayments.reduce((sum, p) => sum + p.payment, 0),
      totalActualPrincipal: actualPayments.reduce((sum, p) => sum + p.principal, 0),
      totalActualInterest: actualPayments.reduce((sum, p) => sum + p.interest, 0),
      projectedPayoffDate: projectedPayments.length > 0
        ? projectedPayments[projectedPayments.length - 1].date
        : null,
      remainingPayments: projectedPayments.length,
    };
  },
});

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
