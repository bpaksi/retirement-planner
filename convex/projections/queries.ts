import { query } from "../_generated/server";
import { v } from "convex/values";

// Default projection assumptions
const DEFAULTS = {
  expectedReturn: 0.05, // 5% real
  optimisticReturn: 0.07, // 7% real
  pessimisticReturn: 0.03, // 3% real
  lifeExpectancy: 95,
};

// Get all inputs needed for projection
export const getProjectionInputs = query({
  args: {},
  handler: async (ctx) => {
    // Get retirement profile if it exists
    const profile = await ctx.db.query("retirementProfile").first();

    // Calculate current net worth
    const holdings = await ctx.db.query("holdings").collect();
    let investmentValue = 0;
    for (const holding of holdings) {
      const price = holding.lastPrice ?? 0;
      investmentValue += holding.shares * price;
    }

    // Get cash accounts
    const accounts = await ctx.db.query("accounts").collect();
    const activeAccounts = accounts.filter((a) => a.isActive);
    const cashAccountTypes = new Set(["checking", "savings", "money_market"]);

    const accountSnapshots = await ctx.db.query("accountSnapshots").collect();
    const latestSnapshots = new Map<string, number>();
    for (const snapshot of accountSnapshots) {
      const accountId = snapshot.accountId.toString();
      const existing = latestSnapshots.get(accountId);
      if (!existing || snapshot.date > existing) {
        latestSnapshots.set(accountId, snapshot.balance);
      }
    }

    let cashValue = 0;
    for (const account of activeAccounts) {
      if (cashAccountTypes.has(account.type)) {
        const balance = latestSnapshots.get(account._id.toString()) ?? 0;
        cashValue += balance;
      }
    }

    // Get assets
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

    const currentNetWorth = investmentValue + cashValue + assetValue - liabilityValue;
    const portfolioValue = investmentValue + cashValue;

    // Calculate suggested spending from transactions
    const now = Date.now();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const startDate = oneYearAgo.getTime();

    const spendingAccountTypes = new Set([
      "credit_card",
      "checking",
      "savings",
      "money_market",
    ]);

    const spendingAccountIds = new Set(
      activeAccounts
        .filter((a) => spendingAccountTypes.has(a.type))
        .map((a) => a._id.toString())
    );

    const categories = await ctx.db.query("categories").collect();
    const transferCategoryIds = new Set(
      categories.filter((c) => c.type === "transfer").map((c) => c._id.toString())
    );

    const allTransactions = await ctx.db.query("transactions").collect();
    const relevantTransactions = allTransactions.filter((t) => {
      if (!spendingAccountIds.has(t.accountId.toString())) return false;
      if (t.date < startDate || t.date > now) return false;
      if (t.amount >= 0) return false;
      if (t.isTransfer) return false;
      if (t.categoryId && transferCategoryIds.has(t.categoryId.toString())) return false;
      return true;
    });

    let totalSpending = 0;
    for (const t of relevantTransactions) {
      totalSpending += Math.abs(t.amount);
    }

    let suggestedSpending = 0;
    let monthsOfData = 0;

    if (relevantTransactions.length > 0) {
      const transactionDates = relevantTransactions.map((t) => t.date);
      const minDate = Math.min(...transactionDates);
      const maxDate = Math.max(...transactionDates);
      monthsOfData = Math.max(
        1,
        Math.ceil((maxDate - minDate) / (30 * 24 * 60 * 60 * 1000))
      );
      const monthlyAverage = totalSpending / monthsOfData;
      suggestedSpending = Math.round(monthlyAverage * 12);
    }

    // Get counts of additional inputs
    const incomeSources = await ctx.db.query("incomeSources").collect();
    const oneTimeEvents = await ctx.db.query("oneTimeEvents").collect();
    const annualBudgets = await ctx.db.query("annualBudgets").collect();

    return {
      profile,
      currentNetWorth,
      portfolioValue,
      investments: investmentValue,
      cash: cashValue,
      assets: assetValue,
      liabilities: liabilityValue,
      suggestedSpending,
      monthsOfData,
      hasEnoughData: monthsOfData >= 3,
      // Additional inputs summary
      incomeSourcesCount: incomeSources.length,
      oneTimeEventsCount: oneTimeEvents.length,
      annualBudgetsCount: annualBudgets.length,
      totalAnnualIncome: incomeSources.reduce((sum, s) => sum + s.annualAmount, 0),
      totalAnnualBudgets: annualBudgets.reduce((sum, b) => sum + b.annualAmount, 0),
    };
  },
});

