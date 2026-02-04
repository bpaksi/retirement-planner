"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { formatCurrency, formatPercent } from "@/lib/utils";
import {
  AlertTriangle,
  TrendingDown,
  Clock,
  DollarSign,
  Briefcase,
  Shield,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

interface FailureAnalysisProps {
  results: {
    successRate: number;
    failure: {
      count: number;
      averageYearsLasted: number;
      medianYearsLasted: number;
      worstCase: number;
    };
  };
  inputs: {
    annualSpending: number;
    retirementAge?: number;
    planToAge?: number;
  };
  improvements?: {
    reducedSpending?: {
      amount: number;
      successRate: number;
    };
    extraYears?: {
      years: number;
      successRate: number;
    };
    withGuardrails?: {
      successRate: number;
    };
  };
}

export function FailureAnalysis({
  results,
  inputs,
  improvements,
}: FailureAnalysisProps) {
  const failureRate = 1 - results.successRate;
  const failurePercent = Math.round(failureRate * 100);

  // If no failures, show success message
  if (results.failure.count === 0) {
    return (
      <Card className="border-green-500/30 bg-green-500/5">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <h3 className="font-semibold text-green-500">No Failures Detected</h3>
              <p className="text-sm text-muted-foreground">
                In all simulated scenarios, your portfolio lasted through your planning horizon.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const retirementAge = inputs.retirementAge ?? 65;
  const ageAtMedianFailure = retirementAge + results.failure.medianYearsLasted;
  const ageAtWorstCase = retirementAge + results.failure.worstCase;

  return (
    <Card className="border-red-500/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-red-500">
          <AlertTriangle className="w-5 h-5" />
          Understanding the {failurePercent}% Failure Scenarios
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* What failure looks like */}
        <div>
          <h4 className="font-medium mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            If your portfolio runs out...
          </h4>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-red-500/5 rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground mb-1">Worst Case</p>
              <p className="text-2xl font-bold text-red-500">
                {results.failure.worstCase} years
              </p>
              <p className="text-xs text-muted-foreground">
                Age {ageAtWorstCase}
              </p>
            </div>
            <div className="bg-red-500/10 rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground mb-1">Typical</p>
              <p className="text-2xl font-bold text-red-500">
                {Math.round(results.failure.medianYearsLasted)} years
              </p>
              <p className="text-xs text-muted-foreground">
                Age {Math.round(ageAtMedianFailure)}
              </p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground mb-1">Failure Rate</p>
              <p className="text-2xl font-bold">
                {failurePercent}%
              </p>
              <p className="text-xs text-muted-foreground">
                {results.failure.count.toLocaleString()} scenarios
              </p>
            </div>
          </div>
        </div>

        {/* What failure means */}
        <div>
          <h4 className="font-medium mb-3 flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-muted-foreground" />
            What this means in practice
          </h4>
          <div className="bg-muted/30 rounded-lg p-4">
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-red-500 mt-0.5">•</span>
                <span>
                  You&apos;d need to significantly reduce spending or find additional income
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-500 mt-0.5">•</span>
                <span>
                  May need to rely on Social Security alone (if not already claiming)
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-500 mt-0.5">•</span>
                <span>
                  Could require downsizing home, family support, or government assistance
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-500 mt-0.5">•</span>
                <span>
                  Maintaining quality of life becomes challenging
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* How to improve */}
        <div>
          <h4 className="font-medium mb-3 flex items-center gap-2">
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
            Ways to improve your odds
          </h4>
          <div className="grid gap-3">
            {/* Reduce spending */}
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <DollarSign className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">Reduce spending by 10%</p>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(inputs.annualSpending * 0.9)}/year
                  </p>
                </div>
              </div>
              {improvements?.reducedSpending ? (
                <div className="text-right">
                  <p className="font-semibold text-green-500">
                    {formatPercent(improvements.reducedSpending.successRate)}
                  </p>
                  <p className="text-xs text-green-500">
                    +{Math.round((improvements.reducedSpending.successRate - results.successRate) * 100)}%
                  </p>
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">Run what-if →</span>
              )}
            </div>

            {/* Work longer */}
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Briefcase className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">Work 2 more years</p>
                  <p className="text-xs text-muted-foreground">
                    Retire at age {retirementAge + 2}
                  </p>
                </div>
              </div>
              {improvements?.extraYears ? (
                <div className="text-right">
                  <p className="font-semibold text-green-500">
                    {formatPercent(improvements.extraYears.successRate)}
                  </p>
                  <p className="text-xs text-green-500">
                    +{Math.round((improvements.extraYears.successRate - results.successRate) * 100)}%
                  </p>
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">Run what-if →</span>
              )}
            </div>

            {/* Enable guardrails */}
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Shield className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">Enable guardrails strategy</p>
                  <p className="text-xs text-muted-foreground">
                    Adjust spending based on portfolio
                  </p>
                </div>
              </div>
              {improvements?.withGuardrails ? (
                <div className="text-right">
                  <p className="font-semibold text-green-500">
                    {formatPercent(improvements.withGuardrails.successRate)}
                  </p>
                  <p className="text-xs text-green-500">
                    +{Math.round((improvements.withGuardrails.successRate - results.successRate) * 100)}%
                  </p>
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">Run what-if →</span>
              )}
            </div>
          </div>
        </div>

        {/* Important note */}
        <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">
          <strong>Note:</strong> These are probability-based projections, not predictions.
          A {failurePercent}% failure rate means that in {results.failure.count} out of{" "}
          {Math.round(results.failure.count / failureRate)} simulated scenarios, your
          portfolio would run out before age {inputs.planToAge ?? 95}. Market conditions,
          spending changes, and other factors will affect your actual outcomes.
        </div>
      </CardContent>
    </Card>
  );
}
