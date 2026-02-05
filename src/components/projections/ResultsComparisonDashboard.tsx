"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ProjectionChart } from "@/components/projections/ProjectionChart";
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

// Import server actions
import {
  fetchSimulationInputs,
  fetchAssumptionsWithDefaults,
  fetchGuardrailsConfig,
  fetchRetirementProfile,
  fetchAnnualBudgets,
  fetchNetWorthData,
} from "@/app/actions/data";

// Import actions
import { runSimulation, findMaxSafeWithdrawal } from "@/app/actions/monteCarlo";

// Import types
import type { AggregatedResults, MaxWithdrawalResult } from "@/lib/calculations/monteCarlo";

// Default guardrails values
const GUARDRAILS_DEFAULTS = {
  isEnabled: false,
  upperThresholdPercent: 0.2,
  lowerThresholdPercent: 0.2,
  spendingAdjustmentPercent: 0.1,
  strategyType: "percentage" as const,
};

// Type for guardrails config with defaults
interface GuardrailsConfigWithDefaults {
  isEnabled: boolean;
  upperThresholdPercent: number;
  lowerThresholdPercent: number;
  spendingAdjustmentPercent: number;
  strategyType: "percentage" | "fixed";
  spendingFloor?: number | null;
  spendingCeiling?: number | null;
  fixedAdjustmentAmount?: number | null;
}

// Type for spending breakdown
interface SpendingBreakdown {
  baseLivingExpense: number;
  monthlyBaseLivingExpense: number;
  totalGoalsAmount: number;
  essentialFloor: number;
  discretionaryAmount: number;
  totalAnnualSpending: number;
  goals: Array<{
    id: string;
    name: string;
    annualAmount: number;
    isEssential: boolean;
  }>;
}

// Type for projection inputs
interface ProjectionInputs {
  profile: Awaited<ReturnType<typeof fetchRetirementProfile>>;
  currentNetWorth: number;
  portfolioValue: number;
  investments: number;
  cash: number;
  assets: number;
  liabilities: number;
}

// Type for simulation inputs
type SimulationInputsType = Awaited<ReturnType<typeof fetchSimulationInputs>>;
type MonteCarloAssumptionsType = Awaited<ReturnType<typeof fetchAssumptionsWithDefaults>>;

// Extended simulation result type with cache info
// Note: The action returns cachedAt when results are from cache
interface SimulationResultWithCache extends AggregatedResults {
  cachedAt?: number;
}

// Extended max withdrawal result
interface MaxWithdrawalResultExtended extends MaxWithdrawalResult {
  comparison?: {
    currentSpending: number;
    difference: number;
    percentDifference: number;
    canAffordCurrentSpending: boolean;
  };
}

