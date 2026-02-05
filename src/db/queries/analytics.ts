import { db } from '../index';
import { transactions, accounts, categories } from '../schema';
import { eq } from 'drizzle-orm';

// Account types that should be included in spending analysis
const SPENDING_ACCOUNT_TYPES = new Set([
  'credit_card',
  'checking',
  'savings',
  'money_market',
]);

export interface SpendingByCategoryArgs {
  startDate: number;
  endDate: number;
  accountId?: string;
}

export function getSpendingByCategory(args: SpendingByCategoryArgs) {
  let txns: typeof transactions.$inferSelect[];

  if (args.accountId) {
    txns = db.select()
      .from(transactions)
      .where(eq(transactions.accountId, args.accountId))
      .all();
  } else {
    // Get all spending accounts
    const allAccounts = db.select().from(accounts).all();
    const spendingAccountIds = new Set(
      allAccounts
        .filter(a => SPENDING_ACCOUNT_TYPES.has(a.type))
        .map(a => a.id)
    );

    txns = db.select().from(transactions).all();
    txns = txns.filter(t => spendingAccountIds.has(t.accountId));
  }

  // Filter by date range and expenses only
  const filtered = txns.filter(
    t => t.date >= args.startDate && t.date <= args.endDate && t.amount < 0
  );

  // Get all categories
  const allCategories = db.select().from(categories).all();
  const categoryMap = new Map(allCategories.map(c => [c.id, c]));

  // Identify transfer category IDs
  const transferCategoryIds = new Set(
    allCategories.filter(c => c.type === 'transfer').map(c => c.id)
  );

  // Split into spending vs transfers
  const spendingTxs = filtered.filter(
    t => !t.isTransfer && (!t.categoryId || !transferCategoryIds.has(t.categoryId))
  );
  const transferTxs = filtered.filter(
    t => t.isTransfer || (t.categoryId && transferCategoryIds.has(t.categoryId))
  );

  // Group spending by category
  const spending: Record<string, {
    category: {
      id: string;
      name: string;
      color: string;
      isEssential: boolean;
    } | null;
    total: number;
    count: number;
  }> = {};

  for (const t of spendingTxs) {
    const catId = t.categoryId || 'uncategorized';
    const category = t.categoryId ? categoryMap.get(t.categoryId) : null;

    if (!spending[catId]) {
      spending[catId] = {
        category: category
          ? {
              id: category.id,
              name: category.name,
              color: category.color,
              isEssential: category.isEssential,
            }
          : {
              id: 'uncategorized',
              name: 'Uncategorized',
              color: '#607D8B',
              isEssential: false,
            },
        total: 0,
        count: 0,
      };
    }

    spending[catId].total += Math.abs(t.amount);
    spending[catId].count += 1;
  }

  const results = Object.values(spending).sort((a, b) => b.total - a.total);

  const totalSpending = results.reduce((sum, s) => sum + s.total, 0);
  const essentialSpending = results
    .filter(s => s.category?.isEssential)
    .reduce((sum, s) => sum + s.total, 0);
  const discretionarySpending = totalSpending - essentialSpending;

  const transferTotal = transferTxs.reduce((sum, t) => sum + Math.abs(t.amount), 0);

  return {
    byCategory: results,
    totalSpending,
    essentialSpending,
    discretionarySpending,
    transactionCount: spendingTxs.length,
    transfers: {
      total: transferTotal,
      count: transferTxs.length,
    },
  };
}

export interface SpendingTrendArgs {
  months?: number;
  accountId?: string;
}

