"use client";

import { useState, useMemo, useCallback } from "react";
import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { format, startOfMonth, endOfMonth, parse } from "date-fns";
import { api } from "../../../convex/_generated/api";
import { Sidebar } from "@/components/layout/Sidebar";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { SpendingPieChart } from "@/components/charts/SpendingPieChart";
import { SpendingTrendChart } from "@/components/charts/SpendingTrendChart";
import { formatCurrency } from "@/lib/utils";
import { TrendingDown, TrendingUp, DollarSign, PiggyBank, ArrowLeftRight, Info } from "lucide-react";

type DateRange = "thisMonth" | "lastMonth" | "last3Months" | "last6Months" | "thisYear" | "lastYear" | "allTime";

function getDateRange(range: DateRange): { start: number; end: number } {
  const now = new Date();
  const end = now.getTime();
  let start: Date;

  switch (range) {
    case "thisMonth":
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "lastMonth":
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return {
        start: start.getTime(),
        end: new Date(now.getFullYear(), now.getMonth(), 0).getTime(),
      };
    case "last3Months":
      start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      break;
    case "last6Months":
      start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      break;
    case "thisYear":
      start = new Date(now.getFullYear(), 0, 1);
      break;
    case "lastYear":
      start = new Date(now.getFullYear() - 1, 0, 1);
      return {
        start: start.getTime(),
        end: new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59).getTime(),
      };
    case "allTime":
      // Go back 10 years to capture all data
      start = new Date(now.getFullYear() - 10, 0, 1);
      break;
    default:
      start = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  return { start: start.getTime(), end };
}

