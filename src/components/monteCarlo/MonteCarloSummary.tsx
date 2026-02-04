"use client";

import { Card, CardContent } from "@/components/ui/Card";
import { formatCurrency, formatPercent } from "@/lib/utils";
import {
  TrendingUp,
  TrendingDown,
  Target,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Wallet,
  Clock,
} from "lucide-react";

interface MonteCarloSummaryProps {
  results: {
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
  };
  inputs: {
    portfolioValue: number;
    annualSpending: number;
    years: number;
    retirementAge?: number;
    planToAge?: number;
  };
  maxWithdrawal?: {
    maxWithdrawal: number;
    withdrawalRate: number;
    comparison?: {
      currentSpending: number;
      difference: number;
      percentDifference: number;
      canAffordCurrentSpending: boolean;
    };
  };
  targetSuccessRate?: number;
}

function getSuccessColor(rate: number): string {
  if (rate >= 0.9) return "text-green-500";
  if (rate >= 0.7) return "text-yellow-500";
  return "text-red-500";
}

function getSuccessBgColor(rate: number): string {
  if (rate >= 0.9) return "bg-green-500/10";
  if (rate >= 0.7) return "bg-yellow-500/10";
  return "bg-red-500/10";
}

function renderSuccessIcon(rate: number, className: string) {
  if (rate >= 0.9) return <CheckCircle2 className={className} />;
  if (rate >= 0.7) return <AlertTriangle className={className} />;
  return <XCircle className={className} />;
}

export function MonteCarloSummary({
  results,
  inputs,
  maxWithdrawal,
  targetSuccessRate = 0.9,
}: MonteCarloSummaryProps) {
  const successColor = getSuccessColor(results.successRate);
  const successBgColor = getSuccessBgColor(results.successRate);

  const withdrawalRate = inputs.annualSpending / inputs.portfolioValue;
  const meetsTarget = results.successRate >= targetSuccessRate;

  return (
    <div className="space-y-4">
      {/* Main Success Rate Card */}
      <Card className={successBgColor}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">
                Probability of Success
              </p>
              <div className="flex items-baseline gap-2">
                <span className={`text-5xl font-bold ${successColor}`}>
                  {Math.round(results.successRate * 100)}%
                </span>
                <span className="text-muted-foreground">
                  ({results.iterations.toLocaleString()} simulations)
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                {meetsTarget ? (
                  <span className="flex items-center gap-1 text-green-500">
                    <CheckCircle2 className="w-4 h-4" />
                    Meets {formatPercent(targetSuccessRate, 0)} target
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-yellow-500">
                    <AlertTriangle className="w-4 h-4" />
                    Below {formatPercent(targetSuccessRate, 0)} target
                  </span>
                )}
              </p>
            </div>
            <div className={`w-20 h-20 rounded-full ${successBgColor} flex items-center justify-center`}>
              {renderSuccessIcon(results.successRate, `w-10 h-10 ${successColor}`)}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Current Withdrawal Rate */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Withdrawal Rate</span>
            </div>
            <p className="text-2xl font-semibold">
              {formatPercent(withdrawalRate)}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(inputs.annualSpending)}/yr
            </p>
          </CardContent>
        </Card>

        {/* Max Sustainable Withdrawal */}
        {maxWithdrawal && (
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Max at {formatPercent(targetSuccessRate, 0)}
                </span>
              </div>
              <p className="text-2xl font-semibold">
                {formatPercent(maxWithdrawal.withdrawalRate)}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(maxWithdrawal.maxWithdrawal)}/yr
              </p>
            </CardContent>
          </Card>
        )}

        {/* Median Ending Balance */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-green-500" />
              <span className="text-sm text-muted-foreground">Median Legacy</span>
            </div>
            <p className="text-2xl font-semibold">
              {formatCurrency(results.success.medianEndingBalance)}
            </p>
            <p className="text-xs text-muted-foreground">
              if successful
            </p>
          </CardContent>
        </Card>

        {/* Time Horizon */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Planning Horizon</span>
            </div>
            <p className="text-2xl font-semibold">
              {inputs.years} years
            </p>
            <p className="text-xs text-muted-foreground">
              {inputs.retirementAge && inputs.planToAge
                ? `Age ${inputs.retirementAge} to ${inputs.planToAge}`
                : "retirement period"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Spending Comparison (if max withdrawal available) */}
      {maxWithdrawal?.comparison && (
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">
                  Spending vs. Sustainable Maximum
                </p>
                <div className="flex items-center gap-2">
                  {maxWithdrawal.comparison.canAffordCurrentSpending ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                      <span className="font-medium">
                        You can afford {formatCurrency(maxWithdrawal.comparison.difference)} more per year
                      </span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-5 h-5 text-yellow-500" />
                      <span className="font-medium">
                        Consider reducing spending by {formatCurrency(Math.abs(maxWithdrawal.comparison.difference))}/yr
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className={`text-lg font-semibold ${
                  maxWithdrawal.comparison.canAffordCurrentSpending
                    ? "text-green-500"
                    : "text-yellow-500"
                }`}>
                  {maxWithdrawal.comparison.percentDifference > 0 ? "+" : ""}
                  {maxWithdrawal.comparison.percentDifference.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground">buffer</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Success vs Failure Breakdown */}
      <div className="grid grid-cols-2 gap-4">
        {/* Success Scenarios */}
        <Card className="border-green-500/20">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-green-500" />
              <span className="font-medium text-green-500">
                Success Scenarios ({results.success.count.toLocaleString()})
              </span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pessimistic (P10)</span>
                <span>{formatCurrency(results.success.p10EndingBalance)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Median (P50)</span>
                <span className="font-medium">{formatCurrency(results.success.medianEndingBalance)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Optimistic (P90)</span>
                <span>{formatCurrency(results.success.p90EndingBalance)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Failure Scenarios */}
        <Card className={results.failure.count > 0 ? "border-red-500/20" : "border-green-500/20"}>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingDown className={`w-4 h-4 ${results.failure.count > 0 ? "text-red-500" : "text-green-500"}`} />
              <span className={`font-medium ${results.failure.count > 0 ? "text-red-500" : "text-green-500"}`}>
                Failure Scenarios ({results.failure.count.toLocaleString()})
              </span>
            </div>
            {results.failure.count > 0 ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Worst case</span>
                  <span>{results.failure.worstCase} years</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Median duration</span>
                  <span className="font-medium">{Math.round(results.failure.medianYearsLasted)} years</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Average duration</span>
                  <span>{results.failure.averageYearsLasted.toFixed(1)} years</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center py-4 text-green-500">
                <CheckCircle2 className="w-5 h-5 mr-2" />
                <span>No failures in simulation</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
