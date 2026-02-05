import { sqliteTable, text, real, integer, index } from 'drizzle-orm/sqlite-core';

// ============================================
// TYPE DEFINITIONS FOR JSON FIELDS
// ============================================

export type ScenarioAssumptions = {
  retirementAge: number;
  currentAge: number;
  lifeExpectancy: number;
  annualSpending: number;
  spendingGrowthRate: number;
  inflationRate: number;
  preRetirementReturn: number;
  postRetirementReturn: number;
  socialSecurityAge?: number;
  socialSecurityMonthly?: number;
  upperGuardrail?: number;
  lowerGuardrail?: number;
  spendingAdjustment?: number;
};

export type ScenarioEvent = {
  name: string;
  year: number;
  amount: number;
  isRecurring: boolean;
  recurringYears?: number;
};

export type ScheduledPayment = {
  amount: number;
  date: number;
  description?: string;
};

export type MonteCarloCacheResults = {
  successRate: number;
  iterations: number;
  success: {
    count: number;
    medianEndingBalance: number;
    p10EndingBalance: number;
    p90EndingBalance: number;
  };
  failure: {
    count: number;
    averageYearsLasted: number;
    medianYearsLasted: number;
    worstCase: number;
  };
  risk: {
    averageLowestBalance: number;
    percentHittingFloor: number;
  };
  samplePaths: Array<{
    year: number;
    startBalance: number;
    return: number;
    spending: number;
    baseSpending?: number;
    goalsSpending?: number;
    ssIncome: number;
    endBalance: number;
    guardrailTriggered: 'ceiling' | 'floor' | null;
  }[]>;
  maxWithdrawal?: {
    amount: number;
    rate: number;
  };
};

// ============================================
// ACCOUNTS
// ============================================
export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  type: text('type', {
    enum: ['401k', '403b', 'traditional_ira', 'roth_ira', 'roth_401k', 'brokerage', 'checking', 'savings', 'money_market', 'credit_card', 'loan', 'mortgage', 'other']
  }).notNull(),
  institution: text('institution').notNull(),
  accountNumberLast4: text('account_number_last4'),
  taxTreatment: text('tax_treatment', {
    enum: ['taxable', 'tax_deferred', 'tax_free']
  }).notNull(),
  isRetirement: integer('is_retirement', { mode: 'boolean' }).notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull(),
  notes: text('notes'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => [
  index('accounts_by_type').on(table.type),
  index('accounts_by_institution').on(table.institution),
]);

// ============================================
// CATEGORIES
// ============================================
export const categories = sqliteTable('categories', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  parentId: text('parent_id'), // Self-reference handled via foreign key constraint in migration
  type: text('type', {
    enum: ['expense', 'income', 'transfer']
  }).notNull(),
  isEssential: integer('is_essential', { mode: 'boolean' }).notNull(),
  color: text('color').notNull(),
  icon: text('icon'),
  sortOrder: integer('sort_order').notNull(),
  isSystem: integer('is_system', { mode: 'boolean' }).notNull(),
}, (table) => [
  index('categories_by_parent').on(table.parentId),
  index('categories_by_type').on(table.type),
  index('categories_by_name').on(table.name),
]);

// ============================================
// TRANSACTIONS
// ============================================
export const transactions = sqliteTable('transactions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  accountId: text('account_id').notNull().references(() => accounts.id),
  date: integer('date').notNull(),
  description: text('description').notNull(),
  amount: real('amount').notNull(),
  categoryId: text('category_id').references(() => categories.id),
  isRecurring: integer('is_recurring', { mode: 'boolean' }).notNull(),
  isFlagged: integer('is_flagged', { mode: 'boolean' }).notNull(),
  confidenceScore: real('confidence_score'),
  tags: text('tags', { mode: 'json' }).$type<string[]>().notNull().default([]),
  importBatchId: text('import_batch_id'),
  sourceFile: text('source_file'),
  linkedTransactionId: text('linked_transaction_id'), // Self-reference handled via foreign key constraint in migration
  isTransfer: integer('is_transfer', { mode: 'boolean' }),
  createdAt: integer('created_at').notNull(),
}, (table) => [
  index('transactions_by_account').on(table.accountId),
  index('transactions_by_date').on(table.date),
  index('transactions_by_category').on(table.categoryId),
  index('transactions_by_flagged').on(table.isFlagged),
  index('transactions_by_account_date').on(table.accountId, table.date),
  index('transactions_by_import_batch').on(table.importBatchId),
  index('transactions_by_linked').on(table.linkedTransactionId),
]);