export function ResultsComparisonDashboard() {
  const [isRunning, setIsRunning] = useState(false);
  const [runningStatus, setRunningStatus] = useState<string>("");
  const [simulationResult, setSimulationResult] = useState<SimulationResultWithCache | null>(null);
  const [maxWithdrawalResult, setMaxWithdrawalResult] = useState<MaxWithdrawalResultExtended | null>(null);

  // Data loading state
  const [isLoading, setIsLoading] = useState(true);
  const [projectionInputs, setProjectionInputs] = useState<ProjectionInputs | null>(null);
  const [guardrailsConfig, setGuardrailsConfig] = useState<GuardrailsConfigWithDefaults | null>(null);
  const [monteCarloAssumptions, setMonteCarloAssumptions] = useState<MonteCarloAssumptionsType | null>(null);
  const [simulationInputs, setSimulationInputs] = useState<SimulationInputsType | null>(null);
  const [spendingBreakdown, setSpendingBreakdown] = useState<SpendingBreakdown | null>(null);

  // Load all data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [profile, guardrails, assumptions, simInputs, budgets, netWorthData] = await Promise.all([
        fetchRetirementProfile(),
        fetchGuardrailsConfig(),
        fetchAssumptionsWithDefaults(),
        fetchSimulationInputs(),
        fetchAnnualBudgets(),
        fetchNetWorthData(),
      ]);

      setProjectionInputs({
        profile,
        currentNetWorth: netWorthData.netWorth,
        portfolioValue: netWorthData.portfolioValue,
        investments: netWorthData.investments,
        cash: netWorthData.cash,
        assets: netWorthData.assets,
        liabilities: netWorthData.liabilities,
      });

      // Set guardrails config with defaults
      const guardrailsWithDefaults: GuardrailsConfigWithDefaults = guardrails
        ? {
            isEnabled: guardrails.isEnabled,
            upperThresholdPercent: guardrails.upperThresholdPercent,
            lowerThresholdPercent: guardrails.lowerThresholdPercent,
            spendingAdjustmentPercent: guardrails.spendingAdjustmentPercent,
            strategyType: guardrails.strategyType,
            spendingFloor: guardrails.spendingFloor,
            spendingCeiling: guardrails.spendingCeiling,
            fixedAdjustmentAmount: guardrails.fixedAdjustmentAmount,
          }
        : GUARDRAILS_DEFAULTS;

      setGuardrailsConfig(guardrailsWithDefaults);
      setMonteCarloAssumptions(assumptions);
      setSimulationInputs(simInputs);

      // Calculate spending breakdown
      const baseLivingExpense = profile?.monthlyBaseLivingExpense
        ? profile.monthlyBaseLivingExpense * 12
        : profile?.annualSpending ?? 0;
      const monthlyBase = profile?.monthlyBaseLivingExpense ?? baseLivingExpense / 12;

      const totalGoalsAmount = budgets.reduce((sum, b) => sum + b.annualAmount, 0);
      const essentialGoalsAmount = budgets
        .filter((b) => b.isEssential)
        .reduce((sum, b) => sum + b.annualAmount, 0);

      setSpendingBreakdown({
        baseLivingExpense,
        monthlyBaseLivingExpense: monthlyBase,
        totalGoalsAmount,
        essentialFloor: baseLivingExpense + essentialGoalsAmount,
        discretionaryAmount: totalGoalsAmount - essentialGoalsAmount,
        totalAnnualSpending: baseLivingExpense + totalGoalsAmount,
        goals: budgets.map((b) => ({
          id: b.id,
          name: b.name,
          annualAmount: b.annualAmount,
          isEssential: b.isEssential ?? false,
        })),
      });
    } catch (error) {
      console.error("Failed to load dashboard data:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Calculate retirement age
  const retirementAge = useMemo(() => {
    if (!projectionInputs?.profile) return null;
    return calculateRetirementAge(
      projectionInputs.profile.retirementDate,
      projectionInputs.profile.currentAge
    );
  }, [projectionInputs?.profile]);

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
  const handleRunAllSimulations = useCallback(async () => {
    setIsRunning(true);
    setRunningStatus("Running Monte Carlo simulation...");

    try {
      // Run Monte Carlo simulation
      const simResult = await runSimulation();
      setSimulationResult(simResult as SimulationResultWithCache);

      // Find max withdrawal
      setRunningStatus("Calculating sustainable withdrawal...");
      const maxResult = await findMaxSafeWithdrawal(monteCarloAssumptions?.targetSuccessRate ?? 0.9);

      // Calculate comparison
      const currentSpending = simulationInputs?.totalAnnualSpending ?? 0;
      const maxResultWithComparison: MaxWithdrawalResultExtended = {
        ...maxResult,
        comparison: {
          currentSpending,
          difference: maxResult.maxWithdrawal - currentSpending,
          percentDifference: currentSpending > 0
            ? (maxResult.maxWithdrawal - currentSpending) / currentSpending
            : 0,
          canAffordCurrentSpending: maxResult.maxWithdrawal >= currentSpending,
        },
      };
      setMaxWithdrawalResult(maxResultWithComparison);
    } catch (err) {
      console.error("Simulation failed:", err);
    } finally {
      setIsRunning(false);
      setRunningStatus("");
    }
  }, [monteCarloAssumptions?.targetSuccessRate, simulationInputs?.totalAnnualSpending]);

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
    isLoading ||
    projectionInputs === null ||
    guardrailsConfig === null ||
    monteCarloAssumptions === null ||
    simulationInputs === null ||
    spendingBreakdown === null
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

      {/* Spending Breakdown Card */}
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
            {simulationResult.cachedAt ? (
              <>
                <Database className="w-4 h-4" />
                <span>Last run: {formatCacheTime(simulationResult.cachedAt)}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRunAllSimulations()}
                  disabled={isRunning}
                >
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </>
            ) : (
              <span>
                {simulationResult.iterations.toLocaleString()} simulations
              </span>
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
              : "--",
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
                      ? `Meets ${formatPercent(monteCarloAssumptions.targetSuccessRate ?? 0.9, 0)}`
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
              {simulationResult && simulationResult.risk && 'guardrailTriggerStats' in simulationResult.risk && (
                <div className="flex gap-4 mt-2 text-sm">
                  <span className="text-muted-foreground">
                    Ceiling triggers: {Math.round((simulationResult.risk as { guardrailTriggerStats: { ceilingTriggerPercent: number } }).guardrailTriggerStats.ceilingTriggerPercent * 100)}% of years
                  </span>
                  <span className="text-muted-foreground">
                    Floor triggers: {Math.round((simulationResult.risk as { guardrailTriggerStats: { floorTriggerPercent: number } }).guardrailTriggerStats.floorTriggerPercent * 100)}% of years
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
                    comparison: maxWithdrawalResult.comparison,
                  }
                : undefined
            }
            targetSuccessRate={monteCarloAssumptions.targetSuccessRate}
          />

          {/* Chart */}
          <Card>
            <CardContent className="pt-6">
              <h4 className="font-medium mb-4">Sample Portfolio Paths</h4>
              {simulationResult.cachedAt && samplePaths.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center bg-muted/30 rounded-lg">
                  <Database className="w-8 h-8 text-muted-foreground mb-3" />
                  <p className="text-muted-foreground mb-2">
                    Chart data not available from cache
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRunAllSimulations()}
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
