"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { formatCurrency, cn } from "@/lib/utils";
import {
  Shield,
  Settings,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  TrendingDown,
  Info,
  Loader2,
} from "lucide-react";

// Import server actions for data fetching
import { fetchGuardrailsConfig } from "@/app/actions/data";

// Import actions
import { upsertGuardrailsConfig, toggleGuardrails } from "@/app/actions/guardrails";

// Default guardrails values
const GUARDRAILS_DEFAULTS = {
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

interface GuardrailsConfigProps {
  baseSpending: number;
}

export function GuardrailsConfig({ baseSpending }: GuardrailsConfigProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [config, setConfig] = useState<GuardrailsConfigWithDefaults | null>(null);

  // Form state
  const [isEnabled, setIsEnabled] = useState(false);
  const [upperThreshold, setUpperThreshold] = useState("20");
  const [lowerThreshold, setLowerThreshold] = useState("20");
  const [adjustmentPercent, setAdjustmentPercent] = useState("10");
  const [strategyType, setStrategyType] = useState<"percentage" | "fixed">("percentage");
  const [fixedAmount, setFixedAmount] = useState("");
  const [spendingFloor, setSpendingFloor] = useState("");
  const [spendingCeiling, setSpendingCeiling] = useState("");

  // Load config on mount
  const loadConfig = useCallback(async () => {
    setIsLoading(true);
    try {
      const dbConfig = await fetchGuardrailsConfig();

      // Apply defaults if no config exists
      const configWithDefaults: GuardrailsConfigWithDefaults = dbConfig
        ? {
            isEnabled: dbConfig.isEnabled,
            upperThresholdPercent: dbConfig.upperThresholdPercent,
            lowerThresholdPercent: dbConfig.lowerThresholdPercent,
            spendingAdjustmentPercent: dbConfig.spendingAdjustmentPercent,
            strategyType: dbConfig.strategyType,
            spendingFloor: dbConfig.spendingFloor,
            spendingCeiling: dbConfig.spendingCeiling,
            fixedAdjustmentAmount: dbConfig.fixedAdjustmentAmount,
          }
        : {
            isEnabled: false,
            upperThresholdPercent: GUARDRAILS_DEFAULTS.upperThresholdPercent,
            lowerThresholdPercent: GUARDRAILS_DEFAULTS.lowerThresholdPercent,
            spendingAdjustmentPercent: GUARDRAILS_DEFAULTS.spendingAdjustmentPercent,
            strategyType: GUARDRAILS_DEFAULTS.strategyType,
            spendingFloor: undefined,
            spendingCeiling: undefined,
            fixedAdjustmentAmount: undefined,
          };

      setConfig(configWithDefaults);
    } catch (error) {
      console.error("Failed to load guardrails config:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // Initialize form from config
  useEffect(() => {
    if (config) {
      setIsEnabled(config.isEnabled);
      setUpperThreshold((config.upperThresholdPercent * 100).toString());
      setLowerThreshold((config.lowerThresholdPercent * 100).toString());
      setAdjustmentPercent((config.spendingAdjustmentPercent * 100).toString());
      setStrategyType(config.strategyType);
      setFixedAmount(config.fixedAdjustmentAmount?.toString() ?? "");
      setSpendingFloor(config.spendingFloor?.toString() ?? "");
      setSpendingCeiling(config.spendingCeiling?.toString() ?? "");
    }
  }, [config]);

  const handleToggleEnabled = async () => {
    const newEnabled = !isEnabled;
    await toggleGuardrails(newEnabled);
    setIsEnabled(newEnabled);
    await loadConfig();
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await upsertGuardrailsConfig({
        isEnabled,
        upperThresholdPercent: parseFloat(upperThreshold) / 100,
        lowerThresholdPercent: parseFloat(lowerThreshold) / 100,
        spendingAdjustmentPercent: parseFloat(adjustmentPercent) / 100,
        strategyType,
        fixedAdjustmentAmount: fixedAmount ? parseFloat(fixedAmount) : undefined,
        spendingFloor: spendingFloor ? parseFloat(spendingFloor) : undefined,
        spendingCeiling: spendingCeiling ? parseFloat(spendingCeiling) : undefined,
      });
      await loadConfig();
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate example adjustments
  const upperAdjustment = strategyType === "percentage"
    ? baseSpending * (parseFloat(adjustmentPercent) / 100)
    : parseFloat(fixedAmount) || 0;
  const lowerAdjustment = upperAdjustment;

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center",
              isEnabled ? "bg-primary/10" : "bg-muted"
            )}>
              <Shield className={cn(
                "w-5 h-5",
                isEnabled ? "text-primary" : "text-muted-foreground"
              )} />
            </div>
            <div>
              <CardTitle className="text-lg">Guardrails Strategy</CardTitle>
              <p className="text-sm text-muted-foreground">
                {isEnabled
                  ? "Dynamic spending adjustments enabled"
                  : "Adjust spending based on portfolio performance"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={isEnabled ? "default" : "outline"}
              size="sm"
              onClick={handleToggleEnabled}
            >
              {isEnabled ? "Enabled" : "Disabled"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              <Settings className="w-4 h-4 mr-1" />
              {isExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      {/* Quick Summary (when collapsed) */}
      {!isExpanded && isEnabled && (
        <CardContent className="pt-0">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-500" />
              <span>
                +{upperThreshold}% triggers +{formatCurrency(upperAdjustment)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-red-500" />
              <span>
                -{lowerThreshold}% triggers -{formatCurrency(lowerAdjustment)}
              </span>
            </div>
            <div className="text-muted-foreground">
              {spendingFloor && `Floor: ${formatCurrency(parseFloat(spendingFloor))}`}
              {spendingFloor && spendingCeiling && " | "}
              {spendingCeiling && `Ceiling: ${formatCurrency(parseFloat(spendingCeiling))}`}
            </div>
          </div>
        </CardContent>
      )}

      {/* Expanded Settings */}
      {isExpanded && (
        <CardContent className="pt-0 space-y-6">
          {/* Info Box */}
          <div className="bg-muted/50 rounded-lg p-4 flex items-start gap-3">
            <Info className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p>
                <strong>How guardrails work:</strong> When your portfolio exceeds the upper
                threshold, spending increases. When it falls below the lower threshold,
                spending decreases. This helps avoid running out of money while also
                enjoying good years.
              </p>
            </div>
          </div>

          {/* Threshold Settings */}
          <div>
            <h4 className="text-sm font-medium mb-3">Thresholds</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">
                  Upper Threshold (%)
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="5"
                    max="50"
                    step="5"
                    value={upperThreshold}
                    onChange={(e) => setUpperThreshold(e.target.value)}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">above target</span>
                </div>
                <p className="text-xs text-green-600 mt-1">
                  Increase spending when portfolio is {upperThreshold}%+ above expected
                </p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">
                  Lower Threshold (%)
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="5"
                    max="50"
                    step="5"
                    value={lowerThreshold}
                    onChange={(e) => setLowerThreshold(e.target.value)}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">below target</span>
                </div>
                <p className="text-xs text-red-600 mt-1">
                  Decrease spending when portfolio is {lowerThreshold}%+ below expected
                </p>
              </div>
            </div>
          </div>

          {/* Adjustment Settings */}
          <div>
            <h4 className="text-sm font-medium mb-3">Spending Adjustment</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">
                  Adjustment Type
                </label>
                <Select
                  value={strategyType}
                  onChange={(e) => setStrategyType(e.target.value as "percentage" | "fixed")}
                >
                  <option value="percentage">Percentage of spending</option>
                  <option value="fixed">Fixed dollar amount</option>
                </Select>
              </div>
              <div>
                {strategyType === "percentage" ? (
                  <>
                    <label className="text-sm text-muted-foreground mb-1.5 block">
                      Adjustment Amount (%)
                    </label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="1"
                        max="25"
                        step="1"
                        value={adjustmentPercent}
                        onChange={(e) => setAdjustmentPercent(e.target.value)}
                        className="w-24"
                      />
                      <span className="text-sm text-muted-foreground">
                        = {formatCurrency(baseSpending * parseFloat(adjustmentPercent || "0") / 100)}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <label className="text-sm text-muted-foreground mb-1.5 block">
                      Fixed Amount ($)
                    </label>
                    <Input
                      type="number"
                      min="0"
                      step="1000"
                      value={fixedAmount}
                      onChange={(e) => setFixedAmount(e.target.value)}
                      placeholder="e.g., 5000"
                    />
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Floor and Ceiling */}
          <div>
            <h4 className="text-sm font-medium mb-3">Spending Limits (Optional)</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">
                  Spending Floor ($)
                </label>
                <Input
                  type="number"
                  min="0"
                  step="1000"
                  value={spendingFloor}
                  onChange={(e) => setSpendingFloor(e.target.value)}
                  placeholder="Minimum annual spending"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Never go below this amount
                </p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">
                  Spending Ceiling ($)
                </label>
                <Input
                  type="number"
                  min="0"
                  step="1000"
                  value={spendingCeiling}
                  onChange={(e) => setSpendingCeiling(e.target.value)}
                  placeholder="Maximum annual spending"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Never exceed this amount
                </p>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end pt-2">
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