// Calculate the enhanced projection with income sources, events, and budgets
export const calculateProjection = query({
  args: {
    currentNetWorth: v.number(),
    annualSpending: v.number(),
    currentAge: v.number(),
    retirementAge: v.number(),
    lifeExpectancy: v.optional(v.number()),
    expectedReturn: v.optional(v.number()),
    optimisticReturn: v.optional(v.number()),
    pessimisticReturn: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const lifeExpectancy = args.lifeExpectancy ?? DEFAULTS.lifeExpectancy;
    const expectedReturn = args.expectedReturn ?? DEFAULTS.expectedReturn;
    const optimisticReturn = args.optimisticReturn ?? DEFAULTS.optimisticReturn;
    const pessimisticReturn = args.pessimisticReturn ?? DEFAULTS.pessimisticReturn;

    const currentYear = new Date().getFullYear();

    // Fetch additional inputs
    const incomeSources = await ctx.db.query("incomeSources").collect();
    const oneTimeEvents = await ctx.db.query("oneTimeEvents").collect();
    const annualBudgets = await ctx.db.query("annualBudgets").collect();

    // Build a map of one-time events by year
    const eventsByYear = new Map<number, number>();
    for (const event of oneTimeEvents) {
      const existing = eventsByYear.get(event.year) ?? 0;
      eventsByYear.set(event.year, existing + event.amount);
    }

    // Helper to get income for a specific year
    const getIncomeForYear = (year: number): number => {
      const yearStart = new Date(year, 0, 1).getTime();
      const yearEnd = new Date(year, 11, 31).getTime();

      let total = 0;
      for (const source of incomeSources) {
        const startsBeforeYearEnd = !source.startDate || source.startDate <= yearEnd;
        const endsAfterYearStart = !source.endDate || source.endDate >= yearStart;

        if (startsBeforeYearEnd && endsAfterYearStart) {
          total += source.annualAmount;
        }
      }
      return total;
    };

    // Helper to get annual budget adjustments for a specific year
    const getBudgetAdjustmentForYear = (year: number): number => {
      let total = 0;
      for (const budget of annualBudgets) {
        const startsBeforeOrDuringYear = !budget.startYear || budget.startYear <= year;
        const endsAfterOrDuringYear = !budget.endYear || budget.endYear >= year;

        if (startsBeforeOrDuringYear && endsAfterOrDuringYear) {
          total += budget.annualAmount;
        }
      }
      return total;
    };

    const years: Array<{
      year: number;
      age: number;
      expected: number;
      optimistic: number;
      pessimistic: number;
      isRetired: boolean;
      income: number;
      spending: number;
      oneTimeEvent: number;
    }> = [];

    let expected = args.currentNetWorth;
    let optimistic = args.currentNetWorth;
    let pessimistic = args.currentNetWorth;

    // Track when funds run out in each scenario
    let expectedRunsOutAge: number | null = null;
    let optimisticRunsOutAge: number | null = null;
    let pessimisticRunsOutAge: number | null = null;

    for (let age = args.currentAge; age <= lifeExpectancy; age++) {
      const year = currentYear + (age - args.currentAge);
      const isRetired = age >= args.retirementAge;

      // Apply returns (real returns)
      expected *= 1 + expectedReturn;
      optimistic *= 1 + optimisticReturn;
      pessimistic *= 1 + pessimisticReturn;

      // Get income for this year (only when retired)
      const incomeThisYear = isRetired ? getIncomeForYear(year) : 0;

      // Get spending for this year (base + budget adjustments, only when retired)
      const budgetAdjustment = isRetired ? getBudgetAdjustmentForYear(year) : 0;
      const spendingThisYear = isRetired ? args.annualSpending + budgetAdjustment : 0;

      // Get one-time events for this year
      const oneTimeEventAmount = eventsByYear.get(year) ?? 0;

      // Apply income, spending, and events if retired
      if (isRetired) {
        // Add income
        expected += incomeThisYear;
        optimistic += incomeThisYear;
        pessimistic += incomeThisYear;

        // Subtract spending
        expected -= spendingThisYear;
        optimistic -= spendingThisYear;
        pessimistic -= spendingThisYear;
      }

      // Apply one-time events (can happen before or during retirement)
      // Positive = income, Negative = expense
      expected += oneTimeEventAmount;
      optimistic += oneTimeEventAmount;
      pessimistic += oneTimeEventAmount;

      // Track when funds run out
      if (expected <= 0 && expectedRunsOutAge === null) {
        expectedRunsOutAge = age;
      }
      if (optimistic <= 0 && optimisticRunsOutAge === null) {
        optimisticRunsOutAge = age;
      }
      if (pessimistic <= 0 && pessimisticRunsOutAge === null) {
        pessimisticRunsOutAge = age;
      }

      years.push({
        year,
        age,
        expected: Math.max(0, Math.round(expected)),
        optimistic: Math.max(0, Math.round(optimistic)),
        pessimistic: Math.max(0, Math.round(pessimistic)),
        isRetired,
        income: incomeThisYear,
        spending: spendingThisYear,
        oneTimeEvent: oneTimeEventAmount,
      });
    }

    // Calculate readiness status
    let status: "on_track" | "at_risk" | "behind";

    if (expectedRunsOutAge === null) {
      status = "on_track";
    } else if (optimisticRunsOutAge === null) {
      status = "at_risk";
    } else {
      status = "behind";
    }

    // Calculate projected net worth at retirement
    const retirementYear = years.find((y) => y.age === args.retirementAge);
    const projectedNetWorthAtRetirement = retirementYear?.expected ?? 0;

    // Calculate years until retirement
    const yearsUntilRetirement = Math.max(0, args.retirementAge - args.currentAge);

    // Calculate summary of adjustments
    const totalIncomeOverRetirement = years
      .filter((y) => y.isRetired)
      .reduce((sum, y) => sum + y.income, 0);
    const totalOneTimeEvents = oneTimeEvents.reduce((sum, e) => sum + e.amount, 0);
    const avgAnnualBudgetAdjustment =
      annualBudgets.reduce((sum, b) => sum + b.annualAmount, 0);

    return {
      years,
      status,
      expectedRunsOutAge,
      optimisticRunsOutAge,
      pessimisticRunsOutAge,
      projectedNetWorthAtRetirement,
      yearsUntilRetirement,
      assumptions: {
        expectedReturn,
        optimisticReturn,
        pessimisticReturn,
        lifeExpectancy,
      },
      adjustments: {
        incomeSourcesCount: incomeSources.length,
        oneTimeEventsCount: oneTimeEvents.length,
        annualBudgetsCount: annualBudgets.length,
        totalIncomeOverRetirement,
        totalOneTimeEvents,
        avgAnnualBudgetAdjustment,
      },
    };
  },
});

