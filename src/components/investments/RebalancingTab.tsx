"use client";

import { Button } from "@/components/ui/Button";
import { formatCurrency, cn } from "@/lib/utils";
import {
  ASSET_CLASS_CONFIG,
  type AssetClass,
} from "@/lib/constants/investments";
import {
  AlertTriangle,
  CheckCircle,
  Settings,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

interface RebalanceAnalysis {
  assetClass: AssetClass;
  currentValue: number;
  currentPercent: number;
  targetPercent: number;
  threshold: number;
  drift: number;
  needsRebalance: boolean;
}

interface RebalancingTabProps {
  analysis: RebalanceAnalysis[];
  totalValue: number;
  needsRebalanceCount: number;
  hasTargets: boolean;
  onEditTargets: () => void;
}

export function RebalancingTab({
  analysis,
  totalValue,
  needsRebalanceCount,
  hasTargets,
  onEditTargets,
}: RebalancingTabProps) {
  if (!hasTargets) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
          <Settings className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">No Targets Set</h3>
        <p className="text-muted-foreground mb-4 max-w-md mx-auto">
          Set allocation targets to enable rebalancing analysis. This will help
          you track when your portfolio drifts from your desired allocation.
        </p>
        <Button onClick={onEditTargets}>Set Allocation Targets</Button>
      </div>
    );
  }

  if (analysis.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="mb-2">No holdings to analyze</p>
        <p className="text-sm">Import holdings to see rebalancing recommendations</p>
      </div>
    );
  }

  // Sort by absolute drift descending (most out of balance first)
  const sortedAnalysis = [...analysis].sort(
    (a, b) => Math.abs(b.drift) - Math.abs(a.drift)
  );

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-muted/50 rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Portfolio Value</p>
          <p className="text-2xl font-semibold">{formatCurrency(totalValue)}</p>
        </div>
        <div className="bg-muted/50 rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Asset Classes</p>
          <p className="text-2xl font-semibold">{analysis.length}</p>
        </div>
        <div
          className={cn(
            "rounded-lg p-4",
            needsRebalanceCount > 0 ? "bg-orange-500/10" : "bg-green-500/10"
          )}
        >
          <p className="text-sm text-muted-foreground">Need Rebalancing</p>
          <div className="flex items-center gap-2">
            <p className="text-2xl font-semibold">{needsRebalanceCount}</p>
            {needsRebalanceCount > 0 ? (
              <AlertTriangle className="w-5 h-5 text-orange-500" />
            ) : (
              <CheckCircle className="w-5 h-5 text-green-500" />
            )}
          </div>
        </div>
      </div>

      {/* Drift Analysis */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Drift Analysis</h3>
          <Button variant="outline" size="sm" onClick={onEditTargets}>
            <Settings className="w-4 h-4 mr-2" />
            Edit Targets
          </Button>
        </div>

        {sortedAnalysis.map((item) => {
          const driftPercent = item.drift * 100;
          const thresholdPercent = item.threshold * 100;
          const maxBar = Math.max(Math.abs(driftPercent), thresholdPercent, 10);
          const barWidth = Math.min(Math.abs(driftPercent) / maxBar * 100, 100);

          return (
            <div
              key={item.assetClass}
              className={cn(
                "rounded-lg border p-4",
                item.needsRebalance
                  ? "border-orange-500/50 bg-orange-500/5"
                  : "border-border"
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{
                      backgroundColor:
                        ASSET_CLASS_CONFIG[item.assetClass]?.color ?? "#6B7280",
                    }}
                  />
                  <span className="font-medium">
                    {ASSET_CLASS_CONFIG[item.assetClass]?.label ??
                      item.assetClass}
                  </span>
                  {item.needsRebalance && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-500">
                      Needs Rebalancing
                    </span>
                  )}
                </div>
                <span className="text-sm text-muted-foreground">
                  {formatCurrency(item.currentValue)}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-4 text-sm mb-3">
                <div>
                  <p className="text-muted-foreground text-xs">Current</p>
                  <p className="font-mono">
                    {(item.currentPercent * 100).toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Target</p>
                  <p className="font-mono">
                    {(item.targetPercent * 100).toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Threshold</p>
                  <p className="font-mono">±{thresholdPercent.toFixed(1)}%</p>
                </div>
              </div>

              {/* Visual drift bar */}
              <div className="relative">
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  {/* Threshold markers */}
                  <div
                    className="absolute top-0 bottom-0 border-l border-dashed border-muted-foreground/30"
                    style={{ left: `${50 - (thresholdPercent / maxBar) * 50}%` }}
                  />
                  <div
                    className="absolute top-0 bottom-0 border-l border-dashed border-muted-foreground/30"
                    style={{ left: `${50 + (thresholdPercent / maxBar) * 50}%` }}
                  />
                  {/* Center line */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-muted-foreground/50"
                    style={{ left: "50%" }}
                  />
                  {/* Drift bar */}
                  {item.drift !== 0 && (
                    <div
                      className={cn(
                        "absolute top-0 bottom-0 rounded-full",
                        item.drift > 0 ? "bg-blue-500" : "bg-orange-500",
                        item.needsRebalance ? "opacity-100" : "opacity-60"
                      )}
                      style={{
                        left: item.drift > 0 ? "50%" : `${50 - barWidth / 2}%`,
                        width: `${barWidth / 2}%`,
                      }}
                    />
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between mt-2 text-xs">
                <span
                  className={cn(
                    "flex items-center gap-1",
                    item.drift > 0 ? "text-blue-500" : item.drift < 0 ? "text-orange-500" : "text-muted-foreground"
                  )}
                >
                  {item.drift > 0 ? (
                    <>
                      <TrendingUp className="w-3 h-3" />
                      Overweight
                    </>
                  ) : item.drift < 0 ? (
                    <>
                      <TrendingDown className="w-3 h-3" />
                      Underweight
                    </>
                  ) : (
                    "On target"
                  )}
                </span>
                <span
                  className={cn(
                    "font-mono",
                    item.needsRebalance
                      ? item.drift > 0
                        ? "text-blue-500"
                        : "text-orange-500"
                      : "text-muted-foreground"
                  )}
                >
                  {driftPercent >= 0 ? "+" : ""}
                  {driftPercent.toFixed(1)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {needsRebalanceCount === 0 && (
        <div className="text-center py-6 bg-green-500/5 rounded-lg border border-green-500/20">
          <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
          <p className="font-medium text-green-500">Portfolio is balanced</p>
          <p className="text-sm text-muted-foreground">
            All asset classes are within their target thresholds
          </p>
        </div>
      )}
    </div>
  );
}
