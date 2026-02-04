"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent } from "@/components/ui/Card";
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Info,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DataQualityCheckProps {
  onQualityChange?: (isReliable: boolean) => void;
}

type Severity = "error" | "warning" | "info" | "success";

interface Warning {
  severity: Severity;
  message: string;
  detail?: string;
}

export function DataQualityCheck({ onQualityChange }: DataQualityCheckProps) {
  const spendingSummary = useQuery(api.analytics.spending.getSpendingSummary, {
    monthsBack: 12,
  });
  const guardrailsConfig = useQuery(api.guardrails.queries.getWithDefaults);
  const assumptions = useQuery(api.monteCarlo.queries.getAssumptionsWithDefaults);

  // Loading state
  if (
    spendingSummary === undefined ||
    guardrailsConfig === undefined ||
    assumptions === undefined
  ) {
    return null;
  }

  const warnings: Warning[] = [];

  // Check spending data quality
  if (spendingSummary.dataQuality.monthsWithData === 0) {
    warnings.push({
      severity: "error",
      message: "No spending data available",
      detail: "Import transactions to enable accurate projections.",
    });
  } else if (spendingSummary.dataQuality.monthsWithData < 6) {
    warnings.push({
      severity: "warning",
      message: `Only ${spendingSummary.dataQuality.monthsWithData} months of spending data`,
      detail: "Need at least 6 months for reliable projections.",
    });
  } else if (!spendingSummary.dataQuality.isReliable) {
    warnings.push({
      severity: "warning",
      message: spendingSummary.dataQuality.reliabilityReason,
    });
  }

  // Check for missing months
  if (spendingSummary.dataQuality.missingMonths.length > 2) {
    warnings.push({
      severity: "warning",
      message: `Missing data for ${spendingSummary.dataQuality.missingMonths.length} months`,
      detail: "Spending average may be inaccurate.",
    });
  }

  // Check for outliers
  if (spendingSummary.dataQuality.hasOutliers) {
    warnings.push({
      severity: "info",
      message: `${spendingSummary.dataQuality.outlierMonths.length} months have unusual spending`,
      detail: "Consider reviewing for one-time expenses.",
    });
  }

  // Check for low transaction months
  if (spendingSummary.dataQuality.lowTransactionMonths.length > 0) {
    warnings.push({
      severity: "info",
      message: `${spendingSummary.dataQuality.lowTransactionMonths.length} months have few transactions`,
      detail: "Data may be incomplete for these periods.",
    });
  }

  // Check essential spending floor
  if (guardrailsConfig.isEnabled && !guardrailsConfig.spendingFloor) {
    warnings.push({
      severity: "warning",
      message: "Essential spending floor not set",
      detail: "Guardrails strategy requires a minimum spending level.",
    });
  }

  // Check assumptions are reasonable
  if (assumptions.realReturn > 0.08) {
    warnings.push({
      severity: "warning",
      message: `High return assumption (${(assumptions.realReturn * 100).toFixed(1)}%)`,
      detail: "Consider using a more conservative estimate (5-6%).",
    });
  }

  if (assumptions.volatility < 0.08) {
    warnings.push({
      severity: "info",
      message: `Low volatility assumption (${(assumptions.volatility * 100).toFixed(1)}%)`,
      detail: "May underestimate market risk.",
    });
  }

  // Notify parent of quality status
  const hasErrors = warnings.some((w) => w.severity === "error");
  const hasWarnings = warnings.some((w) => w.severity === "warning");
  const isReliable = !hasErrors && !hasWarnings;

  if (onQualityChange) {
    onQualityChange(isReliable);
  }

  // If no warnings, show success
  if (warnings.length === 0) {
    return (
      <Card className="border-green-500/30 bg-green-500/5">
        <CardContent className="py-3">
          <div className="flex items-center gap-2 text-green-500">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-sm font-medium">Data quality looks good</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Map severity to icon components - use inline components to avoid static component issue
  const severityIcons: Record<Severity, React.ReactNode> = {
    error: <XCircle className="w-4 h-4 text-red-500" />,
    warning: <AlertTriangle className="w-4 h-4 text-yellow-500" />,
    info: <Info className="w-4 h-4 text-blue-500" />,
    success: <CheckCircle2 className="w-4 h-4 text-green-500" />,
  };

  const getBorderColor = (severity: Severity) => {
    switch (severity) {
      case "error":
        return "border-red-500/30";
      case "warning":
        return "border-yellow-500/30";
      case "info":
        return "border-blue-500/30";
      case "success":
        return "border-green-500/30";
    }
  };

  // Get highest severity for card border
  const highestSeverity = hasErrors
    ? "error"
    : hasWarnings
    ? "warning"
    : "info";

  return (
    <Card className={cn(getBorderColor(highestSeverity))}>
      <CardContent className="py-3">
        <div className="space-y-2">
          {warnings.map((warning, idx) => (
            <div key={idx} className="flex items-start gap-2">
              {severityIcons[warning.severity]}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{warning.message}</p>
                {warning.detail && (
                  <p className="text-xs text-muted-foreground">{warning.detail}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Spending trend indicator */}
        {spendingSummary.dataQuality.monthsWithData >= 6 && (
          <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Spending trend:</span>
            <span
              className={cn(
                "flex items-center gap-1 font-medium",
                spendingSummary.trend === "increasing" && "text-red-500",
                spendingSummary.trend === "decreasing" && "text-green-500",
                spendingSummary.trend === "stable" && "text-muted-foreground"
              )}
            >
              {spendingSummary.trend === "increasing" && (
                <>
                  <TrendingUp className="w-4 h-4" />
                  Increasing
                </>
              )}
              {spendingSummary.trend === "decreasing" && (
                <>
                  <TrendingDown className="w-4 h-4" />
                  Decreasing
                </>
              )}
              {spendingSummary.trend === "stable" && (
                <>
                  <Minus className="w-4 h-4" />
                  Stable
                </>
              )}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