// Calculate projection with guardrails strategy applied
export const calculateProjectionWithGuardrails = query({
  args: {
    currentNetWorth: v.number(),
    annualSpending: v.number(),
    currentAge: v.number(),
    retirementAge: v.number(),
    lifeExpectancy: v.optional(v.number()),
    expectedReturn: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const lifeExpectancy = args.lifeExpectancy ?? DEFAULTS.lifeExpectancy;
    const expectedReturn = args.expectedReturn ?? DEFAULTS.expectedReturn;
    const currentYear = new Date().getFullYear();

    // Get guardrails config
    const guardrailsConfig = await ctx.db.query("guardrailsConfig").first();

    // If guardrails not enabled, return simplified projection
    if (!guardrailsConfig?.isEnabled) {
      return {
        isEnabled: false,
        years: [],
        summary: null,
      };
    }

    // Fetch additional inputs
    const incomeSources = await ctx.db.query("incomeSources").collect();
    const oneTimeEvents = await ctx.db.query("oneTimeEvents").collect();
    const annualBudgets = await ctx.db.query("annualBudgets").collect();

    // Build helpers
    const eventsByYear = new Map<number, number>();
    for (const event of oneTimeEvents) {
      const existing = eventsByYear.get(event.year) ?? 0;
      eventsByYear.set(event.year, existing + event.amount);
    }

    const getIncomeForYear = (year: number): number => {
      const yearStart = new Date(year, 0, 1).getTime();
      const yearEnd = new Date(year, 11, 31).getTime();
      let total = 0;
      for (const source of incomeSources) {
        const startsBeforeYearEnd = !source.startDate || source.startDate <= yearEnd;
        const endsAfterYearStart = !source.endDate || source.endDate >= yearStart;
        if (startsBeforeYearEnd && endsAfterYearStart) {
          total += source.annualAmount;
        }
      }
      return total;
    };

    const getBudgetAdjustmentForYear = (year: number): number => {
      let total = 0;
      for (const budget of annualBudgets) {
        const startsBeforeOrDuringYear = !budget.startYear || budget.startYear <= year;
        const endsAfterOrDuringYear = !budget.endYear || budget.endYear >= year;
        if (startsBeforeOrDuringYear && endsAfterOrDuringYear) {
          total += budget.annualAmount;
        }
      }
      return total;
    };

    // Calculate the "target" portfolio path (what we'd expect with constant spending)
    // This becomes the reference for guardrails

    // Track guardrails projection
    const years: Array<{
      year: number;
      age: number;
      portfolio: number;
      spending: number;
      baseSpending: number;
      income: number;
      oneTimeEvent: number;
      isRetired: boolean;
      guardrailTriggered: "upper" | "lower" | null;
      spendingAdjustment: number;
      upperThreshold: number;
      lowerThreshold: number;
    }> = [];

    let portfolio = args.currentNetWorth;
    let currentSpending = args.annualSpending;
    const baseSpending = args.annualSpending;

    // Track statistics
    let upperTriggerCount = 0;
    let lowerTriggerCount = 0;
    let totalSpendingAdjustments = 0;
    let minSpending = args.annualSpending;
    let maxSpending = args.annualSpending;

    // Calculate target portfolio at retirement (for threshold reference)
    let targetPortfolioAtRetirement = args.currentNetWorth;
    for (let age = args.currentAge; age < args.retirementAge; age++) {
      targetPortfolioAtRetirement *= 1 + expectedReturn;
    }

    for (let age = args.currentAge; age <= lifeExpectancy; age++) {
      const year = currentYear + (age - args.currentAge);
      const isRetired = age >= args.retirementAge;

      // Apply investment returns
      portfolio *= 1 + expectedReturn;

      // Get income and events
      const incomeThisYear = isRetired ? getIncomeForYear(year) : 0;
      const budgetAdjustment = isRetired ? getBudgetAdjustmentForYear(year) : 0;
      const oneTimeEventAmount = eventsByYear.get(year) ?? 0;

      // Calculate thresholds based on target portfolio
      // Target portfolio declines each year by expected spending
      const yearsIntoRetirement = Math.max(0, age - args.retirementAge);
      const expectedPortfolioAtThisAge = isRetired
        ? targetPortfolioAtRetirement * Math.pow(1 + expectedReturn, yearsIntoRetirement)
          - baseSpending * yearsIntoRetirement
        : portfolio;

      const upperThreshold = expectedPortfolioAtThisAge * (1 + guardrailsConfig.upperThresholdPercent);
      const lowerThreshold = expectedPortfolioAtThisAge * (1 - guardrailsConfig.lowerThresholdPercent);

      // Check guardrails and adjust spending (only when retired)
      let guardrailTriggered: "upper" | "lower" | null = null;
      let spendingAdjustment = 0;

      if (isRetired) {
        if (portfolio > upperThreshold) {
          // Portfolio is doing well - increase spending
          guardrailTriggered = "upper";
          upperTriggerCount++;

          if (guardrailsConfig.strategyType === "percentage") {
            spendingAdjustment = currentSpending * guardrailsConfig.spendingAdjustmentPercent;
          } else {
            spendingAdjustment = guardrailsConfig.fixedAdjustmentAmount ?? 0;
          }

          currentSpending += spendingAdjustment;

          // Apply ceiling
          if (guardrailsConfig.spendingCeiling && currentSpending > guardrailsConfig.spendingCeiling) {
            currentSpending = guardrailsConfig.spendingCeiling;
          }
        } else if (portfolio < lowerThreshold) {
          // Portfolio is struggling - decrease spending
          guardrailTriggered = "lower";
          lowerTriggerCount++;

          if (guardrailsConfig.strategyType === "percentage") {
            spendingAdjustment = -(currentSpending * guardrailsConfig.spendingAdjustmentPercent);
          } else {
            spendingAdjustment = -(guardrailsConfig.fixedAdjustmentAmount ?? 0);
          }

          currentSpending += spendingAdjustment;

          // Apply floor
          if (guardrailsConfig.spendingFloor && currentSpending < guardrailsConfig.spendingFloor) {
            currentSpending = guardrailsConfig.spendingFloor;
          }
        }

        // Track min/max spending
        minSpending = Math.min(minSpending, currentSpending);
        maxSpending = Math.max(maxSpending, currentSpending);
        totalSpendingAdjustments += Math.abs(spendingAdjustment);

        // Apply income
        portfolio += incomeThisYear;

        // Apply spending (base + adjustments + budget items)
        const totalSpendingThisYear = currentSpending + budgetAdjustment;
        portfolio -= totalSpendingThisYear;
      }

      // Apply one-time events
      portfolio += oneTimeEventAmount;

      years.push({
        year,
        age,
        portfolio: Math.max(0, Math.round(portfolio)),
        spending: Math.round(currentSpending + budgetAdjustment),
        baseSpending: Math.round(currentSpending),
        income: incomeThisYear,
        oneTimeEvent: oneTimeEventAmount,
        isRetired,
        guardrailTriggered,
        spendingAdjustment: Math.round(spendingAdjustment),
        upperThreshold: Math.round(upperThreshold),
        lowerThreshold: Math.round(lowerThreshold),
      });

      // Stop if portfolio depleted
      if (portfolio <= 0) break;
    }

    // Calculate final statistics
    const lastYear = years[years.length - 1];
    const portfolioLastsToAge = lastYear?.portfolio > 0 ? lastYear.age : years.findIndex(y => y.portfolio <= 0) + args.currentAge - 1;
    const fundsLastToLifeExpectancy = portfolioLastsToAge >= lifeExpectancy;

    return {
      isEnabled: true,
      config: {
        upperThresholdPercent: guardrailsConfig.upperThresholdPercent,
        lowerThresholdPercent: guardrailsConfig.lowerThresholdPercent,
        spendingAdjustmentPercent: guardrailsConfig.spendingAdjustmentPercent,
        strategyType: guardrailsConfig.strategyType,
        spendingFloor: guardrailsConfig.spendingFloor,
        spendingCeiling: guardrailsConfig.spendingCeiling,
      },
      years,
      summary: {
        upperTriggerCount,
        lowerTriggerCount,
        totalAdjustments: upperTriggerCount + lowerTriggerCount,
        minSpending: Math.round(minSpending),
        maxSpending: Math.round(maxSpending),
        spendingRange: Math.round(maxSpending - minSpending),
        avgSpendingAdjustment: years.length > 0 ? Math.round(totalSpendingAdjustments / years.filter(y => y.isRetired).length) : 0,
        finalPortfolio: lastYear?.portfolio ?? 0,
        portfolioLastsToAge,
        fundsLastToLifeExpectancy,
        baseSpending,
        finalSpending: lastYear?.baseSpending ?? baseSpending,
      },
    };
  },
});
