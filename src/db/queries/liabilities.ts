import { db } from '../index';
import { liabilities, accounts, transactions } from '../schema';
import { eq } from 'drizzle-orm';

export function listLiabilities() {
  return db.select().from(liabilities).all();
}

export function getLiabilityById(id: string) {
  return db.select().from(liabilities).where(eq(liabilities.id, id)).get();
}

export function getLiabilityByAccount(accountId: string) {
  return db.select()
    .from(liabilities)
    .where(eq(liabilities.linkedAccountId, accountId))
    .get();
}

export function getUnlinkedLoanAccounts() {
  // Get all loan/mortgage accounts
  const allAccounts = db.select().from(accounts).all();
  const loanAccounts = allAccounts.filter(
    a => a.isActive && (a.type === 'loan' || a.type === 'mortgage')
  );

  // Get all liabilities with linked accounts
  const allLiabilities = db.select().from(liabilities).all();
  const linkedAccountIds = new Set(
    allLiabilities.filter(l => l.linkedAccountId).map(l => l.linkedAccountId)
  );

  // Return loan accounts without linked liability
  return loanAccounts.filter(a => !linkedAccountIds.has(a.id));
}

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

export function getAmortizationSchedule(id: string, fromPaymentNumber?: number) {
  const liability = db.select().from(liabilities).where(eq(liabilities.id, id)).get();
  if (!liability) return null;

  const {
    originalAmount,
    termMonths,
    interestRate,
    startDate,
    extraPaymentMonthly = 0,
    currentBalance,
  } = liability;

  if (!originalAmount || !termMonths || !interestRate || !startDate) {
    return {
      error: 'Missing amortization data',
      liability,
      schedule: null,
    };
  }

  const monthlyRate = interestRate / 12;
  const monthlyPayment = liability.minimumPayment;
  const totalPayment = monthlyPayment + (extraPaymentMonthly ?? 0);

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

  while (balance > 0.01 && paymentNumber < termMonths + 120) {
    paymentNumber++;

    const interestPayment = balance * monthlyRate;
    let principalPayment = monthlyPayment - interestPayment;
    let extraPrincipal = extraPaymentMonthly ?? 0;

    if (principalPayment + extraPrincipal >= balance) {
      principalPayment = balance;
      extraPrincipal = 0;
    }

    balance -= principalPayment + extraPrincipal;
    if (balance < 0) balance = 0;

    totalInterestPaid += interestPayment;
    totalPrincipalPaid += principalPayment + extraPrincipal;

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
      extraPaymentMonthly: extraPaymentMonthly ?? 0,
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
    schedule: fromPaymentNumber !== undefined
      ? schedule.slice(fromPaymentNumber - 1)
      : schedule,
  };
}

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

export interface ForecastPayoffArgs {
  id: string;
  extraMonthly?: number;
  oneTimePayment?: number;
  oneTimePaymentDate?: number;
}

export function forecastPayoff(args: ForecastPayoffArgs) {
  const liability = db.select().from(liabilities).where(eq(liabilities.id, args.id)).get();
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
    return { error: 'Missing amortization data', liability };
  }

  const monthlyRate = interestRate / 12;

  const savedExtraMonthly = liability.extraPaymentMonthly ?? 0;
  const calculatorExtraMonthly = args.extraMonthly ?? 0;
  const totalExtraMonthly = savedExtraMonthly + calculatorExtraMonthly;

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

  allOneTimePayments.sort((a, b) => a.date - b.date);

  const baselineResult = calculatePayoffWithMultipleOneTime(
    currentBalance,
    monthlyRate,
    minimumPayment,
    0,
    [],
    termMonths
  );

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
}

export function getCalculatedBalance(id: string) {
  const liability = db.select().from(liabilities).where(eq(liabilities.id, id)).get();
  if (!liability) return null;

  if (!liability.linkedAccountId) {
    return {
      error: 'no_linked_account',
      message: 'Link an account to enable transaction-based balance calculation',
      liability,
    };
  }

  const txns = db.select()
    .from(transactions)
    .where(eq(transactions.accountId, liability.linkedAccountId))
    .all();

  if (txns.length === 0) {
    const originalAmount = liability.originalAmount ?? 0;
    return {
      error: 'no_transactions',
      message: 'No transactions found for linked account',
      liability,
      calculatedBalance: originalAmount,
      currentBalance: liability.currentBalance,
      difference: originalAmount - liability.currentBalance,
      transactionCount: 0,
      dateRange: null,
    };
  }

  const loanFundingTxn = txns.find(
    t => t.description.toLowerCase().includes('loan funding')
  );
  const paymentTransactions = txns.filter(
    t => !t.description.toLowerCase().includes('loan funding')
  );

  const originalAmount = liability.originalAmount ??
    (loanFundingTxn ? Math.abs(loanFundingTxn.amount) : 0);

  if (!originalAmount) {
    return {
      error: 'no_original_amount',
      message: "Original loan amount is required. Add a 'Loan Funding' transaction or set the original amount manually.",
      liability,
    };
  }

  const sortedPayments = [...paymentTransactions].sort((a, b) => a.date - b.date);

  const paymentAmounts = sortedPayments.map(p => p.amount).sort((a, b) => a - b);
  const medianPayment = paymentAmounts.length > 0
    ? paymentAmounts[Math.floor(paymentAmounts.length / 2)]
    : 0;
  const principalOnlyThreshold = medianPayment * 1.5;

  const dailyRate = liability.interestRate / 365;
  let balance = originalAmount;
  let totalPrincipal = 0;
  let totalInterest = 0;
  let principalOnlyCount = 0;
  const warnings: string[] = [];

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
        description.includes('principal') ||
        description.includes('extra') ||
        description.includes('additional');

      const daysSinceLastPayment = Math.round(
        (payment.date - lastPaymentDate) / (24 * 60 * 60 * 1000)
      );
      const isLikelyPrincipalOnly =
        payment.amount > principalOnlyThreshold && daysSinceLastPayment < 15;

      if (isPrincipalOnly || isLikelyPrincipalOnly) {
        balance = Math.max(0, balance - payment.amount);
        totalPrincipal += payment.amount;
        principalOnlyCount++;
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

    if (principalOnlyCount > 0) {
      warnings.push(`${principalOnlyCount} payment${principalOnlyCount > 1 ? 's' : ''} detected as principal-only`);
    }
  } else if (sortedPayments.length > 0) {
    const totalPayments = sortedPayments.reduce((sum, t) => sum + t.amount, 0);
    balance = originalAmount - totalPayments;
    totalPrincipal = totalPayments;
    warnings.push('No interest rate set - assuming all payments are principal only');
  }

  const calculatedBalance = Math.max(0, balance);
  const isOverpaid = balance < 0;

  const dates = txns.map(t => t.date);
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
    transactionCount: txns.length,
    paymentCount: sortedPayments.length,
    dateRange: {
      start: minDate,
      end: maxDate,
    },
    warnings,
  };
}

export type Liability = typeof liabilities.$inferSelect;
export type NewLiability = typeof liabilities.$inferInsert;
