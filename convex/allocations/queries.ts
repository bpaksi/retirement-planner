import { query } from "../_generated/server";
import { v } from "convex/values";

// Investment account types
const INVESTMENT_ACCOUNT_TYPES = [
  "401k",
  "403b",
  "traditional_ira",
  "roth_ira",
  "roth_401k",
  "brokerage",
] as const;

// Get allocation targets for a specific account (or global defaults)
export const getTargets = query({
  args: {
    accountId: v.optional(v.id("accounts")),
  },
  handler: async (ctx, args) => {
    // Try account-specific targets first
    if (args.accountId) {
      const accountTargets = await ctx.db
        .query("allocationTargets")
        .withIndex("by_account", (q) => q.eq("accountId", args.accountId))
        .collect();

      if (accountTargets.length > 0) {
        return {
          targets: accountTargets,
          isAccountSpecific: true,
        };
      }
    }

    // Fall back to global defaults
    const globalTargets = await ctx.db
      .query("allocationTargets")
      .withIndex("by_account", (q) => q.eq("accountId", undefined))
      .collect();

    return {
      targets: globalTargets,
      isAccountSpecific: false,
    };
  },
});

// Get all accounts that are investment-related
export const getInvestmentAccounts = query({
  args: {},
  handler: async (ctx) => {
    const accounts = await ctx.db.query("accounts").collect();

    return accounts
      .filter(
        (account) =>
          INVESTMENT_ACCOUNT_TYPES.includes(
            account.type as (typeof INVESTMENT_ACCOUNT_TYPES)[number]
          ) && account.isActive
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

// Check if any accounts have holdings
export const getAccountsWithHoldings = query({
  args: {},
  handler: async (ctx) => {
    const holdings = await ctx.db.query("holdings").collect();
    const accountIds = [...new Set(holdings.map((h) => h.accountId))];

    const accounts = await ctx.db.query("accounts").collect();
    const accountMap = new Map(accounts.map((a) => [a._id, a]));

    return accountIds
      .map((id) => accountMap.get(id))
      .filter((a): a is NonNullable<typeof a> => a !== undefined)
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});