// ============================================
// CATEGORIZATION RULES
// ============================================
export const categorizationRules = sqliteTable('categorization_rules', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  pattern: text('pattern').notNull(),
  categoryId: text('category_id').notNull().references(() => categories.id),
  priority: integer('priority').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull(),
  createdBy: text('created_by', {
    enum: ['system', 'user', 'learned']
  }).notNull(),
  matchCount: integer('match_count').notNull(),
}, (table) => [
  index('rules_by_priority').on(table.priority),
  index('rules_by_category').on(table.categoryId),
  index('rules_by_created_by').on(table.createdBy),
]);

// ============================================
// HOLDINGS (Investment positions)
// ============================================
export const holdings = sqliteTable('holdings', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  accountId: text('account_id').notNull().references(() => accounts.id),
  symbol: text('symbol').notNull(),
  name: text('name').notNull(),
  shares: real('shares').notNull(),
  costBasis: real('cost_basis'),
  assetClass: text('asset_class', {
    enum: ['us_stock', 'intl_stock', 'bond', 'cash', 'real_estate', 'other']
  }).notNull(),
  lastPrice: real('last_price'),
  lastPriceUpdated: integer('last_price_updated'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => [
  index('holdings_by_account').on(table.accountId),
  index('holdings_by_symbol').on(table.symbol),
  index('holdings_by_asset_class').on(table.assetClass),
]);

// ============================================
// ACCOUNT SNAPSHOTS (Monthly balances)
// ============================================
export const accountSnapshots = sqliteTable('account_snapshots', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  accountId: text('account_id').notNull().references(() => accounts.id),
  date: integer('date').notNull(),
  balance: real('balance').notNull(),
  isManual: integer('is_manual', { mode: 'boolean' }).notNull(),
}, (table) => [
  index('snapshots_by_account').on(table.accountId),
  index('snapshots_by_date').on(table.date),
  index('snapshots_by_account_date').on(table.accountId, table.date),
]);

// ============================================
// SCENARIOS
// ============================================
export const scenarios = sqliteTable('scenarios', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  isBaseline: integer('is_baseline', { mode: 'boolean' }).notNull(),
  assumptions: text('assumptions', { mode: 'json' }).$type<ScenarioAssumptions>().notNull(),
  events: text('events', { mode: 'json' }).$type<ScenarioEvent[]>().notNull().default([]),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

// ============================================
// GOALS
// ============================================
export const goals = sqliteTable('goals', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  type: text('type', {
    enum: ['retirement_date', 'net_worth', 'savings_target', 'spending_target']
  }).notNull(),
  name: text('name').notNull(),
  targetValue: real('target_value').notNull(),
  targetDate: integer('target_date'),
  isAchieved: integer('is_achieved', { mode: 'boolean' }).notNull(),
  achievedDate: integer('achieved_date'),
  createdAt: integer('created_at').notNull(),
}, (table) => [
  index('goals_by_type').on(table.type),
]);

// ============================================
// ASSETS (Non-investment assets like home)
// ============================================
export const assets = sqliteTable('assets', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  type: text('type', {
    enum: ['home', 'vehicle', 'other']
  }).notNull(),
  name: text('name').notNull(),
  address: text('address'),
  zillowId: text('zillow_id'),
  currentValue: real('current_value').notNull(),
  isAutoUpdated: integer('is_auto_updated', { mode: 'boolean' }).notNull(),
  lastUpdated: integer('last_updated').notNull(),
  purchasePrice: real('purchase_price'),
  purchaseDate: integer('purchase_date'),
  notes: text('notes'),
}, (table) => [
  index('assets_by_type').on(table.type),
]);

