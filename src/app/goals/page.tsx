"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Sidebar } from "@/components/layout/Sidebar";
import { Card, CardContent } from "@/components/ui/Card";
import { IncomeSourcesList } from "@/components/goals/IncomeSourcesList";
import { OneTimeEventsList } from "@/components/goals/OneTimeEventsList";
import { AnnualBudgetsList } from "@/components/goals/AnnualBudgetsList";
import { formatCurrency } from "@/lib/utils";
import { DollarSign, Calendar, Wallet, Info } from "lucide-react";

export default function GoalsPage() {
  // Get summary data
  const incomeSources = useQuery(api.incomeSources.queries.list);
  const oneTimeEvents = useQuery(api.oneTimeEvents.queries.list);
  const annualBudgets = useQuery(api.annualBudgets.queries.list);

  // Calculate summaries
  const totalAnnualIncome =
    incomeSources?.reduce((sum, s) => sum + s.annualAmount, 0) ?? 0;

  const totalOneTimeExpenses =
    oneTimeEvents
      ?.filter((e) => e.amount < 0)
      .reduce((sum, e) => sum + Math.abs(e.amount), 0) ?? 0;

  const totalAnnualBudgets =
    annualBudgets?.reduce((sum, b) => sum + b.annualAmount, 0) ?? 0;

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold">Retirement Planning</h1>
            <p className="text-muted-foreground mt-1">
              Configure income sources, events, and budgets for your projections
            </p>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Annual Income
                    </p>
                    <p className="text-2xl font-semibold">
                      {formatCurrency(totalAnnualIncome)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Planned Events
                    </p>
                    <p className="text-2xl font-semibold">
                      {formatCurrency(totalOneTimeExpenses)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <Wallet className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Extra Budgets
                    </p>
                    <p className="text-2xl font-semibold">
                      {formatCurrency(totalAnnualBudgets)}
                      <span className="text-sm text-muted-foreground font-normal">
                        /yr
                      </span>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Info Banner */}
          <div className="bg-muted/50 rounded-lg p-4 mb-6 flex items-start gap-3">
            <Info className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p>
                These inputs refine your retirement projections. Income sources
                add funds after retirement, one-time events are applied in
                specific years, and annual budgets add to your base spending.
              </p>
            </div>
          </div>

          {/* Main Content */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-6">
              <IncomeSourcesList />
              <AnnualBudgetsList />
            </div>

            {/* Right Column */}
            <div>
              <OneTimeEventsList />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