export function getSpendingTrend(args: SpendingTrendArgs = {}) {
  const monthsToFetch = args.months || 12;
  const now = new Date();
  const startDate = new Date(
    now.getFullYear(),
    now.getMonth() - monthsToFetch + 1,
    1
  ).getTime();

  let txns: typeof transactions.$inferSelect[];

  if (args.accountId) {
    txns = db.select()
      .from(transactions)
      .where(eq(transactions.accountId, args.accountId))
      .all();
  } else {
    const allAccounts = db.select().from(accounts).all();
    const spendingAccountIds = new Set(
      allAccounts
        .filter(a => SPENDING_ACCOUNT_TYPES.has(a.type))
        .map(a => a.id)
    );

    txns = db.select().from(transactions).all();
    txns = txns.filter(t => spendingAccountIds.has(t.accountId));
  }

  // Get transfer categories
  const allCategories = db.select().from(categories).all();
  const transferCategoryIds = new Set(
    allCategories.filter(c => c.type === 'transfer').map(c => c.id)
  );

  // Filter by date and exclude transfers
  const filtered = txns.filter(
    t =>
      t.date >= startDate &&
      !t.isTransfer &&
      (!t.categoryId || !transferCategoryIds.has(t.categoryId))
  );

  // Group by month
  const monthlyData: Record<string, {
    month: string;
    year: number;
    monthNum: number;
    income: number;
    expenses: number;
    net: number;
  }> = {};

  for (const t of filtered) {
    const date = new Date(t.date);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (!monthlyData[key]) {
      monthlyData[key] = {
        month: date.toLocaleDateString('en-US', { month: 'short' }),
        year: date.getFullYear(),
        monthNum: date.getMonth(),
        income: 0,
        expenses: 0,
        net: 0,
      };
    }

    if (t.amount > 0) {
      monthlyData[key].income += t.amount;
    } else {
      monthlyData[key].expenses += Math.abs(t.amount);
    }
    monthlyData[key].net += t.amount;
  }

  return Object.entries(monthlyData)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, data]) => data);
}

export interface SpendingSummaryArgs {
  monthsBack?: number;
}

