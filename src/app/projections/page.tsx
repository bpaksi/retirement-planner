"use client";

import { useState, useCallback, useMemo } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Sidebar } from "@/components/layout/Sidebar";
import { Card, CardContent } from "@/components/ui/Card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { UnifiedSettingsForm } from "@/components/projections/UnifiedSettingsForm";
import { ResultsComparisonDashboard } from "@/components/projections/ResultsComparisonDashboard";
import { WhatIfCalculator } from "@/components/monteCarlo/WhatIfCalculator";
import { calculateProjection } from "@/lib/calculations/projections";
import { Loader2, Settings, BarChart3, FlaskConical } from "lucide-react";

export default function ProjectionsPage() {
  const [activeTab, setActiveTab] = useState("results");
  const [settingsKey, setSettingsKey] = useState(0);

  // Queries for What-If tab
  const simulationInputs = useQuery(api.monteCarlo.queries.getSimulationInputs);
  const assumptions = useQuery(api.monteCarlo.queries.getAssumptionsWithDefaults);
  const projectionInputs = useQuery(api.projections.queries.getProjectionInputs);
  const guardrailsConfig = useQuery(api.guardrails.queries.getWithDefaults);
  const guardrailsProjection = useQuery(
    api.projections.queries.calculateProjectionWithGuardrails,
    projectionInputs?.profile && simulationInputs?.retirementAge
      ? {
          currentNetWorth: projectionInputs.currentNetWorth,
          annualSpending: projectionInputs.profile.annualSpending,
          currentAge: projectionInputs.profile.currentAge,
          retirementAge: simulationInputs.retirementAge,
        }
      : "skip"
  );

  // Actions for What-If
  const runWhatIf = useAction(api.monteCarlo.actions.runWhatIfSimulation);

  // Baseline for What-If (requires a run first)
  const [whatIfBaseline] = useState<{
    successRate: number;
  } | null>(null);

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
      const result = await runWhatIf(params);
      return {
        successRate: result.successRate,
        changesFromBaseline: result.changesFromBaseline,
      };
    },
    [runWhatIf]
  );

  // Set baseline when switching to What-If tab
  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };

  const isLoading = simulationInputs === undefined || assumptions === undefined;

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
              {isLoading ? (
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
