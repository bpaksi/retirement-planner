"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { formatPercent, formatCurrency, cn } from "@/lib/utils";
import {
  calculateProjection,
  PROJECTION_DEFAULTS,
} from "@/lib/calculations/projections";
import {
  ArrowRight,
  RotateCcw,
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
  Save,
  LineChart,
  Shield,
  Dices,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from "lucide-react";

interface WhatIfCalculatorProps {
  baseline: {
    annualSpending: number;
    retirementAge: number;
    planToAge: number;
    ssClaimingAge?: number;
    successRate: number;
    // Additional baseline data for 3-model comparison
    currentNetWorth?: number;
    currentAge?: number;
    standardStatus?: "on_track" | "at_risk" | "behind";
    guardrailsEnabled?: boolean;
    guardrailsSpendingRange?: { min: number; max: number };
  };
  onRunWhatIf: (params: WhatIfParams) => Promise<{
    successRate: number;
    changesFromBaseline: string[];
  }>;
  onSaveAsBaseline?: (params: WhatIfParams) => Promise<void>;
  isLoading?: boolean;
}

interface WhatIfParams {
  annualSpending?: number;
  retirementAge?: number;
  planToAge?: number;
  ssClaimingAge?: number;
  guardrailsEnabled?: boolean;
}

interface SliderInputProps {
  label: string;
  value: number;
  baselineValue: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  format?: (value: number) => string;
  unit?: string;
}

function SliderInput({
  label,
  value,
  baselineValue,
  onChange,
  min,
  max,
  step = 1,
  format = (v) => v.toString(),
  unit,
}: SliderInputProps) {
  const diff = value - baselineValue;
  const diffPercent = baselineValue > 0 ? (diff / baselineValue) * 100 : 0;
  const hasChanged = value !== baselineValue;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">{label}</label>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{format(value)}{unit}</span>
          {hasChanged && (
            <span
              className={cn(
                "text-xs px-1.5 py-0.5 rounded",
                diff > 0 ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
              )}
            >
              {diff > 0 ? "+" : ""}
              {Math.abs(diffPercent) < 100
                ? `${diffPercent.toFixed(1)}%`
                : format(diff)}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
        />
        <Input
          type="number"
          value={value}
          onChange={(e) => {
            const newValue = Number(e.target.value);
            if (newValue >= min && newValue <= max) {
              onChange(newValue);
            }
          }}
          className="w-24 text-right"
          min={min}
          max={max}
          step={step}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{format(min)}{unit}</span>
        <span className="text-primary">Baseline: {format(baselineValue)}{unit}</span>
        <span>{format(max)}{unit}</span>
      </div>
    </div>
  );
}

// Component for 3-model comparison table
function ModelComparisonTable({
  baseline,
  whatIf,
  isLoading,
}: {
  baseline: {
    standard: { status: string; fundsTo: string };
    guardrails: { enabled: boolean; range?: string; status?: string };
    monteCarlo: { successRate: number };
  };
  whatIf: {
    standard: { status: string; fundsTo: string };
    guardrails: { enabled: boolean; range?: string; status?: string };
    monteCarlo: { successRate: number };
  } | null;
  isLoading: boolean;
}) {
  const getStatusIcon = (status: string) => {
    if (status === "on_track" || status === "success") {
      return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    }
    if (status === "at_risk" || status === "warning") {
      return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    }
    return <XCircle className="w-4 h-4 text-red-500" />;
  };

  const formatStatus = (status: string) => {
    if (status === "on_track") return "On Track";
    if (status === "at_risk") return "At Risk";
    if (status === "behind") return "Behind";
    return status;
  };

  const getChangeIndicator = (
    baselineValue: number,
    whatIfValue: number | null | undefined
  ) => {
    if (whatIfValue === null || whatIfValue === undefined) return null;
    const diff = whatIfValue - baselineValue;
    if (Math.abs(diff) < 0.001) return <Minus className="w-3 h-3 text-muted-foreground" />;
    if (diff > 0) return <TrendingUp className="w-3 h-3 text-green-500" />;
    return <TrendingDown className="w-3 h-3 text-red-500" />;
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50">
            <th className="px-3 py-2 text-left font-medium">Model</th>
            <th className="px-3 py-2 text-center font-medium">Current</th>
            <th className="px-3 py-2 text-center font-medium">What-If</th>
            <th className="px-3 py-2 text-center font-medium">Change</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {/* Standard */}
          <tr>
            <td className="px-3 py-2">
              <div className="flex items-center gap-2">
                <LineChart className="w-4 h-4 text-blue-500" />
                <span>Standard</span>
              </div>
            </td>
            <td className="px-3 py-2 text-center">
              <div className="flex items-center justify-center gap-1">
                {getStatusIcon(baseline.standard.status)}
                <span>{formatStatus(baseline.standard.status)}</span>
              </div>
            </td>
            <td className="px-3 py-2 text-center">
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin mx-auto" />
              ) : whatIf ? (
                <div className="flex items-center justify-center gap-1">
                  {getStatusIcon(whatIf.standard.status)}
                  <span>{formatStatus(whatIf.standard.status)}</span>
                </div>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </td>
            <td className="px-3 py-2 text-center">
              {whatIf && baseline.standard.status !== whatIf.standard.status ? (
                whatIf.standard.status === "on_track" && baseline.standard.status !== "on_track" ? (
                  <span className="text-green-500 text-xs">Improved</span>
                ) : whatIf.standard.status === "behind" && baseline.standard.status !== "behind" ? (
                  <span className="text-red-500 text-xs">Worse</span>
                ) : (
                  <span className="text-yellow-500 text-xs">Changed</span>
                )
              ) : (
                <span className="text-muted-foreground text-xs">—</span>
              )}
            </td>
          </tr>

          {/* Guardrails */}
          <tr>
            <td className="px-3 py-2">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-500" />
                <span>Guardrails</span>
              </div>
            </td>
            <td className="px-3 py-2 text-center">
              {baseline.guardrails.enabled ? (
                <span className="text-xs">{baseline.guardrails.range || "Enabled"}</span>
              ) : (
                <span className="text-muted-foreground text-xs">Disabled</span>
              )}
            </td>
            <td className="px-3 py-2 text-center">
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin mx-auto" />
              ) : whatIf?.guardrails.enabled ? (
                <span className="text-xs">{whatIf.guardrails.range || "Enabled"}</span>
              ) : (
                <span className="text-muted-foreground text-xs">Disabled</span>
              )}
            </td>
            <td className="px-3 py-2 text-center">
              {whatIf && whatIf.guardrails.enabled !== baseline.guardrails.enabled ? (
                whatIf.guardrails.enabled ? (
                  <span className="text-green-500 text-xs">Enabled</span>
                ) : (
                  <span className="text-muted-foreground text-xs">Disabled</span>
                )
              ) : whatIf?.guardrails.range !== baseline.guardrails.range ? (
                <span className="text-yellow-500 text-xs">Wider</span>
              ) : (
                <span className="text-muted-foreground text-xs">—</span>
              )}
            </td>
          </tr>

          {/* Monte Carlo */}
          <tr>
            <td className="px-3 py-2">
              <div className="flex items-center gap-2">
                <Dices className="w-4 h-4 text-purple-500" />
                <span>Monte Carlo</span>
              </div>
            </td>
            <td className="px-3 py-2 text-center">
              <span className={cn(
                "font-medium",
                baseline.monteCarlo.successRate >= 0.9 ? "text-green-500" :
                baseline.monteCarlo.successRate >= 0.7 ? "text-yellow-500" : "text-red-500"
              )}>
                {formatPercent(baseline.monteCarlo.successRate)}
              </span>
            </td>
            <td className="px-3 py-2 text-center">
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin mx-auto" />
              ) : whatIf ? (
                <span className={cn(
                  "font-medium",
                  whatIf.monteCarlo.successRate >= 0.9 ? "text-green-500" :
                  whatIf.monteCarlo.successRate >= 0.7 ? "text-yellow-500" : "text-red-500"
                )}>
                  {formatPercent(whatIf.monteCarlo.successRate)}
                </span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </td>
            <td className="px-3 py-2 text-center">
              {whatIf && (
                <div className="flex items-center justify-center gap-1">
                  {getChangeIndicator(baseline.monteCarlo.successRate, whatIf.monteCarlo.successRate)}
                  <span className={cn(
                    "text-xs",
                    (whatIf.monteCarlo.successRate - baseline.monteCarlo.successRate) > 0 ? "text-green-500" :
                    (whatIf.monteCarlo.successRate - baseline.monteCarlo.successRate) < 0 ? "text-red-500" : "text-muted-foreground"
                  )}>
                    {((whatIf.monteCarlo.successRate - baseline.monteCarlo.successRate) * 100).toFixed(1)}%
                  </span>
                </div>
              )}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function WhatIfCalculator({
  baseline,
  onRunWhatIf,
  onSaveAsBaseline,
  isLoading = false,
}: WhatIfCalculatorProps) {
  // What-if parameters
  const [spending, setSpending] = useState(baseline.annualSpending);
  const [retirementAge, setRetirementAge] = useState(baseline.retirementAge);
  const [planToAge, setPlanToAge] = useState(baseline.planToAge);
  const [ssClaimingAge, setSsClaimingAge] = useState(baseline.ssClaimingAge ?? 67);
  const [guardrailsEnabled, setGuardrailsEnabled] = useState(baseline.guardrailsEnabled ?? false);

  // Results
  const [whatIfResult, setWhatIfResult] = useState<{
    successRate: number;
    changesFromBaseline: string[];
  } | null>(null);

  // Check if anything changed
  const hasChanges =
    spending !== baseline.annualSpending ||
    retirementAge !== baseline.retirementAge ||
    planToAge !== baseline.planToAge ||
    (baseline.ssClaimingAge && ssClaimingAge !== baseline.ssClaimingAge) ||
    guardrailsEnabled !== (baseline.guardrailsEnabled ?? false);

  // Track previous hasChanges to avoid unnecessary setState
  const prevHasChanges = useRef(hasChanges);

  // Calculate what-if standard projection
  const whatIfStandardProjection = useMemo(() => {
    if (!baseline.currentNetWorth || !baseline.currentAge) return null;

    return calculateProjection({
      currentNetWorth: baseline.currentNetWorth,
      annualSpending: spending,
      currentAge: baseline.currentAge,
      retirementAge: retirementAge,
      lifeExpectancy: planToAge,
    });
  }, [baseline.currentNetWorth, baseline.currentAge, spending, retirementAge, planToAge]);

  // Calculate baseline standard projection
  const baselineStandardProjection = useMemo(() => {
    if (!baseline.currentNetWorth || !baseline.currentAge) return null;

    return calculateProjection({
      currentNetWorth: baseline.currentNetWorth,
      annualSpending: baseline.annualSpending,
      currentAge: baseline.currentAge,
      retirementAge: baseline.retirementAge,
      lifeExpectancy: baseline.planToAge,
    });
  }, [baseline]);

  // Auto-run simulation when parameters change (debounced)
  useEffect(() => {
    // Track transition from changes to no changes
    const wasChanged = prevHasChanges.current;
    prevHasChanges.current = hasChanges;

    // If no changes, potentially clear result via timeout (not synchronous)
    if (!hasChanges) {
      if (wasChanged) {
        // Schedule the clear to avoid synchronous setState
        const clearTimer = setTimeout(() => {
          setWhatIfResult(null);
        }, 0);
        return () => clearTimeout(clearTimer);
      }
      return;
    }

    const timer = setTimeout(async () => {
      const params: WhatIfParams = {};
      if (spending !== baseline.annualSpending) params.annualSpending = spending;
      if (retirementAge !== baseline.retirementAge) params.retirementAge = retirementAge;
      if (planToAge !== baseline.planToAge) params.planToAge = planToAge;
      if (baseline.ssClaimingAge && ssClaimingAge !== baseline.ssClaimingAge) {
        params.ssClaimingAge = ssClaimingAge;
      }
      if (guardrailsEnabled !== (baseline.guardrailsEnabled ?? false)) {
        params.guardrailsEnabled = guardrailsEnabled;
      }

      try {
        const result = await onRunWhatIf(params);
        setWhatIfResult(result);
      } catch {
        // Handle error silently - user will see no result
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [spending, retirementAge, planToAge, ssClaimingAge, guardrailsEnabled, baseline, hasChanges, onRunWhatIf]);

  const handleReset = () => {
    setSpending(baseline.annualSpending);
    setRetirementAge(baseline.retirementAge);
    setPlanToAge(baseline.planToAge);
    setSsClaimingAge(baseline.ssClaimingAge ?? 67);
    setGuardrailsEnabled(baseline.guardrailsEnabled ?? false);
    setWhatIfResult(null);
  };

  const handleSave = async () => {
    if (!onSaveAsBaseline || !hasChanges) return;

    const params: WhatIfParams = {};
    if (spending !== baseline.annualSpending) params.annualSpending = spending;
    if (retirementAge !== baseline.retirementAge) params.retirementAge = retirementAge;
    if (planToAge !== baseline.planToAge) params.planToAge = planToAge;
    if (baseline.ssClaimingAge && ssClaimingAge !== baseline.ssClaimingAge) {
      params.ssClaimingAge = ssClaimingAge;
    }
    if (guardrailsEnabled !== (baseline.guardrailsEnabled ?? false)) {
      params.guardrailsEnabled = guardrailsEnabled;
    }

    await onSaveAsBaseline(params);
  };

  const successDiff = whatIfResult
    ? whatIfResult.successRate - baseline.successRate
    : 0;

  // Build comparison data for the table
  const comparisonBaseline = {
    standard: {
      status: baseline.standardStatus ?? baselineStandardProjection?.status ?? "on_track",
      fundsTo: baselineStandardProjection?.expectedRunsOutAge
        ? `Age ${baselineStandardProjection.expectedRunsOutAge}`
        : `${PROJECTION_DEFAULTS.lifeExpectancy}+`,
    },
    guardrails: {
      enabled: baseline.guardrailsEnabled ?? false,
      range: baseline.guardrailsSpendingRange
        ? `${formatCurrency(baseline.guardrailsSpendingRange.min)}-${formatCurrency(baseline.guardrailsSpendingRange.max)}`
        : undefined,
    },
    monteCarlo: {
      successRate: baseline.successRate,
    },
  };

  const comparisonWhatIf = whatIfResult ? {
    standard: {
      status: whatIfStandardProjection?.status ?? "on_track",
      fundsTo: whatIfStandardProjection?.expectedRunsOutAge
        ? `Age ${whatIfStandardProjection.expectedRunsOutAge}`
        : `${planToAge}+`,
    },
    guardrails: {
      enabled: guardrailsEnabled,
      range: guardrailsEnabled ? "Varies" : undefined,
    },
    monteCarlo: {
      successRate: whatIfResult.successRate,
    },
  } : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">What-If Calculator</CardTitle>
          <div className="flex items-center gap-2">
            {hasChanges && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                disabled={isLoading}
              >
                <RotateCcw className="w-4 h-4 mr-1" />
                Reset
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Comparison Header */}
        <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-1">Current Plan</p>
            <p className="text-3xl font-bold">
              {formatPercent(baseline.successRate)}
            </p>
            <p className="text-xs text-muted-foreground">Monte Carlo success</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-1">What-If</p>
            {isLoading ? (
              <div className="flex items-center justify-center py-2">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : whatIfResult ? (
              <>
                <p className="text-3xl font-bold">
                  {formatPercent(whatIfResult.successRate)}
                </p>
                <p
                  className={cn(
                    "text-xs",
                    successDiff > 0
                      ? "text-green-500"
                      : successDiff < 0
                      ? "text-red-500"
                      : "text-muted-foreground"
                  )}
                >
                  {successDiff > 0 && <TrendingUp className="w-3 h-3 inline mr-1" />}
                  {successDiff < 0 && <TrendingDown className="w-3 h-3 inline mr-1" />}
                  {successDiff === 0 && <Minus className="w-3 h-3 inline mr-1" />}
                  {successDiff > 0 ? "+" : ""}
                  {(successDiff * 100).toFixed(1)}%
                </p>
              </>
            ) : (
              <p className="text-3xl font-bold text-muted-foreground">—</p>
            )}
          </div>
        </div>

        {/* 3-Model Comparison Table */}
        {(baseline.currentNetWorth || baseline.standardStatus) && (
          <div>
            <h4 className="text-sm font-medium mb-3">Impact on All Models</h4>
            <ModelComparisonTable
              baseline={comparisonBaseline}
              whatIf={comparisonWhatIf}
              isLoading={isLoading && hasChanges}
            />
          </div>
        )}

        {/* Sliders */}
        <div className="space-y-6">
          <SliderInput
            label="Annual Spending"
            value={spending}
            baselineValue={baseline.annualSpending}
            onChange={setSpending}
            min={Math.round(baseline.annualSpending * 0.5)}
            max={Math.round(baseline.annualSpending * 1.5)}
            step={1000}
            format={(v) => `$${Math.round(v / 1000)}k`}
          />

          <SliderInput
            label="Retirement Age"
            value={retirementAge}
            baselineValue={baseline.retirementAge}
            onChange={setRetirementAge}
            min={55}
            max={75}
            step={1}
          />

          <SliderInput
            label="Plan to Age"
            value={planToAge}
            baselineValue={baseline.planToAge}
            onChange={setPlanToAge}
            min={80}
            max={105}
            step={1}
          />

          {baseline.ssClaimingAge !== undefined && (
            <SliderInput
              label="SS Claiming Age"
              value={ssClaimingAge}
              baselineValue={baseline.ssClaimingAge}
              onChange={setSsClaimingAge}
              min={62}
              max={70}
              step={1}
            />
          )}

          {/* Guardrails Toggle */}
          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
            <div>
              <p className="font-medium text-sm">Enable Guardrails</p>
              <p className="text-xs text-muted-foreground">
                Automatically adjust spending based on portfolio
              </p>
            </div>
            <button
              onClick={() => setGuardrailsEnabled(!guardrailsEnabled)}
              className={cn(
                "w-12 h-6 rounded-full transition-colors relative",
                guardrailsEnabled ? "bg-primary" : "bg-muted"
              )}
            >
              <span
                className={cn(
                  "absolute top-1 w-4 h-4 rounded-full bg-white transition-transform",
                  guardrailsEnabled ? "translate-x-7" : "translate-x-1"
                )}
              />
            </button>
          </div>
        </div>

        {/* Changes Summary */}
        {whatIfResult && whatIfResult.changesFromBaseline.length > 0 && (
          <div className="p-3 bg-muted/30 rounded-lg">
            <p className="text-sm font-medium mb-2">Changes from baseline:</p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {whatIfResult.changesFromBaseline.map((change, idx) => (
                <li key={idx} className="flex items-center gap-2">
                  <ArrowRight className="w-3 h-3" />
                  {change}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Save Button */}
        {onSaveAsBaseline && whatIfResult && successDiff > 0 && (
          <Button
            onClick={handleSave}
            className="w-full"
            disabled={isLoading}
          >
            <Save className="w-4 h-4 mr-2" />
            Save as New Baseline
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
