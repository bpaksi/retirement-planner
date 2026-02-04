import { query } from "../_generated/server";
import { v } from "convex/values";

// Asset class type for aggregation
type AssetClass =
  | "us_stock"
  | "intl_stock"
  | "bond"
  | "cash"
  | "real_estate"
  | "other";

// List all holdings with account info joined
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    const holdings = await ctx.db.query("holdings").collect();
    const accounts = await ctx.db.query("accounts").collect();

    const accountMap = new Map(accounts.map((a) => [a._id, a]));

    return holdings.map((holding) => ({
      ...holding,
      account: accountMap.get(holding.accountId) ?? null,
    }));
  },
});

// Get portfolio summary with computed values
export const getPortfolioSummary = query({
  args: {
    accountId: v.optional(v.id("accounts")),
  },
  handler: async (ctx, args) => {
    let holdings;

    if (args.accountId) {
      holdings = await ctx.db
        .query("holdings")
        .withIndex("by_account", (q) => q.eq("accountId", args.accountId!))
        .collect();
    } else {
      holdings = await ctx.db.query("holdings").collect();
    }

    const accounts = await ctx.db.query("accounts").collect();
    const accountMap = new Map(accounts.map((a) => [a._id, a]));

    return holdings.map((holding) => {
      const currentValue = holding.shares * (holding.lastPrice ?? 0);
      const costBasis = holding.costBasis ?? 0;
      const gainLoss = currentValue - costBasis;
      const gainLossPercent = costBasis > 0 ? gainLoss / costBasis : 0;

      return {
        ...holding,
        account: accountMap.get(holding.accountId) ?? null,
        currentValue,
        gainLoss,
        gainLossPercent,
      };
    });
  },
});

// Get allocation by asset class
export const getAllocation = query({
  args: {
    accountId: v.optional(v.id("accounts")),
  },
  handler: async (ctx, args) => {
    let holdings;

    if (args.accountId) {
      holdings = await ctx.db
        .query("holdings")
        .withIndex("by_account", (q) => q.eq("accountId", args.accountId!))
        .collect();
    } else {
      holdings = await ctx.db.query("holdings").collect();
    }

    // Aggregate by asset class
    const allocationMap = new Map<
      AssetClass,
      { value: number; holdings: number }
    >();

    let totalValue = 0;

    for (const holding of holdings) {
      const value = holding.shares * (holding.lastPrice ?? 0);
      totalValue += value;

      const existing = allocationMap.get(holding.assetClass) ?? {
        value: 0,
        holdings: 0,
      };
      allocationMap.set(holding.assetClass, {
        value: existing.value + value,
        holdings: existing.holdings + 1,
      });
    }

    // Convert to array with percentages
    const allocation: Array<{
      assetClass: AssetClass;
      value: number;
      percent: number;
      holdings: number;
    }> = [];

    for (const [assetClass, data] of allocationMap) {
      allocation.push({
        assetClass,
        value: data.value,
        percent: totalValue > 0 ? data.value / totalValue : 0,
        holdings: data.holdings,
      });
    }

    // Sort by value descending
    allocation.sort((a, b) => b.value - a.value);

    return {
      allocation,
      totalValue,
      holdingsCount: holdings.length,
    };
  },
});

// Get rebalancing analysis with drift calculations
export const getRebalancingAnalysis = query({
  args: {
    accountId: v.optional(v.id("accounts")),
  },
  handler: async (ctx, args) => {
    // Get current allocation
    let holdings;

    if (args.accountId) {
      holdings = await ctx.db
        .query("holdings")
        .withIndex("by_account", (q) => q.eq("accountId", args.accountId!))
        .collect();
    } else {
      holdings = await ctx.db.query("holdings").collect();
    }

    // Get allocation targets (account-specific first, then global)
    let targets;

    if (args.accountId) {
      targets = await ctx.db
        .query("allocationTargets")
        .withIndex("by_account", (q) => q.eq("accountId", args.accountId))
        .collect();
    }

    // If no account-specific targets, get global defaults
    if (!targets || targets.length === 0) {
      targets = await ctx.db
        .query("allocationTargets")
        .withIndex("by_account", (q) => q.eq("accountId", undefined))
        .collect();
    }

    // Calculate current allocation
    const currentAllocation = new Map<AssetClass, number>();
    let totalValue = 0;

    for (const holding of holdings) {
      const value = holding.shares * (holding.lastPrice ?? 0);
      totalValue += value;
      currentAllocation.set(
        holding.assetClass,
        (currentAllocation.get(holding.assetClass) ?? 0) + value
      );
    }

    // Build target map
    const targetMap = new Map(
      targets.map((t) => [
        t.assetClass as AssetClass,
        { targetPercent: t.targetPercent, threshold: t.rebalanceThreshold },
      ])
    );

    // All possible asset classes
    const allAssetClasses: AssetClass[] = [
      "us_stock",
      "intl_stock",
      "bond",
      "cash",
      "real_estate",
      "other",
    ];

    // Calculate drift for each asset class
    const analysis = allAssetClasses.map((assetClass) => {
      const currentValue = currentAllocation.get(assetClass) ?? 0;
      const currentPercent = totalValue > 0 ? currentValue / totalValue : 0;
      const target = targetMap.get(assetClass);
      const targetPercent = target?.targetPercent ?? 0;
      const threshold = target?.threshold ?? 0.05;
      const drift = currentPercent - targetPercent;
      const needsRebalance = Math.abs(drift) > threshold;

      return {
        assetClass,
        currentValue,
        currentPercent,
        targetPercent,
        threshold,
        drift,
        needsRebalance,
      };
    });

    // Filter out asset classes with no target and no holdings
    const filteredAnalysis = analysis.filter(
      (a) => a.currentValue > 0 || a.targetPercent > 0
    );

    const needsRebalanceCount = filteredAnalysis.filter(
      (a) => a.needsRebalance
    ).length;

    return {
      analysis: filteredAnalysis,
      totalValue,
      holdingsCount: holdings.length,
      needsRebalanceCount,
      hasTargets: targets.length > 0,
    };
  },
});
