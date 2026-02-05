"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Card, CardContent } from "@/components/ui/Card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { UnifiedSettingsForm } from "@/components/projections/UnifiedSettingsForm";
import { ResultsComparisonDashboard } from "@/components/projections/ResultsComparisonDashboard";
import { WhatIfCalculator } from "@/components/monteCarlo/WhatIfCalculator";
import { calculateProjection } from "@/lib/calculations/projections";
import { Loader2, Settings, BarChart3, FlaskConical } from "lucide-react";
import { runWhatIfSimulation } from "@/app/actions/monteCarlo";
import {
  fetchSimulationInputs,
  fetchAssumptionsWithDefaults,
  fetchGuardrailsConfig,
} from "@/app/actions/data";

// Type definitions for loaded data
type SimulationInputs = Awaited<ReturnType<typeof fetchSimulationInputs>>;
type Assumptions = Awaited<ReturnType<typeof fetchAssumptionsWithDefaults>>;
type GuardrailsConfig = Awaited<ReturnType<typeof fetchGuardrailsConfig>>;

interface ProjectionInputs {
  profile: {
    currentAge: number;
    annualSpending: number;
  } | null;
  currentNetWorth: number;
}

interface GuardrailsProjection {
  summary: {
    minSpending: number;
    maxSpending: number;
  } | null;
}

