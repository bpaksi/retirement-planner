"use client";

import { useState, useCallback, useMemo } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ProjectionChart } from "@/components/projections/ProjectionChart";
import { GuardrailsChart } from "@/components/projections/GuardrailsChart";
import { MonteCarloChart, MonteCarloChartLegend } from "@/components/monteCarlo/MonteCarloChart";
import { MonteCarloSummary } from "@/components/monteCarlo/MonteCarloSummary";
import { FailureAnalysis } from "@/components/monteCarlo/FailureAnalysis";
import { DataQualityCheck } from "@/components/monteCarlo/DataQualityCheck";
import {
  ModelComparisonCard,
  getStatusFromSuccessRate,
  getStatusFromReadiness,
} from "@/components/projections/ModelComparisonCard";
import {
  calculateProjection,
  calculateRetirementAge,
  PROJECTION_DEFAULTS,
} from "@/lib/calculations/projections";
import { formatCurrency, formatPercent, cn } from "@/lib/utils";
import {
  Loader2,
  Play,
  RefreshCw,
  Database,
  Shield,
  Wallet,
  CheckCircle2,
} from "lucide-react";

export function ResultsComparisonDashboard() {
  const [isRunning, setIsRunning] = useState(false);
  const [runningStatus, setRunningStatus] = useState<string>("");
  const [simulationResult, setSimulationResult] = useState<Awaited<
    ReturnType<typeof runSimulation>
  > | null>(null);
  const [maxWithdrawalResult, setMaxWithdrawalResult] = useState<Awaited<
    ReturnType<typeof findMaxWithdrawal>
  > | null>(null);

  // Queries
  const projectionInputs = useQuery(api.projections.queries.getProjectionInputs);
  const guardrailsConfig = useQuery(api.guardrails.queries.getWithDefaults);
  const monteCarloAssumptions = useQuery(api.monteCarlo.queries.getAssumptionsWithDefaults);
  const simulationInputs = useQuery(api.monteCarlo.queries.getSimulationInputs);
  const spendingBreakdown = useQuery(api.projections.queries.getSpendingBreakdown);

  // Calculate retirement age
  const retirementAge = useMemo(() => {
    if (!projectionInputs?.profile) return null;
    return calculateRetirementAge(
      projectionInputs.profile.retirementDate,
      projectionInputs.profile.currentAge
    );
  }, [projectionInputs?.profile]);

  // Guardrails projection query
  const guardrailsProjection = useQuery(
    api.projections.queries.calculateProjectionWithGuardrails,
    projectionInputs?.profile && retirementAge
      ? {
          currentNetWorth: projectionInputs.currentNetWorth,
          annualSpending: projectionInputs.profile.annualSpending,
          currentAge: projectionInputs.profile.currentAge,
          retirementAge: retirementAge,
        }
      : "skip"
  );

  // Actions
  const runSimulation = useAction(api.monteCarlo.actions.runSimulation);
  const findMaxWithdrawal = useAction(api.monteCarlo.actions.findMaxSustainableWithdrawal);

  // Calculate standard projection
  const standardProjection = useMemo(() => {
    if (!projectionInputs?.profile || !retirementAge) return null;

    return calculateProjection({
      currentNetWorth: projectionInputs.currentNetWorth,
      annualSpending: projectionInputs.profile.annualSpending,
      currentAge: projectionInputs.profile.currentAge,
      retirementAge,
    });
  }, [projectionInputs, retirementAge]);

  // Run all simulations
  const handleRunAllSimulations = useCallback(async (skipCache = false) => {
    setIsRunning(true);
    setRunningStatus("Running Monte Carlo simulation...");

    try {
      // Run Monte Carlo simulation
      const simResult = await runSimulation({ iterations: 1000, skipCache });
      setSimulationResult(simResult);

      // Find max withdrawal
      setRunningStatus("Calculating sustainable withdrawal...");
      const maxResult = await findMaxWithdrawal({ skipCache });
      setMaxWithdrawalResult(maxResult);
    } catch (err) {
      console.error("Simulation failed:", err);
    } finally {
      setIsRunning(false);
      setRunningStatus("");
    }
  }, [runSimulation, findMaxWithdrawal]);

  // Format cache time
  const formatCacheTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);

    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return "over a day ago";
  };

  // Loading state
  if (
    projectionInputs === undefined ||
    guardrailsConfig === undefined ||
    monteCarloAssumptions === undefined ||
    simulationInputs === undefined ||
    spendingBreakdown === undefined
  ) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Check if profile is set up
  if (!projectionInputs.profile || !retirementAge || !standardProjection) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">
              Complete your profile in the Settings tab to see projections
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const profile = projectionInputs.profile;
  const samplePaths = simulationResult?.samplePaths || [];
  const successCount = samplePaths.filter(
    (p) => p.length > 0 && p[p.length - 1]?.endBalance > 0
  ).length;
  const failureCount = samplePaths.length - successCount;

  return (
    <div className="space-y-6">
      {/* Data Quality Check */}
      <DataQualityCheck />

      {/* Financial Snapshot */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="font-medium mb-4">Current Financial Snapshot</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Net Worth</p>
              <p className="text-lg font-semibold">
                {formatCurrency(projectionInputs.currentNetWorth)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Investments</p>
              <p className="text-lg font-semibold">
                {formatCurrency(projectionInputs.investments)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Cash</p>
              <p className="text-lg font-semibold">
                {formatCurrency(projectionInputs.cash)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Assets</p>
              <p className="text-lg font-semibold">
                {formatCurrency(projectionInputs.assets)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Liabilities</p>
              <p className="text-lg font-semibold text-red-500">
                -{formatCurrency(projectionInputs.liabilities)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Spending Breakdown Card (NEW) */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium flex items-center gap-2">
              <Wallet className="w-5 h-5 text-emerald-500" />
              Spending Plan
            </h3>
            {guardrailsConfig.isEnabled && (
              <span className="text-xs bg-emerald-500/10 text-emerald-500 px-2 py-1 rounded-full flex items-center gap-1">
                <Shield className="w-3 h-3" />
                Guardrails Active
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Base Living</p>
              <p className="text-lg font-semibold">
                {formatCurrency(spendingBreakdown.baseLivingExpense)}/yr
              </p>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(spendingBreakdown.monthlyBaseLivingExpense)}/month
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Goals</p>
              <p className="text-lg font-semibold">
                +{formatCurrency(spendingBreakdown.totalGoalsAmount)}/yr
              </p>
              <p className="text-xs text-muted-foreground">
                {spendingBreakdown.goals.length} goal{spendingBreakdown.goals.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Spending</p>
              <p className="text-lg font-bold text-emerald-500">
                {formatCurrency(spendingBreakdown.totalAnnualSpending)}/yr
              </p>
              <p className="text-xs text-muted-foreground">
                {formatPercent(spendingBreakdown.totalAnnualSpending / simulationInputs.portfolioValue, 1)} withdrawal rate
              </p>
            </div>
            <div className={cn(
              "rounded-lg p-3",
              guardrailsConfig.isEnabled ? "bg-emerald-500/10" : "bg-muted/30"
            )}>
              <p className="text-sm text-muted-foreground">Essential Floor</p>
              <p className="text-lg font-semibold">
                {formatCurrency(spendingBreakdown.essentialFloor)}/yr
              </p>
              <p className="text-xs text-muted-foreground">
                Guardrails protect this
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Run Button */}
      <div className="flex items-center justify-center gap-4 py-4">
        <Button
          onClick={() => handleRunAllSimulations()}
          disabled={isRunning}
          size="lg"
        >
          {isRunning ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {runningStatus || "Running..."}
            </>
          ) : (
            <>
              <Play className="w-4 h-4 mr-2" />
              Run All Simulations
            </>
          )}
        </Button>
        {simulationResult && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {simulationResult.fromCache && simulationResult.cachedAt ? (
              <>
                <Database className="w-4 h-4" />
                <span>Last run: {formatCacheTime(simulationResult.cachedAt)}</span>
              </>
            ) : (
              <span>
                {simulationResult.iterations.toLocaleString()} simulations
              </span>
            )}
            {simulationResult.fromCache && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRunAllSimulations(true)}
                disabled={isRunning}
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Model Comparison Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Standard Projection Card */}
        <ModelComparisonCard
          type="standard"
          status={getStatusFromReadiness(standardProjection.status)}
          title="Standard Projection"
          subtitle="Deterministic (3 scenarios)"
          primaryMetric={{
            label: "Status",
            value: standardProjection.status === "on_track"
              ? "On Track"
              : standardProjection.status === "at_risk"
              ? "At Risk"
              : "Behind",
          }}
          secondaryMetrics={[
            {
              label: "Funds to",
              value: standardProjection.expectedRunsOutAge
                ? `Age ${standardProjection.expectedRunsOutAge}`
                : `${PROJECTION_DEFAULTS.lifeExpectancy}+`,
            },
            {
              label: "At retirement",
              value: formatCurrency(standardProjection.projectedNetWorthAtRetirement),
            },
          ]}
        />

        {/* Monte Carlo Card (with integrated guardrails) */}
        <ModelComparisonCard
          type="montecarlo"
          status={
            simulationResult
              ? getStatusFromSuccessRate(simulationResult.successRate)
              : "neutral"
          }
          title="Monte Carlo"
          subtitle={
            simulationResult
              ? guardrailsConfig.isEnabled
                ? `${simulationResult.iterations.toLocaleString()} scenarios with guardrails`
                : `${simulationResult.iterations.toLocaleString()} scenarios`
              : "Probabilistic simulation"
          }
          primaryMetric={{
            label: "Success Rate",
            value: simulationResult
              ? formatPercent(simulationResult.successRate)
              : "—",
          }}
          secondaryMetrics={
            simulationResult && maxWithdrawalResult
              ? [
                  {
                    label: "Max withdrawal",
                    value: `${formatPercent(maxWithdrawalResult.withdrawalRate)} (${formatCurrency(maxWithdrawalResult.maxWithdrawal)}/yr)`,
                  },
                  {
                    label: "Target",
                    value: simulationResult.successRate >= (monteCarloAssumptions.targetSuccessRate ?? 0.9)
                      ? `✓ Meets ${formatPercent(monteCarloAssumptions.targetSuccessRate ?? 0.9, 0)}`
                      : `Below ${formatPercent(monteCarloAssumptions.targetSuccessRate ?? 0.9, 0)}`,
                  },
                ]
              : undefined
          }
          isEnabled={!!simulationResult}
        />
      </div>

      {/* Guardrails Info Banner (if enabled) */}
      {guardrailsConfig.isEnabled && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="bg-emerald-500/20 p-2 rounded-lg">
              <Shield className="w-5 h-5 text-emerald-500" />
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-emerald-500 flex items-center gap-2">
                Guardrails Integrated into Monte Carlo
                <CheckCircle2 className="w-4 h-4" />
              </h4>
              <p className="text-sm text-muted-foreground mt-1">
                Each simulation path dynamically adjusts spending based on portfolio performance.
                When portfolio exceeds +{Math.round(guardrailsConfig.upperThresholdPercent * 100)}%, spending increases.
                When it falls -{Math.round(guardrailsConfig.lowerThresholdPercent * 100)}%, spending decreases (but never below the essential floor of {formatCurrency(spendingBreakdown.essentialFloor)}/yr).
              </p>
              {simulationResult && (
                <div className="flex gap-4 mt-2 text-sm">
                  <span className="text-muted-foreground">
                    Ceiling triggers: {Math.round(simulationResult.risk.guardrailTriggerStats.ceilingTriggerPercent * 100)}% of years
                  </span>
                  <span className="text-muted-foreground">
                    Floor triggers: {Math.round(simulationResult.risk.guardrailTriggerStats.floorTriggerPercent * 100)}% of years
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Standard Projection Chart */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="font-medium mb-4">Standard Projection</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Three scenarios based on expected (5%), optimistic (7%), and pessimistic (3%) real returns.
          </p>
          <ProjectionChart
            data={standardProjection.years}
            retirementAge={retirementAge}
            currentAge={profile.currentAge}
            height={350}
          />
        </CardContent>
      </Card>

      {/* Guardrails Deterministic Preview (if enabled) */}
      {guardrailsConfig.isEnabled && guardrailsProjection?.isEnabled && guardrailsProjection.summary && (
        <Card>
          <CardContent className="pt-6">
            <h3 className="font-medium mb-2 flex items-center gap-2">
              Guardrails Preview
              <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">
                Deterministic
              </span>
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Expected spending adjustments with average returns. Monte Carlo above shows probabilistic outcomes across many market scenarios.
            </p>
            <GuardrailsChart
              years={guardrailsProjection.years}
              summary={guardrailsProjection.summary}
              retirementAge={retirementAge}
              currentAge={profile.currentAge}
              lifeExpectancy={PROJECTION_DEFAULTS.lifeExpectancy}
            />
          </CardContent>
        </Card>
      )}

      {/* Monte Carlo Results */}
      {simulationResult && simulationInputs.isReady && (
        <div className="space-y-6">
          <h3 className="font-medium">Monte Carlo Simulation</h3>

          {/* Summary */}
          <MonteCarloSummary
            results={simulationResult}
            inputs={{
              portfolioValue: simulationInputs.portfolioValue,
              annualSpending: simulationInputs.totalAnnualSpending,
              baseLivingExpense: simulationInputs.baseLivingExpense,
              totalGoalsAmount: simulationInputs.totalGoalsAmount,
              essentialFloor: simulationInputs.essentialFloor,
              years: simulationInputs.planToAge - (simulationInputs.retirementAge ?? 65),
              retirementAge: simulationInputs.retirementAge ?? undefined,
              planToAge: simulationInputs.planToAge,
              hasGuardrails: !!simulationInputs.guardrails,
            }}
            maxWithdrawal={
              maxWithdrawalResult
                ? {
                    maxWithdrawal: maxWithdrawalResult.maxWithdrawal,
                    withdrawalRate: maxWithdrawalResult.withdrawalRate,
                    comparison: maxWithdrawalResult.comparison as {
                      currentSpending: number;
                      difference: number;
                      percentDifference: number;
                      canAffordCurrentSpending: boolean;
                    } | undefined,
                  }
                : undefined
            }
            targetSuccessRate={monteCarloAssumptions.targetSuccessRate}
          />

          {/* Chart */}
          <Card>
            <CardContent className="pt-6">
              <h4 className="font-medium mb-4">Sample Portfolio Paths</h4>
              {simulationResult.fromCache && samplePaths.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center bg-muted/30 rounded-lg">
                  <Database className="w-8 h-8 text-muted-foreground mb-3" />
                  <p className="text-muted-foreground mb-2">
                    Chart data not available from cache
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRunAllSimulations(true)}
                    disabled={isRunning}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Run Fresh Simulation
                  </Button>
                </div>
              ) : (
                <>
                  <MonteCarloChart
                    samplePaths={samplePaths}
                    retirementAge={simulationInputs.retirementAge ?? undefined}
                    planToAge={simulationInputs.planToAge}
                    height={350}
                  />
                  <MonteCarloChartLegend
                    successCount={successCount}
                    failureCount={failureCount}
                  />
                </>
              )}
            </CardContent>
          </Card>

          {/* Failure Analysis */}
          {simulationResult.failure.count > 0 && (
            <FailureAnalysis
              results={simulationResult}
              inputs={{
                annualSpending: simulationInputs.annualSpending,
                retirementAge: simulationInputs.retirementAge ?? undefined,
                planToAge: simulationInputs.planToAge,
              }}
            />
          )}
        </div>
      )}

      {/* Monte Carlo not run message */}
      {!simulationResult && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12 bg-muted/30 rounded-lg">
              <Play className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-medium mb-2">Monte Carlo Simulation</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
                Run simulations to see thousands of possible market scenarios
                and the probability of your retirement plan succeeding.
              </p>
              <Button onClick={() => handleRunAllSimulations()} disabled={isRunning}>
                {isRunning ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Run Simulation
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
