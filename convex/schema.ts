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
      v.literal("mortgage"),
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
    interestRate: v.number(), // Annual rate as decimal (e.g., 0.065 for 6.5%)
    minimumPayment: v.number(),
    // Amortization fields
    originalAmount: v.optional(v.number()), // Initial loan principal
    termMonths: v.optional(v.number()), // Total loan term (e.g., 360 for 30-year)
    startDate: v.optional(v.number()), // Loan origination date
    extraPaymentMonthly: v.optional(v.number()), // Extra principal payment per month
    payoffDate: v.optional(v.number()),
    linkedAccountId: v.optional(v.id("accounts")),
    // Scheduled one-time payments for payoff calculator
    scheduledPayments: v.optional(v.array(v.object({
      amount: v.number(),
      date: v.number(),
      description: v.optional(v.string()),
    }))),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_type", ["type"])
    .index("by_linked_account", ["linkedAccountId"]),

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
  // RETIREMENT PROFILE
  // ============================================
  retirementProfile: defineTable({
    retirementDate: v.number(), // timestamp
    currentAge: v.number(),
    annualSpending: v.number(),
    isSpendingAutoCalculated: v.boolean(),
    // Base living expenses (essentials) - used as the guardrails floor
    monthlyBaseLivingExpense: v.optional(v.number()),
    isBaseLivingExpenseAutoCalculated: v.optional(v.boolean()),
  }),

  // ============================================
  // SOCIAL SECURITY
  // ============================================
  socialSecurity: defineTable({
    // Benefits at key claiming ages (monthly amounts from SSA statement)
    benefitAt62: v.number(), // Reduced early benefit
    benefitAt67: v.number(), // Full retirement age benefit
    benefitAt70: v.number(), // Maximum delayed benefit
    // Birth date for age calculations
    birthYear: v.number(),
    birthMonth: v.number(), // 1-12
    // COLA assumption for future benefit growth
    colaRate: v.number(), // e.g., 0.02 for 2%
    // When to claim (for projections)
    plannedClaimingAge: v.optional(v.number()),
    // Spouse info (optional)
    hasSpouse: v.optional(v.boolean()),
    spouseBenefitAt67: v.optional(v.number()),
    spouseBirthYear: v.optional(v.number()),
    spousePlannedClaimingAge: v.optional(v.number()),
    updatedAt: v.number(),
  }),

  // ============================================
  // MONTE CARLO ASSUMPTIONS
  // ============================================
  monteCarloAssumptions: defineTable({
    // Return assumptions (REAL returns, after inflation)
    realReturn: v.number(), // e.g., 0.05 for 5%
    volatility: v.number(), // e.g., 0.12 for 12% std dev
    // Time horizon
    planToAge: v.number(), // e.g., 95
    // Target success rate
    targetSuccessRate: v.number(), // e.g., 0.90 for 90%
    // Simulation parameters
    iterations: v.optional(v.number()), // default: 1000
    // Part-time work in early retirement (optional)
    partTimeAnnualIncome: v.optional(v.number()),
    partTimeYears: v.optional(v.number()),
    // Legacy goal (optional)
    legacyTarget: v.optional(v.number()),
    updatedAt: v.number(),
  }),

  // ============================================
  // ONE-TIME EVENTS (for projections)
  // ============================================
  oneTimeEvents: defineTable({
    name: v.string(),
    year: v.number(),
    amount: v.number(), // positive = income, negative = expense
    category: v.optional(v.string()), // e.g., "travel", "home", "vehicle", "medical"
    notes: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_year", ["year"]),

  // ============================================
  // ANNUAL BUDGETS (additional spending categories for projections)
  // ============================================
  annualBudgets: defineTable({
    name: v.string(), // e.g., "Travel", "Charitable Giving"
    annualAmount: v.number(),
    startYear: v.optional(v.number()), // when this budget starts (default: retirement)
    endYear: v.optional(v.number()), // when this budget ends (default: never)
    notes: v.optional(v.string()),
    // If true, guardrails will never cut this budget item
    isEssential: v.optional(v.boolean()),
    createdAt: v.number(),
  }),

  // ============================================
  // GUARDRAILS CONFIGURATION
  // ============================================
  guardrailsConfig: defineTable({
    isEnabled: v.boolean(),
    // Upper guardrail: when portfolio exceeds this % above initial, increase spending
    upperThresholdPercent: v.number(), // e.g., 0.20 = 20% above target
    // Lower guardrail: when portfolio falls this % below initial, decrease spending
    lowerThresholdPercent: v.number(), // e.g., 0.20 = 20% below target
    // How much to adjust spending when guardrail is triggered
    spendingAdjustmentPercent: v.number(), // e.g., 0.10 = 10% increase/decrease
    // Floor and ceiling for spending (absolute values)
    spendingFloor: v.optional(v.number()), // minimum annual spending
    spendingCeiling: v.optional(v.number()), // maximum annual spending
    // Strategy type
    strategyType: v.union(
      v.literal("percentage"), // adjust by percentage of current spending
      v.literal("fixed") // adjust by fixed dollar amount
    ),
    fixedAdjustmentAmount: v.optional(v.number()), // used when strategyType is "fixed"
    updatedAt: v.number(),
  }),

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
  // MONTE CARLO CACHE
  // ============================================
  monteCarloCache: defineTable({
    inputsHash: v.string(), // Hash of all inputs to detect changes
    results: v.object({
      successRate: v.number(),
      iterations: v.number(),
      success: v.object({
        count: v.number(),
        medianEndingBalance: v.number(),
        p10EndingBalance: v.number(),
        p90EndingBalance: v.number(),
      }),
      failure: v.object({
        count: v.number(),
        averageYearsLasted: v.number(),
        medianYearsLasted: v.number(),
        worstCase: v.number(),
      }),
      maxWithdrawal: v.optional(v.object({
        amount: v.number(),
        rate: v.number(),
      })),
    }),
    createdAt: v.number(),
    expiresAt: v.number(), // Auto-expire after 24 hours
  }).index("by_hash", ["inputsHash"]),

  // ============================================
  // ALLOCATION TARGETS
  // ============================================
  allocationTargets: defineTable({
    accountId: v.optional(v.id("accounts")), // null = global default
    assetClass: v.union(
      v.literal("us_stock"),
      v.literal("intl_stock"),
      v.literal("bond"),
      v.literal("cash"),
      v.literal("real_estate"),
      v.literal("other")
    ),
    targetPercent: v.number(),
    rebalanceThreshold: v.number(),
  })
    .index("by_asset_class", ["assetClass"])
    .index("by_account", ["accountId"])
    .index("by_account_asset", ["accountId", "assetClass"]),
});