// ============================================
// LIABILITIES
// ============================================
export const liabilities = sqliteTable('liabilities', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  type: text('type', {
    enum: ['mortgage', 'auto_loan', 'student_loan', 'personal_loan', 'credit_card', 'other']
  }).notNull(),
  name: text('name').notNull(),
  currentBalance: real('current_balance').notNull(),
  interestRate: real('interest_rate').notNull(), // Annual rate as decimal
  minimumPayment: real('minimum_payment').notNull(),
  originalAmount: real('original_amount'),
  termMonths: integer('term_months'),
  startDate: integer('start_date'),
  extraPaymentMonthly: real('extra_payment_monthly'),
  payoffDate: integer('payoff_date'),
  linkedAccountId: text('linked_account_id').references(() => accounts.id),
  scheduledPayments: text('scheduled_payments', { mode: 'json' }).$type<ScheduledPayment[]>(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => [
  index('liabilities_by_type').on(table.type),
  index('liabilities_by_linked_account').on(table.linkedAccountId),
]);

// ============================================
// INCOME SOURCES
// ============================================
export const incomeSources = sqliteTable('income_sources', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  type: text('type', {
    enum: ['salary', 'self_employment', 'social_security', 'pension', 'rental', 'dividends', 'other']
  }).notNull(),
  name: text('name').notNull(),
  annualAmount: real('annual_amount').notNull(),
  startDate: integer('start_date'),
  endDate: integer('end_date'),
  growthRate: real('growth_rate').notNull(),
  isTaxable: integer('is_taxable', { mode: 'boolean' }).notNull(),
  createdAt: integer('created_at').notNull(),
}, (table) => [
  index('income_sources_by_type').on(table.type),
]);

// ============================================
// RETIREMENT PROFILE (singleton-ish)
// ============================================
export const retirementProfile = sqliteTable('retirement_profile', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  retirementDate: integer('retirement_date').notNull(),
  currentAge: integer('current_age').notNull(),
  annualSpending: real('annual_spending').notNull(),
  isSpendingAutoCalculated: integer('is_spending_auto_calculated', { mode: 'boolean' }).notNull(),
  monthlyBaseLivingExpense: real('monthly_base_living_expense'),
  isBaseLivingExpenseAutoCalculated: integer('is_base_living_expense_auto_calculated', { mode: 'boolean' }),
});

// ============================================
// SOCIAL SECURITY
// ============================================
export const socialSecurity = sqliteTable('social_security', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  benefitAt62: real('benefit_at_62').notNull(),
  benefitAt67: real('benefit_at_67').notNull(),
  benefitAt70: real('benefit_at_70').notNull(),
  birthYear: integer('birth_year').notNull(),
  birthMonth: integer('birth_month').notNull(),
  colaRate: real('cola_rate').notNull(),
  plannedClaimingAge: integer('planned_claiming_age'),
  hasSpouse: integer('has_spouse', { mode: 'boolean' }),
  spouseBenefitAt67: real('spouse_benefit_at_67'),
  spouseBirthYear: integer('spouse_birth_year'),
  spousePlannedClaimingAge: integer('spouse_planned_claiming_age'),
  updatedAt: integer('updated_at').notNull(),
});

// ============================================
// MONTE CARLO ASSUMPTIONS
// ============================================
export const monteCarloAssumptions = sqliteTable('monte_carlo_assumptions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  realReturn: real('real_return').notNull(),
  volatility: real('volatility').notNull(),
  planToAge: integer('plan_to_age').notNull(),
  targetSuccessRate: real('target_success_rate').notNull(),
  iterations: integer('iterations'),
  partTimeAnnualIncome: real('part_time_annual_income'),
  partTimeYears: integer('part_time_years'),
  legacyTarget: real('legacy_target'),
  updatedAt: integer('updated_at').notNull(),
});