export default function ProjectionsPage() {
  const [activeTab, setActiveTab] = useState("results");
  const [settingsKey, setSettingsKey] = useState(0);

  // State for loaded data
  const [simulationInputs, setSimulationInputs] = useState<SimulationInputs | null>(null);
  const [assumptions, setAssumptions] = useState<Assumptions | null>(null);
  const [projectionInputs, setProjectionInputs] = useState<ProjectionInputs | null>(null);
  const [guardrailsConfig, setGuardrailsConfig] = useState<GuardrailsConfig | null>(null);
  const [guardrailsProjection, setGuardrailsProjection] = useState<GuardrailsProjection | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Baseline for What-If (requires a run first)
  const [whatIfBaseline] = useState<{
    successRate: number;
  } | null>(null);

  // Load data on mount and when settingsKey changes
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        // These are synchronous database queries - wrap in Promise.resolve for consistency
        const [inputs, assumptionsData, guardrails] = await Promise.all([
          fetchSimulationInputs(),
          fetchAssumptionsWithDefaults(),
          fetchGuardrailsConfig(),
        ]);

        setSimulationInputs(inputs);
        setAssumptions(assumptionsData);
        setGuardrailsConfig(guardrails);

        // Build projection inputs from simulation inputs
        if (inputs) {
          setProjectionInputs({
            profile: inputs.currentAge !== null ? {
              currentAge: inputs.currentAge,
              annualSpending: inputs.totalAnnualSpending,
            } : null,
            currentNetWorth: inputs.portfolioValue,
          });

          // Calculate guardrails projection if profile and retirement age available
          if (inputs.currentAge !== null && inputs.retirementAge !== null && guardrails?.isEnabled) {
            // For the guardrails projection, we use the standard projection calculation
            // and add the spending range from guardrails config
            const spendingFloor = guardrails.spendingFloor ?? inputs.essentialFloor;
            const spendingCeiling = guardrails.spendingCeiling ?? inputs.totalAnnualSpending * 1.25;

            setGuardrailsProjection({
              summary: {
                minSpending: spendingFloor,
                maxSpending: spendingCeiling,
              },
            });
          } else {
            setGuardrailsProjection(null);
          }
        }
      } catch (error) {
        console.error("Error loading projection data:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [settingsKey]);

  // Calculate standard projection for baseline comparison
  const standardProjection = useMemo(() => {
    if (!projectionInputs?.profile || !simulationInputs?.retirementAge) return null;

    return calculateProjection({
      currentNetWorth: projectionInputs.currentNetWorth,
      annualSpending: projectionInputs.profile.annualSpending,
      currentAge: projectionInputs.profile.currentAge,
      retirementAge: simulationInputs.retirementAge,
    });
  }, [projectionInputs, simulationInputs]);

  // Handle settings changed - force re-render of results
  const handleSettingsChanged = useCallback(() => {
    setSettingsKey((k) => k + 1);
  }, []);

  // Handle What-If simulations
  const handleWhatIf = useCallback(
    async (params: {
      annualSpending?: number;
      retirementAge?: number;
      planToAge?: number;
      ssClaimingAge?: number;
      guardrailsEnabled?: boolean;
    }) => {
      // Build simulation overrides
      const overrides: Parameters<typeof runWhatIfSimulation>[0] = {};

      if (params.annualSpending !== undefined) {
        overrides.annualSpending = params.annualSpending;
      }

      if (params.retirementAge !== undefined && simulationInputs?.planToAge) {
        overrides.years = simulationInputs.planToAge - params.retirementAge;
      }

      if (params.planToAge !== undefined && simulationInputs?.retirementAge) {
        overrides.years = params.planToAge - simulationInputs.retirementAge;
      }

      if (params.guardrailsEnabled !== undefined) {
        if (params.guardrailsEnabled && simulationInputs?.guardrails) {
          overrides.guardrails = {
            enabled: true,
            upperThreshold: simulationInputs.guardrails.upperThreshold,
            lowerThreshold: simulationInputs.guardrails.lowerThreshold,
            increasePercent: simulationInputs.guardrails.increasePercent,
            decreasePercent: simulationInputs.guardrails.decreasePercent,
          };
        } else {
          overrides.guardrails = undefined;
        }
      }

      const result = await runWhatIfSimulation(overrides);

      // Calculate changes from baseline
      const baselineSuccessRate = whatIfBaseline?.successRate ?? 0;
      const changesFromBaseline: string[] = [];

      const successRateDiff = result.successRate - baselineSuccessRate;
      if (Math.abs(successRateDiff) > 0.001) {
        const direction = successRateDiff > 0 ? "increase" : "decrease";
        changesFromBaseline.push(`Success rate ${direction}d by ${Math.abs(successRateDiff * 100).toFixed(1)}%`);
      }

      return {
        successRate: result.successRate,
        changesFromBaseline,
      };
    },
    [simulationInputs, whatIfBaseline]
  );

  // Set baseline when switching to What-If tab
  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };

  const dataIsLoading = isLoading || simulationInputs === null || assumptions === null;

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold">Retirement Projections</h1>
            <p className="text-muted-foreground mt-1">
              Configure your settings, view projections, and explore scenarios
            </p>
          </div>

          {/* Main Tabs */}
          <Tabs defaultValue="results" value={activeTab} onValueChange={handleTabChange}>
            <TabsList className="mb-6">
              <TabsTrigger value="settings">
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </TabsTrigger>
              <TabsTrigger value="results">
                <BarChart3 className="w-4 h-4 mr-2" />
                Results
              </TabsTrigger>
              <TabsTrigger value="whatif">
                <FlaskConical className="w-4 h-4 mr-2" />
                What-If
              </TabsTrigger>
            </TabsList>

            {/* Settings Tab */}
            <TabsContent value="settings" className="mt-0">
              <Card>
                <CardContent className="pt-6">
                  <UnifiedSettingsForm onSettingsChanged={handleSettingsChanged} />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Results Tab */}
            <TabsContent value="results" className="mt-0">
              <ResultsComparisonDashboard key={settingsKey} />
            </TabsContent>

            {/* What-If Tab */}
            <TabsContent value="whatif" className="mt-0">
              {dataIsLoading ? (
                <div className="flex items-center justify-center py-24">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : !simulationInputs.isReady ? (
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center py-12">
                      <p className="text-muted-foreground mb-4">
                        Complete your profile in the Settings tab to use the What-If calculator
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-6">
                  <Card>
                    <CardContent className="pt-6">
                      <h3 className="font-medium mb-2">What-If Calculator</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Explore how changes to your plan affect your success rate.
                        Adjust the sliders to see the impact in real-time.
                      </p>
                    </CardContent>
                  </Card>

                  <WhatIfCalculator
                    baseline={{
                      annualSpending: simulationInputs.annualSpending,
                      retirementAge: simulationInputs.retirementAge ?? 65,
                      planToAge: simulationInputs.planToAge,
                      ssClaimingAge: simulationInputs.socialSecurity?.claimingAge,
                      successRate: whatIfBaseline?.successRate ?? 0,
                      // Additional data for 3-model comparison
                      currentNetWorth: projectionInputs?.currentNetWorth,
                      currentAge: projectionInputs?.profile?.currentAge,
                      standardStatus: standardProjection?.status,
                      guardrailsEnabled: guardrailsConfig?.isEnabled ?? false,
                      guardrailsSpendingRange: guardrailsProjection?.summary
                        ? {
                            min: guardrailsProjection.summary.minSpending,
                            max: guardrailsProjection.summary.maxSpending,
                          }
                        : undefined,
                    }}
                    onRunWhatIf={handleWhatIf}
                    isLoading={false}
                  />

                  {!whatIfBaseline && (
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center py-8 bg-muted/30 rounded-lg">
                          <p className="text-muted-foreground">
                            Run simulations in the Results tab first to see comparisons.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
