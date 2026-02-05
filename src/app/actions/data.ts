"use server";

// Centralized data fetching actions for client components
// These wrap synchronous database queries to make them usable from client components
// Note: Types should be imported directly from @/db/queries/* files by consuming components

// Accounts
import { listAccounts } from "@/db/queries/accounts";
import { countTransactionsByAccount as countTxByAccount } from "@/db/queries/transactions";
import { getLiabilityByAccount } from "@/db/queries/liabilities";

export async function fetchAccounts(activeOnly = false) {
  return listAccounts(activeOnly);
}

export async function fetchTransactionCountByAccount(accountId: string) {
  return countTxByAccount(accountId);
}

export async function fetchLiabilityByAccount(accountId: string) {
  return getLiabilityByAccount(accountId);
}

// Transactions
import { listTransactions } from "@/db/queries/transactions";

export async function fetchTransactions(args: {
  accountId?: string;
  accountIds?: string[];
  startDate?: number;
  endDate?: number;
  categoryId?: string;
  categoryIds?: string[];
  flaggedOnly?: boolean;
  uncategorizedOnly?: boolean;
  linkedOnly?: boolean;
  searchQuery?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'date' | 'amount' | 'category';
  sortOrder?: 'asc' | 'desc';
}) {
  return listTransactions(args);
}

// Categories
import { listCategories } from "@/db/queries/categories";

export async function fetchCategories() {
  return listCategories();
}

// Liabilities
import {
  listLiabilities,
  getUnlinkedLoanAccounts,
  getLiabilityById,
  getAmortizationSchedule,
  forecastPayoff,
  getCalculatedBalance,
} from "@/db/queries/liabilities";

export async function fetchLiabilities() {
  return listLiabilities();
}

export async function fetchUnlinkedLoanAccounts() {
  return getUnlinkedLoanAccounts();
}

export async function fetchLiabilityById(id: string) {
  return getLiabilityById(id);
}

export async function fetchAmortizationSchedule(liabilityId: string, fromPaymentNumber?: number) {
  return getAmortizationSchedule(liabilityId, fromPaymentNumber);
}

export async function fetchForecastPayoff(args: { id: string }) {
  return forecastPayoff(args);
}

export async function fetchCalculatedBalance(liabilityId: string) {
  return getCalculatedBalance(liabilityId);
}

// Goals
import { listIncomeSources } from "@/db/queries/incomeSources";
import { listOneTimeEvents } from "@/db/queries/oneTimeEvents";
import { listAnnualBudgets } from "@/db/queries/annualBudgets";

export async function fetchIncomeSources() {
  return listIncomeSources();
}

export async function fetchOneTimeEvents() {
  return listOneTimeEvents();
}

export async function fetchAnnualBudgets() {
  return listAnnualBudgets();
}

// Settings/Rules
import { listRulesWithCategories } from "@/db/queries/categorizationRules";

export async function fetchRulesWithCategories() {
  return listRulesWithCategories();
}

// Spending/Analytics
import { getSpendingByCategory, getSpendingTrend, getSpendingSummary } from "@/db/queries/analytics";

export async function fetchSpendingByCategory(args: { startDate: number; endDate: number }) {
  return getSpendingByCategory(args);
}

export async function fetchSpendingTrend(args: { months?: number }) {
  return getSpendingTrend(args);
}

export async function fetchSpendingSummary(args?: { monthsBack?: number }) {
  return getSpendingSummary(args);
}

// Retirement Profile
import { getRetirementProfile } from "@/db/queries/retirementProfile";

export async function fetchRetirementProfile() {
  return getRetirementProfile();
}

// More transactions
import { findSimilarTransactions, findPotentialLinks, getLinkedTransaction } from "@/db/queries/transactions";

export async function fetchSimilarTransactions(transactionId: string, limit?: number) {
  return findSimilarTransactions(transactionId, limit);
}

export async function fetchPotentialLinks(transactionId: string) {
  return findPotentialLinks(transactionId);
}

export async function fetchLinkedTransaction(transactionId: string) {
  return getLinkedTransaction(transactionId);
}

// Net Worth calculation
import { db } from "@/db";
import { holdings, accounts, accountSnapshots, assets, liabilities } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function fetchNetWorthData() {
  // Get current holdings value
  const allHoldings = db.select().from(holdings).all();
  const holdingsValue = allHoldings.reduce((sum, h) => sum + (h.shares * (h.lastPrice ?? 0)), 0);

  // Get account balances
  const accountList = db.select().from(accounts).where(eq(accounts.isActive, true)).all();
  const cashAccounts = accountList.filter(a => ['checking', 'savings', 'money_market'].includes(a.type));
  const cashValue = cashAccounts.reduce((sum, a) => {
    // Get latest snapshot for this account
    const snapshot = db.select()
      .from(accountSnapshots)
      .where(eq(accountSnapshots.accountId, a.id))
      .orderBy(desc(accountSnapshots.date))
      .limit(1)
      .get();
    return sum + (snapshot?.balance ?? 0);
  }, 0);

  // Get assets value
  const assetsList = db.select().from(assets).all();
  const assetsValue = assetsList.reduce((sum, a) => sum + (a.currentValue ?? 0), 0);

  // Get liabilities value
  const liabilitiesList = db.select().from(liabilities).all();
  const liabilitiesValue = liabilitiesList.reduce((sum, l) => sum + l.currentBalance, 0);

  return {
    investments: holdingsValue,
    cash: cashValue,
    assets: assetsValue,
    liabilities: liabilitiesValue,
    netWorth: holdingsValue + cashValue + assetsValue - liabilitiesValue,
    portfolioValue: holdingsValue + cashValue,
  };
}

// Projections/Monte Carlo
import { getSimulationInputs, getAssumptionsWithDefaults } from "@/db/queries/monteCarlo";
import { getGuardrailsConfig } from "@/db/queries/guardrails";

export async function fetchSimulationInputs() {
  return getSimulationInputs();
}

export async function fetchAssumptionsWithDefaults() {
  return getAssumptionsWithDefaults();
}

export async function fetchGuardrailsConfig() {
  return getGuardrailsConfig();
}

// Note: Types should be imported directly from @/db/queries/* files, not from here
