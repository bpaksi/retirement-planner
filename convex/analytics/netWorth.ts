import { query } from "../_generated/server";

export const getCurrentNetWorth = query({
  args: {},
  handler: async (ctx) => {
    // Get all active accounts
    const accounts = await ctx.db.query("accounts").collect();
    const activeAccounts = accounts.filter((a) => a.isActive);

    // Get latest snapshots for each account
    const accountSnapshots = await ctx.db.query("accountSnapshots").collect();
    const latestSnapshots = new Map<string, number>();

    for (const snapshot of accountSnapshots) {
      const accountId = snapshot.accountId.toString();
      const existing = latestSnapshots.get(accountId);
      if (!existing || snapshot.date > existing) {
        latestSnapshots.set(accountId, snapshot.balance);
      }
    }

    // Calculate investment value from holdings
    const holdings = await ctx.db.query("holdings").collect();
    let investmentValue = 0;
    for (const holding of holdings) {
      const price = holding.lastPrice ?? 0;
      investmentValue += holding.shares * price;
    }

    // Calculate cash/checking accounts (non-investment)
    let cashValue = 0;
    const cashAccountTypes = new Set(["checking", "savings", "money_market"]);
    for (const account of activeAccounts) {
      if (cashAccountTypes.has(account.type)) {
        const balance = latestSnapshots.get(account._id.toString()) ?? 0;
        cashValue += balance;
      }
    }

    // Get assets (home, vehicles, etc.)
    const assets = await ctx.db.query("assets").collect();
    let assetValue = 0;
    for (const asset of assets) {
      assetValue += asset.currentValue;
    }

    // Get liabilities
    const liabilities = await ctx.db.query("liabilities").collect();
    let liabilityValue = 0;
    for (const liability of liabilities) {
      liabilityValue += liability.currentBalance;
    }

    // Total net worth
    const total = investmentValue + cashValue + assetValue - liabilityValue;

    return {
      total,
      investments: investmentValue,
      cash: cashValue,
      assets: assetValue,
      liabilities: liabilityValue,
      breakdown: {
        investmentAccounts: activeAccounts.filter((a) => a.isRetirement).length,
        cashAccounts: activeAccounts.filter((a) =>
          cashAccountTypes.has(a.type)
        ).length,
        assetCount: assets.length,
        liabilityCount: liabilities.length,
      },
    };
  },
});

// Get the portfolio value specifically (for retirement projections)
export const getPortfolioValue = query({
  args: {},
  handler: async (ctx) => {
    const holdings = await ctx.db.query("holdings").collect();

    let total = 0;
    for (const holding of holdings) {
      const price = holding.lastPrice ?? 0;
      total += holding.shares * price;
    }

    return total;
  },
});

// Get suggested annual spending from transaction history
export const getSuggestedSpending = query({
  args: {},
  handler: async (ctx) => {
    // Get transactions from the past 12 months
    const now = Date.now();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const startDate = oneYearAgo.getTime();

    // Account types that contain spending data
    const spendingAccountTypes = new Set([
      "credit_card",
      "checking",
      "savings",
      "money_market",
    ]);

    const accounts = await ctx.db.query("accounts").collect();
    const spendingAccountIds = new Set(
      accounts
        .filter((a) => a.isActive && spendingAccountTypes.has(a.type))
        .map((a) => a._id.toString())
    );

    // Get all categories to identify transfer categories
    const categories = await ctx.db.query("categories").collect();
    const transferCategoryIds = new Set(
      categories.filter((c) => c.type === "transfer").map((c) => c._id.toString())
    );

    // Get all transactions and filter
    const allTransactions = await ctx.db.query("transactions").collect();
    const relevantTransactions = allTransactions.filter((t) => {
      // Must be from a spending account
      if (!spendingAccountIds.has(t.accountId.toString())) return false;
      // Must be in date range
      if (t.date < startDate || t.date > now) return false;
      // Must be an expense (negative amount)
      if (t.amount >= 0) return false;
      // Must not be a transfer
      if (t.isTransfer) return false;
      if (t.categoryId && transferCategoryIds.has(t.categoryId.toString())) return false;
      return true;
    });

    // Calculate total spending
    let totalSpending = 0;
    for (const t of relevantTransactions) {
      totalSpending += Math.abs(t.amount);
    }

    // Determine how many months of data we have
    if (relevantTransactions.length === 0) {
      return {
        annualSpending: 0,
        monthsOfData: 0,
        transactionCount: 0,
        isEstimate: false,
      };
    }

    const transactionDates = relevantTransactions.map((t) => t.date);
    const minDate = Math.min(...transactionDates);
    const maxDate = Math.max(...transactionDates);
    const monthsOfData = Math.max(
      1,
      Math.ceil((maxDate - minDate) / (30 * 24 * 60 * 60 * 1000))
    );

    // Annualize the spending
    const monthlyAverage = totalSpending / monthsOfData;
    const annualSpending = monthlyAverage * 12;

    return {
      annualSpending: Math.round(annualSpending),
      monthsOfData,
      transactionCount: relevantTransactions.length,
      isEstimate: monthsOfData < 12,
    };
  },
});