// ============================================
// ONE-TIME EVENTS (for projections)
// ============================================
export const oneTimeEvents = sqliteTable('one_time_events', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  year: integer('year').notNull(),
  amount: real('amount').notNull(), // positive = income, negative = expense
  category: text('category'),
  notes: text('notes'),
  createdAt: integer('created_at').notNull(),
}, (table) => [
  index('events_by_year').on(table.year),
]);

// ============================================
// ANNUAL BUDGETS
// ============================================
export const annualBudgets = sqliteTable('annual_budgets', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  annualAmount: real('annual_amount').notNull(),
  startYear: integer('start_year'),
  endYear: integer('end_year'),
  notes: text('notes'),
  isEssential: integer('is_essential', { mode: 'boolean' }),
  createdAt: integer('created_at').notNull(),
});

// ============================================
// GUARDRAILS CONFIGURATION
// ============================================
export const guardrailsConfig = sqliteTable('guardrails_config', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  isEnabled: integer('is_enabled', { mode: 'boolean' }).notNull(),
  upperThresholdPercent: real('upper_threshold_percent').notNull(),
  lowerThresholdPercent: real('lower_threshold_percent').notNull(),
  spendingAdjustmentPercent: real('spending_adjustment_percent').notNull(),
  spendingFloor: real('spending_floor'),
  spendingCeiling: real('spending_ceiling'),
  strategyType: text('strategy_type', {
    enum: ['percentage', 'fixed']
  }).notNull(),
  fixedAdjustmentAmount: real('fixed_adjustment_amount'),
  updatedAt: integer('updated_at').notNull(),
});

// ============================================
// SETTINGS
// ============================================
export const settings = sqliteTable('settings', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  key: text('key').notNull().unique(),
  value: text('value', { mode: 'json' }).$type<unknown>(),
}, (table) => [
  index('settings_by_key').on(table.key),
]);

// ============================================
// IMPORT HISTORY
// ============================================
export const importHistory = sqliteTable('import_history', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  filename: text('filename').notNull(),
  institution: text('institution').notNull(),
  accountId: text('account_id').references(() => accounts.id),
  transactionCount: integer('transaction_count').notNull(),
  duplicatesSkipped: integer('duplicates_skipped').notNull(),
  importedAt: integer('imported_at').notNull(),
  status: text('status', {
    enum: ['success', 'partial', 'failed']
  }).notNull(),
  errors: text('errors', { mode: 'json' }).$type<string[]>(),
}, (table) => [
  index('import_history_by_date').on(table.importedAt),
]);

// ============================================
// PRICE CACHE (for stock/ETF prices)
// ============================================
export const priceCache = sqliteTable('price_cache', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  symbol: text('symbol').notNull().unique(),
  price: real('price').notNull(),
  change: real('change'),
  changePercent: real('change_percent'),
  updatedAt: integer('updated_at').notNull(),
}, (table) => [
  index('price_cache_by_symbol').on(table.symbol),
]);

// ============================================
// MONTE CARLO CACHE
// ============================================
export const monteCarloCache = sqliteTable('monte_carlo_cache', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  inputsHash: text('inputs_hash').notNull().unique(),
  results: text('results', { mode: 'json' }).$type<MonteCarloCacheResults>().notNull(),
  createdAt: integer('created_at').notNull(),
  expiresAt: integer('expires_at').notNull(),
}, (table) => [
  index('monte_carlo_cache_by_hash').on(table.inputsHash),
]);

// ============================================
// ALLOCATION TARGETS
// ============================================
export const allocationTargets = sqliteTable('allocation_targets', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  accountId: text('account_id').references(() => accounts.id),
  assetClass: text('asset_class', {
    enum: ['us_stock', 'intl_stock', 'bond', 'cash', 'real_estate', 'other']
  }).notNull(),
  targetPercent: real('target_percent').notNull(),
  rebalanceThreshold: real('rebalance_threshold').notNull(),
}, (table) => [
  index('allocation_by_asset_class').on(table.assetClass),
  index('allocation_by_account').on(table.accountId),
  index('allocation_by_account_asset').on(table.accountId, table.assetClass),
]);
