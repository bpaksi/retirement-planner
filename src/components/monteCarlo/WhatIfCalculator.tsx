"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { formatPercent, cn } from "@/lib/utils";
import {
  ArrowRight,
  RotateCcw,
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
  Save,
} from "lucide-react";

interface WhatIfCalculatorProps {
  baseline: {
    annualSpending: number;
    retirementAge: number;
    planToAge: number;
    ssClaimingAge?: number;
    successRate: number;
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
  const [guardrailsEnabled, setGuardrailsEnabled] = useState(false);

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
    guardrailsEnabled;

  // Track previous hasChanges to avoid unnecessary setState
  const prevHasChanges = useRef(hasChanges);

  // Auto-run simulation when parameters change (debounced)
  useEffect(() => {
    // Only clear result if hasChanges transitioned from true to false
    if (!hasChanges && prevHasChanges.current) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWhatIfResult(null);
      prevHasChanges.current = hasChanges;
      return;
    }
    prevHasChanges.current = hasChanges;

    if (!hasChanges) {
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
      if (guardrailsEnabled) params.guardrailsEnabled = true;

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
    setGuardrailsEnabled(false);
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
    if (guardrailsEnabled) params.guardrailsEnabled = true;

    await onSaveAsBaseline(params);
  };

  const successDiff = whatIfResult
    ? whatIfResult.successRate - baseline.successRate
    : 0;

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
            <p className="text-xs text-muted-foreground">success rate</p>
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