export function getSpendingSummary(args: SpendingSummaryArgs = {}) {
  const monthsToAnalyze = args.monthsBack || 12;
  const now = new Date();
  const startDate = new Date(
    now.getFullYear(),
    now.getMonth() - monthsToAnalyze + 1,
    1
  ).getTime();

  // Get all spending accounts
  const allAccounts = db.select().from(accounts).all();
  const spendingAccountIds = new Set(
    allAccounts
      .filter(a => SPENDING_ACCOUNT_TYPES.has(a.type) && a.isActive)
      .map(a => a.id)
  );

  const txns = db.select().from(transactions).all();
  const accountTxns = txns.filter(t => spendingAccountIds.has(t.accountId));

  // Get transfer categories
  const allCategories = db.select().from(categories).all();
  const transferCategoryIds = new Set(
    allCategories.filter(c => c.type === 'transfer').map(c => c.id)
  );

  // Filter to expenses only, exclude transfers
  const expenses = accountTxns.filter(
    t =>
      t.date >= startDate &&
      t.amount < 0 &&
      !t.isTransfer &&
      (!t.categoryId || !transferCategoryIds.has(t.categoryId))
  );

  // Group by month
  const monthlySpending = new Map<string, { total: number; count: number; date: Date }>();

  for (const t of expenses) {
    const date = new Date(t.date);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    const existing = monthlySpending.get(key) || {
      total: 0,
      count: 0,
      date: new Date(date.getFullYear(), date.getMonth(), 1)
    };
    existing.total += Math.abs(t.amount);
    existing.count += 1;
    monthlySpending.set(key, existing);
  }

  // Generate list of expected months
  const expectedMonths: string[] = [];
  for (let i = 0; i < monthsToAnalyze; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    expectedMonths.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  const missingMonths = expectedMonths.filter(m => !monthlySpending.has(m));

  const monthlyTotals = Array.from(monthlySpending.entries())
    .map(([key, data]) => ({
      month: key,
      total: data.total,
      transactionCount: data.count,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  const totals = monthlyTotals.map(m => m.total);

  if (totals.length === 0) {
    return {
      monthlyAverage: 0,
      monthlyMedian: 0,
      monthlyMin: 0,
      monthlyMax: 0,
      annualizedSpending: 0,
      trend: 'stable' as const,
      monthlyData: [],
      dataQuality: {
        monthsWithData: 0,
        totalMonthsRequested: monthsToAnalyze,
        missingMonths,
        hasOutliers: false,
        outlierMonths: [] as string[],
        lowTransactionMonths: [] as string[],
        isReliable: false,
        reliabilityReason: 'No spending data available',
      },
    };
  }

  // Calculate statistics
  const sum = totals.reduce((a, b) => a + b, 0);
  const monthlyAverage = sum / totals.length;

  const sorted = [...totals].sort((a, b) => a - b);
  const monthlyMedian = sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)];

  const monthlyMin = sorted[0];
  const monthlyMax = sorted[sorted.length - 1];

  // Detect outliers
  const outlierMonths = monthlyTotals
    .filter(m => m.total > monthlyMedian * 2 || m.total < monthlyMedian * 0.5)
    .map(m => m.month);

  const lowTransactionMonths = monthlyTotals
    .filter(m => m.transactionCount < 10)
    .map(m => m.month);

  // Determine trend
  let trend: 'increasing' | 'stable' | 'decreasing' = 'stable';
  if (monthlyTotals.length >= 6) {
    const midpoint = Math.floor(monthlyTotals.length / 2);
    const firstHalf = monthlyTotals.slice(0, midpoint);
    const secondHalf = monthlyTotals.slice(midpoint);

    const firstHalfAvg = firstHalf.reduce((sum, m) => sum + m.total, 0) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((sum, m) => sum + m.total, 0) / secondHalf.length;

    const changePercent = (secondHalfAvg - firstHalfAvg) / firstHalfAvg;

    if (changePercent > 0.1) {
      trend = 'increasing';
    } else if (changePercent < -0.1) {
      trend = 'decreasing';
    }
  }

  // Determine reliability
  let isReliable = true;
  let reliabilityReason = 'Data appears reliable';

  if (totals.length < 6) {
    isReliable = false;
    reliabilityReason = `Only ${totals.length} months of data. Need at least 6 for reliable projections.`;
  } else if (missingMonths.length > 2) {
    isReliable = false;
    reliabilityReason = `Missing data for ${missingMonths.length} months. Data may be incomplete.`;
  } else if (outlierMonths.length > totals.length * 0.3) {
    isReliable = false;
    reliabilityReason = `${outlierMonths.length} months have unusual spending. Consider reviewing for one-time events.`;
  } else if (lowTransactionMonths.length > 0) {
    reliabilityReason = `${lowTransactionMonths.length} months have few transactions. Data may be incomplete.`;
  }

  return {
    monthlyAverage: Math.round(monthlyAverage),
    monthlyMedian: Math.round(monthlyMedian),
    monthlyMin: Math.round(monthlyMin),
    monthlyMax: Math.round(monthlyMax),
    annualizedSpending: Math.round(monthlyAverage * 12),
    trend,
    monthlyData: monthlyTotals,
    dataQuality: {
      monthsWithData: totals.length,
      totalMonthsRequested: monthsToAnalyze,
      missingMonths,
      hasOutliers: outlierMonths.length > 0,
      outlierMonths,
      lowTransactionMonths,
      isReliable,
      reliabilityReason,
    },
  };
}

export interface MonthlyTotalsArgs {
  year: number;
  month: number;
  accountId?: string;
}

export function getMonthlyTotals(args: MonthlyTotalsArgs) {
  const startDate = new Date(args.year, args.month - 1, 1).getTime();
  const endDate = new Date(args.year, args.month, 0, 23, 59, 59).getTime();

  let txns: typeof transactions.$inferSelect[];

  if (args.accountId) {
    txns = db.select()
      .from(transactions)
      .where(eq(transactions.accountId, args.accountId))
      .all();
  } else {
    const allAccounts = db.select().from(accounts).all();
    const spendingAccountIds = new Set(
      allAccounts
        .filter(a => SPENDING_ACCOUNT_TYPES.has(a.type))
        .map(a => a.id)
    );

    txns = db.select().from(transactions).all();
    txns = txns.filter(t => spendingAccountIds.has(t.accountId));
  }

  // Get transfer categories
  const allCategories = db.select().from(categories).all();
  const transferCategoryIds = new Set(
    allCategories.filter(c => c.type === 'transfer').map(c => c.id)
  );

  // Filter and exclude transfers
  const filtered = txns.filter(
    t =>
      t.date >= startDate &&
      t.date <= endDate &&
      !t.isTransfer &&
      (!t.categoryId || !transferCategoryIds.has(t.categoryId))
  );

  const transfers = txns.filter(
    t =>
      t.date >= startDate &&
      t.date <= endDate &&
      (t.isTransfer || (t.categoryId && transferCategoryIds.has(t.categoryId)))
  );

  let income = 0;
  let expenses = 0;

  for (const t of filtered) {
    if (t.amount > 0) {
      income += t.amount;
    } else {
      expenses += Math.abs(t.amount);
    }
  }

  const transferTotal = transfers.reduce((sum, t) => sum + Math.abs(t.amount), 0);

  return {
    income,
    expenses,
    net: income - expenses,
    transactionCount: filtered.length,
    transfers: {
      total: transferTotal,
      count: transfers.length,
    },
  };
}
