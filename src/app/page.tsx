import { Sidebar } from "@/components/layout/Sidebar";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SpendingPieChart } from "@/components/charts/SpendingPieChart";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  ArrowRight,
  Flag,
  Receipt,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { listAccounts } from "@/db/queries/accounts";
import { getRecentTransactions, getFlaggedTransactions } from "@/db/queries/transactions";
import { getSpendingByCategory, getMonthlyTotals } from "@/db/queries/analytics";
import { checkSeedStatus, runSeed } from "@/db/seed";

export default async function DashboardPage() {
  // Check and run seed if needed
  const seedStatus = checkSeedStatus();
  if (!seedStatus.categoriesSeeded) {
    runSeed();
  }

  // Get current month date range
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const endOfMonth = now.getTime();

  const accounts = listAccounts(true);
  const recentTransactions = getRecentTransactions(5);
  const flaggedTransactions = getFlaggedTransactions(5);
  const spendingData = getSpendingByCategory({ startDate: startOfMonth, endDate: endOfMonth });
  const monthlyTotals = getMonthlyTotals({ year: now.getFullYear(), month: now.getMonth() + 1 });

  const hasData = accounts && accounts.length > 0;

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Your retirement planning overview
            </p>
          </div>

          {!hasData ? (
            /* Getting Started */
            <Card className="mb-8">
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Wallet className="w-8 h-8 text-primary" />
                  </div>
                  <h2 className="text-xl font-semibold mb-2">
                    Welcome to Retirement Planner
                  </h2>
                  <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                    Get started by creating an account and importing your
                    transactions to begin tracking your spending and planning
                    for retirement.
                  </p>
                  <div className="flex items-center justify-center gap-4">
                    <Link href="/accounts">
                      <Button>
                        Create Account
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Monthly Income
                        </p>
                        <p className="text-2xl font-bold">
                          {monthlyTotals
                            ? formatCurrency(monthlyTotals.income)
                            : "-"}
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
                        <p className="text-sm text-muted-foreground">
                          Monthly Spending
                        </p>
                        <p className="text-2xl font-bold">
                          {monthlyTotals
                            ? formatCurrency(monthlyTotals.expenses)
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
                        <p className="text-sm text-muted-foreground">Net Cash Flow</p>
                        <p
                          className={cn(
                            "text-2xl font-bold",
                            monthlyTotals &&
                              (monthlyTotals.net >= 0
                                ? "text-success"
                                : "text-destructive")
                          )}
                        >
                          {monthlyTotals ? formatCurrency(monthlyTotals.net) : "-"}
                        </p>
                      </div>
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Wallet className="h-5 w-5 text-primary" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Needs Review
                        </p>
                        <p className="text-2xl font-bold">
                          {flaggedTransactions?.length ?? 0}
                        </p>
                      </div>
                      <div className="h-10 w-10 rounded-full bg-warning/10 flex items-center justify-center">
                        <Flag className="h-5 w-5 text-warning" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* Spending Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle>This Month&apos;s Spending</CardTitle>
                    <CardDescription>
                      Breakdown by category
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {spendingData && spendingData.byCategory.length > 0 ? (
                      <SpendingPieChart
                        data={spendingData.byCategory}
                        height={250}
                      />
                    ) : (
                      <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                        No spending data yet
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Recent Transactions */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>Recent Transactions</CardTitle>
                      <CardDescription>Last 5 transactions</CardDescription>
                    </div>
                    <Link href="/transactions">
                      <Button variant="ghost" size="sm">
                        View All
                        <ArrowRight className="w-4 h-4 ml-1" />
                      </Button>
                    </Link>
                  </CardHeader>
                  <CardContent>
                    {recentTransactions && recentTransactions.length > 0 ? (
                      <div className="space-y-3">
                        {recentTransactions.map((tx) => (
                          <div
                            key={tx.id}
                            className="flex items-center justify-between py-2 border-b border-border last:border-0"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                                <Receipt className="w-4 h-4 text-muted-foreground" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {tx.description}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {formatDate(tx.date)} ·{" "}
                                  {tx.category?.name || "Uncategorized"}
                                </p>
                              </div>
                            </div>
                            <p
                              className={cn(
                                "text-sm font-mono ml-4",
                                tx.amount < 0
                                  ? "text-destructive"
                                  : "text-success"
                              )}
                            >
                              {formatCurrency(tx.amount)}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Receipt className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>No transactions yet</p>
                        <Link href="/transactions">
                          <Button variant="ghost" size="sm">
                            Import transactions
                          </Button>
                        </Link>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Flagged Transactions Alert */}
              {flaggedTransactions && flaggedTransactions.length > 0 && (
                <Card className="border-warning/50 bg-warning/5">
                  <CardHeader className="flex flex-row items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-warning/10 flex items-center justify-center">
                      <AlertCircle className="h-5 w-5 text-warning" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-warning">
                        {flaggedTransactions.length} Transactions Need Review
                      </CardTitle>
                      <CardDescription>
                        These transactions couldn&apos;t be auto-categorized with
                        high confidence
                      </CardDescription>
                    </div>
                    <Link href="/transactions?flagged=true">
                      <Button variant="outline" size="sm">
                        Review Now
                        <ArrowRight className="w-4 h-4 ml-1" />
                      </Button>
                    </Link>
                  </CardHeader>
                </Card>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
