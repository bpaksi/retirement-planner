"use client";

import { useState, useCallback } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { MonteCarloSummary } from "./MonteCarloSummary";
import { MonteCarloChart, MonteCarloChartLegend } from "./MonteCarloChart";
import { FailureAnalysis } from "./FailureAnalysis";
import { WhatIfCalculator } from "./WhatIfCalculator";
import { DataQualityCheck } from "./DataQualityCheck";
import {
  Loader2,
  Play,
  RefreshCw,
  AlertTriangle,
  Settings2,
  ChevronDown,
  ChevronUp,
  Database,
} from "lucide-react";

export function MonteCarloTab() {
  const [isRunning, setIsRunning] = useState(false);
  const [runningStatus, setRunningStatus] = useState<string>("");
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [simulationResult, setSimulationResult] = useState<Awaited<
    ReturnType<typeof runSimulation>
  > | null>(null);
  const [maxWithdrawalResult, setMaxWithdrawalResult] = useState<Awaited<
    ReturnType<typeof findMaxWithdrawal>
  > | null>(null);

  // Queries
  const simulationInputs = useQuery(api.monteCarlo.queries.getSimulationInputs);
  const assumptions = useQuery(api.monteCarlo.queries.getAssumptionsWithDefaults);

  // Actions
  const runSimulation = useAction(api.monteCarlo.actions.runSimulation);
  const findMaxWithdrawal = useAction(api.monteCarlo.actions.findMaxSustainableWithdrawal);
  const runWhatIf = useAction(api.monteCarlo.actions.runWhatIfSimulation);

  const handleRunSimulation = useCallback(async (skipCache = false) => {
    setIsRunning(true);
    setError(null);
    setRunningStatus("Running simulation...");

    try {
      // Run simulation first
      const simResult = await runSimulation({ iterations: 1000, skipCache });
      setSimulationResult(simResult);

      // Then find max withdrawal
      setRunningStatus("Calculating sustainable withdrawal...");
      const maxResult = await findMaxWithdrawal({ skipCache });
      setMaxWithdrawalResult(maxResult);
    } catch (err) {
      console.error("Simulation failed:", err);
      const message = err instanceof Error ? err.message : "Simulation failed";
      setError(message);
    } finally {
      setIsRunning(false);
      setRunningStatus("");
    }
  }, [runSimulation, findMaxWithdrawal]);

  // Helper to format cache time
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

  const handleWhatIf = useCallback(
    async (params: {
      annualSpending?: number;
      retirementAge?: number;
      planToAge?: number;
      ssClaimingAge?: number;
      guardrailsEnabled?: boolean;
    }) => {
      const result = await runWhatIf(params);
      return {
        successRate: result.successRate,
        changesFromBaseline: result.changesFromBaseline,
      };
    },
    [runWhatIf]
  );

  // Loading state
  if (simulationInputs === undefined || assumptions === undefined) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Not ready state - missing required inputs
  if (!simulationInputs.isReady) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertTriangle className="w-12 h-12 text-yellow-500 mb-4" />
            <h3 className="font-semibold text-lg mb-2">
              Missing Required Information
            </h3>
            <p className="text-muted-foreground mb-4 max-w-md">
              To run Monte Carlo simulations, we need the following:
            </p>
            <ul className="text-sm text-muted-foreground space-y-1 mb-6">
              {simulationInputs.missingInputs.map((input, idx) => (
                <li key={idx} className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                  {input}
                </li>
              ))}
            </ul>
            <a
              href="/settings"
              className="inline-flex items-center justify-center rounded-lg text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
            >
              Complete Setup
            </a>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Initial state - not run yet
  if (!simulationResult) {
    return (
      <div className="space-y-4">
        {/* Data Quality Warnings */}
        <DataQualityCheck />

        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Play className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">
                Monte Carlo Simulation
              </h3>
              <p className="text-muted-foreground mb-2 max-w-md">
                Run thousands of market scenarios to see the probability of your
                retirement plan succeeding.
              </p>
              <div className="text-sm text-muted-foreground mb-6 space-y-1">
                <p>Portfolio: ${Math.round(simulationInputs.portfolioValue).toLocaleString()}</p>
                <p>Spending: ${Math.round(simulationInputs.annualSpending).toLocaleString()}/year</p>
                <p>
                  Horizon: {simulationInputs.planToAge - (simulationInputs.retirementAge ?? 65)} years
                  (age {simulationInputs.retirementAge} to {simulationInputs.planToAge})
                </p>
              </div>
              <Button onClick={() => handleRunSimulation()} disabled={isRunning} size="lg">
                {isRunning ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {runningStatus || "Running..."}
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Run Simulation
                  </>
                )}
              </Button>
              {error && (
                <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-500">
                  {error}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Results view
  const samplePaths = simulationResult.samplePaths || [];
  const successCount = samplePaths.filter(
    (p) => p.length > 0 && p[p.length - 1]?.endBalance > 0
  ).length;
  const failureCount = samplePaths.length - successCount;

  return (
    <div className="space-y-6">
      {/* Error banner */}
      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-500">Simulation Error</p>
            <p className="text-sm text-muted-foreground mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Running status banner */}
      {isRunning && runningStatus && (
        <div className="p-4 rounded-lg bg-primary/10 border border-primary/30 flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-primary animate-spin flex-shrink-0" />
          <div>
            <p className="font-medium text-primary">{runningStatus}</p>
            <p className="text-sm text-muted-foreground">This may take a few seconds...</p>
          </div>
        </div>
      )}

      {/* Re-run button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {simulationResult.fromCache && simulationResult.cachedAt ? (
            <>
              <Database className="w-4 h-4" />
              <span>
                Cached results ({formatCacheTime(simulationResult.cachedAt)})
              </span>
            </>
          ) : (
            <span>{simulationResult.iterations.toLocaleString()} simulations</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {simulationResult.fromCache && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleRunSimulation(true)}
              disabled={isRunning}
              title="Run fresh simulation"
            >
              {isRunning ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
            </Button>
          )}
          {!simulationResult.fromCache && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleRunSimulation(true)}
              disabled={isRunning}
            >
              {isRunning ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Re-run
            </Button>
          )}
        </div>
      </div>

      {/* Data Quality Warnings */}
      <DataQualityCheck />

      {/* Summary */}
      <MonteCarloSummary
        results={simulationResult}
        inputs={{
          portfolioValue: simulationInputs.portfolioValue,
          annualSpending: simulationInputs.annualSpending,
          years: simulationInputs.planToAge - (simulationInputs.retirementAge ?? 65),
          retirementAge: simulationInputs.retirementAge ?? undefined,
          planToAge: simulationInputs.planToAge,
        }}
        maxWithdrawal={maxWithdrawalResult ? {
          maxWithdrawal: maxWithdrawalResult.maxWithdrawal,
          withdrawalRate: maxWithdrawalResult.withdrawalRate,
          comparison: maxWithdrawalResult.comparison as {
            currentSpending: number;
            difference: number;
            percentDifference: number;
            canAffordCurrentSpending: boolean;
          } | undefined,
        } : undefined}
        targetSuccessRate={assumptions.targetSuccessRate}
      />

      {/* Chart */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="font-medium mb-4">Sample Portfolio Paths</h3>
          {simulationResult.fromCache && samplePaths.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center bg-muted/30 rounded-lg">
              <Database className="w-8 h-8 text-muted-foreground mb-3" />
              <p className="text-muted-foreground mb-2">
                Chart data not available from cache
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRunSimulation(true)}
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

      {/* What-If Calculator */}
      <WhatIfCalculator
        baseline={{
          annualSpending: simulationInputs.annualSpending,
          retirementAge: simulationInputs.retirementAge ?? 65,
          planToAge: simulationInputs.planToAge,
          ssClaimingAge: simulationInputs.socialSecurity?.claimingAge,
          successRate: simulationResult.successRate,
        }}
        onRunWhatIf={handleWhatIf}
        isLoading={isRunning}
      />

      {/* Assumptions (collapsible) */}
      <Card>
        <CardContent className="pt-6">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center justify-between w-full text-left"
          >
            <div className="flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-muted-foreground" />
              <h3 className="font-medium">Simulation Assumptions</h3>
            </div>
            {showSettings ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </button>

          {showSettings && (
            <div className="mt-4 pt-4 border-t border-border">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Real Return</p>
                  <p className="font-medium">
                    {(assumptions.realReturn * 100).toFixed(1)}%
                  </p>
                  <p className="text-xs text-muted-foreground">after inflation</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Volatility</p>
                  <p className="font-medium">
                    {(assumptions.volatility * 100).toFixed(1)}%
                  </p>
                  <p className="text-xs text-muted-foreground">std deviation</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Target Success</p>
                  <p className="font-medium">
                    {(assumptions.targetSuccessRate * 100).toFixed(0)}%
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Iterations</p>
                  <p className="font-medium">
                    {(assumptions.iterations ?? 1000).toLocaleString()}
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                These assumptions use real (inflation-adjusted) returns. A 5% real
                return with 12% volatility represents a conservative balanced portfolio.
                Spending is assumed constant in today&apos;s dollars.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