export default function SpendingPage() {
  const router = useRouter();
  const [dateRange, setDateRange] = useState<DateRange>("lastYear");
  const [showEssentialOnly, setShowEssentialOnly] = useState<boolean | null>(null);

  const { start, end } = useMemo(() => getDateRange(dateRange), [dateRange]);

  // Navigate to transactions page with category filter
  const handleCategoryClick = useCallback(
    (categoryId: string) => {
      const startDate = format(new Date(start), "yyyy-MM-dd");
      const endDate = format(new Date(end), "yyyy-MM-dd");
      router.push(
        `/transactions?category=${categoryId}&startDate=${startDate}&endDate=${endDate}`
      );
    },
    [router, start, end]
  );

  // Navigate to transactions page with month filter
  const handleMonthClick = useCallback(
    (year: number, month: string) => {
      // Parse the month name (e.g., "Jan", "Feb") to get the month number
      const monthDate = parse(month, "MMM", new Date());
      const targetDate = new Date(year, monthDate.getMonth(), 1);
      const startDate = format(startOfMonth(targetDate), "yyyy-MM-dd");
      const endDate = format(endOfMonth(targetDate), "yyyy-MM-dd");
      router.push(`/transactions?startDate=${startDate}&endDate=${endDate}`);
    },
    [router]
  );

  const spendingData = useQuery(api.analytics.spending.getSpendingByCategory, {
    startDate: start,
    endDate: end,
  });

  const trendData = useQuery(api.analytics.spending.getSpendingTrend, {
    months: 12,
  });

  const filteredSpending = useMemo(() => {
    if (!spendingData) return null;
    if (showEssentialOnly === null) return spendingData;

    return {
      ...spendingData,
      byCategory: spendingData.byCategory.filter(
        (item) => item.category?.isEssential === showEssentialOnly
      ),
    };
  }, [spendingData, showEssentialOnly]);

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold">Spending Analysis</h1>
              <p className="text-muted-foreground mt-1">
                Track and analyze your spending patterns
              </p>
            </div>

            <div className="flex items-center gap-4">
              <Select
                value={showEssentialOnly === null ? "all" : showEssentialOnly ? "essential" : "discretionary"}
                onChange={(e) => {
                  const value = e.target.value;
                  setShowEssentialOnly(
                    value === "all" ? null : value === "essential"
                  );
                }}
                className="w-[160px]"
              >
                <option value="all">All Spending</option>
                <option value="essential">Essential Only</option>
                <option value="discretionary">Discretionary Only</option>
              </Select>

              <Select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as DateRange)}
                className="w-[180px]"
              >
                <option value="thisMonth">This Month</option>
                <option value="lastMonth">Last Month</option>
                <option value="last3Months">Last 3 Months</option>
                <option value="last6Months">Last 6 Months</option>
                <option value="thisYear">This Year (2026)</option>
                <option value="lastYear">Last Year (2025)</option>
                <option value="allTime">All Time</option>
              </Select>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Spending</p>
                    <p className="text-2xl font-bold">
                      {spendingData
                        ? formatCurrency(spendingData.totalSpending)
                        : "-"}
                    </p>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
                    <TrendingDown className="h-5 w-5 text-destructive" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Essential</p>
                    <p className="text-2xl font-bold">
                      {spendingData
                        ? formatCurrency(spendingData.essentialSpending)
                        : "-"}
                    </p>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <DollarSign className="h-5 w-5 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Discretionary</p>
                    <p className="text-2xl font-bold">
                      {spendingData
                        ? formatCurrency(spendingData.discretionarySpending)
                        : "-"}
                    </p>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-warning/10 flex items-center justify-center">
                    <PiggyBank className="h-5 w-5 text-warning" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Transactions</p>
                    <p className="text-2xl font-bold">
                      {spendingData?.transactionCount ?? "-"}
                    </p>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-success" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1">
                      <p className="text-sm text-muted-foreground">Transfers</p>
                      <div className="group relative">
                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-popover text-popover-foreground text-xs rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none w-64 z-50 border">
                          Transfers include credit card payments, bank transfers, and money moved between accounts. Not counted as spending.
                        </div>
                      </div>
                    </div>
                    <p className="text-2xl font-bold">
                      {spendingData?.transfers
                        ? formatCurrency(spendingData.transfers.total)
                        : "-"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {spendingData?.transfers?.count ?? 0} transactions
                    </p>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                    <ArrowLeftRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <Card>
              <CardHeader>
                <CardTitle>Spending by Category</CardTitle>
                <CardDescription>
                  Breakdown of your spending across categories
                </CardDescription>
              </CardHeader>
              <CardContent>
                {filteredSpending ? (
                  <SpendingPieChart
                    data={filteredSpending.byCategory}
                    onCategoryClick={handleCategoryClick}
                  />
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    Loading...
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Monthly Trend</CardTitle>
                <CardDescription>
                  Income and expenses over the past 12 months
                </CardDescription>
              </CardHeader>
              <CardContent>
                {trendData ? (
                  <SpendingTrendChart
                    data={trendData}
                    onMonthClick={handleMonthClick}
                  />
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    Loading...
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Category Breakdown Table */}
          <Card>
            <CardHeader>
              <CardTitle>Category Breakdown</CardTitle>
              <CardDescription>
                Detailed spending by category for the selected period
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredSpending ? (
                <div className="space-y-3">
                  {filteredSpending.byCategory.map((item, index) => {
                    const percentage = spendingData
                      ? (item.total / spendingData.totalSpending) * 100
                      : 0;
                    const isClickable = !!item.category?._id;

                    return (
                      <div
                        key={item.category?._id || index}
                        className={`flex items-center gap-4 p-2 -mx-2 rounded-lg transition-colors ${
                          isClickable
                            ? "cursor-pointer hover:bg-muted/50"
                            : ""
                        }`}
                        onClick={() => {
                          if (item.category?._id) {
                            handleCategoryClick(item.category._id);
                          }
                        }}
                      >
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: item.category?.color || "#607D8B" }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium truncate">
                              {item.category?.name || "Uncategorized"}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              {formatCurrency(item.total)}
                            </span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${percentage}%`,
                                backgroundColor: item.category?.color || "#607D8B",
                              }}
                            />
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground w-12 text-right">
                          {percentage.toFixed(1)}%
                        </span>
                      </div>
                    );
                  })}

                  {filteredSpending.byCategory.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No spending data for this period
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  Loading...
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
