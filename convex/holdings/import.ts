import { mutation, query } from "../_generated/server";
import { v } from "convex/values";

// Holding input for import
const holdingInput = v.object({
  symbol: v.string(),
  name: v.string(),
  shares: v.number(),
  currentValue: v.number(),
  costBasis: v.optional(v.number()),
  lastPrice: v.optional(v.number()),
  unrealizedGainLoss: v.optional(v.number()),
  assetClass: v.union(
    v.literal("us_stock"),
    v.literal("intl_stock"),
    v.literal("bond"),
    v.literal("cash"),
    v.literal("real_estate"),
    v.literal("other")
  ),
});

export const importHoldings = mutation({
  args: {
    accountId: v.id("accounts"),
    holdings: v.array(holdingInput),
    sourceFile: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Verify account exists
    const account = await ctx.db.get(args.accountId);
    if (!account) {
      throw new Error("Account not found");
    }

    // Get existing holdings for this account
    const existingHoldings = await ctx.db
      .query("holdings")
      .withIndex("by_account", (q) => q.eq("accountId", args.accountId))
      .collect();

    // Create a map of existing holdings by symbol
    const existingBySymbol = new Map(
      existingHoldings.map((h) => [h.symbol.toUpperCase(), h])
    );

    let inserted = 0;
    let updated = 0;
    const errors: string[] = [];

    for (const holding of args.holdings) {
      const symbolUpper = holding.symbol.toUpperCase();
      const existing = existingBySymbol.get(symbolUpper);

      try {
        if (existing) {
          // Update existing holding
          await ctx.db.patch(existing._id, {
            name: holding.name,
            shares: holding.shares,
            costBasis: holding.costBasis,
            assetClass: holding.assetClass,
            lastPrice: holding.lastPrice,
            lastPriceUpdated: holding.lastPrice ? now : existing.lastPriceUpdated,
            updatedAt: now,
          });
          updated++;
        } else {
          // Insert new holding
          await ctx.db.insert("holdings", {
            accountId: args.accountId,
            symbol: holding.symbol,
            name: holding.name,
            shares: holding.shares,
            costBasis: holding.costBasis,
            assetClass: holding.assetClass,
            lastPrice: holding.lastPrice,
            lastPriceUpdated: holding.lastPrice ? now : undefined,
            createdAt: now,
            updatedAt: now,
          });
          inserted++;
        }
      } catch (e) {
        errors.push(
          `Failed to import "${holding.symbol}": ${e instanceof Error ? e.message : "Unknown error"}`
        );
      }
    }

    // Record import history
    await ctx.db.insert("importHistory", {
      filename: args.sourceFile,
      institution: account.institution,
      accountId: args.accountId,
      transactionCount: inserted + updated, // Using transaction count for holdings count
      duplicatesSkipped: 0,
      importedAt: now,
      status: errors.length === 0 ? "success" : inserted + updated > 0 ? "partial" : "failed",
      errors: errors.length > 0 ? errors : undefined,
    });

    return {
      inserted,
      updated,
      errors,
      total: args.holdings.length,
    };
  },
});

export const getByAccount = query({
  args: {
    accountId: v.id("accounts"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("holdings")
      .withIndex("by_account", (q) => q.eq("accountId", args.accountId))
      .collect();
  },
});
