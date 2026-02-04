"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Sidebar } from "@/components/layout/Sidebar";
import { Card, CardContent } from "@/components/ui/Card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { ProjectionChart } from "@/components/projections/ProjectionChart";
import { QuickSettings } from "@/components/projections/QuickSettings";
import { ReadinessStatus, ReadinessStatusBadge } from "@/components/projections/ReadinessStatus";
import { GuardrailsConfig } from "@/components/projections/GuardrailsConfig";
import { GuardrailsChart } from "@/components/projections/GuardrailsChart";
import { MonteCarloTab } from "@/components/monteCarlo/MonteCarloTab";
import {
  calculateProjection,
  calculateRetirementAge,
  formatTimeUntilRetirement,
  PROJECTION_DEFAULTS,
} from "@/lib/calculations/projections";
import { formatCurrency } from "@/lib/utils";
import {
  Calendar,
  TrendingUp,
  Target,
  Loader2,
  ChevronDown,
  ChevronUp,
  Info,
  LineChart,
  Shield,
  Dices,
} from "lucide-react";

export default function ProjectionsPage() {
  const [showAssumptions, setShowAssumptions] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("standard");

  // Queries
  const inputs = useQuery(api.projections.queries.getProjectionInputs);
  const guardrailsConfig = useQuery(api.guardrails.queries.getWithDefaults);
  const upsertProfile = useMutation(api.retirementProfile.mutations.upsert);

  // Calculate retirement age for the guardrails query
  const retirementAge = useMemo(() => {
    if (!inputs?.profile) return null;
    return calculateRetirementAge(
      inputs.profile.retirementDate,
      inputs.profile.currentAge
    );
  }, [inputs?.profile]);

  // Guardrails projection query (only when enabled and we have profile)
  const guardrailsProjection = useQuery(
    api.projections.queries.calculateProjectionWithGuardrails,
    inputs?.profile && retirementAge
      ? {
          currentNetWorth: inputs.currentNetWorth,
          annualSpending: inputs.profile.annualSpending,
          currentAge: inputs.profile.currentAge,
          retirementAge: retirementAge,
        }
      : "skip"
  );

  const isLoading = inputs === undefined;

  // Calculate standard projection when we have data
  const projection = useMemo(() => {
    if (!inputs?.profile || !retirementAge) return null;

    const { profile, currentNetWorth } = inputs;

    return calculateProjection({
      currentNetWorth,
      annualSpending: profile.annualSpending,
      currentAge: profile.currentAge,
      retirementAge,
    });
  }, [inputs, retirementAge]);

  const yearsUntilRetirement = useMemo(() => {
    if (!inputs?.profile) return null;
    const retireDate = new Date(inputs.profile.retirementDate);
    const now = new Date();
    return (retireDate.getTime() - now.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  }, [inputs?.profile]);

  const handleSaveSettings = async (settings: {
    retirementDate: number;
    currentAge: number;
    annualSpending: number;
    isSpendingAutoCalculated: boolean;
  }) => {
    setIsSaving(true);
    try {
      await upsertProfile(settings);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold">Retirement Projections</h1>
            <p className="text-muted-foreground mt-1">
              See how your retirement savings may grow over time
            </p>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Summary Cards - only show if we have a profile */}
              {inputs?.profile && projection && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Time Until Retirement */}
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Calendar className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Retire in
                          </p>
                          <p className="text-2xl font-semibold">
                            {yearsUntilRetirement !== null && yearsUntilRetirement > 0
                              ? formatTimeUntilRetirement(yearsUntilRetirement)
                              : "Retired"}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Projected Net Worth at Retirement */}
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                          <TrendingUp className="w-5 h-5 text-green-500" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Projected at Retirement
                          </p>
                          <p className="text-2xl font-semibold">
                            {formatCurrency(projection.projectedNetWorthAtRetirement)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Status */}
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                          <Target className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Status</p>
                          <ReadinessStatusBadge status={projection.status} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Projection Tabs */}
              {inputs?.profile && projection && retirementAge && (
                <Card>
                  <CardContent className="pt-6">
                    <Tabs defaultValue="standard" value={activeTab} onValueChange={setActiveTab}>
                      <TabsList>
                        <TabsTrigger value="standard">
                          <LineChart className="w-4 h-4 mr-2" />
                          Standard Projection
                        </TabsTrigger>
                        <TabsTrigger value="guardrails">
                          <Shield className="w-4 h-4 mr-2" />
                          Guardrails Strategy
                          {guardrailsConfig?.isEnabled && (
                            <span className="ml-2 w-2 h-2 rounded-full bg-green-500" />
                          )}
                        </TabsTrigger>
                        <TabsTrigger value="montecarlo">
                          <Dices className="w-4 h-4 mr-2" />
                          Monte Carlo
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="standard" className="mt-6">
                        <ProjectionChart
                          data={projection.years}
                          retirementAge={retirementAge}
                          currentAge={inputs.profile.currentAge}
                          height={400}
                        />
                      </TabsContent>

                      <TabsContent value="guardrails" className="mt-6 space-y-6">
                        {/* Guardrails Config */}
                        <GuardrailsConfig baseSpending={inputs.profile.annualSpending} />

                        {/* Guardrails Chart (only if enabled) */}
                        {guardrailsProjection?.isEnabled && guardrailsProjection.summary && (
                          <GuardrailsChart
                            years={guardrailsProjection.years}
                            summary={guardrailsProjection.summary}
                            retirementAge={retirementAge}
                            currentAge={inputs.profile.currentAge}
                            lifeExpectancy={PROJECTION_DEFAULTS.lifeExpectancy}
                          />
                        )}

                        {/* Message when guardrails not enabled */}
                        {!guardrailsConfig?.isEnabled && (
                          <div className="text-center py-12 bg-muted/30 rounded-lg">
                            <Shield className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                            <h3 className="font-medium mb-2">
                              Enable Guardrails to See Dynamic Spending
                            </h3>
                            <p className="text-sm text-muted-foreground max-w-md mx-auto">
                              The guardrails strategy automatically adjusts your spending based on
                              portfolio performance, helping you avoid running out of money while
                              enjoying good years.
                            </p>
                          </div>
                        )}
                      </TabsContent>

                      <TabsContent value="montecarlo" className="mt-6">
                        <MonteCarloTab />
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              )}

              {/* Status Details - only show if we have projection */}
              {inputs?.profile && projection && (
                <ReadinessStatus
                  status={projection.status}
                  expectedRunsOutAge={projection.expectedRunsOutAge}
                  optimisticRunsOutAge={projection.optimisticRunsOutAge}
                  pessimisticRunsOutAge={projection.pessimisticRunsOutAge}
                  lifeExpectancy={PROJECTION_DEFAULTS.lifeExpectancy}
                />
              )}

              {/* Quick Settings */}
              <QuickSettings
                retirementDate={inputs?.profile?.retirementDate ?? null}
                currentAge={inputs?.profile?.currentAge ?? null}
                annualSpending={inputs?.profile?.annualSpending ?? null}
                suggestedSpending={inputs?.suggestedSpending ?? 0}
                isSpendingAutoCalculated={inputs?.profile?.isSpendingAutoCalculated ?? false}
                onSave={handleSaveSettings}
                isSaving={isSaving}
              />

              {/* Current Net Worth Summary */}
              {inputs && (
                <Card>
                  <CardContent className="pt-6">
                    <h3 className="font-medium mb-4">Current Financial Snapshot</h3>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Net Worth</p>
                        <p className="text-lg font-semibold">
                          {formatCurrency(inputs.currentNetWorth)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Investments</p>
                        <p className="text-lg font-semibold">
                          {formatCurrency(inputs.investments)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Cash</p>
                        <p className="text-lg font-semibold">
                          {formatCurrency(inputs.cash)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Assets</p>
                        <p className="text-lg font-semibold">
                          {formatCurrency(inputs.assets)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Liabilities</p>
                        <p className="text-lg font-semibold text-red-500">
                          -{formatCurrency(inputs.liabilities)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Collapsible Assumptions */}
              <Card>
                <CardContent className="pt-6">
                  <button
                    onClick={() => setShowAssumptions(!showAssumptions)}
                    className="flex items-center justify-between w-full text-left"
                  >
                    <div className="flex items-center gap-2">
                      <Info className="w-4 h-4 text-muted-foreground" />
                      <h3 className="font-medium">Projection Assumptions</h3>
                    </div>
                    {showAssumptions ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>

                  {showAssumptions && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Expected Return</p>
                          <p className="font-medium">
                            {(PROJECTION_DEFAULTS.expectedReturn * 100).toFixed(0)}% real
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Optimistic Return</p>
                          <p className="font-medium">
                            {(PROJECTION_DEFAULTS.optimisticReturn * 100).toFixed(0)}% real
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Pessimistic Return</p>
                          <p className="font-medium">
                            {(PROJECTION_DEFAULTS.pessimisticReturn * 100).toFixed(0)}% real
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Plan to Age</p>
                          <p className="font-medium">{PROJECTION_DEFAULTS.lifeExpectancy}</p>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-4">
                        Returns are &quot;real&quot; returns (after inflation). Spending is assumed constant
                        in today&apos;s dollars. This is a simplified projection and does not account
                        for taxes, Social Security, or other income sources.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
