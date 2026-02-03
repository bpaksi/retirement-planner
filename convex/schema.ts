import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ============================================
  // ACCOUNTS
  // ============================================
  accounts: defineTable({
    name: v.string(),
    type: v.union(
      v.literal("401k"),
      v.literal("403b"),
      v.literal("traditional_ira"),
      v.literal("roth_ira"),
      v.literal("roth_401k"),
      v.literal("brokerage"),
      v.literal("checking"),
      v.literal("savings"),
      v.literal("money_market"),
      v.literal("credit_card"),
      v.literal("loan"),
      v.literal("other")
    ),
    institution: v.string(),
    accountNumberLast4: v.optional(v.string()),
    taxTreatment: v.union(
      v.literal("taxable"),
      v.literal("tax_deferred"),
      v.literal("tax_free")
    ),
    isRetirement: v.boolean(),
    isActive: v.boolean(),
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_type", ["type"])
    .index("by_institution", ["institution"]),

  // ============================================
  // TRANSACTIONS
  // ============================================
  transactions: defineTable({
    accountId: v.id("accounts"),
    date: v.number(),
    description: v.string(),
    amount: v.number(),
    categoryId: v.optional(v.id("categories")),
    isRecurring: v.boolean(),
    isFlagged: v.boolean(),
    confidenceScore: v.optional(v.number()),
    tags: v.array(v.string()),
    importBatchId: v.optional(v.string()),
    sourceFile: v.optional(v.string()),
    linkedTransactionId: v.optional(v.id("transactions")), // Reference to paired transaction for transfers
    isTransfer: v.optional(v.boolean()), // Explicit flag for inter-account transfers
    createdAt: v.number(),
  })
    .index("by_account", ["accountId"])
    .index("by_date", ["date"])
    .index("by_category", ["categoryId"])
    .index("by_flagged", ["isFlagged"])
    .index("by_account_date", ["accountId", "date"])
    .index("by_import_batch", ["importBatchId"])
    .index("by_linked", ["linkedTransactionId"]),

  // ============================================
  // CATEGORIES
  // ============================================
  categories: defineTable({
    name: v.string(),
    parentId: v.optional(v.id("categories")),
    type: v.union(
      v.literal("expense"),
      v.literal("income"),
      v.literal("transfer")
    ),
    isEssential: v.boolean(),
    color: v.string(),
    icon: v.optional(v.string()),
    sortOrder: v.number(),
    isSystem: v.boolean(),
  })
    .index("by_parent", ["parentId"])
    .index("by_type", ["type"])
    .index("by_name", ["name"]),

  // ============================================
  // CATEGORIZATION RULES
  // ============================================
  categorizationRules: defineTable({
    pattern: v.string(),
    categoryId: v.id("categories"),
    priority: v.number(),
    isActive: v.boolean(),
    createdBy: v.union(
      v.literal("system"),
      v.literal("user"),
      v.literal("learned")
    ),
    matchCount: v.number(),
  })
    .index("by_priority", ["priority"])
    .index("by_category", ["categoryId"])
    .index("by_created_by", ["createdBy"]),

  // ============================================
  // HOLDINGS (Investment positions)
  // ============================================
  holdings: defineTable({
    accountId: v.id("accounts"),
    symbol: v.string(),
    name: v.string(),
    shares: v.number(),
    costBasis: v.optional(v.number()),
    assetClass: v.union(
      v.literal("us_stock"),
      v.literal("intl_stock"),
      v.literal("bond"),
      v.literal("cash"),
      v.literal("real_estate"),
      v.literal("other")
    ),
    lastPrice: v.optional(v.number()),
    lastPriceUpdated: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_account", ["accountId"])
    .index("by_symbol", ["symbol"])
    .index("by_asset_class", ["assetClass"]),

  // ============================================
  // ACCOUNT SNAPSHOTS (Monthly balances)
  // ============================================
  accountSnapshots: defineTable({
    accountId: v.id("accounts"),
    date: v.number(),
    balance: v.number(),
    isManual: v.boolean(),
  })
    .index("by_account", ["accountId"])
    .index("by_date", ["date"])
    .index("by_account_date", ["accountId", "date"]),

  // ============================================
  // SCENARIOS
  // ============================================
  scenarios: defineTable({
    name: v.string(),
    isBaseline: v.boolean(),
    assumptions: v.object({
      retirementAge: v.number(),
      currentAge: v.number(),
      lifeExpectancy: v.number(),
      annualSpending: v.number(),
      spendingGrowthRate: v.number(),
      inflationRate: v.number(),
      preRetirementReturn: v.number(),
      postRetirementReturn: v.number(),
      socialSecurityAge: v.optional(v.number()),
      socialSecurityMonthly: v.optional(v.number()),
      upperGuardrail: v.optional(v.number()),
      lowerGuardrail: v.optional(v.number()),
      spendingAdjustment: v.optional(v.number()),
    }),
    events: v.array(
      v.object({
        name: v.string(),
        year: v.number(),
        amount: v.number(),
        isRecurring: v.boolean(),
        recurringYears: v.optional(v.number()),
      })
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  }),

  // ============================================
  // GOALS
  // ============================================
  goals: defineTable({
    type: v.union(
      v.literal("retirement_date"),
      v.literal("net_worth"),
      v.literal("savings_target"),
      v.literal("spending_target")
    ),
    name: v.string(),
    targetValue: v.number(),
    targetDate: v.optional(v.number()),
    isAchieved: v.boolean(),
    achievedDate: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_type", ["type"]),

  // ============================================
  // ASSETS (Non-investment assets like home)
  // ============================================
  assets: defineTable({
    type: v.union(v.literal("home"), v.literal("vehicle"), v.literal("other")),
    name: v.string(),
    address: v.optional(v.string()),
    zillowId: v.optional(v.string()),
    currentValue: v.number(),
    isAutoUpdated: v.boolean(),
    lastUpdated: v.number(),
    purchasePrice: v.optional(v.number()),
    purchaseDate: v.optional(v.number()),
    notes: v.optional(v.string()),
  }).index("by_type", ["type"]),

  // ============================================
  // LIABILITIES
  // ============================================
  liabilities: defineTable({
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
    minimumPayment: v.number(),
    payoffDate: v.optional(v.number()),
    linkedAccountId: v.optional(v.id("accounts")),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_type", ["type"]),

  // ============================================
  // INCOME SOURCES
  // ============================================
  incomeSources: defineTable({
    type: v.union(
      v.literal("salary"),
      v.literal("self_employment"),
      v.literal("social_security"),
      v.literal("pension"),
      v.literal("rental"),
      v.literal("dividends"),
      v.literal("other")
    ),
    name: v.string(),
    annualAmount: v.number(),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    growthRate: v.number(),
    isTaxable: v.boolean(),
    createdAt: v.number(),
  }).index("by_type", ["type"]),

  // ============================================
  // SETTINGS
  // ============================================
  settings: defineTable({
    key: v.string(),
    value: v.any(),
  }).index("by_key", ["key"]),

  // ============================================
  // IMPORT HISTORY
  // ============================================
  importHistory: defineTable({
    filename: v.string(),
    institution: v.string(),
    accountId: v.optional(v.id("accounts")),
    transactionCount: v.number(),
    duplicatesSkipped: v.number(),
    importedAt: v.number(),
    status: v.union(
      v.literal("success"),
      v.literal("partial"),
      v.literal("failed")
    ),
    errors: v.optional(v.array(v.string())),
  }).index("by_date", ["importedAt"]),

  // ============================================
  // PRICE CACHE (for stock/ETF prices)
  // ============================================
  priceCache: defineTable({
    symbol: v.string(),
    price: v.number(),
    change: v.optional(v.number()),
    changePercent: v.optional(v.number()),
    updatedAt: v.number(),
  }).index("by_symbol", ["symbol"]),

  // ============================================
  // ALLOCATION TARGETS
  // ============================================
  allocationTargets: defineTable({
    assetClass: v.string(),
    targetPercent: v.number(),
    rebalanceThreshold: v.number(),
  }).index("by_asset_class", ["assetClass"]),
});
